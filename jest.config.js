import { pathsToModuleNameMapper } from 'ts-jest';
import tsconfig from './tsconfig.json' assert { type: 'json' };

const moduleNameMapper = pathsToModuleNameMapper(tsconfig.compilerOptions.paths, { prefix: '<rootDir>/src/' });

/** @type {import('ts-jest').JestConfigWithTsJest} **/
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  moduleDirectories: ['node_modules', 'src'],
  moduleNameMapper: {
    ...moduleNameMapper,
    '^(\\.{1,2}/.*)\\.js$': '$1',
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
