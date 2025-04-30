import Joi from 'joi';

export const searchValidation = {
  // Validation for basic peer search
  searchPeers: {
    query: Joi.object().keys({
      query: Joi.string().allow('', null)
    })
  },

  // Validation for advanced peer search with filters
  searchPeersByFilter: {
    query: Joi.object().keys({
      query: Joi.string().allow('', null),
      university: Joi.string().allow('', null),
      level: Joi.number().integer().min(1).max(6).allow(null),
      gender: Joi.string().valid('male', 'female', 'other').allow('', null),
      minGpa: Joi.number().min(0).max(4).allow(null),
      maxGpa: Joi.number().min(0).max(4).allow(null),
      interests: Joi.alternatives().try(
        Joi.array().items(Joi.string()),
        Joi.string()
      ).allow(null),
      graduationYear: Joi.number().integer().min(2000).max(2100).allow(null)
    })
  }
};
