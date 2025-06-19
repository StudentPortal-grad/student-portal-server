import express from 'express';
import {
  createConversation,
  getConversations,
  updateGroupImage,
  getConversationById,
  addGroupMembers,
  removeGroupMember,
  getRecentConversations,
  updateRecentConversation,
  removeFromRecentConversations,
  leaveConversation,
  deleteConversation,
  clearConversationHistory,
  searchConversations,
} from '@controllers/conversation.controller';
import { authenticate } from '@middleware/auth';
import { validate } from '@middleware/validate';
import { conversationValidation } from '@validations/conversation.validation';
import { uploadGroupImage, uploadMessageAttachments } from '@utils/uploadService';
import { sendAttachment } from '@controllers/message.controller';

const router = express.Router();

// Apply authentication middleware to all conversation routes
router.use(authenticate);

// Create a new conversation
router.post(
  '/',
  uploadGroupImage,
  validate(conversationValidation.createConversation),
  createConversation
);

// Get all conversations for the current user
router.get('/', getConversations);

// Delete a conversation and its messages
router.delete(
  '/:id',
  validate(conversationValidation.deleteConversation, "params"),
  deleteConversation
);

// Get recent conversations
router.get('/recent', getRecentConversations);

// Search conversations by name
router.get('/search', searchConversations);

// Get a specific conversation by ID
router.get('/:id', getConversationById);

// Add members to a group conversation
router.post(
  '/:id/members',
  validate(conversationValidation.addGroupMembers),
  addGroupMembers
);

// Remove a member from a group conversation
router.delete('/:id/members/:memberId', removeGroupMember);

// Leave a conversation
router.put('/:id/leave', leaveConversation);

// Clear conversation history
router.delete('/:id/clear', clearConversationHistory);

// Update group image for a conversation
router.patch('/:id/image', uploadGroupImage, updateGroupImage);

// Update recent conversation settings (pin, mute, etc.)
router.patch(
  '/recent/:id',
  validate(conversationValidation.updateRecentConversation),
  updateRecentConversation
);

// Send Message
router.post(
  "/:conversationId/message",
  uploadMessageAttachments,
  sendAttachment
);

// Leaving
// router.delete('/:id', removeFromRecentConversations);

export default router;
