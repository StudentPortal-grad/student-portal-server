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
    participants: Joi.array().items(objectId).min(1).required().messages({
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

  // Get conversation by ID validation (renamed to match route handler)
  getConversationById: Joi.object({
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

  // Add group members validation
  addGroupMembers: Joi.object({
    userIds: Joi.array().items(objectId).min(1).required().messages({
      'array.min': 'At least one user ID is required',
      'array.base': 'User IDs must be an array',
      'any.required': 'User IDs are required',
    }),
  }),

  // Remove group member validation
  removeGroupMember: Joi.object({
    id: objectId.required().messages({
      'any.required': 'Conversation ID is required',
      'any.invalid': 'Invalid conversation ID format',
    }),
    memberId: objectId.required().messages({
      'any.required': 'Member ID is required',
      'any.invalid': 'Invalid member ID format',
    }),
  }),

  // Update recent conversation settings validation
  updateRecentConversation: Joi.object({
    isPinned: Joi.boolean(),
    isMuted: Joi.boolean(),
    mutedUntil: Joi.date().when('isMuted', {
      is: true,
      then: Joi.date().min('now'),
      otherwise: Joi.optional().allow(null),
    }),
  }).min(1),

  // Remove from recent conversations validation
  removeFromRecentConversations: Joi.object({
    id: objectId.required().messages({
      'any.required': 'Conversation ID is required',
      'any.invalid': 'Invalid conversation ID format',
    }),
  }),

  // Search conversations validation
  searchConversations: Joi.object({
    query: Joi.string().required().min(1).messages({
      'string.base': 'Search query must be a string',
      'string.empty': 'Search query cannot be empty',
      'any.required': 'Search query is required',
    }),
  }).unknown(true),

  // Delete conversation validation
  deleteConversation: Joi.object({
    id: objectId.required().messages({
      'any.required': 'Conversation ID is required',
      'any.invalid': 'Invalid conversation ID format',
    }),
  }),
};
