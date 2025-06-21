import Agenda, { Job } from 'agenda';
import { fcmService, NotificationPayload } from '../services/fcm.service';
import { Types } from 'mongoose';
import Notification from '../models/Notification';
import User from '../models/User';
import { io } from '../config/socket';
import { EventsManager } from '../utils/EventsManager';
import notificationService from '../services/notification.service';
import { FcmNotificationJobData, CreateNotificationJobData } from './jobTypes';

/**
 * Defines the notification jobs for Agenda.
 * @param agenda - The Agenda instance.
 */
export const defineNotificationJobs = (agenda: Agenda) => {
  // Job to send a pre-formatted FCM notification
  agenda.define<FcmNotificationJobData>('send-fcm-notification', async (job: Job<FcmNotificationJobData>) => {
    const { tokens, notification, data } = job.attrs.data;
    if (!tokens || tokens.length === 0) {
      console.warn('[agenda]: No tokens provided for FCM notification job.');
      return;
    }
    try {
      console.log(`[agenda]: Processing job 'send-fcm-notification' for ${tokens.length} tokens.`);
      const payload: NotificationPayload = { ...notification, data };
      await fcmService.sendToMultipleDevices(tokens, payload);
      console.log(`[agenda]: Successfully processed job 'send-fcm-notification'.`);
    } catch (error) {
      console.error(`[agenda]: Error processing 'send-fcm-notification' job:`, error);
      throw error;
    }
  });

  // Job to create a notification record and deliver it
  agenda.define<CreateNotificationJobData>('create-and-deliver-notification', async (job: Job<CreateNotificationJobData>) => {
    const { userId, type, content, metadata, channel = 'all' } = job.attrs.data;
    const userObjectId = new Types.ObjectId(userId);

    try {
      console.log(`[agenda]: Processing 'create-and-deliver-notification' for user ${userId}`);
      const user = await User.findById(userObjectId).select('fcmToken metadata.platform').lean();

      let deliveryMethod: 'fcm' | 'socket' | 'in-app' | 'all' = 'in-app';
      if (channel === 'all') {
        if (user?.fcmToken) {
          deliveryMethod = 'all';
        } else {
          const sockets = await io.in(userObjectId.toString()).fetchSockets();
          if (sockets.length > 0) {
            deliveryMethod = 'socket';
          }
        }
      } else {
        deliveryMethod = channel;
      }

      const notification = await Notification.create({
        userId: userObjectId,
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

      // Deliver notification using the service methods
      switch (deliveryMethod) {
        case 'fcm':
          if (user?.fcmToken) await notificationService.sendFCMNotification(user.fcmToken, notification);
          break;
        case 'socket':
          await notificationService.sendSocketNotification(notification);
          break;
        case 'all':
          const promises = [];
          if (user?.fcmToken) promises.push(notificationService.sendFCMNotification(user.fcmToken, notification));
          promises.push(notificationService.sendSocketNotification(notification));
          await Promise.allSettled(promises);
          break;
      }

      EventsManager.emit('notification:created', notification);
      console.log(`[agenda]: Successfully processed 'create-and-deliver-notification' for user ${userId}`);
    } catch (error) {
      console.error(`[agenda]: Error in 'create-and-deliver-notification' job:`, error);
      throw error;
    }
  });
};
