import { handleRecentConversationsEvents } from '../../src/services/socket/handleRecentConversationsEvents';
import User from '../../src/models/User';
import { SocketUtils } from '../../src/utils/socketUtils';
import { SocketTestHelper } from '../../src/utils/testHelpers/socketTestHelper';

// Mock dependencies
jest.mock('../../src/utils/socketUtils', () => ({
  SocketUtils: {
    validateRequest: jest.fn().mockResolvedValue(true),
    emitSuccess: jest.fn(),
    emitError: jest.fn()
  }
}));

// Test setup with helper
const socketHelper = new SocketTestHelper();

beforeAll(() => {
  // Set up HTTP and Socket.IO servers
  socketHelper.setupServer((socket: any) => {
    socket.data = { userId: 'user1' };
    handleRecentConversationsEvents(socket);
  });
});

afterAll(done => {
  // Clean up all resources
  socketHelper.cleanup(done);
});

beforeEach(() => {
  // Reset mocks
  jest.clearAllMocks();
});

afterEach(done => {
  // Disconnect client socket after each test
  socketHelper.disconnectClient(done);
});

// Test data
const mockUser1 = {
  _id: 'user1',
  name: 'Test User 1',
  recentConversations: [
    {
      conversationId: 'conversation1',
      unreadCount: 0,
      isPinned: false,
      isMuted: false
    },
    {
      conversationId: 'conversation2',
      unreadCount: 3,
      isPinned: true,
      isMuted: false
    }
  ]
};

const mockConversation1 = {
  _id: 'conversation1',
  name: 'Conversation 1',
  type: 'GroupDM',
  participants: [
    { userId: { _id: 'user1', name: 'User 1', profilePicture: 'pic1.jpg', status: 'online' } },
    { userId: { _id: 'user2', name: 'User 2', profilePicture: 'pic2.jpg', status: 'offline' } }
  ],
  lastMessage: { content: 'Hello', createdAt: new Date(), senderId: 'user2' },
  metadata: { lastActivity: new Date() }
};

const mockConversation2 = {
  _id: 'conversation2',
  name: 'Conversation 2',
  type: 'GroupDM',
  participants: [
    { userId: { _id: 'user1', name: 'User 1', profilePicture: 'pic1.jpg', status: 'online' } },
    { userId: { _id: 'user3', name: 'User 3', profilePicture: 'pic3.jpg', status: 'online' } }
  ],
  lastMessage: { content: 'Hey there', createdAt: new Date(), senderId: 'user3' },
  metadata: { lastActivity: new Date(Date.now() + 1000) } // More recent
};

