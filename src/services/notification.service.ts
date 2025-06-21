import { Types } from 'mongoose';
import { EventsManager } from '@utils/EventsManager';
import { INotification } from '../models/types';
import Notification from '../models/Notification';
import User from '../models/User';
import Conversation from '../models/Conversation';
import Message from '../models/Message';
import { io } from '../config/socket';
import FCMUtils from '../utils/fcmUtils';

class NotificationService {
  private static instance: NotificationService;

  private constructor() {
    // No need to initialize Firebase here as it's handled in FCMUtils
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Create a new notification and deliver it based on user's platform
   */
  public async createNotification(
    userId: Types.ObjectId,
    type: string,
    content: string,
    metadata?: any,
    channel: 'fcm' | 'socket' | 'in-app' | 'all' = 'all'
  ): Promise<INotification> {
    try {
      // Get user's FCM token and platform info
      const user = await User.findById(userId).select('fcmToken metadata.platform').lean();
      
      // Determine delivery method based on user's platform and preferences
      const deliveryMethod = await this.determineDeliveryMethod(user, channel);
      
      // Create notification in database
      const notification = await Notification.create({
        userId,
        type,
        content,
        channel: deliveryMethod,
        metadata: {
          ...metadata,
          fcmToken: user?.fcmToken || null,
          platform: (user as any)?.metadata?.platform || 'web',
          timestamp: new Date(),
        },
      });

      // Deliver notification based on method
      await this.deliverNotification(notification, user, deliveryMethod);

      // Emit event for other services
      EventsManager.emit('notification:created', notification);

      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Determine the best delivery method for a notification
   */
  private async determineDeliveryMethod(user: any, requestedChannel: string): Promise<'fcm' | 'socket' | 'in-app' | 'all'> {
    if (requestedChannel === 'all') {
      // Check if user has FCM token (mobile app)
      if (user?.fcmToken) {
        return 'all'; // Send via both FCM and socket
      }
      
      // Check if user is connected via socket (web)
      const sockets = await io.in(user._id.toString()).fetchSockets();
      if (sockets.length > 0) {
        return 'socket'; // Send via socket only
      }
      
      return 'in-app'; // Store in DB only
    }
    
    return requestedChannel as 'fcm' | 'socket' | 'in-app' | 'all';
  }

  /**
   * Deliver notification based on the determined method
   */
  private async deliverNotification(notification: any, user: any, deliveryMethod: string): Promise<void> {
    try {
      switch (deliveryMethod) {
        case 'fcm':
          if (user?.fcmToken) {
            await this.sendFCMNotification(user.fcmToken, notification);
          }
          break;
          
        case 'socket':
          await this.sendSocketNotification(notification);
          break;
          
        case 'all':
          // Send via both FCM and socket
          const promises = [];
          if (user?.fcmToken) {
            promises.push(this.sendFCMNotification(user.fcmToken, notification));
          }
          promises.push(this.sendSocketNotification(notification));
          await Promise.allSettled(promises);
          break;
          
        case 'in-app':
        default:
          // Only store in database, no immediate delivery
          break;
      }
    } catch (error) {
      console.error('Error delivering notification:', error);
    }
  }

  /**
   * Send FCM notification
   */
  private async sendFCMNotification(fcmToken: string, notification: any): Promise<void> {
    try {
      const title = this.getNotificationTitle(notification.type);
      
      await FCMUtils.sendToToken(fcmToken, {
        title,
        body: notification.content,
        imageUrl: notification.metadata?.imageUrl,
      }, {
        notificationId: notification._id.toString(),
        type: notification.type,
        userId: notification.userId.toString(),
        timestamp: notification.createdAt.toISOString(),
        ...notification.metadata,
      });
      
      console.log(`✅ FCM notification sent to user ${notification.userId}`);
    } catch (error: any) {
      console.error(`❌ Failed to send FCM notification to user ${notification.userId}:`, error);
      
      // If FCM token is invalid, remove it from user
      if (error.code === 'messaging/invalid-registration-token' || 
          error.code === 'messaging/registration-token-not-registered') {
        await User.findByIdAndUpdate(notification.userId, { fcmToken: null });
        console.log(`🗑️ Removed invalid FCM token for user ${notification.userId}`);
      }
    }
  }

  /**
   * Send socket notification
   */
  private async sendSocketNotification(notification: any): Promise<void> {
    try {
      io.to(notification.userId.toString()).emit('notification', notification);
      console.log(`📡 Socket notification sent to user ${notification.userId}`);
    } catch (error) {
      console.error(`❌ Failed to send socket notification to user ${notification.userId}:`, error);
    }
  }

  /**
   * Get notification title based on type
   */
  private getNotificationTitle(type: string): string {
    const titles: { [key: string]: string } = {
      'new_message': 'New Message',
      'message_mention': 'You were mentioned',
      'conversation_invite': 'Conversation Invite',
      'friend_request': 'Friend Request',
      'event_reminder': 'Event Reminder',
      'system_alert': 'System Alert',
      'default': 'Notification'
    };
    
    return titles[type] || titles.default;
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