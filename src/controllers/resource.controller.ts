import { Request, Response, NextFunction } from 'express';
import Resource from '@models/Resource';
import { Types } from 'mongoose';
import { IVote } from '@models/types';
import { AppError, ErrorCodes } from '@utils/appError';
import { UploadService } from '@utils/uploadService';
import User from '@models/User';
import { generateResourceRecommendations } from '@utils/recommendationUtils';
import {
  NotFoundError,
  ValidationError,
  AuthorizationError,
} from '../utils/errors';
import { ResourceService } from '../services/resource.service';
import notificationService from '../services/notification.service';

const resourceService = new ResourceService();


/**
 * Get all resources with pagination, filtering and sorting
 */
export const getAllResources = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      visibility,
      tags,
      communityId,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search,
      populateCommentUser,
      currVoteSpecified,
    } = req.query;
    const userId = req.user?._id;

    // Build filter
    const filter: any = {};
    if (category) filter.category = category;
    if (visibility) filter.visibility = visibility;
    if (communityId) filter.community = communityId;

    // Handle tag filtering
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : [tags];
      filter.tags = { $in: tagArray };
    }

    // Handle text search
    if (search) {
      filter.$text = { $search: search as string };
    }

    // Build sort
    const sort: any = {};
    sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

    // Calculate pagination
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build population options
    const populationOptions: any[] = [
      { path: 'uploader', select: 'name profilePicture' },
      { path: 'community', select: 'name' },
    ];

    if (populateCommentUser === 'true') {
      populationOptions.push({
        path: 'comments',
        populate: {
          path: 'userId',
          select: 'name profilePicture',
        },
      });
    }

    // Execute query with pagination
    const resources = await Resource.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .populate(populationOptions);

    // Get total count for pagination
    const total = await Resource.countDocuments(filter);

    // Get all available categories for filtering
    const categories = await Resource.distinct('category');

    // Add currentVote if specified
    let resourcesWithVote: any[] = resources;
    if (currVoteSpecified === 'true' && userId) {
      resourcesWithVote = resources.map(resource => {
        const resourceObj = resource.toObject();
        const vote = resourceObj.votes.find((v: IVote) => v.userId.equals(userId));
        const currentVote = vote ? (vote.voteType === 'upvote' ? 1 : -1) : 0;
        return { ...resourceObj, currentVote };
      });
    }

    res.success({
      resources: resourcesWithVote,
      categories,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(
      new AppError(
        error instanceof Error ? error.message : 'Failed to fetch resources',
        500,
        ErrorCodes.INTERNAL_ERROR
      )
    );
  }
};

/**
 * Get resource by ID
 */
export const getResourceById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { populateCommentUser, currVoteSpecified } = req.query;
    const userId = req.user?._id;

    if (!Types.ObjectId.isValid(id)) {
      throw new ValidationError('Invalid resource ID');
    }

    const populationOptions: any[] = [
      { path: 'uploader', select: 'name profilePicture' },
      { path: 'community', select: 'name' },
    ];

    if (populateCommentUser === 'true') {
      populationOptions.push({
        path: 'comments',
        populate: {
          path: 'userId',
          select: 'name profilePicture',
        },
      });
    }

    const resource = await Resource.findById(id).populate(populationOptions);

    if (!resource) {
      throw new NotFoundError('Resource not found');
    }

    if (currVoteSpecified === 'true' && userId) {
      const resourceObj = resource.toObject();
      const vote = resourceObj.votes.find((v: IVote) => v.userId.equals(userId));
      const currentVote = vote ? (vote.voteType === 'upvote' ? 1 : -1) : 0;
      res.success({ resource: { ...resourceObj, currentVote } });
    } else {
      res.success({ resource });
    }
  } catch (_error) {
    next(
      new AppError('Failed to fetch resource', 500, ErrorCodes.INTERNAL_ERROR)
    );
  }
};

/**
 * Create a new resource
 */
