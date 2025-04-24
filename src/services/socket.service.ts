import { Socket } from "socket.io";
import {
    handleMessageEvents,
    handleConversationEvents,
    handleRecentConversationsEvents,
    handleSearchEvents,
    handleFriendEvents
} from "./socket";
import { SocketServiceHelpers } from "./socket/socketService.helpers";
import { SocketUtils } from "@utils/socketUtils";

export class SocketService {
    static async handleUserConnection(userId: string, socket: Socket) {
        await SocketServiceHelpers.handleUserConnection(userId, socket);
    }

    static async handleUserDisconnection(userId: string) {
        await SocketServiceHelpers.handleUserDisconnection(userId);
    }

    static async updateUserStatus(userId: string, status: string, socketId?: string | null) {
        return SocketUtils.updateUserStatus(userId, status, socketId);
    }

    static broadcastUserStatus(userId: string, status: string) {
        SocketUtils.broadcastUserStatus(userId, status);
    }

    static async getUserData(userId: string) {
        return SocketUtils.getUserData(userId);
    }

    static validateObjectId(id: string): boolean {
        return SocketUtils.validateObjectId(id);
    }

    static async handleMessageEvents(socket: Socket) {
        handleMessageEvents(socket);
    }

    static async handleConversationEvents(socket: Socket) {
        handleConversationEvents(socket);
    }

    static async handleRecentConversationsEvents(socket: Socket) {
        handleRecentConversationsEvents(socket);
    }

    static async handleSearchEvents(socket: Socket) {
        handleSearchEvents(socket);
    }

    static async handleFriendEvents(socket: Socket) {
        handleFriendEvents(socket);
    }

    static async handleSocket(socket: Socket) {
        await this.handleMessageEvents(socket);
        await this.handleConversationEvents(socket);
        await this.handleRecentConversationsEvents(socket);
        await this.handleSearchEvents(socket);
        await this.handleFriendEvents(socket);
    }

    static async joinUserConversations(userId: string, socket: Socket) {
        await SocketUtils.joinUserConversations(userId, socket);
    }
}