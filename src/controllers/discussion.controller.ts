import { Request, Response, NextFunction } from 'express';
import { DiscussionService } from '../services/discussion.service';
import { Types } from 'mongoose';
import { AppError, ErrorCodes } from '@utils/appError';

const discussionService = new DiscussionService();

/**
 * Create a new discussion
 */
export const createDiscussion = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return next(new AppError('User not authenticated', 401, ErrorCodes.UNAUTHORIZED));
    }
    
    const discussionData = {
      ...req.body,
      creator: userId
    };
    
    const discussion = await discussionService.createDiscussion(discussionData);
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
    const discussion = await discussionService.getDiscussionById(req.params.id);
    if (!discussion) {
      return next(new AppError('Discussion not found', 404, ErrorCodes.NOT_FOUND));
    }
    res.success(discussion, 'Discussion retrieved successfully');
  } catch (error) {
    next(new AppError(error instanceof Error ? error.message : 'An unknown error occurred', 500, ErrorCodes.INTERNAL_ERROR));
  }
};

/**
 * Add reply to a discussion
 */
export const addReply = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;
    
    if (!userId) {
      return next(new AppError('User not authenticated', 401, ErrorCodes.UNAUTHORIZED));
    }
    
    const replyData = {
      ...req.body,
      creator: userId
    };
    
    const discussion = await discussionService.addReply(id, replyData);
    if (!discussion) {
      return next(new AppError('Discussion not found', 404, ErrorCodes.NOT_FOUND));
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
      search
    } = req.query;
    
    const result = await discussionService.getAllDiscussions({
      page: Number(page),
      limit: Number(limit),
      communityId: communityId as string,
      sortBy: sortBy as string,
      sortOrder: sortOrder as 'asc' | 'desc',
      search: search as string
    });
    
    res.success({
      discussions: result.discussions,
      pagination: result.pagination
    }, 'Discussions retrieved successfully');
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
    
    const isCreator = discussion.creator.toString() === userId.toString();
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
    
    // Check if discussion exists
    const discussion = await discussionService.getDiscussionById(id);
    if (!discussion) {
      return next(new AppError('Discussion not found', 404, ErrorCodes.NOT_FOUND));
    }
    
    // Add vote
    const updatedDiscussion = await discussionService.voteDiscussion(id, userId, voteType);
    res.success(updatedDiscussion, 'Vote recorded successfully');
  } catch (error) {
    next(new AppError(error instanceof Error ? error.message : 'An unknown error occurred', 500, ErrorCodes.INTERNAL_ERROR));
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
    
    const discussion = await discussionService.togglePinDiscussion(id, pinned);
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
