import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

// Create a mock user for testing
export const createMockUser = (overrides = {}) => {
  return {
    _id: new mongoose.Types.ObjectId(),
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    role: 'student',
    ...overrides
  };
};

// Generate a valid JWT token for testing
export const generateTestToken = (user: any) => {
  return jwt.sign(
    { 
      id: user._id,
      email: user.email,
      role: user.role 
    },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
};

// Create test data for pagination tests
export const createPaginatedTestData = async (model: any, data: any[], itemsPerPage = 10) => {
  await model.create(data);
  const totalItems = data.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  
  return {
    itemsPerPage,
    totalItems,
    totalPages
  };
};

// Clean specific collections
export const cleanCollections = async (...collections: string[]) => {
  for (const collection of collections) {
    if (mongoose.connection.collections[collection]) {
      await mongoose.connection.collections[collection].deleteMany({});
    }
  }
};

// Wait for a specified time (useful for async operations)
export const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Create a mock error for testing error handlers
export const createMockError = (message = 'Test error', status = 500) => {
  const error = new Error(message) as any;
  error.status = status;
  return error;
}; 