import admin from 'firebase-admin';
import { Types } from 'mongoose';

interface FCMNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
}

interface FCMDataPayload {
  [key: string]: string;
}

class FCMUtils {
  private static instance: FCMUtils;
  private messaging: admin.messaging.Messaging;

  private constructor() {
    // Initialize Firebase Admin if not already initialized
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: process.env.FIREBASE_PROJECT_ID,
      });
    }
    this.messaging = admin.messaging();
  }

  public static getInstance(): FCMUtils {
    if (!FCMUtils.instance) {
      FCMUtils.instance = new FCMUtils();
    }
    return FCMUtils.instance;
  }

  /**
   * Send notification to a single FCM token
   */
  async sendToToken(
    token: string,
    notification: FCMNotificationPayload,
    data?: FCMDataPayload
  ): Promise<string> {
    try {
      const message: admin.messaging.Message = {
        token,
        notification: {
          title: notification.title,
          body: notification.body,
          imageUrl: notification.imageUrl,
        },
        data: data || {},
        android: {
          priority: 'high',
          notification: {
            channelId: 'default',
            priority: 'high',
            defaultSound: true,
            defaultVibrateTimings: true,
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
        webpush: {
          headers: {
            Urgency: 'high',
          },
          notification: {
            requireInteraction: true,
          },
        },
      };

      const response = await this.messaging.send(message);
      console.log(`✅ FCM notification sent successfully: ${response}`);
      return response;
    } catch (error) {
      console.error('❌ Error sending FCM notification:', error);
      throw error;
    }
  }

  /**
   * Send notification to multiple FCM tokens
   */
  async sendToTokens(
    tokens: string[],
    notification: FCMNotificationPayload,
    data?: FCMDataPayload
  ): Promise<any> {
    try {
      // Send to each token individually since sendMulticast might not be available
      const promises = tokens.map(token => 
        this.sendToToken(token, notification, data).catch(error => ({
          success: false,
          error,
          token
        }))
      );
      
      const results = await Promise.allSettled(promises);
      const successful = results.filter(result => 
        result.status === 'fulfilled' && typeof result.value === 'string'
      ).length;
      
      console.log(`✅ FCM batch sent: ${successful}/${tokens.length} successful`);
      
      return {
        successCount: successful,
        failureCount: tokens.length - successful,
        responses: results
      };
    } catch (error) {
      console.error('❌ Error sending FCM batch:', error);
      throw error;
    }
  }

  /**
   * Send notification to a topic
   */
  async sendToTopic(
    topic: string,
    notification: FCMNotificationPayload,
    data?: FCMDataPayload
  ): Promise<string> {
    try {
      const message: admin.messaging.Message = {
        topic,
        notification: {
          title: notification.title,
          body: notification.body,
          imageUrl: notification.imageUrl,
        },
        data: data || {},
      };

      const response = await this.messaging.send(message);
      console.log(`✅ FCM topic notification sent successfully: ${response}`);
      return response;
    } catch (error) {
      console.error('❌ Error sending FCM topic notification:', error);
      throw error;
    }
  }

  /**
   * Subscribe tokens to a topic
   */
  async subscribeToTopic(tokens: string[], topic: string): Promise<any> {
    try {
      const response = await this.messaging.subscribeToTopic(tokens, topic);
      console.log(`✅ Subscribed ${response.successCount}/${tokens.length} tokens to topic: ${topic}`);
      return response;
    } catch (error) {
      console.error('❌ Error subscribing to topic:', error);
      throw error;
    }
  }

  /**
   * Unsubscribe tokens from a topic
   */
  async unsubscribeFromTopic(tokens: string[], topic: string): Promise<any> {
    try {
      const response = await this.messaging.unsubscribeFromTopic(tokens, topic);
      console.log(`✅ Unsubscribed ${response.successCount}/${tokens.length} tokens from topic: ${topic}`);
      return response;
    } catch (error) {
      console.error('❌ Error unsubscribing from topic:', error);
      throw error;
    }
  }

  /**
   * Validate FCM token
   */
  async validateToken(token: string): Promise<boolean> {
    try {
      // Try to send a test message to validate the token
      const message: admin.messaging.Message = {
        token,
        data: {
          test: 'validation',
        },
      };
      
      await this.messaging.send(message);
      return true;
    } catch (error: any) {
      if (error.code === 'messaging/invalid-registration-token' || 
          error.code === 'messaging/registration-token-not-registered') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Clean up invalid tokens
   */
  async cleanupInvalidTokens(tokens: string[]): Promise<string[]> {
    const validTokens: string[] = [];
    
    for (const token of tokens) {
      try {
        const isValid = await this.validateToken(token);
        if (isValid) {
          validTokens.push(token);
        }
      } catch (error) {
        console.error(`Error validating token: ${error}`);
      }
    }
    
    return validTokens;
  }
}

export default FCMUtils.getInstance(); 