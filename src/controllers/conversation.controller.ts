import { Request, Response, NextFunction } from 'express';
import Conversation from '../models/Conversation';
import Message from '../models/Message';
import User from '../models/User';
import { Types } from 'mongoose';
import { AppError, ErrorCodes } from '../utils/appError';
import { ResponseBuilder, HttpStatus } from '../utils/ApiResponse';
import asyncHandler from '../utils/asyncHandler';

/**
 * Create a new conversation
 * @route POST /api/v1/conversation
 */
export const createConversation = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const {
      participants,
      name,
      description,
      type = 'GroupDM',
      groupImage,
    } = req.body;
    const userId = req.user?._id;

    if (!userId) {
      throw new AppError(
        'User not authenticated',
        HttpStatus.UNAUTHORIZED,
        ErrorCodes.UNAUTHORIZED
      );
    }

    // Validate required fields
    if (!participants || !Array.isArray(participants)) {
      throw new AppError(
        'Participants array is required',
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    // If type is DM, check for existing conversation
    if (type === 'DM') {
      if (participants.length !== 1) {
        throw new AppError('For a DM, exactly one other participant is required.', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
      }
      const recipientId = participants[0];
      if (!Types.ObjectId.isValid(recipientId)) {
        throw new AppError(`Invalid participant ID: ${recipientId}`, HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
      }
      if (userId.equals(recipientId)) {
        throw new AppError('You cannot create a DM conversation with yourself.', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
      }

      const allParticipantIds = [userId, new Types.ObjectId(recipientId)];
      const existingConversation = await Conversation.findOne({
        type: 'DM',
        'participants.userId': { $all: allParticipantIds, $size: 2 },
      }).populate([
        { path: 'participants.userId', select: 'name profilePicture status lastSeen' },
        { path: 'createdBy', select: 'name profilePicture' },
      ]);

      if (existingConversation) {
        res.success({ conversation: existingConversation }, 'Conversation already exists.', HttpStatus.OK);
        return;
      }
    }

    // Validate all participant IDs
    for (const id of participants) {
      if (!Types.ObjectId.isValid(id)) {
        throw new AppError(
          `Invalid participant ID: ${id}`,
          HttpStatus.BAD_REQUEST,
          ErrorCodes.VALIDATION_ERROR
        );
      }
    }

    // Determine participant structure based on conversation type
    let conversationParticipants;
    if (type === 'DM') {
        conversationParticipants = [
            { userId },
            { userId: new Types.ObjectId(participants[0]) }
        ];
    } else { // For GroupDM and other types
        conversationParticipants = [
            { userId, role: 'owner', isAdmin: true },
            ...participants
              .filter((id: string) => id !== userId.toString())
              .map((id: string) => ({
                userId: new Types.ObjectId(id),
                role: 'member',
              })),
        ];
    }

    // Create conversation document
    const conversation = await Conversation.create({
      type,
      participants: conversationParticipants,
      name,
      description,
      groupImage,
      createdBy: userId,
    });

    // Update all users in a single batch operation
    const allParticipantObjectIds = [userId, ...participants.map((id: string) => new Types.ObjectId(id))];
    await User.updateMany(
      { _id: { $in: allParticipantObjectIds } },
      {
        $push: {
          recentConversations: {
            $each: [{
              conversationId: conversation._id,
              unreadCount: 0,
              isPinned: false,
              isMuted: false,
            }],
            $position: 0
          },
        },
      }
    );

    // Populate conversation data
    const populatedConversation = await Conversation.populate(conversation, [
      { path: 'participants.userId', select: 'name profilePicture' },
      { path: 'createdBy', select: 'name profilePicture' },
    ]);

    // Convert to plain object for response
    const conversationToSend = populatedConversation.toObject
      ? populatedConversation.toObject()
      : populatedConversation;

    res.success(
      { conversation: conversationToSend },
      'Conversation created successfully',
      HttpStatus.CREATED
    );
  }
);

/**
 * Update group image for a conversation
 * @route PATCH /api/v1/conversations/:id/image
 */
export const updateGroupImage = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const { id } = req.params;
    const { groupImage } = req.body;
    const userId = req.user?._id;

    if (!userId) {
      throw new AppError(
        'User not authenticated',
        HttpStatus.UNAUTHORIZED,
        ErrorCodes.UNAUTHORIZED
      );
    }

    // Validate conversation ID
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError(
        'Invalid conversation ID',
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    // Check if conversation exists and user is a participant with admin rights
    const conversation = await Conversation.findOne({
      _id: id,
      participants: {
        $elemMatch: {
          userId: userId,
          isAdmin: true,
        },
      },
    });

    if (!conversation) {
      throw new AppError(
        "Conversation not found or you don't have permission",
        HttpStatus.NOT_FOUND,
        ErrorCodes.NOT_FOUND
      );
    }

    // Update the group image
    conversation.groupImage = groupImage;
    await conversation.save();

    res.success(
      { groupImage: conversation.groupImage },
      'Group image updated successfully'
    );
  }
);

/**
 * Get all conversations for the current user
 * @route GET /api/v1/conversations
 */
export const getConversations = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const userId = req.user?._id;

    if (!userId) {
      throw new AppError(
        'User not authenticated',
        HttpStatus.UNAUTHORIZED,
        ErrorCodes.UNAUTHORIZED
      );
    }

    const conversations = await Conversation.findActiveConversations(userId);

    res.success({ conversations }, 'Conversations retrieved successfully');
  }
);

