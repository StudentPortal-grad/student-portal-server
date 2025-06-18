import { IUser } from '../models/types';
import { Server } from 'socket.io';

export {};

declare global {
  namespace Express {
    interface Application {
      io: Server;
    }
    interface Request {
      user?: IUser;
    }
    interface Response {
      success(data?: any, message?: string, statusCode?: number): Response;
    }
  }
}

