import Joi from 'joi';

const attachmentSchema = Joi.object({
  type: Joi.string().valid('document', 'file', 'poll').required().messages({
    'string.base': 'type must be a string',
    'any.only': 'type must be either "document", "file", or "poll"',
    'any.required': 'type is required',
  }),
  resource: Joi.string().uri().required().messages({
    'string.uri': 'resource must be a valid URL',
    'any.required': 'resource is required',
  }),
});

const replySchema = Joi.object({
  id: Joi.string().hex().length(24).required().messages({
    'string.hex': 'id must be a valid ObjectId',
    'string.length': 'id must be 24 characters long',
    'any.required': 'id is required',
  }),
  content: Joi.string().required().messages({
    'any.required': 'content is required',
  }),
  creator: Joi.string().hex().length(24).required().messages({
    'string.hex': 'creator must be a valid ObjectId',
    'string.length': 'creator must be 24 characters long',
    'any.required': 'creator is required',
  }),
  createdAt: Joi.date().default(Date.now).messages({
    'date.base': 'createdAt must be a valid date',
  }),
  attachments: Joi.array().items(attachmentSchema).default([]).messages({
    'array.base': 'attachments must be an array',
  }),
});

const voteSchema = Joi.object({
  userId: Joi.string().hex().length(24).required().messages({
    'string.hex': 'userId must be a valid ObjectId',
    'string.length': 'userId must be 24 characters long',
    'any.required': 'userId is required',
  }),
  voteType: Joi.string().valid('upvote', 'downvote').required().messages({
    'string.base': 'voteType must be a string',
    'any.only': 'voteType must be either "upvote" or "downvote"',
    'any.required': 'voteType is required',
  }),
  createdAt: Joi.date().default(Date.now).messages({
    'date.base': 'createdAt must be a valid date',
  }),
});

export const createDiscussionSchema = Joi.object({
  communityId: Joi.string().hex().length(24).required().messages({
    'string.hex': 'communityId must be a valid ObjectId',
    'string.length': 'communityId must be 24 characters long',
    'any.required': 'communityId is required',
  }),
  title: Joi.string().max(255).required().messages({
    'string.max': 'title must not exceed 255 characters',
    'any.required': 'title is required',
  }),
  content: Joi.string().required().messages({
    'any.required': 'content is required',
  }),
  creator: Joi.string().hex().length(24).required().messages({
    'string.hex': 'creator must be a valid ObjectId',
    'string.length': 'creator must be 24 characters long',
    'any.required': 'creator is required',
  }),
  attachments: Joi.array().items(attachmentSchema).default([]).messages({
    'array.base': 'attachments must be an array',
  }),
  replies: Joi.array().items(replySchema).default([]).messages({
    'array.base': 'replies must be an array',
  }),
  votes: Joi.array().items(voteSchema).default([]).messages({
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