/**
 * Get a specific conversation by ID
 * @route GET /api/v1/conversation/:id
 */
export const getConversationById = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const { id } = req.params;
    const userId = req.user?._id;

    if (!userId) {
      throw new AppError(
        'User not authenticated',
        HttpStatus.UNAUTHORIZED,
        ErrorCodes.UNAUTHORIZED
      );
    }

    // Validate conversation ID
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError(
        'Invalid conversation ID',
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    // Find conversation and check if user is a participant
    const conversation = await Conversation.findOne({
      _id: id,
      'participants.userId': userId,
      status: 'active',
    })
      .populate('participants.userId', 'name profilePicture status')
      .populate('lastMessage')
      .populate('createdBy', 'name profilePicture');

    if (!conversation) {
      throw new AppError(
        "Conversation not found or you're not a participant",
        HttpStatus.NOT_FOUND,
        ErrorCodes.NOT_FOUND
      );
    }

    res.success({ conversation }, 'Conversation retrieved successfully');
  }
);

/**
 * Add members to a group conversation
 * @route POST /api/v1/conversation/:id/members
 */
export const addGroupMembers = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const { id } = req.params;
    const { userIds } = req.body;
    const userId = req.user?._id;

    if (!userId) {
      throw new AppError(
        'User not authenticated',
        HttpStatus.UNAUTHORIZED,
        ErrorCodes.UNAUTHORIZED
      );
    }

    // Validate conversation ID
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError(
        'Invalid conversation ID',
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    // Check if conversation exists and is a group
    const conversation = await Conversation.findById(id);
    if (!conversation || conversation.type !== 'GroupDM') {
      throw new AppError(
        'Invalid conversation or not a group',
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    // Check if user is admin/owner
    const userRole = conversation.participants.find(
      (p) => p.userId.toString() === userId.toString()
    )?.role;

    if (!userRole || !['owner', 'admin'].includes(userRole)) {
      throw new AppError(
        'Not authorized to add members',
        HttpStatus.FORBIDDEN,
        ErrorCodes.FORBIDDEN
      );
    }

    // Filter out existing participants
    const existingParticipantIds = conversation.participants.map((p) =>
      p.userId.toString()
    );
    const newUserIds = userIds.filter(
      (id: string) => !existingParticipantIds.includes(id)
    );

    if (newUserIds.length === 0) {
      throw new AppError(
        'All users are already members',
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    // Add new participants
    const newParticipants = newUserIds.map((userId: string) => ({
      userId: new Types.ObjectId(userId),
      role: 'member',
      joinedAt: new Date(),
      lastSeen: new Date(),
      isAdmin: false,
    }));

    // Use bulkWrite for better performance
    await Conversation.updateOne(
      { _id: id },
      { $push: { participants: { $each: newParticipants } } }
    );

    await User.updateMany(
      { _id: { $in: newUserIds } },
      {
        $push: {
          recentConversations: {
            conversationId: id,
            unreadCount: 0,
            isPinned: false,
            isMuted: false,
          },
        },
      }
    );

    // Get updated conversation
    const updatedConversation = await Conversation.findById(id)
      .populate('participants.userId', 'name profilePicture status')
      .populate('lastMessage')
      .populate('createdBy', 'name profilePicture');

    res
      .status(HttpStatus.OK)
      .json(
        ResponseBuilder.success(
          { conversation: updatedConversation, newMembers: newUserIds },
          'Members added to conversation successfully'
        )
      );
  }
);

/**
 * Remove a member from a group conversation
 * @route DELETE /api/v1/conversation/:id/members/:memberId
 */
export const removeGroupMember = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const { id, memberId } = req.params;
    const userId = req.user?._id;

    if (!userId) {
      throw new AppError(
        'User not authenticated',
        HttpStatus.UNAUTHORIZED,
        ErrorCodes.UNAUTHORIZED
      );
    }

    // Validate IDs
    if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(memberId)) {
      throw new AppError(
        'Invalid ID format',
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    // Check if conversation exists and is a group
    const conversation = await Conversation.findById(id);
    if (!conversation || conversation.type !== 'GroupDM') {
      throw new AppError(
        'Invalid conversation or not a group',
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    // Check if user is admin/owner
    const userRole = conversation.participants.find(
      (p) => p.userId.toString() === userId.toString()
    )?.role;

    if (!userRole || !['owner', 'admin'].includes(userRole)) {
      throw new AppError(
        'Not authorized to remove members',
        HttpStatus.FORBIDDEN,
        ErrorCodes.FORBIDDEN
      );
    }

    // Cannot remove the owner
    const memberToRemove = conversation.participants.find(
      (p) => p.userId.toString() === memberId
    );

    if (!memberToRemove) {
      throw new AppError(
        'Member not found in conversation',
        HttpStatus.NOT_FOUND,
        ErrorCodes.NOT_FOUND
      );
    }

    if (memberToRemove.role === 'owner') {
      throw new AppError(
        'Cannot remove the conversation owner',
        HttpStatus.FORBIDDEN,
        ErrorCodes.FORBIDDEN
      );
    }

    // Remove member from conversation
    await Conversation.updateOne(
      { _id: id },
      { $pull: { participants: { userId: memberId } } }
    );

    // Remove conversation from user's recent conversations
    await User.updateOne(
      { _id: memberId },
      { $pull: { recentConversations: { conversationId: id } } }
    );

    res.success(null, 'Member removed successfully');
  }
);

/**
 * Leave a conversation
 * @route POST /api/v1/conversation/:id/leave
 */
export const leaveConversation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;

    if (!userId) {
      return next(
        new AppError('User not authenticated', 401, ErrorCodes.UNAUTHORIZED)
      );
    }

    // Validate conversation ID
    if (!Types.ObjectId.isValid(id)) {
      return next(
        new AppError(
          'Invalid conversation ID',
          400,
          ErrorCodes.VALIDATION_ERROR
        )
      );
    }

    // Check if conversation exists
    const conversation = await Conversation.findById(id);
    if (!conversation) {
      return next(
        new AppError('Conversation not found', 404, ErrorCodes.NOT_FOUND)
      );
    }

    // Check if user is a participant
    const userParticipant = conversation.participants.find(
      (p) => p.userId.toString() === userId.toString()
    );

    if (!userParticipant) {
      return next(
        new AppError(
          'You are not a participant in this conversation',
          403,
          ErrorCodes.FORBIDDEN
        )
      );
    }

    // Cannot leave if you're the owner of a group conversation
    if (conversation.type === 'GroupDM' && userParticipant.role === 'owner') {
      return next(
        new AppError(
          'As the owner, you cannot leave the group. Transfer ownership first or delete the group.',
          400,
          ErrorCodes.VALIDATION_ERROR
        )
      );
    }

    // For DM conversations, delete the conversation, its messages, and remove from both users' recents
    if (conversation.type === 'DM') {
      // Delete all messages in the conversation
      await Message.deleteMany({ conversationId: id });

      // Get both participant IDs to remove from their recent lists
      const participantIds = conversation.participants.map((p) => p.userId);

      // Remove the conversation from both users' recent lists
      await User.updateMany(
        { _id: { $in: participantIds } },
        { $pull: { recentConversations: { conversationId: id } } }
      );

      // Finally, delete the conversation itself
      await conversation.deleteOne();
    } else {
      // For group conversations, remove from participants
      await Conversation.updateOne(
        { _id: id },
        { $pull: { participants: { userId } } }
      );

      // Also remove from recent conversations
      await User.updateOne(
        { _id: userId },
        { $pull: { recentConversations: { conversationId: id } } }
      );
    }

    res.success(null, 'Left conversation successfully');
  } catch (error) {
    console.error('Error leaving conversation:', error);
    next(
      new AppError(
        'Failed to leave conversation',
        500,
        ErrorCodes.INTERNAL_ERROR
      )
    );
  }
};

/**
 * Get recent conversations
 * @route GET /api/v1/conversation/recent
 */
export const getRecentConversations = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return next(
        new AppError('User not authenticated', 401, ErrorCodes.UNAUTHORIZED)
      );
    }

    // Get user's recent conversations with populated data
    const user = await User.findById(userId)
      .select('recentConversations')
      .populate({
        path: 'recentConversations.conversationId',
        select: 'participants lastMessage name type metadata',
        populate: [
          {
            path: 'participants.userId',
            select: 'name profilePicture status lastSeen',
          },
          {
            path: 'lastMessage',
            select: 'content createdAt senderId',
          },
        ],
      })
      .lean();

    if (!user) {
      return next(new AppError('User not found', 404, ErrorCodes.NOT_FOUND));
    }

    // Sort in memory for better performance
    const sortedConversations = user.recentConversations
      ? user.recentConversations
        .filter((conv) => conv.conversationId) // Filter out any null references
        .sort((a, b) => {
          // First sort by pinned status
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;

          // Then by last activity
          const aConversation = a.conversationId as any;
          const bConversation = b.conversationId as any;
          const aLastActivity =
            aConversation?.metadata?.lastActivity || new Date(0);
          const bLastActivity =
            bConversation?.metadata?.lastActivity || new Date(0);
          return (
            new Date(bLastActivity).getTime() -
            new Date(aLastActivity).getTime()
          );
        })
      : [];

    res.success(
      { conversations: sortedConversations },
      'Recent conversations retrieved successfully'
    );
  } catch (error) {
    console.error('Error getting recent conversations:', error);
    next(
      new AppError(
        'Failed to get recent conversations',
        500,
        ErrorCodes.INTERNAL_ERROR
      )
    );
  }
};

