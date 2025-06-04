import { Request, Response, NextFunction } from 'express';
import asyncHandler from '@utils/asyncHandler';
import { AppError, ErrorCodes } from '@utils/appError';
import Community from '@models/Community'; // Assuming Community model path
import { Types } from 'mongoose';

/**
 * Middleware to check if the authenticated user is an admin of a specific community.
 * Expects `communityId` to be present in `req.params`.
 */
export const checkCommunityAdmin = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { communityId } = req.params;
    const userId = req.user?._id;

    if (!userId) {
      return next(
        new AppError('User not authenticated.', 401, ErrorCodes.UNAUTHORIZED)
      );
    }

    if (!communityId || !Types.ObjectId.isValid(communityId)) {
      return next(
        new AppError('Invalid community ID provided.', 400, ErrorCodes.INVALID_INPUT)
      );
    }

    const community = await Community.findById(communityId).select('+members.userId +members.admin').lean();

    if (!community) {
      return next(
        new AppError('Community not found.', 404, ErrorCodes.NOT_FOUND)
      );
    }

    const member = community.members.find(
      (m) => m.userId.toString() === userId.toString()
    );

    if (!member || !member.admin) {
      return next(
        new AppError(
          'User is not an administrator of this community.',
          403,
          ErrorCodes.FORBIDDEN
        )
      );
    }

    next();
  }
);