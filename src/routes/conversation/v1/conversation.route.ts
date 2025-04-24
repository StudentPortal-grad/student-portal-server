import express from "express";
import { createConversation, getConversations, updateGroupImage } from "@controllers/conversation.controller";
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

// Update group image for a conversation
router.patch(
    "/:id/image",
    uploadGroupImage,
    updateGroupImage
);

export default router;
