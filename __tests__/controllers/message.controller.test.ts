import request from 'supertest';
import app from '../../src/config/app';
import Message from '../../src/models/Message';
import Conversation from '../../src/models/Conversation';
import { Types } from 'mongoose';

// Mock the models
jest.mock('../../src/models/Message');
jest.mock('../../src/models/Conversation');

// Mock the authentication middleware
const mockUserId = new Types.ObjectId();
const mockOtherUserId = new Types.ObjectId();

jest.mock('@utils/uploadService', () => ({
    uploadMessageAttachments: jest.fn((req, res, next) => {
        req.files = [
            { 
                path: 'http://example.com/file.jpg',
                originalname: 'file.jpg',
                size: 12345,
                mimetype: 'image/jpeg'
            }
        ];
        next();
    }),
}));

jest.mock('../../src/middleware/auth', () => ({
    ...jest.requireActual('../../src/middleware/auth'),
    authenticate: jest.fn((req, res, next) => {
        req.user = { _id: mockUserId };
        next();
    }),
}));

const mockIo = {
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
};

app.set('io', mockIo);

describe('Message Controller', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('DELETE /api/v1/messages/bulk', () => {
        it('should delete multiple messages successfully', async () => {
            const messageId1 = new Types.ObjectId().toString();
            const messageId2 = new Types.ObjectId().toString();
            const messageIds = [messageId1, messageId2];

            (Message.find as jest.Mock).mockResolvedValue([
                { _id: messageId1, senderId: mockUserId },
                { _id: messageId2, senderId: mockUserId },
            ]);
            (Message.deleteMany as jest.Mock).mockResolvedValue({ deletedCount: 2 });

            const response = await request(app)
                .delete('/api/v1/messages/bulk')
                .send({ messageIds });

            expect(response.status).toBe(200);
            expect(response.body.data.deletedCount).toBe(2);
            expect(Message.find).toHaveBeenCalledWith({ _id: { $in: messageIds }, senderId: mockUserId });
            expect(Message.deleteMany).toHaveBeenCalledWith({ _id: { $in: messageIds }, senderId: mockUserId });
        });

        it('should return 403 if user tries to delete messages they do not own', async () => {
            const messageId1 = new Types.ObjectId().toString();
            const messageIds = [messageId1];

            // Simulate finding no messages owned by the user
            (Message.find as jest.Mock).mockResolvedValue([]);

            const response = await request(app)
                .delete('/api/v1/messages/bulk')
                .send({ messageIds });

            expect(response.status).toBe(403);
            expect(response.body.message).toBe('One or more messages could not be found or you do not have permission to delete them.');
        });

        it('should return 400 if messageIds array is empty', async () => {
            const response = await request(app)
                .delete('/api/v1/messages/bulk')
                .send({ messageIds: [] });

            expect(response.status).toBe(400);
        });

        it('should return 400 if messageIds is not an array', async () => {
            const response = await request(app)
                .delete('/api/v1/messages/bulk')
                .send({ messageIds: 'not-an-array' });

            expect(response.status).toBe(400);
        });

        it('should return 400 if messageIds contains invalid ObjectIds', async () => {
            const response = await request(app)
                .delete('/api/v1/messages/bulk')
                .send({ messageIds: ['invalid-id'] });

            expect(response.status).toBe(400);
        });
    });

    describe('POST /api/v1/messages/conversation/:conversationId/attachments', () => {
        it('should send an attachment successfully', async () => {
            const conversationId = new Types.ObjectId().toString();
            const mockConversation = {
                _id: conversationId,
                participants: [{ userId: mockUserId }, { userId: mockOtherUserId }],
                lastMessage: null,
                save: jest.fn().mockResolvedValue(true),
            };
            const mockMessage = {
                _id: new Types.ObjectId(),
                senderId: mockUserId,
                conversationId: conversationId,
                content: 'Here is an image',
                attachments: expect.any(Array),
                populate: jest.fn().mockImplementation(function (this: any) { return this; }),
            };

            (Conversation.findById as jest.Mock).mockResolvedValue(mockConversation);
            (Message.create as jest.Mock).mockResolvedValue(mockMessage);

            const response = await request(app)
                .post(`/api/v1/messages/conversation/${conversationId}/attachments`)
                .field('content', 'Here is an image');

            expect(response.status).toBe(201);
            expect(Conversation.findById).toHaveBeenCalledWith(conversationId);
            expect(Message.create).toHaveBeenCalled();
            expect(mockConversation.save).toHaveBeenCalled();
            expect(mockIo.to).toHaveBeenCalledWith(mockOtherUserId.toString());
            expect(mockIo.emit).toHaveBeenCalledWith('newMessage', expect.any(Object));
        });

        it('should return 403 if user is not a participant', async () => {
            const conversationId = new Types.ObjectId().toString();
            const mockConversation = {
                participants: [{ userId: new Types.ObjectId() }], // Current user is not in this list
            };
            (Conversation.findById as jest.Mock).mockResolvedValue(mockConversation);

            const response = await request(app)
                .post(`/api/v1/messages/conversation/${conversationId}/attachments`)
                .field('content', 'Trying to send');

            expect(response.status).toBe(403);
        });

        it('should return 404 if conversation not found', async () => {
            const conversationId = new Types.ObjectId().toString();
            (Conversation.findById as jest.Mock).mockResolvedValue(null);

            const response = await request(app)
                .post(`/api/v1/messages/conversation/${conversationId}/attachments`);

            expect(response.status).toBe(404);
        });
    });
});
