# Student Portal Database Design Schema

## Overview

This document outlines the database schema for a comprehensive student portal platform. The design uses MongoDB as the database system, leveraging its document-oriented structure for flexible schema design.

## Database Models

### User Collection

```javascript
User {
  _id: ObjectId,
  name: String (Required, 255 characters),
  username: String (Optional, Unique with case-insensitive collation, Min: 3, Max: 30 characters, Trimmed),
  gender: String (Optional, Enum["male", "female"]),
  phoneNumber: String (Optional, Pattern: /^\+\d{1,4}[\s-]?(\d[\s-]?){6,14}\d$/),
  dateOfBirth: Date (Optional),
  university: String (Required if signupStep is "completed"),
  college: String (Required if signupStep is "completed"),
  email: String (Required, Unique, 320 characters),
  password: String (Required, Min: 8, Pattern: one uppercase, lowercase, number, special char, Encrypted, Select: false),
  signupStep: String (Required, Enum["initial", "verified", "completed"], Default: "initial"),
  role: String (Required if signupStep is "completed", Enum["student", "faculty", "admin"]),
  profilePicture: String (Default: "https://via.placeholder.com/150"),
  profile: {
    bio: String,
    interests: [String]
  } (Optional),
  addresses: [{
    street: String,
    city: String,
    country: String
  }] (Optional, items have no _id),
  friends: [{
    userId: ObjectId (References User._id),
    messageId: ObjectId (References Message._id)
  }] (Optional, items have no _id),
  level: Number (Min: 1, Max: 5),
  gpa: Number (Optional),
  universityEmail: String (Optional, 320 characters, Unique with sparse index),
  universityEmailVerified: Boolean (Default: false),
  tempEmail: String (Optional, Select: false),
  tempUniversityEmail: String (Optional, Select: false),
  mfa_settings: {
    enabled: Boolean (Default: false),
    methods: [String]
  } (Optional),
  dashboards: {
    academic_progress: Number,
    event_stats: {
      attended: Number
    }
  } (Optional),
  emailVerified: Boolean (Default: false),
  otp: {
    code: String,
    expiresAt: Date
  } (Optional),
  roles: [{
    communityId: ObjectId (References Community._id),
    role: String
  }] (Optional, items have no _id),
  status: String (Required, Enum["online", "offline", "idle", "dnd"], Default: "offline"),
  isGraduated: Boolean (Default: false),
  graduationYear: Number (Optional, Min: 1900, Max: current year),
  createdAt: Date (Auto-generated),
  updatedAt: Date (Auto-updated)
}
```

### Community Collection

```javascript
Community {
  _id: ObjectId,
  owner: ObjectId (References User._id, Required),
  name: String (Required, Unique, 255 characters),
  handle: String (Required, Unique, 100 characters), 
  description: String (Optional, 1000 characters),
  type: String (Required, Enum["Official", "Community"], Default: "Community"),
  icon: String (Optional, 2000 characters),
  banner: String (Optional, 2000 characters),
  members: [{
    userId: ObjectId (References User._id), // The name will populated dynamically from User collection
    roleIds: [ObjectId] (References Role._id),
    joinedAt: Date (Auto-generated)
  }] (Optional, items have no _id),
  roles: [ObjectId] (References Role._id, Optional),
  discussions: [ObjectId] (References Discussion._id, Optional),
  resources: [ObjectId] (References Resource._id, Optional), 
  inviteLink: String (Optional, Unique per community, 500 characters),
  membersCount: Number (Default: 0), 
  postsCount: Number (Default: 0), 
  createdAt: Date (Auto-generated),
  updatedAt: Date (Auto-updated)
}
```

### Role Collection

```javascript
Role {
  _id: ObjectId,
  communityId: ObjectId (References Community._id, Required),
  name: String (Required, Unique within community, 100 characters),
  color: Number (Optional, RGB integer, 4 bytes),
  permissions: Number (Required, Bitwise integer, 4 bytes),
  mentionable: Boolean (Default: false),
  createdAt: Date (Auto-generated)
}
```

### Discussion Collection

