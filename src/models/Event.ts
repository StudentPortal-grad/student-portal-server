import { Schema, model, Types } from 'mongoose';
import { IEvent } from './types';

const EventSchema = new Schema<IEvent>(
  {
    title: {
      type: String,
      required: true,
      maxlength: 255,
    },
    description: {
      type: String,
      maxlength: 1000,
    },
    dateTime: {
      type: Date,
      required: true,
    },
    location: {
      type: String,
      maxlength: 255,
    },
    capacity: {
      type: Number,
      min: 1,
      max: 2147483647, // 32-bit integer max
    },
    visibility: {
      type: String,
      enum: ['public', 'private', 'community'],
      default: 'public',
    },
    attendees: [
      {
        type: Schema.Types.ObjectId,
        ref: 'RSVP',
      },
    ],
    creatorId: {
      type: Schema.Types.ObjectId,
      ref: 'Users',
      required: true,
    },
    status: {
      type: String,
      enum: ['upcoming', 'ongoing', 'completed', 'cancelled'],
      default: 'upcoming',
    },
    recommendations: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Event',
      },
    ],
    communityId: {
      type: Schema.Types.ObjectId,
      ref: 'Community',
      required: function (this: IEvent) {
        return this.visibility === 'community';
      },
    },
  },
  {
    timestamps: true,
  }
);

// Methods
EventSchema.methods = {
  isAtCapacity: function (): boolean {
    return this.capacity ? this.attendees?.length >= this.capacity : false;
  },

  updateStatus: async function (): Promise<void> {
    const now = new Date();
    if (this.dateTime > now && this.status !== 'cancelled') {
      this.status = 'upcoming';
    } else if (this.dateTime <= now && this.status === 'upcoming') {
      this.status = 'ongoing';
    }
    await this.save();
  },
};

// Statics
EventSchema.statics = {
  findUpcoming: function () {
    return this.find({
      status: 'upcoming',
      dateTime: { $gt: new Date() },
    }).sort({ dateTime: 1 });
  },

  findByCommunity: function (communityId: Types.ObjectId) {
    return this.find({
      communityId,
      status: { $in: ['upcoming', 'ongoing'] },
    });
  },
};

// Indexes
EventSchema.index({ dateTime: 1, status: 1 });
EventSchema.index({ communityId: 1, status: 1 });

export default model<IEvent>('Event', EventSchema);
