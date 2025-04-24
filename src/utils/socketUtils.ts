import { Socket } from "socket.io";
import { Types, ObjectId } from "mongoose";
import Conversation from "@models/Conversation";
import User from "@models/User";
import { getIO } from "@config/socket";
import { DbOperations } from "@utils/dbOperations";

/**
 * Core socket utility functions for socket operations
 */
export class SocketUtils {
    /**
     * Validates MongoDB ObjectId
     * @param id The string to validate
     * @returns boolean indicating if the string is a valid ObjectId
     */
    static validateObjectId(id: string): boolean {
        return Types.ObjectId.isValid(id);
    }

    /**
     * Emits a success response
     * @param socket The socket to emit to
     * @param eventName The event name
     * @param data Additional data to include
     */
    static emitSuccess(socket: Socket, eventName: string, data: any = {}) {
        socket.emit(eventName, { success: true, ...data });
    }

    /**
     * Emits an error response
     * @param socket The socket to emit to
     * @param eventName The event name
     * @param error The error message
     */
    static emitError(
        socket: Socket,
        eventName: string,
        error: string = "Operation failed"
    ) {
        socket.emit(eventName, { success: false, error });
    }

    /**
     * Validates request parameters and handles error responses
     * @param socket The socket instance
     * @param data The request data
     * @param requiredFields List of required fields
     * @returns boolean indicating if validation passed
     */
    static async validateRequest(
        socket: Socket,
        data: any,
        requiredFields: string[]
    ) {
        const eventName = data.eventName || "event";

        // Validate all required fields exist
        for (const field of requiredFields) {
            if (!data[field]) {
                this.emitError(
                    socket,
                    `${eventName}Failed`,
                    `Missing required field: ${field}`
                );
                return false;
            }

            // Validate ObjectIds
            if (field.includes("Id") && !this.validateObjectId(data[field])) {
                this.emitError(
                    socket,
                    `${eventName}Failed`,
                    `Invalid ${field}`
                );
                return false;
            }
        }
        return true;
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

        // Use direct model update with lean option for better performance
        return User.findByIdAndUpdate(
            userId,
            { $set: update },
            { new: true, lean: true, projection: { status: 1, lastSeen: 1 } }
        );
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
     * Joins the socket to all active conversation rooms for the user
     * @param userId The ID of the user to join to conversations
     * @param socket The socket instance
     */
    static async joinUserConversations(userId: string, socket: Socket) {
        try {
            // Use lean() for better performance when retrieving conversation IDs
            const conversations = await Conversation.find({
                "participants.userId": userId,
                status: "active",
            })
                .select("_id")
                .lean();

            if (conversations.length > 0) {
                // Join all rooms in a single operation instead of iterating
                const roomIds = conversations.map(c => c._id.toString());
                socket.join(roomIds);
                console.log(`User ${userId} joined ${roomIds.length} conversation rooms`);
            }
        } catch (error) {
            console.error(`Error joining user ${userId} to conversation rooms:`, error);
        }
    }

    /**
     * Checks if user is a participant in conversation
     * @param userId The user ID to check
     * @param conversationId The conversation ID to check
     */
    static async isConversationParticipant(
        userId: string,
        conversationId: string
    ) {
        // Use countDocuments with a limit of 1 instead of exists for better performance
        // This avoids creating a full document and just checks existence
        const count = await Conversation.countDocuments({
            _id: conversationId,
            "participants.userId": userId,
            status: "active",
        }, { limit: 1 });

        return count > 0;
    }

    /**
     * Updates user's conversation state
     * @param userId The user ID
     * @param conversationId The conversation ID
     * @param updates The updates to apply
     */
    static async updateUserConversationState(
        userId: string,
        conversationId: string,
        updates: any
    ) {
        // Use findOneAndUpdate with lean option for better performance
        // Only return minimal information to confirm the update
        return User.findOneAndUpdate(
            {
                _id: userId,
                "recentConversations.conversationId": conversationId,
            },
            { $set: updates },
            {
                new: true,              // Return the updated document
                lean: true,            // Return as plain JS object for better performance
                projection: { _id: 1 } // Only return the ID to confirm update
            }
        );
    }

    /**
     * Updates participant's last seen timestamp
     * @param conversationId The conversation ID
     * @param userId The user ID
     */
    static async updateParticipantLastSeen(
        conversationId: string,
        userId: string
    ) {
        return Conversation.updateOne(
            {
                _id: conversationId,
                "participants.userId": userId,
            },
            { $set: { "participants.$.lastSeen": new Date() } }
        );
    }
}