```javascript
Discussion {
  _id: ObjectId,
  communityId: ObjectId (References Community._id, Required),
  title: String (Required, 255 characters),
  content: String (Required),
  creator: ObjectId (References User._id, Required),
  attachments: [{
    type: String (Enum["document", "file", "poll", etc.]),
    resource: String (URL),
    fileSize: Number (Optional, in bytes)
  }] (Optional, items have no _id),
  replies: [{
    id: ObjectId,
    content: String (Required),
    creator: ObjectId (References User._id),
    createdAt: Date (Auto-generated),
    attachments: [{
      type: String,
      resource: String,
      fileSize: Number (Optional, in bytes)
    }] (Optional),
    votes: [{
      userId: ObjectId (References User._id),
      voteType: String (Enum["upvote", "downvote"]),
      createdAt: Date (Auto-generated)
    }] (Optional, items have no _id),
    votesCount: Number (Default: 0) 
  }] (Optional, items have no _id),
  votes: [{
    userId: ObjectId (References User._id),
    voteType: String (Enum["upvote", "downvote"]),
    createdAt: Date (Auto-generated)
  }] (Optional, items have no _id),
  status: String (Enum["open", "closed", "archived"], Default: "open"),
  tags: [String] (Optional), 
  pinned: Boolean (Default: false), 
  votesCount: Number (Default: 0),
  repliesCount: Number (Default: 0),
  createdAt: Date (Auto-generated),
  updatedAt: Date (Auto-updated)
}
```

### Conversation Collection

```javascript
Conversation {
  _id: ObjectId,
  type: String (Required, Enum["DM", "GroupDM"]),
  participants: [ObjectId] (References User._id, Required, Min: 2 for GroupDM),
  name: String (Optional, Only for GroupDM, 255 characters),
  createdBy: ObjectId (References User._id, Required),
  messages: [ObjectId] (References Message._id, Optional),
  inviteLink: String (Optional, Only for GroupDM, 500 characters),
  status: String (Enum["active", "archived"], Default: "active"),
  createdAt: Date (Auto-generated),
  updatedAt: Date (Auto-updated)
}
```

### Message Collection

```javascript
Message {
  _id: ObjectId,
  senderId: ObjectId (References User._id, Required),
  content: String (Optional),
  attachments: [{
    type: String (Enum["document", "file", "poll", "thread"]),
    resource: String (URL, Required for file-based),
    thread: ObjectId (References Conversation._id, Optional)
  }] (Optional, items have no _id),
  status: String (Enum["sent", "delivered", "read"], Default: "sent"),
  createdAt: Date (Auto-generated)
}
```

### Resource Collection

```javascript
Resource {
  _id: ObjectId,
  title: String (Required, 255 characters),
  description: String (Optional, 1000 characters),
  fileUrl: String (Required, 2000 characters),
  fileSize: Number (Required, in bytes), // We will format it in backend
  tags: [String] (Optional),
  visibility: String (Enum["public", "private", "community"], Default: "public"),
  communityId: ObjectId (References Community._id, Optional, Required if visibility="community"),
  category: String (Optional, 50 characters),
  interactions: {
    downloads: Number (Non-negative),
    ratings: [{
      userId: ObjectId (References User._id),
      rating: Number,
      createdAt: Date
    }],
    comments: [{
      id: ObjectId,
      userId: ObjectId (References User._id),
      content: String,
      createdAt: Date,
      attachments: [String]
    }]
  } (Optional),
  uploaderId: ObjectId (References User._id, Required),
  createdAt: Date (Auto-generated),
  updatedAt: Date (Auto-updated)
}
```

### Event Collection

```javascript
Event {
  _id: ObjectId,
  title: String (Required, 255 characters),
  description: String (Optional, 1000 characters),
  dateTime: Date (Required),
  location: String (Optional, 255 characters),
  capacity: Number (Optional, 32-bit integer),
  visibility: String (Enum["public", "private", "community"], Default: "public"),
  attendees: [ObjectId] (References RSVP._id, Optional),
  creatorId: ObjectId (References User._id, Required),
  status: String (Enum["upcoming", "ongoing", "completed", "cancelled"], Default: "upcoming"),
  recommendations: [ObjectId] (References Event._id, Optional),
  communityId: ObjectId (References Community._id, Optional),
  createdAt: Date (Auto-generated),
  updatedAt: Date (Auto-updated)
}
```

### RSVP Collection

```javascript
RSVP {
  _id: ObjectId,
  eventId: ObjectId (References Event._id, Required),
  userId: ObjectId (References User._id, Required),
  status: String (Required, Enum["attending", "not_attending", "interested"], Default: "interested"),
  createdAt: Date (Auto-generated),
  updatedAt: Date (Auto-updated)
}
```

### Notification Collection

```javascript
Notification {
  _id: ObjectId,
  user_id: ObjectId (References User._id, Required),
  type: String (Required, 50 characters),
  content: String (Required, 500 characters),
  status: String (Required, Enum["read", "unread"], Default: "unread"),
  timestamp: Date (Auto-generated),
  metadata: {
    event_id: ObjectId,
    // Other relevant metadata fields
  } (Optional)
}
```