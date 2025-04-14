import { Socket } from "socket.io";
import { Types } from "mongoose";
import Conversation from "@models/Conversation";
import User from "@models/User";

export class SocketHelpers {
    /**
     * Validates request parameters and handles error responses
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
     * Validates MongoDB ObjectId
     */
    static validateObjectId(id: string): boolean {
        return Types.ObjectId.isValid(id);
    }

    /**
     * Checks if user is a participant in conversation
     */
    static async isConversationParticipant(
        userId: string,
        conversationId: string
    ) {
        return await Conversation.exists({
            _id: conversationId,
            "participants.userId": userId,
            status: "active",
        });
    }

    /**
     * Updates user's conversation state
     */
    static async updateUserConversationState(
        userId: string,
        conversationId: string,
        updates: any
    ) {
        return User.updateOne(
            {
                _id: userId,
                "recentConversations.conversationId": conversationId,
            },
            { $set: updates }
        );
    }

    /**
     * Updates participant's last seen timestamp
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

    /**
     * Emits a success response
     */
    static emitSuccess(socket: Socket, eventName: string, data: any = {}) {
        socket.emit(eventName, { success: true, ...data });
    }

    /**
     * Emits an error response
     */
    static emitError(
        socket: Socket,
        eventName: string,
        error: string = "Operation failed"
    ) {
        socket.emit(eventName, { success: false, error });
    }
}
