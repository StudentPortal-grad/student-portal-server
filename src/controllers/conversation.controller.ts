import { Request, Response, NextFunction } from "express";
import Conversation from "../models/Conversation";
import User from "../models/User";
import { Types } from "mongoose";
import { AppError, ErrorCodes } from "../utils/appError";
import { ResponseBuilder, HttpStatus } from "../utils/ApiResponse";
import asyncHandler from "../utils/asyncHandler";

/**
 * Create a new conversation
 * @route POST /api/v1/conversation
 */
export const createConversation = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { participants, name, description, type = "GroupDM", groupImage } = req.body;
    const userId = req.user?._id;

    if (!userId) {
        throw new AppError("User not authenticated", HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
    }

    // Validate required fields
    if (!participants || !Array.isArray(participants)) {
        throw new AppError("Participants array is required", HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    // Validate all participant IDs
    for (const id of participants) {
        if (!Types.ObjectId.isValid(id)) {
            throw new AppError(`Invalid participant ID: ${id}`, HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
        }
    }

    // Create conversation document
    const conversation = await Conversation.create({
        type,
        participants: [
            { userId, role: "owner", isAdmin: true },
            ...participants.filter((id: string) => id !== userId.toString()).map((id: string) => ({
                userId: new Types.ObjectId(id),
                role: "member",
            })),
        ],
        name,
        description,
        groupImage,
        createdBy: userId,
    });

    // Update all users in a single batch operation
    const participantIds = [userId, ...participants];
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

    // Populate conversation data
    const populatedConversation = await Conversation.populate(conversation, [
        { path: "participants.userId", select: "name profilePicture" },
        { path: "createdBy", select: "name profilePicture" }
    ]);

    // Convert to plain object for response
    const conversationToSend = populatedConversation.toObject ? populatedConversation.toObject() : populatedConversation;

    res.success({ conversation: conversationToSend }, 'Conversation created successfully', HttpStatus.CREATED);
});

/**
 * Update group image for a conversation
 * @route PATCH /api/v1/conversations/:id/image
 */
export const updateGroupImage = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { groupImage } = req.body;
    const userId = req.user?._id;

    if (!userId) {
        throw new AppError("User not authenticated", HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
    }

    // Validate conversation ID
    if (!Types.ObjectId.isValid(id)) {
        throw new AppError("Invalid conversation ID", HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    // Check if conversation exists and user is a participant with admin rights
    const conversation = await Conversation.findOne({
        _id: id,
        "participants": {
            $elemMatch: {
                userId: userId,
                isAdmin: true
            }
        }
    });

    if (!conversation) {
        throw new AppError("Conversation not found or you don't have permission", HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }

    // Update the group image
    conversation.groupImage = groupImage;
    await conversation.save();

    res.success({ groupImage: conversation.groupImage }, 'Group image updated successfully');
});

/**
 * Get all conversations for the current user
 * @route GET /api/v1/conversations
 */
export const getConversations = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?._id;

    if (!userId) {
        throw new AppError("User not authenticated", HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
    }

    const conversations = await Conversation.findActiveConversations(userId);

    res.success({ conversations }, 'Conversations retrieved successfully');
});

/**
 * Get a specific conversation by ID
 * @route GET /api/v1/conversation/:id
 */
export const getConversationById = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const userId = req.user?._id;

    if (!userId) {
        throw new AppError("User not authenticated", HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
    }

    // Validate conversation ID
    if (!Types.ObjectId.isValid(id)) {
        throw new AppError("Invalid conversation ID", HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    // Find conversation and check if user is a participant
    const conversation = await Conversation.findOne({
        _id: id,
        "participants.userId": userId,
        status: "active"
    })
    .populate("participants.userId", "name profilePicture status")
    .populate("lastMessage")
    .populate("createdBy", "name profilePicture");

    if (!conversation) {
        throw new AppError("Conversation not found or you're not a participant", HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }

    res.success({ conversation }, 'Conversation retrieved successfully');
});

/**
 * Add members to a group conversation
 * @route POST /api/v1/conversation/:id/members
 */
export const addGroupMembers = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { userIds } = req.body;
    const userId = req.user?._id;

    if (!userId) {
        throw new AppError("User not authenticated", HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
    }

    // Validate conversation ID
    if (!Types.ObjectId.isValid(id)) {
        throw new AppError("Invalid conversation ID", HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    // Check if conversation exists and is a group
    const conversation = await Conversation.findById(id);
    if (!conversation || conversation.type !== "GroupDM") {
        throw new AppError("Invalid conversation or not a group", HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    // Check if user is admin/owner
    const userRole = conversation.participants.find(
        (p) => p.userId.toString() === userId.toString()
    )?.role;

    if (!userRole || !["owner", "admin"].includes(userRole)) {
        throw new AppError("Not authorized to add members", HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN);
    }

    // Filter out existing participants
    const existingParticipantIds = conversation.participants.map(
        (p) => p.userId.toString()
    );
    const newUserIds = userIds.filter(
        (id: string) => !existingParticipantIds.includes(id)
    );

    if (newUserIds.length === 0) {
        throw new AppError("All users are already members", HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    // Add new participants
    const newParticipants = newUserIds.map((userId: string) => ({
        userId: new Types.ObjectId(userId),
        role: "member",
        joinedAt: new Date(),
        lastSeen: new Date(),
        isAdmin: false,
    }));

    // Use bulkWrite for better performance
    await Conversation.updateOne(
        { _id: id },
        { $push: { participants: { $each: newParticipants } } }
    );

    await User.updateMany(
        { _id: { $in: newUserIds } },
        {
            $push: {
                recentConversations: {
                    conversationId: id,
                    unreadCount: 0,
                    isPinned: false,
                    isMuted: false,
                }
            }
        }
    );

    // Get updated conversation
    const updatedConversation = await Conversation.findById(id)
        .populate("participants.userId", "name profilePicture status")
        .populate("lastMessage")
        .populate("createdBy", "name profilePicture");

    res.status(HttpStatus.OK).json(
        ResponseBuilder.success(
            { conversation: updatedConversation, newMembers: newUserIds },
            'Members added to conversation successfully'
        )
    );
});

/**
 * Remove a member from a group conversation
 * @route DELETE /api/v1/conversation/:id/members/:memberId
 */
export const removeGroupMember = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id, memberId } = req.params;
    const userId = req.user?._id;

    if (!userId) {
        throw new AppError("User not authenticated", HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
    }

    // Validate IDs
    if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(memberId)) {
        throw new AppError("Invalid ID format", HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    // Check if conversation exists and is a group
    const conversation = await Conversation.findById(id);
    if (!conversation || conversation.type !== "GroupDM") {
        throw new AppError("Invalid conversation or not a group", HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    // Check if user is admin/owner
    const userRole = conversation.participants.find(
        (p) => p.userId.toString() === userId.toString()
    )?.role;

    if (!userRole || !["owner", "admin"].includes(userRole)) {
        throw new AppError("Not authorized to remove members", HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN);
    }

    // Cannot remove the owner
    const memberToRemove = conversation.participants.find(
        (p) => p.userId.toString() === memberId
    );

    if (!memberToRemove) {
        throw new AppError("Member not found in conversation", HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }

    if (memberToRemove.role === "owner") {
        throw new AppError("Cannot remove the conversation owner", HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN);
    }

    // Remove member from conversation
    await Conversation.updateOne(
        { _id: id },
        { $pull: { participants: { userId: memberId } } }
    );

    // Remove conversation from user's recent conversations
    await User.updateOne(
        { _id: memberId },
        { $pull: { recentConversations: { conversationId: id } } }
    );

    res.success(null, 'Member removed successfully');
});

/**
 * Leave a conversation
 * @route POST /api/v1/conversation/:id/leave
 */
export const leaveConversation = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const userId = req.user?._id;

        if (!userId) {
            return next(new AppError("User not authenticated", 401, ErrorCodes.UNAUTHORIZED));
        }

        // Validate conversation ID
        if (!Types.ObjectId.isValid(id)) {
            return next(new AppError("Invalid conversation ID", 400, ErrorCodes.VALIDATION_ERROR));
        }

        // Check if conversation exists
        const conversation = await Conversation.findById(id);
        if (!conversation) {
            return next(new AppError("Conversation not found", 404, ErrorCodes.NOT_FOUND));
        }

        // Check if user is a participant
        const userParticipant = conversation.participants.find(
            (p) => p.userId.toString() === userId.toString()
        );

        if (!userParticipant) {
            return next(new AppError("You are not a participant in this conversation", 403, ErrorCodes.FORBIDDEN));
        }

        // Cannot leave if you're the owner of a group conversation
        if (conversation.type === "GroupDM" && userParticipant.role === "owner") {
            return next(new AppError("As the owner, you cannot leave the group. Transfer ownership first or delete the group.", 400, ErrorCodes.VALIDATION_ERROR));
        }

        // For DM conversations, just remove from recent conversations
        if (conversation.type === "DM") {
            await User.updateOne(
                { _id: userId },
                { $pull: { recentConversations: { conversationId: id } } }
            );
        } else {
            // For group conversations, remove from participants
            await Conversation.updateOne(
                { _id: id },
                { $pull: { participants: { userId } } }
            );

            // Also remove from recent conversations
            await User.updateOne(
                { _id: userId },
                { $pull: { recentConversations: { conversationId: id } } }
            );
        }

        res.success(null, 'Left conversation successfully');
    } catch (error) {
        console.error("Error leaving conversation:", error);
        next(new AppError("Failed to leave conversation", 500, ErrorCodes.INTERNAL_ERROR));
    }
};

/**
 * Get recent conversations
 * @route GET /api/v1/conversation/recent
 */
export const getRecentConversations = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?._id;

        if (!userId) {
            return next(new AppError("User not authenticated", 401, ErrorCodes.UNAUTHORIZED));
        }

        // Use projection and lean() for better performance
        const user = await User.findById(userId)
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
            return next(new AppError("User not found", 404, ErrorCodes.NOT_FOUND));
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

        res.success({ conversations: sortedConversations }, 'Recent conversations retrieved successfully');
    } catch (error) {
        console.error("Error getting recent conversations:", error);
        next(new AppError("Failed to get recent conversations", 500, ErrorCodes.INTERNAL_ERROR));
    }
};

/**
 * Update recent conversation settings (pin, mute, etc.)
 * @route PATCH /api/v1/conversation/recent/:id
 */
export const updateRecentConversation = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { isPinned, isMuted, mutedUntil } = req.body;
        const userId = req.user?._id;

        if (!userId) {
            return next(new AppError("User not authenticated", 401, ErrorCodes.UNAUTHORIZED));
        }

        // Validate conversation ID
        if (!Types.ObjectId.isValid(id)) {
            return next(new AppError("Invalid conversation ID", 400, ErrorCodes.VALIDATION_ERROR));
        }

        // Build update object dynamically based on provided fields
        const updateData: any = {};

        if (isPinned !== undefined) {
            updateData["recentConversations.$.isPinned"] = isPinned;
        }

        if (isMuted !== undefined) {
            updateData["recentConversations.$.isMuted"] = isMuted;

            if (isMuted && mutedUntil) {
                updateData["recentConversations.$.mutedUntil"] = new Date(mutedUntil);
            } else if (!isMuted) {
                updateData["recentConversations.$.mutedUntil"] = null;
            }
        }

        // Skip update if no fields to update
        if (Object.keys(updateData).length === 0) {
            return next(new AppError("No fields to update", 400, ErrorCodes.VALIDATION_ERROR));
        }

        // Perform update with optimized query
        const result = await User.updateOne(
            {
                _id: userId,
                "recentConversations.conversationId": id,
            },
            { $set: updateData }
        );

        if (result.modifiedCount === 0) {
            return next(new AppError("Conversation not found in recent list", 404, ErrorCodes.NOT_FOUND));
        }

        res.success({
            conversationId: id,
            updates: {
                isPinned,
                isMuted,
                mutedUntil,
            }
        }, 'Conversation settings updated successfully');
    } catch (error) {
        console.error("Error updating recent conversation:", error);
        next(new AppError("Failed to update recent conversation", 500, ErrorCodes.INTERNAL_ERROR));
    }
};

/**
 * Remove conversation from recent list
 * @route DELETE /api/v1/conversation/recent/:id
 */
export const removeFromRecentConversations = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const userId = req.user?._id;

        if (!userId) {
            return next(new AppError("User not authenticated", 401, ErrorCodes.UNAUTHORIZED));
        }

        // Validate conversation ID
        if (!Types.ObjectId.isValid(id)) {
            return next(new AppError("Invalid conversation ID", 400, ErrorCodes.VALIDATION_ERROR));
        }

        const result = await User.updateOne(
            { _id: userId },
            {
                $pull: {
                    recentConversations: {
                        conversationId: id,
                    },
                },
            }
        );

        if (result.modifiedCount === 0) {
            return next(new AppError("Conversation not found in recent list", 404, ErrorCodes.NOT_FOUND));
        }

        res.success(null, 'Conversation removed from recent list');
    } catch (error) {
        console.error("Error removing from recent conversations:", error);
        next(new AppError("Failed to remove from recent conversations", 500, ErrorCodes.INTERNAL_ERROR));
    }
};
