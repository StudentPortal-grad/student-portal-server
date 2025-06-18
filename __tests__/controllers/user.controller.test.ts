import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/config/app';
import { UserService } from '../../src/services/user.service';
import { IUser } from '../../src/models/types';

// Mock dependencies
jest.mock('../../src/services/user.service');
jest.mock('../../src/middleware/auth', () => ({
  __esModule: true,
  authenticate: (req: any, res: any, next: any) => {
    if (req.headers.authorization) {
      req.user = {
        _id: new mongoose.Types.ObjectId('60d5ecb3b39e7a4e8c1f2b6a'),
        name: 'Current User',
        email: 'current@test.com',
        blockedUsers: [],
        toObject: () => ({ _id: '60d5ecb3b39e7a4e8c1f2b6a' }),
      } as unknown as IUser;
    }
    next();
  },
  authorize: () => (req: any, res: any, next: any) => next(),
}));

const UserServiceMock = UserService as jest.Mocked<typeof UserService>;

describe('User Controller', () => {
  const currentUserId = '60d5ecb3b39e7a4e8c1f2b6a';
  const otherUserId = '60d5ecb3b39e7a4e8c1f2b6b';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/users', () => {
    it('should return users with isFollowed and isBlocked flags for authenticated user', async () => {
      const users = [
        { _id: otherUserId, name: 'Test User 1', isFollowed: true, isBlocked: false },
        { _id: 'some-other-id', name: 'Test User 2', isFollowed: false, isBlocked: true },
      ];
      const pagination = {
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      };
      UserServiceMock.getUsers.mockResolvedValue({ data: users as any, pagination });

      const res = await request(app)
        .get('/api/v1/users')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(UserService.getUsers).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({ _id: new mongoose.Types.ObjectId(currentUserId) }));
      expect(res.body.data[0].isFollowed).toBe(true);
      expect(res.body.data[1].isBlocked).toBe(true);
    });
  });

  describe('GET /api/v1/users/:userId', () => {
    it('should return a single user with isFollowed and isBlocked flags for authenticated user', async () => {
      const user = { _id: otherUserId, name: 'Test User', isFollowed: true, isBlocked: false };
      UserServiceMock.getUserById.mockResolvedValue({ user: user as any });

      const res = await request(app)
        .get(`/api/v1/users/${otherUserId}`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(UserService.getUserById).toHaveBeenCalledWith(
        new mongoose.Types.ObjectId(otherUserId),
        expect.objectContaining({ _id: new mongoose.Types.ObjectId(currentUserId) }),
        undefined,
        expect.any(Object)
      );
      expect(res.body.data.user.isFollowed).toBe(true);
      expect(res.body.data.user.isBlocked).toBe(false);
    });

    it('should return a single user without flags when not authenticated', async () => {
      const user = { _id: otherUserId, name: 'Test User' }; // No flags
      UserServiceMock.getUserById.mockResolvedValue({ user: user as any });

      const res = await request(app).get(`/api/v1/users/${otherUserId}`);

      expect(res.status).toBe(200);
      expect(UserService.getUserById).toHaveBeenCalledWith(
        new mongoose.Types.ObjectId(otherUserId),
        undefined, // currentUser is undefined
        undefined,
        expect.any(Object)
      );
      expect(res.body.data.user.isFollowed).toBeUndefined();
      expect(res.body.data.user.isBlocked).toBeUndefined();
    });
  });

  describe('Follow & Block Actions', () => {
    it('should return 400 if a user tries to follow themselves', async () => {
      const res = await request(app)
        .post(`/api/v1/users/${currentUserId}/follow`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('You cannot follow yourself.');
    });

    it('should return 400 if a user tries to unfollow themselves', async () => {
      const res = await request(app)
        .delete(`/api/v1/users/${currentUserId}/unfollow`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('You cannot unfollow yourself.');
    });

    it('should return 400 if a user tries to block themselves', async () => {
      const res = await request(app)
        .post(`/api/v1/users/${currentUserId}/block`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('You cannot block yourself.');
    });

    it('should return 400 if a user tries to unblock themselves', async () => {
      const res = await request(app)
        .delete(`/api/v1/users/${currentUserId}/unblock`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('You cannot unblock yourself.');
    });
  });
});
