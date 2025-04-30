import { Socket } from "socket.io";
import User from "@models/User";
import Conversation from "@models/Conversation";
import { SocketUtils } from "@utils/socketUtils";

/**
 * Handles all socket events related to friend functionality
 */
export const handleFriendEvents = (socket: Socket) => {
    // Socket event handlers
    socket.on("sendFriendRequest", async (data, _callback) => {
        try {
            if (!SocketUtils.validateObjectId(data.recipientId)) {
                return SocketUtils.emitError(
                    socket,
                    "friendRequestSent",
                    "Invalid recipient ID"
                );
            }

            const validation = await validateFriendRequest(
                socket.data.userId,
                data.recipientId
            );

            if (!validation.valid) {
                return SocketUtils.emitError(
                    socket,
                    "friendRequestSent",
                    validation.error
                );
            }

            // Add to recipient's friend requests
            await User.updateOne(
                { _id: data.recipientId },
                {
                    $push: {
                        friendRequests: {
                            userId: socket.data.userId,
                            createdAt: new Date(),
                        },
                    },
                }
            );

            // Notify recipient if online
            if (validation.recipientSocketId) {
                socket.to(validation.recipientSocketId).emit("friendRequestReceived", {
                    userId: socket.data.userId,
                });
            }

            SocketUtils.emitSuccess(socket, "friendRequestSent");
        } catch (error: any) {
            console.error("sendFriendRequest error:", error);
            SocketUtils.emitError(socket, "friendRequestSent", error.message || "Server error");
        }
    });

    // Accept friend request
    socket.on("acceptFriendRequest", async (data, _callback) => {
        try {
            if (!SocketUtils.validateObjectId(data.senderId)) {
                return SocketUtils.emitError(
                    socket,
                    "friendRequestAccepted",
                    "Invalid sender ID"
                );
            }

            const validation = await validateFriendAcceptance(
                data.senderId,
                socket.data.userId
            );

            if (!validation.valid) {
                return SocketUtils.emitError(
                    socket,
                    "friendRequestAccepted",
                    validation.error
                );
            }

            // Create DM conversation and update friendship records
            const conversation = await createDMConversation(
                socket.data.userId,
                data.senderId
            );

            await updateFriendshipRecords(
                socket.data.userId,
                data.senderId,
                conversation._id as string
            );

            // Notify sender if online
            if (validation.senderSocketId) {
                socket.to(validation.senderSocketId).emit("friendRequestAccepted", {
                    userId: socket.data.userId,
                    conversationId: conversation._id,
                });
            }

            SocketUtils.emitSuccess(socket, "friendRequestAccepted", {
                userId: data.senderId,
                conversationId: conversation._id,
            });
        } catch (error: any) {
            console.error("acceptFriendRequest error:", error);
            SocketUtils.emitError(socket, "friendRequestAccepted", error.message || "Server error");
        }
    });

    // Get friend requests
    socket.on("getFriendRequests", async (data, _callback) => {
        try {
            // Use projection for better performance
            const user = await User.findById(socket.data.userId)
                .select("friendRequests")
                .populate({
                    path: "friendRequests.userId",
                    select: "name username profilePicture status lastSeen level college",
                });

            if (!user) {
                return SocketUtils.emitError(
                    socket,
                    "friendRequests",
                    "User not found"
                );
            }

            // Set pagination parameters with defaults
            const page = data?.page || 1;
            const limit = data?.limit || 10;
            const startIndex = (page - 1) * limit;
            const endIndex = page * limit;

            // Get paginated requests
            const paginatedRequests = user.friendRequests?.slice(startIndex, endIndex) || [];

            // Calculate pagination metadata
            const totalRequests = user.friendRequests?.length || 0;
            const totalPages = Math.ceil(totalRequests / limit);
            const hasNextPage = page < totalPages;
            const hasPrevPage = page > 1;

            SocketUtils.emitSuccess(socket, "friendRequests", {
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
            SocketUtils.emitError(socket, "friendRequests");
        }
    });

    // Reject friend request
    socket.on("rejectFriendRequest", async (data, _callback) => {
        try {
            if (!SocketUtils.validateObjectId(data.senderId)) {
                return SocketUtils.emitError(
                    socket,
                    "friendRequestRejected",
                    "Invalid sender ID"
                );
            }

            // Remove the friend request with optimized query
            const result = await User.updateOne(
                { _id: socket.data.userId },
                {
                    $pull: {
                        friendRequests: {
                            userId: data.senderId,
                        },
                    },
                }
            );

            if (result.modifiedCount === 0) {
                return SocketUtils.emitError(
                    socket,
                    "friendRequestRejected",
                    "Friend request not found"
                );
            }

            SocketUtils.emitSuccess(socket, "friendRequestRejected");
        } catch (error) {
            console.error("rejectFriendRequest error:", error);
            SocketUtils.emitError(socket, "friendRequestRejected");
        }
    });

    // Block user
    socket.on("blockUser", async (data, _callback) => {
        try {
            if (!SocketUtils.validateObjectId(data.userId)) {
                return SocketUtils.emitError(
                    socket,
                    "userBlocked",
                    "Invalid user ID"
                );
            }

            // Use a single efficient update
            const result = await User.updateMany(
                {
                    _id: { $in: [socket.data.userId, data.userId] },
                    "friends.userId": { $in: [socket.data.userId, data.userId] },
                },
                {
                    $set: {
                        "friends.$.status": "blocked",
                        "friends.$.blockedBy": socket.data.userId,
                    },
                }
            );

            if (result.modifiedCount === 0) {
                return SocketUtils.emitError(
                    socket,
                    "userBlocked",
                    "User not found in friends list"
                );
            }

            SocketUtils.emitSuccess(socket, "userBlocked");
        } catch (error) {
            console.error("blockUser error:", error);
            SocketUtils.emitError(socket, "userBlocked");
        }
    });

    // Unblock user
    socket.on("unblockUser", async (data, _callback) => {
        try {
            if (!SocketUtils.validateObjectId(data.userId)) {
                return SocketUtils.emitError(
                    socket,
                    "userUnblocked",
                    "Invalid user ID"
                );
            }

            // Use a single efficient update
            const result = await User.updateMany(
                {
                    _id: { $in: [socket.data.userId, data.userId] },
                    "friends.userId": { $in: [socket.data.userId, data.userId] },
                },
                {
                    $set: { "friends.$.status": "accepted" },
                    $unset: { "friends.$.blockedBy": "" },
                }
            );

            if (result.modifiedCount === 0) {
                return SocketUtils.emitError(
                    socket,
                    "userUnblocked",
                    "User not found in friends list"
                );
            }

            SocketUtils.emitSuccess(socket, "userUnblocked");
        } catch (error) {
            console.error("unblockUser error:", error);
            SocketUtils.emitError(socket, "userUnblocked");
        }
    });
};

// Validate user IDs and check for existing relationship
async function validateFriendRequest(senderId: string, recipientId: string) {

    const [result] = await User.aggregate([
        {
            $match: { _id: { $in: [senderId, recipientId] } }
        },
        {
            $group: {
                _id: null,
                userCount: { $sum: 1 },
                recipientData: {
                    $push: {
                        $cond: [
                            { $eq: ["$_id", recipientId] },
                            {
                                socketId: "$socketId",
                                hasRequest: { $in: [senderId, "$friendRequests.userId"] }
                            },
                            null
                        ]
                    }
                },
                senderData: {
                    $push: {
                        $cond: [
                            { $eq: ["$_id", senderId] },
                            {
                                alreadyFriends: { $in: [recipientId, "$friends.userId"] }
                            },
                            null
                        ]
                    }
                }
            }
        }
    ]);

    if (!result || result.userCount !== 2) {
        return { valid: false, error: "One or both users not found" };
    }

    // Extract recipient data (cleaner approach)
    const recipientData = result.recipientData.find((data: any) => data !== null);
    const senderData = result.senderData.find((data: any) => data !== null);

    if (!recipientData) {
        return { valid: false, error: "Recipient not found" };
    }

    if (recipientData.hasRequest) {
        return { valid: false, error: "Friend request already sent" };
    }

    if (senderData.alreadyFriends) {
        return { valid: false, error: "Already friends" };
    }

    return {
        valid: true,
        recipientSocketId: recipientData.socketId
    };
}

// Validate and get info for friend request acceptance
async function validateFriendAcceptance(senderId: string, recipientId: string) {
    const [result] = await User.aggregate([
        {
            $match: { _id: { $in: [recipientId, senderId] } }
        },
        {
            $group: {
                _id: null,
                userCount: { $sum: 1 },
                recipientData: {
                    $push: {
                        $cond: [
                            { $eq: ["$_id", recipientId] },
                            { hasRequest: { $in: [senderId, "$friendRequests.userId"] } },
                            null
                        ]
                    }
                },
                senderData: {
                    $push: {
                        $cond: [
                            { $eq: ["$_id", senderId] },
                            { socketId: "$socketId" },
                            null
                        ]
                    }
                }
            }
        }
    ]);

    console.log(`result is: ${result}`);

    if (!result || result.userCount !== 2) {
        return { valid: false, error: "One or both users not found" };
    }

    const recipientData = result.recipientData.find((data: any) => data !== null);
    const senderData = result.senderData.find((data: any) => data !== null);

    if (!recipientData || !recipientData.hasRequest) {
        return { valid: false, error: "Friend request not found" };
    }

    return {
        valid: true,
        senderSocketId: senderData?.socketId
    };
}

// Create DM conversation between users
async function createDMConversation(userId1: string, userId2: string) {
    return await Conversation.create({
        type: "DM",
        participants: [
            { userId: userId1, role: "member" },
            { userId: userId2, role: "member" },
        ],
        createdBy: userId1,
    });
}

// Update user records when a friend request is accepted
async function updateFriendshipRecords(userId1: string, userId2: string, conversationId: string) {
    const friendshipData = {
        status: "accepted",
        conversationId,
        createdAt: new Date()
    };

    await Promise.all([
        // Update recipient - add friend and remove request
        User.updateOne(
            { _id: userId1 },
            {
                $push: {
                    friends: {
                        userId: userId2,
                        ...friendshipData
                    }
                },
                $pull: {
                    friendRequests: { userId: userId2 }
                }
            }
        ),
        // Update sender - add friend
        User.updateOne(
            { _id: userId2 },
            {
                $push: {
                    friends: {
                        userId: userId1,
                        ...friendshipData
                    }
                }
            }
        )
    ]);
}
