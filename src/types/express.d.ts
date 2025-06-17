import { IUser } from '../models/types';

export {};

declare global {
    namespace Express {
        interface Request {
            user?: IUser;
        }
        interface Response {
            success(data?: any, message?: string, statusCode?: number): Response;
        }
    }
}
