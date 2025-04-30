import request from 'supertest';
import mongoose from 'mongoose';
import express from 'express';
import jwt from 'jsonwebtoken';
import bodyParser from 'body-parser';

// Create a mock Express app for testing
const app = express();
app.use(bodyParser.json());

// Mock the models
jest.mock('../../src/models/Discussion', () => {
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
import discussionRoutes from '../../src/routes/discussion/v1/discussion.routes';

// Import models after mocking
import Discussion from '../../src/models/Discussion';

// Setup the app with the routes
app.use('/api/v1/discussions', discussionRoutes);

// Create a mock token for authentication
const createAuthToken = (userId: string, role: string = 'user') => {
  return jwt.sign(
    { id: userId, email: 'test@example.com', role },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
};

describe('Discussion API Routes', () => {
  const mockDiscussionId = new mongoose.Types.ObjectId().toString();
  const mockUserId = new mongoose.Types.ObjectId().toString();
  const mockCommunityId = new mongoose.Types.ObjectId().toString();
  const authToken = createAuthToken(mockUserId);

  const mockDiscussionData = {
    _id: mockDiscussionId,
    title: 'Test Discussion',
    content: 'Test Content',
    author: mockUserId,
    community: mockCommunityId,
    createdAt: new Date(),
    updatedAt: new Date(),
    replies: []
  };

  describe('GET /api/v1/discussions', () => {
    it('should get all discussions successfully', async () => {
      const mockDiscussions = [mockDiscussionData];
      const mockCount = 1;

      // Mock the database response
      (Discussion.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValueOnce(mockDiscussions)
      });
      (Discussion.countDocuments as jest.Mock).mockImplementation(() => ({
        exec: jest.fn().mockResolvedValueOnce(mockCount)
      }));

      // Make the request
      const response = await request(app)
        .get('/api/v1/discussions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify the response
      expect(response.body.success).toBe(true);
      expect(response.body.data.discussions).toHaveLength(1);
      expect(response.body.data.totalDiscussions).toBe(1);
    });
  });

  describe('GET /api/v1/discussions/:id', () => {
    it('should get a discussion by id successfully', async () => {
      // Mock the database response
      (Discussion.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValueOnce(mockDiscussionData)
      });

      // Make the request
      const response = await request(app)
        .get(`/api/v1/discussions/${mockDiscussionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify the response
      expect(response.body.success).toBe(true);
      expect(response.body.data.discussion).toBeDefined();
      expect(response.body.data.discussion._id).toBe(mockDiscussionId);
    });

    it('should return 404 if discussion does not exist', async () => {
      // Mock the database response for discussion not found
      (Discussion.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValueOnce(null)
      });

      // Make the request
      const response = await request(app)
        .get(`/api/v1/discussions/${mockDiscussionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      // Verify the response
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/discussions', () => {
    it('should create a discussion successfully', async () => {
      const discussionData = {
        title: 'New Discussion',
        content: 'New Content',
        community: mockCommunityId
      };

      const createdDiscussion = { 
        ...discussionData, 
        _id: new mongoose.Types.ObjectId(),
        author: mockUserId,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Mock the database response
      (Discussion.create as jest.Mock).mockResolvedValueOnce(createdDiscussion);

      // Make the request
      const response = await request(app)
        .post('/api/v1/discussions')
        .set('Authorization', `Bearer ${authToken}`)
        .set('userid', mockUserId)
        .send(discussionData)
        .expect(201);

      // Verify the response
      expect(response.body.success).toBe(true);
      expect(response.body.data.discussion).toBeDefined();
      expect(response.body.data.discussion.title).toBe(discussionData.title);
    });
  });

  describe('PATCH /api/v1/discussions/:id', () => {
    it('should update a discussion successfully', async () => {
      const updateData = {
        title: 'Updated Title',
        content: 'Updated Content'
      };

      const updatedDiscussion = { ...mockDiscussionData, ...updateData };

      // Mock the database responses
      (Discussion.findById as jest.Mock).mockReturnValueOnce({
        exec: jest.fn().mockResolvedValueOnce(mockDiscussionData)
      });

      (Discussion.updateOne as jest.Mock).mockResolvedValueOnce({ nModified: 1 });

      (Discussion.findById as jest.Mock).mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValueOnce(updatedDiscussion)
      });

      // Make the request
      const response = await request(app)
        .patch(`/api/v1/discussions/${mockDiscussionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('userid', mockUserId) // Set user ID to match discussion author
        .send(updateData)
        .expect(200);

      // Verify the response
      expect(response.body.success).toBe(true);
      expect(response.body.data.discussion).toBeDefined();
      expect(response.body.data.discussion.title).toBe(updateData.title);
    });
  });

  describe('DELETE /api/v1/discussions/:id', () => {
    it('should delete a discussion successfully', async () => {
      // Mock the database responses
      (Discussion.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValueOnce(mockDiscussionData)
      });

      (Discussion.deleteOne as jest.Mock).mockResolvedValueOnce({ deletedCount: 1 });

      // Make the request
      const response = await request(app)
        .delete(`/api/v1/discussions/${mockDiscussionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('userid', mockUserId) // Set user ID to match discussion author
        .expect(200);

      // Verify the response
      expect(response.body.success).toBe(true);
      expect(Discussion.deleteOne).toHaveBeenCalledWith({ _id: mockDiscussionId });
    });
  });

  describe('POST /api/v1/discussions/:id/replies', () => {
    it('should add a reply to a discussion successfully', async () => {
      const replyData = {
        content: 'Test Reply'
      };

      const mockReplyData = {
        _id: new mongoose.Types.ObjectId().toString(),
        content: replyData.content,
        creator: mockUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock the database responses
      (Discussion.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValueOnce({
          ...mockDiscussionData,
          addReply: jest.fn().mockReturnValue({
            ...mockDiscussionData,
            replies: [...(mockDiscussionData.replies || []), mockReplyData]
          })
        })
      });

      // Mock the save method
      const mockSave = jest.fn().mockResolvedValueOnce({
        ...mockDiscussionData,
        replies: [...(mockDiscussionData.replies || []), mockReplyData]
      });
      
      // Add the save method to the mock
      (Discussion.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValueOnce({
          ...mockDiscussionData,
          addReply: jest.fn().mockReturnValue({
            ...mockDiscussionData,
            replies: [...(mockDiscussionData.replies || []), mockReplyData],
            save: mockSave
          })
        })
      });

      // Make the request
      const response = await request(app)
        .post(`/api/v1/discussions/${mockDiscussionId}/replies`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('userid', mockUserId)
        .send(replyData)
        .expect(201);

      // Verify the response
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });
  });

  describe('GET /api/v1/discussions/:id/replies', () => {
    it('should get all replies for a discussion successfully', async () => {
      const mockReply = {
        _id: new mongoose.Types.ObjectId().toString(),
        content: 'Test Reply',
        creator: mockUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockDiscussionWithReplies = {
        ...mockDiscussionData,
        replies: [mockReply]
      };

      // Mock the database response
      (Discussion.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValueOnce(mockDiscussionWithReplies)
      });

      // Make the request
      const response = await request(app)
        .get(`/api/v1/discussions/${mockDiscussionId}/replies`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify the response
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });
  });
});