/**
 * @desc    Clear all messages from a conversation
 * @route   DELETE /api/v1/conversations/:id/clear
 * @access  Private (Participants only, admin/owner for groups)
 */
export const clearConversationHistory = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const userId = req.user?._id;

    if (!userId) {
      return next(
        new AppError('User not authenticated', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED)
      );
    }

    const conversation = await Conversation.findOne({
        _id: id,
        'participants.userId': userId,
    });

    if (!conversation) {
        return next(new AppError('Conversation not found or you are not a participant', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND));
    }
    
    const participant = conversation.participants.find(p => p.userId.equals(userId));

    // For group chats, only admins or the owner can clear the history
    if (conversation.type === 'GroupDM' && (!participant || !['admin', 'owner'].includes(participant.role))) {
        return next(new AppError('Only group admins or the owner can clear the conversation history', HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN));
    }

    // Delete all messages for the conversation
    const deleteResult = await Message.deleteMany({ conversationId: id });

    // Update the lastMessage field on the conversation to null and update lastActivity
    await Conversation.updateOne({ _id: id }, { $unset: { lastMessage: "" }, $set: { "metadata.lastActivity": new Date() } });

    res.success({ messagesDeleted: deleteResult.deletedCount }, 'Conversation history cleared successfully');
  }
);

