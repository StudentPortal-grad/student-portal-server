import { messaging } from '../config/firebase';
import { Message, MulticastMessage, BatchResponse, MessagingTopicManagementResponse } from 'firebase-admin/messaging';
import User from '../models/User';

export interface NotificationPayload {
  title: string;
  body: string;
  imageUrl?: string;
  data?: Record<string, string>; // Custom data must be strings
}

export class FCMService {
  // Send to single device
  async sendToDevice(target: string, notification: NotificationPayload): Promise<string> {
    const message: Message = {
      token: target,
      notification: {
        title: notification.title,
        body: notification.body,
        imageUrl: notification.imageUrl,
      },
      // data: notification.data,
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    };

    try {
      const response = await messaging.send(message);
      console.log('Successfully sent message:', response);
      return response;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  // Send to multiple devices
  async sendToMultipleDevices(tokens: string[], notification: NotificationPayload): Promise<BatchResponse> {
    const message: MulticastMessage = {
      tokens,
      notification: {
        title: notification.title,
        body: notification.body,
        imageUrl: notification.imageUrl,
      },
      // data: notification.data,
      android: {
        priority: 'high',
      },
    };

    try {
      const response = await messaging.sendEachForMulticast(message);
      console.log(`Successfully sent ${response.successCount} messages`);

      if (response.failureCount > 0) {
        const failedTokens: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            failedTokens.push(tokens[idx]);
            console.error('Failed to send to token:', tokens[idx], resp.error);
          }
        });
        // TODO: Handle failed tokens
        // await this.handleFailedTokens(failedTokens);
      }

      return response;
    } catch (error) {
      console.error('Error sending multicast message:', error);
      throw error;
    }
  }

  // Send to topic
  async sendToTopic(topic: string, notification: NotificationPayload): Promise<string> {
    const message: Message = {
      topic,
      notification: {
        title: notification.title,
        body: notification.body,
        imageUrl: notification.imageUrl,
      },
      data: notification.data,
    };

    return await messaging.send(message);
  }

  // Subscribe tokens to topic
  async subscribeToTopic(tokens: string[], topic: string): Promise<MessagingTopicManagementResponse> {
    try {
      const response = await messaging.subscribeToTopic(tokens, topic);
      console.log('Successfully subscribed to topic:', response);
      return response;
    } catch (error) {
      console.error('Error subscribing to topic:', error);
      throw error;
    }
  }

  async unsubscribeFromTopic(tokens: string[], topic: string): Promise<MessagingTopicManagementResponse> {
    try {
      const response = await messaging.unsubscribeFromTopic(tokens, topic);
      console.log(`Successfully unsubscribed from topic:`, response);
      return response;
    } catch (error) {
      console.error('Error unsubscribing from topic', error);
      throw error;
    }
  }

  async validateToken(token: string): Promise<boolean> {
    try {
      await messaging.send({ token }, true); // Dry run
      return true;
    } catch (error) {
      console.warn(`Invalid FCM token: ${token}`, error);
      return false;
    }
  }

  // Handle failed/invalid tokens
  private async handleFailedTokens(failedTokens: string[]): Promise<void> {
    console.log('Removing failed tokens:', failedTokens);
    await User.updateMany({ fcmToken: { $in: failedTokens } }, { $set: { fcmToken: null } });
  }
}

export const fcmService = new FCMService();
