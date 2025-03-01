import { Request, Response, NextFunction } from 'express';
import AppError from '../utils/appError';

export default (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log the error for debugging
  console.error(`Error Handler: ${err.stack}`);

  // Set default status code and error response
  const code = err instanceof AppError ? err.statusCode : 500;
  const response: any = {
    error: err.message,
    success: false,
  };

  // Add additional error data if available
  if (err instanceof AppError && err.data) {
    response.data = err.data;
  }

  // Send the error response
  res.status(code).json(response);
};