/**
 * Update recent conversation settings (pin, mute, etc.)
 * @route PATCH /api/v1/conversations/recent/:id
 * @access  Private
 */
export const updateRecentConversation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { isPinned, isMuted, mutedUntil } = req.body;
    const userId = req.user?._id;

    if (!userId) {
      return next(
        new AppError('User not authenticated', 401, ErrorCodes.UNAUTHORIZED)
      );
    }

    // Validate conversation ID
    if (!Types.ObjectId.isValid(id)) {
      return next(
        new AppError(
          'Invalid conversation ID',
          400,
          ErrorCodes.VALIDATION_ERROR
        )
      );
    }

    // Build update object dynamically based on provided fields
    const updateData: any = {};

    if (isPinned !== undefined) {
      updateData['recentConversations.$.isPinned'] = isPinned;
    }

    if (isMuted !== undefined) {
      updateData['recentConversations.$.isMuted'] = isMuted;

      if (isMuted && mutedUntil) {
        updateData['recentConversations.$.mutedUntil'] = new Date(mutedUntil);
      } else if (!isMuted) {
        updateData['recentConversations.$.mutedUntil'] = null;
      }
    }

    // Skip update if no fields to update
    if (Object.keys(updateData).length === 0) {
      return next(
        new AppError('No fields to update', 400, ErrorCodes.VALIDATION_ERROR)
      );
    }

    // Perform update with optimized query
    const result = await User.updateOne(
      {
        _id: userId,
        'recentConversations.conversationId': id,
      },
      { $set: updateData }
    );

    if (result.modifiedCount === 0) {
      return next(
        new AppError(
          'Conversation not found in recent list',
          404,
          ErrorCodes.NOT_FOUND
        )
      );
    }

    res.success(
      {
        conversationId: id,
        updates: {
          isPinned,
          isMuted,
          mutedUntil,
        },
      },
      'Conversation settings updated successfully'
    );
  } catch (error) {
    console.error('Error updating recent conversation:', error);
    next(
      new AppError(
        'Failed to update recent conversation',
        500,
        ErrorCodes.INTERNAL_ERROR
      )
    );
  }
};

