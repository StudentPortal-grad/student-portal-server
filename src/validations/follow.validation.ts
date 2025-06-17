import Joi from 'joi';
import { objectId } from '@validations/custom.validation';

export const followUser = {
  params: Joi.object().keys({
    userId: Joi.string().custom(objectId).required(),
  }),
};

export const unfollowUser = {
  params: Joi.object().keys({
    userId: Joi.string().custom(objectId).required(),
  }),
};

export const getFollowers = {
  params: Joi.object().keys({
    userId: Joi.string().custom(objectId).required(),
  }),
  query: Joi.object().keys({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
  }),
};

export const getFollowing = {
  params: Joi.object().keys({
    userId: Joi.string().custom(objectId).required(),
  }),
  query: Joi.object().keys({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
  }),
};

export const isFollowing = {
  params: Joi.object().keys({
    userId: Joi.string().custom(objectId).required(),
  }),
};

export const getMutualFollowers = {
  params: Joi.object().keys({
    userId: Joi.string().custom(objectId).required(),
  }),
};

export const getFollowSuggestions = {
  query: Joi.object().keys({
    limit: Joi.number().integer().min(1).max(50),
  }),
};
