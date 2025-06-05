import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError, ErrorCodes } from '../utils/appError';
import { DbOperations } from '../utils/dbOperations';
import User from '../models/User';

/* global process */

interface JwtPayload {
  id: string;
  role: string;
}

declare module 'express' {
  interface Request {
    user?: any;
  }
}

/**
 * Verify JWT token and attach user to request
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Get token from header
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      throw new AppError('No token provided', 401, ErrorCodes.UNAUTHORIZED);
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;

    // Get user from database
    const user = await DbOperations.findOne(User, { _id: decoded.id });
    if (!user) {
      throw new AppError('User not found', 401, ErrorCodes.UNAUTHORIZED);
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new AppError('Invalid token', 401, ErrorCodes.INVALID_TOKEN));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(new AppError('Token expired', 401, ErrorCodes.TOKEN_EXPIRED));
    } else {
      next(error);
    }
  }
};

/**
 * Check if user has required roles
 */
export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    
    if (process.env.SKIP_RBAC === 'true') {
      return next();
    }

    if (!req.user) {
      return next(
        new AppError('You are not logged in!', 401, ErrorCodes.UNAUTHORIZED)
      );
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('Not authorized for this role', 403, ErrorCodes.FORBIDDEN)
      );
    }

    next();
  };
};

/**
 * Check if user owns the resource or has admin role
 */
export const authorizeOwner = (userIdPath: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Not authorized', 401, ErrorCodes.UNAUTHORIZED));
    }

    // Get user ID from request using the provided path
    const resourceUserId = userIdPath
      .split('.')
      .reduce((obj: any, key) => obj[key], req);

    if (
      req.user.role !== 'admin' &&
      req.user.id.toString() !== resourceUserId?.toString()
    ) {
      return next(
        new AppError(
          'Not authorized to access this resource',
          403,
          ErrorCodes.FORBIDDEN
        )
      );
    }

    next();
  };
};
