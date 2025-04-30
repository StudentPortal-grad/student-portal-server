import Joi from 'joi';
import { Types } from 'mongoose';

// Custom validator for MongoDB ObjectId
const objectId = Joi.string().custom((value, helpers) => {
  if (!Types.ObjectId.isValid(value)) {
    return helpers.error('string.hex', { value });
  }
  return value;
}, 'MongoDB ObjectId validation');

export const friendValidation = {
  // Validation for sending a friend request
  sendFriendRequest: {
    body: Joi.object().keys({
      recipientId: objectId.required()
    })
  },

  // Validation for getting friend requests
  getFriendRequests: {
    query: Joi.object().keys({
      page: Joi.number().integer().min(1),
      limit: Joi.number().integer().min(1).max(100)
    })
  },

  // Validation for accepting a friend request
  acceptFriendRequest: {
    params: Joi.object().keys({
      senderId: objectId.required()
    })
  },

  // Validation for rejecting a friend request
  rejectFriendRequest: {
    params: Joi.object().keys({
      senderId: objectId.required()
    })
  },

  // Validation for getting friends list
  getFriends: {
    query: Joi.object().keys({
      page: Joi.number().integer().min(1),
      limit: Joi.number().integer().min(1).max(100)
    })
  }
};
