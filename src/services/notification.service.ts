import { Types } from 'mongoose';
import { EventsManager } from '@utils/EventsManager';
import { INotification } from '../models/types';
import Notification from '../models/Notification';
import User from '../models/User';
import Conversation from '../models/Conversation';
import Message from '../models/Message';
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
   * Create notification for new message
   */
  public async createMessageNotification(
    message: any,
    conversation: any,
    sender: any,
    recipients: Types.ObjectId[]
  ): Promise<void> {
    try {

      // Get conversation name for group chats
      const conversationName = conversation.type === 'DM' 
        ? sender.name 
        : conversation.name || 'Group Chat';

      // Create notification content
      const content = conversation.type === 'DM' 
        ? `${sender.name}: ${message.content?.substring(0, 100)}${message.content?.length > 100 ? '...' : ''}`
        : `${sender.name} in ${conversationName}: ${message.content?.substring(0, 100)}${message.content?.length > 100 ? '...' : ''}`;

      // Create notifications for all recipients
      const notificationPromises = recipients.map(async (recipientId) => {
        
        // Check if user has message notifications enabled
        const user = await User.findById(recipientId).select('chatPreferences');
        if (!user || user.chatPreferences?.messageNotifications === 'none') {
          return null;
        }

        // Check if conversation is muted
        const isMuted = user.recentConversations?.find(
          (conv: any) => conv.conversationId.toString() === conversation._id.toString()
        )?.isMuted;

        if (isMuted) {
          return null;
        }

        return this.createNotification(
          recipientId,
          'new_message',
          content,
          {
            messageId: message._id,
            conversationId: conversation._id,
            senderId: sender._id,
            senderName: sender.name,
            conversationName: conversationName,
            conversationType: conversation.type,
            action: 'created',
            timestamp: new Date(),
          }
        );
      });

      // Wait for all notifications to be created
      const notifications = await Promise.all(notificationPromises);
      const validNotifications = notifications.filter(n => n !== null);

      // Emit unread count updates to all recipients
      await this.emitUnreadCountUpdates(recipients);

    } catch (error) {
      console.error('❌ Error creating message notification:', error);
    }
  }

  /**
   * Emit unread count updates to users
   */
  public async emitUnreadCountUpdates(userIds: Types.ObjectId[]): Promise<void> {
    try {
      const unreadCounts = await Promise.all(
        userIds.map(async (userId) => {
          const count = await Notification.countDocuments({
            userId,
            status: 'unread'
          });
          return { userId: userId.toString(), count };
        })
      );

      // Emit to each user
      unreadCounts.forEach(({ userId, count }) => {
        io.to(userId).emit('unreadCountUpdate', { count });
      });
    } catch (error) {
      console.error('Error emitting unread count updates:', error);
    }
  }

  /**
   * Get user's unread count and emit it
   */
  public async emitUserUnreadCount(userId: Types.ObjectId): Promise<void> {
    try {
      const count = await Notification.countDocuments({
        userId,
        status: 'unread'
      });

      io.to(userId.toString()).emit('unreadCountUpdate', { count });
    } catch (error) {
      console.error('Error emitting user unread count:', error);
    }
  }

  /**
   * Get user's unread count
   */
  public async getUserUnreadCount(userId: Types.ObjectId): Promise<number> {
    return await Notification.countDocuments({
      userId,
      status: 'unread'
    });
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
    
    // Emit updated unread count
    await this.emitUserUnreadCount(userId);
  }

  /**
   * Mark conversation notifications as read
   */
  public async markConversationNotificationsAsRead(
    userId: Types.ObjectId,
    conversationId: Types.ObjectId
  ): Promise<void> {
    await Notification.updateMany(
      { 
        userId, 
        status: 'unread',
        'metadata.conversationId': conversationId
      },
      { status: 'read' }
    );
    
    // Emit updated unread count
    await this.emitUserUnreadCount(userId);
  }
}

export default NotificationService.getInstance(); 