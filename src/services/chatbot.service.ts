import axios from 'axios';
import { Types } from 'mongoose';
import User from '@models/User';
import Conversation from '@models/Conversation';
import Message from '@models/Message';
import { IUser, IConversation, IMessage } from '@models/types';
import { config } from '../config';
import { AppError, ErrorCodes } from '../utils/appError';

export class ChatbotService {
    private static readonly CHATBOT_EMAIL = config.chatbot.email;
    private static readonly CHATBOT_NAME = config.chatbot.name;
    private static readonly CHATBOT_AVATAR = config.chatbot.avatar;
    private static readonly AI_API_URL = config.aiApi.url;
    private static readonly CHATBOT_API_URL = config.aiApi.chatbotApiUrl;

    static async initializeChatbotUser(): Promise<IUser> {
        try {
            let chatbotUser = await User.findOne({
                email: this.CHATBOT_EMAIL,
                isChatbot: true,
            });

            if (!chatbotUser) {
                chatbotUser = new User({
                    name: this.CHATBOT_NAME,
                    email: this.CHATBOT_EMAIL,
                    isChatbot: true,
                    signupStep: 'completed',
                    role: 'admin',
                    profilePicture: this.CHATBOT_AVATAR,
                    status: 'online',
                    botSettings: {
                        isActive: true,
                        language: 'ar',
                        personalityType: 'academic',
                        contextLimit: 10,
                    },
                });

                await chatbotUser.save();
                console.log('Chatbot user created successfully');
            }

            return chatbotUser;
        } catch (error) {
            throw new AppError('Failed to initialize chatbot user', 500, ErrorCodes.INTERNAL_ERROR, error);
        }
    }

    static async createChatbotConversation(userIdString: string): Promise<any> {
        const userId = new Types.ObjectId(userIdString);
        try {
            const chatbotUser = await this.initializeChatbotUser();

            const existingConversation = await Conversation.findOne({
                type: 'CHATBOT',
                'participants.userId': { $all: [userId, chatbotUser._id] },
            });

            if (existingConversation) {
                return existingConversation;
            }

            const conversation = new Conversation({
                type: 'CHATBOT',
                participants: [
                    { userId: userId, role: 'member' },
                    { userId: chatbotUser._id, role: 'admin' },
                ],
                groupImage: chatbotUser.profilePicture,
                createdBy: chatbotUser._id,
                name: `${this.CHATBOT_NAME}`,
                description: 'محادثة مع المساعد الذكي للحصول على المساعدة والإجابة على استفساراتك',
                chatbotMetadata: {
                    aiModel: 'default-gpt-3.5-turbo',
                    contextSummary: 'A new conversation has been started.',
                },
            });

            await conversation.save();

            await User.findByIdAndUpdate(userId, {
                hasChatbotConversation: true,
                chatbotConversationId: conversation._id,
            });

            await this.sendWelcomeMessage(conversation._id as Types.ObjectId, userId);

            return conversation;
        } catch (error) {
            throw new AppError(
                'Failed to create chatbot conversation',
                500,
                ErrorCodes.INTERNAL_ERROR,
                error,
            );
        }
    }

    private static async sendWelcomeMessage(conversationId: Types.ObjectId, userId: Types.ObjectId): Promise<void> {
        const chatbotUser = await this.initializeChatbotUser();

        const welcomeMessage = `مرحبا بك! 👋\n\nأنا المساعد الذكي للطلاب، هنا لمساعدتك في:\n• الإجابة على استفساراتك الأكاديمية\n• توضيح القوانين واللوائح\n• مساعدتك في إجراءات التسجيل\n• الإجابة على أسئلة عامة حول الكلية\n\nلا تتردد في سؤالي عن أي شيء! 🎓`;

        const message = new Message({
            senderId: chatbotUser._id,
            conversationId: conversationId,
            content: welcomeMessage,
            type: 'text',
            role: 'bot',
            status: 'delivered',
        });

        await message.save();

        await Conversation.findByIdAndUpdate(conversationId, {
            lastMessage: message._id,
            'metadata.lastActivity': new Date(),
        });
    }

