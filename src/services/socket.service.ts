import { Socket } from "socket.io";
import { ObjectId, Types } from "mongoose";
import { DbOperations } from "@utils/dbOperations";
import User from "@models/User";
import { IConversation } from "@models/types";
import Conversation from "@models/Conversation";
import Message from "@models/message";
import { getIO } from "@config/socket";
import { SocketHelpers } from "@utils/socketHelpers";

export class SocketService {
    static async handleUserConnection(userId: string, socket: Socket) {
        await this.updateUserStatus(userId, "online", socket.id);
        await this.joinUserConversations(userId, socket);
    }

    static async handleUserDisconnection(userId: string) {
        await this.updateUserStatus(userId, "offline", null);
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
        return SocketHelpers.validateObjectId(id);
    }

    static async handleMessageEvents(socket: Socket) {
        // Regular message sending for existing conversations
        socket.on("sendMessage", async (data, _callback) => {
            try {
                if (
                    !(await SocketHelpers.validateRequest(socket, data, [
                        "conversationId",
                        "content",
                    ]))
                ) {
                    return;
                }

                // Check if user is participant
                if (
                    !(await SocketHelpers.isConversationParticipant(
                        socket.data.userId,
                        data.conversationId
                    ))
                ) {
                    return SocketHelpers.emitError(
                        socket,
                        "messageSent",
                        "Not authorized for this conversation"
                    );
                }

                const conversation = await Conversation.findById(
                    data.conversationId
                );
                if (!conversation) {
                    return SocketHelpers.emitError(
                        socket,
                        "messageSent",
                        "Conversation not found"
                    );
                }

                const message = await Message.create({
                    senderId: socket.data.userId,
                    conversationId: data.conversationId,
                    content: data.content,
                });

                // Get all participants except the sender
                const otherParticipants = conversation.participants
                    .filter((p) => p.userId.toString() !== socket.data.userId)
                    .map((p) => p.userId);

                // Update unreadCount for all other participants
                await User.updateMany(
                    {
                        _id: { $in: otherParticipants },
                        "recentConversations.conversationId":
                            data.conversationId,
                    },
                    {
                        $inc: { "recentConversations.$.unreadCount": 1 },
                        $set: {
                            "recentConversations.$.lastReadMessageId":
                                message._id,
                        },
                    }
                );

                // Update sender's recentConversations (move to top without incrementing unread)
                await User.updateOne(
                    {
                        _id: socket.data.userId,
                        "recentConversations.conversationId":
                            data.conversationId,
                    },
                    {
                        $set: {
                            "recentConversations.$.lastReadMessageId":
                                message._id,
                            "recentConversations.$.unreadCount": 0,
                        },
                    }
                );

                // If conversation is not in recentConversations for any participant, add it
                const allParticipants = conversation.participants.map(
                    (p) => p.userId
                );
                await User.updateMany(
                    {
                        _id: { $in: allParticipants },
                        "recentConversations.conversationId": {
                            $ne: data.conversationId,
                        },
                    },
                    {
                        $push: {
                            recentConversations: {
                                conversationId: data.conversationId,
                                unreadCount:
                                    socket.data.userId === "$_id" ? 0 : 1,
                                lastReadMessageId: message._id,
                                isPinned: false,
                                isMuted: false,
                            },
                        },
                    }
                );

                // Broadcast to other participants
                socket.broadcast.to(data.conversationId).emit("newMessage", {
                    message: await message.populate(
                        "senderId",
                        "name profilePicture"
                    ),
                    conversationId: data.conversationId,
                });

                await conversation.updateOne({
                    lastMessage: message._id,
                    "metadata.lastActivity": new Date(),
                    $inc: { "metadata.totalMessages": 1 },
                });

                SocketHelpers.emitSuccess(socket, "messageSent");
            } catch (error) {
                console.error("Error sending message:", error);
                SocketHelpers.emitError(socket, "messageSent");
            }
        });

        // Add a new event for getting friend conversations
        socket.on("getFriendConversations", async (_callback) => {
            try {
                const user = await User.findById(socket.data.userId)
                    .populate({
                        path: "friends.userId",
                        select: "name profilePicture status socketId",
                    })
                    .populate({
                        path: "friends.conversationId",
                        select: "lastMessage metadata",
                        populate: {
                            path: "lastMessage",
                            select: "content createdAt",
                        },
                    })
                    .select("friends");

                const friendConversations = user!
                    .friends!.filter((f) => f.conversationId)
                    .map((f) => ({
                        friend: f.userId,
                        conversation: f.conversationId,
                        status: f.status,
                    }));

                SocketHelpers.emitSuccess(socket, "friendConversations", {
                    friendConversations,
                });
            } catch (_error) {
                SocketHelpers.emitSuccess(socket, "friendConversations", {
                    friendConversations: [],
                });
            }
        });

        // New message events
        socket.on("deleteMessage", async (data, _callback) => {
            try {
                if (
                    !(await SocketHelpers.validateRequest(socket, data, [
                        "messageId",
                        "conversationId",
                    ]))
                ) {
                    return;
                }

                const message = await Message.findById(data.messageId);
                if (
                    !message ||
                    message.senderId.toString() !== socket.data.userId
                ) {
                    return SocketHelpers.emitError(
                        socket,
                        "messageDeleted",
                        "Not authorized to delete this message"
                    );
                }

                await message.deleteOne();
                const io = getIO();
                io.to(data.conversationId).emit("messageDeleted", {
                    messageId: data.messageId,
                    conversationId: data.conversationId,
                });
                SocketHelpers.emitSuccess(socket, "messageDeleted");
            } catch (_error) {
                SocketHelpers.emitError(socket, "messageDeleted");
            }
        });

        socket.on("editMessage", async (data, _callback) => {
            try {
                if (
                    !(await SocketHelpers.validateRequest(socket, data, [
                        "messageId",
                        "conversationId",
                        "content",
                    ]))
                ) {
                    return;
                }

                const message = await Message.findById(data.messageId);
                if (
                    !message ||
                    message.senderId.toString() !== socket.data.userId
                ) {
                    return SocketHelpers.emitError(
                        socket,
                        "messageEdited",
                        "Not authorized to edit this message"
                    );
                }

                message.content = data.content;
                await message.save();
                const io = getIO();
                io.to(data.conversationId).emit("messageEdited", {
                    messageId: data.messageId,
                    conversationId: data.conversationId,
                    content: data.content,
                });
                SocketHelpers.emitSuccess(socket, "messageEdited");
            } catch (_error) {
                SocketHelpers.emitError(socket, "messageEdited");
            }
        });

        // Typing indicators
        socket.on("typing", (data) => {
            socket.to(data.conversationId).emit("userTyping", {
                userId: socket.data.userId,
                conversationId: data.conversationId,
            });
        });

        socket.on("stopTyping", (data) => {
            socket.to(data.conversationId).emit("userStoppedTyping", {
                userId: socket.data.userId,
                conversationId: data.conversationId,
            });
        });

        // Message read receipts
        socket.on("markMessageRead", async (data, _callback) => {
            try {
                // Update conversation participant's last seen
                await Conversation.updateOne(
                    {
                        _id: data.conversationId,
                        "participants.userId": socket.data.userId,
                    },
                    { $set: { "participants.$.lastSeen": new Date() } }
                );

                // Reset unread count in recentConversations
                await User.updateOne(
                    {
                        _id: socket.data.userId,
                        "recentConversations.conversationId":
                            data.conversationId,
                    },
                    {
                        $set: {
                            "recentConversations.$.unreadCount": 0,
                            "recentConversations.$.lastReadMessageId":
                                data.messageId || undefined,
                        },
                    }
                );

                socket.to(data.conversationId).emit("messageRead", {
                    userId: socket.data.userId,
                    conversationId: data.conversationId,
                    lastSeen: new Date(),
                });

                socket.emit("messageMarkedRead", { success: true });
                // _callback(true);
            } catch (error) {
                console.error("Error marking message as read:", error);
                socket.emit("messageMarkedRead", { success: false });
                // _callback(false);
            }
        });
    }

