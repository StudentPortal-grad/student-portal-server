import { Socket } from 'socket.io-client';
import { Server } from 'socket.io';
import http from 'http';
import { handleMessageEvents } from '../../src/services/socket/handleMessageEvents';
import User from '../../src/models/User';
import Conversation from '../../src/models/Conversation';
import Message from '../../src/models/Message';
import { SocketUtils } from '../../src/utils/socketUtils';
import { ConversationUtils } from '../../src/utils/conversationUtils';

// Mock dependencies
jest.mock('../../src/utils/socketUtils', () => ({
  SocketUtils: {
    validateRequest: jest.fn().mockResolvedValue(true),
    isConversationParticipant: jest.fn().mockResolvedValue(true),
    emitSuccess: jest.fn(),
    emitError: jest.fn()
  }
}));

jest.mock('../../src/utils/conversationUtils', () => ({
  ConversationUtils: {
    processNewMessage: jest.fn().mockResolvedValue(true)
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
    handleMessageEvents(socket);
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
  profilePicture: 'profile1.jpg'
};

const mockUser2 = {
  _id: 'user2',
  name: 'Test User 2',
  profilePicture: 'profile2.jpg'
};

const mockConversation = {
  _id: 'conversation1',
  participants: [
    { userId: mockUser1._id, role: 'member' },
    { userId: mockUser2._id, role: 'member' }
  ]
};

const mockMessage = {
  _id: 'message1',
  senderId: mockUser1._id,
  conversationId: mockConversation._id,
  content: 'Test message',
  createdAt: new Date(),
  updatedAt: new Date(),
  status: 'sent',
  toObject: jest.fn().mockReturnThis(),
  // Add mongoose Document properties
  $assertPopulated: jest.fn(),
  $clearModifiedPaths: jest.fn(),
  $clone: jest.fn(),
  __v: 0
} as any;

describe('handleMessageEvents', () => {
  describe('sendMessage', () => {
    beforeEach(() => {
      // Mock Message.create
      jest.spyOn(Message, 'create').mockResolvedValue(mockMessage);
      
      // Mock Conversation.findById
      jest.spyOn(Conversation, 'findById').mockResolvedValue(mockConversation);
      
      // Mock Conversation.bulkWrite
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
      
      // Mock Message.populate
      jest.spyOn(Message, 'populate').mockResolvedValue(mockMessage);
    });

    it('should send a message successfully', (done): void => {
      // Connect client socket
      clientSocket = require('socket.io-client')(`http://localhost:${(httpServer.address() as any).port}`, {
        transports: ['websocket'],
        forceNew: true
      });
      
      clientSocket.on('connect', () => {
        // Emit sendMessage event
        clientSocket.emit('sendMessage', {
          conversationId: 'conversation1',
          content: 'Test message'
        });
        
        // Listen for success response
        clientSocket.on('messageSent', (data) => {
          expect(data).toBeDefined();
          expect(data.success).toBe(true);
          expect(Message.create).toHaveBeenCalled();
          expect(Conversation.findById).toHaveBeenCalled();
          expect(Conversation.bulkWrite).toHaveBeenCalled();
          expect(ConversationUtils.processNewMessage).toHaveBeenCalled();
          expect(SocketUtils.emitSuccess).toHaveBeenCalledWith(expect.anything(), 'messageSent');
          done();
        });
      });
    });

    it('should handle validation failures', (done): void => {
      // Mock validateRequest to return false
      (SocketUtils.validateRequest as jest.Mock).mockResolvedValueOnce(false);
      
      // Connect client socket
      clientSocket = require('socket.io-client')(`http://localhost:${(httpServer.address() as any).port}`, {
        transports: ['websocket'],
        forceNew: true
      });
      
      clientSocket.on('connect', () => {
        // Emit sendMessage event with missing data
        clientSocket.emit('sendMessage', {
          conversationId: 'conversation1'
          // Missing content
        });
        
        // Wait for validation to fail
        setTimeout(() => {
          expect(Message.create).not.toHaveBeenCalled();
          done();
        }, 100);
      });
    });

    it('should handle non-participant access', (done): void => {
      // Mock isConversationParticipant to return false
      (SocketUtils.isConversationParticipant as jest.Mock).mockResolvedValueOnce(false);
      
      // Connect client socket
      clientSocket = require('socket.io-client')(`http://localhost:${(httpServer.address() as any).port}`, {
        transports: ['websocket'],
        forceNew: true
      });
      
      clientSocket.on('connect', () => {
        // Emit sendMessage event
        clientSocket.emit('sendMessage', {
          conversationId: 'conversation1',
          content: 'Test message'
        });
        
        // Wait for error response
        setTimeout((): void => {
          expect(SocketUtils.emitError).toHaveBeenCalledWith(
            expect.anything(),
            'messageSent',
            'Not authorized for this conversation'
          );
          done();
        }, 100);
      });
    });

    it('should handle conversation not found', (done): void => {
      // Mock Conversation.findById to return null
      jest.spyOn(Conversation, 'findById').mockResolvedValue(null);
      
      // Connect client socket
      clientSocket = require('socket.io-client')(`http://localhost:${(httpServer.address() as any).port}`, {
        transports: ['websocket'],
        forceNew: true
      });
      
      clientSocket.on('connect', () => {
        // Emit sendMessage event
        clientSocket.emit('sendMessage', {
          conversationId: 'nonexistent',
          content: 'Test message'
        });
        
        // Wait for error response
        setTimeout((): void => {
          expect(SocketUtils.emitError).toHaveBeenCalledWith(
            expect.anything(),
            'messageSent',
            'Conversation not found'
          );
          done();
        }, 100);
      });
    });
  });

  describe('deleteMessage', () => {
    beforeEach(() => {
      // Mock Message.findOneAndDelete
      jest.spyOn(Message, 'findOneAndDelete').mockResolvedValue(mockMessage);
    });

    it('should delete a message successfully', (done): void => {
      // Connect client socket
      clientSocket = require('socket.io-client')(`http://localhost:${(httpServer.address() as any).port}`, {
        transports: ['websocket'],
        forceNew: true
      });
      
      clientSocket.on('connect', () => {
        // Emit deleteMessage event
        clientSocket.emit('deleteMessage', {
          messageId: 'message1',
          conversationId: 'conversation1'
        });
        
        // Listen for success response
        clientSocket.on('messageDeleted', (data) => {
          expect(data).toBeDefined();
          expect(data.success).toBe(true);
          expect(Message.findOneAndDelete).toHaveBeenCalled();
          expect(SocketUtils.emitSuccess).toHaveBeenCalledWith(expect.anything(), 'messageDeleted');
          done();
        });
      });
    });

    it('should handle unauthorized message deletion', (done): void => {
      // Mock Message.findOneAndDelete to return null (not found or not authorized)
      jest.spyOn(Message, 'findOneAndDelete').mockResolvedValue(null);
      
      // Connect client socket
      clientSocket = require('socket.io-client')(`http://localhost:${(httpServer.address() as any).port}`, {
        transports: ['websocket'],
        forceNew: true
      });
      
      clientSocket.on('connect', () => {
        // Emit deleteMessage event
        clientSocket.emit('deleteMessage', {
          messageId: 'message1',
          conversationId: 'conversation1'
        });
        
        // Wait for error response
        setTimeout((): void => {
          expect(SocketUtils.emitError).toHaveBeenCalledWith(
            expect.anything(),
            'messageDeleted',
            'Not authorized to delete this message'
          );
          done();
        }, 100);
      });
    });
  });

  describe('editMessage', () => {
    beforeEach(() => {
      // Mock Message.findOneAndUpdate
      jest.spyOn(Message, 'findOneAndUpdate').mockResolvedValue(mockMessage);
    });

    it('should edit a message successfully', (done): void => {
      // Connect client socket
      clientSocket = require('socket.io-client')(`http://localhost:${(httpServer.address() as any).port}`, {
        transports: ['websocket'],
        forceNew: true
      });
      
      clientSocket.on('connect', () => {
        // Emit editMessage event
        clientSocket.emit('editMessage', {
          messageId: 'message1',
          conversationId: 'conversation1',
          content: 'Edited message'
        });
        
        // Listen for success response
        clientSocket.on('messageEdited', (data) => {
          expect(data).toBeDefined();
          expect(data.success).toBe(true);
          expect(Message.findOneAndUpdate).toHaveBeenCalled();
          expect(SocketUtils.emitSuccess).toHaveBeenCalledWith(expect.anything(), 'messageEdited');
          done();
        });
      });
    });

    it('should handle unauthorized message editing', (done): void => {
      // Mock Message.findOneAndUpdate to return null (not found or not authorized)
      jest.spyOn(Message, 'findOneAndUpdate').mockResolvedValue(null);
      
      // Connect client socket
      clientSocket = require('socket.io-client')(`http://localhost:${(httpServer.address() as any).port}`, {
        transports: ['websocket'],
        forceNew: true
      });
      
      clientSocket.on('connect', () => {
        // Emit editMessage event
        clientSocket.emit('editMessage', {
          messageId: 'message1',
          conversationId: 'conversation1',
          content: 'Edited message'
        });
        
        // Wait for error response
        setTimeout((): void => {
          expect(SocketUtils.emitError).toHaveBeenCalledWith(
            expect.anything(),
            'messageEdited',
            'Not authorized to edit this message'
          );
          done();
        }, 100);
      });
    });
  });

  describe('markMessageRead', () => {
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

    it('should mark messages as read successfully', (done): void => {
      // Connect client socket
      clientSocket = require('socket.io-client')(`http://localhost:${(httpServer.address() as any).port}`, {
        transports: ['websocket'],
        forceNew: true
      });
      
      clientSocket.on('connect', () => {
        // Emit markMessageRead event
        clientSocket.emit('markMessageRead', {
          conversationId: 'conversation1'
        });
        
        // Listen for success response
        clientSocket.on('messageMarkedRead', (data) => {
          expect(data).toBeDefined();
          expect(data.success).toBe(true);
          expect(User.updateOne).toHaveBeenCalled();
          done();
        });
      });
    });

    it('should handle errors when marking messages as read', (done): void => {
      // Mock error in User.updateOne
      jest.spyOn(User, 'updateOne').mockRejectedValue(new Error('Database error'));
      
      // Connect client socket
      clientSocket = require('socket.io-client')(`http://localhost:${(httpServer.address() as any).port}`, {
        transports: ['websocket'],
        forceNew: true
      });
      
      clientSocket.on('connect', () => {
        // Emit markMessageRead event
        clientSocket.emit('markMessageRead', {
          conversationId: 'conversation1'
        });
        
        // Listen for error response
        clientSocket.on('messageMarkedRead', (data) => {
          expect(data).toBeDefined();
          expect(data.success).toBe(false);
          done();
        });
      });
    });
  });

  describe('typing indicators', () => {
    it('should emit typing indicator to other participants', (done): void => {
      // Mock socket.broadcast.to().emit
      serverSocket.broadcast = {
        to: jest.fn().mockReturnValue({
          emit: jest.fn()
        })
      };
      
      // Connect client socket
      clientSocket = require('socket.io-client')(`http://localhost:${(httpServer.address() as any).port}`, {
        transports: ['websocket'],
        forceNew: true
      });
      
      clientSocket.on('connect', () => {
        // Emit typing event
        clientSocket.emit('typing', {
          conversationId: 'conversation1'
        });
        
        // Wait for broadcast to be called
        setTimeout(() => {
          expect(serverSocket.broadcast.to).toHaveBeenCalledWith('conversation1');
          expect(serverSocket.broadcast.to().emit).toHaveBeenCalledWith('userTyping', {
            userId: 'user1',
            conversationId: 'conversation1'
          });
          done();
        }, 100);
      });
    });

    it('should emit stop typing indicator to other participants', (done): void => {
      // Mock socket.broadcast.to().emit
      serverSocket.broadcast = {
        to: jest.fn().mockReturnValue({
          emit: jest.fn()
        })
      };
      
      // Connect client socket
      clientSocket = require('socket.io-client')(`http://localhost:${(httpServer.address() as any).port}`, {
        transports: ['websocket'],
        forceNew: true
      });
      
      clientSocket.on('connect', () => {
        // Emit stopTyping event
        clientSocket.emit('stopTyping', {
          conversationId: 'conversation1'
        });
        
        // Wait for broadcast to be called
        setTimeout(() => {
          expect(serverSocket.broadcast.to).toHaveBeenCalledWith('conversation1');
          expect(serverSocket.broadcast.to().emit).toHaveBeenCalledWith('userStoppedTyping', {
            userId: 'user1',
            conversationId: 'conversation1'
          });
          done();
        }, 100);
      });
    });
  });
});
