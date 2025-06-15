export {};

declare global {
    namespace Express {
        interface Response {
            success(data?: any, message?: string, statusCode?: number): Response;
        }
    }
}