export const createResource = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { title, description, tags, visibility, category, community } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      throw new AuthorizationError('User not authenticated');
    }

    if (!req.file) {
      throw new AppError('Resource file is required.', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Infer fileType from mimetype
    let fileType = 'other';
    if (req.file.mimetype.startsWith('image/')) {
      fileType = 'image';
    } else if (req.file.mimetype.startsWith('video/')) {
      fileType = 'video';
    } else if (req.file.mimetype.startsWith('audio/')) {
      fileType = 'audio';
    } else if (req.file.mimetype === 'application/pdf') {
      fileType = 'document';
    } else if (
      req.file.mimetype === 'application/msword' ||
      req.file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      req.file.mimetype === 'application/vnd.oasis.opendocument.text' ||
      req.file.mimetype.startsWith('text/')
    ) {
      fileType = 'document';
    }

    const resourceData = {
      title,
      description,
      fileUrl: req.file.path,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      checksum: req.file.filename, // Cloudinary public_id
      originalFileName: req.file.originalname,
      fileType: fileType,
      tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map((tag: string) => tag.trim())) : [],
      visibility,
      category,
      uploader: new Types.ObjectId(userId),
      community: community ? new Types.ObjectId(community) : undefined,
    };

    // Create resource
    const resource = await Resource.create(resourceData);

    // Create notification for resource creator
    await notificationService.createNotification(
      new Types.ObjectId(userId),
      'resource_created',
      `You shared a new resource: ${title}`,
      {
        action: 'created',
        timestamp: new Date()
      }
    );

    // Notify all users about the new resource
    const allUsers = await User.find().select('_id');
    for (const user of allUsers) {
      // Skip notification for the resource creator since they already got one
      if (user._id.toString() !== userId) {
        await notificationService.createNotification(
          user._id,
          'new_resource_shared',
          `New ${category} resource shared: ${title}`,
          {
            action: 'created',
            timestamp: new Date()
          }
        );
      }
    }

    res.success({ resource }, 'Resource created successfully', 201);
  } catch (error) {
    console.error('Error creating resource:', error);
    if (error instanceof AppError) {
      return next(error);
    }
    next(
      new AppError(
        error instanceof Error ? error.message : 'Failed to create resource',
        500,
        ErrorCodes.INTERNAL_ERROR
      )
    );
  }
};

/**
 * Update a resource
 */
export const updateResource = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { title, description, tags, visibility, category, community } =
      req.body;
    const userId = req.user?.id;

    if (!userId) {
      throw new AuthorizationError('User not authenticated');
    }

    if (!Types.ObjectId.isValid(id)) {
      throw new ValidationError('Invalid resource ID');
    }

    // Find resource and check permissions
    const resource = await Resource.findById(id);

    if (!resource) {
      throw new NotFoundError('Resource not found');
    }

    // Check if user is uploader or admin
    const isUploader = resource.uploader.toString() === userId.toString();
    const isAdmin =
      req.user?.role === 'admin' || req.user?.role === 'superadmin';

    if (!isUploader && !isAdmin) {
      throw new AuthorizationError('Not authorized to update this resource');
    }

    const updateData: any = {};
    let oldFilePublicId: string | undefined = undefined;

    // Handle new file upload
    if (req.file) {
      if (resource.checksum) {
        oldFilePublicId = resource.checksum;
      }
      updateData.fileUrl = req.file.path;
      updateData.fileSize = req.file.size;
      updateData.mimeType = req.file.mimetype;
      updateData.checksum = req.file.filename;
      updateData.originalFileName = req.file.originalname;

      // Infer fileType from mimetype
      let fileType = 'other';
      if (req.file.mimetype.startsWith('image/')) {
        fileType = 'image';
      } else if (req.file.mimetype.startsWith('video/')) {
        fileType = 'video';
      } else if (req.file.mimetype.startsWith('audio/')) {
        fileType = 'audio';
      } else if (req.file.mimetype === 'application/pdf') {
        fileType = 'document';
      } else if (
        req.file.mimetype === 'application/msword' ||
        req.file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        req.file.mimetype === 'application/vnd.oasis.opendocument.text' ||
        req.file.mimetype.startsWith('text/')
      ) {
        fileType = 'document';
      }
      updateData.fileType = fileType;
    }

    // Handle metadata updates from req.body
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (visibility !== undefined) updateData.visibility = visibility;
    if (category !== undefined) updateData.category = category;
    if (community !== undefined) updateData.community = community;

    // Process tags if provided
    if (tags) {
      updateData.tags = Array.isArray(tags)
        ? tags
        : tags.split(',').map((tag: string) => tag.trim());
    } else if (req.body.hasOwnProperty('tags') && tags === null) {
      updateData.tags = [];
    }

    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      res.success({ resource }, 'No changes detected. Resource not updated.');
      return;
    }

    // Update resource
    const updatedResource = await Resource.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ) as NonNullable<typeof resource>;

    // Create notification for resource update
    await notificationService.createNotification(
      new Types.ObjectId(userId),
      'resource_updated',
      `You updated the resource: ${updatedResource.title}`,
      {
        action: 'updated',
        timestamp: new Date()
      }
    );

    // If a new file was uploaded and an old file existed, try to delete the old file from Cloudinary
    if (req.file && oldFilePublicId && oldFilePublicId !== req.file.filename) {
      try {
        console.log(`Attempting to delete old resource file from Cloudinary: ${oldFilePublicId}`);
        await UploadService.deleteFromCloudinary(oldFilePublicId);
        console.log(`Successfully deleted old resource file: ${oldFilePublicId}`);
      } catch (cloudinaryError) {
        console.error(
          `Failed to delete old resource file ${oldFilePublicId} from Cloudinary:`,
          cloudinaryError
        );
      }
    }

    res.success({ resource: updatedResource }, 'Resource updated successfully');
  } catch (_error) {
    next(
      new AppError('Failed to update resource', 500, ErrorCodes.INTERNAL_ERROR)
    );
  }
};

