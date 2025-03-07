import { Schema, model, Types } from 'mongoose';
import { IRSVP } from './types';

const RSVPSchema = new Schema<IRSVP>(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'Users',
      required: true,
    },
    status: {
      type: String,
      enum: ['attending', 'not_attending', 'interested'],
      default: 'interested',
    },
  },
  {
    timestamps: true,
  }
);

// Methods
RSVPSchema.methods = {
  updateStatus: async function (
    newStatus: 'attending' | 'not_attending' | 'interested'
  ) {
    this.status = newStatus;
    await this.save();
  },
};

// Statics
RSVPSchema.statics = {
  findUserEvents: function (userId: Types.ObjectId) {
    return this.find({ userId, status: 'attending' })
      .populate('eventId')
      .sort({ 'eventId.dateTime': 1 });
  },

  getEventAttendees: function (eventId: Types.ObjectId) {
    return this.find({ eventId, status: 'attending' }).populate(
      'userId',
      'name profilePicture'
    );
  },
};

// Compound index to ensure unique RSVP per user per event
RSVPSchema.index({ eventId: 1, userId: 1 }, { unique: true });

export default model<IRSVP>('RSVP', RSVPSchema);