    static async handleConversationEvents(socket: Socket) {
        socket.on("createConversation", async (data, _callback) => {
            try {
                const conversation: IConversation = await Conversation.create({
                    type: data?.type || "GroupDM",
                    participants: [
                        { userId: socket.data.userId, role: "owner" },
                        ...data.participants.map((id: string) => ({
                            userId: id,
                            role: "member",
                        })),
                    ],
                    name: data.name,
                    description: data.description,
                    createdBy: socket.data.userId,
                });

                const populatedConversation = await conversation.populate([
                    {
                        path: "participants.userId",
                        select: "name profilePicture",
                    },
                    { path: "createdBy", select: "name profilePicture" },
                ]);

                // Join all participants to the conversation room
                const io = getIO();
                const conversationId = (
                    conversation._id as ObjectId
                ).toString();

                // Join the creator to the room first
                socket.join(conversationId);

                // Add conversation to recentConversations for all participants
                const participantIds = [
                    socket.data.userId,
                    ...data.participants,
                ];

                await User.updateMany(
                    { _id: { $in: participantIds } },
                    {
                        $push: {
                            recentConversations: {
                                conversationId: conversation._id,
                                unreadCount: 0,
                                isPinned: false,
                                isMuted: false,
                            },
                        },
                    }
                );

                // Then join other participants
                data.participants.forEach((userId: string) => {
                    const userSocket = Array.from(
                        io.sockets.sockets.values()
                    ).find((s) => s.data.userId === userId);
                    if (userSocket) {
                        userSocket.join(conversationId);
                    }
                });

                socket.broadcast
                    .to(conversationId)
                    .emit("conversationCreated", {
                        conversation: populatedConversation,
                    });

                SocketHelpers.emitSuccess(socket, "conversationCreated", {
                    conversation: populatedConversation,
                });
            } catch (_error) {
                SocketHelpers.emitError(socket, "conversationCreated");
            }
        });

        socket.on("getConversations", async (_callback) => {
            try {
                const conversations = await Conversation.find({
                    "participants.userId": socket.data.userId,
                    status: "active",
                })
                    .populate(
                        "participants.userId",
                        "name profilePicture status"
                    )
                    .populate("lastMessage")
                    .sort({ "metadata.lastActivity": -1 });

                SocketHelpers.emitSuccess(socket, "conversations", {
                    conversations,
                });
            } catch (_error) {
                SocketHelpers.emitSuccess(socket, "conversations", {
                    conversations: [],
                });
            }
        });
        // Add new event for getting conversation messages with pagination and sorting
        socket.on("getConversationMessages", async (data, _callback) => {
            try {
                if (!this.validateObjectId(data.conversationId)) {
                    socket.emit("conversationMessages", {
                        success: false,
                        error: "Invalid conversation ID",
                    });
                    return;
                }

                // Check if user is a participant in the conversation
                const isParticipant = await Conversation.exists({
                    _id: data.conversationId,
                    "participants.userId": socket.data.userId,
                    status: "active",
                });

                if (!isParticipant) {
                    socket.emit("conversationMessages", {
                        success: false,
                        error: "Not authorized to view this conversation",
                    });
                    return;
                }

                // Set default pagination values if not provided
                const page = data.page || 1;
                const limit = data.limit || 20;
                const skip = (page - 1) * limit;

                // Set default sort (newest messages first)
                const sortBy = data.sortBy || { createdAt: -1 };

                // Optional date filters
                const dateFilter: any = {};
                if (data.before) {
                    dateFilter["createdAt"] = {
                        ...dateFilter["createdAt"],
                        $lt: new Date(data.before),
                    };
                }
                if (data.after) {
                    dateFilter["createdAt"] = {
                        ...dateFilter["createdAt"],
                        $gt: new Date(data.after),
                    };
                }

                // Build query
                const query = {
                    conversationId: data.conversationId,
                    ...dateFilter,
                };

                // Get total count for pagination info
                const totalMessages = await Message.countDocuments(query);

                // Get messages with pagination and sorting
                const messages = await Message.find(query)
                    .sort(sortBy)
                    .skip(skip)
                    .limit(limit)
                    .populate("senderId", "name profilePicture")
                    .populate("reactions.users", "name profilePicture")
                    .populate("readBy.userId", "name profilePicture");

                // Mark messages as read by this user if not already read
                await Message.updateMany(
                    {
                        _id: { $in: messages.map((m) => m._id) },
                        "readBy.userId": { $ne: socket.data.userId },
                    },
                    {
                        $push: {
                            readBy: {
                                userId: socket.data.userId,
                                readAt: new Date(),
                            },
                        },
                    }
                );

                // Update user's last seen in the conversation
                await Conversation.updateOne(
                    {
                        _id: data.conversationId,
                        "participants.userId": socket.data.userId,
                    },
                    {
                        $set: { "participants.$.lastSeen": new Date() },
                    }
                );

                // Emit read receipts to other participants
                socket.to(data.conversationId).emit("messageRead", {
                    userId: socket.data.userId,
                    conversationId: data.conversationId,
                    lastSeen: new Date(),
                });

                // Calculate pagination metadata
                const totalPages = Math.ceil(totalMessages / limit);
                const hasNextPage = page < totalPages;
                const hasPrevPage = page > 1;

                // Send paginated results
                socket.emit("conversationMessages", {
                    success: true,
                    messages,
                    pagination: {
                        total: totalMessages,
                        page,
                        limit,
                        totalPages,
                        hasNextPage,
                        hasPrevPage,
                        nextPage: hasNextPage ? page + 1 : null,
                        prevPage: hasPrevPage ? page - 1 : null,
                    },
                });
            } catch (error) {
                console.error("Error fetching conversation messages:", error);
                socket.emit("conversationMessages", {
                    success: false,
                    error: "Failed to fetch messages",
                });
            }
        });

        // Add event for getting messages around a specific message (for context)
        socket.on("getMessageContext", async (data, _callback) => {
            try {
                if (
                    !this.validateObjectId(data.messageId) ||
                    !this.validateObjectId(data.conversationId)
                ) {
                    socket.emit("messageContext", {
                        success: false,
                        error: "Invalid message or conversation ID",
                    });
                    return;
                }

                // Check if user is a participant in the conversation
                const isParticipant = await Conversation.exists({
                    _id: data.conversationId,
                    "participants.userId": socket.data.userId,
                    status: "active",
                });

                if (!isParticipant) {
                    socket.emit("messageContext", {
                        success: false,
                        error: "Not authorized to view this conversation",
                    });
                    return;
                }

                // Find the target message to get its timestamp
                const targetMessage = await Message.findOne({
                    _id: data.messageId,
                    conversationId: data.conversationId,
                }).populate("senderId", "name profilePicture");

                if (!targetMessage) {
                    socket.emit("messageContext", {
                        success: false,
                        error: "Message not found",
                    });
                    return;
                }

                const contextSize = data.contextSize || 10;

                // Get messages before the target message
                const messagesBefore = await Message.find({
                    conversationId: data.conversationId,
                    createdAt: { $lt: targetMessage.createdAt },
                })
                    .sort({ createdAt: -1 })
                    .limit(Math.floor(contextSize / 2))
                    .populate("senderId", "name profilePicture")
                    .populate("reactions.users", "name profilePicture");

                // Get messages after the target message
                const messagesAfter = await Message.find({
                    conversationId: data.conversationId,
                    createdAt: { $gt: targetMessage.createdAt },
                })
                    .sort({ createdAt: 1 })
                    .limit(Math.floor(contextSize / 2))
                    .populate("senderId", "name profilePicture")
                    .populate("reactions.users", "name profilePicture");

                // Combine messages in chronological order
                const contextMessages = [
                    ...messagesBefore.reverse(),
                    targetMessage,
                    ...messagesAfter,
                ];

                socket.emit("messageContext", {
                    success: true,
                    targetMessageId: data.messageId,
                    messages: contextMessages,
                });
            } catch (error) {
                console.error("Error fetching message context:", error);
                socket.emit("messageContext", {
                    success: false,
                    error: "Failed to fetch message context",
                });
            }
        });

        // Add event handler for adding new group members
        socket.on("addGroupMembers", async (data, _callback) => {
            try {
                if (
                    !(await SocketHelpers.validateRequest(socket, data, [
                        "conversationId",
                        "userIds",
                    ]))
                ) {
                    return;
                }

                // Check if conversation exists and is a group
                const conversation = await Conversation.findById(
                    data.conversationId
                );
                if (!conversation || conversation.type !== "GroupDM") {
                    return SocketHelpers.emitError(
                        socket,
                        "groupMembersAdded",
                        "Invalid conversation or not a group"
                    );
                }

                const conversationId = (
                    conversation._id as ObjectId
                ).toString();

                // Check if user is admin/owner
                const userRole = conversation.participants.find(
                    (p) => p.userId.toString() === socket.data.userId
                )?.role;

                if (!userRole || !["owner", "admin"].includes(userRole)) {
                    return SocketHelpers.emitError(
                        socket,
                        "groupMembersAdded",
                        "Not authorized to add members"
                    );
                }

                // Filter out existing participants
                const existingParticipantIds = conversation.participants.map(
                    (p) => p.userId.toString()
                );
                const newUserIds = data.userIds.filter(
                    (id: string) => !existingParticipantIds.includes(id)
                );

                if (newUserIds.length === 0) {
                    return SocketHelpers.emitError(
                        socket,
                        "groupMembersAdded",
                        "All users are already members"
                    );
                }

                // Add new participants
                const newParticipants = newUserIds.map((userId: string) => ({
                    userId,
                    role: "member",
                    joinedAt: new Date(),
                    lastSeen: new Date(),
                    isAdmin: false,
                }));

                await conversation.updateOne({
                    $push: { participants: { $each: newParticipants } },
                });

                // Add conversation to new members' recentConversations
                await User.updateMany(
                    { _id: { $in: newUserIds } },
                    {
                        $push: {
                            recentConversations: {
                                conversationId: conversation._id,
                                unreadCount: 0,
                                isPinned: false,
                                isMuted: false,
                            },
                        },
                    }
                );

                // Get populated conversation data
                const updatedConversation = await conversation.populate([
                    {
                        path: "participants.userId",
                        select: "name profilePicture",
                    },
                    { path: "createdBy", select: "name profilePicture" },
                ]);

                // Join new members to the socket room
                const io = getIO();
                newUserIds.forEach((userId: string) => {
                    const userSocket = Array.from(
                        io.sockets.sockets.values()
                    ).find((s) => s.data.userId === userId);
                    if (userSocket) {
                        userSocket.join(conversationId);
                    }
                });

                // Notify all participants about new members
                io.to(conversationId).emit("groupMembersAdded", {
                    conversationId,
                    newMembers: newUserIds,
                    conversation: updatedConversation,
                });

                SocketHelpers.emitSuccess(socket, "groupMembersAdded", {
                    conversation: updatedConversation,
                });
            } catch (error) {
                console.error("Error adding group members:", error);
                SocketHelpers.emitError(socket, "groupMembersAdded");
            }
        });
    }