/**
 * Delete a resource
 */
export const deleteResource = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      throw new AuthorizationError('User not authenticated');
    }

    if (!Types.ObjectId.isValid(id)) {
      throw new ValidationError('Invalid resource ID');
    }

    // Find resource and check permissions
    const resource = await Resource.findById(id);

    if (!resource) {
      throw new NotFoundError('Resource not found');
    }

    // Check if user is uploader or admin
    const isUploader = resource.uploader.toString() === userId.toString();
    const isAdmin =
      req.user?.role === 'admin' || req.user?.role === 'superadmin';

    if (!isUploader && !isAdmin) {
      throw new AuthorizationError('Not authorized to delete this resource');
    }

    // Delete file from storage if it exists
    if (resource.fileUrl) {
      try {
        await UploadService.deleteFile(resource.fileUrl);
      } catch (error) {
        console.error('Error deleting file:', error);
        // Continue with resource deletion even if file deletion fails
      }
    }

    // Delete resource
    await Resource.findByIdAndDelete(id);

    res.success(null, 'Resource deleted successfully');
  } catch (_error) {
    next(
      new AppError('Failed to delete resource', 500, ErrorCodes.INTERNAL_ERROR)
    );
  }
};

/**
 * Get resource metrics and stats for dashboard
 */
export const getResourceMetrics = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Get total resources count
    const totalResources = await Resource.countDocuments();

    // Get resources by category
    const resourcesByCategory = await Resource.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Get top downloaded resources
    const topDownloaded = await Resource.find()
      .sort({ 'interactionStats.downloads': -1 })
      .limit(5)
      .select('title interactionStats.downloads')
      .lean();

    // Get resources created per month (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const resourcesPerMonth = await Resource.aggregate([
      {
        $match: {
          createdAt: { $gte: sixMonthsAgo },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    // Format resources per month for chart display
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const formattedResourcesPerMonth = resourcesPerMonth.map((item) => ({
      month: `${monthNames[item._id.month - 1]} ${item._id.year}`,
      count: item.count,
    }));

    // Get resources by visibility
    const resourcesByVisibility = await Resource.aggregate([
      { $group: { _id: '$visibility', count: { $sum: 1 } } },
    ]);

    // Get recent resources
    const recentResources = await Resource.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('uploader', 'name')
      .select('title uploader createdAt')
      .lean();

    res.success({
      totalResources,
      resourcesByCategory,
      topDownloaded,
      resourcesPerMonth: formattedResourcesPerMonth,
      resourcesByVisibility,
      recentResources,
    });
  } catch (_error) {
    next(
      new AppError(
        'Failed to fetch resource metrics',
        500,
        ErrorCodes.INTERNAL_ERROR
      )
    );
  }
};

