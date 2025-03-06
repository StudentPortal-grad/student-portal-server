# Student Portal API Design

## Base URL

```
https://api.studentportal.com/v1
```

## Authentication

All API endpoints except for authentication operations require a valid JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

## API Endpoints

### 1. User Management

#### 1.1 Authentication

##### POST /auth/signup
Creates a new user account.

**Request Body:**
```json
{
  "email": "student@university.edu",
  "password": "SecurePassword123!",
  "name": "Student Name",
  "role": "Student"
}
```

**Response (201 Created):**
```json
{
  "message": "Account created successfully. Please check your email for verification.",
  "userId": "60a3f2d94e6c2a1234567890"
}
```

##### GET /auth/google
Initiates Google OAuth2.0 authentication flow.

**Description**: Starts the Google sign-in process

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Google authentication successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "60a3f2d94e6c2a1234567890",
      "email": "student@university.edu",
      "name": "Student Name",
      "role": "Student",
      "picture": "https://example.com/profile.jpg",
      "createdAt": "2024-03-15T10:30:00Z"
    }
  }
}
```

**Error Response (401 Unauthorized):**
```json
{
  "success": false,
  "message": "Google authentication failed",
  "error": {
    "code": "UNAUTHORIZED",
    "details": "Invalid Google credentials"
  }
}
```

##### GET /auth/google/callback
Callback endpoint for Google OAuth2.0 authentication.

**Query Parameters:**
- `code`: Authorization code from Google
- `state`: CSRF token for security

**Description**: Handles the OAuth2.0 callback from Google

**Success Response**: Redirects to frontend with authentication token
**Error Response**: Redirects to frontend login page with error message

##### POST /auth/verify-email
Verifies a user's email address using the verification code.

**Request Body:**
```json
{
  "email": "student@university.edu",
  "code": "123456"
}
```

**Response (200 OK):**
```json
{
  "message": "Email verified successfully",
  "confirmEmail": true
}
```

##### POST /auth/login
Authenticates a user and returns a JWT token.

**Request Body:**
```json
{
  "email": "student@university.edu",
  "password": "SecurePassword123!"
}
```

**Response (200 OK):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "60a3f2d94e6c2a1234567890",
    "name": "Student Name",
    "email": "student@university.edu",
    "role": "Student"
  }
}
```

##### POST /auth/forgot-password
Initiates password recovery process.

**Request Body:**
```json
{
  "email": "student@university.edu"
}
```

**Response (200 OK):**
```json
{
  "message": "Password reset link sent to your email"
}
```

##### POST /auth/reset-password
Resets password using token sent via email.

**Request Body:**
```json
{
  "token": "reset-token-from-email",
  "newPassword": "NewSecurePassword123!"
}
```

**Response (200 OK):**
```json
{
  "message": "Password reset successful"
}
```

##### POST /auth/logout
Invalidates the current session token.

**Response (200 OK):**
```json
{
  "message": "Logged out successfully"
}
```

#### 1.2 Profile Management

##### GET /users/me
Retrieves the current user's profile.

**Response (200 OK):**
```json
{
  "_id": "60a3f2d94e6c2a1234567890",
  "name": "Student Name",
  "email": "student@university.edu",
  "role": "Student",
  "profile": {
    "bio": "Computer Science major",
    "interests": ["Machine Learning", "Web Development"]
  },
  "level": 3,
  "status": "online"
}
```

##### PUT /users/me
Updates the current user's profile.

**Request Body:**
```json
{
  "name": "Updated Name",
  "profile": {
    "bio": "Updated bio information",
    "interests": ["Data Science", "Mobile Development"]
  }
}
```

**Response (200 OK):**
```json
{
  "message": "Profile updated successfully",
  "user": {
    "_id": "60a3f2d94e6c2a1234567890",
    "name": "Updated Name",
    "profile": {
      "bio": "Updated bio information",
      "interests": ["Data Science", "Mobile Development"]
    }
  }
}
```

##### GET /users/:userId
Retrieves another user's public profile.

**Query Parameters:**
- `fields`: Optional comma-separated list of fields to include

**Response (200 OK):**
```json
{
  "_id": "60a3f2d94e6c2a1234567890",
  "name": "Student Name",
  "profile": {
    "bio": "Computer Science major",
    "interests": ["Machine Learning", "Web Development"]
  },
  "status": "online"
}
```

##### POST /users/me/addresses
Adds a new address to the user's profile.

**Request Body:**
```json
{
  "street": "123 Campus Drive",
  "city": "University City",
  "country": "USA"
}
```

**Response (201 Created):**
```json
{
  "message": "Address added successfully",
  "addresses": [
    {
      "street": "123 Campus Drive",
      "city": "University City",
      "country": "USA"
    }
  ]
}
```

### 2. Communication

#### 2.1 Messaging

##### GET /conversations
Retrieves a list of conversations for the current user.

**Query Parameters:**
- `type`: Filter by conversation type (DM, GroupDM)
- `status`: Filter by status (active, archived)
- `limit`: Number of results per page (default: 20)
- `page`: Page number (default: 1)

