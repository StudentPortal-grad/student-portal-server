import { Request, Response, NextFunction } from "express";
import Message from "../models/Message";
import Conversation from "../models/Conversation";
import User from "../models/User";
import { Types } from "mongoose";
import { AppError, ErrorCodes } from "../utils/appError";
import { HttpStatus } from "../utils/ApiResponse";
import asyncHandler from "../utils/asyncHandler";
import { getPaginationMetadata, ParsedPaginationOptions } from "../utils/pagination";
import { IConversation } from "../models/types";

// --- Helper Functions for Message Controller ---

/**
 * Finds or creates a DM conversation between two users.
 * @param currentUserId - The ID of the user initiating the action.
 * @param recipientId - The ID of the other user.
 * @returns An object containing the conversation and a flag indicating if it was newly created.
 */
const findOrCreateDmConversation = async (currentUserId: Types.ObjectId, recipientId: string): Promise<{ conversation: IConversation; isNew: boolean }> => {
    if (!Types.ObjectId.isValid(recipientId)) {
        throw new AppError("Invalid recipient ID", HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    const recipient = await User.findById(recipientId);
    if (!recipient) {
        throw new AppError("Recipient user not found", HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }
    if (recipient._id.equals(currentUserId)) {
        throw new AppError("Cannot start a conversation with yourself", HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    // Find existing DM conversation
    let conversation = await Conversation.findOne({
        type: 'DM',
        'participants.userId': { $all: [currentUserId, recipient._id] }
    });

    if (conversation) {
        return { conversation, isNew: false };
    }

    // Create a new DM conversation if one doesn't exist
    conversation = await Conversation.create({
        type: 'DM',
        participants: [{ userId: currentUserId }, { userId: recipient._id }],
        createdBy: currentUserId,
    });

    // Add the new conversation to the beginning of both users' recent conversations list
    await User.updateMany(
        { _id: { $in: [currentUserId, recipient._id] } },
        {
            $push: {
                recentConversations: {
                    $each: [{ conversationId: conversation._id, lastViewed: new Date(), unreadCount: 0 }],
                    $position: 0,
                },
            },
        }
    );

    return { conversation, isNew: true };
};

/**
 * Fetches and paginates messages for a given conversation.
 * @param conversationId - The ID of the conversation.
 * @param query - The request query containing pagination options.
 * @returns An object with the messages and pagination metadata.
 */
const fetchAndPaginateMessages = async (conversationId: string, query: any) => {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;
    const sortOrderVal = sortOrder === 'asc' ? 1 : -1;
    const sort: { [key: string]: 1 | -1 } = { [sortBy as string]: sortOrderVal };

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
                _id: 1, content: 1, createdAt: 1, updatedAt: 1, conversationId: 1,
                "sender._id": 1, "sender.name": 1, "sender.profilePicture": 1, attachments: 1
            }
        }
    ] as any[];

    const countPromise = Message.countDocuments({ conversationId });
    const messagesPromise = Message.aggregate(messagesAggregation);

    const [totalMessages, messages] = await Promise.all([countPromise, messagesPromise]);

    const paginationOptions: ParsedPaginationOptions = { page: pageNum, limit: limitNum, sortBy: sortBy as string, sortOrder: sortOrder as 'asc' | 'desc' };
    const pagination = getPaginationMetadata(totalMessages, paginationOptions);

    return { messages, pagination };
};

/**
 * Updates the user's read status for a conversation.
 * @param userId - The ID of the user.
 * @param conversationId - The ID of the conversation.
 */
const updateReadStatus = async (userId: Types.ObjectId, conversationId: string) => {
    await User.updateOne(
        { _id: userId, "recentConversations.conversationId": conversationId },
        { $set: { "recentConversations.$.unreadCount": 0 } }
    );
};


/**
 * Get messages for a conversation with pagination.
 * Can be initiated with a conversation ID or a user ID (for DMs).
 * @route GET /api/v1/messages/conversation/:id
 */
export const getMessages = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const { conversationId: id } = req.params;
    const userId = req.user!._id;

    let conversation: IConversation | null = null;

    // 1. Check if 'id' is a valid conversation the user is part of
    if (Types.ObjectId.isValid(id)) {
        conversation = await Conversation.findOne({
            _id: id,
            "participants.userId": userId,
            status: "active",
        });
    }

    // 2. If no conversation is found, treat 'id' as a user ID to find/create a DM
    if (!conversation) {
        const { conversation: dmConversation, isNew } = await findOrCreateDmConversation(userId, id);
        conversation = dmConversation;

        if (isNew) {
            // For a new conversation, return the conversation doc and empty messages
            const pagination = getPaginationMetadata(0, { page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' } as ParsedPaginationOptions);
            res.success({ messages: [], pagination, conversation }, 'Conversation created successfully');
            return;
        }
    }

    // 3. Fetch messages for the determined conversation
    const { messages, pagination } = await fetchAndPaginateMessages(conversation._id.toString(), req.query);

    // 4. Update user's read status
    await updateReadStatus(userId, conversation._id.toString());

    // 5. Send response
    // For existing DM conversations found via user ID, include the conversation object
    if (req.params.conversationId !== conversation._id.toString()) {
        res.success({ messages, pagination, conversation }, 'Messages retrieved successfully');
    } else {
        res.paginated(messages, pagination, 'Messages retrieved successfully');
    }
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
        return next(new AppError("User not authenticated", HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED));
    }

    // Validate message ID
    if (!Types.ObjectId.isValid(messageId)) {
        return next(new AppError("Invalid message ID", HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR));
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
        return next(new AppError("Message not found or you're not authorized to edit it", HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND));
    }

    res.success({ message }, 'Message updated successfully');
});

/**
 * Delete a message
 * @route DELETE /api/v1/messages/:messageId
 */
export const deleteMessage = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const { messageId } = req.params;
        const userId = req.user?._id;

        if (!userId) {
            return next(
                new AppError('User not authenticated', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED)
            );
        }

        const message = await Message.findOneAndDelete({
            _id: messageId,
            senderId: userId,
        });

        if (!message) {
            return next(
                new AppError(
                    "Message not found or you're not authorized to delete it",
                    HttpStatus.NOT_FOUND,
                    ErrorCodes.NOT_FOUND
                )
            );
        }

        res.success(null, 'Message deleted successfully');
    }
);


