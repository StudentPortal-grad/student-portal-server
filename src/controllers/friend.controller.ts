import { NextFunction, Request, Response } from 'express';
import { AppError, ErrorCodes } from '@utils/appError';
import { FriendService } from '@services/friend.service';
import asyncHandler from '@utils/asyncHandler';
import { ResponseBuilder, HttpStatus } from '@utils/ApiResponse';
import mongoose from 'mongoose';
import Conversation from '../models/Conversation';
import User from '../models/User';

/**
 * Send a friend request
 * @route POST /api/v1/friends/requests
 */
export const sendFriendRequest = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { recipientId } = req.body;
  const user = req.user;

  if (!user || !user._id) {
    throw new AppError('User not authenticated', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
  }

  const result = await FriendService.sendFriendRequest(user._id.toString(), recipientId);
  
  res.success(result, 'Friend request sent successfully');
});

/**
 * Get friend requests for the current user
 * @route GET /api/v1/friends/requests
 */
export const getFriendRequests = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user;
  const { page = 1, limit = 10 } = req.query;

  if (!user || !user._id) {
    throw new AppError('User not authenticated', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
  }

  const result = await FriendService.getFriendRequests(
    user._id.toString(),
    Number(page),
    Number(limit)
  );

  res.success(result, 'Friend requests retrieved successfully');
});

/**
 * Accept a friend request
 * @route POST /api/v1/friends/requests/:senderId/accept
 */
export const acceptFriendRequest = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { senderId } = req.params;
  const user = req.user;

  if (!user || !user._id) {
    throw new AppError('User not authenticated', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
  }

  const result = await FriendService.acceptFriendRequest(senderId, user._id.toString());

  res.success(result, 'Friend request accepted successfully');
});

/**
 * Reject a friend request
 * @route DELETE /api/v1/friends/requests/:senderId
 */
export const rejectFriendRequest = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { senderId } = req.params;
  const user = req.user;

  if (!user || !user._id) {
    throw new AppError('User not authenticated', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
  }

  await FriendService.rejectFriendRequest(user._id.toString(), senderId);

  res.success(null, 'Friend request rejected successfully');
});

/**
 * Get friends list for the current user
 * @route GET /api/v1/friends
 */
export const getFriends = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user;
  const { page = 1, limit = 10 } = req.query;

  if (!user || !user._id) {
    throw new AppError('User not authenticated', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
  }

  const result = await FriendService.getFriends(
    user._id.toString(),
    Number(page),
    Number(limit)
  );

  res.success(result, 'Friends retrieved successfully');
});

/**
 * Delete a friend and their DM conversation
 * @route DELETE /api/v1/friends/:friendId
 */
export const deleteFriend = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { friendId } = req.params;
  const user = req.user;

  if (!user || !user._id) {
    throw new AppError('User not authenticated', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
  }

  const userId = user._id.toString();

  // Check if friendId is valid
  if (!mongoose.Types.ObjectId.isValid(friendId)) {
    throw new AppError('Invalid friend ID', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
  }

  // Delete friendship from both users
  await FriendService.deleteFriend(userId, friendId);

  // Find and delete the DM conversation between the users
  const conversation = await Conversation.findOne({
    type: 'DM',
    participants: {
      $all: [
        { $elemMatch: { userId: user._id } },
        { $elemMatch: { userId: new mongoose.Types.ObjectId(friendId) } }
      ]
    }
  });

  if (conversation) {
    // Mark conversation as deleted
    await Conversation.updateOne(
      { _id: conversation._id },
      { $set: { status: 'deleted' } }
    );

    // Remove from recent conversations for both users
    await User.updateMany(
      { _id: { $in: [user._id, friendId] } },
      { $pull: { recentConversations: { conversationId: conversation._id } } }
    );
  }

  res.success(null, 'Friend and conversation deleted successfully');
});
