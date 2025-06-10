import Joi from 'joi';
import { Types } from 'mongoose';

// Custom validator for MongoDB ObjectId
const objectId = Joi.string().custom((value, helpers) => {
  if (!Types.ObjectId.isValid(value)) {
    return helpers.error('any.invalid');
  }
  return value;
}, 'MongoDB ObjectId validation');

export const eventValidation = {
  // Get events validation
  getEvents: Joi.object({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
    status: Joi.string().valid('upcoming', 'ongoing', 'completed', 'cancelled'),
    visibility: Joi.string().valid('public', 'private', 'community'),
    communityId: objectId,
    sortBy: Joi.string().valid('dateTime', 'title', 'createdAt'),
    sortOrder: Joi.string().valid('asc', 'desc'),
    rsvpStatus: Joi.string().valid('attending', 'maybe', 'declined').optional()
  }),

  // Create event validation
  createEvent: Joi.object({
    title: Joi.string().required().max(255).trim(),
    description: Joi.string().max(1000),
    dateTime: Joi.date().required().min('now'),
    location: Joi.string().max(255),
    eventImage: Joi.string().uri().allow('', null),
    capacity: Joi.number().integer().min(1),
    visibility: Joi.string().valid('public', 'private', 'community').default('public'),
    communityId: Joi.when('visibility', {
      is: 'community',
      then: objectId.required(),
      otherwise: objectId.allow(null)
    })
  }),

  // Update event validation
  updateEvent: Joi.object({
    title: Joi.string().max(255).trim(),
    description: Joi.string().max(1000),
    dateTime: Joi.date().min('now'),
    location: Joi.string().max(255),
    eventImage: Joi.string().uri().allow('', null),
    capacity: Joi.number().integer().min(1),
    visibility: Joi.string().valid('public', 'private', 'community'),
    communityId: objectId
  }).min(1),
  
  // Update event image validation
  updateEventImage: Joi.object({
    eventImage: Joi.string().uri().required()
  })
};
