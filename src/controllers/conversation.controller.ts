import { Request, Response, NextFunction } from "express";
import Conversation from "../models/Conversation";
import User from "../models/User";
import { Types } from "mongoose";
import { AppError, ErrorCodes } from "../utils/appError";

/**
 * Create a new conversation
 * @route POST /api/v1/conversation
 */
export const createConversation = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { participants, name, description, type = "GroupDM", groupImage } = req.body;
        const userId = req.user?._id;

        if (!userId) {
            return next(new AppError("User not authenticated", 401, ErrorCodes.UNAUTHORIZED));
        }

        // Validate required fields
        if (!participants || !Array.isArray(participants)) {
            return next(new AppError("Participants array is required", 400, ErrorCodes.VALIDATION_ERROR));
        }

        // Validate all participant IDs
        for (const id of participants) {
            if (!Types.ObjectId.isValid(id)) {
                return next(new AppError(`Invalid participant ID: ${id}`, 400, ErrorCodes.VALIDATION_ERROR));
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

        res.status(201).json({
            success: true,
            data: {
                conversation: conversationToSend
            }
        });
    } catch (error) {
        console.error("Error creating conversation:", error);
        next(new AppError("Failed to create conversation", 500, ErrorCodes.INTERNAL_ERROR));
    }
};

/**
 * Update group image for a conversation
 * @route PATCH /api/v1/conversations/:id/image
 */
export const updateGroupImage = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { groupImage } = req.body;
        const userId = req.user?._id;

        if (!userId) {
            return next(new AppError("User not authenticated", 401, ErrorCodes.UNAUTHORIZED));
        }

        // Validate conversation ID
        if (!Types.ObjectId.isValid(id)) {
            return next(new AppError("Invalid conversation ID", 400, ErrorCodes.VALIDATION_ERROR));
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
            return next(new AppError("Conversation not found or you don't have permission", 404, ErrorCodes.NOT_FOUND));
        }

        // Update the group image
        conversation.groupImage = groupImage;
        await conversation.save();

        res.status(200).json({
            success: true,
            data: {
                groupImage: conversation.groupImage
            }
        });
    } catch (error) {
        console.error("Error updating group image:", error);
        next(new AppError("Failed to update group image", 500, ErrorCodes.INTERNAL_ERROR));
    }
};

/**
 * Get all conversations for the current user
 * @route GET /api/v1/conversations
 */
export const getConversations = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?._id;

        if (!userId) {
            return next(new AppError("User not authenticated", 401, ErrorCodes.UNAUTHORIZED));
        }

        const conversations = await Conversation.findActiveConversations(userId);

        res.status(200).json({
            success: true,
            data: {
                conversations
            }
        });
    } catch (error) {
        console.error("Error fetching conversations:", error);
        next(new AppError("Failed to fetch conversations", 500, ErrorCodes.INTERNAL_ERROR));
    }
};
