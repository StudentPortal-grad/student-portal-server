import { Socket } from "socket.io";
import { ObjectId, Types } from "mongoose";
import { DbOperations } from "@utils/dbOperations";
import User from "@models/User";
import { IConversation } from "@models/types";
import Conversation from "@models/Conversation";
import Message from "@models/message";
import { getIO } from "@config/socket";

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
        return Types.ObjectId.isValid(id);
    }

    static async handleMessageEvents(socket: Socket) {
        // Regular message sending for existing conversations
        socket.on("sendMessage", async (data, _callback) => {
            try {
                if (!this.validateObjectId(data.conversationId)) {
                    socket.emit("messageSent", { success: false });
                    // _callback(false);
                    return;
                }

                const conversation = await Conversation.findById(
                    data.conversationId
                );
                if (!conversation) {
                    socket.emit("messageSent", { success: false });
                    // _callback(false);
                    return;
                }

                const message = await Message.create({
                    senderId: socket.data.userId,
                    conversationId: data.conversationId,
                    content: data.content,
                });

                // const io = getIO();
                socket.broadcast.to(data.conversationId).emit("newMessage", {
                    message: await message.populate(
                        "senderId",
                        "name profilePicture"
                    ),
                    conversationId: data.conversationId,
                });

                /*await Conversation.findByIdAndUpdate(data.conversationId, {
                    lastMessage: message._id,
                    "metadata.lastActivity": new Date(),
                    $inc: { "metadata.totalMessages": 1 },
                });*/

                await conversation.updateOne({
                    lastMessage: message._id,
                    "metadata.lastActivity": new Date(),
                    $inc: { "metadata.totalMessages": 1 },
                });

                socket.emit("messageSent", { success: true });
                // _callback(true);
            } catch (_error) {
                socket.emit("messageSent", { success: false });
                // _callback(false);
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

                socket.emit("friendConversations", { friendConversations });
                // _callback(friendConversations);
            } catch (_error) {
                socket.emit("friendConversations", { friendConversations: [] });
                // _callback([]);
            }
        });

        // New message events
        socket.on("deleteMessage", async (data, _callback) => {
            try {
                const message = await Message.findById(data.messageId);
                if (
                    !message ||
                    message.senderId.toString() !== socket.data.userId
                ) {
                    socket.emit("messageDeleted", { success: false });
                    // _callback(false);
                    return;
                }

                await message.deleteOne();
                const io = getIO();
                io.to(data.conversationId).emit("messageDeleted", {
                    messageId: data.messageId,
                    conversationId: data.conversationId,
                });
                socket.emit("messageDeleted", { success: true });
                // _callback(true);
            } catch (_error) {
                socket.emit("messageDeleted", { success: false });
                // _callback(false);
            }
        });

        socket.on("editMessage", async (data, _callback) => {
            try {
                const message = await Message.findById(data.messageId);
                if (
                    !message ||
                    message.senderId.toString() !== socket.data.userId
                ) {
                    socket.emit("messageEdited", { success: false });
                    // _callback(false);
                    return;
                }

                message.content = data.content;
                await message.save();
                const io = getIO();
                io.to(data.conversationId).emit("messageEdited", {
                    messageId: data.messageId,
                    conversationId: data.conversationId,
                    content: data.content,
                });
                socket.emit("messageEdited", { success: true });
                // _callback(true);
            } catch (_error) {
                socket.emit("messageEdited", { success: false });
                // _callback(false);
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
                await Conversation.updateOne(
                    {
                        _id: data.conversationId,
                        "participants.userId": socket.data.userId,
                    },
                    { $set: { "participants.$.lastSeen": new Date() } }
                );

                socket.to(data.conversationId).emit("messageRead", {
                    userId: socket.data.userId,
                    conversationId: data.conversationId,
                    lastSeen: new Date(),
                });

                socket.emit("messageMarkedRead", { success: true });
                // _callback(true);
            } catch (_error) {
                socket.emit("messageMarkedRead", { success: false });
                // _callback(false);
            }
        });
    }

    static async handleConversationEvents(socket: Socket) {
        socket.on("createDMConversation", async (data, _callback) => {
            try {
                if (!this.validateObjectId(data.recipientId)) {
                    socket.emit("dmCreated", { success: false });
                    // _callback(false);
                    return;
                }

                const recipient = await User.findById(data.recipientId);
                if (!recipient) {
                    socket.emit("dmCreated", { success: false });
                    // _callback(false);
                    return;
                }

                const conversation: IConversation = await Conversation.create({
                    type: "DM",
                    participants: [
                        { userId: socket.data.userId, role: "member" },
                        { userId: data.recipientId, role: "member" },
                    ],
                    createdBy: socket.data.userId,
                });

                const populatedConversation = await conversation.populate([
                    {
                        path: "participants.userId",
                        select: "name profilePicture status socketId",
                    },
                    { path: "createdBy", select: "name profilePicture" },
                ]);

                const conversationId = (
                    conversation._id as ObjectId
                ).toString();

                // Join creator to the conversation room
                socket.join(conversationId);

                // If recipient is online, join them to the room
                if (recipient.socketId) {
                    socket.to(recipient.socketId).emit("dmCreated", {
                        conversation: populatedConversation,
                    });
                }

                // Update both users' friend records with the conversation ID
                await User.updateMany(
                    {
                        _id: { $in: [socket.data.userId, data.recipientId] },
                        "friends.userId": {
                            $in: [socket.data.userId, data.recipientId],
                        },
                    },
                    {
                        $set: { "friends.$.conversationId": conversation._id },
                    }
                );

                socket.emit("dmCreated", {
                    success: true,
                    conversation: populatedConversation,
                });
                // _callback(true, populatedConversation);
            } catch (_error) {
                socket.emit("dmCreated", { success: false });
                // _callback(false);
            }
        });

        socket.on("createConversation", async (data, _callback) => {
            try {
                const conversation: IConversation = await Conversation.create({
                    type: data.type,
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

                // Then join other participants
                data.participants.forEach((userId: string) => {
                    const userSocket = Array.from(
                        io.sockets.sockets.values()
                    ).find((s) => s.data.userId === userId);
                    if (userSocket) {
                        userSocket.join(conversationId);
                    }
                });

                io.to(conversationId).emit("conversationCreated", {
                    conversation: populatedConversation,
                });

                socket.emit("conversationCreated", {
                    success: true,
                    conversation: populatedConversation,
                });
                // _callback(true, populatedConversation);
            } catch (_error) {
                socket.emit("conversationCreated", { success: false });
                // _callback(false);
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

                socket.emit("conversations", { conversations });
                // _callback(conversations);
            } catch (_error) {
                socket.emit("conversations", { conversations: [] });
                // _callback([]);
            }
        });

        socket.on("getConversations", async (data, _callback) => {
            try {
                // Set default pagination values
                const page = data?.page || 1;
                const limit = data?.limit || 10;
                const skip = (page - 1) * limit;

                // Get total count for pagination info
                const totalConversations = await Conversation.countDocuments({
                    "participants.userId": socket.data.userId,
                    status: "active",
                });

                // Get paginated conversations
                const conversations = await Conversation.find({
                    "participants.userId": socket.data.userId,
                    status: "active",
                })
                    .populate(
                        "participants.userId",
                        "name profilePicture status"
                    )
                    .populate("lastMessage")
                    .sort({ "metadata.lastActivity": -1 })
                    .skip(skip)
                    .limit(limit);

                // Calculate pagination metadata
                const totalPages = Math.ceil(totalConversations / limit);
                const hasNextPage = page < totalPages;
                const hasPrevPage = page > 1;

                socket.emit("conversations", {
                    conversations,
                    pagination: {
                        total: totalConversations,
                        page,
                        limit,
                        totalPages,
                        hasNextPage,
                        hasPrevPage,
                        nextPage: hasNextPage ? page + 1 : null,
                        prevPage: hasPrevPage ? page - 1 : null,
                    },
                });
            } catch (_error) {
                socket.emit("conversations", {
                    conversations: [],
                    pagination: {
                        total: 0,
                        page: 1,
                        limit: 10,
                        totalPages: 0,
                        hasNextPage: false,
                        hasPrevPage: false,
                        nextPage: null,
                        prevPage: null,
                    },
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
                    signupStep: "completed",
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
                console.log("receiver id: ", recipient);
                if (!recipient) {
                    socket.emit("friendRequestSent", { success: false });
                    // _callback(false);
                    return;
                }

                // Add to sender's friends list
                await User.findByIdAndUpdate(socket.data.userId, {
                    $push: {
                        friends: {
                            userId: data.recipientId,
                            status: "pending",
                            createdAt: new Date(),
                        },
                    },
                });

                // Add to recipient's friends list
                await User.findByIdAndUpdate(data.recipientId, {
                    $push: {
                        friends: {
                            userId: socket.data.userId,
                            status: "pending",
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
                // _callback(true);
            } catch (_error) {
                socket.emit("friendRequestSent", { success: false });
                // _callback(false);
                console.log("sendFriendRequest error:", _error);
            }
        });

        // Accept friend request
        socket.on("acceptFriendRequest", async (data, _callback) => {
            try {
                const sender = await User.findById(data.senderId);
                if (!sender) {
                    socket.emit("friendRequestAccepted", { success: false });
                    // _callback(false);
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

                // Update both users' friend records
                await User.updateMany(
                    {
                        _id: { $in: [socket.data.userId, data.senderId] },
                        "friends.userId": {
                            $in: [socket.data.userId, data.senderId],
                        },
                    },
                    {
                        $set: {
                            "friends.$.status": "accepted",
                            "friends.$.conversationId": conversation._id,
                        },
                    }
                );

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
                // _callback(true, { conversationId: conversation._id });
            } catch (_error) {
                socket.emit("friendRequestAccepted", { success: false });
                // _callback(false);
                console.log("acceptFriendRequest error:", _error);
            }
        });

        // Reject friend request
        socket.on("rejectFriendRequest", async (data, _callback) => {
            try {
                await User.updateMany(
                    {
                        _id: { $in: [socket.data.userId, data.senderId] },
                        "friends.userId": {
                            $in: [socket.data.userId, data.senderId],
                        },
                    },
                    {
                        $pull: {
                            friends: {
                                userId: {
                                    $in: [socket.data.userId, data.senderId],
                                },
                            },
                        },
                    }
                );

                socket.emit("friendRequestRejected", { success: true });
                // _callback(true);
            } catch (_error) {
                socket.emit("friendRequestRejected", { success: false });
                // _callback(false);
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
