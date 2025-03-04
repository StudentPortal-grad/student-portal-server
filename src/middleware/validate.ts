import { Request, Response, NextFunction } from 'express';
import { AnySchema } from 'joi'; // Import Joi schema type
import { AppError, ErrorCodes } from '../utils/appError';

/**
 * @description Middleware function to validate incoming data using a Joi schema.
 * @param {AnySchema} schema - The Joi schema to validate against.
 * @returns {function} Express middleware function that will validate incoming data.
 */
export const validate =
  (schema: AnySchema) => (req: Request, res: Response, next: NextFunction) => {
    // Combine all data from the request body, query, and params into one object.
    const allData = { ...req.body, ...req.query, ...req.params };

    // Validate the data.
    const { error } = schema.validate(allData, { abortEarly: false });

    if (error) {
      // If there are validation errors, extract the details of each error and return a 400 error with the details.
      const errors = error.details.map((detail) => ({
        field: detail.path[0],
        message: detail.message.replace(/['"]/g, ''), // Remove quotes from error messages
      }));

      return next(
        new AppError(
          'Validation error',
          400,
          ErrorCodes.VALIDATION_ERROR,
          errors
        )
      );
    }

    // If validation passes, proceed to the next middleware or controller.
    next();
  };
