import request from 'supertest';
import mongoose from 'mongoose';
import express from 'express';
import jwt from 'jsonwebtoken';
import bodyParser from 'body-parser';

// Create a mock Express app for testing
const app = express();
app.use(bodyParser.json());

// Mock the models
jest.mock('../../src/models/Community', () => {
  return {
    find: jest.fn().mockReturnThis(),
    findById: jest.fn().mockReturnThis(),
    findOne: jest.fn().mockReturnThis(),
    create: jest.fn(),
    updateOne: jest.fn(),
    deleteOne: jest.fn(),
    countDocuments: jest.fn(),
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn()
  };
});

jest.mock('../../src/models/User', () => {
  return {
    find: jest.fn().mockReturnThis(),
    findById: jest.fn().mockReturnThis(),
    findOne: jest.fn().mockReturnThis(),
    create: jest.fn(),
    updateOne: jest.fn(),
    deleteOne: jest.fn(),
    countDocuments: jest.fn(),
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn()
  };
});

// Mock the authentication middleware
jest.mock('../../src/middleware/auth', () => ({
  authenticate: (req: any, res: any, next: any) => {
    req.user = {
      _id: req.headers.userid || new mongoose.Types.ObjectId().toString(),
      email: 'test@example.com',
      role: req.headers.userrole || 'user'
    };
    next();
  },
  authorize: (...roles: string[]) => (req: any, res: any, next: any) => {
    if (roles.includes(req.user.role) || req.user.role === 'admin') {
      next();
    } else {
      res.status(403).json({ message: 'Forbidden' });
    }
  }
}));

// Import the routes (after mocking dependencies)
import communityRoutes from '../../src/routes/community/v1/community.routes';

// Import models after mocking
import Community from '../../src/models/Community';
import User from '../../src/models/User';

// Setup the app with the routes
app.use('/api/v1/communities', communityRoutes);

// Create a mock token for authentication
const createAuthToken = (userId: string, role: string = 'user') => {
  return jwt.sign(
    { id: userId, email: 'test@example.com', role },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
};

describe('Community API Routes', () => {
  const mockCommunityId = new mongoose.Types.ObjectId().toString();
  const mockUserId = new mongoose.Types.ObjectId().toString();
  const authToken = createAuthToken(mockUserId);

  const mockCommunityData = {
    _id: mockCommunityId,
    name: 'Test Community',
    description: 'Test Description',
    creator: mockUserId,
    members: [mockUserId],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('GET /api/v1/communities', () => {
    it('should get all communities successfully', async () => {
      const mockCommunities = [mockCommunityData];
      const mockCount = 1;

      // Mock the database response
      (Community.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValueOnce(mockCommunities)
      });
      (Community.countDocuments as jest.Mock).mockImplementation(() => ({
        exec: jest.fn().mockResolvedValueOnce(mockCount)
      }));

      // Make the request
      const response = await request(app)
        .get('/api/v1/communities')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify the response
      expect(response.body.success).toBe(true);
      expect(response.body.data.communities).toHaveLength(1);
      expect(response.body.data.totalCommunities).toBe(1);
    });
  });

  describe('GET /api/v1/communities/:id', () => {
    it('should get a community by id successfully', async () => {
      // Mock the database response
      (Community.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValueOnce(mockCommunityData)
      });

      // Make the request
      const response = await request(app)
        .get(`/api/v1/communities/${mockCommunityId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify the response
      expect(response.body.success).toBe(true);
      expect(response.body.data.community).toBeDefined();
      expect(response.body.data.community._id).toBe(mockCommunityId);
    });

    it('should return 404 if community does not exist', async () => {
      // Mock the database response for community not found
      (Community.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValueOnce(null)
      });

      // Make the request
      const response = await request(app)
        .get(`/api/v1/communities/${mockCommunityId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      // Verify the response
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/communities', () => {
    it('should create a community successfully', async () => {
      const communityData = {
        name: 'New Community',
        description: 'New Description',
      };

      const createdCommunity = { ...communityData, _id: new mongoose.Types.ObjectId() };

      // Mock the database response
      (Community.create as jest.Mock).mockResolvedValueOnce(createdCommunity);

      // Make the request
      const response = await request(app)
        .post('/api/v1/communities')
        .set('Authorization', `Bearer ${authToken}`)
        .set('userid', mockUserId)
        .send(communityData)
        .expect(201);

      // Verify the response
      expect(response.body.success).toBe(true);
      expect(response.body.data.community).toBeDefined();
      expect(response.body.data.community.name).toBe(communityData.name);
    });
  });

  describe('PATCH /api/v1/communities/:id', () => {
    it('should update a community successfully', async () => {
      const updateData = {
        name: 'Updated Name',
        description: 'Updated Description'
      };

      const updatedCommunity = { ...mockCommunityData, ...updateData };

      // Mock the database responses
      (Community.findById as jest.Mock).mockReturnValueOnce({
        exec: jest.fn().mockResolvedValueOnce(mockCommunityData)
      });

      (Community.updateOne as jest.Mock).mockResolvedValueOnce({ nModified: 1 });

      (Community.findById as jest.Mock).mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValueOnce(updatedCommunity)
      });

      // Make the request
      const response = await request(app)
        .patch(`/api/v1/communities/${mockCommunityId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('userid', mockUserId) // Set user ID to match community creator
        .send(updateData)
        .expect(200);

      // Verify the response
      expect(response.body.success).toBe(true);
      expect(response.body.data.community).toBeDefined();
      expect(response.body.data.community.name).toBe(updateData.name);
    });
  });

  describe('DELETE /api/v1/communities/:id', () => {
    it('should delete a community successfully', async () => {
      // Mock the database responses
      (Community.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValueOnce(mockCommunityData)
      });

      (Community.deleteOne as jest.Mock).mockResolvedValueOnce({ deletedCount: 1 });

      // Make the request
      const response = await request(app)
        .delete(`/api/v1/communities/${mockCommunityId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('userid', mockUserId) // Set user ID to match community creator
        .expect(200);

      // Verify the response
      expect(response.body.success).toBe(true);
      expect(Community.deleteOne).toHaveBeenCalledWith({ _id: mockCommunityId });
    });
  });

  describe('POST /api/v1/communities/:id/join', () => {
    it('should join a community successfully', async () => {
      // Mock the database responses
      (Community.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValueOnce(mockCommunityData)
      });

      (Community.updateOne as jest.Mock).mockResolvedValueOnce({ nModified: 1 });

      // Make the request
      const response = await request(app)
        .post(`/api/v1/communities/${mockCommunityId}/join`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('userid', mockUserId)
        .expect(200);

      // Verify the response
      expect(response.body.success).toBe(true);
      expect(Community.updateOne).toHaveBeenCalled();
    });
  });

  describe('POST /api/v1/communities/:id/leave', () => {
    it('should leave a community successfully', async () => {
      // Mock the database responses
      (Community.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValueOnce(mockCommunityData)
      });

      (Community.updateOne as jest.Mock).mockResolvedValueOnce({ nModified: 1 });

      // Make the request
      const response = await request(app)
        .post(`/api/v1/communities/${mockCommunityId}/leave`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('userid', mockUserId)
        .expect(200);

      // Verify the response
      expect(response.body.success).toBe(true);
      expect(Community.updateOne).toHaveBeenCalled();
    });
  });
});