    static async processUserMessage(conversation: IConversation, userMessageDoc: IMessage): Promise<any> {
        try {
            if (!conversation || conversation.type !== 'CHATBOT') {
                throw new AppError('Invalid chatbot conversation', 400, ErrorCodes.INVALID_INPUT);
            }

            if (!userMessageDoc.content) {
                // Should not happen, but as a safeguard
                throw new AppError('Cannot process an empty message.', 400, ErrorCodes.INVALID_INPUT);
            }

            const chatbotUser = await this.initializeChatbotUser();

            const aiResponse = await this.callAIChatAPI(
                userMessageDoc.content,
            );

            const chatbotMessage = new Message({
                conversationId: conversation._id,
                senderId: chatbotUser._id,
                content: aiResponse.answer,
                type: 'text',
                role: 'bot',
                metadata: {
                    processing_time: aiResponse.processing_time,
                    language: aiResponse.language,
                    source_documents: aiResponse.sources,
                    api_conversation_id: aiResponse.conversation_id,
                },
            });

            await chatbotMessage.save();

            await Conversation.findByIdAndUpdate(conversation._id, {
                $set: {
                    lastMessage: chatbotMessage._id,
                    'chatbotMetadata.contextSummary': `Responded to: "${userMessageDoc.content.substring(0, 50)}..."`,
                },
                $inc: { messageCount: 1 },
            });

            return chatbotMessage;
        } catch (error) {
            const chatbotUser = await this.initializeChatbotUser();
            const errorMessageContent = 'عذراً، حدث خطأ أثناء معالجة طلبك. يرجى المحاولة مرة أخرى.';

            const errorMessage = new Message({
                senderId: chatbotUser._id,
                conversationId: conversation._id,
                content: errorMessageContent,
                type: 'text',
                role: 'bot',
                status: 'delivered',
            });
            console.log("Error message:", errorMessage);
            await errorMessage.save();

            await Conversation.findByIdAndUpdate(conversation._id, {
                $set: {
                    lastMessage: errorMessage._id,
                },
            });

            if (error instanceof AppError) {
                throw error;
            }

            throw new AppError(
                'Error processing chatbot message',
                500,
                ErrorCodes.INTERNAL_ERROR,
                error,
            );
        }
    }

    private static async callAIChatAPI(question: string): Promise<any> {
        try {
            const queryApiUrl = new URL('/query', this.CHATBOT_API_URL).toString();
            const response = await axios.post(
                queryApiUrl,
                {
                    query: question,
                    conversation_id: null,
                },
                {
                    timeout: 30000,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                },
            );
            return response.data;
        } catch (error) {
            console.error('AI Chat API call failed:', error);
            throw new AppError('AI Chat API call failed', 500, ErrorCodes.EXTERNAL_SERVICE_ERROR, error);
        }
    }

    private static async callAIConversationAPI(
        message: string,
        conversationId: Types.ObjectId,
    ): Promise<any> {
        try {
            const queryApiUrl = new URL('/query', this.CHATBOT_API_URL).toString();
            const response = await axios.post(
                queryApiUrl,
                {
                    query: message,
                    conversation_id: conversationId.toString(),
                },
                {
                    timeout: 30000,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                },
            );
            return response.data;
        } catch (error) {
            console.error('AI Conversation API call failed:', error);
            throw new AppError(
                'AI Conversation API call failed',
                500,
                ErrorCodes.EXTERNAL_SERVICE_ERROR,
                error,
            );
        }
    }

    static async getChatbotConversation(userId: Types.ObjectId): Promise<any> {
        const user = await User.findById(userId);

        if (user?.chatbotConversationId) {
            return await Conversation.findById(user.chatbotConversationId)
                .populate('participants.userId', 'name profilePicture isChatbot')
                .populate('lastMessage');
        }

        return await this.createChatbotConversation(userId.toString());
    }
}

