# Socket.IO Events Documentation

This documentation outlines all available Socket.IO events for the frontend chat application. For each event, you'll find the event name, required parameters, response event name, and how these events can be used in sequence.

## Table of Contents

- [Connection Events](#connection-events)
- [Message Events](#message-events)
- [Conversation Events](#conversation-events)
- [Recent Conversations Events](#recent-conversations-events)
- [Friend Events](#friend-events)
- [Search Events](#search-events)

## Connection Events

These events handle user connections and status updates.

### User Connection (Automatic)

When a user connects to the socket server, these events are triggered automatically.

**Event Flow:**

1. User connects to socket -> User's status set to "online"
2. User is joined to all their conversation rooms
3. Other users receive a status update

**Response Event:** `userStatus`

**Response Data:**

```javascript
{
  userId: string,
  status: string, // "online"
  lastSeen: Date
}
```

### User Disconnection (Automatic)

When a user disconnects from the socket server, these events are triggered automatically.

**Event Flow:**

1. User disconnects -> User's status set to "offline"
2. Other users receive a status update

**Response Event:** `userStatus`

**Response Data:**

```javascript
{
  userId: string,
  status: string, // "offline"
  lastSeen: Date
}
```

## Message Events

These events handle sending, receiving, and managing messages.

### Send Message

**Event Name:** `sendMessage`

**Required Parameters:**

```javascript
{
  conversationId: string,
  content: string
}
```

**Response Event:** `messageSent`

**Response Data:**

```javascript
{
    success: boolean;
}
```

**Broadcast Event:** `newMessage` (to all other participants in the conversation)

**Broadcast Data:**

```javascript
{
  message: {
    _id: string,
    senderId: {
      _id: string,
      name: string,
      profilePicture: string
    },
    conversationId: string,
    content: string,
    createdAt: Date,
    updatedAt: Date
  },
  conversationId: string
}
```

**Use Case:**

1. User types a message and clicks send
2. Frontend emits `sendMessage` event
3. Server processes the message and emits `messageSent` back to the sender
4. Server broadcasts `newMessage` to other conversation participants
5. Frontend updates UI accordingly based on success status

### Delete Message

**Event Name:** `deleteMessage`

**Required Parameters:**

```javascript
{
  messageId: string,
  conversationId: string
}
```

**Response Event:** `messageDeleted`

**Response Data:**

```javascript
{
    success: boolean;
}
```

**Broadcast Event:** `messageDeleted` (to all participants including sender)

**Broadcast Data:**

```javascript
{
  messageId: string,
  conversationId: string
}
```

**Use Case:**

1. User selects a message and clicks delete
2. Frontend emits `deleteMessage` event
3. Server verifies ownership and deletes the message
4. Server broadcasts `messageDeleted` to all participants
5. Frontend removes the message from the UI

### Edit Message

**Event Name:** `editMessage`

**Required Parameters:**

```javascript
{
  messageId: string,
  conversationId: string,
  content: string
}
```

**Response Event:** `messageEdited`

**Response Data:**

```javascript
{
    success: boolean;
}
```

**Broadcast Event:** `messageEdited` (to all participants including sender)

**Broadcast Data:**

```javascript
{
  messageId: string,
  conversationId: string,
  content: string
}
```

**Use Case:**

1. User selects a message and clicks edit
2. User modifies the content and saves
3. Frontend emits `editMessage` event
4. Server verifies ownership and updates the message
5. Server broadcasts `messageEdited` to all participants
6. Frontend updates the message content in the UI

### Typing Indicators

**Event Name:** `typing`

**Required Parameters:**

```javascript
{
    conversationId: string;
}
```

**Broadcast Event:** `userTyping` (to all other participants)

**Broadcast Data:**

```javascript
{
  userId: string,
  conversationId: string
}
```

**Use Case:**

1. User starts typing in the message input field
2. Frontend emits `typing` event
3. Server broadcasts `userTyping` to other conversation participants
4. Frontend shows typing indicator for the specific user

### Stop Typing

**Event Name:** `stopTyping`

**Required Parameters:**

```javascript
{
    conversationId: string;
}
```

**Broadcast Event:** `userStoppedTyping` (to all other participants)

**Broadcast Data:**

```javascript
{
  userId: string,
  conversationId: string
}
```

**Use Case:**

1. User stops typing for a few seconds or sends the message
2. Frontend emits `stopTyping` event
3. Server broadcasts `userStoppedTyping` to other conversation participants
4. Frontend removes typing indicator for the specific user

### Mark Message as Read

**Event Name:** `markMessageRead`

**Required Parameters:**

```javascript
{
  conversationId: string,
  messageId: string // ID of the latest message read
}
```

**Response Event:** `messageMarkedRead`

**Response Data:**

```javascript
{
    success: boolean;
}
```

**Broadcast Event:** `messageRead` (to all other participants)

**Broadcast Data:**

```javascript
{
  userId: string,
  conversationId: string,
  lastSeen: Date
}
```

**Use Case:**

1. User opens a conversation or scrolls to view new messages
2. Frontend emits `markMessageRead` event with the latest message ID
3. Server updates read status and unread count
4. Server broadcasts `messageRead` to other participants
5. Frontend updates read receipts and unread counts

### Get Conversation Messages

**Event Name:** `getConversationMessages`

**Required Parameters:**

```javascript
{
  conversationId: string,
  page?: number, // Default: 1
  limit?: number, // Default: 20
  sortBy?: object, // Default: { createdAt: -1 }
  before?: Date, // Optional
  after?: Date // Optional
}
```

**Response Event:** `conversationMessages`

**Response Data:**

```javascript
{
  success: boolean,
  messages: Array<Message>,
  pagination: {
    total: number,
    page: number,
    limit: number,
    totalPages: number,
    hasNextPage: boolean,
    hasPrevPage: boolean,
    nextPage: number | null,
    prevPage: number | null
  },
  error?: string
}
```

**Use Case:**

1. User opens a conversation
2. Frontend emits `getConversationMessages` event
3. Server fetches messages and sends them back
4. Frontend displays messages and pagination controls
5. User can load more messages by changing the page parameter

### Get Message Context

**Event Name:** `getMessageContext`

**Required Parameters:**

```javascript
{
  messageId: string,
  conversationId: string,
  contextSize?: number // Default: 10
}
```

**Response Event:** `messageContext`

**Response Data:**

```javascript
{
  success: boolean,
  targetMessageId: string,
  messages: Array<Message>,
  error?: string
}
```

**Use Case:**

1. User clicks on a message reference or searches for a message
2. Frontend emits `getMessageContext` event
3. Server fetches messages around the target message
4. Frontend displays the message in context with surrounding messages

## Conversation Events

These events handle creating and managing conversations.

### Create DM Conversation

**Event Name:** `createDMConversation`

**Required Parameters:**

```javascript
{
    recipientId: string;
}
```

**Response Event:** `dmCreated`

**Response Data:**

```javascript
{
  success: boolean,
  conversation?: {
    _id: string,
    type: string,
    participants: Array<{
      userId: {
        _id: string,
        name: string,
        profilePicture: string,
        status: string,
        socketId?: string
      },
      role: string,
      lastSeen?: Date
    }>,
    createdBy: {
      _id: string,
      name: string,
      profilePicture: string
    },
    createdAt: Date,
    updatedAt: Date
  }
}
```

**Broadcast Event:** `dmCreated` (to recipient if online)

**Broadcast Data:**

```javascript
{
    conversation: object; // Same structure as above
}
```

**Use Case:**

1. User selects a contact or friend and clicks to start a conversation
2. Frontend emits `createDMConversation` event
3. Server creates a new DM conversation and adds both users
4. Server sends back the new conversation details
5. Server notifies the recipient if they're online
6. Frontend opens the new conversation UI

### Create Group Conversation

**Event Name:** `createConversation`

**Required Parameters:**

```javascript
{
  type?: string, // Default: "GroupDM"
  name?: string,
  description?: string,
  participants: Array<string> // User IDs
}
```

**Response Event:** `conversationCreated`

**Response Data:**

```javascript
{
  success: boolean,
  conversation?: {
    _id: string,
    type: string,
    name: string,
    description?: string,
    participants: Array<{
      userId: {
        _id: string,
        name: string,
        profilePicture: string
      },
      role: string
    }>,
    createdBy: {
      _id: string,
      name: string,
      profilePicture: string
    },
    createdAt: Date,
    updatedAt: Date
  }
}
```

**Broadcast Event:** `conversationCreated` (to all participants)

**Broadcast Data:**

```javascript
{
    conversation: object; // Same structure as above
}
```

**Use Case:**

1. User selects multiple contacts and creates a group
2. Frontend emits `createConversation` event
3. Server creates a new group conversation with all participants
4. Server sends back the new conversation details
5. Server notifies all online participants
6. Frontend opens the new conversation UI

### Get All Conversations

**Event Name:** `getConversations`

**Required Parameters:** None

**Response Event:** `conversations`

**Response Data:**

```javascript
{
  conversations: Array<{
    _id: string,
    type: string,
    name?: string,
    description?: string,
    participants: Array<{
      userId: {
        _id: string,
        name: string,
        profilePicture: string,
        status: string
      },
      role: string,
      lastSeen?: Date
    }>,
    lastMessage?: Message,
    metadata: {
      lastActivity: Date,
      totalMessages: number
    },
    createdAt: Date,
    updatedAt: Date
  }>
}
```

**Use Case:**

1. User opens the app or navigates to conversations list
2. Frontend emits `getConversations` event
3. Server sends back all conversations the user is part of
4. Frontend displays the conversations list

### Get Friend Conversations

**Event Name:** `getFriendConversations`

**Required Parameters:** None

**Response Event:** `friendConversations`

**Response Data:**

```javascript
{
  friendConversations: Array<{
    friend: {
      _id: string,
      name: string,
      profilePicture: string,
      status: string,
      socketId?: string
    },
    conversation: {
      _id: string,
      lastMessage?: {
        content: string,
        createdAt: Date
      },
      metadata: {
        lastActivity: Date,
        totalMessages: number
      }
    },
    status: string
  }>
}
```

**Use Case:**

1. User navigates to friends tab or direct messages list
2. Frontend emits `getFriendConversations` event
3. Server sends back conversations with friends
4. Frontend displays the friends conversations list

## Recent Conversations Events

These events handle the user's list of recent conversations.

### Get Recent Conversations

**Event Name:** `getRecentConversations`

**Required Parameters:** None

**Response Event:** `recentConversations`

**Response Data:**

```javascript
{
  success: boolean,
  conversations: Array<{
    conversationId: {
      _id: string,
      type: string,
      name?: string,
      participants: Array<{
        userId: {
          _id: string,
          name: string,
          profilePicture: string,
          status: string,
          lastSeen: Date
        },
        role: string
      }>,
      lastMessage?: Message
    },
    unreadCount: number,
    lastReadMessageId?: Message,
    isPinned: boolean,
    isMuted: boolean,
    mutedUntil?: Date
  }>
}
```

**Use Case:**

1. User opens the app or navigates to chats list
2. Frontend emits `getRecentConversations` event
3. Server sends back recent conversations with metadata
4. Frontend displays the recent conversations list

### Update Recent Conversation

**Event Name:** `updateRecentConversation`

**Required Parameters:**

```javascript
{
  conversationId: string,
  isPinned?: boolean,
  isMuted?: boolean,
  mutedUntil?: Date // Required if isMuted is true
}
```

**Response Event:** `recentConversationUpdated`

**Response Data:**

```javascript
{
  success: boolean,
  conversationId?: string,
  updates?: {
    isPinned?: boolean,
    isMuted?: boolean,
    mutedUntil?: Date
  }
}
```

**Use Case:**

1. User pins, unpins, mutes, or unmutes a conversation
2. Frontend emits `updateRecentConversation` event
3. Server updates the conversation settings
4. Frontend updates the UI to reflect changes

### Remove from Recent Conversations

**Event Name:** `removeFromRecentConversations`

**Required Parameters:**

```javascript
{
    conversationId: string;
}
```

**Response Event:** `removedFromRecentConversations`

**Response Data:**

```javascript
{
  success: boolean,
  conversationId?: string
}
```

**Use Case:**

1. User selects to hide or remove a conversation from the list
2. Frontend emits `removeFromRecentConversations` event
3. Server removes the conversation from user's recent list
4. Frontend removes the conversation from the UI

## Friend Events

These events handle friend requests and friend management.

### Send Friend Request

**Event Name:** `sendFriendRequest`

**Required Parameters:**

```javascript
{
    recipientId: string;
}
```

**Response Event:** `friendRequestSent`

**Response Data:**

```javascript
{
  success: boolean,
  message?: string
}
```

**Broadcast Event:** `friendRequestReceived` (to recipient if online)

**Broadcast Data:**

```javascript
{
    userId: string; // The ID of the sender
}
```

**Use Case:**

1. User finds another user and clicks "Add Friend"
2. Frontend emits `sendFriendRequest` event
3. Server adds the request to recipient's list
4. Server notifies the recipient if online
5. Frontend updates UI to show "Request Sent"

### Accept Friend Request

**Event Name:** `acceptFriendRequest`

**Required Parameters:**

```javascript
{
    senderId: string;
}
```

**Response Event:** `friendRequestAccepted`

**Response Data:**

```javascript
{
  success: boolean,
  conversationId?: string,
  message?: string
}
```

**Broadcast Event:** `friendRequestAccepted` (to original sender if online)

**Broadcast Data:**

```javascript
{
  userId: string, // ID of the user who accepted
  conversationId: string
}
```

**Use Case:**

1. User views friend requests and clicks "Accept" on a request
2. Frontend emits `acceptFriendRequest` event
3. Server updates both users' friend lists
4. Server creates a DM conversation for the new friends
5. Server notifies the original sender if online
6. Frontend updates UI to show new friend and conversation

### Reject Friend Request

**Event Name:** `rejectFriendRequest`

**Required Parameters:**

```javascript
{
    senderId: string;
}
```

**Response Event:** `friendRequestRejected`

**Response Data:**

```javascript
{
    success: boolean;
}
```

**Use Case:**

1. User views friend requests and clicks "Reject" on a request
2. Frontend emits `rejectFriendRequest` event
3. Server removes the request from user's list
4. Frontend removes the request from the UI

### Get Friend Requests

**Event Name:** `getFriendRequests`

**Required Parameters:**

```javascript
{
  page?: number, // Default: 1
  limit?: number // Default: 10
}
```

**Response Event:** `friendRequests`

**Response Data:**

```javascript
{
  success: boolean,
  requests: Array<{
    userId: {
      _id: string,
      name: string,
      username: string,
      profilePicture: string,
      status: string,
      lastSeen: Date,
      level: number,
      college: string
    },
    createdAt: Date
  }>,
  pagination: {
    total: number,
    page: number,
    limit: number,
    totalPages: number,
    hasNextPage: boolean,
    hasPrevPage: boolean,
    nextPage: number | null,
    prevPage: number | null
  }
}
```

**Use Case:**

1. User navigates to friend requests section
2. Frontend emits `getFriendRequests` event
3. Server sends back pending friend requests
4. Frontend displays the requests with pagination controls

### Block User

**Event Name:** `blockUser`

**Required Parameters:**

```javascript
{
    userId: string;
}
```

**Response Event:** `userBlocked`

**Response Data:**

```javascript
{
    success: boolean;
}
```

**Use Case:**

1. User selects another user and clicks "Block"
2. Frontend emits `blockUser` event
3. Server updates both users' friend status to "blocked"
4. Frontend updates UI to reflect blocked status

### Unblock User

**Event Name:** `unblockUser`

**Required Parameters:**

```javascript
{
    userId: string;
}
```

**Response Event:** `userUnblocked`

**Response Data:**

```javascript
{
    success: boolean;
}
```

**Use Case:**

1. User views blocked list and clicks "Unblock" for a user
2. Frontend emits `unblockUser` event
3. Server updates both users' friend status to "accepted"
4. Frontend updates UI to reflect unblocked status

## Search Events

These events handle searching for users and peers.

### Basic Peer Search

**Event Name:** `searchPeers`

**Required Parameters:**

```javascript
{
  query?: string // Optional search term
}
```

**Response Event:** `peerSearchResults`

**Response Data:**

```javascript
{
  peers: Array<{
    _id: string,
    name: string,
    username: string,
    profilePicture: string,
    level: number,
    status: string,
    lastSeen: Date,
    college: string,
    gpa: number,
    profile: {
      bio?: string,
      interests?: Array<string>
    }
  }>
}
```

**Use Case:**

1. User enters a search term to find peers
2. Frontend emits `searchPeers` event
3. Server finds matching users with same level
4. Frontend displays search results

### Advanced Peer Search with Filters

**Event Name:** `searchPeersByFilter`

**Required Parameters:**

```javascript
{
  query?: string,
  university?: string,
  level?: number,
  gender?: string,
  gpaRange?: {
    min: number,
    max: number
  },
  interests?: Array<string>,
  graduationYear?: number
}
```

**Response Event:** `peerSearchResults`

**Response Data:**

```javascript
{
  peers: Array<{
    _id: string,
    name: string,
    username: string,
    profilePicture: string,
    gender: string,
    level: number,
    status: string,
    lastSeen: Date,
    college: string,
    university: string,
    gpa: number,
    graduationYear: number,
    profile: {
      bio?: string,
      interests?: Array<string>
    }
  }>
}
```

**Use Case:**

1. User applies various filters to search for specific peers
2. Frontend emits `searchPeersByFilter` event
3. Server finds matching users based on all criteria
4. Frontend displays filtered search results

### Recommended Peers

**Event Name:** `searchRecommendedPeers`

**Required Parameters:** None

**Response Event:** `peerSearchResults`

**Response Data:**

```javascript
{
  peers: Array<{
    _id: string,
    name: string,
    username: string,
    profilePicture: string,
    gender: string,
    level: number,
    status: string,
    lastSeen: Date,
    college: string,
    gpa: number,
    profile: {
      bio?: string,
      interests?: Array<string>
    },
    commonInterests: number
  }>
}
```

**Use Case:**

1. User navigates to recommended peers section
2. Frontend emits `searchRecommendedPeers` event
3. Server finds users with similar profiles
4. Frontend displays recommended peers with common interests

## Example Chat Flow Sequence

Here's a typical flow of events for a complete chat experience:

1. **User Login and Connection:**

    - User connects to socket
    - System automatically handles `handleUserConnection`
    - Socket emits `userStatus` to other users

2. **Loading Recent Conversations:**

    - Frontend emits `getRecentConversations`
    - Server responds with `recentConversations`
    - Frontend displays conversations list

3. **Opening a Conversation:**

    - User clicks on a conversation
    - Frontend emits `getConversationMessages`
    - Server responds with `conversationMessages`
    - Frontend displays messages
    - Frontend emits `markMessageRead`
    - Server broadcasts `messageRead` to other participants

4. **Sending a Message:**

    - User types (frontend emits `typing`)
    - Server broadcasts `userTyping` to other participants
    - User stops typing (frontend emits `stopTyping`)
    - Server broadcasts `userStoppedTyping`
    - User sends message (frontend emits `sendMessage`)
    - Server responds with `messageSent`
    - Server broadcasts `newMessage` to other participants

5. **Adding a New Friend:**
    - User searches for peers (frontend emits `searchPeers`)
    - Server responds with `peerSearchResults`
    - User sends friend request (frontend emits `sendFriendRequest`)
    - Server responds with `friendRequestSent`
    - Server emits `friendRequestReceived` to recipient
    - Recipient accepts request (frontend emits `acceptFriendRequest`)
    - Server creates conversation and responds with `friendRequestAccepted`
    - Server emits `friendRequestAccepted` to original sender
    - New conversation appears in both users' recent conversations
