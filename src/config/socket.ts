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
}

interface ClientToServerEvents {
    joinConversation: (
        conversationId: string,
        callback: (success: boolean) => void
    ) => void;
    leaveConversation: (conversationId: string) => void;
    sendMessage: (
        data: { conversationId: string; content: string },
        callback: (success: boolean) => void
    ) => void;
    markMessageRead: (data: {
        messageId: string;
        conversationId: string;
    }) => void;
    startTyping: (conversationId: string) => void;
    stopTyping: (conversationId: string) => void;
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
                const token = socket.handshake.auth.token;
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

            console.log(`User ${userId} connected`);

            try {
                // Handle user connection
                await SocketService.handleUserConnection(userId, socket.id);

                // Set up event handlers
                await SocketService.handleConversationEvents(socket);
                await SocketService.handleMessageEvents(socket);
                await SocketService.handleTypingEvents(socket);

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
