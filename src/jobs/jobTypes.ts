import { Types } from 'mongoose';

// Define the structure of the data for the FCM notification job
export interface FcmNotificationJobData {
  tokens: string[];
  notification: {
    title: string;
    body: string;
    imageUrl?: string;
  };
  data?: { [key: string]: string };
}

// Define the structure of the data for the create notification job
export interface CreateNotificationJobData {
  userId: string; // Use string for JSON compatibility
  type: string;
  content: string;
  metadata?: any;
  channel?: 'fcm' | 'socket' | 'in-app' | 'all';
}
