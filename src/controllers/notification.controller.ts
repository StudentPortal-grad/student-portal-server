import { Request, Response } from 'express';
import asyncHandler from '../utils/asyncHandler';
import notificationService from '../services/notification.service';
import { Types } from 'mongoose';

export const createNotification = asyncHandler(
  async (req: Request, res: Response) => {
    const { type, content, metadata } = req.body;
    const userId = new Types.ObjectId(req.user._id);

    const notification = await notificationService.createNotification(
      userId,
      type,
      content,
      metadata
    );

    res.status(201).json({
      success: true,
      data: notification,
    });
  }
);

export const getNotifications = asyncHandler(
  async (req: Request, res: Response) => {
    const { page = 1, limit = 10 } = req.query;
    const userId = new Types.ObjectId(req.user._id);

    const result = await notificationService.getUserNotifications(
      userId,
      Number(page),
      Number(limit)
    );

    res.json({
      success: true,
      data: result.notifications,
      pagination: {
        total: result.total,
        page: Number(page),
        limit: Number(limit),
      },
    });
  }
);

export const markAsRead = asyncHandler(
  async (req: Request, res: Response) => {
    const { notificationId } = req.params;
    await notificationService.markAsRead(new Types.ObjectId(notificationId));

    res.json({
      success: true,
      message: 'Notification marked as read',
    });
  }
);

export const markAllAsRead = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = new Types.ObjectId(req.user._id);
    await notificationService.markAllAsRead(userId);

    res.json({
      success: true,
      message: 'All notifications marked as read',
    });
  }
); 