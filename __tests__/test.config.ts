export const TEST_CONFIG = {
  // Database configuration
  mongodb: {
    uri: process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/test-db',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  },
  
  // JWT configuration
  jwt: {
    secret: process.env.JWT_TEST_SECRET || 'test-secret',
    expiresIn: '1h'
  },
  
  // Test timeouts
  timeouts: {
    default: 5000,
    socket: 10000,
    database: 10000
  },
  
  // Test user credentials
  testUser: {
    email: 'test@example.com',
    password: 'Test@123',
    firstName: 'Test',
    lastName: 'User',
    role: 'student'
  },
  
  // Socket.io test configuration
  socket: {
    url: process.env.SOCKET_TEST_URL || 'http://localhost:3000',
    options: {
      autoConnect: false,
      forceNew: true
    }
  }
}; 
// test line