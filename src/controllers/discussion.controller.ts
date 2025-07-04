import { Request, Response, NextFunction } from 'express';
import { DiscussionService, DiscussionQueryParams } from '../services/discussion.service';
import { Types } from 'mongoose';
import { AppError, ErrorCodes } from '../utils/appError';
import { DiscussionRepository } from '../repositories/discussion.repo';
import { UploadService } from '../utils/uploadService';
import NotificationService from '../services/notification.service';
import User from '../models/User';
import { NotFoundError } from '@utils/errors';

const discussionRepository = new DiscussionRepository();
const uploadService = new UploadService();
const discussionService = new DiscussionService(discussionRepository, uploadService);

/**
 * Create a new discussion
 */
export const createDiscussion = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return next(new AppError('User not authenticated', 401, ErrorCodes.UNAUTHORIZED));
    }

    console.log(req.body);

    const attachmentsData: any[] = [];
    if (req.files && Array.isArray(req.files)) {
      for (const file of req.files as Express.Multer.File[]) {
        // Attempt to infer type from mimetype
        let type = 'other';
        if (file.mimetype.startsWith('image/')) {
          type = 'image';
        } else if (file.mimetype.startsWith('video/')) {
          type = 'video';
        } else if (file.mimetype.startsWith('audio/')) {
          type = 'audio';
        } else if (file.mimetype === 'application/pdf') {
          type = 'pdf'; // Specifically assign 'pdf'
        } else if (
          file.mimetype === 'application/msword' || // .doc
          file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || // .docx
          file.mimetype === 'application/vnd.oasis.opendocument.text' // .odt
        ) {
          type = 'document';
        }
        // 'poll' type would typically be set based on req.body data, not file mimetype

        attachmentsData.push({
          type,
          resource: file.path, // For Cloudinary, file.path is the secure_url
          mimeType: file.mimetype,
          originalFileName: file.originalname,
          fileSize: file.size,
          checksum: file.filename, // For Cloudinary, file.filename is the public_id, used as checksum
        });
      }
    }

    const discussionData: any = {
      ...req.body,
      creator: userId,
    };

    // If communityId is explicitly provided as null or empty string, remove it to signify a global discussion
    if (discussionData.communityId === null || discussionData.communityId === '') {
      delete discussionData.communityId;
    }

    // If files were uploaded, use the processed attachmentsData.
    // This overrides any 'attachments' array potentially sent in req.body if req.files is present.
    if (attachmentsData.length > 0) {
      discussionData.attachments = attachmentsData;
    } else if (req.body.attachments) {
      // If no files uploaded via req.files, but req.body.attachments exists (e.g. pre-uploaded links)
      discussionData.attachments = req.body.attachments;
    } else {
      discussionData.attachments = []; // Ensure attachments is an empty array if none provided
    }

    const discussion = await discussionService.createDiscussion(discussionData);

    // --- Notify Followers ---
    const creator = await User.findById(userId).select('followers name');
    if (creator && creator.followers && creator.followers.length > 0) {
      const notificationPromises = creator.followers.map(followerId => {
        return NotificationService.createNotification(
          followerId,
          'new_discussion',
          `${creator.name} posted a new discussion: "${discussion.title}"`,
          {
            discussionId: discussion._id,
            creatorId: userId,
            creatorName: creator.name
          }
        );
      });
      await Promise.all(notificationPromises);
    }

    res.success(discussion, 'Discussion created successfully', 201);
  } catch (error) {
    next(new AppError(error instanceof Error ? error.message : 'An unknown error occurred', 500, ErrorCodes.INTERNAL_ERROR));
  }
};

/**
 * Get discussion by ID
 */
export const getDiscussionById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { currVoteSpecified } = req.query;
    const userId = req.user?._id;

    const discussion = await discussionService.getDiscussionById(id, {
      currVoteSpecified: currVoteSpecified === 'true',
      userId: userId,
    });

    res.success(discussion, 'Discussion retrieved successfully');
  } catch (error) {
    if (error instanceof NotFoundError) {
      return next(new AppError('Discussion not found', 404, ErrorCodes.NOT_FOUND));
    }
    next(new AppError(error instanceof Error ? error.message : 'An unknown error occurred', 500, ErrorCodes.INTERNAL_ERROR));
  }
};

/**
 * Add reply to a discussion
 */
