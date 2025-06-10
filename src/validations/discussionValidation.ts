import Joi from 'joi';

const attachmentSchema = Joi.object({
  type: Joi.string().valid('document', 'image', 'video', 'audio', 'pdf', 'other', 'poll').required().messages({
    'string.base': 'type must be a string',
    'any.only': 'type must be either "document", "image", "video", "audio", "pdf", "other", or "poll"',
    'any.required': 'type is required',
  }),
  resource: Joi.string().uri().required().messages({
    'string.uri': 'resource must be a valid URL',
    'any.required': 'resource is required',
  }),
  mimeType: Joi.string().required().messages({
    'string.base': 'mimeType must be a string',
    'any.required': 'mimeType is required',
  }),
  originalFileName: Joi.string().required().messages({
    'string.base': 'originalFileName must be a string',
    'any.required': 'originalFileName is required',
  }),
  fileSize: Joi.number().min(0).max(100 * 1024 * 1024).required().messages({
    'number.base': 'fileSize must be a number',
    'number.min': 'fileSize must be at least 0',
    'number.max': 'fileSize must not exceed 100MB',
    'any.required': 'fileSize is required',
  }),
  checksum: Joi.string().required().messages({
    'string.base': 'checksum must be a string',
    'any.required': 'checksum is required',
  }),
});

const replySchema = Joi.object({
  content: Joi.string().required().messages({
    'any.required': 'content is required',
  }),
  attachments: Joi.array().items(attachmentSchema).default([]).messages({
    'array.base': 'attachments must be an array',
  }),
});

const voteSchema = Joi.object({
  voteType: Joi.string().valid('upvote', 'downvote').required().messages({
    'string.base': 'voteType must be a string',
    'any.only': 'voteType must be either "upvote" or "downvote"',
    'any.required': 'voteType is required',
  }),
});

export const createDiscussionSchema = Joi.object({
  communityId: Joi.string().hex().length(24).optional().messages({
    'string.hex': 'communityId must be a valid ObjectId',
    'string.length': 'communityId must be 24 characters long',
  }),
  title: Joi.string().max(255).required().messages({
    'string.max': 'title must not exceed 255 characters',
    'any.required': 'title is required',
  }),
  content: Joi.string().required().messages({
    'any.required': 'content is required',
  }),
  creator: Joi.string().hex().length(24).optional().messages({
    'string.hex': 'creator must be a valid ObjectId',
    'string.length': 'creator must be 24 characters long',
    'any.required': 'creator is required',
  }),
  attachments: Joi.array().optional().items(attachmentSchema).default([]).messages({
    'array.base': 'attachments must be an array',
  }),
  replies: Joi.array().optional().items(replySchema).default([]).messages({
    'array.base': 'replies must be an array',
  }),
  votes: Joi.array().optional().items(voteSchema).default([]).messages({
    'array.base': 'votes must be an array',
  }),
  status: Joi.string().valid('open', 'closed', 'archived').default('open').messages({
    'string.base': 'status must be a string',
    'any.only': 'status must be either "open", "closed", or "archived"',
  }),
});

export const updateDiscussionSchema = Joi.object({
    title: Joi.string().max(255).optional().messages({
      'string.max': 'title must not exceed 255 characters',
    }),
    content: Joi.string().optional().messages({
      'string.base': 'content must be a string',
    }),
    attachments: Joi.array().items(attachmentSchema).optional().messages({
      'array.base': 'attachments must be an array',
    }),
    replies: Joi.array().items(replySchema).optional().messages({
      'array.base': 'replies must be an array',
    }),
    votes: Joi.array().items(voteSchema).optional().messages({
      'array.base': 'votes must be an array',
    }),
    status: Joi.string().valid('open', 'closed', 'archived').optional().messages({
      'string.base': 'status must be a string',
      'any.only': 'status must be either "open", "closed", or "archived"',
    }),
  });

// Export all validation schemas as a single object
export const discussionValidation = {
  createDiscussion: createDiscussionSchema,
  updateDiscussion: updateDiscussionSchema,
  
  // New validation schemas
  getDiscussions: Joi.object({
    page: Joi.number().integer().min(1).optional().default(1)
      .messages({
        'number.base': 'Page must be a number',
        'number.integer': 'Page must be an integer',
        'number.min': 'Page must be at least 1'
      }),
    limit: Joi.number().integer().min(1).max(100).optional().default(10)
      .messages({
        'number.base': 'Limit must be a number',
        'number.integer': 'Limit must be an integer',
        'number.min': 'Limit must be at least 1',
        'number.max': 'Limit cannot exceed 100'
      }),
    communityId: Joi.string().hex().length(24).optional()
      .messages({
        'string.hex': 'Community ID must be a valid ObjectId',
        'string.length': 'Community ID must be 24 characters long'
      }),
    sortBy: Joi.string().valid('createdAt', 'title', 'votes').optional().default('createdAt')
      .messages({
        'string.base': 'Sort by must be a string',
        'any.only': 'Sort by must be one of: createdAt, title, votes'
      }),
    sortOrder: Joi.string().valid('asc', 'desc').optional().default('desc')
      .messages({
        'string.base': 'Sort order must be a string',
        'any.only': 'Sort order must be either asc or desc'
      }),
    search: Joi.string().optional()
      .messages({
        'string.base': 'Search must be a string'
      })
  }),
  
  addReply: Joi.object({
    content: Joi.string().required()
      .messages({
        'string.base': 'Content must be a string',
        'any.required': 'Content is required'
      }),
    attachments: Joi.array().items(attachmentSchema).optional()
      .messages({
        'array.base': 'Attachments must be an array'
      })
  }),
  
  voteDiscussion: Joi.object({
    voteType: Joi.string().valid('upvote', 'downvote').required()
      .messages({
        'string.base': 'Vote type must be a string',
        'any.only': 'Vote type must be either upvote or downvote',
        'any.required': 'Vote type is required'
      })
  }),

  reportDiscussion: Joi.object({
    reason: Joi.string().required().min(10).max(500)
      .messages({
        'string.base': 'Reason must be a string',
        'any.required': 'Reason is required',
        'string.min': 'Reason must be at least 10 characters long',
        'string.max': 'Reason must not exceed 500 characters'
      })
  }),
  
  pinDiscussion: Joi.object({
    pinned: Joi.boolean().required()
      .messages({
        'boolean.base': 'Pinned must be a boolean',
        'any.required': 'Pinned is required'
      })
  }),
  
  getPaginatedItems: Joi.object({
    page: Joi.number().integer().min(1).optional().default(1)
      .messages({
        'number.base': 'Page must be a number',
        'number.integer': 'Page must be an integer',
        'number.min': 'Page must be at least 1'
      }),
    limit: Joi.number().integer().min(1).max(100).optional().default(10)
      .messages({
        'number.base': 'Limit must be a number',
        'number.integer': 'Limit must be an integer',
        'number.min': 'Limit must be at least 1',
        'number.max': 'Limit cannot exceed 100'
      })
  })
};