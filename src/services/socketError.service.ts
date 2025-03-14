import { Socket } from "socket.io";
import { AppError } from "@utils/appError";

export class SocketErrorService {
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

    static handleAuthenticationError(socket: Socket, message: string) {
        socket.emit("error", {
            message,
            code: "AUTH_ERROR",
        });
    }

    static handleValidationError(socket: Socket, message: string) {
        socket.emit("error", {
            message,
            code: "VALIDATION_ERROR",
        });
    }

    static handleConnectionError(socket: Socket, error: Error) {
        console.error("Connection error:", error);
        socket.emit("error", {
            message: "Connection error occurred",
            code: "CONNECTION_ERROR",
        });
    }

    static handleDisconnectError(socket: Socket, error: Error) {
        console.error("Disconnect error:", error);
        socket.emit("error", {
            message: "Error during disconnect",
            code: "DISCONNECT_ERROR",
        });
    }
}
