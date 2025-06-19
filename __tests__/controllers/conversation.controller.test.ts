import request from 'supertest';
import { Types } from 'mongoose';
import app from '../../src/config/app';
import Conversation from '../../src/models/Conversation';
import User from '../../src/models/User';
import Message from '../../src/models/Message';

// Mock the models
jest.mock('../../src/models/Conversation');
jest.mock('../../src/models/User');
jest.mock('../../src/models/Message');

// Mock the authentication middleware
const mockUserId = new Types.ObjectId();
jest.mock('../../src/middleware/auth', () => ({
    ...jest.requireActual('../../src/middleware/auth'),
    authenticate: jest.fn((req, res, next) => {
        req.user = { _id: mockUserId, name: 'Test User', email: 'test@test.com' };
        next();
    }),
}));

describe('ConversationController', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('DELETE /api/v1/conversations/:id/leave', () => {
        const conversationId = new Types.ObjectId();

        it('should successfully leave and delete a DM conversation', async () => {
            const mockParticipantIds = [mockUserId, new Types.ObjectId()];
            const mockConversation = {
                _id: conversationId,
                type: 'DM',
                participants: mockParticipantIds.map(id => ({ userId: id })),
                deleteOne: jest.fn().mockResolvedValue({}),
            };

            (Conversation.findById as jest.Mock).mockResolvedValue(mockConversation);
            (Message.deleteMany as jest.Mock).mockResolvedValue({ deletedCount: 10 });
            (User.updateMany as jest.Mock).mockResolvedValue({ modifiedCount: 2 });

            const response = await request(app).delete(`/api/v1/conversations/${conversationId}/leave`);

            expect(response.status).toBe(200);
            expect(response.body.message).toBe('Left conversation successfully');
            expect(Conversation.findById).toHaveBeenCalledWith(conversationId.toString());
            expect(Message.deleteMany).toHaveBeenCalledWith({ conversationId: conversationId.toString() });
            expect(User.updateMany).toHaveBeenCalledWith(
                { _id: { $in: mockParticipantIds } },
                { $pull: { recentConversations: { conversationId: conversationId.toString() } } }
            );
            expect(mockConversation.deleteOne).toHaveBeenCalled();
        });

        it('should successfully leave a group conversation', async () => {
            const mockConversation = {
                _id: conversationId,
                type: 'GroupDM',
                participants: [{ userId: mockUserId, role: 'member' }],
            };

            (Conversation.findById as jest.Mock).mockResolvedValue(mockConversation);
            (Conversation.updateOne as jest.Mock).mockResolvedValue({ modifiedCount: 1 });
            (User.updateOne as jest.Mock).mockResolvedValue({ modifiedCount: 1 });

            const response = await request(app).delete(`/api/v1/conversations/${conversationId}/leave`);

            expect(response.status).toBe(200);
            expect(response.body.message).toBe('Left conversation successfully');
            expect(Conversation.updateOne).toHaveBeenCalledWith(
                { _id: conversationId.toString() },
                { $pull: { participants: { userId: mockUserId } } }
            );
            expect(User.updateOne).toHaveBeenCalledWith(
                { _id: mockUserId },
                { $pull: { recentConversations: { conversationId: conversationId.toString() } } }
            );
        });

        it('should return 400 if an owner tries to leave a group conversation', async () => {
            const mockConversation = {
                _id: conversationId,
                type: 'GroupDM',
                participants: [{ userId: mockUserId, role: 'owner' }],
            };

            (Conversation.findById as jest.Mock).mockResolvedValue(mockConversation);

            const response = await request(app).delete(`/api/v1/conversations/${conversationId}/leave`);

            expect(response.status).toBe(400);
            expect(response.body.message).toBe('Owner cannot leave the group. Please delete the group or transfer ownership.');
        });

        it('should return 404 if conversation not found', async () => {
            (Conversation.findById as jest.Mock).mockResolvedValue(null);

            const response = await request(app).delete(`/api/v1/conversations/${conversationId}/leave`);

            expect(response.status).toBe(404);
            expect(response.body.message).toBe('Conversation not found');
        });
    });

    describe('POST /api/v1/conversations', () => {
        it('should create a new group conversation successfully', async () => {
            const participant1 = new Types.ObjectId();
            const participant2 = new Types.ObjectId();
            const requestBody = {
                type: 'GroupDM',
                name: 'Test Group',
                participants: [participant1.toString(), participant2.toString()],
            };

            const createdConversation = {
                _id: new Types.ObjectId(),
                ...requestBody,
                participants: [{ userId: mockUserId }, { userId: participant1 }, { userId: participant2 }],
                createdBy: mockUserId,
                populate: jest.fn().mockResolvedValue({}),
            };

            (Conversation.create as jest.Mock).mockResolvedValue(createdConversation);
            (User.updateMany as jest.Mock).mockResolvedValue({ modifiedCount: 3 });

            const response = await request(app).post('/api/v1/conversations').send(requestBody);

            expect(response.status).toBe(201);
            expect(response.body.message).toBe('Conversation created successfully');
            expect(Conversation.create).toHaveBeenCalled();
            expect(User.updateMany).toHaveBeenCalled();
            expect(createdConversation.populate).toHaveBeenCalled();
        });

        it('should return 400 if group name is missing for a group conversation', async () => {
            const requestBody = {
                type: 'GroupDM',
                participants: [new Types.ObjectId().toString()],
            };

            const response = await request(app).post('/api/v1/conversations').send(requestBody);

            expect(response.status).toBe(400);
            expect(response.body.message).toBe('Group name is required for group conversations');
        });

        it('should return 400 for invalid participant IDs', async () => {
            const requestBody = {
                type: 'GroupDM',
                name: 'Test Group',
                participants: ['invalid-id'],
            };

            const response = await request(app).post('/api/v1/conversations').send(requestBody);

            expect(response.status).toBe(400);
            expect(response.body.message).toContain('Invalid participant ID');
        });
    });

    describe('DELETE /api/v1/conversations/:id/clear', () => {
        const conversationId = new Types.ObjectId().toString();

        it('should clear conversation history successfully for a DM', async () => {
            const mockConversation = {
                _id: conversationId,
                type: 'DM',
                participants: [{ userId: mockUserId }],
                find: jest.fn().mockReturnThis(),
            };
            (Conversation.findOne as jest.Mock).mockResolvedValue(mockConversation);
            (Message.deleteMany as jest.Mock).mockResolvedValue({ deletedCount: 10 });
            (Conversation.updateOne as jest.Mock).mockResolvedValue({});

            const response = await request(app).delete(`/api/v1/conversations/${conversationId}/clear`);

            expect(response.status).toBe(200);
            expect(response.body.message).toBe('Conversation history cleared successfully');
            expect(response.body.data.messagesDeleted).toBe(10);
            expect(Message.deleteMany).toHaveBeenCalledWith({ conversationId });
            expect(Conversation.updateOne).toHaveBeenCalled();
        });

        it('should forbid clearing history for a group if not admin/owner', async () => {
            const mockConversation = {
                _id: conversationId,
                type: 'GroupDM',
                participants: [{ userId: mockUserId, role: 'member' }],
            };
            (Conversation.findOne as jest.Mock).mockResolvedValue(mockConversation);

            const response = await request(app).delete(`/api/v1/conversations/${conversationId}/clear`);

            expect(response.status).toBe(403);
            expect(response.body.message).toBe('Only group admins or the owner can clear the conversation history');
        });

        it('should return 404 if conversation not found or user is not a participant', async () => {
            (Conversation.findOne as jest.Mock).mockResolvedValue(null);

            const response = await request(app).delete(`/api/v1/conversations/${conversationId}/clear`);

            expect(response.status).toBe(404);
            expect(response.body.message).toBe('Conversation not found or you are not a participant');
        });
    });
});
