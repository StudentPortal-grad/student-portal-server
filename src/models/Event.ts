import { Schema, model, Types } from 'mongoose';
import { IEvent, IEventDocument } from '../interfaces/event.interface';

const EventSchema = new Schema<IEventDocument>(
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
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    location: {
      type: String,
      maxlength: 255,
    },
    eventImage: {
      type: String,
      default: '',
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
    attendees: [{
      type: Schema.Types.ObjectId,
      ref: 'Users'
    }],
    rsvps: [{
      userId: {
        type: Schema.Types.ObjectId,
        ref: 'Users',
        required: true
      },
      status: {
        type: String,
        enum: ['attending', 'not_attending', 'interested'],
        required: true
      },
      updatedAt: {
        type: Date,
        default: Date.now
      }
    }],
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
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true,
  }
);

// Methods
EventSchema.methods = {
  isAtCapacity: function (this: IEventDocument): boolean {
    return this.capacity ? this.attendees?.length >= this.capacity : false;
  },

  updateStatus: async function (this: IEventDocument): Promise<void> {
    const now = new Date();
    if (this.startDate > now && this.status !== 'cancelled') {
      this.status = 'upcoming';
    } else if (this.startDate <= now && this.status === 'upcoming') {
      this.status = 'ongoing';
    }
    await this.save();
  },

  addRating: async function (this: IEventDocument, _userId: Types.ObjectId, _rating: number): Promise<IEventDocument> {
    // Implementation
    return this;
  },

  addComment: async function (this: IEventDocument, _userId: Types.ObjectId, _content: string): Promise<IEventDocument> {
    // Implementation
    return this;
  },

  getAverageRating: function (this: IEventDocument): number {
    // Implementation
    return 0;
  }
};

// Statics
EventSchema.statics = {
  findUpcoming: function () {
    return this.find({
      status: 'upcoming',
      startDate: { $gt: new Date() },
    }).sort({ startDate: 1 });
  },

  findByCommunity: function (communityId: Types.ObjectId) {
    return this.find({
      communityId,
      status: { $in: ['upcoming', 'ongoing'] },
    });
  },
};

// Indexes
EventSchema.index({ startDate: 1, status: 1 });
EventSchema.index({ communityId: 1, status: 1 });

export default model<IEventDocument>('Event', EventSchema);
