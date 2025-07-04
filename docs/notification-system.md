# Notification System Documentation

## Overview

The notification system provides real-time notifications for messaging events, supporting both socket.io and REST API endpoints. It efficiently handles message notifications, unread counts, and user preferences.

## Features

### ✅ Completed Features

1. **Message Notifications**
   - ✅ Emit notifications when messages are received
   - ✅ Emit notifications for message edits (optional)
   - ✅ Emit notifications for message deletions (optional)
   - ✅ Emit unread count on user login/socket connect

2. **User Preferences**
   - ✅ Respect user notification settings (`messageNotifications: "all" | "mentions" | "none"`)
   - ✅ Respect muted conversations
   - ✅ Support for different notification types

3. **Real-time Updates**
   - ✅ Socket.io integration for instant notifications
   - ✅ Unread count updates
   - ✅ Firebase Cloud Messaging (FCM) support (ready for implementation)

4. **API Endpoints**
   - ✅ `GET /messages/unread` - Get unread message counts
   - ✅ `GET /notifications` - Get user notifications with pagination
   - ✅ `PATCH /notifications/:id/read` - Mark notification as read
   - ✅ `PATCH /notifications/read-all` - Mark all notifications as read

## Architecture

### Components

1. **NotificationService** (`src/services/notification.service.ts`)
   - Singleton service for notification management
   - Handles notification creation, FCM, and unread counts
   - Integrates with EventsManager for decoupled architecture

2. **Socket Integration** (`src/services/socket/handleMessageEvents.ts`)
   - Integrates notification creation with message events
   - Handles real-time notification delivery

3. **API Controllers**
   - `MessageController` - Handles message-related endpoints
   - `NotificationController` - Handles notification management

4. **Socket Events**
   - `unreadCountUpdate` - Real-time unread count updates
   - `notification` - Real-time notification delivery

## API Endpoints

### Message Endpoints

