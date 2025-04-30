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
    fileUrl: Joi.string().uri().required(),
    fileSize: Joi.number().required().min(0),
    tags: Joi.alternatives().try(
      Joi.string(),
      Joi.array().items(Joi.string())
    ),
    visibility: Joi.string().valid('public', 'private', 'community').default('community'),
    category: Joi.string().required(),
    community: objectId.required()
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
    community: objectId
  }).min(1),

  // Rate resource validation
  rateResource: Joi.object({
    rating: Joi.number().required().min(1).max(5).integer()
  }),

  // Comment on resource validation
  commentResource: Joi.object({
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
    resourceId: objectId.required()
  }),

  // Track resource view validation
  trackView: Joi.object({
    resourceId: objectId.required()
  })
};
