import { Document, Types } from 'mongoose';

export interface IReply {
  _id?: Types.ObjectId;
  content: string;
  author: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  likes: Types.ObjectId[];
}

export interface IDiscussion {
  _id?: Types.ObjectId;
  title: string;
  content: string;
  author: Types.ObjectId;
  creator: Types.ObjectId;
  community: Types.ObjectId;
  isPinned: boolean;
  attachments: string[];
  tags: string[];
  replies: IReply[];
  likes: Types.ObjectId[];
  views: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDiscussionDocument extends IDiscussion, Document {
  _id: Types.ObjectId;
  addReply(reply: IReply): Promise<IDiscussionDocument>;
  removeReply(replyId: Types.ObjectId): Promise<IDiscussionDocument>;
  toggleLike(userId: Types.ObjectId): Promise<IDiscussionDocument>;
  incrementViews(): Promise<IDiscussionDocument>;
} 