export const addReply = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id: discussionId } = req.params; // Renamed for clarity
    const userId = req.user?._id;

    if (!userId) {
      return next(new AppError('User not authenticated', 401, ErrorCodes.UNAUTHORIZED));
    }

    const attachmentsData: any[] = [];
    if (req.files && Array.isArray(req.files)) {
      for (const file of req.files as Express.Multer.File[]) {
        let type = 'other';
        if (file.mimetype.startsWith('image/')) {
          type = 'image';
        } else if (file.mimetype.startsWith('video/')) {
          type = 'video';
        } else if (file.mimetype.startsWith('audio/')) {
          type = 'audio';
        } else if (file.mimetype === 'application/pdf') {
          type = 'pdf'; // Specifically assign 'pdf'
        } else if (
          file.mimetype === 'application/msword' || // .doc
          file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || // .docx
          file.mimetype === 'application/vnd.oasis.opendocument.text' // .odt
        ) {
          type = 'document';
        }
        // 'poll' type would typically be set based on req.body data, not file mimetype

        attachmentsData.push({
          type,
          resource: file.path,
          mimeType: file.mimetype,
          originalFileName: file.originalname,
          fileSize: file.size,
          checksum: file.filename,
        });
      }
    }

    const replyData: any = {
      ...req.body,
      creator: userId,
    };

    if (attachmentsData.length > 0) {
      replyData.attachments = attachmentsData;
    } else if (req.body.attachments) {
      replyData.attachments = req.body.attachments;
    } else {
      replyData.attachments = [];
    }

    const discussion = await discussionService.addReply(discussionId, replyData);
    if (!discussion) {
      return next(new AppError('Discussion not found for reply', 404, ErrorCodes.NOT_FOUND));
    }

    res.success(discussion, 'Reply added successfully');
  } catch (error) {
    next(new AppError(error instanceof Error ? error.message : 'An unknown error occurred', 500, ErrorCodes.INTERNAL_ERROR));
  }
};

/**
 * Get all discussions with pagination and filtering
 */
export const getAllDiscussions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 10,
      communityId,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search,
      currVoteSpecified,
      ai_enabled
    } = req.query;

    const queryParams: DiscussionQueryParams = {
      page: Number(page),
      limit: Number(limit),
      sortBy: sortBy as string,
      sortOrder: sortOrder as 'asc' | 'desc',
    };

    if (communityId) {
      queryParams.communityId = communityId as string;
    }

    if (search) {
      queryParams.search = search as string;
    }

    if (currVoteSpecified !== undefined) {
      queryParams.currVoteSpecified = currVoteSpecified === 'true';
      queryParams.userId = req.user?._id;
    }

    if (ai_enabled !== undefined) {
        queryParams.ai_enabled = ai_enabled === 'true';
        // Recommendations are personalized, so we need the user ID.
        if (!queryParams.userId) {
            queryParams.userId = req.user?._id;
        }
    }

    const { discussions, pagination } = await discussionService.getAllDiscussions(queryParams);
    res.success({ discussions, pagination }, 'Discussions retrieved successfully');
  } catch (error) {
    next(new AppError(error instanceof Error ? error.message : 'An unknown error occurred', 500, ErrorCodes.INTERNAL_ERROR));
  }
};

/**
 * Update a discussion
 */
export const updateDiscussion = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;

    if (!userId) {
      return next(new AppError('User not authenticated', 401, ErrorCodes.UNAUTHORIZED));
    }

    // Check if the user is the creator of the discussion
    const discussion = await discussionService.getDiscussionById(id);
    if (!discussion) {
      return next(new AppError('Discussion not found', 404, ErrorCodes.NOT_FOUND));
    }

    if (discussion.creator.toString() !== userId.toString()) {
      return next(new AppError('You are not authorized to update this discussion', 403, ErrorCodes.FORBIDDEN));
    }

    const updatedDiscussion = await discussionService.updateDiscussion(id, req.body);
    res.success(updatedDiscussion, 'Discussion updated successfully');
  } catch (error) {
    next(new AppError(error instanceof Error ? error.message : 'An unknown error occurred', 500, ErrorCodes.INTERNAL_ERROR));
  }
};

/**
 * Delete a discussion
 */
export const deleteDiscussion = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;

    if (!userId) {
      return next(new AppError('User not authenticated', 401, ErrorCodes.UNAUTHORIZED));
    }

    // Check if the user is the creator of the discussion or has admin rights
    const discussion = await discussionService.getDiscussionById(id);
    if (!discussion) {
      return next(new AppError('Discussion not found', 404, ErrorCodes.NOT_FOUND));
    }

    const isCreator = discussion.creator._id.toString() === userId.toString();
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'superadmin';

    if (!isCreator && !isAdmin) {
      return next(new AppError('You are not authorized to delete this discussion', 403, ErrorCodes.FORBIDDEN));
    }

    await discussionService.deleteDiscussion(id);
    res.success(null, 'Discussion deleted successfully');
  } catch (error) {
    next(new AppError(error instanceof Error ? error.message : 'An unknown error occurred', 500, ErrorCodes.INTERNAL_ERROR));
  }
};

/**
 * Bulk delete discussions
 */
export const bulkDeleteDiscussions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { discussionIds } = req.body;
    const deletedCount = await discussionService.bulkDeleteDiscussions(discussionIds);
    res.success({ deletedCount }, `${deletedCount} discussions deleted successfully`);
  } catch (error) {
    next(new AppError(error instanceof Error ? error.message : 'An unknown error occurred', 500, ErrorCodes.INTERNAL_ERROR));
  }
};

