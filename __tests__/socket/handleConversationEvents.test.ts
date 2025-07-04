import { handleConversationEvents } from '../../src/services/socket/handleConversationEvents';
import User from '../../src/models/User';
import Conversation from '../../src/models/Conversation';
import { SocketUtils } from '../../src/utils/socketUtils';
import { SocketTestHelper } from '../../src/utils/testHelpers/socketTestHelper';

// Mock dependencies
jest.mock('../../src/config/socket', () => ({
  getIO: jest.fn().mockReturnValue({
    sockets: {
      sockets: new Map([
        ['socket1', { data: { userId: 'user1' }, join: jest.fn() }],
        ['socket2', { data: { userId: 'user2' }, join: jest.fn() }]
      ])
    }
  })
}));

jest.mock('../../src/utils/socketUtils', () => ({
  SocketUtils: {
    validateRequest: jest.fn().mockResolvedValue(true),
    isConversationParticipant: jest.fn().mockResolvedValue(true),
    validateObjectId: jest.fn().mockReturnValue(true),
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
    handleConversationEvents(socket);
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
  profilePicture: 'profile1.jpg'
};

const mockUser2 = {
  _id: 'user2',
  name: 'Test User 2',
  profilePicture: 'profile2.jpg'
};

const mockConversation = {
  _id: 'conversation1',
  type: 'GroupDM',
  participants: [
    { userId: mockUser1._id, role: 'owner' },
    { userId: mockUser2._id, role: 'member' }
  ],
  name: 'Test Conversation',
  description: 'Test Description',
  createdBy: mockUser1._id,
  status: 'active',
  createdAt: new Date(),
  updatedAt: new Date(),
  metadata: { lastActivity: new Date(), totalMessages: 0 },
  toObject: jest.fn().mockReturnThis(),
  // Add mongoose Document properties
  $assertPopulated: jest.fn(),
  $clearModifiedPaths: jest.fn(),
  $clone: jest.fn(),
  __v: 0
} as any;

describe.skip('handleConversationEvents', () => {
  describe('createConversation', () => {
    beforeEach(() => {
      // Mock Conversation.create
      jest.spyOn(Conversation, 'create').mockResolvedValue(mockConversation);
      
      // Mock User.updateMany
      jest.spyOn(User, 'updateMany').mockResolvedValue({
        acknowledged: true,
        matchedCount: 2,
        modifiedCount: 2,
        upsertedCount: 0,
        upsertedId: null
      });
      
      // Mock Conversation.populate
      jest.spyOn(Conversation, 'populate').mockResolvedValue(mockConversation);
    });

    it('should create a new conversation successfully', (done): void => {
      // Set timeout for this test
      jest.setTimeout(10000);
      
      // Connect client socket
      const clientSocket = socketHelper.connectClientSocket();
      
      // Set up timeout safety
      const timeout = setTimeout(() => {
        done(new Error('Test timed out'));
      }, 5000);
      
      clientSocket.on('connect', () => {
        // Emit createConversation event
        clientSocket.emit('createConversation', {
          participants: ['user2'],
          type: 'GroupDM',
          name: 'Test Conversation',
          description: 'Test Description'
        });
        
        // Listen for response
        clientSocket.on('conversationCreated', (data: any) => {
          clearTimeout(timeout);
          try {
            expect(data).toBeDefined();
            expect(data.conversation).toBeDefined();
            expect(Conversation.create).toHaveBeenCalled();
            expect(User.updateMany).toHaveBeenCalled();
            done();
          } catch (err) {
            done(err);
          }
        });
      });
      
      clientSocket.on('error', (err) => {
        clearTimeout(timeout);
        done(err);
      });
    });

    it('should handle errors during conversation creation', (done): void => {
      // Mock error in Conversation.create
      jest.spyOn(Conversation, 'create').mockRejectedValue(new Error('Database error'));
      
      // Connect client socket
      const clientSocket = socketHelper.connectClientSocket();
      
      clientSocket.on('connect', () => {
        // Emit createConversation event
        clientSocket.emit('createConversation', {
          participants: ['user2'],
          type: 'GroupDM',
          name: 'Test Conversation',
          description: 'Test Description'
        });
        
        // Wait for error response
        setTimeout((): void => {
          expect(SocketUtils.emitError).toHaveBeenCalledWith(expect.anything(), 'conversationCreated');
          done();
        }, 100);
      });
    });
  });

  describe('getConversations', () => {
    beforeEach(() => {
      // Mock Conversation.find
      const mockFind = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue([mockConversation])
      };
      jest.spyOn(Conversation, 'find').mockReturnValue(mockFind as any);
    });

    it('should retrieve conversations successfully', (done): void => {
      // Connect client socket
      const clientSocket = socketHelper.connectClientSocket();
      
      clientSocket.on('connect', () => {
        // Emit getConversations event
        clientSocket.emit('getConversations');
        
        // Listen for success response
        clientSocket.on('conversations', (data: any) => {
          expect(data).toBeDefined();
          expect(data.conversations).toBeDefined();
          expect(Conversation.find).toHaveBeenCalled();
          done();
        });
      });
    });

    it('should handle errors when retrieving conversations', (done): void => {
      // Mock error in Conversation.find
      const mockFind = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockRejectedValue(new Error('Database error'))
      };
      jest.spyOn(Conversation, 'find').mockReturnValue(mockFind as any);
      
      // Connect client socket
      const clientSocket = socketHelper.connectClientSocket();
      
      clientSocket.on('connect', () => {
        // Emit getConversations event
        clientSocket.emit('getConversations');
        
        // Wait for error response
        setTimeout((): void => {
          expect(SocketUtils.emitError).toHaveBeenCalledWith(expect.anything(), 'conversations');
          done();
        }, 100);
      });
    });
  });

  describe('addGroupMembers', () => {
    beforeEach(() => {
      // Mock Conversation.findById
      jest.spyOn(Conversation, 'findById').mockResolvedValue({
        ...mockConversation,
        participants: [
          { userId: { toString: () => 'user1' }, role: 'owner' },
          { userId: { toString: () => 'user2' }, role: 'member' }
        ],
        populate: jest.fn().mockReturnThis()
      } as any);
      
      // Mock Conversation.bulkWrite and User.bulkWrite
      jest.spyOn(Conversation, 'bulkWrite').mockResolvedValue({
        ok: 1,
        writeErrors: [],
        writeConcernErrors: [],
        insertedIds: [],
        nInserted: 0,
        nUpserted: 0,
        nMatched: 1,
        nModified: 1,
        nRemoved: 0,
        upserted: []
      } as any);
      
      jest.spyOn(User, 'bulkWrite').mockResolvedValue({
        ok: 1,
        writeErrors: [],
        writeConcernErrors: [],
        insertedIds: [],
        nInserted: 0,
        nUpserted: 0,
        nMatched: 1,
        nModified: 1,
        nRemoved: 0,
        upserted: []
      } as any);
    });

    it('should add members to a group conversation successfully', (done): void => {
      // Connect client socket
      const clientSocket = socketHelper.connectClientSocket();
      
      clientSocket.on('connect', () => {
        // Emit addGroupMembers event
        clientSocket.emit('addGroupMembers', {
          conversationId: 'conversation1',
          userIds: ['user3']
        });
        
        // Listen for success response
        clientSocket.on('groupMembersAdded', (data: any) => {
          expect(data).toBeDefined();
          expect(data.conversation).toBeDefined();
          expect(Conversation.bulkWrite).toHaveBeenCalled();
          expect(User.bulkWrite).toHaveBeenCalled();
          done();
        });
      });
    });

    it('should handle unauthorized member addition attempts', (done): void => {
      // Mock user not being an owner
      jest.spyOn(Conversation, 'findById').mockResolvedValue({
        ...mockConversation,
        participants: [
          { userId: { toString: () => 'user1' }, role: 'member' },
          { userId: { toString: () => 'user2' }, role: 'member' }
        ]
      } as any);
      
      // Connect client socket
      const clientSocket = socketHelper.connectClientSocket();
      
      clientSocket.on('connect', () => {
        // Emit addGroupMembers event
        clientSocket.emit('addGroupMembers', {
          conversationId: 'conversation1',
          userIds: ['user3']
        });
        
        // Wait for error response
        setTimeout((): void => {
          expect(SocketUtils.emitError).toHaveBeenCalledWith(
            expect.anything(),
            'groupMembersAdded',
            'Not authorized to add members'
          );
          done();
        }, 100);
      });
    });
  });
});
