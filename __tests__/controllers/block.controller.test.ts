import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../config/app';
import User from '../../models/User';
import { Request } from 'express';

// Mock dependencies
jest.mock('../../models/User');
jest.mock('../../middleware/auth', () => ({
    __esModule: true,
    authorize: () => (req: Request, res: any, next: any) => {
        req.user = { _id: '5f8d0d55b54764421b7156dc', toObject: () => ({ _id: '5f8d0d55b54764421b7156dc' }) };
        next();
    },
}));

const UserMock = User as jest.Mocked<typeof User>;

describe('Block Routes', () => {
    const userId = '5f8d0d55b54764421b7156dc';
    const targetUserId = '5f8d0f77b54764421b7156de';
    let mockUser: any;
    let mockTargetUser: any;
    let mockSession: any;

    beforeEach(() => {
        jest.clearAllMocks();

        mockUser = {
            _id: userId,
            following: [],
            followers: [],
            blockedUsers: [],
            save: jest.fn().mockReturnThis(),
            isBlocking: jest.fn(),
        };

        mockTargetUser = {
            _id: targetUserId,
            following: [],
            followers: [],
            blockedUsers: [],
            save: jest.fn().mockReturnThis(),
        };

        mockSession = {
            startTransaction: jest.fn(),
            commitTransaction: jest.fn().mockResolvedValue(null),
            abortTransaction: jest.fn().mockResolvedValue(null),
            endSession: jest.fn(),
        };

        jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession as any);

        UserMock.findById = jest.fn().mockImplementation((id) => {
            if (id === userId) return Promise.resolve(mockUser);
            if (id === targetUserId) return Promise.resolve(mockTargetUser);
            return Promise.resolve(null);
        }) as any;
    });

    describe('POST /api/v1/block', () => {
        it('should successfully block a user and remove follow relationships', async () => {
            // Arrange: user follows target and target follows user
            mockUser.following.push(targetUserId);
            mockTargetUser.followers.push(userId);
            mockTargetUser.following.push(userId);
            mockUser.followers.push(targetUserId);
            mockUser.blockedUsers = [];

            // Act
            const res = await request(app).post('/api/v1/block').send({ targetUserId });

            // Assert
            expect(res.status).toBe(200);
            expect(res.body.message).toBe('User blocked successfully.');
            expect(mockSession.commitTransaction).toHaveBeenCalled();
            expect(mockUser.blockedUsers).toContain(targetUserId);
            // Check that follow relationships are removed
            expect(mockUser.following).not.toContain(targetUserId);
            expect(mockTargetUser.followers).not.toContain(userId);
            expect(mockTargetUser.following).not.toContain(userId);
            expect(mockUser.followers).not.toContain(targetUserId);
            expect(mockUser.save).toHaveBeenCalledWith({ session: mockSession });
            expect(mockTargetUser.save).toHaveBeenCalledWith({ session: mockSession });
        });

        it('should return 400 if user tries to block themselves', async () => {
            const res = await request(app).post('/api/v1/block').send({ targetUserId: userId });
            expect(res.status).toBe(400);
            expect(res.body.message).toBe('You cannot block yourself.');
        });

        it('should return 400 if user is already blocking the target', async () => {
            mockUser.blockedUsers = [targetUserId];
            const res = await request(app).post('/api/v1/block').send({ targetUserId });
            expect(res.status).toBe(400);
            expect(res.body.message).toBe('You are already blocking this user.');
        });
    });

    describe('POST /api/v1/unblock', () => {
        beforeEach(() => {
            mockUser.blockedUsers.push(targetUserId);
        });

        it('should successfully unblock a user', async () => {
            const res = await request(app).post('/api/v1/unblock').send({ targetUserId });

            expect(res.status).toBe(200);
            expect(res.body.message).toBe('User unblocked successfully.');
            expect(mockUser.blockedUsers).not.toContain(targetUserId);
            expect(mockUser.save).toHaveBeenCalled();
        });

        it('should return 400 if user is not blocking the target', async () => {
            mockUser.blockedUsers = [];
            const res = await request(app).post('/api/v1/unblock').send({ targetUserId });
            expect(res.status).toBe(400);
            expect(res.body.message).toBe('You are not blocking this user.');
        });
    });
});