/**
 * Vote on a resource
 */
export const voteResource = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { voteType } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      throw new AuthorizationError('User not authenticated');
    }

    if (!Types.ObjectId.isValid(id)) {
      throw new ValidationError('Invalid resource ID');
    }

    const resource = await Resource.findById(id);

    if (!resource) {
      throw new NotFoundError('Resource not found');
    }

    await resource.vote(new Types.ObjectId(userId), voteType);

    // Create notification for resource vote
    await notificationService.createNotification(
      resource.uploader,
      'resource_voted',
      `Someone ${voteType}ed your resource: ${resource.title}`,
      {
        action: 'voted',
        timestamp: new Date()
      }
    );

    res.success(
      {
        upvotes: resource.upvotesCount,
        downvotes: resource.downvotesCount,
      },
      'Resource voted successfully'
    );
  } catch (error) {
    next(
      new AppError(
        error instanceof Error ? error.message : 'Failed to vote on resource',
        500,
        ErrorCodes.INTERNAL_ERROR
      )
    );
  }
};

/**
 * Report a resource
 */
export const reportResource = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      throw new AuthorizationError('User not authenticated');
    }

    if (!Types.ObjectId.isValid(id)) {
      throw new ValidationError('Invalid resource ID');
    }

    const resource = await Resource.findById(id);

    if (!resource) {
      throw new NotFoundError('Resource not found');
    }

    await resource.report(new Types.ObjectId(userId), reason);

    // Notify admins about reported resource
    const admins = await User.find({ role: { $in: ['admin', 'superadmin'] } });
    for (const admin of admins) {
      await notificationService.createNotification(
        admin._id,
        'resource_reported',
        `Resource "${resource.title}" has been reported`,
        {
          action: 'reported',
          timestamp: new Date()
        }
      );
    }

    res.success(null, 'Resource reported successfully');
  } catch (error) {
    next(
      new AppError(
        error instanceof Error ? error.message : 'Failed to report resource',
        500,
        ErrorCodes.INTERNAL_ERROR
      )
    );
  }
};

/**
 * Add a comment to a resource
 */
export const commentResource = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      throw new AuthorizationError('User not authenticated');
    }

    if (!Types.ObjectId.isValid(id)) {
      throw new ValidationError('Invalid resource ID');
    }

    // Find resource
    const resource = await Resource.findById(id);

    if (!resource) {
      throw new NotFoundError('Resource not found');
    }

    // Add comment
    await resource.addComment(new Types.ObjectId(userId), content);

    // Create notification for new comment
    await notificationService.createNotification(
      resource.uploader,
      'resource_commented',
      `Someone commented on your resource: ${resource.title}`,
      {
        action: 'commented',
        timestamp: new Date()
      }
    );

    res.success(
      { message: 'Comment added successfully' },
      'Comment added successfully'
    );
  } catch (_error) {
    next(new AppError('Failed to add comment', 500, ErrorCodes.INTERNAL_ERROR));
  }
};

/**
 * Get comments for a resource
 */
