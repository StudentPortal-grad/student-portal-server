import { Socket } from 'socket.io-client';
import { Server } from 'socket.io';
import http from 'http';
import { handleFriendEvents } from '../../src/services/socket/handleFriendEvents';
import User from '../../src/models/User';
import Conversation from '../../src/models/Conversation';
import { SocketUtils } from '../../src/utils/socketUtils';

// Mock dependencies
jest.mock('../../src/utils/socketUtils', () => ({
  SocketUtils: {
    validateObjectId: jest.fn().mockReturnValue(true),
    emitSuccess: jest.fn(),
    emitError: jest.fn()
  }
}));

// Test setup
let httpServer: http.Server;
let ioServer: Server;
let clientSocket: Socket;
let serverSocket: any;

beforeAll(() => {
  // Set up HTTP and Socket.IO servers
  httpServer = http.createServer();
  ioServer = new Server(httpServer);
  httpServer.listen();

  // Set up socket event handlers
  ioServer.on('connection', (socket) => {
    serverSocket = socket;
    socket.data = { userId: 'user1' };
    handleFriendEvents(socket);
  });
});

afterAll(() => {
  // Clean up
  if (clientSocket) clientSocket.disconnect();
  ioServer.close();
  httpServer.close();
});

beforeEach(() => {
  // Reset mocks
  jest.clearAllMocks();
});

// Test data
const mockUser1 = {
  _id: 'user1',
  name: 'Test User 1',
  friendRequests: [],
  friends: []
};

const mockUser2 = {
  _id: 'user2',
  name: 'Test User 2',
  socketId: 'socket2',
  friendRequests: [],
  friends: []
};

const mockConversation = {
  _id: 'conversation1',
  type: 'DM',
  participants: [
    { userId: mockUser1._id, role: 'member' },
    { userId: mockUser2._id, role: 'member' }
  ]
};

