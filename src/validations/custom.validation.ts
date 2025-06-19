import { CustomHelpers } from 'joi';
import { Types } from 'mongoose';

/**
 * Custom Joi validation for MongoDB ObjectIds.
 * @param {string} value - The value to validate.
 * @param {CustomHelpers} helpers - Joi's helper functions.
 * @returns {string} The validated value.
 */
export const objectId = (value: string, helpers: CustomHelpers) => {
  if (!Types.ObjectId.isValid(value)) {
    return helpers.error('any.invalid');
  }
  return value;
};
