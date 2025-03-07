import { Schema, model, Types } from 'mongoose';
import { IMessage } from './types';

interface IAttachment {
  type: string;
  resource?: string;
  thread?: Types.ObjectId;
}

const MessageSchema = new Schema<IMessage>(
  {
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'Users',
      required: true,
    },
    content: {
      type: String,
    },
    attachments: [
      {
        _id: false,
        type: {
          type: String,
          enum: ['document', 'file', 'poll', 'thread'],
        },
        resource: String,
        thread: {
          type: Schema.Types.ObjectId,
          ref: 'Conversation',
        },
      },
    ],
    status: {
      type: String,
      enum: ['sent', 'delivered', 'read'],
      default: 'sent',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Indexes
MessageSchema.index({ senderId: 1 });
MessageSchema.index({ 'attachments.thread': 1 });

// Validate that either content or attachments are present
MessageSchema.pre('save', function (next) {
  if (!this.content && (!this.attachments || this.attachments.length === 0)) {
    next(new Error('Message must have either content or attachments'));
  }
  next();
});

// Methods
MessageSchema.methods = {
  // Mark as read
  markAsRead: async function (): Promise<void> {
    this.status = 'read';
    await this.save();
  },

  // Add thread reply
  addThreadReply: async function (
    conversationId: Types.ObjectId
  ): Promise<void> {
    if (!this.attachments) this.attachments = [];
    this.attachments.push({
      type: 'thread',
      thread: conversationId,
    });
    await this.save();
  },

  // Check if message has thread
  hasThread: function (): boolean {
    return (
      this.attachments?.some((att: IAttachment) => att.type === 'thread') ||
      false
    );
  },
};

// Statics
MessageSchema.statics = {
  // Find unread messages for user
  findUnreadMessages: function (userId: Types.ObjectId) {
    return this.find({
      senderId: userId,
      status: { $ne: 'read' },
    });
  },
};

export default model<IMessage>('Message', MessageSchema);
