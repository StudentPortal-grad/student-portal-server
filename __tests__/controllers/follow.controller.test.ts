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
jest.mock('../../middlewares/checkBlocked', () => ({
    __esModule: true,
    checkBlocked: (req: any, res: any, next: any) => next(),
}));

const UserMock = User as jest.Mocked<typeof User>;

describe('Follow Routes', () => {
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
            blockedUsers: [],
            save: jest.fn().mockReturnThis(),
            populate: jest.fn().mockReturnThis(),
            isFollowing: jest.fn(),
        };

        mockTargetUser = {
            _id: targetUserId,
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

    describe('POST /api/v1/follow/:userId', () => {
        it('should successfully follow a user', async () => {
            mockUser.isFollowing.mockReturnValue(false);

            const res = await request(app).post(`/api/v1/follow/${targetUserId}`);

            expect(res.status).toBe(200);
            expect(res.body.message).toBe('Successfully followed user.');
            expect(mockSession.startTransaction).toHaveBeenCalled();
            expect(mockUser.save).toHaveBeenCalledWith({ session: mockSession });
            expect(mockTargetUser.save).toHaveBeenCalledWith({ session: mockSession });
            expect(mockSession.commitTransaction).toHaveBeenCalled();
            expect(mockUser.following).toContain(targetUserId);
            expect(mockTargetUser.followers).toContain(userId);
        });

        it('should return 400 if user tries to follow themselves', async () => {
            const res = await request(app).post(`/api/v1/follow/${userId}`);
            expect(res.status).toBe(400);
            expect(res.body.message).toBe('You cannot follow yourself.');
        });

        it('should return 400 if user already follows the target', async () => {
            mockUser.isFollowing.mockReturnValue(true);
            const res = await request(app).post(`/api/v1/follow/${targetUserId}`);
            expect(res.status).toBe(400);
            expect(res.body.message).toBe('You are already following this user.');
        });
    });

    describe('POST /api/v1/unfollow/:userId', () => {
        beforeEach(() => {
            mockUser.following.push(targetUserId);
            mockTargetUser.followers.push(userId);
        });

        it('should successfully unfollow a user', async () => {
            mockUser.isFollowing.mockReturnValue(true);
            const res = await request(app).post(`/api/v1/unfollow/${targetUserId}`);
            
            expect(res.status).toBe(200);
            expect(res.body.message).toBe('Successfully unfollowed user.');
            expect(mockSession.commitTransaction).toHaveBeenCalled();
            expect(mockUser.following.length).toBe(0);
            expect(mockTargetUser.followers.length).toBe(0);
        });

        it('should return 400 if user is not following the target', async () => {
            mockUser.isFollowing.mockReturnValue(false);
            const res = await request(app).post(`/api/v1/unfollow/${targetUserId}`);
            expect(res.status).toBe(400);
            expect(res.body.message).toBe('You are not following this user.');
        });
    });

    describe('GET /api/v1/followers/:userId', () => {
        it('should get a list of followers', async () => {
            const followersList = [{ _id: userId, name: 'Test User' }];
            mockTargetUser.populate = jest.fn().mockResolvedValue({
                followers: followersList,
                followersCount: 1,
            });
            mockTargetUser.followersCount = 1;

            UserMock.findById.mockResolvedValue(mockTargetUser as any);

            const res = await request(app).get(`/api/v1/followers/${targetUserId}?page=1&limit=10`);
            
            expect(res.status).toBe(200);
            expect(res.body.data.followers).toEqual(followersList);
            expect(res.body.data.totalFollowers).toBe(1);
        });
    });

    describe('GET /api/v1/following/:userId', () => {
        it('should get a list of users being followed', async () => {
            const followingList = [{ _id: targetUserId, name: 'Target User' }];
            mockUser.populate = jest.fn().mockResolvedValue({
                following: followingList,
                followingCount: 1,
            });
            mockUser.followingCount = 1;

            UserMock.findById.mockResolvedValue(mockUser as any);

            const res = await request(app).get(`/api/v1/following/${userId}?page=1&limit=10`);
            
            expect(res.status).toBe(200);
            expect(res.body.data.following).toEqual(followingList);
            expect(res.body.data.totalFollowing).toBe(1);
        });
    });
});