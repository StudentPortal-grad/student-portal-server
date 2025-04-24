import { Socket } from "socket.io";
import { SocketUtils } from "@utils/socketUtils";
import { ConversationUtils } from "@utils/conversationUtils";
import { SocketError } from "@utils/socketError";

/**
 * Service-specific helper functions for the socket service
 */
export class SocketServiceHelpers {
    /**
     * Handles user connection events
     * @param userId The ID of the user connecting
     * @param socket The socket instance
     */
    static async handleUserConnection(userId: string, socket: Socket) {
        try {
            await SocketUtils.updateUserStatus(userId, "online", socket.id);
            await SocketUtils.joinUserConversations(userId, socket);
        } catch (error) {
            SocketError.handleConnectionError(socket, error as Error);
        }
    }

    /**
     * Handles user disconnection events
     * @param userId The ID of the user disconnecting
     */
    static async handleUserDisconnection(userId: string) {
        try {
            await SocketUtils.updateUserStatus(userId, "offline", null);
        } catch (error) {
            console.error(`Error handling disconnection for user ${userId}:`, error);
        }
    }

    /**
     * Processes a new message
     * @param conversation The conversation object
     * @param userId The user ID who sent the message
     * @param conversationId The conversation ID
     * @param messageId The message ID
     */
    static async processNewMessage(conversation: any, userId: string, conversationId: string, messageId: string) {
        // Update unread counts for other participants
        await ConversationUtils.updateUnreadCounts(conversation, userId, messageId);
        
        // Update sender's recent conversation
        await ConversationUtils.updateSenderRecentConversation(userId, conversationId, messageId);
        
        // Add to recent conversations for any participants missing it
        const allParticipants = conversation.participants.map((p: any) => p.userId.toString());
        await ConversationUtils.addConversationToRecentIfMissing(allParticipants, conversationId, messageId, userId);
    }

    /**
     * Validates if a user can perform an action in a conversation
     * @param socket The socket instance
     * @param userId The user ID
     * @param conversationId The conversation ID
     * @param eventName The event name for error responses
     * @returns Boolean indicating if the user is authorized
     */
    static async validateConversationAccess(socket: Socket, userId: string, conversationId: string, eventName: string) {
        if (!SocketUtils.validateObjectId(conversationId)) {
            SocketUtils.emitError(socket, eventName, "Invalid conversation ID");
            return false;
        }

        const isParticipant = await SocketUtils.isConversationParticipant(userId, conversationId);
        if (!isParticipant) {
            SocketUtils.emitError(socket, eventName, "Not authorized for this conversation");
            return false;
        }

        return true;
    }
}