**Response (200 OK):**
```json
{
  "conversations": [
    {
      "_id": "60b4e2d94e6c2a1234567890",
      "type": "DM",
      "participants": [
        {
          "_id": "60a3f2d94e6c2a1234567890",
          "name": "Student Name"
        },
        {
          "_id": "60a3f2d94e6c2a1234567891",
          "name": "Another Student"
        }
      ],
      "lastMessage": {
        "content": "Hey, did you finish the assignment?",
        "senderId": "60a3f2d94e6c2a1234567891",
        "createdAt": "2023-05-20T15:30:00Z"
      },
      "updatedAt": "2023-05-20T15:30:00Z"
    }
  ],
  "pagination": {
    "total": 15,
    "page": 1,
    "limit": 20
  }
}
```

##### POST /conversations
Creates a new conversation.

**Request Body:**
```json
{
  "type": "DM",
  "participants": ["60a3f2d94e6c2a1234567891"],
  "name": "Group Study" // Only for GroupDM
}
```

**Response (201 Created):**
```json
{
  "_id": "60b4e2d94e6c2a1234567892",
  "type": "DM",
  "participants": [
    {
      "_id": "60a3f2d94e6c2a1234567890",
      "name": "Student Name"
    },
    {
      "_id": "60a3f2d94e6c2a1234567891",
      "name": "Another Student"
    }
  ],
  "createdAt": "2023-05-21T10:00:00Z"
}
```

##### GET /conversations/:conversationId
Retrieves a specific conversation with messages.

**Query Parameters:**
- `limit`: Number of messages per page (default: 50)
- `before`: Timestamp to fetch messages before (pagination)

**Response (200 OK):**
```json
{
  "_id": "60b4e2d94e6c2a1234567890",
  "type": "DM",
  "participants": [
    {
      "_id": "60a3f2d94e6c2a1234567890",
      "name": "Student Name"
    },
    {
      "_id": "60a3f2d94e6c2a1234567891",
      "name": "Another Student"
    }
  ],
  "messages": [
    {
      "_id": "60c5f3d94e6c2a1234567890",
      "senderId": "60a3f2d94e6c2a1234567891",
      "content": "Hey, did you finish the assignment?",
      "status": "read",
      "createdAt": "2023-05-20T15:30:00Z"
    }
  ],
  "pagination": {
    "hasMore": false
  }
}
```

##### POST /conversations/:conversationId/messages
Sends a message in a conversation.

**Request Body:**
```json
{
  "content": "Yes, I just finished it!",
  "attachments": [
    {
      "type": "file",
      "resource": "https://storage.example.com/files/assignment.pdf"
    }
  ]
}
```

**Response (201 Created):**
```json
{
  "_id": "60c5f3d94e6c2a1234567891",
  "senderId": "60a3f2d94e6c2a1234567890",
  "content": "Yes, I just finished it!",
  "attachments": [
    {
      "type": "file",
      "resource": "https://storage.example.com/files/assignment.pdf"
    }
  ],
  "status": "sent",
  "createdAt": "2023-05-20T15:35:00Z"
}
```

##### PATCH /conversations/:conversationId
Updates a conversation (archive, add participants for GroupDM).

**Request Body:**
```json
{
  "status": "archived",
  "participants": ["60a3f2d94e6c2a1234567892"] // Only for GroupDM to add participants
}
```

**Response (200 OK):**
```json
{
  "message": "Conversation updated",
  "conversation": {
    "_id": "60b4e2d94e6c2a1234567890",
    "status": "archived",
    "updatedAt": "2023-05-21T11:00:00Z"
  }
}
```

##### PATCH /messages/:messageId
Updates message status (read/delivered).

**Request Body:**
```json
{
  "status": "read"
}
```

**Response (200 OK):**
```json
{
  "message": "Message status updated",
  "status": "read"
}
```

#### 2.2 Groups and Communities

##### GET /communities
Retrieves a list of communities.

**Query Parameters:**
- `type`: Filter by type (Official, Community)
- `query`: Search by name or description
- `limit`: Number of results per page (default: 20)
- `page`: Page number (default: 1)

**Response (200 OK):**
```json
{
  "communities": [
    {
      "_id": "60d6e4d94e6c2a1234567890",
      "name": "Computer Science Students",
      "description": "A community for CS students",
      "type": "Community",
      "icon": "https://storage.example.com/icons/cs.png",
      "memberCount": 156,
      "createdAt": "2023-05-01T10:00:00Z",
    }
  ],
  "pagination": {
    "total": 25,
    "page": 1,
    "limit": 20
  },
  "counts": {
    "totalCommunities": 100,
    "officialCommunities": 30, 
    "userCommunities": 70 // Number of user-created communities
  }
}
```

##### POST /communities
Creates a new community and assigns admins.

**Request Body:**
```json
{
  "name": "AI Research Group",
  "description": "A community for AI researchers and enthusiasts",
  "type": "Community",
  "icon": "https://storage.example.com/icons/ai.png",
  "admins": ["60a3f2d94e6c2a1234567891"] // List of user IDs to be assigned as admins
}
```

**Response (201 Created):**
```json
{
  "_id": "60d6e4d94e6c2a1234567891",
  "name": "AI Research Group",
  "description": "A community for AI researchers and enthusiasts",
  "type": "Community",
  "icon": "https://storage.example.com/icons/ai.png",
  "owner": "60a3f2d94e6c2a1234567890",
  "inviteLink": "https://studentportal.com/join/ai-research-xyz123",
  "createdAt": "2023-05-22T10:00:00Z"
}
```

