import Joi from 'joi';
import { Types } from 'mongoose';

// Custom validator for MongoDB ObjectId
const objectId = Joi.string().custom((value, helpers) => {
  if (!Types.ObjectId.isValid(value)) {
    return helpers.error('any.invalid');
  }
  return value;
}, 'MongoDB ObjectId validation');

export const messageValidation = {
  // Get messages validation
  getMessages: Joi.object({
    conversationId: objectId.required().messages({
      'any.required': 'Conversation ID is required',
      'any.invalid': 'Invalid conversation ID format',
    }),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  }),

  // Edit message validation
  editMessage: Joi.object({
    messageId: objectId.required().messages({
      'any.required': 'Message ID is required',
      'any.invalid': 'Invalid message ID format',
    }),
    content: Joi.string().required().trim().min(1).max(5000).messages({
      'any.required': 'Message content is required',
      'string.empty': 'Message content cannot be empty',
      'string.min': 'Message content must be at least 1 character long',
      'string.max': 'Message content cannot exceed 5000 characters',
    }),
  }),

  // Delete message validation
  deleteMessage: Joi.object({
    messageId: objectId.required().messages({
      'any.required': 'Message ID is required',
      'any.invalid': 'Invalid message ID format',
    }),
  }),

  // Mark message read validation
  markMessageRead: Joi.object({
    conversationId: objectId.required().messages({
      'any.required': 'Conversation ID is required',
      'any.invalid': 'Invalid conversation ID format',
    }),
  }),
};
