import { ChatbotService } from '../../src/services/chatbot.service';
import User from '../../src/models/User';
import Conversation from '../../src/models/Conversation';
import Message from '../../src/models/Message';
import { chatbotConversationQueue } from '../../src/queues/chatbot.queue';
import mongoose from 'mongoose';

// Mock the models and queue
jest.mock('../../src/models/User');
jest.mock('../../src/models/Conversation');
jest.mock('../../src/models/Message');
jest.mock('../../src/queues/chatbot.queue', () => ({
    chatbotConversationQueue: {
        add: jest.fn(),
    },
}));

describe('ChatbotService', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('initializeChatbotUser', () => {
        it('should create a new chatbot user if one does not exist', async () => {
            // Arrange
            (User.findOne as jest.Mock).mockResolvedValue(null);
            const saveMock = jest.fn().mockResolvedValue(true);
            (User as unknown as jest.Mock).mockImplementation(() => ({
                save: saveMock,
            }));

            // Act
            await ChatbotService.initializeChatbotUser();

            // Assert
            expect(User.findOne).toHaveBeenCalledWith({ 
                email: expect.any(String),
                isChatbot: true 
            });
            expect(saveMock).toHaveBeenCalled();
        });

        it('should return the existing chatbot user if one exists', async () => {
            // Arrange
            const existingChatbot = { _id: 'chatbot_id', name: 'Chatbot' };
            (User.findOne as jest.Mock).mockResolvedValue(existingChatbot);
            const saveMock = jest.fn();
            (User as unknown as jest.Mock).mockImplementation(() => ({
                save: saveMock,
            }));

            // Act
            const result = await ChatbotService.initializeChatbotUser();

            // Assert
            expect(User.findOne).toHaveBeenCalled();
            expect(saveMock).not.toHaveBeenCalled();
            expect(result).toEqual(existingChatbot);
        });
    });

    describe('createChatbotConversation', () => {
        it('should create and return a new chatbot conversation', async () => {
            // Arrange
            const userId = new mongoose.Types.ObjectId().toString();
            const chatbotUser = { _id: new mongoose.Types.ObjectId(), name: 'Chatbot' };
            const conversationId = new mongoose.Types.ObjectId();

            jest.spyOn(ChatbotService, 'initializeChatbotUser').mockResolvedValue(chatbotUser as any);
            (Conversation.findOne as jest.Mock).mockResolvedValue(null);
            const conversationSaveMock = jest.fn().mockResolvedValue({ _id: conversationId });
            (Conversation as unknown as jest.Mock).mockImplementation(() => ({ save: conversationSaveMock }));
            (User.findByIdAndUpdate as jest.Mock).mockResolvedValue(true);
            jest.spyOn(ChatbotService, 'sendWelcomeMessage' as any).mockResolvedValue(undefined);

            // Act
            await ChatbotService.createChatbotConversation(userId);

            // Assert
            expect(ChatbotService.initializeChatbotUser).toHaveBeenCalled();
            expect(Conversation.findOne).toHaveBeenCalled();
            expect(conversationSaveMock).toHaveBeenCalled();
            expect(User.findByIdAndUpdate).toHaveBeenCalledWith(new mongoose.Types.ObjectId(userId), {
                hasChatbotConversation: true,
                chatbotConversationId: conversationId,
            });
            expect(ChatbotService['sendWelcomeMessage']).toHaveBeenCalled();
        });
    });

    describe('queueChatbotConversationCreation', () => {
        it('should add a job to the chatbot conversation queue', async () => {
            // Arrange
            const userId = new mongoose.Types.ObjectId();

            // Act
            await ChatbotService.queueChatbotConversationCreation(userId);

            // Assert
            expect(chatbotConversationQueue.add).toHaveBeenCalledWith(
                'create-chatbot-conversation',
                { userId: userId.toString() }
            );
        });
    });

    describe('processUserMessage', () => {
        it('should process a user message, call the AI, and return a response', async () => {
            // Arrange
            const userId = new mongoose.Types.ObjectId();
            const conversationId = new mongoose.Types.ObjectId();
            const userMessage = 'Hello, chatbot!';
            const chatbotUser = { _id: new mongoose.Types.ObjectId(), name: 'Chatbot' };
            const aiResponse = { answer: 'Hello, user!', confidence: 0.9, source_section: 'intro', related_sections: [] };
            
            const userMessageDoc = { _id: new mongoose.Types.ObjectId(), save: jest.fn().mockResolvedValue(true) };
            const botMessageDoc = { _id: new mongoose.Types.ObjectId(), save: jest.fn().mockResolvedValue(true) };
            (Message as unknown as jest.Mock)
                .mockImplementationOnce(() => userMessageDoc)
                .mockImplementationOnce(() => botMessageDoc);

            const conversation = { _id: conversationId, type: 'CHATBOT', chatbotMetadata: {} };
            (Conversation.findById as jest.Mock).mockReturnValue({
                populate: jest.fn().mockResolvedValue(conversation),
            });
            (Conversation.findByIdAndUpdate as jest.Mock).mockResolvedValue(true);
            jest.spyOn(ChatbotService, 'initializeChatbotUser').mockResolvedValue(chatbotUser as any);
            jest.spyOn(ChatbotService, 'callAIAPI' as any).mockResolvedValue(aiResponse);

            // Act
            const result = await ChatbotService.processUserMessage(conversationId, userMessage, userId);

            // Assert
            expect(Message).toHaveBeenCalledTimes(2);
            expect(userMessageDoc.save).toHaveBeenCalled();
            expect(Conversation.findById).toHaveBeenCalledWith(conversationId);
            expect(ChatbotService['callAIAPI']).toHaveBeenCalledWith(userMessage, expect.any(Array));
            expect(botMessageDoc.save).toHaveBeenCalled();
            expect(Conversation.findByIdAndUpdate).toHaveBeenCalledWith(conversationId, {
                $set: {
                    'chatbotMetadata.lastUserMessageId': userMessageDoc._id,
                    'chatbotMetadata.lastBotMessageId': botMessageDoc._id,
                    'chatbotMetadata.contextSummary': expect.any(String),
                }
            });
            expect(result.message).toBe(botMessageDoc);
        });

        it('should handle AI API errors gracefully', async () => {
            // Arrange
            const userId = new mongoose.Types.ObjectId();
            const conversationId = new mongoose.Types.ObjectId();
            const userMessage = 'Hello, chatbot!';
            const chatbotUser = { _id: new mongoose.Types.ObjectId(), name: 'Chatbot' };
            
            const userMessageDoc = { _id: new mongoose.Types.ObjectId(), save: jest.fn().mockResolvedValue(true) };
            const errorMessageDoc = { _id: new mongoose.Types.ObjectId(), save: jest.fn().mockResolvedValue(true) };
            (Message as unknown as jest.Mock)
                .mockImplementationOnce(() => userMessageDoc)
                .mockImplementationOnce(() => errorMessageDoc);

            const conversation = { _id: conversationId, type: 'CHATBOT', chatbotMetadata: {} };
            (Conversation.findById as jest.Mock).mockReturnValue({
                populate: jest.fn().mockResolvedValue(conversation),
            });
            jest.spyOn(ChatbotService, 'initializeChatbotUser').mockResolvedValue(chatbotUser as any);
            const apiError = new Error('AI API is down');
            jest.spyOn(ChatbotService, 'callAIAPI' as any).mockRejectedValue(apiError);

            // Act & Assert
            await expect(ChatbotService.processUserMessage(conversationId, userMessage, userId)).rejects.toThrow(apiError);
            expect(errorMessageDoc.save).toHaveBeenCalled();
        });
    });
});