/**
 * @desc    Send an attachment in a conversation
 * @route   POST /api/v1/messages/attachments/:conversationId
 * @access  Private
 */
export const sendAttachment = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { conversationId } = req.params;
    const { content } = req.body;
    const senderId = req.user?._id;
    const files = req.files as Express.Multer.File[];

    if (!senderId) {
        return next(new AppError("User not authenticated", HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED));
    }

    if (!Types.ObjectId.isValid(conversationId)) {
        return next(new AppError("Invalid conversation ID", HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR));
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
        return next(new AppError("Conversation not found", HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND));
    }

    // Check if the sender is a participant
    const isParticipant = conversation.participants.some(p => p.userId.equals(senderId));
    if (!isParticipant) {
        return next(new AppError("You are not a participant of this conversation", HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN));
    }

    if (!files || files.length === 0) {
        return next(new AppError("No files were uploaded", HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR));
    }

    const attachments = files.map(file => {
        let fileType = 'file'; // default
        if (file.mimetype.startsWith('image/')) fileType = 'image';
        else if (file.mimetype.startsWith('video/')) fileType = 'video';
        else if (file.mimetype.startsWith('audio/')) fileType = 'audio';
        else if (file.mimetype === 'application/pdf') fileType = 'document';

        return {
            url: file.path,
            fileName: file.originalname,
            fileSize: file.size,
            mimeType: file.mimetype,
            type: fileType,
        };
    });

    const newMessage = await Message.create({
        senderId,
        conversationId,
        content,
        attachments,
    });

    await newMessage.populate({
        path: 'senderId',
        select: 'name profilePicture'
    });

    // Update conversation's last message
    conversation.lastMessage = newMessage._id;
    await conversation.save();

    const io = req.app.get('io');

    // Emit to other participants
    conversation.participants.forEach(participant => {
        if (participant.userId.toString() !== senderId.toString()) {
            io.to(participant.userId.toString()).emit('newMessage', newMessage);
        }
    });

    // Confirm to sender
    io.to(senderId.toString()).emit('messageSent', newMessage);

    res.success(newMessage, 'Attachment sent successfully', HttpStatus.CREATED);
});


/**
 * @desc    Delete multiple messages
 * @route   DELETE /api/v1/messages/bulk
 * @access  Private
 */
export const deleteBulkMessages = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const { messageIds } = req.body;
        const userId = req.user?._id;

        if (!userId) {
            return next(
                new AppError('User not authenticated', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED)
            );
        }

        const messages = await Message.find({
            _id: { $in: messageIds },
            senderId: userId,
        });

        if (messages.length !== messageIds.length) {
            return next(
                new AppError(
                    'One or more messages could not be found or you do not have permission to delete them.',
                    HttpStatus.FORBIDDEN,
                    ErrorCodes.FORBIDDEN
                )
            );
        }

        const result = await Message.deleteMany({
            _id: { $in: messageIds },
            senderId: userId,
        });

        res.success({ deletedCount: result.deletedCount }, 'Messages deleted successfully');
    }
);

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
