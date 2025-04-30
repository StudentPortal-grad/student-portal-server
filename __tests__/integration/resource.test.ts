import request from 'supertest';
import mongoose from 'mongoose';
import express from 'express';
import jwt from 'jsonwebtoken';
import bodyParser from 'body-parser';

// Create a mock Express app for testing
const app = express();
app.use(bodyParser.json());

// Mock the models
jest.mock('../../src/models/Resource', () => {
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

// Mock the recommendation utilities
jest.mock('../../src/utils/recommendationUtils', () => ({
  generateResourceRecommendations: jest.fn().mockResolvedValue(['resource1', 'resource2']),
}));

// Import the routes (after mocking dependencies)
import resourceRoutes from '../../src/routes/resource/v1/resource.routes';

// Import models after mocking
import Resource from '../../src/models/Resource';

// Setup the app with the routes
app.use('/api/v1/resources', resourceRoutes);

// Create a mock token for authentication
const createAuthToken = (userId: string, role: string = 'user') => {
  return jwt.sign(
    { id: userId, email: 'test@example.com', role },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
};

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

// Mock the upload middleware
jest.mock('../../src/utils/uploadService', () => ({
  uploadFile: (req: any, res: any, next: any) => {
    req.file = {
      filename: 'test-file.pdf',
      path: '/uploads/test-file.pdf',
      mimetype: 'application/pdf',
      size: 1024
    };
    next();
  }
}));

describe('Resource API Routes', () => {
  const mockResourceId = new mongoose.Types.ObjectId().toString();
  const mockUserId = new mongoose.Types.ObjectId().toString();
  
  const mockResourceData = {
    _id: mockResourceId,
    title: 'Test Resource',
    description: 'Test Description',
    fileUrl: 'https://example.com/test-file.pdf',
    fileSize: 1024,
    uploader: mockUserId,
    tags: ['test', 'resource'],
    visibility: 'public',
    interactionStats: {
      downloads: 10,
      views: 20,
      ratings: [{ userId: mockUserId, rating: 4 }],
      avgRating: 4
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUser = {
    _id: mockUserId,
    name: 'Test User',
    email: 'test@example.com',
    role: 'user',
  };

  const authToken = createAuthToken(mockUserId);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/resources', () => {
    it('should get all resources successfully', async () => {
      const mockResources = [mockResourceData];
      const mockCount = 1;
      
      // Mock the database response
      (Resource.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValueOnce(mockResources)
      });
      (Resource.countDocuments as jest.Mock).mockImplementation(() => ({
        exec: jest.fn().mockResolvedValueOnce(mockCount)
      }));
      
      // Make the request
      const response = await request(app)
        .get('/api/v1/resources')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
        
      // Verify the response
      expect(response.body.success).toBe(true);
      expect(response.body.data.resources).toHaveLength(1);
      expect(Resource.find).toHaveBeenCalled();
    });
  });
  
  describe('GET /api/v1/resources/:id', () => {
    it('should get a resource by id successfully', async () => {
      // Mock the database response
      (Resource.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValueOnce(mockResourceData)
      });
      
      // Make the request
      const response = await request(app)
        .get(`/api/v1/resources/${mockResourceId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
        
      // Verify the response
      expect(response.body.success).toBe(true);
      expect(response.body.data.resource).toBeDefined();
      expect(Resource.findById).toHaveBeenCalledWith(mockResourceId);
    });
    
    it('should return 404 if resource does not exist', async () => {
      // Mock the database response for resource not found
      (Resource.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValueOnce(null)
      });
      
      // Make the request
      const response = await request(app)
        .get(`/api/v1/resources/${mockResourceId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
        
      // Verify the response
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('POST /api/v1/resources', () => {
    it('should create a resource successfully', async () => {
      const resourceData = {
        title: 'New Resource',
        description: 'New Description',
        tags: ['new', 'resource'],
        visibility: 'public'
      };
      
      const createdResource = { ...resourceData, _id: new mongoose.Types.ObjectId() };
      
      // Mock the database response
      (Resource.create as jest.Mock).mockResolvedValueOnce(createdResource);
      
      // Make the request
      const response = await request(app)
        .post('/api/v1/resources')
        .set('Authorization', `Bearer ${authToken}`)
        .set('userrole', 'admin') // Set admin role to bypass authorization
        .send(resourceData)
        .expect(201);
        
      // Verify the response
      expect(response.body.success).toBe(true);
      expect(response.body.data.resource).toBeDefined();
      expect(Resource.create).toHaveBeenCalledWith(expect.objectContaining(resourceData));
    });
  });
  
  describe('PATCH /api/v1/resources/:id', () => {
    it('should update a resource successfully', async () => {
      const updateData = {
        title: 'Updated Resource',
        description: 'Updated Description'
      };
      
      const updatedResource = { ...mockResourceData, ...updateData };
      
      // Mock the database responses
      (Resource.findById as jest.Mock).mockReturnValueOnce({
        exec: jest.fn().mockResolvedValueOnce(mockResourceData)
      });
      
      (Resource.updateOne as jest.Mock).mockResolvedValueOnce({ nModified: 1 });
      
      (Resource.findById as jest.Mock).mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValueOnce(updatedResource)
      });
      
      // Make the request
      const response = await request(app)
        .patch(`/api/v1/resources/${mockResourceId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('userrole', 'admin') // Set admin role to bypass authorization
        .send(updateData)
        .expect(200);
        
      // Verify the response
      expect(response.body.success).toBe(true);
      expect(response.body.data.resource).toBeDefined();
      expect(Resource.updateOne).toHaveBeenCalledWith(
        { _id: mockResourceId },
        expect.objectContaining(updateData)
      );
    });
  });
  
  describe('DELETE /api/v1/resources/:id', () => {
    it('should delete a resource successfully', async () => {
      // Mock the database responses
      (Resource.findById as jest.Mock).mockReturnValueOnce({
        exec: jest.fn().mockResolvedValueOnce(mockResourceData)
      });
      
      (Resource.deleteOne as jest.Mock).mockResolvedValueOnce({ deletedCount: 1 });
      
      // Make the request
      const response = await request(app)
        .delete(`/api/v1/resources/${mockResourceId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('userrole', 'admin') // Set admin role to bypass authorization
        .expect(200);
        
      // Verify the response
      expect(response.body.success).toBe(true);
      expect(Resource.deleteOne).toHaveBeenCalledWith({ _id: mockResourceId });
    });
  });
  
  describe('POST /api/v1/resources/:id/rate', () => {
    it('should rate a resource successfully', async () => {
      const ratingData = {
        rating: 5
      };
      
      // Mock the database responses
      (Resource.findById as jest.Mock).mockReturnValueOnce({
        exec: jest.fn().mockResolvedValueOnce(mockResourceData)
      });
      
      (Resource.updateOne as jest.Mock).mockResolvedValueOnce({ nModified: 1 });
      
      const updatedResource = {
        ...mockResourceData,
        interactionStats: {
          ...mockResourceData.interactionStats,
          ratings: [...mockResourceData.interactionStats.ratings, { userId: mockUserId, rating: 5 }],
          avgRating: 4.5
        }
      };
      
      (Resource.findById as jest.Mock).mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValueOnce(updatedResource)
      });
      
      // Make the request
      const response = await request(app)
        .post(`/api/v1/resources/${mockResourceId}/rate`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('userid', mockUserId)
        .send(ratingData)
        .expect(200);
        
      // Verify the response
      expect(response.body.success).toBe(true);
      expect(response.body.data.resource).toBeDefined();
      expect(Resource.updateOne).toHaveBeenCalled();
    });
  });
  
  describe('POST /api/v1/resources/:id/track-view', () => {
    it('should track a resource view successfully', async () => {
      // Mock the database responses
      (Resource.findById as jest.Mock).mockReturnValueOnce({
        exec: jest.fn().mockResolvedValueOnce(mockResourceData)
      });
      
      (Resource.updateOne as jest.Mock).mockResolvedValueOnce({ nModified: 1 });
      
      // Make the request
      const response = await request(app)
        .post(`/api/v1/resources/${mockResourceId}/track-view`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('userid', mockUserId)
        .expect(200);
        
      // Verify the response
      expect(response.body.success).toBe(true);
      expect(Resource.updateOne).toHaveBeenCalled();
    });
  });
  
  describe('GET /api/v1/resources/recommendations', () => {
    it('should get recommended resources for user', async () => {
      const mockRecommendations = [mockResourceData];
      const mockUtils = require('../../src/utils/recommendationUtils');
      mockUtils.generateResourceRecommendations.mockResolvedValueOnce(mockRecommendations);
      
      // Make the request
      const response = await request(app)
        .get('/api/v1/resources/recommendations')
        .set('Authorization', `Bearer ${authToken}`)
        .set('userid', mockUserId)
        .expect(200);
        
      // Verify the response
      expect(response.body.success).toBe(true);
      expect(response.body.data.resources).toBeDefined();
      expect(mockUtils.generateResourceRecommendations).toHaveBeenCalledWith(mockUserId);
    });
  });
});
