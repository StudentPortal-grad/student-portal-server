import request from 'supertest';
import jwt from 'jsonwebtoken';
import { mockModel, generateObjectId } from '../setup';
import Resource from '../../src/models/Resource';
import { httpServer as app } from '../../src/config/app';


// Mock the models
jest.mock('../../src/models/Resource', () => mockModel('Resource'));

// Mock the recommendation utilities
jest.mock('../../src/utils/recommendationUtils', () => ({
  generateResourceRecommendations: jest.fn().mockResolvedValue(['resource1', 'resource2']),
}));

// Mock authentication middleware
jest.mock('../../src/middleware/auth.middleware', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = {
      id: req.headers.authorization?.split(' ')[1] ? jwt.decode(req.headers.authorization.split(' ')[1]) : null,
      role: 'admin'
    };
    next();
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
  const mockResourceId = generateObjectId();
  const mockUserId = generateObjectId();
  
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
    role: 'admin', // Set role to admin for all tests
  };

  const authToken = jwt.sign(
    { id: mockUserId, email: mockUser.email, role: mockUser.role },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/resources', () => {
    it('should get all resources successfully', async () => {
      const mockResources = [mockResourceData];
      
      (Resource as any).find.mockImplementation(() => ({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockResources)
      }));

      (Resource as any).countDocuments.mockImplementation(() => ({
        exec: jest.fn().mockResolvedValue(mockResources.length)
      }));

      const response = await request(app)
        .get('/api/v1/resources')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.resources).toHaveLength(1);
      expect((Resource as any).find).toHaveBeenCalled();
    });
  });
  
  describe('GET /api/v1/resources/:id', () => {
    it('should get a resource by id successfully', async () => {
      (Resource as any).findById.mockImplementation(() => ({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockResourceData)
      }));

      const response = await request(app)
        .get(`/api/v1/resources/${mockResourceId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
        
      // Verify the response
      expect(response.body.success).toBe(true);
      expect(response.body.data.resource).toBeDefined();
      expect((Resource as any).findById).toHaveBeenCalledWith(mockResourceId);
    });
    
    it('should return 404 if resource does not exist', async () => {
      (Resource as any).findById.mockImplementation(() => ({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null)
      }));
      
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

      (Resource as any).create.mockResolvedValue({
        ...resourceData,
        _id: generateObjectId(),
        uploader: mockUserId
      });

      const response = await request(app)
        .post('/api/v1/resources')
        .set('Authorization', `Bearer ${authToken}`)
        .send(resourceData)
        .expect(201);
        
      // Verify the response
      expect(response.body.success).toBe(true);
      expect(response.body.data.resource).toBeDefined();
      expect((Resource as any).create).toHaveBeenCalledWith(
        expect.objectContaining(resourceData)
      );
    });
  });
  
  describe('PATCH /api/v1/resources/:id', () => {
    it('should update a resource successfully', async () => {
      const updateData = {
        title: 'Updated Resource',
        description: 'Updated Description'
      };

      (Resource as any).findById.mockImplementation(() => ({
        exec: jest.fn().mockResolvedValue(mockResourceData)
      }));

      (Resource as any).updateOne.mockResolvedValue({ nModified: 1 });

      const response = await request(app)
        .patch(`/api/v1/resources/${mockResourceId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect((Resource as any).updateOne).toHaveBeenCalled();
    });
  });

  describe('DELETE /api/v1/resources/:id', () => {
    it('should delete a resource successfully', async () => {
      (Resource as any).findById.mockImplementation(() => ({
        exec: jest.fn().mockResolvedValue(mockResourceData)
      }));

      (Resource as any).deleteOne.mockResolvedValue({ deletedCount: 1 });

      const response = await request(app)
        .delete(`/api/v1/resources/${mockResourceId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect((Resource as any).deleteOne).toHaveBeenCalled();
    });
  });
});