import { Document, Types } from 'mongoose';

interface RSVP {
  userId: Types.ObjectId;
  status: 'attending' | 'not_attending' | 'interested';
  updatedAt: Date;
}

export interface IEvent {
  _id?: Types.ObjectId;
  title: string;
  description: string;
  startDate: Date;
  endDate: Date;
  location: string;
  capacity?: number;
  creatorId: Types.ObjectId;
  attendees: Types.ObjectId[];
  rsvps: RSVP[];
  visibility: 'public' | 'private' | 'community';
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  recommendations?: Types.ObjectId[];
  communityId?: Types.ObjectId;
  eventImage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IEventDocument extends IEvent, Document {
  _id: Types.ObjectId;
  addRating(userId: Types.ObjectId, rating: number): Promise<IEventDocument>;
  addComment(userId: Types.ObjectId, content: string): Promise<IEventDocument>;
  getAverageRating(): number;
  isAtCapacity(): boolean;
  updateStatus(): Promise<void>;
} 