import mongoose from 'mongoose';
import { Response } from 'express';

// Define custom response interface with additional methods
interface CustomResponse extends Response {
  success: (data?: any) => Response;
  paginated: (data?: any, pagination?: any) => Response;
  unauthorized: (message?: string) => Response;
  notFound: (message?: string) => Response;
  badRequest: (message?: string) => Response;
  validationError: (errors?: any) => Response;
  internalError: (error?: any) => Response;
}

// Mock response object with success, error, and other methods
export const mockResponse = () => {
  const res: Partial<CustomResponse> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  
  // Add custom response methods used in the application
  res.success = jest.fn().mockReturnValue(res as any);
  res.paginated = jest.fn().mockReturnValue(res as any);
  res.unauthorized = jest.fn().mockReturnValue(res as any);
  res.notFound = jest.fn().mockReturnValue(res as any);
  res.badRequest = jest.fn().mockReturnValue(res as any);
  res.validationError = jest.fn().mockReturnValue(res as any);
  res.internalError = jest.fn().mockReturnValue(res as any);
  
  return res as CustomResponse;
};

// Mock request object
export const mockRequest = (data: any = {}) => {
  return {
    body: data.body || {},
    params: data.params || {},
    query: data.query || {},
    user: data.user || null,
    headers: data.headers || {},
    ...data
  };
};

// Mock next function
export const mockNext = jest.fn();

// Mock database operations
export const mockDbOperation = (mockData: any = null) => {
  return {
    exec: jest.fn().mockResolvedValue(mockData),
    lean: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
  };
};

// Mock mongoose model operations
export const mockModel = (modelName: string, mockData: any = {}) => {
  return {
    find: jest.fn().mockImplementation(() => mockDbOperation(Array.isArray(mockData) ? mockData : [mockData])),
    findOne: jest.fn().mockImplementation(() => mockDbOperation(mockData)),
    findById: jest.fn().mockImplementation(() => mockDbOperation(mockData)),
    create: jest.fn().mockResolvedValue(mockData),
    updateOne: jest.fn().mockResolvedValue({ nModified: 1, ...mockData }),
    updateMany: jest.fn().mockResolvedValue({ nModified: mockData.length || 1 }),
    deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
    deleteMany: jest.fn().mockResolvedValue({ deletedCount: mockData.length || 1 }),
    countDocuments: jest.fn().mockImplementation(() => mockDbOperation(mockData.length || 0)),
    aggregate: jest.fn().mockImplementation(() => mockDbOperation(mockData)),
  };
};

// Generate a mock ObjectId
export const generateObjectId = () => new mongoose.Types.ObjectId().toString();

// Mock mongoose connection
export const setupTestDB = () => {
  beforeAll(() => {
    // Mock mongoose connect method
    jest.spyOn(mongoose, 'connect').mockImplementation(() => Promise.resolve(mongoose));
    
    // Create a mock connection object
    const mockConnection = {
      collections: {},
      db: {
        collection: jest.fn().mockReturnValue({
          deleteMany: jest.fn().mockResolvedValue({ deletedCount: 1 })
        })
      }
    };

    // Mock the connection getter
    Object.defineProperty(mongoose, 'connection', {
      get: jest.fn().mockReturnValue(mockConnection),
      configurable: true
    });
  });

  afterAll(() => {
    // Clean up mocks
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });
};