##### GET /communities/:communityId
Retrieves a specific community.

**Response (200 OK):**
```json
{
  "_id": "60d6e4d94e6c2a1234567890",
  "name": "Computer Science Students",
  "handle": "cs_students",
  "description": "A community for CS students",
  "type": "Community",
  "icon": "https://storage.example.com/icons/cs.png",
  "banner": "https://cdn.example.com/banners/flutter.jpg",
  "inviteLink": "https://example.com/invite/flutter-devs",
  "owner": {
    "userId": "60a3f2d94e6c2a1234567890",
    "name": "Community Creator",
    "username": "creator",
    "profilePicture": "https://via.placeholder.com/150",
  },
  "members": [
    {
      "userId": "60a3f2d94e6c2a1234567890",
      "name": "Student Name",
      "username": "student",
      "profilePicture": "https://via.placeholder.com/150",
      "roleIds": ["60e7f5d94e6c2a1234567890"],
      "joinedAt": "2023-05-22T11:00:00Z"
    }
  ],
  "discussionsCount": 10,
  "membersCount": 156,
  "createdAt": "2023-05-01T10:00:00Z",
}
```

##### PATCH /communities/:communityId
Allows the admin or owner to update community settings.

**Request Body:**
```json
{
  "description": "Updated description for the community",
  "icon": "https://storage.example.com/icons/cs-updated.png"
}
```

**Response (200 OK):**
```json
{
  "message": "Community updated successfully",
  "community": {
    "_id": "60d6e4d94e6c2a1234567890",
    "description": "Updated description for the community",
    "icon": "https://storage.example.com/icons/cs-updated.png",
    "updatedAt": "2023-05-22T12:00:00Z"
  }
}
```

##### DELETE /communities/{communityId}
Deletes a community. Only the owner or admin can delete the community.

**Response (200 OK):**
```json
{
  "message": "Community deleted successfully"
}
```

##### GET /communities/:communityId/resources
Retrieves a list of resources in a community.

**Query Parameters:**
- `category`: Filter by category
- `tags`: Comma-separated list of tags
- `uploader`: Filter by uploader ID
- `query`: Search in title or description
- `limit`: Number of results per page (default: 20)
- `page`: Page number (default: 1)

**Response (200 OK):**
```json
{
  "resources": [
    {
      "_id": "60g9e8d94e6c2a1234567890",
      "title": "Data Structures Cheat Sheet",
      "description": "A comprehensive cheat sheet for common data structures",
      "fileUrl": "https://storage.example.com/resources/data-structures-cheat-sheet.pdf",
      "fileSize": 204800,  // Stored in bytes (200 KB)
      "tags": ["data structures", "algorithms", "cheat sheet"],
      "visibility": "community",
      "category": "Computer Science",
      "uploader": {
        "_id": "60a3f2d94e6c2a1234567890",
        "name": "Student Name",
        "username": "student",
        "profilePicture": "https://via.placeholder.com/150"
      },
      "interactionStats": {
        "downloads": 156,
        "rating": 4.7
      },
      "createdAt": "2023-05-10T10:00:00Z"
    }
  ],
  "pagination": {
    "total": 45,
    "page": 1,
    "limit": 20
  }
}
```

##### GET /communities/{communityId}/members 
List Community Members

**Response (200 OK):**
```json
{
  "members": [
    {
      "userId": "60a3f2d94e6c2a1234567890",
      "name": "Student Name",
      "username": "student",
      "profilePicture": "https://via.placeholder.com/150",
      "roleIds": ["60e7f5d94e6c2a1234567890"],
      "joinedAt": "2023-05-22T11:00:00Z"
    }
  ]
}
```

##### POST /communities/:communityId/members
Adds a user to a community.

**Request Body:**
```json
{
  "userId": "60a3f2d94e6c2a1234567893",
  "roleIds": ["60e7f5d94e6c2a1234567890"]
}
```

**Response (201 Created):**
```json
{
  "message": "Member added successfully",
  "member": {
    "userId": "60a3f2d94e6c2a1234567893",
    "roleIds": ["60e7f5d94e6c2a1234567890"],
    "joinedAt": "2023-05-22T13:00:00Z"
  }
}
```

##### DELETE /communities/:communityId/members/:userId
Removes a user from a community.

**Response (200 OK):**
```json
{
  "message": "Member removed successfully"
}
```

##### POST /communities/:communityId/join
Joins a community using an invite link or by direct request.

**Request Body:**
```json
{
  "inviteCode": "xyz123" // Optional
}
```

**Response (200 OK):**
```json
{
  "message": "Joined community successfully",
  "community": {
    "_id": "60d6e4d94e6c2a1234567890",
    "name": "Computer Science Students"
  }
}
```

##### POST /communities/:communityId/invite
Generates or regenerates an invite link for a community.

**Response (200 OK):**
```json
{
  "inviteLink": "https://studentportal.com/join/community-xyz123"
}
```

##### GET /communities/:communityId/roles
Retrieves roles for a community.

**Response (200 OK):**
```json
{
  "roles": [
    {
      "_id": "60e7f5d94e6c2a1234567890",
      "name": "Moderator",
      "color": 16711680, // RGB for red
      "permissions": 15, // Bitwise integer representing permissions
      "mentionable": true,
      "createdAt": "2023-05-01T11:00:00Z"
    }
  ]
}
```

