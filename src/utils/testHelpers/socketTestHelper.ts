import { Socket } from 'socket.io-client';
import { Server } from 'socket.io';
import http from 'http';
import io from 'socket.io-client';

/**
 * Helper utility for socket.io tests
 * Provides consistent setup and teardown for socket tests
 */
export class SocketTestHelper {
  httpServer!: http.Server;
  ioServer!: Server;
  clientSocket: Socket | null = null;
  serverSocket: any = null;
  
  /**
   * Setup HTTP and Socket.IO servers
   * @param connectionHandler Function to handle new socket connections
   */
  setupServer(connectionHandler: (socket: any) => void): void {
    this.httpServer = http.createServer();
    this.ioServer = new Server(this.httpServer);
    this.httpServer.listen();
    
    this.ioServer.on('connection', (socket) => {
      this.serverSocket = socket;
      connectionHandler(socket);
    });
  }
  
  /**
   * Create a client socket connection
   * @returns The client socket
   */
  connectClientSocket(): Socket {
    const address = this.httpServer.address() as any;
    if (!address) {
      throw new Error('HTTP server not listening');
    }
    
    const socket = io(`http://localhost:${address.port}`, {
      transports: ['websocket'],
      forceNew: true
    });
    
    this.clientSocket = socket;
    return socket;
  }
  
  /**
   * Clean up all resources
   * @param done Jest done callback
   */
  cleanup(done: () => void): void {
    try {
      // Disconnect client socket
      if (this.clientSocket) {
        this.clientSocket.removeAllListeners();
        this.clientSocket.disconnect();
        this.clientSocket.close();
        this.clientSocket = null;
      }
      
      // Disconnect server socket
      if (this.serverSocket) {
        this.serverSocket.removeAllListeners();
        this.serverSocket = null;
      }
      
      // Close IO server
      if (this.ioServer) {
        this.ioServer.disconnectSockets(true);
        this.ioServer.close();
      }
      
      // Close HTTP server
      if (this.httpServer && this.httpServer.listening) {
        this.httpServer.close(() => {
          // Force cleanup of any remaining connections
          if (global.gc) {
            global.gc();
          }
          done();
        });
      } else {
        done();
      }
    } catch (err) {
      console.error('Error during socket test cleanup:', err);
      done();
    }
  }
  
  /**
   * Disconnect client socket
   * @param done Jest done callback
   */
  disconnectClient(done: () => void): void {
    try {
      if (this.clientSocket) {
        this.clientSocket.removeAllListeners();
        this.clientSocket.disconnect();
        this.clientSocket.close();
        this.clientSocket = null;
      }
      done();
    } catch (err) {
      console.error('Error disconnecting client socket:', err);
      done();
    }
  }
}
