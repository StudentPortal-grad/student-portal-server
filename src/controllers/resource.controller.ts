import { Request, Response, NextFunction } from 'express';
import Resource from '@models/Resource';
import { Types } from 'mongoose';
import { AppError, ErrorCodes } from '@utils/appError';
import { UploadService } from '@utils/uploadService';
import User from '@models/User';
import { generateResourceRecommendations } from '@utils/recommendationUtils';

/**
 * Get all resources with pagination, filtering and sorting
 */
export const getAllResources = async (req: Request, res: Response, next: NextFunction) => {
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
      search
    } = req.query;

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

    // Execute query with pagination
    const resources = await Resource.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .populate('uploader', 'name profilePicture')
      .populate('community', 'name');

    // Get total count for pagination
    const total = await Resource.countDocuments(filter);

    // Get all available categories for filtering
    const categories = await Resource.distinct('category');

    res.success({
      resources,
      categories,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    next(new AppError('Failed to fetch resources', 500, ErrorCodes.INTERNAL_ERROR));
  }
};

/**
 * Get resource by ID
 */
export const getResourceById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      return next(new AppError('Invalid resource ID', 400, ErrorCodes.VALIDATION_ERROR));
    }

    const resource = await Resource.findById(id)
      .populate('uploader', 'name profilePicture')
      .populate('community', 'name');

    if (!resource) {
      return next(new AppError('Resource not found', 404, ErrorCodes.NOT_FOUND));
    }

    res.success({ resource });
  } catch (error) {
    next(new AppError('Failed to fetch resource', 500, ErrorCodes.INTERNAL_ERROR));
  }
};

/**
 * Create a new resource
 */
export const createResource = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, description, fileUrl, fileSize, tags, visibility, category, community } = req.body;
    const uploader = req.user?._id;

    if (!uploader) {
      return next(new AppError('User not authenticated', 401, ErrorCodes.UNAUTHORIZED));
    }

    // Create resource
    const resource = await Resource.create({
      title,
      description,
      fileUrl,
      fileSize,
      tags: tags ? tags.split(',').map((tag: string) => tag.trim()) : [],
      visibility,
      category,
      uploader,
      community
    });

    res.success({ resource }, 'Resource created successfully', 201);
  } catch (error) {
    next(new AppError('Failed to create resource', 500, ErrorCodes.INTERNAL_ERROR));
  }
};

/**
 * Update a resource
 */
export const updateResource = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { title, description, tags, visibility, category, community } = req.body;
    const userId = req.user?._id;

    if (!userId) {
      return next(new AppError('User not authenticated', 401, ErrorCodes.UNAUTHORIZED));
    }

    if (!Types.ObjectId.isValid(id)) {
      return next(new AppError('Invalid resource ID', 400, ErrorCodes.VALIDATION_ERROR));
    }

    // Find resource and check permissions
    const resource = await Resource.findById(id);

    if (!resource) {
      return next(new AppError('Resource not found', 404, ErrorCodes.NOT_FOUND));
    }

    // Check if user is uploader or admin
    const isUploader = resource.uploader.toString() === userId.toString();
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'superadmin';

    if (!isUploader && !isAdmin) {
      return next(new AppError('Not authorized to update this resource', 403, ErrorCodes.FORBIDDEN));
    }

    // Process tags if provided
    let processedTags;
    if (tags) {
      processedTags = Array.isArray(tags) ? tags : tags.split(',').map((tag: string) => tag.trim());
    }

    // Update resource
    const updatedResource = await Resource.findByIdAndUpdate(
      id,
      {
        title,
        description,
        tags: processedTags,
        visibility,
        category,
        community
      },
      { new: true, runValidators: true }
    );

    res.success({ resource: updatedResource }, 'Resource updated successfully');
  } catch (error) {
    next(new AppError('Failed to update resource', 500, ErrorCodes.INTERNAL_ERROR));
  }
};

/**
 * Delete a resource
 */
export const deleteResource = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;

    if (!userId) {
      return next(new AppError('User not authenticated', 401, ErrorCodes.UNAUTHORIZED));
    }

    if (!Types.ObjectId.isValid(id)) {
      return next(new AppError('Invalid resource ID', 400, ErrorCodes.VALIDATION_ERROR));
    }

    // Find resource and check permissions
    const resource = await Resource.findById(id);

    if (!resource) {
      return next(new AppError('Resource not found', 404, ErrorCodes.NOT_FOUND));
    }

    // Check if user is uploader or admin
    const isUploader = resource.uploader.toString() === userId.toString();
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'superadmin';

    if (!isUploader && !isAdmin) {
      return next(new AppError('Not authorized to delete this resource', 403, ErrorCodes.FORBIDDEN));
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
  } catch (error) {
    next(new AppError('Failed to delete resource', 500, ErrorCodes.INTERNAL_ERROR));
  }
};

/**
 * Get resource metrics and stats for dashboard
 */