##### POST /communities/:communityId/roles
Creates a new role for a community.

**Request Body:**
```json
{
  "name": "Teaching Assistant",
  "color": 65280, // RGB for green
  "permissions": 7, // Bitwise integer representing permissions
  "mentionable": true
}
```

**Response (201 Created):**
```json
{
  "_id": "60e7f5d94e6c2a1234567891",
  "name": "Teaching Assistant",
  "color": 65280,
  "permissions": 7,
  "mentionable": true,
  "createdAt": "2023-05-22T14:00:00Z"
}
```

##### PATCH /communities/{communityId}/roles/{roleId}
Update a Role 

**Request Body:**
```json
{
  "name": "Senior Teaching Assistant",
  "color": 255, // RGB for blue
  "permissions": 15, // Bitwise integer representing permissions
  "mentionable": false
}
```

**Response (200 OK):**
```json
{
  "message": "Role updated successfully",
  "role": {
    "_id": "60e7f5d94e6c2a1234567891",
    "name": "Senior Teaching Assistant",
    "color": 255,
    "permissions": 15,
    "mentionable": false,
    "updatedAt": "2023-05-22T14:30:00Z"
  }
}
```

##### DELETE /communities/{communityId}/roles/{roleId}
Delete a Role

**Response (200 OK):**
```json
{
  "message": "Role deleted successfully"
}
```

##### POST /communities/{communityId}/members/{userId}/roles
Assigns a role to a community member.

**Request Body:**
```json
{
  "roleId": "60e7f5d94e6c2a1234567891"
}
```

**Response (200 OK):**
```json
{
  "message": "Role assigned successfully",
  "member": {
    "userId": "60a3f2d94e6c2a1234567890",
    "roleIds": ["60e7f5d94e6c2a1234567891"],
    "joinedAt": "2023-05-22T11:00:00Z"
  }
}
```

##### DELETE /communities/{communityId}/members/{userId}/roles/{roleId}
Removes a role from a community member.

**Response (200 OK):**
```json
{
  "message": "Role removed successfully"
}
```

##### GET /communities/:communityId/discussions
Retrieves discussions for a community.

**Query Parameters:**
- `status`: Filter by status (open, closed, archived)
- `creator`: Filter by creator ID
- `query`: Search in title or content
- `limit`: Number of results per page (default: 20)
- `page`: Page number (default: 1)

**Response (200 OK):**
```json
{
  "discussions": [
    {
      "_id": "60f8e6d94e6c2a1234567890",
      "title": "Midterm Study Guide",
      "content": "Let's create a study guide for the upcoming midterm...",
      "tags": ["study", "midterm"],
      "creator": {
        "_id": "60a3f2d94e6c2a1234567890",
        "name": "Student Name",
        "username": "student",
        "profilePicture": "https://via.placeholder.com/150"
      },
      "attachments": [
        {
          "type": "document",
          "resource": "https://storage.example.com/docs/study-guide.pdf",
          "fileSize": 204800 // 200 KB
        }
      ],
      "votes": 124, // upvotes - downvotes
      "repliesCount": 5,
      "status": "open",
      "pinned": true,
      "createdAt": "2023-05-15T10:00:00Z",
      "updatedAt": "2023-05-21T14:00:00Z"
    }
  ],
  "pagination": {
    "total": 12,
    "page": 1,
    "limit": 20
  }
}
```

##### POST /communities/:communityId/discussions
Creates a new discussion in a community and returns a shareable link.

**Request Body:**
```json
{
  "title": "Final Project Ideas",
  "content": "I'm looking for ideas for the final project...",
  "tags": ["study", "midterm"],
  "attachments": [
    {
      "type": "document",
      "resource": "https://storage.example.com/docs/project-guidelines.pdf",
      "fileSize": 204800 // 200 KB
    }
  ]
}
```

**Response (201 Created):**
```json
{
  "_id": "60f8e6d94e6c2a1234567891",
  "title": "Final Project Ideas",
  "content": "I'm looking for ideas for the final project...",
  "tags": ["study", "midterm"],
  "creator": {
    "_id": "60a3f2d94e6c2a1234567890",
    "name": "Student Name",
    "username": "student",
    "profilePicture": "https://via.placeholder.com/150"
  },
  "attachments": [
    {
      "type": "document",
      "resource": "https://storage.example.com/docs/project-guidelines.pdf",
      "fileSize": 204800 // 200 KB
    }
  ],
  "status": "open",
  "pinned": false,
  "createdAt": "2023-05-22T15:00:00Z",
  "shareLink": "https://studentportal.com/communities/60d6e4d94e6c2a1234567890/discussions/60f8e6d94e6c2a1234567891"
}
```

##### GET /discussions/:discussionId
Retrieves a specific discussion with its replies.

**Query Parameters:**
- `limit`: Number of replies per page (default: 20)
- `page`: Page number for replies (default: 1)

