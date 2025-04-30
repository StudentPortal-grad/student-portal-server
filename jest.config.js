/** @type {import('ts-jest').JestConfigWithTsJest} **/
export default {
  testEnvironment: 'node',
  transform: {
    '^.+\.tsx?$': ['ts-jest', {}],
  },
  moduleNameMapper: {
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@routes/(.*)$': '<rootDir>/src/routes/$1',
    '^@controllers/(.*)$': '<rootDir>/src/controllers/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@repositories/(.*)$': '<rootDir>/src/repositories/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@middleware/(.*)$': '<rootDir>/src/middleware/$1',
    '^@validators/(.*)$': '<rootDir>/src/validators/$1',
    '^@validations/(.*)$': '<rootDir>/src/validations/$1',
    '^@models/(.*)$': '<rootDir>/src/models/$1'
  },
  // Increase timeout for socket tests
  testTimeout: 60000,
  // Detect open handles to help identify resource leaks
  detectOpenHandles: true,
  // Force exit after tests complete
  forceExit: true,
  // Verbose output for better debugging
  verbose: true,
  // Run all test files
  testMatch: ['**/__tests__/**/*.test.ts'],
};