/**
 * Remove conversation from recent list
 * @route DELETE /api/v1/conversation/recent/:id
 */
export const removeFromRecentConversations = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const { id: conversationId } = req.params;
    const userId = req.user?._id;

    if (!userId) {
      throw new AppError('User not authenticated', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
    }

    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      throw new AppError('Conversation not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }

    const isParticipant = conversation.participants.some(p => p.userId.equals(userId));
    if (!isParticipant) {
      throw new AppError('You are not a member of this conversation', HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN);
    }

    if (conversation.type === 'DM') {
      // --- DM Deletion: Delete for all participants ---
      const participantIds = conversation.participants.map(p => p.userId);

      await Conversation.findByIdAndDelete(conversationId);
      await Message.deleteMany({ conversationId: conversationId });
      await User.updateMany(
        { _id: { $in: participantIds } },
        { $pull: { recentConversations: { conversationId: new Types.ObjectId(conversationId) } } }
      );

      res.success(null, 'DM Conversation deleted successfully');

    } else if (conversation.type === 'GroupDM') {
      // --- Group Leaving: Remove only the current user ---
      if (conversation.createdBy.equals(userId)) {
        throw new AppError(
          'Owner cannot leave the group using this action. You must delete the group entirely via the DELETE /conversations/:id endpoint.',
          HttpStatus.BAD_REQUEST,
          ErrorCodes.VALIDATION_ERROR
        );
      }

      // 1. Remove user from conversation's participants list
      await Conversation.updateOne(
        { _id: conversationId },
        { $pull: { participants: { userId: userId } } }
      );

      // 2. Remove conversation from user's recent list
      await User.updateOne(
        { _id: userId },
        { $pull: { recentConversations: { conversationId: new Types.ObjectId(conversationId) } } }
      );

      res.success(null, 'Successfully left the group conversation');
    } else {
      throw new AppError('This action is not supported for this conversation type', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }
  }
);

/**
 * Search recent conversations by name
 * @route GET /v1/conversation/search
 */
export const searchConversations = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const searchQuery = req.query.query as string;
    const userId = req.user?._id;

    if (!userId) {
      throw new AppError(
        'User not authenticated',
        HttpStatus.UNAUTHORIZED,
        ErrorCodes.UNAUTHORIZED
      );
    }

    if (!searchQuery) {
      throw new AppError(
        'Search query is required',
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    // Get user's recent conversations with populated data
    const user = await User.findById(userId)
      .select('recentConversations')
      .populate({
        path: 'recentConversations.conversationId',
        select: 'participants lastMessage name type metadata',
        populate: [
          {
            path: 'participants.userId',
            select: 'name profilePicture status lastSeen',
          },
          {
            path: 'lastMessage',
            select: 'content createdAt senderId',
          },
        ],
      })
      .lean();

    if (!user || !user.recentConversations) {
      res.success({ conversations: [] }, 'No conversations found');
      return;
    }

    // Filter conversations by name (for group chats) or participant name (for DMs)
    const filteredConversations = user.recentConversations
      .filter((conv) => {
        if (!conv.conversationId) return false;

        const conversation = conv.conversationId as any;

        // For group chats, search by name
        if (conversation.type === 'GroupDM' && conversation.name) {
          return conversation.name.toLowerCase().includes(searchQuery.toLowerCase());
        }

        // For DMs, search by participant name
        if (conversation.type === 'DM' && conversation.participants) {
          // Find the other participant (not the current user)
          const otherParticipant = conversation.participants.find(
            (p: any) =>
              p.userId && p.userId._id.toString() !== userId.toString()
          );

          if (
            otherParticipant &&
            otherParticipant.userId &&
            otherParticipant.userId.name
          ) {
            return otherParticipant.userId.name
              .toLowerCase()
              .includes(searchQuery.toLowerCase());
          }
        }

        return false;
      })
      .sort((a, b) => {
        // First sort by pinned status
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;

        // Then by last activity
        const aConversation = a.conversationId as any;
        const bConversation = b.conversationId as any;
        const aLastActivity =
          aConversation?.metadata?.lastActivity || new Date(0);
        const bLastActivity =
          bConversation?.metadata?.lastActivity || new Date(0);
        return (
          new Date(bLastActivity).getTime() - new Date(aLastActivity).getTime()
        );
      });

    res.success(
      { conversations: filteredConversations },
      'Conversations search results'
    );
  }
);

/**
 * Delete a conversation and its messages
 * @route DELETE /v1/conversations/:id
 */
export const deleteConversation = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const { id: conversationId } = req.params;
    const userId = req.user?._id;

    if (!userId) {
      throw new AppError(
        'User not authenticated',
        HttpStatus.UNAUTHORIZED,
        ErrorCodes.UNAUTHORIZED
      );
    }

    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      throw new AppError(
        'Conversation not found',
        HttpStatus.NOT_FOUND,
        ErrorCodes.NOT_FOUND
      );
    }

    // Authorization: User must be a participant.
    const participant = conversation.participants.find(p => p.userId.equals(userId));
    if (!participant) {
      throw new AppError(
        'You are not a participant of this conversation',
        HttpStatus.FORBIDDEN,
        ErrorCodes.FORBIDDEN
      );
    }

    // For GroupDM, only the owner can delete the entire conversation.
    if (conversation.type === 'GroupDM' && !conversation.createdBy.equals(userId)) {
      throw new AppError(
        'Only the group owner can delete this conversation. You can leave the group instead.',
        HttpStatus.FORBIDDEN,
        ErrorCodes.FORBIDDEN
      );
    }

    // --- Deletion Process ---
    const participantIds = conversation.participants.map(p => p.userId);

    // 1. Delete the conversation itself
    await Conversation.findByIdAndDelete(conversationId);

    // 2. Delete all associated messages
    await Message.deleteMany({ conversationId: conversationId });

    // 3. Remove the conversation from all participants' recent conversation lists
    await User.updateMany(
      { _id: { $in: participantIds } },
      { $pull: { recentConversations: { conversationId: new Types.ObjectId(conversationId) } } }
    );

    // TODO: Emit a socket event to notify clients to remove the conversation

    res.success(null, 'Conversation deleted successfully');
  }
);
