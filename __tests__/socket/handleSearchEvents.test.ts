import { Socket } from 'socket.io-client';
import { Server } from 'socket.io';
import http from 'http';
import { handleSearchEvents } from '../../src/services/socket/handleSearchEvents';
import User from '../../src/models/User';
import { SocketUtils } from '../../src/utils/socketUtils';

// Mock dependencies
jest.mock('../../src/utils/socketUtils', () => ({
  SocketUtils: {
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
    handleSearchEvents(socket);
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
  level: 3,
  college: 'Engineering',
  university: 'Test University',
  profile: {
    interests: ['coding', 'music', 'sports']
  }
};

const mockPeers = [
  {
    _id: 'user2',
    name: 'Test User 2',
    username: 'testuser2',
    profilePicture: 'profile2.jpg',
    level: 3,
    status: 'online',
    lastSeen: new Date(),
    college: 'Engineering',
    gpa: 3.8,
    profile: {
      bio: 'Test bio 2',
      interests: ['coding', 'reading']
    }
  },
  {
    _id: 'user3',
    name: 'Test User 3',
    username: 'testuser3',
    profilePicture: 'profile3.jpg',
    level: 3,
    status: 'offline',
    lastSeen: new Date(Date.now() - 3600000),
    college: 'Engineering',
    gpa: 3.5,
    profile: {
      bio: 'Test bio 3',
      interests: ['music', 'sports']
    }
  }
];

describe.skip('handleSearchEvents', () => {
  describe('searchPeers', () => {
    beforeEach(() => {
      // Mock User.findById
      jest.spyOn(User, 'findById').mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockUser1),
        // Add required mongoose Query properties
        _mongooseOptions: {},
        exec: jest.fn(),
        $where: jest.fn()
      } as any);
      
      // Mock User.find
      jest.spyOn(User, 'find').mockReturnValue({
        select: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockPeers),
        // Add required mongoose Query properties
        _mongooseOptions: {},
        exec: jest.fn(),
        $where: jest.fn()
      } as any);
    });

    it('should search peers successfully without query', (done): void => {
      // Connect client socket
      clientSocket = require('socket.io-client')(`http://localhost:${(httpServer.address() as any).port}`, {
        transports: ['websocket'],
        forceNew: true
      });
      
      clientSocket.on('connect', () => {
        // Emit searchPeers event without query
        clientSocket.emit('searchPeers', {});
        
        // Listen for success response
        clientSocket.on('peerSearchResults', (data) => {
          expect(data).toBeDefined();
          expect(data.peers).toBeDefined();
          expect(data.peers.length).toBe(2);
          expect(User.findById).toHaveBeenCalledWith('user1');
          expect(User.find).toHaveBeenCalled();
          expect(SocketUtils.emitSuccess).toHaveBeenCalled();
          done();
        });
      });
    });

    it('should search peers successfully with query', (done): void => {
      // Connect client socket
      clientSocket = require('socket.io-client')(`http://localhost:${(httpServer.address() as any).port}`, {
        transports: ['websocket'],
        forceNew: true
      });
      
      clientSocket.on('connect', () => {
        // Emit searchPeers event with query
        clientSocket.emit('searchPeers', {
          query: 'test'
        });
        
        // Listen for success response
        clientSocket.on('peerSearchResults', (data) => {
          expect(data).toBeDefined();
          expect(data.peers).toBeDefined();
          expect(User.findById).toHaveBeenCalledWith('user1');
          expect(User.find).toHaveBeenCalled();
          // Verify that the query includes the search term
          expect(User.find).toHaveBeenCalledWith(expect.objectContaining({
            $or: expect.arrayContaining([
              expect.objectContaining({
                name: expect.objectContaining({
                  $regex: 'test'
                })
              })
            ])
          }));
          expect(SocketUtils.emitSuccess).toHaveBeenCalled();
          done();
        });
      });
    });

    it('should handle user not found', (done): void => {
      // Mock User.findById to return null
      jest.spyOn(User, 'findById').mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(null),
        // Add required mongoose Query properties
        _mongooseOptions: {},
        exec: jest.fn(),
        $where: jest.fn()
      } as any);
      
      // Connect client socket
      clientSocket = require('socket.io-client')(`http://localhost:${(httpServer.address() as any).port}`, {
        transports: ['websocket'],
        forceNew: true
      });
      
      clientSocket.on('connect', () => {
        // Emit searchPeers event
        clientSocket.emit('searchPeers', {});
        
        // Listen for response
        clientSocket.on('peerSearchResults', (data) => {
          expect(data).toBeDefined();
          expect(data.peers).toEqual([]);
          expect(User.find).not.toHaveBeenCalled();
          done();
        });
      });
    });

    it('should handle database errors', (done): void => {
      // Mock error in User.findById
      jest.spyOn(User, 'findById').mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockRejectedValue(new Error('Database error')),
        // Add required mongoose Query properties
        _mongooseOptions: {},
        exec: jest.fn(),
        $where: jest.fn()
      } as any);
      
      // Connect client socket
      clientSocket = require('socket.io-client')(`http://localhost:${(httpServer.address() as any).port}`, {
        transports: ['websocket'],
        forceNew: true
      });
      
      clientSocket.on('connect', () => {
        // Emit searchPeers event
        clientSocket.emit('searchPeers', {});
        
        // Wait for error response
        setTimeout((): void => {
          expect(SocketUtils.emitError).toHaveBeenCalledWith(
            expect.anything(),
            'peerSearchResults',
            'Failed to search peers'
          );
          done();
        }, 100);
      });
    });
  });

  describe('searchPeersByFilter', () => {
    beforeEach(() => {
      // Mock User.find
      jest.spyOn(User, 'find').mockReturnValue({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockPeers),
        // Add required mongoose Query properties
        _mongooseOptions: {},
        exec: jest.fn(),
        $where: jest.fn()
      } as any);
    });

    it('should search peers by university filter successfully', (done) => {
      // Connect client socket
      clientSocket = require('socket.io-client')(`http://localhost:${(httpServer.address() as any).port}`, {
        transports: ['websocket'],
        forceNew: true
      });
      
      clientSocket.on('connect', () => {
        // Emit searchPeersByFilter event with university filter
        clientSocket.emit('searchPeersByFilter', {
          university: 'Test University'
        });
        
        // Listen for success response
        clientSocket.on('peerSearchResults', (data) => {
          expect(data).toBeDefined();
          expect(data.peers).toBeDefined();
          expect(User.find).toHaveBeenCalledWith(expect.objectContaining({
            university: 'Test University'
          }));
          expect(SocketUtils.emitSuccess).toHaveBeenCalled();
          done();
        });
      });
    });

    it('should search peers by level filter successfully', (done) => {
      // Connect client socket
      clientSocket = require('socket.io-client')(`http://localhost:${(httpServer.address() as any).port}`, {
        transports: ['websocket'],
        forceNew: true
      });
      
      clientSocket.on('connect', () => {
        // Emit searchPeersByFilter event with level filter
        clientSocket.emit('searchPeersByFilter', {
          level: 3
        });
        
        // Listen for success response
        clientSocket.on('peerSearchResults', (data) => {
          expect(data).toBeDefined();
          expect(data.peers).toBeDefined();
          expect(User.find).toHaveBeenCalledWith(expect.objectContaining({
            level: 3
          }));
          expect(SocketUtils.emitSuccess).toHaveBeenCalled();
          done();
        });
      });
    });

    it('should search peers by GPA range filter successfully', (done) => {
      // Connect client socket
      clientSocket = require('socket.io-client')(`http://localhost:${(httpServer.address() as any).port}`, {
        transports: ['websocket'],
        forceNew: true
      });
      
      clientSocket.on('connect', () => {
        // Emit searchPeersByFilter event with GPA range filter
        clientSocket.emit('searchPeersByFilter', {
          gpaRange: { min: 3.0, max: 4.0 }
        });
        
        // Listen for success response
        clientSocket.on('peerSearchResults', (data) => {
          expect(data).toBeDefined();
          expect(data.peers).toBeDefined();
          expect(User.find).toHaveBeenCalledWith(expect.objectContaining({
            gpa: {
              $gte: 3.0,
              $lte: 4.0
            }
          }));
          expect(SocketUtils.emitSuccess).toHaveBeenCalled();
          done();
        });
      });
    });

    it('should search peers by interests filter successfully', (done) => {
      // Connect client socket
      clientSocket = require('socket.io-client')(`http://localhost:${(httpServer.address() as any).port}`, {
        transports: ['websocket'],
        forceNew: true
      });
      
      clientSocket.on('connect', () => {
        // Emit searchPeersByFilter event with interests filter
        clientSocket.emit('searchPeersByFilter', {
          interests: ['coding', 'music']
        });
        
        // Listen for success response
        clientSocket.on('peerSearchResults', (data) => {
          expect(data).toBeDefined();
          expect(data.peers).toBeDefined();
          expect(User.find).toHaveBeenCalledWith(expect.objectContaining({
            'profile.interests': { $in: ['coding', 'music'] }
          }));
          expect(SocketUtils.emitSuccess).toHaveBeenCalled();
          done();
        });
      });
    });

    it('should handle database errors', (done): void => {
      // Mock error in User.find
      jest.spyOn(User, 'find').mockReturnValue({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockRejectedValue(new Error('Database error')),
        // Add required mongoose Query properties
        _mongooseOptions: {},
        exec: jest.fn(),
        $where: jest.fn()
      } as any);
      
      // Connect client socket
      clientSocket = require('socket.io-client')(`http://localhost:${(httpServer.address() as any).port}`, {
        transports: ['websocket'],
        forceNew: true
      });
      
      clientSocket.on('connect', () => {
        // Emit searchPeersByFilter event
        clientSocket.emit('searchPeersByFilter', {
          university: 'Test University'
        });
        
        // Wait for error response
        setTimeout((): void => {
          expect(SocketUtils.emitError).toHaveBeenCalledWith(
            expect.anything(),
            'peerSearchResults',
            'Failed to search peers with filters'
          );
          done();
        }, 100);
      });
    });
  });

  describe('searchRecommendedPeers', () => {
    beforeEach(() => {
      // Mock User.findById
      jest.spyOn(User, 'findById').mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockUser1),
        // Add required mongoose Query properties
        _mongooseOptions: {},
        exec: jest.fn(),
        $where: jest.fn()
      } as any);
      
      // Mock User.aggregate
      jest.spyOn(User, 'aggregate').mockResolvedValue(mockPeers);
    });

    it('should search recommended peers successfully', (done) => {
      // Connect client socket
      clientSocket = require('socket.io-client')(`http://localhost:${(httpServer.address() as any).port}`, {
        transports: ['websocket'],
        forceNew: true
      });
      
      clientSocket.on('connect', () => {
        // Emit searchRecommendedPeers event
        clientSocket.emit('searchRecommendedPeers');
        
        // Listen for success response
        clientSocket.on('peerSearchResults', (data) => {
          expect(data).toBeDefined();
          expect(data.peers).toBeDefined();
          expect(User.findById).toHaveBeenCalledWith('user1');
          expect(User.aggregate).toHaveBeenCalled();
          expect(SocketUtils.emitSuccess).toHaveBeenCalled();
          done();
        });
      });
    });

    it('should handle user not found', (done): void => {
      // Mock User.findById to return null
      jest.spyOn(User, 'findById').mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(null),
        // Add required mongoose Query properties
        _mongooseOptions: {},
        exec: jest.fn(),
        $where: jest.fn()
      } as any);
      
      // Connect client socket
      clientSocket = require('socket.io-client')(`http://localhost:${(httpServer.address() as any).port}`, {
        transports: ['websocket'],
        forceNew: true
      });
      
      clientSocket.on('connect', () => {
        // Emit searchRecommendedPeers event
        clientSocket.emit('searchRecommendedPeers');
        
        // Wait for error response
        setTimeout((): void => {
          expect(SocketUtils.emitError).toHaveBeenCalledWith(
            expect.anything(),
            'peerSearchResults',
            'User not found'
          );
          done();
        }, 100);
      });
    });

    it('should handle database errors', (done): void => {
      // Mock error in User.findById
      jest.spyOn(User, 'findById').mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockRejectedValue(new Error('Database error')),
        // Add required mongoose Query properties
        _mongooseOptions: {},
        exec: jest.fn(),
        $where: jest.fn()
      } as any);
      
      // Connect client socket
      clientSocket = require('socket.io-client')(`http://localhost:${(httpServer.address() as any).port}`, {
        transports: ['websocket'],
        forceNew: true
      });
      
      clientSocket.on('connect', () => {
        // Emit searchRecommendedPeers event
        clientSocket.emit('searchRecommendedPeers');
        
        // Wait for error response
        setTimeout((): void => {
          expect(SocketUtils.emitError).toHaveBeenCalledWith(
            expect.anything(),
            'peerSearchResults',
            'Failed to get recommendations'
          );
          done();
        }, 100);
      });
    });
  });
});
