import Joi from 'joi';

const passwordPattern =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

export const authValidation = {
  signup: Joi.object({
    name: Joi.string().trim().required().messages({
      'string.empty': 'Name is required',
      'any.required': 'Name is required',
    }),
    email: Joi.string().email().required().messages({
      'string.email': 'Please enter a valid email',
      'any.required': 'Email is required',
    }),
    password: Joi.string().min(8).pattern(passwordPattern).required().messages({
      'string.min': 'Password must be at least 8 characters',
      'string.pattern.base':
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
      'any.required': 'Password is required',
    }),
    role: Joi.string()
      .valid('Student', 'Faculty', 'Admin')
      .required()
      .messages({
        'any.only': 'Invalid role',
        'any.required': 'Role is required',
      }),
    level: Joi.when('role', {
      is: 'Student',
      then: Joi.number().min(1).max(5).required().messages({
        'number.min': 'Student level must be between 1 and 5',
        'number.max': 'Student level must be between 1 and 5',
        'any.required': 'Student level is required',
      }),
      otherwise: Joi.forbidden().messages({
        'any.unknown': 'Level is only applicable for students',
      }),
    }),
  }),

  login: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please enter a valid email',
      'any.required': 'Email is required',
    }),
    password: Joi.string().required().messages({
      'any.required': 'Password is required',
    }),
  }),

  forgotPassword: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please enter a valid email',
      'any.required': 'Email is required',
    }),
  }),

  verifyForgotPasswordOTP: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please enter a valid email',
      'any.required': 'Email is required',
    }),
    otp: Joi.string().length(6).required().messages({
      'string.length': 'OTP must be 6 digits',
      'any.required': 'OTP is required',
    }),
  }),

  resetPassword: Joi.object({
    resetToken: Joi.string().required().messages({
      'any.required': 'Reset token is required',
    }),
    password: Joi.string().min(8).pattern(passwordPattern).required().messages({
      'string.min': 'Password must be at least 8 characters',
      'string.pattern.base':
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
      'any.required': 'Password is required',
    }),
  }),

  verifyEmail: Joi.object({
    code: Joi.string().length(6).required().messages({
      'string.length': 'Code must be 6 digits',
      'any.required': 'Code is required',
    }),
  }),

  resendVerificationOTP: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please enter a valid email',
      'any.required': 'Email is required',
    }),
  }),

  changePassword: Joi.object({
    currentPassword: Joi.string().required().messages({
      'any.required': 'Current password is required',
    }),
    newPassword: Joi.string()
      .min(8)
      .pattern(passwordPattern)
      .required()
      .not(Joi.ref('currentPassword'))
      .messages({
        'string.min': 'New password must be at least 8 characters',
        'string.pattern.base':
          'New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        'any.required': 'New password is required',
        'any.invalid': 'New password must be different from current password',
      }),
  }),

  initiateSignup: Joi.object({
    name: Joi.string().trim().required().messages({
      'string.empty': 'Name is required',
      'any.required': 'Name is required',
    }),
    email: Joi.string().email().required().messages({
      'string.email': 'Please enter a valid email',
      'any.required': 'Email is required',
    }),
  }),

  setPassword: Joi.object({
    password: Joi.string().min(8).pattern(passwordPattern).required().messages({
      'string.min': 'Password must be at least 8 characters',
      'string.pattern.base':
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
      'any.required': 'Password is required',
    }),
  }),

  completeSignup: Joi.object({
    username: Joi.string().required().min(3).max(30).trim().messages({
      'string.empty': 'Username is required',
      'string.min': 'Username must be at least 3 characters long',
      'string.max': 'Username cannot exceed 30 characters',
    }),
    gender: Joi.string().required().valid('male', 'female').messages({
      'any.only': 'Gender must be either male or female',
      'any.required': 'Gender is required',
    }),
    phoneNumber: Joi.string()
      .required()
      .pattern(/^\+\d{1,3}\s\(\d{3}\)\s\d{3}-\d{4}$/)
      .messages({
        'string.pattern.base':
          'Phone number must be in format: +1 (555) 000-0000',
        'any.required': 'Phone number is required',
      }),
    dateOfBirth: Joi.date().required().max('now').messages({
      'date.base': 'Please enter a valid date',
      'date.max': 'Date of birth cannot be in the future',
      'any.required': 'Date of birth is required',
    }),
    university: Joi.string().when('signupStep', {
      is: 'completed',
      then: Joi.required().messages({
        'string.empty': 'University is required when completing profile',
        'any.required': 'University is required when completing profile',
      }),
    }),
    college: Joi.string().when('signupStep', {
      is: 'completed',
      then: Joi.required().messages({
        'string.empty': 'College is required when completing profile',
        'any.required': 'College is required when completing profile',
      }),
    }),
    role: Joi.string()
      .valid('Student', 'Faculty', 'Admin')
      .required()
      .messages({
        'any.only': 'Invalid role',
        'any.required': 'Role is required',
      }),
    level: Joi.when('role', {
      is: 'Student',
      then: Joi.number().min(1).max(5).required().messages({
        'number.min': 'Student level must be between 1 and 5',
        'number.max': 'Student level must be between 1 and 5',
        'any.required': 'Student level is required',
      }),
      otherwise: Joi.forbidden().messages({
        'any.unknown': 'Level is only applicable for students',
      }),
    }),
    profilePicture: Joi.string().uri().messages({
      'string.uri': 'Profile picture must be a valid URL',
    }),
    profile: Joi.object({
      bio: Joi.string().max(500).messages({
        'string.max': 'Bio cannot exceed 500 characters',
      }),
      interests: Joi.array().items(Joi.string()),
    }),
    addresses: Joi.array().items(
      Joi.object({
        street: Joi.string(),
        city: Joi.string(),
        country: Joi.string(),
      })
    ),
    gpa: Joi.when('role', {
      is: 'Student',
      then: Joi.number().min(0).max(4).messages({
        'number.min': 'GPA must be between 0 and 4',
        'number.max': 'GPA must be between 0 and 4',
      }),
      otherwise: Joi.forbidden().messages({
        'any.unknown': 'GPA is only applicable for students',
      }),
    }),
    email: Joi.forbidden().messages({
      'any.unknown':
        'Email cannot be changed during profile completion. Use the change email process instead.',
    }),
    universityEmail: Joi.string().email().messages({
      'string.email': 'University email must be a valid email address',
    }),
    mfa_settings: Joi.object({
      enabled: Joi.boolean(),
      methods: Joi.array().items(Joi.string()),
    }),
    dashboards: Joi.object({
      academic_progress: Joi.number(),
      event_stats: Joi.object({
        attended: Joi.number(),
      }),
    }),
  })
    .min(1)
    .messages({
      'object.min': 'At least one field must be provided for update',
    }),

  params: {
    token: Joi.object({
      token: Joi.string().required().messages({
        'any.required': 'Token is required',
      }),
    }),
  },

  initiateEmailChange: Joi.object({
    newEmail: Joi.string().email().required().messages({
      'string.email': 'Please enter a valid email',
      'any.required': 'New email is required',
    }),
  }),

  verifyNewEmail: Joi.object({
    code: Joi.string().length(6).required().messages({
      'string.length': 'Code must be 6 digits',
      'any.required': 'Code is required',
    }),
  }),

  verifyUniversityEmail: Joi.object({
    code: Joi.string().length(6).required().messages({
      'string.length': 'Code must be 6 digits',
      'any.required': 'Code is required',
    }),
  }),
};
