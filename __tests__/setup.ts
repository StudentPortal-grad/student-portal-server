import mongoose from 'mongoose';
import { Response, Request, NextFunction } from 'express';

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

// Setup and teardown for MongoDB in-memory server
export const setupTestDB = () => {
  beforeAll(async () => {
  }); 

  afterAll(async () => {
  });

  afterEach(async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  });
};

// Mock mongoose models
export const mockModel = (modelName: string, mockData: any = {}) => {
  const mockFind = jest.fn().mockReturnThis();
  const mockFindOne = jest.fn().mockReturnThis();
  const mockFindById = jest.fn().mockReturnThis();
  const mockPopulate = jest.fn().mockReturnThis();
  const mockSort = jest.fn().mockReturnThis();
  const mockSkip = jest.fn().mockReturnThis();
  const mockLimit = jest.fn().mockReturnThis();
  const mockLean = jest.fn().mockReturnThis();
  const mockExec = jest.fn().mockResolvedValue(mockData);
  const mockCreate = jest.fn().mockResolvedValue(mockData);
  const mockSave = jest.fn().mockResolvedValue(mockData);
  const mockUpdateOne = jest.fn().mockResolvedValue({ nModified: 1 });
  const mockUpdateMany = jest.fn().mockResolvedValue({ nModified: 1 });
  const mockDeleteOne = jest.fn().mockResolvedValue({ deletedCount: 1 });
  const mockDeleteMany = jest.fn().mockResolvedValue({ deletedCount: 1 });
  const mockCountDocuments = jest.fn().mockResolvedValue(0);
  
  return {
    find: mockFind,
    findOne: mockFindOne,
    findById: mockFindById,
    populate: mockPopulate,
    sort: mockSort,
    skip: mockSkip,
    limit: mockLimit,
    lean: mockLean,
    exec: mockExec,
    create: mockCreate,
    save: mockSave,
    updateOne: mockUpdateOne,
    updateMany: mockUpdateMany,
    deleteOne: mockDeleteOne,
    deleteMany: mockDeleteMany,
    countDocuments: mockCountDocuments,
  };
};

// Generate a mock ObjectId
export const generateObjectId = () => {
  return new mongoose.Types.ObjectId().toString();
};