**Response (200 OK):**
```json
{
  "_id": "60f8e6d94e6c2a1234567890",
  "communityId": "60d6e4d94e6c2a1234567890",
  "title": "Midterm Study Guide",
  "content": "Let's create a study guide for the upcoming midterm...",
  "tags": ["study", "midterm"],
  "creator": {
    "_id": "60a3f2d94e6c2a1234567890",
    "name": "Student Name",
    "username": "student",
    "profilePicture": "https://via.placeholder.com/150"
  },
  "attachments": [
    {
      "type": "document",
      "resource": "https://storage.example.com/docs/study-guide.pdf",
      "fileSize": 204800 // 200 KB
    }
  ],
  "replies": [
    {
      "id": "60f9e7d94e6c2a1234567890",
      "content": "Great idea! I'll contribute the section on algorithms.",
      "creator": {
        "_id": "60a3f2d94e6c2a1234567891",
        "name": "Another Student",
        "username": "another_student",
        "profilePicture": "https://via.placeholder.com/150"
      },
      "attachments": [
        {
          "type": "document",
          "resource": "https://storage.example.com/docs/algorithms.pdf",
          "fileSize": 102400 // 100 KB
        }
      ],
      "votes": 3, // upvotes - downvotes
      "createdAt": "2023-05-15T11:00:00Z"
    }
  ],
  "votes": 124, // upvotes - downvotes
  "repliesCount": 5,
  "status": "open",
  "pinned": true,
  "createdAt": "2023-05-15T10:00:00Z",
  "updatedAt": "2023-05-21T14:00:00Z",
  "pagination": {
    "total": 15,
    "page": 1,
    "limit": 20
  }
}
```

##### GET /discussions/:discussionId/replies
Retrieves the list of replies for a discussion.

**Query Parameters:**
- `limit`: Number of results per page (default: 20)
- `page`: Page number (default: 1)

**Response (200 OK):**
```json
{
  "replies": [
    {
      "id": "60f9e7d94e6c2a1234567890",
      "content": "Great idea! I'll contribute the section on algorithms.",
      "creator": {
        "_id": "60a3f2d94e6c2a1234567891",
        "name": "Another Student",
        "username": "another_student",
        "profilePicture": "https://via.placeholder.com/150"
      },
      "attachments": [
        {
          "type": "document",
          "resource": "https://storage.example.com/docs/algorithms.pdf",
          "fileSize": 102400 // 100 KB
        }
      ],
      "votes": 362, // upvotes - downvotes
      "createdAt": "2023-05-15T11:00:00Z"
    }
  ],
  "pagination": {
    "total": 5,
    "page": 1,
    "limit": 20
  }
}
```

##### GET /discussions/:discussionId/votes
Retrieves the list of users who voted on a discussion.

**Query Parameters:**
- `voteType`: Filter by vote type (upvote, downvote)
- `limit`: Number of results per page (default: 20)
- `page`: Page number (default: 1)

**Response (200 OK):**
```json
{
  "votes": [
    {
      "userId": "60a3f2d94e6c2a1234567891",
      "name": "Another Student",
      "username": "another_student",
      "profilePicture": "https://via.placeholder.com/150",
      "voteType": "upvote",
      "createdAt": "2023-05-15T11:00:00Z"
    }
  ],
  "pagination": {
    "total": 10,
    "page": 1,
    "limit": 20
  }
}
```

##### GET /replies/:replyId/votes
Retrieves the list of users who voted on a reply.

**Query Parameters:**
- `voteType`: Filter by vote type (upvote, downvote)
- `limit`: Number of results per page (default: 20)
- `page`: Page number (default: 1)
- 
**Response (200 OK):**
```json
{
  "votes": [
    {
      "userId": "60a3f2d94e6c2a1234567891",
      "name": "Another Student",
      "username": "another_student",
      "profilePicture": "https://via.placeholder.com/150",
      "voteType": "upvote",
      "createdAt": "2023-05-15T11:00:00Z"
    }
  ],
  "pagination": {
    "total": 3,
    "page": 1,
    "limit": 20
  }
}
```

##### PATCH /discussions/:discussionId
Allows the owner or admin to update the discussion status, pin it, or edit its content.

**Request Body:**
```json
{
  "status": "closed",
  "pinned": true
}
```

**Response (200 OK):**
```json
{
  "message": "Discussion updated",
  "discussion": {
    "_id": "60f8e6d94e6c2a1234567890",
    "status": "closed",
    "pinned": true,
    "updatedAt": "2023-05-22T17:00:00Z"
  }
}
```

##### DELETE /discussions/:discussionId
Deletes a discussion. Only the owner or admin can delete the discussion.

**Response (200 OK):**
```json
{
  "message": "Discussion deleted successfully"
}
```

##### POST /discussions/:discussionId/replies
Adds a reply to a discussion.

**Request Body:**
```json
{
  "content": "I think we should focus on data structures first.",
  "attachments": [
    {
      "type": "document",
      "resource": "https://storage.example.com/docs/data-structures.pdf"
    }
  ]
}
```

**Response (201 Created):**
```json
{
  "id": "60f9e7d94e6c2a1234567891",
  "content": "I think we should focus on data structures first.",
  "creator": "60a3f2d94e6c2a1234567890",
  "attachments": [
    {
      "type": "document",
      "resource": "https://storage.example.com/docs/data-structures.pdf"
    }
  ],
  "createdAt": "2023-05-22T16:00:00Z"
}
```

##### POST /discussions/:discussionId/votes
Adds a vote to a discussion.

**Request Body:**
```json
{
  "voteType": "upvote"
}
```

