import { DbOperations } from "@utils/dbOperations";
import User from "@models/User";
import { getIO } from "@config/socket";
import { SocketHelpers as UtilSocketHelpers } from "@utils/socketHelpers";
import { Socket } from "socket.io";

/**
 * Socket helper functions for user connections and status management
 */
export class SocketHelpers {
    /**
     * Validates if a string is a valid MongoDB ObjectId
     * @param id The string to validate
     * @returns boolean indicating if the string is a valid ObjectId
     */
    static validateObjectId(id: string): boolean {
        return UtilSocketHelpers.validateObjectId(id);
    }

    /**
     * Updates a user's status in the database
     * @param userId The ID of the user to update
     * @param status The new status (online/offline)
     * @param socketId Optional socket ID to associate with the user
     */
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

    /**
     * Broadcasts a user's status to all connected clients
     * @param userId The ID of the user whose status changed
     * @param status The new status (online/offline)
     */
    static broadcastUserStatus(userId: string, status: string) {
        const io = getIO();
        io.emit("userStatus", {
            userId,
            status,
            lastSeen: new Date(),
        });
    }

    /**
     * Gets basic user data for a specific user
     * @param userId The ID of the user to get data for
     */
    static async getUserData(userId: string) {
        return DbOperations.findOneWithSelect(
            User,
            { _id: userId },
            "name status lastSeen"
        );
    }

    /**
     * Joins a user to all their conversation rooms
     * @param userId The ID of the user to join to conversations
     * @param socket The socket instance
     */
    static async joinUserConversations(userId: string, socket: Socket) {
        await UtilSocketHelpers.joinUserConversations(userId, socket);
    }

    /**
     * Handles user connection events
     * @param userId The ID of the user connecting
     * @param socket The socket instance
     * @param updateUserStatus Function to update user status
     * @param joinUserConversations Function to join user to their conversations
     */
    static async handleUserConnection(
        userId: string, 
        socket: Socket,
        updateUserStatus: (userId: string, status: string, socketId?: string | null) => Promise<any>,
        joinUserConversations: (userId: string, socket: Socket) => Promise<void>
    ) {
        await updateUserStatus(userId, "online", socket.id);
        await joinUserConversations(userId, socket);
    }

    /**
     * Handles user disconnection events
     * @param userId The ID of the user disconnecting
     * @param updateUserStatus Function to update user status
     */
    static async handleUserDisconnection(
        userId: string,
        updateUserStatus: (userId: string, status: string, socketId?: string | null) => Promise<any>
    ) {
        await updateUserStatus(userId, "offline", null);
    }
}
