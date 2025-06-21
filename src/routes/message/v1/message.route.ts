import express from "express";
import {
    deleteMessage,
    editMessage,
    getMessages,
    deleteBulkMessages,
    markMessageRead,
    sendAttachment
} from "@controllers/message.controller";
import { authenticate } from "@middleware/auth";
import { validate } from "@middleware/validate";
import { messageValidation } from "@validations/message.validation";
import { uploadMessageAttachments } from "@utils/uploadService";

const router = express.Router();

// Apply authentication middleware to all message routes
router.use(authenticate);

// Get messages for a conversation with pagination
router.get(
    "/conversation/:conversationId",
    // validate(messageValidation.getMessages),
    getMessages
);

// Edit a message
router.patch(
    "/:messageId",
    validate(messageValidation.editMessage),
    editMessage
);

// Delete a message
router.delete(
    "/:messageId",
    validate(messageValidation.deleteMessage),
    deleteMessage
);

// Delete multiple messages
router.delete(
    '/bulk',
    validate(messageValidation.deleteBulkMessages),
    deleteBulkMessages
);

// Mark messages as read in a conversation
router.post(
    "/read/:conversationId",
    validate(messageValidation.markMessageRead),
    markMessageRead
);

// Send an attachment in a conversation
router.post(
    "/conversation/:conversationId/attachments",
    uploadMessageAttachments,
    validate(messageValidation.sendAttachment),
    sendAttachment
);

export default router;
