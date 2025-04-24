import Joi from 'joi';
import { Types } from 'mongoose';

// Custom validator for MongoDB ObjectId
const objectId = Joi.string().custom((value, helpers) => {
  if (!Types.ObjectId.isValid(value)) {
    return helpers.error('any.invalid');
  }
  return value;
}, 'MongoDB ObjectId validation');

export const conversationValidation = {
  // Create conversation validation
  createConversation: Joi.object({
    participants: Joi.array()
      .items(objectId)
      .min(1)
      .required()
      .messages({
        'array.min': 'At least one participant is required',
        'array.base': 'Participants must be an array',
        'any.required': 'Participants are required',
      }),
    name: Joi.string().max(255).trim(),
    description: Joi.string().max(1000),
    type: Joi.string().valid('DM', 'GroupDM').default('GroupDM'),
    groupImage: Joi.string().uri().allow('', null),
  }),

  // Get conversation by ID validation
  getConversation: Joi.object({
    id: objectId.required().messages({
      'any.required': 'Conversation ID is required',
      'any.invalid': 'Invalid conversation ID format',
    }),
  }),

  // Update conversation validation
  updateConversation: Joi.object({
    name: Joi.string().max(255).trim(),
    description: Joi.string().max(1000),
  }).min(1),

  // Add participant validation
  addParticipant: Joi.object({
    userId: objectId.required(),
    role: Joi.string().valid('member', 'admin').default('member'),
  }),

  // Remove participant validation
  removeParticipant: Joi.object({
    id: objectId.required(),
    userId: objectId.required(),
  }),
};
