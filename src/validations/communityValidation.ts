import Joi from 'joi';

const memberSchema = Joi.object({
  userId: Joi.string().hex().length(24).required().messages({
    'string.hex': 'userId must be a valid ObjectId',
    'string.length': 'userId must be 24 characters long',
    'any.required': 'userId is required',
  }),
  roleIds: Joi.array().items(Joi.string().hex().length(24)).messages({
    'array.base': 'roleIds must be an array',
    'string.hex': 'Each roleId must be a valid ObjectId',
    'string.length': 'Each roleId must be 24 characters long',
  }),
  joinedAt: Joi.date().default(Date.now).messages({
    'date.base': 'joinedAt must be a valid date',
  }),
});

export const createCommunitySchema = Joi.object({
  owner: Joi.string().hex().length(24).required().messages({
    'string.hex': 'owner must be a valid ObjectId',
    'string.length': 'owner must be 24 characters long',
    'any.required': 'owner is required',
  }),
  name: Joi.string().max(255).required().messages({
    'string.max': 'name must not exceed 255 characters',
    'any.required': 'name is required',
  }),
  description: Joi.string().max(1000).optional().messages({
    'string.max': 'description must not exceed 1000 characters',
  }),
  type: Joi.string().valid('Official', 'Community').default('Community').messages({
    'string.base': 'type must be a string',
    'any.only': 'type must be either "Official" or "Community"',
  }),
  icon: Joi.string().uri().max(2000).optional().messages({
    'string.uri': 'icon must be a valid URL',
    'string.max': 'icon must not exceed 2000 characters',
  }),
  members: Joi.array().items(memberSchema).default([]).messages({
    'array.base': 'members must be an array',
  }),
  roles: Joi.array().items(Joi.string().hex().length(24)).default([]).messages({
    'array.base': 'roles must be an array',
    'string.hex': 'Each role must be a valid ObjectId',
    'string.length': 'Each role must be 24 characters long',
  }),
  inviteLink: Joi.string().max(500).optional().messages({
    'string.max': 'inviteLink must not exceed 500 characters',
  }),
});


export const updateCommunitySchema = Joi.object({
  name: Joi.string().max(255).optional().messages({
    'string.max': 'name must not exceed 255 characters',
  }),
  description: Joi.string().max(1000).optional().messages({
    'string.max': 'description must not exceed 1000 characters',
  }),
  type: Joi.string().valid('Official', 'Community').optional().messages({
    'string.base': 'type must be a string',
    'any.only': 'type must be either "Official" or "Community"',
  }),
  icon: Joi.string().uri().max(2000).optional().messages({
    'string.uri': 'icon must be a valid URL',
    'string.max': 'icon must not exceed 2000 characters',
  }),
  inviteLink: Joi.string().max(500).optional().messages({
    'string.max': 'inviteLink must not exceed 500 characters',
  }),
});

export const joinCommunitySchema = Joi.object({
  userId: Joi.string().hex().length(24).required().messages({
    'string.hex': 'userId must be a valid ObjectId',
    'string.length': 'userId must be 24 characters long',
    'any.required': 'userId is required',
  }),
  id: Joi.string().hex().length(24).required().messages({
    'string.hex': 'communityId must be a valid ObjectId',
    'string.length': 'communityId must be 24 characters long',
    'any.required': 'communityId is required',
  }),
});

export const addMemberSchema = Joi.object({
  userId: Joi.string().hex().length(24).required().messages({
    'string.hex': 'userId must be a valid ObjectId',
    'string.length': 'userId must be 24 characters long',
    'any.required': 'userId is required',
  }),
  roleIds: Joi.array().items(
    Joi.string().hex().length(24)
  ).default([]).messages({
    'array.base': 'roleIds must be an array',
    'string.hex': 'Each roleId must be a valid ObjectId',
    'string.length': 'Each roleId must be 24 characters long',
  }),
});

export const resourceQuerySchema = Joi.object({
  category: Joi.string(),
  tags: Joi.string().custom((value, helpers) => {
    return value.split(',').map((tag: string) => tag.trim());
  }),
  uploader: Joi.string().hex().length(24),
  query: Joi.string().min(2),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20)
});