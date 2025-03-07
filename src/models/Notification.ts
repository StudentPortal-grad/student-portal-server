import { Schema, model, Types } from 'mongoose';
import { INotification } from './types';

const NotificationSchema = new Schema<INotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      required: true,
      maxlength: 50,
    },
    content: {
      type: String,
      required: true,
      maxlength: 500,
    },
    status: {
      type: String,
      enum: ['read', 'unread'],
      default: 'unread',
    },
    metadata: {
      event_id: {
        type: Schema.Types.ObjectId,
        ref: 'Event',
      },
    },
  },
  { timestamps: true }
);

// Indexes
NotificationSchema.index({ user_id: 1, status: 1 });
NotificationSchema.index({ timestamp: -1 });

// Methods
NotificationSchema.methods = {
  // Mark as read
  markAsRead: async function (): Promise<void> {
    this.status = 'read';
    await this.save();
  },

  // Add metadata
  addMetadata: async function (key: string, value: any): Promise<void> {
    if (!this.metadata) this.metadata = {};
    this.metadata[key] = value;
    await this.save();
  },
};

// Statics
NotificationSchema.statics = {
  // Find unread notifications
  findUnreadNotifications: function (userId: Types.ObjectId) {
    return this.find({
      user_id: userId,
      status: 'unread',
    }).sort({ timestamp: -1 });
  },

  // Mark all as read
  markAllAsRead: async function (userId: Types.ObjectId): Promise<void> {
    await this.updateMany(
      { user_id: userId, status: 'unread' },
      { status: 'read' }
    );
  },
};

export default model<INotification>('Notification', NotificationSchema);
