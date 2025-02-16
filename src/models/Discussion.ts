import mongoose, { Schema, Document } from 'mongoose';

export interface IDiscussion extends Document {
  communityId: mongoose.Schema.Types.ObjectId; // Reference to the community
  title: string;
  content: string;
  creator: mongoose.Schema.Types.ObjectId; // Reference to the user who created the discussion
  attachments: Array<{
    type: string; // Enum: 'document', 'file', 'poll', etc.
    resource: string; 
  }>;
  replies: Array<{
    id: mongoose.Schema.Types.ObjectId;
    content: string;
    creator: mongoose.Schema.Types.ObjectId; // Reference to the user who replied
    createdAt: Date;
    attachments: Array<{
      type: string; // Enum: 'document', 'file', etc.
      resource: string; 
    }>;
  }>;
  votes: Array<{
    userId: mongoose.Schema.Types.ObjectId; // Reference to the user who voted
    voteType: string; // Enum: 'upvote', 'downvote'
    createdAt: Date;
  }>;
  status: string; // Enum: 'open', 'closed', 'archived'
  createdAt: Date;
  updatedAt: Date;
}

const DiscussionSchema: Schema = new Schema(
  {
    communityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Community', required: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    attachments: [
      {
        type: { type: String, required: true },
        resource: { type: String, required: true },
      },
    ],
    replies: [
      {
        id: { type: mongoose.Schema.Types.ObjectId, required: true },
        content: { type: String, required: true },
        creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        createdAt: { type: Date, default: Date.now },
        attachments: [
          {
            type: { type: String, required: true },
            resource: { type: String, required: true },
          },
        ],
      },
    ],
    votes: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        voteType: { type: String, enum: ['upvote', 'downvote'], required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    status: { type: String, enum: ['open', 'closed', 'archived'], default: 'open' },
  },
  { timestamps: true }
);

export default mongoose.model<IDiscussion>('Discussion', DiscussionSchema);