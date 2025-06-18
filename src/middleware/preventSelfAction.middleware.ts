import { Request, Response, NextFunction } from 'express';
import { AppError, ErrorCodes } from '../utils/appError';
import { IUser } from '@models/types';

interface AuthenticatedRequest extends Request {
  user?: IUser;
}

export const preventSelfAction = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (req.user && req.params.userId === req.user._id.toString()) {
    return next(new AppError('You cannot perform this action on yourself.', 400, ErrorCodes.INVALID_OPERATION));
  }
  next();
};
