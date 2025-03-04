import Joi from 'joi';

const passwordPattern =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

export const userValidation = {
  updateProfile: Joi.object({
    name: Joi.string().trim().min(2).max(255),
    username: Joi.string().trim().min(3).max(30),
    gender: Joi.string().valid('male', 'female'),
    phoneNumber: Joi.string().pattern(/^\+\d{1,3}\s\(\d{3}\)\s\d{3}-\d{4}$/),
    dateOfBirth: Joi.date().max('now'),
    university: Joi.string(),
    college: Joi.string(),
    profilePicture: Joi.string().uri(),
    profile: Joi.object({
      bio: Joi.string().max(500),
      interests: Joi.array().items(Joi.string()),
    }),
    addresses: Joi.array().items(
      Joi.object({
        street: Joi.string(),
        city: Joi.string(),
        country: Joi.string(),
      })
    ),
    isGraduated: Joi.boolean(),
    graduationYear: Joi.number().min(1900).max(new Date().getFullYear()),
  })
    .min(1)
    .messages({
      'object.min': 'At least one field must be provided for update',
    }),

  updatePassword: Joi.object({
    currentPassword: Joi.string().required().messages({
      'any.required': 'Current password is required',
    }),
    newPassword: Joi.string()
      .pattern(passwordPattern)
      .required()
      .not(Joi.ref('currentPassword'))
      .messages({
        'string.pattern.base':
          'New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        'any.required': 'New password is required',
        'any.invalid': 'New password must be different from current password',
      }),
  }),

  updateEmail: Joi.object({
    newEmail: Joi.string().email().required().messages({
      'string.email': 'Please enter a valid email',
      'any.required': 'New email is required',
    }),
  }),

  updateUniversityEmail: Joi.object({
    universityEmail: Joi.string().email().required().messages({
      'string.email': 'Please enter a valid university email',
      'any.required': 'University email is required',
    }),
  }),
};
