## Controllers (/controllers)

- Handles requests & responses but doesn't contain business logic.
- Calls the appropriate service for processing.

## Services (/services)

- Contains core business logic.
- Doesn't deal with HTTP requests/responses.
- Calls repositories for database interactions.

## Repositories (/repositories)

- Only database operations (No business logic).
- Abstracts away database queries.

_References : [Folder Structure](https://mingyang-li.medium.com/production-grade-node-js-typescript-folder-structure-for-2024-f975edeabefd)_

# Error Handling and Response Management Guide

## Quick Start Guide

### 1. Basic Response Usage

```typescript
// Success response
res.success(data, "Operation completed");

// Paginated response
res.paginated(items, {
  total: 100,
  page: 1,
  limit: 10,
  hasNextPage: true,
  hasPrevPage: false
});

// Error responses
res.unauthorized("Please login to continue");
res.notFound("User not found");
res.badRequest("Invalid input", { field: "email", message: "Invalid format" });
res.validationError("Validation failed", errors);
res.internalError("Something went wrong");
```

### 2. Async Route Handler

```typescript
import asyncHandler from '../utils/asyncHandler';

router.get('/users', asyncHandler(async (req, res) => {
  const users = await User.find();
  res.success(users);
}));
```

### 3. Custom Error Throwing

```typescript
import { AppError, ErrorCodes } from '../utils/appError';

if (!user) {
  throw new AppError("User not found", 404, ErrorCodes.NOT_FOUND);
}
```

### 4. Pagination Usage

```typescript
import { getPaginationOptions, getPaginationMetadata } from '../utils/pagination';

router.get('/items', asyncHandler(async (req, res) => {
  const options = getPaginationOptions(req.query);
  const total = await Item.countDocuments();
  const items = await Item.find()
    .skip((options.page - 1) * options.limit)
    .limit(options.limit);
  
  const metadata = getPaginationMetadata(total, options);
  res.paginated(items, metadata);
}));
```

## Understanding the System

### Response Types (`ApiResponse.ts`)

- **HttpStatus**: Enum of standard HTTP status codes
- **ResponseBuilder**: Static class for building consistent API responses
  - `success<T>`: Success response with data
  - `paginated<T>`: Paginated response with metadata
  - `error`: Generic error response
  - `unauthorized`: 401 Unauthorized response
  - `validationError`: 422 Validation error response
  - `notFound`: 404 Not found response
  - `badRequest`: 400 Bad request response
  - `internalError`: 500 Internal server error response

### Error Handling System

#### 1. AppError (`appError.ts`)
- Custom error class extending native Error
- Properties:
  - `statusCode`: HTTP status code
  - `code`: Error code from ErrorCodes enum
  - `details`: Additional error details
  - `isOperational`: Indicates if error is operational

#### 2. Error Handler (`errorHandler.ts`)
Handles different types of errors:
- Mongoose validation errors
- Cast errors
- Duplicate key errors
- JWT errors
- Custom AppErrors
- Unknown errors

#### 3. Async Handler (`asyncHandler.ts`)
- Wraps async route handlers
- Automatically catches errors and forwards to error handler
- Eliminates need for try-catch blocks in routes

### Response Handler (`responseHandler.ts`)

Extends Express Response object with methods:
- `success`: Send success response
- `paginated`: Send paginated response
- `unauthorized`: Send 401 response
- `validationError`: Send 422 response
- `notFound`: Send 404 response
- `badRequest`: Send 400 response
- `internalError`: Send 500 response

### Pagination (`pagination.ts`)

Utilities for handling paginated requests:
- `getPaginationOptions`: Extract pagination params from query
- `getPaginationMetadata`: Generate pagination metadata

## Best Practices

1. **Always use asyncHandler for async routes**
```typescript
router.post('/users', asyncHandler(async (req, res) => {
  // Your code here
}));
```

2. **Use appropriate error types**
```typescript
// For operational errors
throw new AppError("Invalid credentials", 401, ErrorCodes.UNAUTHORIZED);

// For validation errors
throw new AppError("Invalid input", 400, ErrorCodes.VALIDATION_ERROR, errors);
```

3. **Consistent response structure**
```typescript
// Success
res.success(data, "Operation successful");

// Error
throw new AppError("Operation failed", 400, ErrorCodes.INVALID_OPERATION);
```

4. **Proper pagination**
```typescript
const options = getPaginationOptions(req.query);
const metadata = getPaginationMetadata(totalCount, options);
res.paginated(items, metadata);
```

## Error Codes

Common error codes from `ErrorCodes`:
- `UNAUTHORIZED`: Authentication failed
- `FORBIDDEN`: Permission denied
- `NOT_FOUND`: Resource not found
- `VALIDATION_ERROR`: Input validation failed
- `DUPLICATE_ENTRY`: Duplicate record
- `INTERNAL_ERROR`: Server error
- `INVALID_TOKEN`: Invalid JWT
- `TOKEN_EXPIRED`: Expired JWT

## Response Structure

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... },
  "metadata": {
    "timestamp": "2024-..."
  }
}
```

### Paginated Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": [ ... ],
  "metadata": {
    "timestamp": "2024-...",
    "pagination": {
      "total": 100,
      "page": 1,
      "limit": 10,
      "totalPages": 10,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error message",
  "error": {
    "code": "ERROR_CODE",
    "details": { ... }
  },
  "metadata": {
    "timestamp": "2024-..."
  }
}
```

