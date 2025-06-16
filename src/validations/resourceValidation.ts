import Joi from 'joi';
import { Types } from 'mongoose';

// Custom validator for MongoDB ObjectId
const objectId = Joi.string().custom((value, helpers) => {
  if (!Types.ObjectId.isValid(value)) {
    return helpers.error('any.invalid');
  }
  return value;
}, 'MongoDB ObjectId validation');

export const resourceValidation = {
  // Get resources validation
  getResources: Joi.object({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
    category: Joi.string(),
    visibility: Joi.string().valid('public', 'private', 'community'),
    tags: Joi.alternatives().try(
      Joi.string(),
      Joi.array().items(Joi.string())
    ),
    communityId: objectId,
    sortBy: Joi.string().valid('createdAt', 'title', 'interactionStats.downloads', 'interactionStats.views'),
    sortOrder: Joi.string().valid('asc', 'desc'),
    search: Joi.string(),
    minRating: Joi.number().min(0).max(5),
    hasComments: Joi.boolean()
  }),

  // Create resource validation
  createResource: Joi.object({
    title: Joi.string().required().max(255).trim(),
    description: Joi.string().max(1000),
    // fileUrl, fileType, mimeType, originalFileName, checksum, fileSize are now handled by req.file in the controller
    tags: Joi.alternatives().try(
      Joi.string(),
      Joi.array().items(Joi.string())
    ).allow(null, ''), // Allow tags to be explicitly null or empty string, controller handles conversion to array
    visibility: Joi.string().valid('public', 'private', 'community').default('community'),
    category: Joi.string().required(),
    community: objectId.optional()
  }),

  // Update resource validation
  updateResource: Joi.object({
    title: Joi.string().max(255).trim(),
    description: Joi.string().max(1000),
    tags: Joi.alternatives().try(
      Joi.string(),
      Joi.array().items(Joi.string())
    ),
    visibility: Joi.string().valid('public', 'private', 'community'),
    category: Joi.string(),
    community: objectId.optional()
  }).min(1),

  // Vote on a resource validation
  voteResource: Joi.object({
    voteType: Joi.string().valid('upvote', 'downvote').required()
  }),

  // Report a resource validation
  reportResource: Joi.object({
    reason: Joi.string().required().min(10).max(500)
  }),

  // Comment on resource validation
  commentResource: Joi.object({
    content: Joi.string().required().min(1).max(500).trim()
  }),

  // Edit a comment validation
  editComment: Joi.object({
    content: Joi.string().required().min(1).max(500).trim()
  }),

  // Get resource comments validation
  getResourceComments: Joi.object({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
    sortOrder: Joi.string().valid('asc', 'desc')
  }),

  // Track resource download validation
  trackDownload: Joi.object({
    params: Joi.object({
      id: objectId.required()
    })
  }),

  // Track resource view validation
  trackView: Joi.object({
    params: Joi.object({
      id: objectId.required()
    })
  })
};