export const getResourceMetrics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get total resources count
    const totalResources = await Resource.countDocuments();

    // Get resources by category
    const resourcesByCategory = await Resource.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
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
          createdAt: { $gte: sixMonthsAgo } 
        } 
      },
      {
        $group: {
          _id: { 
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Format resources per month for chart display
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const formattedResourcesPerMonth = resourcesPerMonth.map(item => ({
      month: `${monthNames[item._id.month - 1]} ${item._id.year}`,
      count: item.count
    }));

    // Get resources by visibility
    const resourcesByVisibility = await Resource.aggregate([
      { $group: { _id: '$visibility', count: { $sum: 1 } } }
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
      recentResources
    });
  } catch (error) {
    next(new AppError('Failed to fetch resource metrics', 500, ErrorCodes.INTERNAL_ERROR));
  }
};

/**
 * Rate a resource
 */
export const rateResource = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { rating } = req.body;
    const userId = req.user?._id;

    if (!userId) {
      return next(new AppError('User not authenticated', 401, ErrorCodes.UNAUTHORIZED));
    }

    if (!Types.ObjectId.isValid(id)) {
      return next(new AppError('Invalid resource ID', 400, ErrorCodes.VALIDATION_ERROR));
    }

    // Find resource
    const resource = await Resource.findById(id);

    if (!resource) {
      return next(new AppError('Resource not found', 404, ErrorCodes.NOT_FOUND));
    }

    // Add rating
    await resource.addRating(userId, rating);
    
    // Get updated average rating
    const averageRating = resource.getAverageRating();

    res.success({ averageRating }, 'Resource rated successfully');
  } catch (error) {
    next(new AppError('Failed to rate resource', 500, ErrorCodes.INTERNAL_ERROR));
  }
};

/**
 * Add a comment to a resource
 */
export const commentResource = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user?._id;

    if (!userId) {
      return next(new AppError('User not authenticated', 401, ErrorCodes.UNAUTHORIZED));
    }

    if (!Types.ObjectId.isValid(id)) {
      return next(new AppError('Invalid resource ID', 400, ErrorCodes.VALIDATION_ERROR));
    }

    // Find resource
    const resource = await Resource.findById(id);

    if (!resource) {
      return next(new AppError('Resource not found', 404, ErrorCodes.NOT_FOUND));
    }

    // Add comment
    await resource.addComment(userId, content);

    res.success({ message: 'Comment added successfully' }, 'Comment added successfully');
  } catch (error) {
    next(new AppError('Failed to add comment', 500, ErrorCodes.INTERNAL_ERROR));
  }
};

/**
 * Get comments for a resource
 */
export const getResourceComments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10, sortOrder = 'desc' } = req.query;

    if (!Types.ObjectId.isValid(id)) {
      return next(new AppError('Invalid resource ID', 400, ErrorCodes.VALIDATION_ERROR));
    }

    // Find resource
    const resource = await Resource.findById(id);

    if (!resource) {
      return next(new AppError('Resource not found', 404, ErrorCodes.NOT_FOUND));
    }

    // Get comments with pagination
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Sort comments
    const sortedComments = [...resource.comments].sort((a, b) => {
      if (sortOrder === 'desc') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    // Apply pagination
    const paginatedComments = sortedComments.slice(skip, skip + limitNum);

    // Get user details for comments
    const userIds = paginatedComments.map(comment => comment.userId);
    const users = await User.find({ _id: { $in: userIds } }).select('name profilePicture');

    // Map user details to comments
    const commentsWithUserDetails = paginatedComments.map(comment => {
      const user = users.find(u => u._id.toString() === comment.userId.toString());
      // Convert comment to plain object
      const commentObj = {
        userId: comment.userId,
        content: comment.content,
        createdAt: comment.createdAt
      };
      return {
        ...commentObj,
        user: {
          _id: user?._id,
          name: user?.name,
          profilePicture: user?.profilePicture
        }
      };
    });

    res.success({
      comments: commentsWithUserDetails,
      pagination: {
        total: resource.comments.length,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(resource.comments.length / limitNum)
      }
    });
  } catch (error) {
    next(new AppError('Failed to get comments', 500, ErrorCodes.INTERNAL_ERROR));
  }
};

/**
 * Track resource download
 */
export const trackDownload = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;

    if (!userId) {
      return next(new AppError('User not authenticated', 401, ErrorCodes.UNAUTHORIZED));
    }

    if (!Types.ObjectId.isValid(id)) {
      return next(new AppError('Invalid resource ID', 400, ErrorCodes.VALIDATION_ERROR));
    }

    // Find resource
    const resource = await Resource.findById(id);

    if (!resource) {
      return next(new AppError('Resource not found', 404, ErrorCodes.NOT_FOUND));
    }

    // Increment download count
    await resource.incrementDownloads();

    res.success({ downloads: resource.interactionStats.downloads }, 'Download tracked successfully');
  } catch (error) {
    next(new AppError('Failed to track download', 500, ErrorCodes.INTERNAL_ERROR));
  }
};

/**
 * Track resource view
 */
export const trackView = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;

    if (!userId) {
      return next(new AppError('User not authenticated', 401, ErrorCodes.UNAUTHORIZED));
    }

    if (!Types.ObjectId.isValid(id)) {
      return next(new AppError('Invalid resource ID', 400, ErrorCodes.VALIDATION_ERROR));
    }

    // Find the resource
    const resource = await Resource.findById(id);
    if (!resource) {
      return next(new AppError('Resource not found', 404, ErrorCodes.NOT_FOUND));
    }

    // Update view count
    await resource.incrementViews();

    res.success(null, 'Resource view tracked successfully');
  } catch (error) {
    next(new AppError(error instanceof Error ? error.message : 'An unknown error occurred', 500, ErrorCodes.INTERNAL_ERROR));
  }
};

/**
 * Get recommended resources for the current user
 */
export const getRecommendedResources = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return next(new AppError('User not authenticated', 401, ErrorCodes.UNAUTHORIZED));
    }
    
    const { limit = 5 } = req.query;
    const limitNum = parseInt(limit as string, 10);
    
    // Generate recommendations
    const recommendations = await generateResourceRecommendations(userId.toString(), limitNum);
    
    res.success({
      recommendations,
      count: recommendations.length
    }, 'Resource recommendations generated successfully');
  } catch (error) {
    next(new AppError(error instanceof Error ? error.message : 'Failed to generate resource recommendations', 500, ErrorCodes.INTERNAL_ERROR));
  }
};