#### `GET /api/v1/messages/unread`
Get unread message counts for the authenticated user.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalUnreadNotifications": 5,
    "totalUnreadMessages": 12,
    "conversationUnreadCounts": [
      {
        "conversationId": "507f1f77bcf86cd799439011",
        "unreadCount": 3
      }
    ]
  }
}
```

### Notification Endpoints

#### `GET /api/v1/notifications`
Get user's notifications with pagination.

**Query Parameters:**
- `page` (number, default: 1)
- `limit` (number, default: 20)
- `type` (string, optional) - Filter by notification type
- `status` (string, optional) - Filter by status ("read" | "unread")

**Response:**
```json
{
  "success": true,
  "data": {
    "notifications": [...],
    "pagination": {
      "total": 50,
      "page": 1,
      "limit": 20,
      "totalPages": 3
    },
    "totalUnread": 5
  }
}
```

#### `PATCH /api/v1/notifications/:notificationId/read`
Mark a specific notification as read.

#### `PATCH /api/v1/notifications/read-all`
Mark all notifications as read.

#### `GET /api/v1/notifications/unread-count`
Get user's unread notification count.

#### `PATCH /api/v1/notifications/conversation/:conversationId/read`
Mark all notifications for a specific conversation as read.

## Socket Events

### Client to Server Events

#### `join-notifications`
Join user's notification room for real-time updates.

```javascript
socket.emit('join-notifications', userId);
```

#### `leave-notifications`
Leave user's notification room.

```javascript
socket.emit('leave-notifications', userId);
```

### Server to Client Events

#### `notification`
Receive real-time notifications.

```javascript
socket.on('notification', (notification) => {
  console.log('New notification:', notification);
});
```

#### `unreadCountUpdate`
Receive real-time unread count updates.

```javascript
socket.on('unreadCountUpdate', (data) => {
  console.log('Unread count:', data.count);
});
```

## Notification Types

### Message Notifications

1. **`new_message`**
   - Triggered when a new message is received
   - Content: `"John Doe: Hello there!"` or `"John Doe in Group Chat: Hello there!"`

2. **`message_edited`**
   - Triggered when a message is edited
   - Content: `"John Doe edited a message"`

3. **`message_deleted`**
   - Triggered when a message is deleted
   - Content: `"John Doe deleted a message"`

### Notification Metadata

Each notification includes rich metadata:

```json
{
  "messageId": "507f1f77bcf86cd799439011",
  "conversationId": "507f1f77bcf86cd799439012",
  "senderId": "507f1f77bcf86cd799439013",
  "senderName": "John Doe",
  "conversationName": "Group Chat",
  "conversationType": "GroupDM",
  "action": "created",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## User Preferences

The system respects user notification preferences:

```typescript
interface IChatPreferences {
  messageNotifications: "all" | "mentions" | "none";
  soundEnabled: boolean;
  desktopNotifications: boolean;
  showTypingIndicators: boolean;
  markReadOnView: boolean;
  theme: "light" | "dark" | "system";
}
```

## Performance Optimizations

1. **Batch Operations**
   - Notifications are created in parallel for multiple recipients
   - Unread counts are calculated efficiently using database aggregation

2. **Database Indexes**
   - Indexed on `userId` and `status` for fast queries
   - Indexed on `createdAt` for chronological ordering

3. **Socket Efficiency**
   - Users automatically join their notification room on connection
   - Unread counts are emitted on connection and after relevant actions

4. **Memory Management**
   - Singleton pattern for NotificationService
   - Efficient event handling with proper cleanup

## Integration Points

### Message Events Integration

The notification system integrates seamlessly with existing message events:

1. **Message Sent** → Creates notifications for other participants
2. **Message Edited** → Creates edit notifications (optional)
3. **Message Deleted** → Creates deletion notifications (optional)
4. **Message Read** → Marks conversation notifications as read

### EventsManager Integration

Uses the EventsManager for decoupled architecture:

```typescript
EventsManager.emit('notification:created', notification);
```

### Firebase Cloud Messaging

Ready for FCM integration (commented out in current implementation):

```typescript
// TODO: Get user's FCM token from user model
// if (userFcmToken) {
//   await this.sendFCMNotification(userFcmToken, {
//     title: type,
//     body: content,
//     data: metadata,
//   });
// }
```

## Usage Examples

### Frontend Integration

```javascript
// Connect to socket and join notification room
const socket = io('http://localhost:3000', {
  auth: { token: userToken }
});

socket.emit('join-notifications', userId);

// Listen for notifications
socket.on('notification', (notification) => {
  showNotification(notification);
});

// Listen for unread count updates
socket.on('unreadCountUpdate', (data) => {
  updateUnreadBadge(data.count);
});
```

### API Usage

```javascript
// Get unread counts
const response = await fetch('/api/v1/messages/unread', {
  headers: { Authorization: `Bearer ${token}` }
});

// Mark notification as read
await fetch(`/api/v1/notifications/${notificationId}/read`, {
  method: 'PATCH',
  headers: { Authorization: `Bearer ${token}` }
});
```

## Testing

The notification system includes comprehensive testing:

1. **Unit Tests** - Service methods and utilities
2. **Integration Tests** - API endpoints and socket events
3. **E2E Tests** - Complete notification flow

## Future Enhancements

1. **Push Notifications** - Complete FCM integration
2. **Notification Templates** - Rich notification content
3. **Notification Categories** - Different notification types
4. **Notification Scheduling** - Delayed notifications
5. **Notification Analytics** - Track notification engagement

## Troubleshooting

### Common Issues

1. **Notifications not appearing**
   - Check user notification preferences
   - Verify socket connection
   - Check conversation mute status

2. **Unread counts not updating**
   - Verify socket events are being emitted
   - Check database indexes
   - Verify user authentication

3. **Performance issues**
   - Monitor database query performance
   - Check socket connection limits
   - Verify batch operation efficiency

## Security Considerations

1. **Authentication** - All endpoints require valid JWT tokens
2. **Authorization** - Users can only access their own notifications
3. **Input Validation** - All inputs are validated and sanitized
4. **Rate Limiting** - Consider implementing rate limiting for notification creation 

## FCM Push Notifications

The system is configured to send push notifications via Firebase Cloud Messaging (FCM). The following section details the events that trigger push notifications and the data payload sent with each notification. This information is crucial for the client-side (Flutter) application to handle incoming notifications correctly.

### FCM Payload Structure

All FCM notifications share a common payload structure. The `data` object contains the specific details of the notification.

```json
{
  "notification": {
    "title": "Notification Title",
    "body": "Notification body content."
  },
  "data": {
    "notificationId": "<mongoose_object_id>",
    "type": "<notification_type>",
    // ... other type-specific data
  }
}
```

### Notification Events and Data Schemas

Here are the different notification types and their corresponding data schemas:

#### 1. New Message
- **Type**: `new_message`
- **Trigger**: A new message is received in a conversation.
- **Description**: Notifies the user of a new message.
- **Data Schema**:
  ```json
  {
    "messageId": "<mongoose_object_id>",
    "conversationId": "<mongoose_object_id>",
    "senderId": "<mongoose_object_id>",
    "senderName": "John Doe",
    "conversationName": "Group Chat Name or Sender Name",
    "conversationType": "private" | "group",
    "action": "created",
    "timestamp": "<iso_date_string>"
  }
  ```

#### 2. New Follower
- **Type**: `new_follower`
- **Trigger**: A user gets a new follower.
- **Description**: Notifies the user that someone has started following them.
- **Data Schema**:
  ```json
  {
    "followerId": "<mongoose_object_id>",
    "followerName": "Jane Doe"
  }
  ```

#### 3. New Discussion
- **Type**: `new_discussion`
- **Trigger**: A new discussion is created in a community the user is a member of.
- **Description**: Notifies the user about a new discussion in their community.
- **Data Schema**:
  ```json
  {
    "discussionId": "<mongoose_object_id>",
    "communityId": "<mongoose_object_id>",
    "creatorName": "John Doe"
  }
  ```

#### 4. New Resource
- **Type**: `new_resource`
- **Trigger**: A new resource is uploaded.
- **Description**: Notifies subscribed users about a new resource.
- **Data Schema**:
  ```json
  {
    "resourceId": "<mongoose_object_id>",
    "uploaderName": "Jane Doe"
  }
  ```

#### 5. Discussion Reply
- **Type**: `discussion_reply`
- **Trigger**: A new reply is posted on a discussion the user is subscribed to or has participated in.
- **Description**: Notifies the user of a new reply to a discussion.
- **Data Schema**:
  ```json
  {
    "discussionId": "<mongoose_object_id>",
    "replyId": "<mongoose_object_id>",
    "replierName": "John Doe"
  }
  ```

#### 6. Resource Voted
- **Type**: `resource_voted`
- **Trigger**: A user's resource receives a vote.
- **Description**: Notifies the user that their resource has been upvoted or downvoted.
- **Data Schema**:
  ```json
  {
    "resourceId": "<mongoose_object_id>",
    "voterName": "Jane Doe",
    "voteType": "upvote" | "downvote"
  }
  ```

#### 7. Resource Reported
- **Type**: `resource_reported`
- **Trigger**: A user's resource is reported.
- **Description**: Notifies the user that their resource has been reported.
- **Data Schema**:
  ```json
  {
    "resourceId": "<mongoose_object_id>",
    "reporterName": "John Doe"
  }
  ```

#### 8. New Comment on Resource
- **Type**: `resource_comment`
- **Trigger**: A new comment is added to a resource.
- **Description**: Notifies the user of a new comment on their resource.
- **Data Schema**:
  ```json
  {
    "resourceId": "<mongoose_object_id>",
    "commentId": "<mongoose_object_id>",
    "commenterName": "Jane Doe"
  }
  ```

#### 9. Welcome Notification
- **Type**: `welcome`
- **Trigger**: A new user registers.
- **Description**: A welcome notification for new users.
- **Data Schema**:
  ```json
  {
    "message": "Welcome to the Student Portal!"
  }
  ```

#### 10. New Event
- **Type**: `new_event`
- **Trigger**: A new event is created.
- **Description**: Notifies all users about a new event.
- **Data Schema**:
  ```json
  {
    "eventId": "<mongoose_object_id>"
  }
  ```

#### 11. New Event (Admin)
- **Type**: `new_event_admin`
- **Trigger**: A new event is created.
- **Description**: Notifies superadmins about a new event for the dashboard.
- **Data Schema**:
  ```json
  {
    "eventId": "<mongoose_object_id>",
    "creatorId": "<mongoose_object_id>",
    "creatorName": "John Doe"
  }
  ```