describe.skip('handleRecentConversationsEvents', () => {
  describe('getRecentConversations', () => {
    beforeEach(() => {
      // Mock User.findById
      jest.spyOn(User, 'findById').mockReturnValue({
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue({
          ...mockUser1,
          recentConversations: [
            {
              ...mockUser1.recentConversations[0],
              conversationId: mockConversation1
            },
            {
              ...mockUser1.recentConversations[1],
              conversationId: mockConversation2
            }
          ]
        }),
        // Add required mongoose Query properties
        _mongooseOptions: {},
        exec: jest.fn(),
        $where: jest.fn(),
        all: jest.fn()
      } as any);
    });

    it('should retrieve recent conversations successfully', (done): void => {
      // Connect client socket
      const clientSocket = socketHelper.connectClientSocket();
      
      clientSocket.on('connect', () => {
        // Emit getRecentConversations event
        clientSocket.emit('getRecentConversations');
        
        // Listen for response
        clientSocket.on('recentConversations', (data: any) => {
          expect(data).toBeDefined();
          expect(data.success).toBe(true);
          expect(data.conversations).toBeDefined();
          expect(data.conversations.length).toBe(2);
          
          // Pinned conversation should be first
          expect(data.conversations[0].isPinned).toBe(true);
          
          expect(User.findById).toHaveBeenCalledWith('user1');
          done();
        });
      });
    });

    it('should handle user not found', (done): void => {
      // Mock User.findById to return null
      User.findById = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(null)
      });
      
      // Connect client socket
      const clientSocket = socketHelper.connectClientSocket();
      
      clientSocket.on('connect', () => {
        // Emit getRecentConversations event
        clientSocket.emit('getRecentConversations');
        
        // Listen for error response
        clientSocket.on('recentConversations', (data: any) => {
          expect(data).toBeDefined();
          expect(data.success).toBe(false);
          expect(data.conversations).toEqual([]);
          done();
        });
      });
    });

    it('should handle database errors', (done): void => {
      // Mock error in User.findById
      User.findById = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockRejectedValue(new Error('Database error'))
      });
      
      // Connect client socket
      const clientSocket = socketHelper.connectClientSocket();
      
      clientSocket.on('connect', () => {
        // Emit getRecentConversations event
        clientSocket.emit('getRecentConversations');
        
        // Listen for error response
        clientSocket.on('recentConversations', (data: any) => {
          expect(data).toBeDefined();
          expect(data.success).toBe(false);
          expect(data.conversations).toEqual([]);
          done();
        });
      });
    });
  });

  describe('updateRecentConversation', () => {
    beforeEach(() => {
      // Mock User.updateOne
      jest.spyOn(User, 'updateOne').mockResolvedValue({
        acknowledged: true,
        matchedCount: 1,
        modifiedCount: 1,
        upsertedCount: 0,
        upsertedId: null
      });
    });

    it('should update conversation pin status successfully', (done): void => {
      // Connect client socket
      const clientSocket = socketHelper.connectClientSocket();
      
      clientSocket.on('connect', () => {
        // Emit updateRecentConversation event
        clientSocket.emit('updateRecentConversation', {
          conversationId: 'conversation1',
          isPinned: true
        });
        
        // Listen for success response
        clientSocket.on('recentConversationUpdated', (data: any) => {
          expect(data).toBeDefined();
          expect(data.success).toBe(true);
          expect(data.conversationId).toBe('conversation1');
          expect(data.updates.isPinned).toBe(true);
          expect(User.updateOne).toHaveBeenCalled();
          expect(SocketUtils.emitSuccess).toHaveBeenCalled();
          done();
        });
      });
    });

    it('should update conversation mute status successfully', (done): void => {
      // Connect client socket
      const clientSocket = socketHelper.connectClientSocket();
      
      clientSocket.on('connect', () => {
        // Emit updateRecentConversation event
        clientSocket.emit('updateRecentConversation', {
          conversationId: 'conversation1',
          isMuted: true,
          mutedUntil: new Date(Date.now() + 3600000) // 1 hour from now
        });
        
        // Listen for success response
        clientSocket.on('recentConversationUpdated', (data: any) => {
          expect(data).toBeDefined();
          expect(data.success).toBe(true);
          expect(data.conversationId).toBe('conversation1');
          expect(data.updates.isMuted).toBe(true);
          expect(data.updates.mutedUntil).toBeDefined();
          expect(User.updateOne).toHaveBeenCalled();
          expect(SocketUtils.emitSuccess).toHaveBeenCalled();
          done();
        });
      });
    });

    it('should handle invalid conversation ID', (done): void => {
      // Mock validateObjectId to return false
      (SocketUtils.validateObjectId as jest.Mock).mockReturnValueOnce(false);
      
      // Connect client socket
      const clientSocket = socketHelper.connectClientSocket();
      
      clientSocket.on('connect', () => {
        // Emit updateRecentConversation event with invalid ID
        clientSocket.emit('updateRecentConversation', {
          conversationId: 'invalid-id',
          isPinned: true
        });
        
        // Wait for error response
        setTimeout(() => {
          expect(SocketUtils.emitError).toHaveBeenCalledWith(
            expect.anything(),
            'recentConversationUpdated',
            'Invalid conversation ID'
          );
          done();
        }, 100);
      });
    });

    it('should handle no fields to update', (done): void => {
      // Connect client socket
      const clientSocket = socketHelper.connectClientSocket();
      
      clientSocket.on('connect', () => {
        // Emit updateRecentConversation event with no update fields
        clientSocket.emit('updateRecentConversation', {
          conversationId: 'conversation1'
          // No update fields
        });
        
        // Wait for error response
        setTimeout((): void => {
          expect(SocketUtils.emitError).toHaveBeenCalledWith(
            expect.anything(),
            'recentConversationUpdated',
            'No fields to update'
          );
          done();
        }, 100);
      });
    });

    it('should handle conversation not found in recent list', (done): void => {
      // Mock User.updateOne to return no modifications
      jest.spyOn(User, 'updateOne').mockResolvedValue({
        acknowledged: true,
        matchedCount: 0,
        modifiedCount: 0,
        upsertedCount: 0,
        upsertedId: null
      });
      
      // Connect client socket
      const clientSocket = socketHelper.connectClientSocket();
      
      clientSocket.on('connect', () => {
        // Emit updateRecentConversation event
        clientSocket.emit('updateRecentConversation', {
          conversationId: 'nonexistent',
          isPinned: true
        });
        
        // Wait for error response
        setTimeout((): void => {
          expect(SocketUtils.emitError).toHaveBeenCalledWith(
            expect.anything(),
            'recentConversationUpdated',
            'Conversation not found in recent list'
          );
          done();
        }, 100);
      });
    });
  });

  describe('removeFromRecentConversations', () => {
    beforeEach(() => {
      // Mock User.updateOne
      jest.spyOn(User, 'updateOne').mockResolvedValue({
        acknowledged: true,
        matchedCount: 1,
        modifiedCount: 1,
        upsertedCount: 0,
        upsertedId: null
      });
    });

    it('should remove conversation from recent list successfully', (done): void => {
      // Connect client socket
      const clientSocket = socketHelper.connectClientSocket();
      
      clientSocket.on('connect', () => {
        // Emit removeFromRecentConversations event
        clientSocket.emit('removeFromRecentConversations', {
          conversationId: 'conversation1'
        });
        
        // Listen for success response
        clientSocket.on('removedFromRecentConversations', (data: any) => {
          expect(data).toBeDefined();
          expect(data.success).toBe(true);
          expect(data.conversationId).toBe('conversation1');
          expect(User.updateOne).toHaveBeenCalled();
          expect(SocketUtils.emitSuccess).toHaveBeenCalled();
          done();
        });
      });
    });

    it('should handle invalid conversation ID', (done): void => {
      // Mock validateObjectId to return false
      (SocketUtils.validateObjectId as jest.Mock).mockReturnValueOnce(false);
      
      // Connect client socket
      const clientSocket = socketHelper.connectClientSocket();
      
      clientSocket.on('connect', () => {
        // Emit removeFromRecentConversations event with invalid ID
        clientSocket.emit('removeFromRecentConversations', {
          conversationId: 'invalid-id'
        });
        
        // Wait for error response
        setTimeout((): void => {
          expect(SocketUtils.emitError).toHaveBeenCalledWith(
            expect.anything(),
            'removedFromRecentConversations',
            'Invalid conversation ID'
          );
          done();
        }, 100);
      });
    });

    it('should handle conversation not found in recent list', (done): void => {
      // Mock User.updateOne to return no modifications
      jest.spyOn(User, 'updateOne').mockResolvedValue({
        acknowledged: true,
        matchedCount: 0,
        modifiedCount: 0,
        upsertedCount: 0,
        upsertedId: null
      });
      
      // Connect client socket
      const clientSocket = socketHelper.connectClientSocket();
      
      clientSocket.on('connect', () => {
        // Emit removeFromRecentConversations event
        clientSocket.emit('removeFromRecentConversations', {
          conversationId: 'nonexistent'
        });
        
        // Wait for error response
        setTimeout((): void => {
          expect(SocketUtils.emitError).toHaveBeenCalledWith(
            expect.anything(),
            'removedFromRecentConversations',
            'Conversation not found in recent list'
          );
          done();
        }, 100);
      });
    });
  });
});