    static async handleRecentConversationsEvents(socket: Socket) {
        // Get recent conversations
        socket.on("getRecentConversations", async (_callback) => {
            try {
                const user = await User.findById(socket.data.userId)
                    .populate({
                        path: "recentConversations.conversationId",
                        populate: [
                            {
                                path: "participants.userId",
                                select: "name profilePicture status lastSeen",
                            },
                            {
                                path: "lastMessage",
                            },
                        ],
                    })
                    .populate("recentConversations.lastReadMessageId");

                if (!user) {
                    socket.emit("recentConversations", {
                        success: false,
                        conversations: [],
                    });
                    return;
                }

                socket.emit("recentConversations", {
                    success: true,
                    conversations: user.recentConversations,
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
                if (!this.validateObjectId(data.conversationId)) {
                    socket.emit("recentConversationUpdated", {
                        success: false,
                    });
                    return;
                }

                const updateData: any = {};

                if (data.isPinned !== undefined) {
                    updateData["recentConversations.$.isPinned"] =
                        data.isPinned;
                }

                if (data.isMuted !== undefined) {
                    updateData["recentConversations.$.isMuted"] = data.isMuted;

                    if (data.isMuted && data.mutedUntil) {
                        updateData["recentConversations.$.mutedUntil"] =
                            new Date(data.mutedUntil);
                    } else if (!data.isMuted) {
                        updateData["recentConversations.$.mutedUntil"] = null;
                    }
                }

                await User.updateOne(
                    {
                        _id: socket.data.userId,
                        "recentConversations.conversationId":
                            data.conversationId,
                    },
                    { $set: updateData }
                );

                socket.emit("recentConversationUpdated", {
                    success: true,
                    conversationId: data.conversationId,
                    updates: {
                        isPinned: data.isPinned,
                        isMuted: data.isMuted,
                        mutedUntil: data.mutedUntil,
                    },
                });
            } catch (error) {
                console.error("Error updating recent conversation:", error);
                socket.emit("recentConversationUpdated", { success: false });
            }
        });

        // Remove conversation from recent list
        socket.on("removeFromRecentConversations", async (data, _callback) => {
            try {
                if (!this.validateObjectId(data.conversationId)) {
                    socket.emit("removedFromRecentConversations", {
                        success: false,
                    });
                    return;
                }

                await User.updateOne(
                    { _id: socket.data.userId },
                    {
                        $pull: {
                            recentConversations: {
                                conversationId: data.conversationId,
                            },
                        },
                    }
                );

                socket.emit("removedFromRecentConversations", {
                    success: true,
                    conversationId: data.conversationId,
                });
            } catch (error) {
                console.error(
                    "Error removing from recent conversations:",
                    error
                );
                socket.emit("removedFromRecentConversations", {
                    success: false,
                });
            }
        });
    }

    static async handleSearchEvents(socket: Socket) {
        // Basic peer search
        socket.on("searchPeers", async (data, _callback) => {
            try {
                const currentUser = await User.findById(socket.data.userId);
                if (!currentUser) {
                    socket.emit("peerSearchResults", { peers: [] });
                    // _callback({ peers: [] });
                    return;
                }

                const query = {
                    _id: { $ne: socket.data.userId },
                    role: "student",
                    $or: [
                        { signupStep: "completed" },
                        { signupStep: "verified" },
                    ],
                    isGraduated: false,
                    level: currentUser.level,
                    ...(data.query && {
                        $or: [
                            { name: { $regex: data.query, $options: "i" } },
                            { username: { $regex: data.query, $options: "i" } },
                            {
                                universityEmail: {
                                    $regex: data.query,
                                    $options: "i",
                                },
                            },
                        ],
                    }),
                };

                const peers = await User.find(query)
                    .select(
                        "name username profilePicture level status lastSeen college gpa profile.bio profile.interests"
                    )
                    .limit(20);

                socket.emit("peerSearchResults", { peers });
                // _callback({ peers });
            } catch (_error) {
                socket.emit("peerSearchResults", { peers: [] });
                // _callback({ peers: [] });
                console.log("Error searching peers", _error);
            }
        });

        // Advanced peer search with filters
        socket.on("searchPeersByFilter", async (data, _callback) => {
            try {
                const baseQuery = {
                    _id: { $ne: socket.data.userId },
                    role: "student",
                    signupStep: "completed",
                    isGraduated: false,
                };

                const filterQuery = {
                    ...baseQuery,
                    ...(data.university && { university: data.university }),
                    ...(data.level && { level: data.level }),
                    ...(data.gender && { gender: data.gender }),
                    ...(data.gpaRange && {
                        gpa: {
                            $gte: data.gpaRange.min,
                            $lte: data.gpaRange.max,
                        },
                    }),
                    ...(data.interests && {
                        "profile.interests": { $in: data.interests },
                    }),
                    ...(data.graduationYear && {
                        graduationYear: data.graduationYear,
                    }),
                    ...(data.query && {
                        $or: [
                            { name: { $regex: data.query, $options: "i" } },
                            { username: { $regex: data.query, $options: "i" } },
                            {
                                universityEmail: {
                                    $regex: data.query,
                                    $options: "i",
                                },
                            },
                        ],
                    }),
                };

                const peers = await User.find(filterQuery)
                    .select(
                        `
                        name username profilePicture gender
                        level status lastSeen college university
                        gpa graduationYear profile.bio profile.interests
                    `
                    )
                    .sort({ level: 1, gpa: -1, name: 1 })
                    .limit(20);

                socket.emit("peerSearchResults", { peers });
                // _callback({ peers });
            } catch (_error) {
                socket.emit("peerSearchResults", { peers: [] });
                // _callback({ peers: [] });
                console.log("Error searching peers by filter", _error);
            }
        });

        // Recommended peers based on profile similarity
        socket.on("searchRecommendedPeers", async (_data, _callback) => {
            try {
                const currentUser = await User.findById(socket.data.userId);
                if (!currentUser) {
                    socket.emit("peerSearchResults", { peers: [] });
                    // _callback({ recommendations: [] });
                    return;
                }

                const recommendations = await User.aggregate([
                    {
                        $match: {
                            _id: {
                                $ne: new Types.ObjectId(socket.data.userId),
                            },
                            role: "student",
                            signupStep: "completed",
                            isGraduated: false,
                            university: currentUser.university,
                            college: currentUser.college,
                            level: {
                                $in: [
                                    currentUser.level,
                                    currentUser.level + 1,
                                    currentUser.level - 1,
                                ],
                            },
                        },
                    },
                    {
                        $addFields: {
                            commonInterests: {
                                $size: {
                                    $setIntersection: [
                                        "$profile.interests",
                                        currentUser.profile?.interests || [],
                                    ],
                                },
                            },
                            levelDiff: {
                                $abs: {
                                    $subtract: ["$level", currentUser.level],
                                },
                            },
                        },
                    },
                    {
                        $sort: {
                            commonInterests: -1,
                            levelDiff: 1,
                            gpa: -1,
                        },
                    },
                    {
                        $project: {
                            name: 1,
                            username: 1,
                            profilePicture: 1,
                            gender: 1,
                            level: 1,
                            status: 1,
                            lastSeen: 1,
                            college: 1,
                            gpa: 1,
                            profile: 1,
                            commonInterests: 1,
                        },
                    },
                    { $limit: 20 },
                ]);

                socket.emit("peerSearchResults", {
                    peers: recommendations,
                });
                // _callback({ recommendations });
            } catch (_error) {
                socket.emit("peerSearchResults", { peers: [] });
                // _callback({ recommendations: [] });
                console.log("Error searching recommended peers", _error);
            }
        });
    }

    static async handleFriendEvents(socket: Socket) {
        // Send friend request
        socket.on("sendFriendRequest", async (data, _callback) => {
            try {
                const recipient = await User.findById(data.recipientId);
                if (!recipient) {
                    socket.emit("friendRequestSent", { success: false });
                    return;
                }

                // Check if request already exists
                const existingRequest = await User.findOne({
                    _id: data.recipientId,
                    "friendRequests.userId": socket.data.userId,
                });

                if (existingRequest) {
                    socket.emit("friendRequestSent", {
                        success: false,
                        message: "Friend request already sent",
                    });
                    return;
                }

                // Check if they're already friends
                const alreadyFriends = await User.findOne({
                    _id: socket.data.userId,
                    "friends.userId": data.recipientId,
                });

                if (alreadyFriends) {
                    socket.emit("friendRequestSent", {
                        success: false,
                        message: "Already friends",
                    });
                    return;
                }

                // Add to recipient's friend requests
                await User.findByIdAndUpdate(data.recipientId, {
                    $push: {
                        friendRequests: {
                            userId: socket.data.userId,
                            createdAt: new Date(),
                        },
                    },
                });

                // Notify recipient if online
                if (recipient.socketId) {
                    socket
                        .to(recipient.socketId)
                        .emit("friendRequestReceived", {
                            userId: socket.data.userId,
                        });
                }

                socket.emit("friendRequestSent", { success: true });
            } catch (error) {
                console.log("sendFriendRequest error:", error);
                socket.emit("friendRequestSent", { success: false });
            }
        });

        // Accept friend request
        socket.on("acceptFriendRequest", async (data, _callback) => {
            try {
                // Verify the request exists
                const requestExists = await User.findOne({
                    _id: socket.data.userId,
                    "friendRequests.userId": data.senderId,
                });

                if (!requestExists) {
                    socket.emit("friendRequestAccepted", {
                        success: false,
                        message: "Friend request not found",
                    });
                    return;
                }

                const sender = await User.findById(data.senderId);
                if (!sender) {
                    socket.emit("friendRequestAccepted", { success: false });
                    return;
                }

                // Create DM conversation for the new friends
                const conversation = await Conversation.create({
                    type: "DM",
                    participants: [
                        { userId: socket.data.userId, role: "member" },
                        { userId: data.senderId, role: "member" },
                    ],
                    createdBy: socket.data.userId,
                });

                // Add to current user's friends list
                await User.findByIdAndUpdate(socket.data.userId, {
                    $push: {
                        friends: {
                            userId: data.senderId,
                            status: "accepted",
                            conversationId: conversation._id,
                            createdAt: new Date(),
                        },
                    },
                    // Remove from friend requests
                    $pull: {
                        friendRequests: {
                            userId: data.senderId,
                        },
                    },
                });

                // Add to sender's friends list
                await User.findByIdAndUpdate(data.senderId, {
                    $push: {
                        friends: {
                            userId: socket.data.userId,
                            status: "accepted",
                            conversationId: conversation._id,
                            createdAt: new Date(),
                        },
                    },
                });

                // Notify the original sender if online
                if (sender.socketId) {
                    socket.to(sender.socketId).emit("friendRequestAccepted", {
                        userId: socket.data.userId,
                        conversationId: conversation._id,
                    });
                }

                socket.emit("friendRequestAccepted", {
                    success: true,
                    conversationId: conversation._id,
                });
            } catch (error) {
                console.log("acceptFriendRequest error:", error);
                socket.emit("friendRequestAccepted", { success: false });
            }
        });

        // Get friend requests
        socket.on("getFriendRequests", async (data, _callback) => {
            try {
                // Find the current user with populated friend requests
                const user = await User.findById(socket.data.userId).populate({
                    path: "friendRequests.userId",
                    select: "name username profilePicture status lastSeen level college",
                });

                if (!user) {
                    socket.emit("friendRequests", {
                        success: false,
                        requests: [],
                    });
                    return;
                }

                // Set pagination if provided
                const page = data?.page || 1;
                const limit = data?.limit || 10;
                const startIndex = (page - 1) * limit;
                const endIndex = page * limit;

                // Get paginated requests
                const paginatedRequests = user.friendRequests?.slice(
                    startIndex,
                    endIndex
                );

                // Calculate pagination metadata
                const totalRequests = user.friendRequests?.length || 0;
                const totalPages = Math.ceil(totalRequests / limit);
                const hasNextPage = page < totalPages;
                const hasPrevPage = page > 1;

                socket.emit("friendRequests", {
                    success: true,
                    requests: paginatedRequests,
                    pagination: {
                        total: totalRequests,
                        page,
                        limit,
                        totalPages,
                        hasNextPage,
                        hasPrevPage,
                        nextPage: hasNextPage ? page + 1 : null,
                        prevPage: hasPrevPage ? page - 1 : null,
                    },
                });
            } catch (error) {
                console.error("Error getting friend requests:", error);
                socket.emit("friendRequests", {
                    success: false,
                    requests: [],
                });
            }
        });

        // Reject friend request
        socket.on("rejectFriendRequest", async (data, _callback) => {
            try {
                // Remove the friend request
                await User.findByIdAndUpdate(socket.data.userId, {
                    $pull: {
                        friendRequests: {
                            userId: data.senderId,
                        },
                    },
                });

                socket.emit("friendRequestRejected", { success: true });
            } catch (error) {
                console.error("rejectFriendRequest error:", error);
                socket.emit("friendRequestRejected", { success: false });
            }
        });

        // Block user
        socket.on("blockUser", async (data, _callback) => {
            try {
                await User.updateMany(
                    {
                        _id: { $in: [socket.data.userId, data.userId] },
                        "friends.userId": {
                            $in: [socket.data.userId, data.userId],
                        },
                    },
                    {
                        $set: {
                            "friends.$.status": "blocked",
                            "friends.$.blockedBy": socket.data.userId,
                        },
                    }
                );

                socket.emit("userBlocked", { success: true });
                // _callback(true);
            } catch (_error) {
                socket.emit("userBlocked", { success: false });
                // _callback(false);
            }
        });

        // Unblock user
        socket.on("unblockUser", async (data, _callback) => {
            try {
                await User.updateMany(
                    {
                        _id: { $in: [socket.data.userId, data.userId] },
                        "friends.userId": {
                            $in: [socket.data.userId, data.userId],
                        },
                    },
                    {
                        $set: { "friends.$.status": "accepted" },
                        $unset: { "friends.$.blockedBy": "" },
                    }
                );

                socket.emit("userUnblocked", { success: true });
                // _callback(true);
            } catch (_error) {
                socket.emit("userUnblocked", { success: false });
                // _callback(false);
            }
        });
    }

    static async handleSocket(socket: Socket) {
        await this.handleMessageEvents(socket);
        await this.handleConversationEvents(socket);
        await this.handleRecentConversationsEvents(socket);
        await this.handleSearchEvents(socket);
        await this.handleFriendEvents(socket);
    }

    static async joinUserConversations(userId: string, socket: Socket) {
        try {
            // Find all active conversations where the user is a participant
            const conversations = await Conversation.find({
                "participants.userId": userId,
                status: "active",
            }).select("_id");

            // Join the socket to each conversation room
            for (const conversation of conversations) {
                const conversationId = (
                    conversation._id as ObjectId
                ).toString();
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
}