**Response (201 Created):**
```json
{
  "message": "Vote added",
  "vote": {
    "userId": "60a3f2d94e6c2a1234567890",
    "voteType": "upvote",
    "createdAt": "2023-05-22T18:00:00Z"
  }
}
```

### 3. Resource Management

#### 3.1 Academic Resources

##### GET /resources
Retrieves a list of academic resources.

**Query Parameters:**
- `visibility`: Filter by visibility (public, private, community)
- `communityId`: Filter by community
- `category`: Filter by category
- `tags`: Comma-separated list of tags
- `uploader`: Filter by uploader ID
- `query`: Search in title or description
- `limit`: Number of results per page (default: 20)
- `page`: Page number (default: 1)

**Response (200 OK):**
```json
{
  "resources": [
    {
      "_id": "60g9e8d94e6c2a1234567890",
      "title": "Data Structures Cheat Sheet",
      "description": "A comprehensive cheat sheet for common data structures",
      "fileUrl": "https://storage.example.com/resources/data-structures-cheat-sheet.pdf",
      "tags": ["data structures", "algorithms", "cheat sheet"],
      "visibility": "public",
      "category": "Computer Science",
      "uploader": {
        "_id": "60a3f2d94e6c2a1234567890",
        "name": "Student Name"
      },
      "interactionStats": {
        "downloads": 156,
        "rating": 4.7
      },
      "createdAt": "2023-05-10T10:00:00Z"
    }
  ],
  "pagination": {
    "total": 45,
    "page": 1,
    "limit": 20
  }
}
```

##### POST /resources
Uploads a new academic resource.

**Request Body:**
```json
{
  "title": "Machine Learning Notes",
  "description": "Comprehensive notes for the machine learning course",
  "fileUrl": "https://storage.example.com/resources/ml-notes.pdf",
  "tags": ["machine learning", "AI", "notes"],
  "visibility": "public",
  "category": "Computer Science"
}
```

**Response (201 Created):**
```json
{
  "_id": "60g9e8d94e6c2a1234567891",
  "title": "Machine Learning Notes",
  "description": "Comprehensive notes for the machine learning course",
  "fileUrl": "https://storage.example.com/resources/ml-notes.pdf",
  "tags": ["machine learning", "AI", "notes"],
  "visibility": "public",
  "category": "Computer Science",
  "uploaderId": "60a3f2d94e6c2a1234567890",
  "interactions": {
    "downloads": 0,
    "ratings": [],
    "comments": []
  },
  "createdAt": "2023-05-22T19:00:00Z"
}
```

##### GET /resources/:resourceId
Retrieves a specific academic resource.

**Response (200 OK):**
```json
{
  "_id": "60g9e8d94e6c2a1234567890",
  "title": "Data Structures Cheat Sheet",
  "description": "A comprehensive cheat sheet for common data structures",
  "fileUrl": "https://storage.example.com/resources/data-structures-cheat-sheet.pdf",
  "tags": ["data structures", "algorithms", "cheat sheet"],
  "visibility": "public",
  "category": "Computer Science",
  "uploader": {
    "_id": "60a3f2d94e6c2a1234567890",
    "name": "Student Name"
  },
  "interactions": {
    "downloads": 156,
    "ratings": [
      {
        "userId": "60a3f2d94e6c2a1234567891",
        "rating": 5,
        "createdAt": "2023-05-11T11:00:00Z"
      }
    ],
    "comments": [
      {
        "id": "60h0f9d94e6c2a1234567890",
        "userId": {
          "_id": "60a3f2d94e6c2a1234567891",
          "name": "Another Student"
        },
        "content": "This is incredibly helpful, thank you!",
        "createdAt": "2023-05-11T12:00:00Z",
        "attachments": []
      }
    ]
  },
  "createdAt": "2023-05-10T10:00:00Z",
  "updatedAt": "2023-05-11T12:00:00Z"
}
```

##### PATCH /resources/:resourceId
Updates an academic resource.

**Request Body:**
```json
{
  "title": "Updated Data Structures Cheat Sheet",
  "description": "Updated comprehensive cheat sheet for common data structures",
  "tags": ["data structures", "algorithms", "cheat sheet", "updated"]
}
```

**Response (200 OK):**
```json
{
  "message": "Resource updated successfully",
  "resource": {
    "_id": "60g9e8d94e6c2a1234567890",
    "title": "Updated Data Structures Cheat Sheet",
    "description": "Updated comprehensive cheat sheet for common data structures",
    "tags": ["data structures", "algorithms", "cheat sheet", "updated"],
    "updatedAt": "2023-05-22T20:00:00Z"
  }
}
```

##### POST /resources/:resourceId/download
Records a download and returns download URL.

**Response (200 OK):**
```json
{
  "downloadUrl": "https://storage.example.com/downloads/data-structures-cheat-sheet.pdf?token=xyz123",
  "message": "Download recorded"
}
```

##### POST /resources/:resourceId/ratings
Rates an academic resource.

**Request Body:**
```json
{
  "rating": 5
}
```

**Response (201 Created):**
```json
{
  "message": "Rating added successfully",
  "rating": {
    "userId": "60a3f2d94e6c2a1234567890",
    "rating": 5,
    "createdAt": "2023-05-22T21:00:00Z"
  },
  "newAverageRating": 4.8
}
```

