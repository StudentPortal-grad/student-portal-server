import Joi from 'joi';

export const rsvpValidation = {
  createOrUpdateRSVP: Joi.object({
    status: Joi.string()
      .valid('attending', 'not_attending', 'interested')
      .required()
      .messages({
        'string.base': 'Status must be a string',
        'any.required': 'Status is required',
        'any.only': 'Status must be one of: attending, not_attending, interested'
      })
  }),

  getRSVPs: Joi.object({
    status: Joi.string()
      .valid('attending', 'not_attending', 'interested')
      .optional()
      .messages({
        'string.base': 'Status must be a string',
        'any.only': 'Status must be one of: attending, not_attending, interested'
      }),
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
