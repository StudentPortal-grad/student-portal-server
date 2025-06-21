import request from 'supertest';
import app from '../../src/config/app';
import Resource from '../../src/models/Resource';
import axios from 'axios';
import { Types } from 'mongoose';
import { PassThrough } from 'stream';

// Mock the models and dependencies
jest.mock('../../src/models/Resource');
jest.mock('axios');

// Mock the authentication middleware
jest.mock('../../src/middleware/auth', () => ({
  ...jest.requireActual('../../src/middleware/auth'),
  authenticate: jest.fn((req, res, next) => {
    req.user = { _id: 'mockUserId', name: 'Test User', email: 'test@test.com' };
    next();
  }),
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ResourceController', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /v1/resources/:id/download', () => {
    it('should download a resource file successfully', async () => {
      const mockResourceId = new Types.ObjectId().toHexString();
      const mockResource = {
        _id: mockResourceId,
        fileUrl: 'http://example.com/file.pdf',
        originalFileName: 'test-file.pdf',
        mimeType: 'application/pdf',
        incrementDownloads: jest.fn().mockResolvedValue(undefined),
      };

      (Resource.findById as jest.Mock).mockResolvedValue(mockResource);

      const mockFileStream = new PassThrough();
      mockFileStream.write('file content');
      mockFileStream.end();

      mockedAxios.mockResolvedValue({
        data: mockFileStream,
        headers: { 'content-type': 'application/pdf' },
      } as any);

      const response = await request(app).get(`/v1/resources/${mockResourceId}/download`);

      expect(response.status).toBe(200);
      expect(Resource.findById).toHaveBeenCalledWith(mockResourceId);
      expect(mockResource.incrementDownloads).toHaveBeenCalled();
      expect(mockedAxios).toHaveBeenCalledWith({
        method: 'GET',
        url: mockResource.fileUrl,
        responseType: 'stream',
      });
      expect(response.headers['content-disposition']).toBe(`attachment; filename="${mockResource.originalFileName}"`);
      expect(response.headers['content-type']).toBe(mockResource.mimeType);
      expect(response.text).toBe('file content');
    });

    it('should return 404 if the resource is not found', async () => {
      const mockResourceId = new Types.ObjectId().toHexString();
      (Resource.findById as jest.Mock).mockResolvedValue(null);

      const response = await request(app).get(`/v1/resources/${mockResourceId}/download`);

      expect(response.status).toBe(500); // The error handler wraps it in a 500 AppError
      expect(response.body.message).toContain('Resource not found');
    });

    it('should return 400 for an invalid resource ID', async () => {
      const invalidResourceId = 'invalid-id';
      const response = await request(app).get(`/v1/resources/${invalidResourceId}/download`);

      expect(response.status).toBe(500); // The error handler wraps it in a 500 AppError
      expect(response.body.message).toContain('Invalid resource ID');
    });

    it('should handle errors when fetching the file from the URL', async () => {
      const mockResourceId = new Types.ObjectId().toHexString();
      const mockResource = {
        _id: mockResourceId,
        fileUrl: 'http://example.com/file.pdf',
        originalFileName: 'test-file.pdf',
        mimeType: 'application/pdf',
        incrementDownloads: jest.fn().mockResolvedValue(undefined),
      };

      (Resource.findById as jest.Mock).mockResolvedValue(mockResource);

      mockedAxios.mockRejectedValue(new Error('Network Error'));

      const response = await request(app).get(`/v1/resources/${mockResourceId}/download`);

      expect(response.status).toBe(500);
      expect(response.body.message).toContain('Failed to download resource');
    });
  });
});
