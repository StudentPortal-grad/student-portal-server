import Joi from 'joi';

const passwordPattern =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

export const userValidation = {
  updateProfile: Joi.object({
    name: Joi.string().trim().min(2).max(255),
    username: Joi.string().trim().min(3).max(30),
    gender: Joi.string().valid('male', 'female'),
    phoneNumber: Joi.string().pattern(/^\+\d{1,4}[\s-]?(\d[\s-]?){6,14}\d$/),
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

  // New schemas for user management
  getUsersQuery: Joi.object({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1),
    role: Joi.string().valid('student', 'faculty', 'admin'),
    search: Joi.string().allow(''),
    status: Joi.string().valid('online', 'offline', 'idle', 'dnd'),
    sortBy: Joi.string().valid('createdAt', 'name', 'email', 'role'),
    sortOrder: Joi.string().valid('asc', 'desc'),
    populateFollowers: Joi.boolean(),
    populateFollowing: Joi.boolean(),
  }),

  getSiblingStudentsQuery: Joi.object({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1),
    search: Joi.string().allow(''),
    sortBy: Joi.string().valid('name', 'username', 'level'),
    sortOrder: Joi.string().valid('asc', 'desc')
  }),

  getUserById: {
    params: Joi.object({
      userId: Joi.string().required(),
    }),
    query: Joi.object({
      populateFollowers: Joi.boolean(),
      populateFollowing: Joi.boolean(),
    }),
  },

  createUser: Joi.object({
    name: Joi.string().required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    role: Joi.string().valid('student', 'faculty', 'admin').required(),
  }),

  updateUser: Joi.object({
    name: Joi.string(),
    role: Joi.string().valid('student', 'faculty', 'admin'),
    status: Joi.string().valid('online', 'offline', 'idle', 'dnd'),
    profilePicture: Joi.string(),
  }).min(1),

  deleteUser: Joi.object({
    userId: Joi.string().required(),
  }),

  bulkCreateUsers: Joi.object({
    users: Joi.array()
      .items(
        Joi.object({
          name: Joi.string().required(),
          email: Joi.string().email().required(),
          password: Joi.string().min(8).required(),
          role: Joi.string().valid('student', 'faculty', 'admin').required(),
        })
      )
      .min(1)
      .required(),
  }),

  bulkUpdateUsers: Joi.object({
    updates: Joi.array()
      .items(
        Joi.object({
          userId: Joi.string().required(),
          data: Joi.object({
            name: Joi.string(),
            role: Joi.string().valid('student', 'faculty', 'admin'),
            status: Joi.string().valid('online', 'offline', 'idle', 'dnd'),
          })
            .min(1)
            .required(),
        })
      )
      .min(1)
      .required(),
  }),

  bulkDeleteUsers: Joi.object({
    userIds: Joi.array().items(Joi.string()).min(1).required(),
  }),

  updateUserStatus: Joi.object({
    status: Joi.string().valid('online', 'offline', 'idle', 'dnd').required(),
  }),

  updateUserRole: Joi.object({
    role: Joi.string().valid('student', 'faculty', 'admin', 'superadmin').required(),
  }),

  // Suspend user validation
  suspendUser: Joi.object({
    reason: Joi.string().required().min(5).max(500),
    duration: Joi.number().integer().min(1).max(365).optional(),
  }),

  getMe: Joi.object({
    populateFollowers: Joi.boolean(),
    populateFollowing: Joi.boolean(),
  }),
};