export const getResourceComments = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10, sortOrder = 'desc' } = req.query;

    if (!Types.ObjectId.isValid(id)) {
      throw new ValidationError('Invalid resource ID');
    }

    // Find resource
    const resource = await Resource.findById(id);

    if (!resource) {
      throw new NotFoundError('Resource not found');
    }

    // Get comments with pagination
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Sort comments
    const sortedComments = [...resource.comments].sort((a, b) => {
      if (sortOrder === 'desc') {
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    // Apply pagination
    const paginatedComments = sortedComments.slice(skip, skip + limitNum);

    // Get user details for comments
    const userIds = paginatedComments.map((comment) => comment.userId);
    const users = await User.find({ _id: { $in: userIds } }).select(
      'name profilePicture'
    );

    // Map user details to comments
    const commentsWithUserDetails = paginatedComments.map((comment) => {
      const user = users.find(
        (u) => u._id.toString() === comment.userId.toString()
      );
      // Convert comment to plain object
      const commentObj = {
        userId: comment.userId,
        content: comment.content,
        createdAt: comment.createdAt,
      };
      return {
        ...commentObj,
        user: {
          _id: user?._id,
          name: user?.name,
          profilePicture: user?.profilePicture,
        },
      };
    });

    res.success({
      comments: commentsWithUserDetails,
      pagination: {
        total: resource.comments.length,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(resource.comments.length / limitNum),
      },
    });
  } catch (_error) {
    next(
      new AppError('Failed to get comments', 500, ErrorCodes.INTERNAL_ERROR)
    );
  }
};

/**
 * @description Edit a comment on a resource
 * @route PATCH /v1/resources/:id/comments/:commentId
 */
export const editComment = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id, commentId } = req.params;
    const { content } = req.body;
    const userId = req.user?._id;

    if (!userId) {
      throw new AuthorizationError('User not authenticated');
    }

    if (!content) {
      throw new ValidationError('Content is required');
    }

    const resource = await resourceService.editComment(
      id,
      commentId,
      userId,
      content
    );
    res.success(resource, 'Comment updated successfully');
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
    next(
      new AppError(
        error instanceof Error ? error.message : 'Failed to edit comment',
        500,
        ErrorCodes.INTERNAL_ERROR
      )
    );
  }
};

/**
 * @description Delete a comment on a resource
 * @route DELETE /v1/resources/:id/comments/:commentId
 */
export const deleteComment = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id, commentId } = req.params;
    const userId = req.user?._id;

    if (!userId) {
      throw new AuthorizationError('User not authenticated');
    }

    const resource = await resourceService.deleteComment(id, commentId, userId);
    res.success(resource, 'Comment deleted successfully');
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
    next(
      new AppError(
        error instanceof Error ? error.message : 'Failed to delete comment',
        500,
        ErrorCodes.INTERNAL_ERROR
      )
    );
  }
};

/**
 * Track resource download
 */
export const trackDownload = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      throw new AuthorizationError('User not authenticated');
    }

    if (!Types.ObjectId.isValid(id)) {
      throw new ValidationError('Invalid resource ID');
    }

    // Find resource
    const resource = await Resource.findById(id);

    if (!resource) {
      throw new NotFoundError('Resource not found');
    }

    // Increment download count
    await resource.incrementDownloads();

    // Create notification for resource download
    await notificationService.createNotification(
      resource.uploader,
      'resource_downloaded',
      `Someone downloaded your resource: ${resource.title}`,
      {
        action: 'downloaded',
        timestamp: new Date()
      }
    );

    res.success(
      { downloads: resource.interactionStats.downloads },
      'Download tracked successfully'
    );
  } catch (_error) {
    next(
      new AppError('Failed to track download', 500, ErrorCodes.INTERNAL_ERROR)
    );
  }
};

/**
 * Track resource view
 */
export const trackView = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      throw new AuthorizationError('User not authenticated');
    }

    if (!Types.ObjectId.isValid(id)) {
      throw new ValidationError('Invalid resource ID');
    }

    // Find the resource
    const resource = await Resource.findById(id);
    if (!resource) {
      throw new NotFoundError('Resource not found');
    }

    // Update view count
    await resource.incrementViews();

    res.success(null, 'Resource view tracked successfully');
  } catch (error) {
    next(
      new AppError(
        error instanceof Error ? error.message : 'An unknown error occurred',
        500,
        ErrorCodes.INTERNAL_ERROR
      )
    );
  }
};

/**
 * Get recommended resources for the current user
 */
export const getRecommendedResources = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AuthorizationError('User not authenticated');
    }

    const { limit = 5 } = req.query;
    const limitNum = parseInt(limit as string, 10);

    // Generate recommendations
    const recommendations = await generateResourceRecommendations(
      userId.toString(),
      limitNum
    );

    res.success(
      {
        recommendations,
        count: recommendations.length,
      },
      'Resource recommendations generated successfully'
    );
  } catch (error) {
    next(
      new AppError(
        error instanceof Error
          ? error.message
          : 'Failed to generate resource recommendations',
        500,
        ErrorCodes.INTERNAL_ERROR
      )
    );
  }
};
