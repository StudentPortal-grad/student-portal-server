import Joi from 'joi';
import { objectId } from '@validations/custom.validation';

export const blockUser = {
  params: Joi.object().keys({
    userId: Joi.string().custom(objectId).required(),
  }),
};

export const unblockUser = {
  params: Joi.object().keys({
    userId: Joi.string().custom(objectId).required(),
  }),
};
