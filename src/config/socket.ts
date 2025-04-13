import { Server, Socket } from "socket.io";
import { Server as HttpServer } from "http";
import { verifyToken } from "@utils/helpers";
import User from "@models/User";
import { DbOperations } from "@utils/dbOperations";
import { SocketService } from "@services/socket.service";
import { SocketErrorService } from "@services/socketError.service";

/* global process */

// Define event types for better type safety
interface ServerToClientEvents {
    userStatus: (data: {
        userId: string;
        status: string;
        lastSeen: Date;
    }) => void;
    newMessage: (data: { message: any; conversationId: string }) => void;
    messageRead: (data: {
        messageId: string;
        conversationId: string;
        readBy: string;
    }) => void;
    typing: (data: {
        userId: string;
        conversationId: string;
        isTyping: boolean;
    }) => void;
    error: (data: { message: string; code?: string }) => void;

    // New events
    conversationCreated: (data: { conversation: any }) => void;
    conversationUpdated: (data: { conversation: any }) => void;
    conversationDeleted: (data: { conversationId: string }) => void;
    userJoinedGroup: (data: { conversationId: string; user: any }) => void;
    userLeftGroup: (data: { conversationId: string; userId: string }) => void;
    messageDeleted: (data: {
        messageId: string;
        conversationId: string;
    }) => void;
    messageEdited: (data: {
        messageId: string;
        conversationId: string;
        content: string;
    }) => void;
    searchResults: (data: { messages: any[]; conversations: any[] }) => void;
}

interface ClientToServerEvents {
    sendMessage: (
        data: { conversationId: string; content: string },
        callback: (success: boolean) => void
    ) => void;
    joinConversation: (
        conversationId: string,
        callback: (success: boolean) => void
    ) => void;
    leaveConversation: (conversationId: string) => void;
    markMessageRead: (data: {
        messageId: string;
        conversationId: string;
    }) => void;
    startTyping: (conversationId: string) => void;
    stopTyping: (conversationId: string) => void;

    // New events
    createConversation: (
        data: {
            type: "DM" | "GroupDM";
            participants: string[];
            name?: string;
            description?: string;
        },
        callback: (success: boolean, conversation?: any) => void
    ) => void;

    updateConversation: (
        data: {
            conversationId: string;
            updates: {
                name?: string;
                description?: string;
                settings?: any;
            };
        },
        callback: (success: boolean) => void
    ) => void;

    deleteConversation: (
        conversationId: string,
        callback: (success: boolean) => void
    ) => void;

    addParticipants: (
        data: {
            conversationId: string;
            userIds: string[];
        },
        callback: (success: boolean) => void
    ) => void;

    removeParticipant: (
        data: {
            conversationId: string;
            userId: string;
        },
        callback: (success: boolean) => void
    ) => void;

    deleteMessage: (
        data: {
            messageId: string;
            conversationId: string;
        },
        callback: (success: boolean) => void
    ) => void;

    editMessage: (
        data: {
            messageId: string;
            conversationId: string;
            content: string;
        },
        callback: (success: boolean) => void
    ) => void;

    searchMessages: (
        data: {
            query: string;
            conversationId?: string;
        },
        callback: (results: any) => void
    ) => void;

    getConversations: (callback: (conversations: any[]) => void) => void;
}

interface InterServerEvents {
    ping: () => void;
}

interface SocketData {
    userId: string;
    user: {
        name: string;
        status: string;
        lastSeen: Date;
    } | null;
}

let io: Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
>;

export const initializeSocket = (
    server: HttpServer
): Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
> => {
    io = new Server<
        ClientToServerEvents,
        ServerToClientEvents,
        InterServerEvents,
        SocketData
    >(server, {
        cors: {
            origin: process.env.CLIENT_URL || "*",
            methods: ["GET", "POST"],
            credentials: true,
        },
        pingTimeout: 60000,
        pingInterval: 25000,
        connectTimeout: 45000,
        maxHttpBufferSize: 1e8, // 100MB
        transports: ["websocket", "polling"],
    });

    // Socket middleware for authentication
    io.use(
        async (
            socket: Socket<
                ClientToServerEvents,
                ServerToClientEvents,
                InterServerEvents,
                SocketData
            >,
            next: (err?: Error) => void
        ) => {
            try {
                // Try to get token from different sources
                const token =
                    socket.handshake.auth.token || // Original auth method
                    socket.handshake.headers["x-auth-token"] || // From headers
                    (socket.handshake.query.token as string); // From query params

                if (!token) {
                    return next(
                        new Error("Authentication error: Token not provided")
                    );
                }

                const decoded = await verifyToken(token);
                if (!decoded || !decoded.id) {
                    return next(
                        new Error("Authentication error: Invalid token")
                    );
                }

                socket.data.userId = decoded.id;
                const user = await SocketService.getUserData(decoded.id);
                socket.data.user = user;
                next();
            } catch (_error) {
                next(new Error("Authentication error: Invalid token"));
            }
        }
    );

    io.on(
        "connection",
        async (
            socket: Socket<
                ClientToServerEvents,
                ServerToClientEvents,
                InterServerEvents,
                SocketData
            >
        ) => {
            const userId = socket.data.userId;
            if (!userId) {
                socket.disconnect();
                return;
            }

            console.log(`User ${userId} connected. with ID: ${socket.id}`);

            try {
                // Handle user connection
                await SocketService.handleUserConnection(userId, socket);

                // Set up event handlers
                await SocketService.handleSocket(socket);

                socket.on("disconnect", async () => {
                    console.log(`User ${userId} disconnected`);
                    try {
                        await SocketService.handleUserDisconnection(userId);
                    } catch (_error) {
                        SocketErrorService.handleDisconnectError(
                            socket,
                            _error as Error
                        );
                    }
                });
            } catch (_error) {
                SocketErrorService.handleConnectionError(
                    socket,
                    _error as Error
                );
            }
        }
    );

    return io;
};

export const getIO = (): Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
> => {
    if (!io) {
        throw new Error("Socket.io not initialized");
    }
    return io;
};

export const getConnectedUsers = async () => {
    return DbOperations.findMany(
        User,
        { status: "online" },
        "name status lastSeen"
    );
};
