import express from "express";
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
    leaveConversation
} from "@controllers/conversation.controller";
import { authenticate } from "@middleware/auth";
import { validate } from "@middleware/validate";
import { conversationValidation } from "@validations/conversation.validation";
import { uploadGroupImage } from "@utils/uploadService";

const router = express.Router();

// Apply authentication middleware to all conversation routes
router.use(authenticate);

// Create a new conversation
router.post(
    "/", 
    uploadGroupImage,
    validate(conversationValidation.createConversation),
    createConversation
);

// Get all conversations for the current user
router.get("/", getConversations);

// Get a specific conversation by ID
router.get(
    "/:id",
    validate(conversationValidation.getConversationById),
    getConversationById
);

// Add members to a group conversation
router.post(
    "/:id/members",
    validate(conversationValidation.addGroupMembers),
    addGroupMembers
);

// Remove a member from a group conversation
router.delete(
    "/:id/members/:memberId",
    validate(conversationValidation.removeGroupMember),
    removeGroupMember
);

// Leave a conversation
router.put(
    "/:id/leave",
    leaveConversation
);

// Update group image for a conversation
router.patch(
    "/:id/image",
    uploadGroupImage,
    updateGroupImage
);

// Get recent conversations
router.get(
    "/recent",
    getRecentConversations
);

// Update recent conversation settings (pin, mute, etc.)
router.patch(
    "/recent/:id",
    validate(conversationValidation.updateRecentConversation),
    updateRecentConversation
);

// Remove conversation from recent list
router.delete(
    "/recent/:id",
    validate(conversationValidation.removeFromRecentConversations),
    removeFromRecentConversations
);

export default router;
