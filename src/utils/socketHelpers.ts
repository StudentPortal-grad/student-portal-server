import { Socket } from "socket.io";
import { Types } from "mongoose";
import Conversation from "@models/Conversation";
import User from "@models/User";
import { ObjectId } from "mongoose";

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

    /**
     * Joins the socket to all active conversation rooms for the user
     */
    static async joinUserConversations(userId: string, socket: Socket) {
        try {
            const conversations = await Conversation.find({
                "participants.userId": userId,
                status: "active",
            }).select("_id");
            for (const conversation of conversations) {
                const conversationId = (conversation._id as ObjectId).toString();
                socket.join(conversationId);
            }
            console.log(
                `User ${userId} joined ${conversations.length} conversation rooms`
            );
        } catch (error) {
            console.error(
                `Error joining user ${userId} to conversation rooms:`,
                error
            );
        }
    }

    /**
     * Updates unread counts for all participants except sender
     */
    static async updateUnreadCounts(conversation: any, senderId: string, messageId: string) {
        const otherParticipants = conversation.participants
            .filter((p: any) => p.userId.toString() !== senderId)
            .map((p: any) => p.userId);
        await User.updateMany(
            {
                _id: { $in: otherParticipants },
                "recentConversations.conversationId": conversation._id,
            },
            {
                $inc: { "recentConversations.$.unreadCount": 1 },
                $set: { "recentConversations.$.lastReadMessageId": messageId },
            }
        );
    }

    /**
     * Updates sender's recentConversations (move to top, unreadCount = 0)
     */
    static async updateSenderRecentConversation(userId: string, conversationId: string, messageId: string) {
        await User.updateOne(
            {
                _id: userId,
                "recentConversations.conversationId": conversationId,
            },
            {
                $set: {
                    "recentConversations.$.lastReadMessageId": messageId,
                    "recentConversations.$.unreadCount": 0,
                },
            }
        );
    }

    /**
     * Adds conversation to recentConversations for any participant missing it
     */
    static async addConversationToRecentIfMissing(participantIds: string[], conversationId: string, messageId: string, senderId: string) {
        await User.updateMany(
            {
                _id: { $in: participantIds },
                "recentConversations.conversationId": { $ne: conversationId },
            },
            {
                $push: {
                    recentConversations: {
                        conversationId,
                        unreadCount: { $cond: [{ $eq: ["$_id", senderId] }, 0, 1] },
                        lastReadMessageId: messageId,
                        isPinned: false,
                        isMuted: false,
                    },
                },
            }
        );
    }
}

