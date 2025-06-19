import request from 'supertest';
import app from '../../src/config/app';
import Message from '../../src/models/Message';
import { Types } from 'mongoose';

// Mock the models
jest.mock('../../src/models/Message');

// Mock the authentication middleware
const mockUserId = new Types.ObjectId();
jest.mock('../../src/middleware/auth', () => ({
    ...jest.requireActual('../../src/middleware/auth'),
    authenticate: jest.fn((req, res, next) => {
        req.user = { _id: mockUserId };
        next();
    }),
}));

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
});
