import { Schema, model, Types } from 'mongoose';
import { IConversation } from './types';

const ConversationSchema = new Schema<IConversation>(
  {
    type: {
      type: String,
      required: true,
      enum: ['DM', 'GroupDM'],
    },
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Users',
        required: true,
      },
    ],
    name: {
      type: String,
      maxlength: 255,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'Users',
      required: true,
    },
    messages: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Message',
      },
    ],
    inviteLink: {
      type: String,
      maxlength: 500,
    },
    status: {
      type: String,
      enum: ['active', 'archived'],
      default: 'active',
    },
    groupImage: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
ConversationSchema.index({ participants: 1 });
ConversationSchema.index({ type: 1 });

// Validate minimum participants for GroupDM
ConversationSchema.pre('save', function (next) {
  if (this.type === 'GroupDM' && this.participants.length < 2) {
    next(new Error('GroupDM must have at least 2 participants'));
  }
  next();
});

// Methods
ConversationSchema.methods = {
  // Add participant
  addParticipant: async function (userId: Types.ObjectId): Promise<void> {
    if (this.type === 'GroupDM' && !this.participants.includes(userId)) {
      this.participants.push(userId);
      await this.save();
    }
  },

  // Remove participant
  removeParticipant: async function (userId: Types.ObjectId): Promise<void> {
    if (this.type === 'GroupDM') {
      this.participants = this.participants.filter(
        (id: Types.ObjectId) => !id.equals(userId)
      );
      await this.save();
    }
  },

  // Add message
  addMessage: async function (messageId: Types.ObjectId): Promise<void> {
    if (!this.messages) this.messages = [];
    this.messages.push(messageId);
    await this.save();
  },

  // Generate invite link for group
  generateInviteLink: async function (): Promise<string | null> {
    if (this.type === 'GroupDM') {
      const uniqueId = new Types.ObjectId().toString();
      this.inviteLink = `https://studentportal.com/chat/join/${uniqueId}`;
      await this.save();
      return this.inviteLink;
    }
    return null;
  },
};

// Statics
ConversationSchema.statics = {
  // Find or create DM conversation
  findOrCreateDM: async function (
    participant1Id: Types.ObjectId,
    participant2Id: Types.ObjectId
  ) {
    let conversation = await this.findOne({
      type: 'DM',
      participants: { $all: [participant1Id, participant2Id] },
    });

    if (!conversation) {
      conversation = await this.create({
        type: 'DM',
        participants: [participant1Id, participant2Id],
        createdBy: participant1Id,
      });
    }

    return conversation;
  },
};

export default model<IConversation>('Conversation', ConversationSchema);
