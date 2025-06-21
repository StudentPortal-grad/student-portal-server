import { Schema, model, Types } from 'mongoose';
import { IDiscussion, IReply, IVote, IReport } from './types';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB limit

// Embedded Schemas
const AttachmentSchema = new Schema({
  type: {
    type: String,
    enum: ['document', 'image', 'video', 'audio', 'pdf', 'other', 'poll'],
    required: true,
  },
  resource: {
    type: String,
    required: true,
    validate: {
      validator: (v: string) => /^https?:\/\/.+/.test(v),
      message: 'Resource must be a valid URL',
    },
  },
  mimeType: { type: String, required: true },
  originalFileName: { type: String, required: true },
  fileSize: {
    type: Number,
    required: true,
    min: 0,
    max: MAX_FILE_SIZE,
    validate: {
      validator: (v: number) => v <= MAX_FILE_SIZE,
      message: `File size exceeds maximum allowed limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    },
  },
  checksum: { type: String, required: true },
}, { _id: false });

const VoteSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'Users', required: true },
  voteType: { type: String, enum: ['upvote', 'downvote'], required: true },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const ReportSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'Users', required: true },
  reason: { type: String, required: true, maxlength: 500 },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

// Recursive Reply Schema
const ReplySchema = new Schema<IReply>(
  {
    content: { type: String, required: true },
    creator: { type: Schema.Types.ObjectId, ref: 'Users', required: true },
    attachments: [AttachmentSchema],
    votes: [VoteSchema],
    reports: [ReportSchema],
  },
  { timestamps: true }
);

ReplySchema.add({ replies: [ReplySchema] });

// Virtuals for reply vote counts
ReplySchema.virtual('upvotesCount').get(function (this: IReply) {
  return this.votes.filter((v: IVote) => v.voteType === 'upvote').length;
});

ReplySchema.virtual('downvotesCount').get(function (this: IReply) {
  return this.votes.filter((v: IVote) => v.voteType === 'downvote').length;
});

ReplySchema.set('toJSON', { virtuals: true });
ReplySchema.set('toObject', { virtuals: true });

// Methods for voting and reporting on replies
ReplySchema.methods.vote = async function (userId: Types.ObjectId, voteType: 'upvote' | 'downvote') {
  const existingVote = this.votes.find((v: IVote) => v.userId.equals(userId));

  if (existingVote) {
    if (existingVote.voteType === voteType) {
      this.votes.pull(existingVote._id);
    } else {
      existingVote.voteType = voteType;
      existingVote.createdAt = new Date();
    }
  } else {
    this.votes.push({ userId, voteType, createdAt: new Date() });
  }

  // Note: Since this is a subdocument, saving is handled at the parent level.
  // The caller of this method will need to save the parent Discussion document.
  return this.ownerDocument().save();
};

ReplySchema.methods.report = async function (userId: Types.ObjectId, reason: string) {
  const existingReport = this.reports.find((r: IReport) => r.userId.equals(userId));

  if (existingReport) {
    return; // User has already reported this reply
  }

  this.reports.push({ userId, reason, createdAt: new Date() });

  return this.ownerDocument().save();
};

// Main Discussion Schema
const DiscussionSchema = new Schema<IDiscussion>(
  {
    communityId: { type: Schema.Types.ObjectId, ref: 'Community' },
    title: { type: String, required: true, maxlength: 255, trim: true },
    content: { type: String, required: true },
    creator: { type: Schema.Types.ObjectId, ref: 'Users', required: true },
    attachments: [AttachmentSchema],
    replies: [ReplySchema],
    votes: [VoteSchema],
    status: { type: String, enum: ['open', 'closed', 'archived'], default: 'open' },
    reports: [ReportSchema],
    isPinned: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual properties for vote counts
DiscussionSchema.virtual('upvotesCount').get(function (this: IDiscussion) {
  if (this.votes && Array.isArray(this.votes)) {
    return this.votes.filter((v: IVote) => v.voteType === 'upvote').length;
  }
  return 0;
});

DiscussionSchema.virtual('downvotesCount').get(function (this: IDiscussion) {
  if (this.votes && Array.isArray(this.votes)) {
    return this.votes.filter((v: IVote) => v.voteType === 'downvote').length;
  }
  return 0;
});

// Ensure virtuals are included in toJSON and toObject outputs
DiscussionSchema.set('toJSON', { virtuals: true });
DiscussionSchema.set('toObject', { virtuals: true });

// Indexes
DiscussionSchema.index({ communityId: 1, createdAt: -1 });
DiscussionSchema.index({ creator: 1 });
DiscussionSchema.index({ status: 1 });
DiscussionSchema.index({ title: 'text', content: 'text' });

// Methods
DiscussionSchema.methods = {
  // Add a reply
  addReply: async function (
    content: string,
    creator: Types.ObjectId,
    attachments: any[] = []
  ) {
    if (this.status === 'archived') {
      throw new Error('Cannot reply to archived discussion');
    }

    this.replies.push({
      content,
      creator,
      attachments,
      createdAt: new Date(),
    });

    await this.save();
    return this.replies[this.replies.length - 1];
  },

  // Add or update vote
  vote: async function (
    userId: Types.ObjectId,
    voteType: 'upvote' | 'downvote'
  ) {
    const existingVote = this.votes.find((v: IVote) => v.userId.equals(userId));

    if (existingVote) {
      if (existingVote.voteType === voteType) {
        // Remove vote if same type (toggle)
        this.votes = this.votes.filter((v: IVote) => !v.userId.equals(userId));
      } else {
        // Update vote type
        existingVote.voteType = voteType;
        existingVote.createdAt = new Date();
      }
    } else {
      // Add new vote
      this.votes.push({
        userId,
        voteType,
        createdAt: new Date(),
      });
    }

    await this.save();
  },

  report: async function (
    this: IDiscussion,
    userId: Types.ObjectId,
    reason: string
  ): Promise<void> {
    const existingReport = this.reports.find((r: IReport) => r.userId.equals(userId));
    if (existingReport) {
      return;
    }
    this.reports.push({ userId, reason, createdAt: new Date() });
    await this.save();
  },

  // Get vote counts
  getVoteCounts: function (this: IDiscussion) {
    return {
      upvotes: this.votes.filter((v: IVote) => v.voteType === 'upvote').length,
      downvotes: this.votes.filter((v: IVote) => v.voteType === 'downvote')
        .length,
    };
  },
};

// Statics
interface SearchQuery {
  $text: { $search: string };
  communityId?: Types.ObjectId;
}

DiscussionSchema.statics = {
  // Find trending discussions
  findTrending: function (communityId: Types.ObjectId, limit = 10) {
    return this.aggregate([
      { $match: { communityId, status: 'open' } },
      {
        $addFields: {
          score: {
            $subtract: [
              {
                $size: {
                  $filter: {
                    input: '$votes',
                    cond: { $eq: ['$$this.voteType', 'upvote'] },
                  },
                },
              },
              {
                $size: {
                  $filter: {
                    input: '$votes',
                    cond: { $eq: ['$$this.voteType', 'downvote'] },
                  },
                },
              },
            ],
          },
        },
      },
      { $sort: { score: -1, createdAt: -1 } },
      { $limit: limit },
    ]);
  },

  // Search discussions
  search: function (query: string, communityId?: Types.ObjectId) {
    const searchQuery: SearchQuery = { $text: { $search: query } };
    if (communityId) {
      searchQuery.communityId = communityId;
    }
    return this.find(searchQuery)
      .select('title content creator createdAt')
      .populate('creator', 'name');
  },
};

export default model<IDiscussion>('Discussion', DiscussionSchema);
