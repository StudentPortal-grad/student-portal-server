import User from '@models/User';
import Conversation from '@models/Conversation';
import { SocketUtils } from '@utils/socketUtils';
import { AppError, ErrorCodes } from '@utils/appError';
// Import types for socket.io global instance
declare global {
  var io: any;
}
import mongoose, { Types } from 'mongoose';
import { HttpStatus } from '@utils/ApiResponse';

export class FriendService {
  /**
   * Validate friend request
   */
  static async validateFriendRequest(senderId: string, recipientId: string) {
    // Check if recipient exists
    const recipient = await User.findById(recipientId).select('_id friendRequests friends');
    if (!recipient) {
      throw new AppError('Recipient not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Check if sender exists
    const sender = await User.findById(senderId).select('_id friends');
    if (!sender) {
      throw new AppError('Sender not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Check if users are already friends
    const alreadyFriends = sender.friends?.some(
      (friend) => friend.userId.toString() === recipientId
    );
    if (alreadyFriends) {
      throw new AppError('Users are already friends', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    // Check if request already sent
    const requestAlreadySent = recipient.friendRequests?.some(
      (request) => request.userId.toString() === senderId
    );
    if (requestAlreadySent) {
      throw new AppError('Friend request already sent', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    // Get recipient's socket ID if online
    const recipientData = await SocketUtils.getUserData(recipientId);
    const recipientSocketId = recipientData?.socketId;

    return {
      valid: true,
      recipientSocketId
    };
  }

  /**
   * Validate friend request acceptance
   */
  static async validateFriendAcceptance(senderId: string, recipientId: string) {
    // Check if sender exists
    const sender = await User.findById(senderId).select('_id');
    if (!sender) {
      throw new AppError('Sender not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Check if recipient exists and has the request
    const recipient = await User.findById(recipientId).select('friendRequests');
    if (!recipient) {
      throw new AppError('Recipient not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Check if friend request exists
    const requestExists = recipient.friendRequests?.some(
      (request) => request.userId.toString() === senderId
    );
    if (!requestExists) {
      throw new AppError('Friend request not found', HttpStatus.BAD_REQUEST, ErrorCodes.NOT_FOUND);
    }

    // Get sender's socket ID if online
    const senderData = await SocketUtils.getUserData(senderId);
    const senderSocketId = senderData?.socketId;

    return {
      valid: true,
      senderSocketId
    };
  }

  /**
   * Create DM conversation
   */
  static async createDMConversation(userId1: string, userId2: string) {
    const conversation = new Conversation({
      type: 'DM',
      participants: [
        { userId: new mongoose.Types.ObjectId(userId1) },
        { userId: new mongoose.Types.ObjectId(userId2) }
      ],
      createdBy: userId1
    });

    await conversation.save();
    return conversation;
  }

  /**
   * Update friendship records
   */
  static async updateFriendshipRecords(userId1: string, userId2: string, conversationId: string) {
    // Add friend to both users' friends list
    await User.updateOne(
      { _id: userId1 },
      {
        $push: { friends: { userId: userId2, conversationId } },
        $pull: { friendRequests: { userId: userId2 } }
      }
    );

    await User.updateOne(
      { _id: userId2 },
      {
        $push: { friends: { userId: userId1, conversationId } }
      }
    );
  }

  /**
   * Send a friend request
   */
  static async sendFriendRequest(senderId: string, recipientId: string) {
    if (!SocketUtils.validateObjectId(recipientId)) {
      throw new AppError('Invalid recipient ID', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    const validation = await this.validateFriendRequest(senderId, recipientId);

    // Add to recipient's friend requests
    await User.updateOne(
      { _id: recipientId },
      {
        $push: {
          friendRequests: {
            userId: senderId,
            createdAt: new Date()
          }
        }
      }
    );

    // Notify recipient if online
    if (validation.recipientSocketId) {
      global.io.to(validation.recipientSocketId).emit('friendRequestReceived', {
        userId: senderId
      });
    }
    return { success: true };
  }

  /**
   * Get friend requests for a user
   */
  static async getFriendRequests(userId: string, page: number = 1, limit: number = 10) {
    // Use projection for better performance
    const user = await User.findById(userId)
      .select('friendRequests')
      .populate({
        path: 'friendRequests.userId',
        select: 'name username profilePicture status lastSeen level college'
      });

    if (!user) {
      throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Set pagination parameters
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    // Get paginated requests
    const paginatedRequests = user.friendRequests?.slice(startIndex, endIndex) || [];

    // Calculate pagination metadata
    const totalRequests = user.friendRequests?.length || 0;
    const totalPages = Math.ceil(totalRequests / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return {
      requests: paginatedRequests,
      pagination: {
        total: totalRequests,
        page,
        limit,
        totalPages,
        hasNextPage,
        hasPrevPage,
        nextPage: hasNextPage ? page + 1 : null,
        prevPage: hasPrevPage ? page - 1 : null
      }
    };
  }

  /**
   * Accept a friend request
   */
  static async acceptFriendRequest(senderId: string, recipientId: string) {
    const validation = await this.validateFriendAcceptance(senderId, recipientId);

    // Create DM conversation and update friendship records
    const conversation = await this.createDMConversation(recipientId, senderId);

    await this.updateFriendshipRecords(recipientId, senderId, conversation._id as string);

    // Notify sender if online
    if (validation.senderSocketId) {
      global.io.to(validation.senderSocketId).emit('friendRequestAccepted', {
        userId: recipientId,
        conversationId: conversation._id
      });
    }
    return {
      userId: senderId,
      conversationId: conversation._id
    };
  }

  /**
   * Reject a friend request
   */
  static async rejectFriendRequest(userId: string, senderId: string) {
    if (!SocketUtils.validateObjectId(senderId)) {
      throw new AppError('Invalid sender ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Remove the friend request with optimized query
    const result = await User.updateOne(
      { _id: userId },
      {
        $pull: {
          friendRequests: {
            userId: senderId
          }
        }
      }
    );

    if (result.modifiedCount === 0) {
      throw new AppError('Friend request not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }

    return { success: true };
  }

  /**
   * Get friends list for a user
   */
  static async getFriends(userId: string, page: number = 1, limit: number = 10) {
    // Use projection for better performance
    const user = await User.findById(userId)
      .select('friends')
      .populate({
        path: 'friends.userId',
        select: 'name username profilePicture status lastSeen level college'
      });

    if (!user) {
      throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Set pagination parameters
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    // Get paginated friends
    const paginatedFriends = user.friends?.slice(startIndex, endIndex) || [];

    // Calculate pagination metadata
    const totalFriends = user.friends?.length || 0;
    const totalPages = Math.ceil(totalFriends / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return {
      friends: paginatedFriends,
      pagination: {
        total: totalFriends,
        page,
        limit,
        totalPages,
        hasNextPage,
        hasPrevPage,
        nextPage: hasNextPage ? page + 1 : null,
        prevPage: hasPrevPage ? page - 1 : null
      }
    };
  }

  /**
   * Delete a friend relationship between two users
   * @param userId ID of the current user (already authenticated)
   * @param friendId ID of the friend to delete
   */
  static async deleteFriend(userId: string, friendId: string) {
    // Check if friend exists
    const friend = await User.findById(friendId);
    if (!friend) {
      throw new AppError('Friend not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }

    // Get current user to check friendship status
    const user = await User.findById(userId).select('friends');
    if (!user) {
      throw new AppError('User not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }

    // Check if they are actually friends
    const areFriends = user.friends?.some(
      (friend) => friend.userId.toString() === friendId
    );

    if (!areFriends) {
      throw new AppError('Users are not friends', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    // Remove friend from both users' friends lists
    await Promise.all([
      User.updateOne(
        { _id: userId },
        { $pull: { friends: { userId: friendId } } }
      ),
      User.updateOne(
        { _id: friendId },
        { $pull: { friends: { userId: userId } } }
      )
    ]);

    // Get friend's socket ID if online for notification
    const friendData = await SocketUtils.getUserData(friendId);
    const friendSocketId = friendData?.socketId;

    if (friendSocketId && global.io) {
      global.io.to(friendSocketId).emit('friendRemoved', { userId });
    }

    return { success: true };
  }
}
