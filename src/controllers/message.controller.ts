import { Request, Response, NextFunction } from "express";
import Message from "../models/Message";
import Conversation from "../models/Conversation";
import User from "../models/User";
import { Types } from "mongoose";
import { AppError, ErrorCodes } from "../utils/appError";
import { ResponseBuilder, HttpStatus } from "../utils/ApiResponse";
import asyncHandler from "../utils/asyncHandler";

/**
 * Get messages for a conversation with pagination
 * @route GET /api/v1/messages/conversation/:conversationId
 */
export const getMessages = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { conversationId } = req.params;
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    const userId = req.user?._id;

    if (!userId) {
        throw new AppError("User not authenticated", HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
    }

    // Validate conversation ID
    if (!Types.ObjectId.isValid(conversationId)) {
        throw new AppError("Invalid conversation ID", HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    // Validate user is a participant
    const isParticipant = await Conversation.exists({
        _id: conversationId,
        "participants.userId": userId,
        status: "active",
    });

    if (!isParticipant) {
        throw new AppError("Not authorized for this conversation", HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN);
    }

    // Set pagination params
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    const sortOrderVal = sortOrder === 'asc' ? 1 : -1;
    const sort: { [key: string]: 1 | -1 } = { [sortBy as string]: sortOrderVal };

    // Use aggregation pipeline for efficient querying
    const messagesAggregation = [
        { $match: { conversationId: new Types.ObjectId(conversationId) } },
        { $sort: sort },
        { $skip: skip },
        { $limit: limitNum },
        {
            $lookup: {
                from: "users",
                localField: "senderId",
                foreignField: "_id",
                as: "sender"
            }
        },
        { $unwind: "$sender" },
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
        }
    ] as any[]; // Use type assertion to avoid TypeScript errors

    // Count total messages in parallel with fetching messages
    const countPromise = Message.countDocuments({ conversationId });
    const messagesPromise = Message.aggregate(messagesAggregation);

    // Execute both queries in parallel
    const [totalMessages, messages] = await Promise.all([countPromise, messagesPromise]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalMessages / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    // Update user's last seen in conversation
    await User.updateOne(
        {
            _id: userId,
            "recentConversations.conversationId": conversationId,
        },
        {
            $set: {
                lastSeen: new Date(),
                "recentConversations.$.unreadCount": 0,
            },
        }
    );

    const paginationMetadata = {
        total: totalMessages,
        page: pageNum,
        limit: limitNum,
        totalPages,
        hasNextPage,
        hasPrevPage,
        nextPage: hasNextPage ? pageNum + 1 : null,
        prevPage: hasPrevPage ? pageNum - 1 : null,
    };

    res.paginated(messages, paginationMetadata, 'Messages retrieved successfully');
});

/**
 * Edit a message
 * @route PATCH /api/v1/messages/:messageId
 */
export const editMessage = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { messageId } = req.params;
    const { content } = req.body;
    const userId = req.user?._id;

    if (!userId) {
        throw new AppError("User not authenticated", HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
    }

    // Validate message ID
    if (!Types.ObjectId.isValid(messageId)) {
        throw new AppError("Invalid message ID", HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    // Find and update the message
    const message = await Message.findOneAndUpdate(
        {
            _id: messageId,
            senderId: userId
        },
        {
            $set: { content },
            $currentDate: { updatedAt: true }
        },
        { new: true }
    );

    if (!message) {
        throw new AppError("Message not found or you're not authorized to edit it", HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }

    res.success({ message }, 'Message updated successfully');
});

/**
 * Delete a message
 * @route DELETE /api/v1/messages/:messageId
 */
export const deleteMessage = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { messageId } = req.params;
    const userId = req.user?._id;

    if (!userId) {
        throw new AppError("User not authenticated", HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
    }

    // Validate message ID
    if (!Types.ObjectId.isValid(messageId)) {
        throw new AppError("Invalid message ID", HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    // Find and delete the message (soft delete by setting status to deleted)
    const message = await Message.findOneAndUpdate(
        {
            _id: messageId,
            senderId: userId
        },
        {
            $set: { status: "deleted" }
        },
        { new: true }
    );

    if (!message) {
        throw new AppError("Message not found or you're not authorized to delete it", HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }

    res.success(null, 'Message deleted successfully');
});

/**
 * Mark messages as read in a conversation
 * @route POST /api/v1/messages/read/:conversationId
 */
export const markMessageRead = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { conversationId } = req.params;
    const userId = req.user?._id;

    if (!userId) {
        throw new AppError("User not authenticated", HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
    }

    // Validate conversation ID
    if (!Types.ObjectId.isValid(conversationId)) {
        throw new AppError("Invalid conversation ID", HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    // Update the user's lastSeen timestamp and reset unread count
    const result = await User.updateOne(
        {
            _id: userId,
            "recentConversations.conversationId": conversationId,
        },
        {
            $set: {
                lastSeen: new Date(),
                "recentConversations.$.unreadCount": 0,
            },
        }
    );

    if (result.modifiedCount === 0) {
        throw new AppError("Conversation not found in recent list", HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }

    res.success(null, 'Messages marked as read');
});
