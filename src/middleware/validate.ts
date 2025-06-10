import { Request, Response, NextFunction } from 'express';
import { Schema } from 'joi';
import { AppError, ErrorCodes } from '../utils/appError';

type ValidateSource = 'body' | 'query' | 'params';

/**
 * @description Middleware function to validate incoming data using a Joi schema.
 * @param {Schema} schema - The Joi schema to validate against.
 * @param {ValidateSource} source - The source of the data to validate (body, query, or params).
 * @returns {function} Express middleware function that will validate incoming data.
 */
export const validate = (schema: Schema, source: ValidateSource = 'body') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const details = error.details.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));

      return next(
        new AppError(
          'Validation failed',
          400,
          ErrorCodes.VALIDATION_ERROR,
          details
        )
      );
    }

    next();
  };
};
