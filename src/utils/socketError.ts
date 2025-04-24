import { Socket } from "socket.io";
import { AppError } from "@utils/appError";

/**
 * Socket error handling utilities
 */
export class SocketError {
    /**
     * Handles general socket errors
     * @param socket The socket instance
     * @param error The error object
     */
    static handleError(socket: Socket, error: Error) {
        console.error("Socket error:", error);

        if (error instanceof AppError) {
            socket.emit("error", {
                message: error.message,
                code: error.code,
            });
        } else {
            socket.emit("error", {
                message: "Internal server error",
                code: "INTERNAL_ERROR",
            });
        }
    }

    /**
     * Handles authentication errors
     * @param socket The socket instance
     * @param message The error message
     */
    static handleAuthenticationError(socket: Socket, message: string) {
        socket.emit("error", {
            message,
            code: "AUTH_ERROR",
        });
    }

    /**
     * Handles validation errors
     * @param socket The socket instance
     * @param message The error message
     */
    static handleValidationError(socket: Socket, message: string) {
        socket.emit("error", {
            message,
            code: "VALIDATION_ERROR",
        });
    }

    /**
     * Handles connection errors
     * @param socket The socket instance
     * @param error The error object
     */
    static handleConnectionError(socket: Socket, error: Error) {
        console.error("Connection error:", error);
        socket.emit("error", {
            message: "Connection error occurred",
            code: "CONNECTION_ERROR",
        });
    }

    /**
     * Handles disconnect errors
     * @param socket The socket instance
     * @param error The error object
     */
    static handleDisconnectError(socket: Socket, error: Error) {
        console.error("Disconnect error:", error);
        socket.emit("error", {
            message: "Error during disconnect",
            code: "DISCONNECT_ERROR",
        });
    }
}
