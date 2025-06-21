import request from 'supertest';
import app from '../../src/config/app';
import { DiscussionService } from '../../src/services/discussion.service';
import { UploadService } from '../../src/utils/uploadService';
import { Types } from 'mongoose';
import { Request, Response, NextFunction } from 'express';

// Mock the services
jest.mock('../../src/services/discussion.service');
jest.mock('../../src/utils/uploadService');

// Mock the authentication and authorization middleware
const mockAuthenticate = jest.fn();
jest.mock('../../src/middleware/auth', () => ({
  ...jest.requireActual('../../src/middleware/auth'),
  authenticate: (req: Request, res: Response, next: NextFunction) => mockAuthenticate(req, res, next),
  authorize: jest.fn((...roles: string[]) => (req: Request, res: Response, next: NextFunction) => {
    if (req.user && roles.includes(req.user.role)) {
      return next();
    }
    return res.status(403).json({ message: 'Forbidden' });
  }),
}));

const MockedDiscussionService = DiscussionService as jest.MockedClass<typeof DiscussionService>;

describe('DiscussionController', () => {
  let bulkDeleteMock: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    // Default user is a student
    mockAuthenticate.mockImplementation((req: Request, res: Response, next: NextFunction) => {
      req.user = { _id: 'mockUserId', name: 'Test User', role: 'student' };
      next();
    });
    bulkDeleteMock = jest.spyOn(MockedDiscussionService.prototype, 'bulkDeleteDiscussions');
  });

  describe('DELETE /v1/discussions/bulk', () => {
    const discussionIds = [new Types.ObjectId().toHexString(), new Types.ObjectId().toHexString()];

    it('should allow an admin to bulk delete discussions and their attachments', async () => {
      const deletedCount = 2;
      bulkDeleteMock.mockResolvedValue(deletedCount);

      // Set user to be an admin for this test
      mockAuthenticate.mockImplementation((req: Request, res: Response, next: NextFunction) => {
        req.user = { _id: 'mockAdminId', name: 'Admin User', role: 'admin' };
        next();
      });

      const response = await request(app)
        .delete('/v1/discussions/bulk')
        .send({ discussionIds });

      expect(response.status).toBe(200);
      expect(bulkDeleteMock).toHaveBeenCalledWith(discussionIds);
      expect(response.body.data.deletedCount).toBe(deletedCount);
      expect(response.body.message).toBe(`${deletedCount} discussions deleted successfully`);
    });

    it('should forbid a non-admin user from bulk deleting discussions', async () => {
      // The default mock user is a 'student', which is not authorized.
      const response = await request(app)
        .delete('/v1/discussions/bulk')
        .send({ discussionIds });

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Forbidden');
      expect(bulkDeleteMock).not.toHaveBeenCalled();
    });

    it('should return 400 if discussionIds is not provided or empty', async () => {
        mockAuthenticate.mockImplementation((req: Request, res: Response, next: NextFunction) => {
            req.user = { _id: 'mockAdminId', name: 'Admin User', role: 'admin' };
            next();
        });

        const response = await request(app)
            .delete('/v1/discussions/bulk')
            .send({ discussionIds: [] });

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('"discussionIds" must contain at least 1 items');
    });
  });
});