describe('handleFriendEvents', () => {
  describe('sendFriendRequest', () => {
    beforeEach(() => {
      // Mock validateFriendRequest function
      jest.spyOn(global, 'validateFriendRequest' as any).mockResolvedValue({
        valid: true,
        recipientSocketId: 'socket2'
      });
      
      // Mock User.updateOne
      jest.spyOn(User, 'updateOne').mockResolvedValue({
        acknowledged: true,
        matchedCount: 1,
        modifiedCount: 1,
        upsertedCount: 0,
        upsertedId: null
      });
    });

    it('should send a friend request successfully', (done): void => {
      // Connect client socket
      clientSocket = require('socket.io-client')(`http://localhost:${(httpServer.address() as any).port}`, {
        transports: ['websocket'],
        forceNew: true
      });
      
      clientSocket.on('connect', () => {
        // Emit sendFriendRequest event
        clientSocket.emit('sendFriendRequest', {
          recipientId: 'user2'
        });
        
        // Listen for success response
        clientSocket.on('friendRequestSent', (data) => {
          expect(data).toBeDefined();
          expect(data.success).toBe(true);
          expect(User.updateOne).toHaveBeenCalled();
          expect(SocketUtils.emitSuccess).toHaveBeenCalledWith(expect.anything(), 'friendRequestSent');
          done();
        });
      });
    });

    it('should handle invalid recipient ID', (done): void => {
      // Mock validateObjectId to return false
      (SocketUtils.validateObjectId as jest.Mock).mockReturnValueOnce(false);
      
      // Connect client socket
      clientSocket = require('socket.io-client')(`http://localhost:${(httpServer.address() as any).port}`, {
        transports: ['websocket'],
        forceNew: true
      });
      
      clientSocket.on('connect', () => {
        // Emit sendFriendRequest event with invalid ID
        clientSocket.emit('sendFriendRequest', {
          recipientId: 'invalid-id'
        });
        
        // Wait for error response
        setTimeout((): void => {
          expect(SocketUtils.emitError).toHaveBeenCalledWith(
            expect.anything(),
            'friendRequestSent',
            'Invalid recipient ID'
          );
          done();
        }, 100);
      });
    });

    it('should handle validation failures', (done): void => {
      // Mock validateFriendRequest to return invalid
      jest.spyOn(global, 'validateFriendRequest' as any).mockResolvedValueOnce({
        valid: false,
        error: 'Already friends'
      });
      
      // Connect client socket
      clientSocket = require('socket.io-client')(`http://localhost:${(httpServer.address() as any).port}`, {
        transports: ['websocket'],
        forceNew: true
      });
      
      clientSocket.on('connect', () => {
        // Emit sendFriendRequest event
        clientSocket.emit('sendFriendRequest', {
          recipientId: 'user2'
        });
        
        // Wait for error response
        setTimeout((): void => {
          expect(SocketUtils.emitError).toHaveBeenCalledWith(
            expect.anything(),
            'friendRequestSent',
            'Already friends'
          );
          done();
        }, 100);
      });
    });
  });

  describe('acceptFriendRequest', () => {
    beforeEach(() => {
      // Mock validateFriendAcceptance function
      jest.spyOn(global, 'validateFriendAcceptance' as any).mockResolvedValue({
        valid: true,
        senderSocketId: 'socket2'
      });
      
      // Mock createDMConversation function
      jest.spyOn(global, 'createDMConversation' as any).mockResolvedValue(mockConversation);
      
      // Mock updateFriendshipRecords function
      jest.spyOn(global, 'updateFriendshipRecords' as any).mockResolvedValue(true);
    });

    it('should accept a friend request successfully', (done): void => {
      // Connect client socket
      clientSocket = require('socket.io-client')(`http://localhost:${(httpServer.address() as any).port}`, {
        transports: ['websocket'],
        forceNew: true
      });
      
      clientSocket.on('connect', () => {
        // Emit acceptFriendRequest event
        clientSocket.emit('acceptFriendRequest', {
          senderId: 'user2'
        });
        
        // Listen for success response
        clientSocket.on('friendRequestAccepted', (data) => {
          expect(data).toBeDefined();
          expect(data.userId).toBe('user2');
          expect(data.conversationId).toBeDefined();
          expect(SocketUtils.emitSuccess).toHaveBeenCalled();
          done();
        });
      });
    });

    it('should handle invalid sender ID', (done): void => {
      // Mock validateObjectId to return false
      (SocketUtils.validateObjectId as jest.Mock).mockReturnValueOnce(false);
      
      // Connect client socket
      clientSocket = require('socket.io-client')(`http://localhost:${(httpServer.address() as any).port}`, {
        transports: ['websocket'],
        forceNew: true
      });
      
      clientSocket.on('connect', () => {
        // Emit acceptFriendRequest event with invalid ID
        clientSocket.emit('acceptFriendRequest', {
          senderId: 'invalid-id'
        });
        
        // Wait for error response
        setTimeout((): void => {
          expect(SocketUtils.emitError).toHaveBeenCalledWith(
            expect.anything(),
            'friendRequestAccepted',
            'Invalid sender ID'
          );
          done();
        }, 100);
      });
    });

    it('should handle validation failures', (done): void => {
      // Mock validateFriendAcceptance to return invalid
      jest.spyOn(global, 'validateFriendAcceptance' as any).mockResolvedValueOnce({
        valid: false,
        error: 'Friend request not found'
      });
      
      // Connect client socket
      clientSocket = require('socket.io-client')(`http://localhost:${(httpServer.address() as any).port}`, {
        transports: ['websocket'],
        forceNew: true
      });
      
      clientSocket.on('connect', () => {
        // Emit acceptFriendRequest event
        clientSocket.emit('acceptFriendRequest', {
          senderId: 'user2'
        });
        
        // Wait for error response
        setTimeout((): void => {
          expect(SocketUtils.emitError).toHaveBeenCalledWith(
            expect.anything(),
            'friendRequestAccepted',
            'Friend request not found'
          );
          done();
        }, 100);
      });
    });
  });

  describe('getFriendRequests', () => {
    beforeEach(() => {
      // Mock User.findById
      jest.spyOn(User, 'findById').mockReturnValue({
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockResolvedValue({
          friendRequests: [
            { userId: mockUser2._id, createdAt: new Date() }
          ]
        }),
        // Add required mongoose Query properties
        _mongooseOptions: {},
        exec: jest.fn(),
        $where: jest.fn(),
        all: jest.fn()
      } as any);
    });

    it('should retrieve friend requests successfully', (done): void => {
      // Connect client socket
      clientSocket = require('socket.io-client')(`http://localhost:${(httpServer.address() as any).port}`, {
        transports: ['websocket'],
        forceNew: true
      });
      
      clientSocket.on('connect', () => {
        // Emit getFriendRequests event
        clientSocket.emit('getFriendRequests');
        
        // Listen for success response
        clientSocket.on('friendRequests', (data) => {
          expect(data).toBeDefined();
          expect(data.requests).toBeDefined();
          expect(data.requests.length).toBe(1);
          expect(User.findById).toHaveBeenCalled();
          done();
        });
      });
    });

    it('should handle errors when retrieving friend requests', (done): void => {
      // Mock error in User.findById
      jest.spyOn(User, 'findById').mockReturnValue({
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockRejectedValue(new Error('Database error')),
        // Add required mongoose Query properties
        _mongooseOptions: {},
        exec: jest.fn(),
        $where: jest.fn(),
        all: jest.fn()
      } as any);
      
      // Connect client socket
      clientSocket = require('socket.io-client')(`http://localhost:${(httpServer.address() as any).port}`, {
        transports: ['websocket'],
        forceNew: true
      });
      
      clientSocket.on('connect', () => {
        // Emit getFriendRequests event
        clientSocket.emit('getFriendRequests');
        
        // Wait for error response
        setTimeout((): void => {
          expect(SocketUtils.emitError).toHaveBeenCalled();
          done();
        }, 100);
      });
    });
  });

  describe('getFriends', () => {
    beforeEach(() => {
      // Mock User.findById
      jest.spyOn(User, 'findById').mockReturnValue({
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockResolvedValue({
          friends: [
            { 
              userId: mockUser2._id, 
              status: 'accepted',
              conversationId: mockConversation._id,
              createdAt: new Date()
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

    it('should retrieve friends list successfully', (done): void => {
      // Connect client socket
      clientSocket = require('socket.io-client')(`http://localhost:${(httpServer.address() as any).port}`, {
        transports: ['websocket'],
        forceNew: true
      });
      
      clientSocket.on('connect', () => {
        // Emit getFriends event
        clientSocket.emit('getFriends');
        
        // Listen for success response
        clientSocket.on('friendsList', (data) => {
          expect(data).toBeDefined();
          expect(data.friends).toBeDefined();
          expect(data.friends.length).toBe(1);
          expect(User.findById).toHaveBeenCalled();
          done();
        });
      });
    });

    it('should handle errors when retrieving friends list', (done): void => {
      // Mock error in User.findById
      jest.spyOn(User, 'findById').mockReturnValue({
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockRejectedValue(new Error('Database error')),
        // Add required mongoose Query properties
        _mongooseOptions: {},
        exec: jest.fn(),
        $where: jest.fn(),
        all: jest.fn()
      } as any);
      
      // Connect client socket
      clientSocket = require('socket.io-client')(`http://localhost:${(httpServer.address() as any).port}`, {
        transports: ['websocket'],
        forceNew: true
      });
      
      clientSocket.on('connect', () => {
        // Emit getFriends event
        clientSocket.emit('getFriends');
        
        // Wait for error response
        setTimeout((): void => {
          expect(SocketUtils.emitError).toHaveBeenCalled();
          done();
        }, 100);
      });
    });
  });
});
