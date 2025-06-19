import { Request, Response, NextFunction } from 'express';
import User from '../models/User';
import { AppError, ErrorCodes } from '../utils/appError';
import asyncHandler from '../utils/asyncHandler';
import { HttpStatus } from '@utils/ApiResponse';

/**
 * Middleware to check if there is a block relationship between the current user and a target user.
 * It checks both if the current user has blocked the target, and if the target has blocked the current user.
 * The target user's ID is expected in `req.body.targetUserId` or `req.params.targetUserId`.
 */
export const checkBlocked = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    const currentUserId = req.user?._id;
    const targetUserId = req.body.targetUserId || req.params.targetUserId || req.params.userId;

    if (!currentUserId || !targetUserId) {
        // This should ideally be caught by auth and validation middleware first
        return next();
    }

    if (currentUserId.toString() === targetUserId.toString()) {
        // No need to check if the user is interacting with themselves
        return next();
    }

    const users = await User.find({
        _id: { $in: [currentUserId, targetUserId] }
    }).select('blockedUsers');

    const currentUser = users.find(u => u._id.equals(currentUserId));
    const targetUser = users.find(u => u._id.equals(targetUserId));

    if (!currentUser || !targetUser) {
        throw new AppError('One or more users not found.', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }

    // Check if current user blocked the target user
    const iBlockedTarget = currentUser.blockedUsers?.some(blockedId => blockedId.equals(targetUser._id));
    if (iBlockedTarget) {
        throw new AppError('You have blocked this user. Unblock them to interact.', HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN);
    }

    // Check if target user blocked the current user
    const targetBlockedMe = targetUser.blockedUsers?.some(blockedId => blockedId.equals(currentUser._id));
    if (targetBlockedMe) {
        throw new AppError('This user has blocked you.', HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN);
    }

    next();
});
