import { Socket } from "socket.io";
import User from "@models/User";
import Conversation from "@models/Conversation";
import Message from "@models/Message";
import { getIO } from "@config/socket";
import { SocketUtils } from "@utils/socketUtils";
import { ConversationUtils } from "@utils/conversationUtils";

interface SendMessageData {
    conversationId: string;
    content: string;
}

/**
 * Handles all socket events related to messages
 */
export const handleMessageEvents = (socket: Socket) => {
    // Regular message sending for existing conversations
    socket.on("sendMessage", async (data: SendMessageData, _callback) => {
        try {
            if (
                !(await SocketUtils.validateRequest(socket, data, [
                    "conversationId",
                    "content",
                ]))
            ) {
                return;
            }

            // Check if user is participant
            if (
                !(await SocketUtils.isConversationParticipant(
                    socket.data.userId,
                    data.conversationId
                ))
            ) {
                return SocketUtils.emitError(
                    socket,
                    "messageSent",
                    "Not authorized for this conversation"
                );
            }

            // Create message and update conversation in parallel
            const messagePromise = Message.create({
                senderId: socket.data.userId,
                conversationId: data.conversationId,
                content: data.content,
            });

            const conversationPromise = Conversation.findById(data.conversationId);

            // Wait for both operations to complete
            const [message, conversation] = await Promise.all([messagePromise, conversationPromise]);

            if (!conversation) {
                return SocketUtils.emitError(
                    socket,
                    "messageSent",
                    "Conversation not found"
                );
            }

            // Use bulkWrite for better performance instead of multiple separate operations
            // First, prepare the conversation update operation
            const conversationUpdate = {
                updateOne: {
                    filter: { _id: data.conversationId },
                    update: {
                        $set: {
                            lastMessage: message._id,
                            "metadata.lastActivity": new Date()
                        },
                        $inc: { "metadata.totalMessages": 1 }
                    }
                }
            };

            // Execute the bulkWrite operation for the conversation update
            await Conversation.bulkWrite([conversationUpdate]);

            // Process any additional message-related updates that can't be included in bulkWrite
            await ConversationUtils.processNewMessage(
                conversation,
                socket.data.userId as string,
                data.conversationId,
                message._id as string
            );

            // Populate message for broadcast using Model.populate() instead of a separate query
            const populatedMessage = await Message.populate(message, {
                path: "senderId",
                select: "name profilePicture"
            });

            // Convert to plain object for socket transmission
            const messageToSend = populatedMessage.toObject ?
                populatedMessage.toObject() : JSON.parse(JSON.stringify(populatedMessage));

            // Broadcast to other participants
            socket.broadcast.to(data.conversationId).emit("newMessage", {
                message: messageToSend,
                conversationId: data.conversationId,
            });

            SocketUtils.emitSuccess(socket, "messageSent");
        } catch (error) {
            console.error("Error sending message:", error);
            SocketUtils.emitError(socket, "messageSent");
        }
    });

    // Delete message
    socket.on("deleteMessage", async (data, _callback) => {
        try {
            if (
                !(await SocketUtils.validateRequest(socket, data, [
                    "messageId",
                    "conversationId",
                ]))
            ) {
                return;
            }

            // Use findOneAndDelete to reduce queries
            const message = await Message.findOneAndDelete({
                _id: data.messageId,
                senderId: socket.data.userId
            });

            if (!message) {
                return SocketUtils.emitError(
                    socket,
                    "messageDeleted",
                    "Not authorized to delete this message"
                );
            }

            // Notify other participants (not the sender)
            socket.broadcast.to(data.conversationId).emit("messageDeleted", {
                messageId: data.messageId,
                conversationId: data.conversationId,
            });

            SocketUtils.emitSuccess(socket, "messageDeleted");
        } catch (error) {
            console.error("Error deleting message:", error);
            SocketUtils.emitError(socket, "messageDeleted");
        }
    });

    socket.on("editMessage", async (data, _callback) => {
        try {
            if (
                !(await SocketUtils.validateRequest(socket, data, [
                    "messageId",
                    "conversationId",
                    "content",
                ]))
            ) {
                return;
            }

            // Use findOneAndUpdate to reduce queries
            const message = await Message.findOneAndUpdate(
                {
                    _id: data.messageId,
                    senderId: socket.data.userId
                },
                {
                    $set: { content: data.content },
                    $currentDate: { updatedAt: true }
                },
                { new: true }
            );

            if (!message) {
                return SocketUtils.emitError(
                    socket,
                    "messageEdited",
                    "Not authorized to edit this message"
                );
            }

            // Notify other participants (not the sender)
            socket.broadcast.to(data.conversationId).emit("messageEdited", {
                messageId: data.messageId,
                conversationId: data.conversationId,
                content: data.content,
            });

            SocketUtils.emitSuccess(socket, "messageEdited");
        } catch (error) {
            console.error("Error editing message:", error);
            SocketUtils.emitError(socket, "messageEdited");
        }
    });

    // Typing indicators
    socket.on("typing", (data) => {
        socket.broadcast.to(data.conversationId).emit("userTyping", {
            userId: socket.data.userId,
            conversationId: data.conversationId,
        });
    });

    socket.on("stopTyping", (data) => {
        socket.broadcast.to(data.conversationId).emit("userStoppedTyping", {
            userId: socket.data.userId,
            conversationId: data.conversationId,
        });
    });

    // Message read receipts
    socket.on("markMessageRead", async (data, _callback) => {
        try {
            // Update the user's lastSeen timestamp and reset unread count
            await User.updateOne(
                {
                    _id: socket.data.userId,
                    "recentConversations.conversationId": data.conversationId,
                },
                {
                    $set: {
                        lastSeen: new Date(),
                        "recentConversations.$.unreadCount": 0,
                    },
                }
            );

            // Notify other participants
            socket.to(data.conversationId).emit("messageRead", {
                userId: socket.data.userId,
                conversationId: data.conversationId,
                lastSeen: new Date(),
            });

            socket.emit("messageMarkedRead", { success: true });
        } catch (error) {
            console.error("Error marking message as read:", error);
            socket.emit("messageMarkedRead", { success: false });
        }
    });
};
