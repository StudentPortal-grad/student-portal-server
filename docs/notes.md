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





// src/models/notification.model.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface INotification extends Document {
  id: string;
  userId: mongoose.Types.ObjectId;
  type: NotificationType;
  title: string;
  content: string;
  status: 'read' | 'unread';
  priority: 'low' | 'medium' | 'high';
  icon?: string;
  actionUrl?: string;
  entityType?: string;
  entityId?: mongoose.Types.ObjectId;
  metadata?: Record<string, any>;
  expiresAt?: Date;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export enum NotificationType {
  // System notifications
  SYSTEM_ANNOUNCEMENT = 'system_announcement',
  MAINTENANCE = 'maintenance',
  
  // User related notifications
  NEW_USER = 'new_user',
  USER_SUSPENDED = 'user_suspended',
  USER_UNSUSPENDED = 'user_unsuspended',
  
  // Community related notifications
  COMMUNITY_CREATED = 'community_created',
  COMMUNITY_UPDATED = 'community_updated',
  COMMUNITY_JOIN_REQUEST = 'community_join_request',
  COMMUNITY_JOINED = 'community_joined',
  COMMUNITY_INVITE = 'community_invite',
  COMMUNITY_ROLE_CHANGED = 'community_role_changed',
  
  // Discussion related notifications
  NEW_DISCUSSION = 'new_discussion',
  DISCUSSION_REPLY = 'discussion_reply',
  DISCUSSION_MENTION = 'discussion_mention',
  
  // Event related notifications
  EVENT_CREATED = 'event_created',
  EVENT_UPDATED = 'event_updated',
  EVENT_REMINDER = 'event_reminder',
  EVENT_CANCELED = 'event_canceled',
  
  // Resource related notifications
  RESOURCE_ADDED = 'resource_added',
  RESOURCE_UPDATED = 'resource_updated',
  
  // Message related notifications
  NEW_MESSAGE = 'new_message',
  
  // Admin dashboard specific
  ADMIN_USER_SIGNUP = 'admin_user_signup',
  ADMIN_REPORT = 'admin_report'
}

const NotificationSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: Object.values(NotificationType),
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500
    },
    status: {
      type: String,
      enum: ['read', 'unread'],
      default: 'unread',
      index: true
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    icon: {
      type: String,
      trim: true
    },
    actionUrl: {
      type: String,
      trim: true
    },
    entityType: {
      type: String,
      trim: true,
      index: true
    },
    entityId: {
      type: Schema.Types.ObjectId,
      index: true
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    },
    expiresAt: {
      type: Date,
      index: true
    },
    readAt: {
      type: Date
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// Indexes for performance
NotificationSchema.index({ createdAt: -1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, status: 1 });

// Auto-prune old notifications after 60 days
NotificationSchema.index({ createdAt: 1 }, { 
  expireAfterSeconds: 60 * 24 * 60 * 60 
});

// Set expiresAt field by default if not provided
NotificationSchema.pre<INotification>('save', function(next) {
  if (!this.expiresAt) {
    const defaultExpiry = new Date();
    // Most notifications expire after 30 days
    defaultExpiry.setDate(defaultExpiry.getDate() + 30);
    this.expiresAt = defaultExpiry;
  }
  next();
});

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);


// src/services/notification.service.ts
import { Notification, NotificationType, INotification } from '../models/notification.model';
import { User } from '../models/user.model';
import { EventEmitter } from 'events';
import mongoose from 'mongoose';

// Singleton event emitter to handle notification events
export const notificationEvents = new EventEmitter();

export class NotificationService {
  /**
   * Create a notification for a specific user
   */
  async createNotification(params: {
    userId: string | mongoose.Types.ObjectId;
    type: NotificationType;
    title: string;
    content: string;
    priority?: 'low' | 'medium' | 'high';
    icon?: string;
    actionUrl?: string;
    entityType?: string;
    entityId?: string | mongoose.Types.ObjectId;
    metadata?: Record<string, any>;
    expiresAt?: Date;
  }): Promise<INotification> {
    const notification = await Notification.create({
      ...params,
      status: 'unread'
    });

    // Emit an event for real-time notifications
    notificationEvents.emit('new_notification', {
      notificationId: notification._id,
      userId: params.userId,
      type: params.type
    });

    return notification;
  }

  /**
   * Create notifications for multiple users (bulk)
   */
  async createBulkNotifications(
    userIds: (string | mongoose.Types.ObjectId)[],
    notificationData: {
      type: NotificationType;
      title: string;
      content: string;
      priority?: 'low' | 'medium' | 'high';
      icon?: string;
      actionUrl?: string;
      entityType?: string;
      entityId?: string | mongoose.Types.ObjectId;
      metadata?: Record<string, any>;
      expiresAt?: Date;
    }
  ): Promise<INotification[]> {
    const notifications = await Notification.insertMany(
      userIds.map(userId => ({
        userId,
        ...notificationData,
        status: 'unread'
      }))
    );

    // Emit events for real-time notifications
    notifications.forEach(notification => {
      notificationEvents.emit('new_notification', {
        notificationId: notification._id,
        userId: notification.userId,
        type: notification.type
      });
    });

    return notifications;
  }

  /**
   * Create notifications for all users with a specific role
   */
  async notifyUsersByRole(
    role: string,
    notificationData: {
      type: NotificationType;
      title: string;
      content: string;
      priority?: 'low' | 'medium' | 'high';
      icon?: string;
      actionUrl?: string;
      entityType?: string;
      entityId?: string | mongoose.Types.ObjectId;
      metadata?: Record<string, any>;
      expiresAt?: Date;
    }
  ): Promise<INotification[]> {
    // Find all users with specified role
    const users = await User.find({ role }).select('_id');
    
    // Create notifications for each user
    return this.createBulkNotifications(
      users.map(user => user._id),
      notificationData
    );
  }

  /**
   * Create admin notifications
   */
  async createAdminNotification(
    notificationData: {
      type: NotificationType;
      title: string;
      content: string;
      priority?: 'low' | 'medium' | 'high';
      icon?: string;
      actionUrl?: string;
      entityType?: string;
      entityId?: string | mongoose.Types.ObjectId;
      metadata?: Record<string, any>;
      expiresAt?: Date;
    }
  ): Promise<INotification[]> {
    return this.notifyUsersByRole('admin', notificationData);
  }

  /**
   * Create a community notification (for all members)
   */
  async createCommunityNotification(
    communityId: string | mongoose.Types.ObjectId,
    notificationData: {
      type: NotificationType;
      title: string;
      content: string;
      priority?: 'low' | 'medium' | 'high';
      icon?: string;
      actionUrl?: string;
      entityType?: string;
      entityId?: string | mongoose.Types.ObjectId;
      metadata?: Record<string, any>;
      expiresAt?: Date;
    }
  ): Promise<INotification[]> {
    // Get all community members
    const community = await mongoose.model('Community').findById(communityId).select('members');
    
    if (!community) {
      throw new Error('Community not found');
    }
    
    const memberIds = community.members.map(member => member.userId);
    
    // Create notifications for all members
    return this.createBulkNotifications(
      memberIds,
      {
        ...notificationData,
        entityType: 'community',
        entityId: communityId,
        metadata: {
          ...notificationData.metadata,
          communityId
        }
      }
    );
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId: string | mongoose.Types.ObjectId, userId: string | mongoose.Types.ObjectId): Promise<INotification> {
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { 
        status: 'read',
        readAt: new Date() 
      },
      { new: true }
    );
    
    if (!notification) {
      throw new Error('Notification not found');
    }
    
    return notification;
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string | mongoose.Types.ObjectId): Promise<void> {
    await Notification.updateMany(
      { userId, status: 'unread' },
      { 
        status: 'read',
        readAt: new Date() 
      }
    );
  }

  /**
   * Get user notifications with pagination
   */
  async getUserNotifications(
    userId: string | mongoose.Types.ObjectId,
    options: {
      page?: number;
      limit?: number;
      status?: 'read' | 'unread' | 'all';
      type?: NotificationType;
    } = {}
  ): Promise<{
    notifications: INotification[];
    total: number;
    page: number;
    limit: number;
    pages: number;
  }> {
    const { 
      page = 1, 
      limit = 20, 
      status = 'all',
      type
    } = options;
    
    const query: any = { userId };
    
    if (status !== 'all') {
      query.status = status;
    }
    
    if (type) {
      query.type = type;
    }
    
    const [notifications, total] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Notification.countDocuments(query)
    ]);
    
    return {
      notifications,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    };
  }

  /**
   * Get unread notification count for a user
   */
  async getUnreadCount(userId: string | mongoose.Types.ObjectId): Promise<number> {
    return Notification.countDocuments({ userId, status: 'unread' });
  }

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: string | mongoose.Types.ObjectId, userId: string | mongoose.Types.ObjectId): Promise<void> {
    const notification = await Notification.findOneAndDelete({ _id: notificationId, userId });
    
    if (!notification) {
      throw new Error('Notification not found');
    }
  }

  /**
   * Delete notifications that have expired
   * This can be run as a scheduled job
   */
  async deleteExpiredNotifications(): Promise<number> {
    const result = await Notification.deleteMany({
      expiresAt: { $lt: new Date() }
    });
    
    return result.deletedCount;
  }
}

export default new NotificationService();

# Implementation Summary

## 1. Communities and Discussions Module ✅

### Community Management
- Basic CRUD operations for communities ✅
- Community member management ✅
- Resource listing within communities ✅

### Community Roles Management
- CRUD operations for roles ✅
- Role assignment and permission checking ✅
- Role-based authorization ✅

### Discussion System
- Comprehensive discussion controller with all required endpoints ✅
- Voting system for discussions ✅
- Discussion status management (open, closed, archived) ✅
- Pinning discussions ✅
- Viewing replies separately ✅
- Pagination and filtering for discussions and replies ✅

## 2. Events Module ✅

### Event Management
- Basic CRUD operations for events ✅
- Event metrics for dashboard ✅
- Event attendees listing ✅

### RSVP System
- RSVP model and controller ✅
- Endpoints for creating, updating, and deleting RSVPs ✅
- RSVP status filtering and listing ✅

### Calendar Integration
- iCal export functionality ✅
- Batch export for multiple events ✅
- Google/Outlook calendar integration ✅

### Event Recommendations
- Event recommendations based on user preferences and history ✅

## 3. Resources Module ✅

### Resource Management
- Basic CRUD operations for resources ✅
- Resource metrics for dashboard ✅
- File upload functionality ✅

### Resource Interaction
- Download tracking ✅
- View tracking ✅
- Rating system ✅
- Comments system ✅

### Resource Recommendations
- Resource recommendations based on user interactions ✅

## Implementation Details

All implementations follow the established patterns in the codebase:
- Routes → Controllers → Services → Models architecture
- Proper validation middleware
- Consistent error handling using AppError
- Authentication and authorization checks
- Response handler middleware for consistent API responses
