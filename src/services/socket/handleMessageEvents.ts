import { Socket } from "socket.io";
import User from "@models/User";
import Conversation from "@models/Conversation";
import Message from "@models/Message";
import { SocketUtils } from "../../utils/socketUtils";
import { ConversationUtils } from "../../utils/conversationUtils";
import { ChatbotService } from "../chatbot.service";
import { IConversation, IMessage } from "../../models/types";
import { Types } from "mongoose";

interface SendMessageData {
    conversationId: string;
    content: string;
}

interface StartMessageData {
    recipientId: string;
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

            const conversation = await Conversation.findById(data.conversationId);
            if (!conversation) {
                return SocketUtils.emitError(
                    socket,
                    "messageSent",
                    "Conversation not found"
                );
            }

            // --- Save User's Message ---
            const userMessage = await Message.create({
                senderId: socket.data.userId,
                conversationId: data.conversationId,
                content: data.content,
            });

            const populatedUserMessage = await Message.populate(userMessage, {
                path: "senderId",
                select: "name profilePicture",
            });

            const messageToSend = populatedUserMessage.toObject();

            // --- Update Conversation ---
            const conversationUpdatePromise = Conversation.findByIdAndUpdate(data.conversationId, {
                lastMessage: userMessage._id,
                "metadata.lastActivity": new Date(),
                $inc: { "metadata.totalMessages": 1 },
            });

            // Emit the user's own message back to them immediately
            /*socket.emit("newMessage", {
                message: messageToSend,
                conversationId: data.conversationId,
            });*/

            // Await conversation update before proceeding
            await conversationUpdatePromise;

            // --- Branch Logic: Chatbot vs. Regular ---
            if (conversation.type === 'CHATBOT') {
                // --- Chatbot Logic ---
                const chatbotUser = await ChatbotService.initializeChatbotUser();

                // Emit typing indicator
                socket.emit("typing", {
                    userId: chatbotUser._id.toString(),
                    conversationId: data.conversationId,
                    isTyping: true,
                });

                try {
                    // Process message and get bot response
                    const botResponse = await ChatbotService.processUserMessage(
                        conversation,
                        userMessage
                    );

                    if (botResponse && botResponse.message) {
                        const populatedBotMessage = await Message.populate(botResponse.message, {
                            path: "senderId",
                            select: "name profilePicture",
                        });

                        // Emit bot's message
                        socket.emit("newMessage", {
                            message: populatedBotMessage.toObject(),
                            conversationId: data.conversationId,
                        });

                    }
                } catch (e) {
                    console.error("Chatbot processing error:", e);
                    // Optionally send an error message to the user
                } finally {
                    // Stop typing indicator
                    socket.emit("typing", {
                        userId: chatbotUser._id.toString(),
                        conversationId: data.conversationId,
                        isTyping: false,
                    });
                }

            } else {
                // --- Regular Message Logic ---
                // Broadcast to other participants
                socket.broadcast.to(data.conversationId).emit("newMessage", {
                    message: messageToSend,
                    conversationId: data.conversationId,
                });

                await ConversationUtils.processNewMessage(
                    conversation,
                    socket.data.userId as string,
                    data.conversationId,
                    messageToSend._id.toString()
                );
            }

            SocketUtils.emitSuccess(socket, "messageSent", messageToSend);

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

    socket.on("startMessage", async (data: StartMessageData, _callback) => {
        try {
            if (!SocketUtils.validateRequest(socket, data, ["recipientId", "content"])) {
                return;
            }

            const { recipientId, content } = data;
            const senderId = socket.data.userId;

            if (senderId === recipientId) {
                return SocketUtils.emitError(socket, "conversationStartFailed", "You cannot start a conversation with yourself.");
            }

            const existingConversation = await Conversation.findOne({
                type: 'DM',
                participants: { $all: [senderId, recipientId] }
            });

            if (existingConversation) {
                await existingConversation.populate([
                    { path: 'participants', select: 'name profilePicture status lastSeen' },
                    { path: 'lastMessage', populate: { path: 'senderId', select: 'name profilePicture' } }
                ]);
                socket.emit('conversationStarted', existingConversation);
                return;
            }

            const newConversation = new Conversation({
                type: 'DM',
                participants: [senderId, recipientId],
                'metadata.createdBy': senderId,
                'metadata.lastActivity': new Date(),
            });

            const newMessage: IMessage = new Message({
                senderId,
                conversationId: newConversation._id,
                content,
            });

            newConversation.lastMessage = newMessage._id as Types.ObjectId;

            await Promise.all([newConversation.save(), newMessage.save()]);

            const populatedConversation: IConversation | null = await Conversation.findById(newConversation._id)
                .populate('participants', 'name profilePicture status lastSeen')
                .populate({ path: 'lastMessage', populate: { path: 'senderId', select: 'name profilePicture' } });

            // Notify sender that conversation has started
            socket.emit('conversationStarted', populatedConversation);

            // Notify recipient of new conversation/message request
            socket.to(recipientId).emit('newConversation', populatedConversation);

            // Also send the message to the recipient
            if (populatedConversation && populatedConversation.lastMessage) {
                socket.to(recipientId).emit('newMessage', {
                    message: populatedConversation.lastMessage,
                    conversationId: populatedConversation._id.toString()
                });
            }

            await ConversationUtils.processNewMessage(
                newConversation,
                socket.data.userId as string,
                newConversation._id.toString(),
                newMessage._id.toString()
            );

            SocketUtils.emitSuccess(socket, "messageSent", newMessage);

        } catch (error) {
            console.error("Error starting conversation:", error);
            SocketUtils.emitError(socket, "conversationStartFailed");
        }
    });
};
