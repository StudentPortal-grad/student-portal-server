import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import User from '../models/User';
import { AppError, ErrorCodes } from '../utils/appError';
import { HttpStatus } from '../utils/ApiResponse';
import asyncHandler from '../utils/asyncHandler';

// TODO: Don't Get Blocked Users in getAll or getOne

/**
 * Block a user, which also forces both users to unfollow each other.
 * @route POST /api/v1/block
 */
export const blockUser = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const targetUserId = req.params.userId;
    const currentUserId = req.user?._id;

    if (!currentUserId) {
        throw new AppError('User not authenticated', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
    }

    if (currentUserId.toString() === targetUserId) {
        throw new AppError('You cannot block yourself', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Add targetUserId to currentUser's blockedUsers list
        const currentUserUpdate = User.findByIdAndUpdate(
            currentUserId,
            { 
                $addToSet: { blockedUsers: targetUserId },
                // Also remove from followers/following
                $pull: { following: targetUserId, followers: targetUserId }
            },
            { session, new: true }
        );

        // Remove currentUser from targetUser's followers/following
        const targetUserUpdate = User.findByIdAndUpdate(
            targetUserId,
            { 
                $pull: { followers: currentUserId, following: currentUserId }
            },
            { session }
        );

        await Promise.all([currentUserUpdate, targetUserUpdate]);

        await session.commitTransaction();
        res.success(null, 'User blocked successfully. All follow connections have been removed.');

    } catch (error) {
        await session.abortTransaction();
        throw new AppError('Failed to block user', HttpStatus.INTERNAL_SERVER_ERROR, ErrorCodes.INTERNAL_ERROR);
    } finally {
        session.endSession();
    }
});

/**
 * Unblock a user
 * @route POST /api/v1/unblock
 */
export const unblockUser = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const targetUserId = req.params.userId;
    const currentUserId = req.user?._id;

    if (!currentUserId) {
        throw new AppError('User not authenticated', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
    }

    await User.findByIdAndUpdate(
        currentUserId,
        { $pull: { blockedUsers: targetUserId } },
        { new: true }
    );

    res.success(null, 'User unblocked successfully');
});
