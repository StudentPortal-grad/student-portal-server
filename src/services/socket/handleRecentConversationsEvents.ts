import { Socket } from "socket.io";
import User from "@models/User";
import { SocketUtils } from "@utils/socketUtils";

/**
 * Handles all socket events related to recent conversations
 */
export const handleRecentConversationsEvents = (socket: Socket) => {
    // Get recent conversations
    socket.on("getRecentConversations", async (_callback) => {
        try {
            // Use projection and lean() for better performance
            const user = await User.findById(socket.data.userId)
                .select("recentConversations")
                .populate({
                    path: "recentConversations.conversationId",
                    select: "participants lastMessage name type metadata",
                    populate: [
                        {
                            path: "participants.userId",
                            select: "name profilePicture status lastSeen",
                        },
                        {
                            path: "lastMessage",
                            select: "content createdAt senderId",
                        },
                    ],
                })
                .populate("recentConversations.lastReadMessageId", "_id createdAt")
                .lean();

            if (!user) {
                socket.emit("recentConversations", {
                    success: false,
                    conversations: [],
                });
                return;
            }

            // Sort in memory for better performance
            const sortedConversations = user.recentConversations
                ? user.recentConversations
                    .filter(conv => conv.conversationId) // Filter out any null references
                    .sort((a, b) => {
                        // First sort by pinned status
                        if (a.isPinned && !b.isPinned) return -1;
                        if (!a.isPinned && b.isPinned) return 1;
                        
                        // Then by last activity
                        const aConversation = a.conversationId as any;
                        const bConversation = b.conversationId as any;
                        const aLastActivity = aConversation?.metadata?.lastActivity || new Date(0);
                        const bLastActivity = bConversation?.metadata?.lastActivity || new Date(0);
                        return new Date(bLastActivity).getTime() - new Date(aLastActivity).getTime();
                    })
                : [];

            socket.emit("recentConversations", {
                success: true,
                conversations: sortedConversations,
            });
        } catch (error) {
            console.error("Error getting recent conversations:", error);
            socket.emit("recentConversations", {
                success: false,
                conversations: [],
            });
        }
    });

    // Update recent conversation settings
    socket.on("updateRecentConversation", async (data, _callback) => {
        try {
            if (!SocketUtils.validateObjectId(data.conversationId)) {
                return SocketUtils.emitError(
                    socket,
                    "recentConversationUpdated",
                    "Invalid conversation ID"
                );
            }

            // Build update object dynamically based on provided fields
            const updateData: any = {};

            if (data.isPinned !== undefined) {
                updateData["recentConversations.$.isPinned"] = data.isPinned;
            }

            if (data.isMuted !== undefined) {
                updateData["recentConversations.$.isMuted"] = data.isMuted;

                if (data.isMuted && data.mutedUntil) {
                    updateData["recentConversations.$.mutedUntil"] = new Date(data.mutedUntil);
                } else if (!data.isMuted) {
                    updateData["recentConversations.$.mutedUntil"] = null;
                }
            }

            // Skip update if no fields to update
            if (Object.keys(updateData).length === 0) {
                return SocketUtils.emitError(
                    socket,
                    "recentConversationUpdated",
                    "No fields to update"
                );
            }

            // Perform update with optimized query
            const result = await User.updateOne(
                {
                    _id: socket.data.userId,
                    "recentConversations.conversationId": data.conversationId,
                },
                { $set: updateData }
            );

            if (result.modifiedCount === 0) {
                return SocketUtils.emitError(
                    socket,
                    "recentConversationUpdated",
                    "Conversation not found in recent list"
                );
            }

            SocketUtils.emitSuccess(socket, "recentConversationUpdated", {
                conversationId: data.conversationId,
                updates: {
                    isPinned: data.isPinned,
                    isMuted: data.isMuted,
                    mutedUntil: data.mutedUntil,
                },
            });
        } catch (error) {
            console.error("Error updating recent conversation:", error);
            SocketUtils.emitError(socket, "recentConversationUpdated");
        }
    });

    // Remove conversation from recent list
    socket.on("removeFromRecentConversations", async (data, _callback) => {
        try {
            if (!SocketUtils.validateObjectId(data.conversationId)) {
                return SocketUtils.emitError(
                    socket,
                    "removedFromRecentConversations",
                    "Invalid conversation ID"
                );
            }

            const result = await User.updateOne(
                { _id: socket.data.userId },
                {
                    $pull: {
                        recentConversations: {
                            conversationId: data.conversationId,
                        },
                    },
                }
            );

            if (result.modifiedCount === 0) {
                return SocketUtils.emitError(
                    socket,
                    "removedFromRecentConversations",
                    "Conversation not found in recent list"
                );
            }

            SocketUtils.emitSuccess(socket, "removedFromRecentConversations", {
                conversationId: data.conversationId,
            });
        } catch (error) {
            console.error("Error removing from recent conversations:", error);
            SocketUtils.emitError(socket, "removedFromRecentConversations");
        }
    });
};
