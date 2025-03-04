import { Request, Response, NextFunction } from 'express';
import { ResponseBuilder, HttpStatus } from '../utils/ApiResponse';

export const responseHandler = (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  // Add custom success response method
  res.success = function(data: any, message?: string, statusCode = HttpStatus.OK) {
    return this.status(statusCode).json(
      ResponseBuilder.success(data, message)
    );
  };

  // Add custom paginated response method
  res.paginated = function(
    data: any[],
    pagination: {
      total: number;
      page: number;
      limit: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    },
    message?: string,
    statusCode = HttpStatus.OK
  ) {
    return this.status(statusCode).json(
      ResponseBuilder.paginated(data, pagination, message)
    );
  };

  // Add custom unauthorized response method
  res.unauthorized = function(message?: string) {
    return this.status(HttpStatus.UNAUTHORIZED).json(
      ResponseBuilder.unauthorized(message)
    );
  };

  // Add custom validation error response method
  res.validationError = function(message: string, details: any) {
    return this.status(HttpStatus.VALIDATION_ERROR).json(
      ResponseBuilder.validationError(message, details)
    );
  };

  // Add custom not found response method
  res.notFound = function(message?: string) {
    return this.status(HttpStatus.NOT_FOUND).json(
      ResponseBuilder.notFound(message)
    );
  };

  // Add custom bad request response method
  res.badRequest = function(message: string, details?: any) {
    return this.status(HttpStatus.BAD_REQUEST).json(
      ResponseBuilder.badRequest(message, details)
    );
  };

  // Add custom failure response method
  res.failure = function(message: string, code: string, statusCode: number, details?: any) {
    return this.status(statusCode).json(
      ResponseBuilder.failure(message, code, details)
    );
  };

  // Add custom internal error response method
  res.internalError = function(message?: string) {
    return this.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
      ResponseBuilder.internalError(message)
    );
  };

  next();
}; 