##### POST /resources/:resourceId/comments
Adds a comment to an academic resource.

**Request Body:**
```json
{
  "content": "This resource was very helpful for my exam preparation!",
  "attachments": []
}
```

**Response (201 Created):**
```json
{
  "id": "60h0f9d94e6c2a1234567891",
  "userId": "60a3f2d94e6c2a1234567890",
  "content": "This resource was very helpful for my exam preparation!",
  "createdAt": "2023-05-22T22:00:00Z",
  "attachments": []
}
```

# Event Management API Design

This API design covers the Event Management module, focusing on the use cases described in the requirements document (UC-401 through UC-403).

## Base URL

```
/api/v1
```

## Authentication

All endpoints require authentication unless specified otherwise. Authentication is handled via JWT tokens passed in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

## Data Models

### Event

```json
{
  "_id": "string",
  "title": "string",
  "description": "string",
  "dateTime": "date",
  "location": "string",
  "capacity": "number",
  "visibility": "string (enum: public, private, community)",
  "attendees": ["ObjectId references to RSVP"],
  "creatorId": "ObjectId reference to User",
  "status": "string (enum: upcoming, ongoing, completed, cancelled)",
  "recommendations": ["ObjectId references to Event"],
  "communityId": "ObjectId reference to Community (optional)",
  "createdAt": "date",
  "updatedAt": "date"
}
```

### RSVP

```json
{
  "_id": "string",
  "eventId": "ObjectId reference to Event",
  "userId": "ObjectId reference to User",
  "status": "string (enum: attending, not_attending, interested)",
  "createdAt": "date",
  "updatedAt": "date"
}
```

## Endpoints

### Event Operations

#### Create an Event (UC-401)

```
POST /events
```

**Request Body:**

```json
{
  "title": "string (required, max: 255 chars)",
  "description": "string (optional, max: 1000 chars)",
  "dateTime": "ISO 8601 date string (required)",
  "location": "string (optional, max: 255 chars)",
  "capacity": "number (optional, 32-bit integer)",
  "visibility": "string (enum: public, private, community, default: public)",
  "communityId": "string (required if visibility is 'community')"
}
```

**Response (201 Created):**

```json
{
  "success": true,
  "data": {
    "_id": "string",
    "title": "string",
    "description": "string",
    "dateTime": "date",
    "location": "string",
    "capacity": "number",
    "visibility": "string",
    "status": "upcoming",
    "creatorId": "string",
    "communityId": "string (if applicable)",
    "createdAt": "date",
    "updatedAt": "date"
  }
}
```

**Error Responses:**

- 400 Bad Request: Invalid input data
- 401 Unauthorized: Not authenticated
- 403 Forbidden: Not authorized to create events (if not faculty/admin)
- 404 Not Found: Community not found (if communityId is provided)
- 422 Unprocessable Entity: Valid input but semantically incorrect (e.g., date in past)

#### Get Event by ID

```
GET /events/{eventId}
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "_id": "string",
    "title": "string",
    "description": "string",
    "dateTime": "date",
    "location": "string",
    "capacity": "number",
    "visibility": "string",
    "attendees": [
      {
        "userId": "string",
        "status": "string",
        "name": "string"
      }
    ],
    "status": "string",
    "creatorId": {
      "_id": "string",
      "name": "string"
    },
    "recommendations": ["Event objects"],
    "communityId": "string (if applicable)",
    "createdAt": "date",
    "updatedAt": "date",
    "attendeeCount": "number",
    "isUserAttending": "boolean"
  }
}
```

**Error Responses:**

- 401 Unauthorized: Not authenticated
- 403 Forbidden: Not authorized to view this event
- 404 Not Found: Event not found

#### List Events

```
GET /events
```

**Query Parameters:**

