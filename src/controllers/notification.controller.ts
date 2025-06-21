import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { AppError, ErrorCodes } from "../utils/appError";
import { HttpStatus } from "../utils/ApiResponse";
import asyncHandler from "../utils/asyncHandler";
import NotificationService from "../services/notification.service";
import { getPaginationMetadata, ParsedPaginationOptions } from "../utils/pagination";

/**
 * Get user's notifications with pagination
 * @route GET /api/v1/notifications
 */
export const getNotifications = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user!._id;
    const { page = 1, limit = 20, type, status } = req.query;

    if (!userId) {
        throw new AppError("User not authenticated", HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
    }

    const pageNum = Number(page);
    const limitNum = Number(limit);

    // Build filter object
    const filter: any = { userId };
    if (type) filter.type = type;
    if (status) filter.status = status;

    const skip = (pageNum - 1) * limitNum;

    const [notifications, total] = await Promise.all([
        NotificationService.getUserNotifications(userId, pageNum, limitNum),
        NotificationService.getUserUnreadCount(userId)
    ]);

    const paginationOptions: ParsedPaginationOptions = { 
        page: pageNum, 
        limit: limitNum, 
        sortBy: 'createdAt', 
        sortOrder: 'desc' 
    };
    const pagination = getPaginationMetadata(total, paginationOptions);

    res.success({
        notifications: notifications.notifications,
        pagination,
        totalUnread: total
    }, 'Notifications retrieved successfully');
});

/**
 * Mark a specific notification as read
 * @route PATCH /api/v1/notifications/:notificationId/read
 */
export const markAsRead = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { notificationId } = req.params;
    const userId = req.user!._id;

    if (!userId) {
        throw new AppError("User not authenticated", HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
    }

    if (!Types.ObjectId.isValid(notificationId)) {
        throw new AppError("Invalid notification ID", HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    await NotificationService.markAsRead(new Types.ObjectId(notificationId));

    // Emit updated unread count
    await NotificationService.emitUserUnreadCount(userId);

    res.success(null, 'Notification marked as read');
});

/**
 * Mark all notifications as read
 * @route PATCH /api/v1/notifications/read-all
 */
export const markAllAsRead = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user!._id;

    if (!userId) {
        throw new AppError("User not authenticated", HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
    }

    await NotificationService.markAllAsRead(userId);

    res.success(null, 'All notifications marked as read');
});

/**
 * Create a notification (for internal use)
 * @route POST /api/v1/notifications
 */
export const createNotification = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { userId, type, content, metadata } = req.body;

    if (!userId || !type || !content) {
        throw new AppError("Missing required fields", HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    if (!Types.ObjectId.isValid(userId)) {
        throw new AppError("Invalid user ID", HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    const notification = await NotificationService.createNotification(
        new Types.ObjectId(userId),
        type,
        content,
        metadata
    );

    res.success(notification, 'Notification created successfully', HttpStatus.CREATED);
});

/**
 * Mark conversation notifications as read
 * @route PATCH /api/v1/notifications/conversation/:conversationId/read
 */
export const markConversationNotificationsAsRead = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { conversationId } = req.params;
    const userId = req.user!._id;

    if (!userId) {
        throw new AppError("User not authenticated", HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
    }

    if (!Types.ObjectId.isValid(conversationId)) {
        throw new AppError("Invalid conversation ID", HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    await NotificationService.markConversationNotificationsAsRead(
        userId,
        new Types.ObjectId(conversationId)
    );

    res.success(null, 'Conversation notifications marked as read');
}); 