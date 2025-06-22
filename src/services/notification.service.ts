import { Types } from 'mongoose';
import { EventsManager } from '@utils/EventsManager';
import { INotification } from '../models/types';
import Notification from '../models/Notification';
import User from '../models/User';
import Conversation from '../models/Conversation';
import Message from '../models/Message';
import { io } from '../config/socket';
import agenda from '../config/agenda';
import { CreateNotificationJobData } from '../jobs/jobTypes';

class NotificationService {
  private static instance: NotificationService;

  private constructor() {
    // Private constructor for singleton pattern
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Schedule a notification to be created and delivered via Agenda.
   */
  public async createNotification(
    userId: Types.ObjectId,
    type: string,
    content: string,
    metadata?: any,
    channel: 'fcm' | 'socket' | 'in-app' | 'all' = 'all'
  ): Promise<void> {
    try {
      const jobData: CreateNotificationJobData = {
        userId: userId.toString(),
        type,
        content,
        metadata,
        channel,
      };
      await agenda.now('create-and-deliver-notification', jobData);
    } catch (error) {
      console.error(`Error scheduling 'create-and-deliver-notification' job:`, error);
    }
  }

  /**
   * Send FCM notification. Made public for use by Agenda jobs.
   * This method now schedules another job for actual delivery.
   */
  public async sendFCMNotification(fcmToken: string, notification: any): Promise<void> {
    try {
      const jobData = {
        tokens: [fcmToken],
        notification: {
          title: this.getNotificationTitle(notification.type),
          body: notification.content,
        },
        data: {
          ...notification.metadata,
          notificationId: notification._id.toString(),
          type: notification.type,
        },
      };

      // Schedule the job to send the FCM push notification
      await agenda.now('send-fcm-notification', jobData);
    } catch (error) {
      console.error('Error scheduling FCM notification job:', error);
    }
  }

  /**
   * Send socket notification. Made public for use by Agenda jobs.
   */
  public async sendSocketNotification(notification: any): Promise<void> {
    try {
      io.to(notification.userId.toString()).emit('notification', notification);
      await this.emitUserUnreadCount(notification.userId);
    } catch (error) {
      console.error('Error sending socket notification:', error);
    }
  }

  /**
   * Get notification title based on type
   */
  public getNotificationTitle(type: string): string {
    switch (type) {
      case 'new_message':
        return 'New Message';
      case 'new_follower':
        return 'New Follower';
      case 'new_discussion':
        return 'New Discussion';
      case 'new_resource':
        return 'New Resource';
      case 'discussion_reply':
        return 'New Reply to Discussion';
      case 'resource_voted':
        return 'Resource Voted';
      case 'resource_reported':
        return 'Resource Reported';
      case 'new_event':
        return 'New Event';
      case 'new_event_admin':
        return 'New Event Alert (Admin)';
      default:
        return 'New Notification';
    }
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
      const conversationName =
        conversation.type === 'group'
          ? conversation.groupName
          : sender.name;

      const content =
        message.content ||
        (message.attachments && message.attachments.length > 0
          ? `${sender.name} sent an attachment`
          : 'New message');

      const notificationPromises = recipients.map(async (recipientId) => {
        // Don't send notification to the sender
        if (recipientId.toString() === sender._id.toString()) {
          return null;
        }

        const user = await User.findById(recipientId).select('recentConversations').lean();
        if (!user) {
          return null;
        }

        const isMuted = user.recentConversations?.find(
          (conv: any) => conv.conversationId.toString() === conversation._id.toString()
        )?.isMuted;

        if (isMuted) {
          return null;
        }

        // This will now schedule a job
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

      await Promise.all(notificationPromises);
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
          const count = await this.getUserUnreadCount(userId);
          return { userId: userId.toString(), count };
        })
      );

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
      const count = await this.getUserUnreadCount(userId);
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
    await this.emitUserUnreadCount(userId);
  }
}

export default NotificationService.getInstance();