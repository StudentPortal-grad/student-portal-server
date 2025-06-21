import User from "@models/User";
import { Types } from "mongoose";

/**
 * Utility functions for conversation operations
 */
export class ConversationUtils {
    /**
     * Updates unread counts for all participants except sender
     * @param conversation The conversation object
     * @param senderId The sender's user ID
     * @param messageId The message ID
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
     * @param userId The user ID
     * @param conversationId The conversation ID
     * @param messageId The message ID
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
     * @param participantIds Array of participant user IDs
     * @param conversationId The conversation ID
     * @param messageId The message ID
     * @param senderId The sender's user ID
     */
    static async addConversationToRecentIfMissing(
        participantIds: string[],
        conversationId: string,
        messageId: string,
        senderId: string
    ) {
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

    /**
     * Process all updates related to a new message
     * @param conversation The conversation object
     * @param senderId The sender's user ID
     * @param conversationId The conversation ID
     * @param messageId The message ID
     */
    static async processNewMessage(
        conversation: any,
        senderId: string,
        conversationId: string,
        _messageId: Types.ObjectId
    ) {
        // Extract participant IDs from the conversation
        const participantIds = conversation.participants.map((p: any) =>
            p.userId.toString()
        );

        // Get other participants (everyone except the sender)
        const otherParticipants = participantIds.filter((id: string) => id !== senderId);

        // Prepare bulk operations for better performance
        const bulkOperations = [
            // 1. Update unread counts for other participants
            {
                updateMany: {
                    filter: {
                        _id: { $in: otherParticipants },
                        "recentConversations.conversationId": conversation._id
                    },
                    update: {
                        $inc: { "recentConversations.$.unreadCount": 1 }
                    }
                }
            },

            // 2. Update sender's recent conversation
            {
                updateOne: {
                    filter: {
                        _id: senderId,
                        "recentConversations.conversationId": conversationId
                    },
                    update: {
                        $set: {
                            "recentConversations.$.unreadCount": 0
                        }
                    }
                }
            },

            // 3. Add conversation to recent list for participants missing it - split into two operations
            // 3a. For the sender
            {
                updateOne: {
                    filter: {
                        _id: senderId,
                        "recentConversations.conversationId": { $ne: conversationId }
                    },
                    update: {
                        $push: {
                            recentConversations: {
                                conversationId,
                                unreadCount: 0,
                                isPinned: false,
                                isMuted: false
                            }
                        }
                    }
                }
            },
            // 3b. For other participants
            {
                updateMany: {
                    filter: {
                        _id: { $in: otherParticipants },
                        "recentConversations.conversationId": { $ne: conversationId }
                    },
                    update: {
                        $push: {
                            recentConversations: {
                                conversationId,
                                unreadCount: 1,
                                isPinned: false,
                                isMuted: false
                            }
                        }
                    }
                }
            }
        ];

        // Execute all operations in a single database call
        await User.bulkWrite(bulkOperations);
    }
}