/**
 * Vote on a discussion
 */
export const voteDiscussion = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { voteType } = req.body;
    const userId = req.user?._id;

    if (!userId) {
      return next(new AppError('User not authenticated', 401, ErrorCodes.UNAUTHORIZED));
    }

    const updatedDiscussion = await discussionService.voteDiscussion(id, userId.toString(), voteType);
    if (!updatedDiscussion) {
      return next(new AppError('Discussion not found', 404, ErrorCodes.NOT_FOUND));
    }
    res.success(updatedDiscussion, 'Vote recorded successfully');
  } catch (error) {
    next(new AppError(error instanceof Error ? error.message : 'An unknown error occurred', 500, ErrorCodes.INTERNAL_ERROR));
  }
};

/**
 * Report a discussion
 */
export const reportDiscussion = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user?._id;

    if (!userId) {
      return next(new AppError('User not authenticated', 401, ErrorCodes.UNAUTHORIZED));
    }

    const discussion = await discussionService.getDiscussionById(id);
    if (!discussion) {
      return next(new AppError('Discussion not found', 404, ErrorCodes.NOT_FOUND));
    }

    const mongooseUserId = new Types.ObjectId(userId as string);
    await discussion.report(mongooseUserId, reason);

    res.success(null, 'Discussion reported successfully');
  } catch (error) {
    next(new AppError(error instanceof Error ? error.message : 'Failed to report discussion', 500, ErrorCodes.INTERNAL_ERROR));
  }
};

/**
 * Pin or unpin a discussion
 */
export const togglePinDiscussion = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { pinned } = req.body;
    const userId = req.user?._id;

    if (!userId) {
      return next(new AppError('User not authenticated', 401, ErrorCodes.UNAUTHORIZED));
    }

    // Only admins or superadmins can pin discussions
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'superadmin';

    if (!isAdmin) {
      return next(new AppError('You are not authorized to pin discussions', 403, ErrorCodes.FORBIDDEN));
    }

    const discussion = await discussionService.pinDiscussion(id, pinned);
    if (!discussion) {
      return next(new AppError('Discussion not found', 404, ErrorCodes.NOT_FOUND));
    }

    const message = pinned ? 'Discussion pinned successfully' : 'Discussion unpinned successfully';
    res.success(discussion, message);
  } catch (error) {
    next(new AppError(error instanceof Error ? error.message : 'An unknown error occurred', 500, ErrorCodes.INTERNAL_ERROR));
  }
};

/**
 * Get replies for a discussion
 */
export const getDiscussionReplies = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const result = await discussionService.getDiscussionReplies(
      id,
      Number(page),
      Number(limit)
    );

    if (!result) {
      return next(new AppError('Discussion not found', 404, ErrorCodes.NOT_FOUND));
    }

    res.success({
      replies: result.replies,
      pagination: result.pagination
    }, 'Replies retrieved successfully');
  } catch (error) {
    next(new AppError(error instanceof Error ? error.message : 'An unknown error occurred', 500, ErrorCodes.INTERNAL_ERROR));
  }
};

/**
 * Get trending discussions
 */
export const getTrendingDiscussions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { communityId, limit = 5 } = req.query;

    const discussions = await discussionService.getTrendingDiscussions(
      communityId as string,
      Number(limit)
    );

    res.success({ discussions }, 'Trending discussions retrieved successfully');
  } catch (error) {
    next(new AppError(error instanceof Error ? error.message : 'An unknown error occurred', 500, ErrorCodes.INTERNAL_ERROR));
  }
};

/**
 * @description Edit a reply
 * @route PATCH /v1/discussions/:discussionId/replies/:replyId
 */
export const editReply = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id, replyId } = req.params;
    const { content } = req.body;
    const userId = req.user?._id;

    if (!content) {
      return next(new AppError('Content is required', 400, ErrorCodes.VALIDATION_ERROR));
    }

    if (!userId) {
      return next(new AppError('User not found', 401, ErrorCodes.UNAUTHORIZED));
    }

    const discussion = await discussionService.editReply(id, replyId, userId, content);
    res.success(discussion, 'Reply updated successfully');
  } catch (error) {
    next(new AppError(error instanceof Error ? error.message : 'An unknown error occurred', 500, ErrorCodes.INTERNAL_ERROR));
  }
};

/**
 * @description Delete a reply
 * @route DELETE /v1/discussions/:discussionId/replies/:replyId
 */
export const deleteReply = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id, replyId } = req.params;
    const userId = req.user?._id;

    if (!userId) {
      return next(new AppError('User not found', 401, ErrorCodes.UNAUTHORIZED));
    }

    const discussion = await discussionService.deleteReply(id, replyId, userId);
    res.success(discussion, 'Reply deleted successfully');
  } catch (error) {
    next(new AppError(error instanceof Error ? error.message : 'An unknown error occurred', 500, ErrorCodes.INTERNAL_ERROR));
  }
};
