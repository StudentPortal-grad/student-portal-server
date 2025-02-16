import { Request, Response, NextFunction } from 'express';
import AppError from './appError';

/**
 * A middleware async function that wraps async route handlers and handles errors.
 * If the async function throws an error, it will be converted to an AppError
 * and passed to the next middleware function.
 *
 * @param {Function} fn - The async function to wrap.
 * @returns {Function} - The wrapped async function.
 */
export default function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            await fn(req, res, next);
        } catch (error) {
            // Narrow down the type of `error` to `Error`
            if (error instanceof Error) {
                // If an error is thrown, convert it to an AppError and pass it to the next middleware
                if (error instanceof AppError) {
                    next(error); // If it's already an AppError, pass it directly
                } else {
                    next(new AppError(error.message, 500, error)); // Convert to AppError
                }
            } else {
                // Handle cases where the error is not an instance of Error
                next(new AppError('An unknown error occurred', 500));
            }
        }
    };
}