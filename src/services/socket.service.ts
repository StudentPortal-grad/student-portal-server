import { Socket } from "socket.io";
import { Types } from "mongoose";
import { DbOperations } from "@utils/dbOperations";
import User from "@models/User";
import { getIO } from "@config/socket";

export class SocketService {
    static async handleUserConnection(userId: string, socketId: string) {
        await this.updateUserStatus(userId, "online", socketId);
        return this.broadcastUserStatus(userId, "online");
    }

    static async handleUserDisconnection(userId: string) {
        await this.updateUserStatus(userId, "offline", null);
        return this.broadcastUserStatus(userId, "offline");
    }

    static async updateUserStatus(
        userId: string,
        status: string,
        socketId?: string | null
    ) {
        const update = {
            status,
            lastSeen: new Date(),
            ...(socketId !== undefined && { socketId }),
        };
        return DbOperations.updateOne(User, { _id: userId }, update);
    }

    static broadcastUserStatus(userId: string, status: string) {
        const io = getIO();
        io.emit("userStatus", {
            userId,
            status,
            lastSeen: new Date(),
        });
    }

    static async getUserData(userId: string) {
        return DbOperations.findOneWithSelect(
            User,
            { _id: userId },
            "name status lastSeen"
        );
    }

    static validateObjectId(id: string): boolean {
        return Types.ObjectId.isValid(id);
    }

    static async handleMessageEvents(socket: Socket) {
        socket.on("sendMessage", async (data, callback) => {
            try {
                if (!this.validateObjectId(data.conversationId)) {
                    callback(false);
                    return;
                }
                const io = getIO();
                io.to(data.conversationId).emit("newMessage", {
                    message: data,
                    conversationId: data.conversationId,
                });
                callback(true);
            } catch (_error) {
                callback(false);
            }
        });

        socket.on("markMessageRead", async (data) => {
            try {
                if (
                    !this.validateObjectId(data.conversationId) ||
                    !this.validateObjectId(data.messageId)
                ) {
                    return;
                }
                const io = getIO();
                io.to(data.conversationId).emit("messageRead", {
                    messageId: data.messageId,
                    conversationId: data.conversationId,
                    readBy: socket.data.userId,
                });
            } catch (_error) {
                console.error("Error marking message as read:", _error);
            }
        });
    }

    static async handleTypingEvents(socket: Socket) {
        socket.on("startTyping", (conversationId) => {
            if (this.validateObjectId(conversationId)) {
                socket.to(conversationId).emit("typing", {
                    userId: socket.data.userId,
                    conversationId,
                    isTyping: true,
                });
            }
        });

        socket.on("stopTyping", (conversationId) => {
            if (this.validateObjectId(conversationId)) {
                socket.to(conversationId).emit("typing", {
                    userId: socket.data.userId,
                    conversationId,
                    isTyping: false,
                });
            }
        });
    }

    static async handleConversationEvents(socket: Socket) {
        socket.on("joinConversation", async (conversationId, callback) => {
            try {
                if (!this.validateObjectId(conversationId)) {
                    callback(false);
                    return;
                }
                socket.join(conversationId);
                callback(true);
            } catch (_error) {
                callback(false);
            }
        });

        socket.on("leaveConversation", (conversationId) => {
            if (this.validateObjectId(conversationId)) {
                socket.leave(conversationId);
            }
        });
    }
}
