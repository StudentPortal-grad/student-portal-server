import { Request, Response, NextFunction } from 'express';
import { AppError, ErrorCodes } from '../utils/appError';
import { ResponseBuilder } from '../utils/ApiResponse';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

/* global process */

interface ErrorResponse {
  message: string;
  code: string;
  details?: any;
  stack?: string;
}

export class ErrorHandler {
  private static handleCastError(err: mongoose.Error.CastError): ErrorResponse {
    return {
      message: `Invalid ${err.path}: ${err.value}`,
      code: ErrorCodes.VALIDATION_ERROR,
      details: {
        field: err.path,
        value: err.value,
        kind: err.kind,
      },
    };
  }

  private static handleValidationError(
    err: mongoose.Error.ValidationError
  ): ErrorResponse {
    const errors = Object.values(err.errors).map((error) => ({
      field: error.path,
      message: error.message,
      value: error.value,
    }));

    return {
      message: 'Invalid input data',
      code: ErrorCodes.VALIDATION_ERROR,
      details: errors,
    };
  }

  private static handleDuplicateKeyError(err: any): ErrorResponse {
    const field = Object.keys(err.keyValue)[0];
    return {
      message: `Duplicate field value: ${field}`,
      code: ErrorCodes.DUPLICATE_ENTRY,
      details: {
        field,
        value: err.keyValue[field],
      },
    };
  }

  private static handleJWTError(
    err: jwt.JsonWebTokenError | jwt.TokenExpiredError
  ): ErrorResponse {
    if (err instanceof jwt.TokenExpiredError) {
      return {
        message: 'Your token has expired. Please log in again',
        code: ErrorCodes.TOKEN_EXPIRED,
      };
    }
    return {
      message: 'Invalid token. Please log in again',
      code: ErrorCodes.INVALID_TOKEN,
    };
  }

  public static handleError(
    err: Error,
    req: Request,
    res: Response,
    _next: NextFunction
  ): void {
    let statusCode = 500;
    let errorResponse: ErrorResponse;

    // Log error in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error 🔥:', err);
    }

    // Handle different types of errors
    if (err instanceof AppError) {
      statusCode = err.statusCode;
      errorResponse = {
        message: err.message,
        code: err.code,
        details: err.details,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
      };
    } else if (err instanceof mongoose.Error.CastError) {
      statusCode = 400;
      errorResponse = this.handleCastError(err);
    } else if (err instanceof mongoose.Error.ValidationError) {
      statusCode = 400;
      errorResponse = this.handleValidationError(err);
    } else if (err.name === 'MongoServerError' && (err as any).code === 11000) {
      statusCode = 409;
      errorResponse = this.handleDuplicateKeyError(err as any);
    } else if (
      err instanceof jwt.JsonWebTokenError ||
      err instanceof jwt.TokenExpiredError
    ) {
      statusCode = 401;
      errorResponse = this.handleJWTError(err);
    } else {
      // Unknown error
      errorResponse = {
        message: 'Something went wrong',
        code: ErrorCodes.INTERNAL_ERROR,
        ...(process.env.NODE_ENV === 'development' && {
          details: err.message,
          stack: err.stack,
        }),
      };
    }

    res
      .status(statusCode)
      .json(
        ResponseBuilder.error(
          errorResponse.message,
          errorResponse.code,
          errorResponse.details
        )
      );
  }
}

// Express middleware
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  ErrorHandler.handleError(err, req, res, next);
};