# Database Operations

## Quick Usage

The `DbOperations` class provides type-safe, consistent database operations with built-in error handling.

```typescript
import { DbOperations } from '../utils/dbOperations';
import { User } from '../models/User';

// Create
const user = await DbOperations.create(User, {
  name: 'John Doe',
  email: 'john@example.com'
});

// Find One
const user = await DbOperations.findOne(User, { email: 'john@example.com' });

// Update
const updated = await DbOperations.updateOne(
  User,
  { _id: userId },
  { $set: { status: 'active' } }
);

// Delete
const deleted = await DbOperations.deleteOne(User, { _id: userId });

// Field Selection
const users = await DbOperations.select(User, {}, ['name', 'email']); // Only these fields
const users2 = await DbOperations.select(User, {}, ['-password']); // Exclude password

// Advanced Filtering
const users3 = await DbOperations.filter(
  User,
  { age: { $gte: 18 }, role: 'student' },
  { 
    sort: { createdAt: -1 },
    limit: 10,
    projection: { password: 0 }
  }
);

// Paginated Query
const result = await DbOperations.paginate(User, 
  { role: 'student' },
  { page: 1, limit: 10, sort: { createdAt: -1 } }
);
```

## Available Operations

1. **Create** - Single or multiple documents
   ```typescript
   const doc = await DbOperations.create(Model, data);
   ```

2. **Find** - Single or multiple documents
   ```typescript
   const one = await DbOperations.findOne(Model, filter);
   const many = await DbOperations.findMany(Model, filter);
   ```

3. **Update** - Single or multiple documents
   ```typescript
   const updated = await DbOperations.updateOne(Model, filter, update);
   const count = await DbOperations.updateMany(Model, filter, update);
   ```

4. **Delete** - Single or multiple documents
   ```typescript
   const deleted = await DbOperations.deleteOne(Model, filter);
   const count = await DbOperations.deleteMany(Model, filter);
   ```

5. **Select** - Field selection
   ```typescript
   // Include specific fields
   const docs = await DbOperations.select(Model, filter, ['field1', 'field2']);
   // Exclude specific fields
   const docs = await DbOperations.select(Model, filter, ['-field1', '-field2']);
   // Using object notation
   const docs = await DbOperations.select(Model, filter, { field1: 1, field2: 1 });
   ```

6. **Filter** - Advanced filtering with options
   ```typescript
   const docs = await DbOperations.filter(
     Model,
     { field: { $gte: value } },
     {
       sort: { field: -1 },
       limit: 10,
       skip: 0,
       projection: { field: 1 }
     }
   );
   ```

7. **Count** - Get document count
   ```typescript
   const count = await DbOperations.count(Model, filter);
   ```

8. **Paginate** - Get paginated results
   ```typescript
   const { docs, total, page, limit, pages } = await DbOperations.paginate(
     Model,
     filter,
     { page: 1, limit: 10 }
   );
   ```

9. **Populate** - Populate references with field selection
   ```typescript
   // Populate single field with specific sub-fields
   const post = await DbOperations.populate(Post, postId, {
     path: 'author',
     select: ['name', 'email']
   });

   // Populate multiple fields with nested population
   const post = await DbOperations.populate(Post, postId, [
     {
       path: 'author',
       select: ['name', 'avatar']
     },
     {
       path: 'comments',
       select: ['content', 'createdAt'],
       populate: {
         path: 'author',
         select: ['name']
       }
     }
   ]);

   // Populate field in multiple documents
   const posts = await DbOperations.populate(Post, posts, {
     path: 'author',
     select: ['name', 'email']
   });

   // Populate using object notation for field selection
   const post = await DbOperations.populate(Post, postId, {
     path: 'author',
     select: { name: 1, email: 1, password: 0 }
   });
   ```

## Features

- Full TypeScript support with generics
- Consistent error handling using AppError
- Automatic pagination with metadata
- Promise-based API
- Built-in validation and error handling
- Safe query options and projections

## Error Handling

All operations automatically handle errors and convert them to `AppError` instances:

```typescript
try {
  const user = await DbOperations.findOne(User, { _id: 'invalid' });
} catch (error) {
  // error is instance of AppError
  console.log(error.code); // 'DB_ERROR'
  console.log(error.statusCode); // 500
}
```
