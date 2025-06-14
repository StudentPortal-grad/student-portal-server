import { Types } from 'mongoose';
import { EventsManager } from '@utils/EventsManager';
import { INotification } from '../models/types';
import Notification from '../models/Notification';
import { io } from '../config/socket';
import admin from 'firebase-admin';

class NotificationService {
  private static instance: NotificationService;
  private fcm: admin.messaging.Messaging;

  private constructor() {
    // Initialize Firebase Admin if not already initialized
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
      });
    }
    this.fcm = admin.messaging();
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Create a new notification and emit it through socket and FCM
   */
  public async createNotification(
    userId: Types.ObjectId,
    type: string,
    content: string,
    metadata?: any
  ): Promise<INotification> {

    // Create notification in database
    const notification = await Notification.create({
      userId,
      type,
      content,
      metadata,
    });

    // Emit event for other services
    EventsManager.emit('notification:created', notification);

    // Send FCM notification if user has FCM token
    // TODO: Get user's FCM token from user model
    // if (userFcmToken) {
    //   await this.sendFCMNotification(userFcmToken, {
    //     title: type,
    //     body: content,
    //     data: metadata,
    //   });
    // }

    return notification;
  }

  /**
   * Send FCM notification
   */
  private async sendFCMNotification(
    token: string,
    notification: {
      title: string;
      body: string;
      data?: any;
    }
  ): Promise<void> {
    try {
      await this.fcm.send({
        token,
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: notification.data,
      });
    } catch (error) {
      console.error('Error sending FCM notification:', error);
    }
  }

  /**
   * Get user's notifications
   */
  public async getUserNotifications(
    userId: Types.ObjectId,
    page: number = 1,
    limit: number = 10
  ): Promise<{ notifications: INotification[]; total: number }> {
    const skip = (page - 1) * limit;
    const [notifications, total] = await Promise.all([
      Notification.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Notification.countDocuments({ userId }),
    ]);

    return { notifications, total };
  }

  /**
   * Mark notification as read
   */
  public async markAsRead(notificationId: Types.ObjectId): Promise<void> {
    await Notification.findByIdAndUpdate(notificationId, { status: 'read' });
  }

  /**
   * Mark all notifications as read
   */
  public async markAllAsRead(userId: Types.ObjectId): Promise<void> {
    await Notification.updateMany(
      { userId, status: 'unread' },
      { status: 'read' }
    );
  }
}

export default NotificationService.getInstance(); 