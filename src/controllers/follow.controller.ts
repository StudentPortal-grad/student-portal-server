import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import User from '../models/User';
import { AppError, ErrorCodes } from '../utils/appError';
import { HttpStatus } from '../utils/ApiResponse';
import asyncHandler from '../utils/asyncHandler';
import { getPaginationOptions, getPaginationMetadata } from '../utils/pagination';

/**
 * Follow a user
 * @route POST /api/v1/follow
 */
export const followUser = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const { userId: targetUserId } = req.params;
    const currentUserId = req.user?._id;

    // Add targetUserId to currentUser's following list and add currentUserId to targetUser's followers list
    const currentUserUpdate = User.findByIdAndUpdate(
        currentUserId,
        { $addToSet: { following: targetUserId } },
    );

    const targetUserUpdate = User.findByIdAndUpdate(
        targetUserId,
        { $addToSet: { followers: currentUserId } },
    );

    await Promise.all([currentUserUpdate, targetUserUpdate]);

    res.success(null, 'Successfully followed user.');
});

/**
 * Unfollow a user
 * @route POST /api/v1/unfollow
 */
export const unfollowUser = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const { userId: targetUserId } = req.params;
    const currentUserId = req.user?._id;

    // Remove targetUserId from currentUser's following list and remove currentUserId from targetUser's followers list
    const currentUserUpdate = User.findByIdAndUpdate(
        currentUserId,
        { $pull: { following: targetUserId } },
    );

    const targetUserUpdate = User.findByIdAndUpdate(
        targetUserId,
        { $pull: { followers: currentUserId } },
    );

    await Promise.all([currentUserUpdate, targetUserUpdate]);

    res.success(null, 'Successfully unfollowed user.');
});

/**
 * Get a user's followers list
 * @route GET /api/v1/:userId/followers
 */
export const getFollowers = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const { userId } = req.params;
    const paginationOptions = getPaginationOptions(req.query);

    const user = await User.findById(userId)
        .populate({
            path: 'followers',
            select: 'name profilePicture username followersCount followingCount',
            options: {
                skip: (paginationOptions.page - 1) * paginationOptions.limit,
                limit: paginationOptions.limit
            }
        })
        .select('followers followersCount');

    if (!user) {
        throw new AppError('User not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }

    const paginationMetadata = getPaginationMetadata(user.followersCount ?? 0, paginationOptions);

    res.success({ 
        followers: user.followers,
        pagination: paginationMetadata
     }, 'Followers retrieved successfully');
});

/**
 * Get a user's following list
 * @route GET /api/v1/:userId/following
 */
export const getFollowing = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const { userId } = req.params;
    const paginationOptions = getPaginationOptions(req.query);

    const user = await User.findById(userId)
        .populate({
            path: 'following',
            select: 'name profilePicture username followersCount followingCount',
            options: {
                skip: (paginationOptions.page - 1) * paginationOptions.limit,
                limit: paginationOptions.limit
            }
        })
        .select('following followingCount');

    if (!user) {
        throw new AppError('User not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }

    const paginationMetadata = getPaginationMetadata(user.followingCount ?? 0, paginationOptions);

    res.success({ 
        following: user.following,
        pagination: paginationMetadata
     }, 'Following list retrieved successfully');
});

/**
 * Check if the current user is following a target user
 * @route GET /api/v1/is-following/:targetUserId
 */
export const isFollowing = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const { userId, targetUserId } = req.params;
    const currentUserId = req.user?._id;

    const currentUser = await User.findById(currentUserId).select('following');
    const isFollowing = currentUser?.following?.some((id: mongoose.Types.ObjectId) => id.equals(targetUserId)) || false;

    res.success({ isFollowing }, 'Following status checked successfully');
});

/**
 * Get a list of users that the current user and a target user both follow (mutuals).
 * @route GET /api/v1/:userId/mutual
 */
export const getMutualFollowers = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const { userId: targetUserId } = req.params;
    const currentUserId = req.user?._id;

    const [currentUser, targetUser] = await Promise.all([
        User.findById(currentUserId).select('following').lean(),
        User.findById(targetUserId).select('followers').lean()
    ]);

    if (!currentUser || !targetUser) {
        throw new AppError('User not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }

    const currentUserFollowing = (currentUser.following ?? []).map((id: mongoose.Types.ObjectId) => id.toString());
    const targetUserFollowers = (targetUser.followers ?? []).map((id: mongoose.Types.ObjectId) => id.toString());

    const mutualIds = currentUserFollowing.filter((id: string) => targetUserFollowers.includes(id));

    const mutualUsers = await User.find({ _id: { $in: mutualIds } }).select('name profilePicture username');

    res.success({ mutuals: mutualUsers }, 'Mutual followers retrieved successfully');
});

/**
 * Get a list of follow suggestions for the current user.
 * @route GET /api/v1/suggestions
 */
export const getFollowSuggestions = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const currentUserId = req.user?._id;
    const { limit = 10 } = req.query;

    const currentUser = await User.findById(currentUserId).select('following blockedUsers');
    const followingIds = currentUser?.following || [];
    const blockedIds = currentUser?.blockedUsers || [];
    const excludeIds = [...followingIds, ...blockedIds, currentUserId];

    const suggestions = await User.find({ _id: { $nin: excludeIds } })
        .sort({ followersCount: -1 })
        .limit(Number(limit))
        .select('name profilePicture username followersCount');

    res.success({ suggestions }, 'Follow suggestions retrieved successfully');
});
