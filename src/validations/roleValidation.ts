import Joi from 'joi';

export const createRoleSchema = Joi.object({
  communityId: Joi.string().hex().length(24).required().messages({
    'string.hex': 'communityId must be a valid ObjectId',
    'string.length': 'communityId must be 24 characters long',
    'any.required': 'communityId is required',
  }),
  name: Joi.string().max(100).required().messages({
    'string.max': 'name must not exceed 100 characters',
    'any.required': 'name is required',
  }),
  color: Joi.number().integer().min(0).max(16777215).required().messages({
    'number.base': 'color must be a number',
    'number.integer': 'color must be an integer',
    'number.min': 'color must be at least 0',
    'number.max': 'color must not exceed 16777215',
    'any.required': 'color is required',
  }),
  permissions: Joi.number().integer().min(0).required().messages({
    'number.base': 'permissions must be a number',
    'number.integer': 'permissions must be an integer',
    'number.min': 'permissions must be at least 0',
    'any.required': 'permissions is required',
  }),
  mentionable: Joi.boolean().default(false).messages({
    'boolean.base': 'mentionable must be a boolean',
  }),
});

export const updateRoleSchema = Joi.object({
    name: Joi.string().max(100).optional().messages({
      'string.max': 'name must not exceed 100 characters',
    }),
    color: Joi.number().integer().min(0).max(16777215).optional().messages({
      'number.base': 'color must be a number',
      'number.integer': 'color must be an integer',
      'number.min': 'color must be at least 0',
      'number.max': 'color must not exceed 16777215',
    }),
    permissions: Joi.number().integer().min(0).optional().messages({
      'number.base': 'permissions must be a number',
      'number.integer': 'permissions must be an integer',
      'number.min': 'permissions must be at least 0',
    }),
    mentionable: Joi.boolean().optional().messages({
      'boolean.base': 'mentionable must be a boolean',
    }),
  })