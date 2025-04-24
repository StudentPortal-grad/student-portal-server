import { Socket } from "socket.io";
import { Types } from "mongoose";
import User from "@models/User";
import Conversation from "@models/Conversation";
import Message from "@models/Message";
import { getIO } from "@config/socket";
import { SocketUtils } from "@utils/socketUtils";

/**
 * Handles all socket events related to conversations
 */
export const handleConversationEvents = (socket: Socket) => {
    socket.on("createConversation", async (data, _callback) => {
        try {
            // Create conversation and prepare participant operations in parallel
            const participantIds = [socket.data.userId, ...data.participants];
            
            // Create conversation document
            const conversationPromise = Conversation.create({
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

            // Prepare to update all users in a single batch operation
            const userUpdatePromise = User.updateMany(
                { _id: { $in: participantIds } },
                {
                    $push: {
                        recentConversations: {
                            conversationId: (await conversationPromise)._id,
                            unreadCount: 0,
                            isPinned: false,
                            isMuted: false,
                        },
                    },
                }
            );

            // Execute both operations in parallel
            const [conversation] = await Promise.all([conversationPromise, userUpdatePromise]);

            // Populate conversation data using Model.populate() instead of a separate query
            const populatedConversation = await Conversation.populate(conversation, [
                { path: "participants.userId", select: "name profilePicture" },
                { path: "createdBy", select: "name profilePicture" }
            ]);
            
            // Convert to plain object for socket transmission
            const conversationToSend = populatedConversation.toObject ? populatedConversation.toObject() : populatedConversation;

            // Join all participants to the conversation room
            const io = getIO();
            const conversationId = (conversation._id as Types.ObjectId).toString();

            // Join the creator to the room first
            socket.join(conversationId);

            // Then join other participants
            data.participants.forEach((userId: string) => {
                const userSocket = Array.from(io.sockets.sockets.values())
                    .find((s) => s.data.userId === userId);
                if (userSocket) {
                    userSocket.join(conversationId);
                }
            });

            socket.broadcast.to(conversationId).emit("conversationCreated", {
                conversation: conversationToSend,
            });

            SocketUtils.emitSuccess(socket, "conversationCreated", {
                conversation: conversationToSend,
            });
        } catch (error) {
            console.error("Error creating conversation:", error);
            SocketUtils.emitError(socket, "conversationCreated");
        }
    });

    socket.on("getConversations", async (_callback) => {
        try {
            // Use lean() for faster query execution and projection to limit fields
            const conversations = await Conversation.find({
                "participants.userId": socket.data.userId,
                status: "active",
            })
                .populate("participants.userId", "name profilePicture status")
                .populate("lastMessage")
                .sort({ "metadata.lastActivity": -1 })
                .lean();

            SocketUtils.emitSuccess(socket, "conversations", {
                conversations,
            });
        } catch (error) {
            console.error("Error fetching conversations:", error);
            SocketUtils.emitSuccess(socket, "conversations", {
                conversations: [],
            });
        }
    });
    
    // Add new event for getting conversation messages with pagination and sorting
    socket.on("getConversationMessages", async (data, _callback) => {
        try {
            if (!SocketUtils.validateObjectId(data.conversationId)) {
                return SocketUtils.emitError(
                    socket,
                    "conversationMessages",
                    "Invalid conversation ID"
                );
            }

            // Validate user is a participant
            const isParticipant = await Conversation.exists({
                _id: data.conversationId,
                "participants.userId": socket.data.userId,
                status: "active",
            });

            if (!isParticipant) {
                return SocketUtils.emitError(
                    socket,
                    "conversationMessages",
                    "Not authorized for this conversation"
                );
            }

            // Set pagination params with defaults
            const page = data.page || 1;
            const limit = data.limit || 20;
            const skip = (page - 1) * limit;

            // Use a single aggregation pipeline for efficient querying
            // Define properly typed aggregation pipeline
            const messagesAggregation = [
                { $match: { conversationId: new Types.ObjectId(data.conversationId) } } as const,
                { $sort: { createdAt: -1 } } as const,
                { $skip: skip } as const,
                { $limit: limit } as const,
                {
                    $lookup: {
                        from: "users",
                        localField: "senderId",
                        foreignField: "_id",
                        as: "sender"
                    }
                } as const,
                { $unwind: "$sender" } as const,
                {
                    $project: {
                        _id: 1,
                        content: 1,
                        createdAt: 1,
                        updatedAt: 1,
                        conversationId: 1,
                        "sender._id": 1,
                        "sender.name": 1,
                        "sender.profilePicture": 1
                    }
                } as const
            ];

            // Count total messages in parallel with fetching messages
            const countPromise = Message.countDocuments({ conversationId: data.conversationId });
            const messagesPromise = Message.aggregate(messagesAggregation);

            // Execute both queries in parallel
            const [totalMessages, messages] = await Promise.all([countPromise, messagesPromise]);

            // Calculate pagination metadata
            const totalPages = Math.ceil(totalMessages / limit);
            const hasNextPage = page < totalPages;
            const hasPrevPage = page > 1;

            // Update user's last seen in conversation
            await Conversation.updateOne(
                {
                    _id: data.conversationId,
                    "participants.userId": socket.data.userId,
                },
                { $set: { "participants.$.lastSeen": new Date() } }
            );

            SocketUtils.emitSuccess(socket, "conversationMessages", {
                messages,
                pagination: {
                    total: totalMessages,
                    page,
                    limit,
                    totalPages,
                    hasNextPage,
                    hasPrevPage,
                },
            });
        } catch (error) {
            console.error("Error getting conversation messages:", error);
            SocketUtils.emitError(socket, "conversationMessages");
        }
    });

    // Add event handler for adding new group members
    socket.on("addGroupMembers", async (data, _callback) => {
        try {
            if (
                !(await SocketUtils.validateRequest(socket, data, [
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
                return SocketUtils.emitError(
                    socket,
                    "groupMembersAdded",
                    "Invalid conversation or not a group"
                );
            }

            const conversationId = (
                conversation._id as Types.ObjectId
            ).toString();

            // Check if user is admin/owner
            const userRole = conversation.participants.find(
                (p) => p.userId.toString() === socket.data.userId
            )?.role;

            if (!userRole || !["owner", "admin"].includes(userRole)) {
                return SocketUtils.emitError(
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
                return SocketUtils.emitError(
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

            // Use bulkWrite for better performance by combining multiple operations
            const bulkOperations = [
                // Update the conversation to add new participants
                {
                    updateOne: {
                        filter: { _id: conversation._id },
                        update: {
                            $push: { participants: { $each: newParticipants } }
                        }
                    }
                },
                
                // Update all new users to add the conversation to their recentConversations
                {
                    updateMany: {
                        filter: { _id: { $in: newUserIds } },
                        update: {
                            $push: {
                                recentConversations: {
                                    conversationId: conversation._id,
                                    unreadCount: 0,
                                    isPinned: false,
                                    isMuted: false,
                                }
                            }
                        }
                    }
                }
            ];
            
            // Execute all operations in a single database call
            await Conversation.bulkWrite([bulkOperations[0]]);
            await User.bulkWrite([bulkOperations[1]]);

            // Get populated conversation data using Model.populate()
            const updatedConversation = await conversation.populate([
                {
                    path: "participants.userId",
                    select: "name profilePicture",
                },
                { path: "createdBy", select: "name profilePicture" },
            ]);
            
            // Convert to plain object for socket transmission
            const conversationToSend = updatedConversation.toObject ? updatedConversation.toObject() : updatedConversation;

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

            // Notify other participants (not the sender) about new members
            socket.broadcast.to(conversationId).emit("groupMembersAdded", {
                conversationId,
                newMembers: newUserIds,
                conversation: conversationToSend,
            });

            SocketUtils.emitSuccess(socket, "groupMembersAdded", {
                conversation: conversationToSend,
            });
        } catch (error) {
            console.error("Error adding group members:", error);
            SocketUtils.emitError(socket, "groupMembersAdded");
        }
    });
};