- `status`: Filter by event status (enum: upcoming, ongoing, completed, cancelled)
- `visibility`: Filter by visibility (enum: public, private, community)
- `communityId`: Filter by community
- `creatorId`: Filter by creator
- `startDate`: Filter events after this date
- `endDate`: Filter events before this date
- `q`: Search term for event title/description
- `page`: Page number for pagination (default: 1)
- `limit`: Number of events per page (default: 10)
- `sort`: Sort field (default: dateTime)
- `order`: Sort order (enum: asc, desc, default: asc)

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "events": [
      {
        "_id": "string",
        "title": "string",
        "description": "string",
        "dateTime": "date",
        "location": "string",
        "capacity": "number",
        "visibility": "string",
        "status": "string",
        "creatorId": {
          "_id": "string",
          "name": "string"
        },
        "attendeeCount": "number",
        "communityId": "string (if applicable)",
        "createdAt": "date",
        "updatedAt": "date"
      }
    ],
    "pagination": {
      "total": "number",
      "page": "number",
      "limit": "number",
      "pages": "number"
    }
  }
}
```

**Error Responses:**

- 400 Bad Request: Invalid query parameters
- 401 Unauthorized: Not authenticated

#### Update an Event

```
PUT /events/{eventId}
```

**Request Body:**

```json
{
  "title": "string (optional)",
  "description": "string (optional)",
  "dateTime": "ISO 8601 date string (optional)",
  "location": "string (optional)",
  "capacity": "number (optional)",
  "visibility": "string (optional)",
  "status": "string (optional)",
  "communityId": "string (optional)"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "_id": "string",
    "title": "string",
    "description": "string",
    "dateTime": "date",
    "location": "string",
    "capacity": "number",
    "visibility": "string",
    "status": "string",
    "creatorId": "string",
    "communityId": "string (if applicable)",
    "createdAt": "date",
    "updatedAt": "date"
  }
}
```

**Error Responses:**

- 400 Bad Request: Invalid input data
- 401 Unauthorized: Not authenticated
- 403 Forbidden: Not authorized to update this event
- 404 Not Found: Event not found
- 422 Unprocessable Entity: Valid input but semantically incorrect

#### Delete an Event

```
DELETE /events/{eventId}
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Event deleted successfully"
}
```

**Error Responses:**

- 401 Unauthorized: Not authenticated
- 403 Forbidden: Not authorized to delete this event
- 404 Not Found: Event not found

### RSVP Operations (UC-402)

#### Create or Update RSVP

```
POST /events/{eventId}/rsvp
```

**Request Body:**

```json
{
  "status": "string (enum: attending, not_attending, interested, required)"
}
```

**Response (201 Created or 200 OK):**

```json
{
  "success": true,
  "data": {
    "_id": "string",
    "eventId": "string",
    "userId": "string",
    "status": "string",
    "createdAt": "date",
    "updatedAt": "date"
  }
}
```

**Error Responses:**

- 400 Bad Request: Invalid status
- 401 Unauthorized: Not authenticated
- 403 Forbidden: Cannot RSVP (e.g., event capacity reached)
- 404 Not Found: Event not found
- 422 Unprocessable Entity: Valid input but conflict (e.g., event in the past)

#### Get User's RSVP Status

```
GET /events/{eventId}/rsvp
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "_id": "string",
    "eventId": "string",
    "userId": "string",
    "status": "string",
    "createdAt": "date",
    "updatedAt": "date"
  }
}
```

**Error Responses:**

- 401 Unauthorized: Not authenticated
- 404 Not Found: Event not found or no RSVP exists

#### Delete RSVP (Cancel attendance)

```
DELETE /events/{eventId}/rsvp
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "RSVP cancelled successfully"
}
```

**Error Responses:**

- 401 Unauthorized: Not authenticated
- 404 Not Found: Event not found or no RSVP exists

#### List All RSVPs for an Event

```
GET /events/{eventId}/rsvps
```

**Query Parameters:**

- `status`: Filter by RSVP status
- `page`: Page number for pagination (default: 1)
- `limit`: Number of RSVPs per page (default: 10)

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "rsvps": [
      {
        "_id": "string",
        "eventId": "string",
        "userId": {
          "_id": "string",
          "name": "string",
          "email": "string"
        },
        "status": "string",
        "createdAt": "date",
        "updatedAt": "date"
      }
    ],
    "pagination": {
      "total": "number",
      "page": "number",
      "limit": "number",
      "pages": "number"
    }
  }
}
```

**Error Responses:**

- 401 Unauthorized: Not authenticated
- 403 Forbidden: Not authorized to view RSVPs
- 404 Not Found: Event not found

### Calendar Integration (UC-403)

#### Export Event to Calendar

```
GET /events/{eventId}/calendar
```

**Query Parameters:**

- `format`: Calendar format (enum: ical, google, outlook, default: ical)

**Response (200 OK):**

For iCal format:
- Content-Type: text/calendar
- Body: iCalendar formatted event data

For Google/Outlook:
- 302 Redirect to appropriate calendar service URL with event data

**Error Responses:**

- 400 Bad Request: Invalid format
- 401 Unauthorized: Not authenticated
- 404 Not Found: Event not found

#### Batch Export Multiple Events

```
POST /calendar/export
```

**Request Body:**

```json
{
  "eventIds": ["string (required)"],
  "format": "string (enum: ical, google, outlook, default: ical)"
}
```

**Response (200 OK):**

For iCal format:
- Content-Type: text/calendar
- Body: iCalendar formatted events data

For Google/Outlook:
- 302 Redirect to appropriate calendar service URL with events data

**Error Responses:**

- 400 Bad Request: Invalid format or eventIds
- 401 Unauthorized: Not authenticated
- 404 Not Found: One or more events not found

### Event Recommendations

#### Get Event Recommendations

```
GET /events/{eventId}/recommendations
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": [
    {
      "_id": "string",
      "title": "string",
      "description": "string",
      "dateTime": "date",
      "location": "string",
      "capacity": "number",
      "visibility": "string",
      "creatorId": {
        "_id": "string",
        "name": "string"
      },
      "status": "string",
      "similarity": "number (matching score)"
    }
  ]
}
```

**Error Responses:**

- 401 Unauthorized: Not authenticated
- 404 Not Found: Event not found

## Status Codes

- 200 OK: The request has succeeded
- 201 Created: The request has been fulfilled and resulted in a new resource being created
- 400 Bad Request: The server could not understand the request due to invalid syntax
- 401 Unauthorized: Authentication required
- 403 Forbidden: The server understood the request but refuses to authorize it
- 404 Not Found: The server can't find the requested resource
- 422 Unprocessable Entity: The request was well-formed but was unable to be followed due to semantic errors
- 500 Internal Server Error: The server encountered an unexpected condition

## Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "string",
    "message": "string",
    "details": "object (optional)"
  }
}
```
