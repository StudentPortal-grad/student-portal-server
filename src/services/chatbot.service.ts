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

    static async initializeChatbotUser(): Promise<IUser> {
        try {
            let chatbotUser = await User.findOne({
                email: this.CHATBOT_EMAIL,
                isChatbot: true
            });

            if (!chatbotUser) {
                chatbotUser = new User({
                    name: this.CHATBOT_NAME,
                    email: this.CHATBOT_EMAIL,
                    // password: 'N/A_CHATBOT_USER',
                    isChatbot: true,
                    signupStep: 'completed',
                    role: 'admin',
                    profilePicture: this.CHATBOT_AVATAR,
                    status: 'online',
                    botSettings: {
                        isActive: true,
                        language: 'ar',
                        personalityType: 'academic',
                        contextLimit: 10
                    }
                });

                await chatbotUser.save();
                console.log('Chatbot user created successfully');
            }

            return chatbotUser;
        } catch (error) {
            throw new AppError(
                'Failed to initialize chatbot user',
                500,
                ErrorCodes.INTERNAL_ERROR,
                error
            );
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
                error
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
            status: 'delivered'
        });

        await message.save();

        await Conversation.findByIdAndUpdate(conversationId, {
            lastMessage: message._id,
            'metadata.lastActivity': new Date()
        });
    }

    static async processUserMessage(conversation: IConversation, userMessageDoc: IMessage): Promise<any> {
        try {
            const startTime = performance.now();

            if (!conversation || conversation.type !== 'CHATBOT') {
                throw new Error('Invalid chatbot conversation');
            }

            /*const contextLimit = conversation.chatbotMetadata?.contextWindowSize || 10;

            const recentMessages = await Message.find({ conversationId })
                .sort({ createdAt: -1 })
                .limit(contextLimit)
                .populate('senderId', 'name isChatbot')
                .lean();

            const context = recentMessages.reverse().map(msg => ({
                role: (msg.senderId as any).isChatbot ? 'assistant' : 'user',
                content: msg.content,
                timestamp: msg.createdAt
            }));*/

            const aiResponse = await this.callAIChatAPI(userMessageDoc.content!);

            const processingTime = performance.now() - startTime;

            const chatbotUser = await this.initializeChatbotUser();
            const responseMessage = new Message({
                senderId: chatbotUser._id,
                conversationId: conversation._id,
                content: aiResponse.answer, // Use the answer from the placeholder response
                status: 'delivered',
                metadata: {
                    ...aiResponse,
                    processingTime, // Add server-side processing time
                }
            });

            await responseMessage.save();

            await Conversation.findByIdAndUpdate(conversation._id, {
                $set: {
                    'chatbotMetadata.lastUserMessageId': userMessageDoc._id,
                    'chatbotMetadata.lastBotMessageId': responseMessage._id,
                    'chatbotMetadata.contextSummary': `Last message on ${new Date().toISOString()}` // Placeholder
                }
            });

            return {
                message: responseMessage,
                metadata: {
                    confidence: aiResponse.confidence,
                    processingTime: processingTime,
                    sourceSection: aiResponse.source_section
                }
            };

        } catch (error) {
            const chatbotUser = await this.initializeChatbotUser();
            const errorMessageContent = 'عذراً، حدث خطأ أثناء معالجة طلبك. يرجى المحاولة مرة أخرى.';

            const errorMessage = new Message({
                senderId: chatbotUser._id,
                conversationId: conversation._id,
                content: errorMessageContent,
                status: 'delivered',
            });
            await errorMessage.save();

            if (error instanceof AppError) {
                throw error;
            }

            throw new AppError(
                'Error processing chatbot message',
                500,
                ErrorCodes.INTERNAL_ERROR,
                error
            );
        }
    }

    private static async callAIChatAPI(question: string): Promise<any> {
        try {
            // --- UNCOMMENT THIS BLOCK TO USE THE ACTUAL API ---
            /*
            const chatApiUrl = new URL('/api/chat', config.aiApi.url).toString();
            const response = await axios.post(chatApiUrl, {
                question: question,
            }, {
                timeout: 30000,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.aiApi.key}`
                }
            });
            return response.data;
            */

            // --- COMMENT OUT THE BLOCK BELOW WHEN USING THE ACTUAL API ---
            // AI model is not running, returning placeholder response.
            console.log('AI_MODEL_OFFLINE: Returning placeholder for callAIChatAPI');
            return Promise.resolve({
                question: question,
                answer: "مرحباً! هذا رد تجريبي من المساعد الذكي. كيف يمكنني مساعدتك اليوم؟",
                confidence: 0.99,
                processing_time: 0.5,
                source_section: 'Placeholder Section',
                related_sections: [],
                language: 'ar',
                timestamp: new Date().toISOString(),
                status: 'success',
                api_version: '3.0.0'
            });
        } catch (error) {
            throw new AppError(
                'AI Chat API call failed',
                500,
                ErrorCodes.EXTERNAL_SERVICE_ERROR,
                error
            );
        }
    }

    private static async callAIConversationAPI(message: string, context: any[]): Promise<any> {
        try {
            // --- UNCOMMENT THIS BLOCK TO USE THE ACTUAL API ---
            /*
            const conversationApiUrl = new URL('/api/conversation', config.aiApi.url).toString();
            const response = await axios.post(conversationApiUrl, {
                message: message,
                context: context
            }, {
                timeout: 30000,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.aiApi.key}`
                }
            });
            return response.data;
            */

            // --- COMMENT OUT THE BLOCK BELOW WHEN USING THE ACTUAL API ---
            // AI model is not running, returning placeholder response.
            console.log('AI_MODEL_OFFLINE: Returning placeholder for callAIConversationAPI');
            return Promise.resolve({
                question: message,
                answer: "مرحباً! هذا رد تجريبي من المساعد الذكي. كيف يمكنني مساعدتك اليوم؟",
                confidence: 0.99,
                processing_time: 0.5,
                source_section: 'Placeholder Section',
                related_sections: [],
                language: 'ar',
                timestamp: new Date().toISOString(),
                status: 'success',
                api_version: '3.0.0'
            });
        } catch (error) {
            throw new AppError(
                'AI Conversation API call failed',
                500,
                ErrorCodes.EXTERNAL_SERVICE_ERROR,
                error
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
