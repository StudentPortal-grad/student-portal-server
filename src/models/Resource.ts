import { Schema, model, Types } from 'mongoose';
import { IResource } from './types';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB limit

interface IVote {
  userId: Types.ObjectId;
  voteType: 'upvote' | 'downvote';
  createdAt: Date;
}

interface IReport {
  userId: Types.ObjectId;
  reason: string;
  createdAt: Date;
}

const ResourceSchema = new Schema<IResource>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255
    },
    description: {
      type: String,
      maxlength: 1000
    },
    fileUrl: {
      type: String,
      required: true,
      validate: {
        validator: function(v: string) {
          return /^https?:\/\/.+/.test(v);
        },
        message: 'File URL must be a valid URL'
      }
    },
    fileType: {
      type: String,
      enum: ['document', 'image', 'video', 'audio', 'other'],
      required: true
    },
    mimeType: {
      type: String,
      required: true
    },
    originalFileName: {
      type: String,
      required: true
    },
    checksum: {
      type: String,
      required: true
    },
    fileSize: {
      type: Number,
      required: true,
      min: 0,
      max: MAX_FILE_SIZE,
      validate: {
        validator: function(v: number) {
          return v <= MAX_FILE_SIZE;
        },
        message: 'File size exceeds maximum allowed limit of 100MB'
      }
    },
    tags: [{
      type: String,
      trim: true
    }],
    visibility: {
      type: String,
      enum: ['public', 'community', 'private'],
      default: 'community'
    },
    category: {
      type: String,
      required: true,
      trim: true
    },
    uploader: {
      type: Schema.Types.ObjectId,
      ref: 'Users',
      required: true
    },
    community: {
      type: Schema.Types.ObjectId,
      ref: 'Community',
      required: false
    },
    interactionStats: {
      downloads: {
        type: Number,
        default: 0
      },
      views: {
        type: Number,
        default: 0
      }
    },
    votes: [
      {
        _id: false,
        userId: {
          type: Schema.Types.ObjectId,
          ref: 'Users',
        },
        voteType: {
          type: String,
          enum: ['upvote', 'downvote'],
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    reports: [{
      _id: false,
      userId: {
        type: Schema.Types.ObjectId,
        ref: 'Users',
        required: true
      },
      reason: {
        type: String,
        required: true,
        maxlength: 500
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }],
    comments: [{
      userId: {
        type: Schema.Types.ObjectId,
        ref: 'Users',
        required: true
      },
      content: {
        type: String,
        required: true,
        maxlength: 500
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }]
  },
  {
    timestamps: true
  }
);

// Virtual properties for vote counts
ResourceSchema.virtual('upvotesCount').get(function(this: IResource) {
  if (this.votes && Array.isArray(this.votes)) {
    return this.votes.filter((v: { voteType: string }) => v.voteType === 'upvote').length;
  }
  return 0;
});

ResourceSchema.virtual('downvotesCount').get(function(this: IResource) {
  if (this.votes && Array.isArray(this.votes)) {
    return this.votes.filter((v: { voteType: string }) => v.voteType === 'downvote').length;
  }
  return 0;
});

// Ensure virtuals are included in toJSON and toObject outputs
ResourceSchema.set('toJSON', { virtuals: true });
ResourceSchema.set('toObject', { virtuals: true });


// Indexes for better query performance
ResourceSchema.index({ title: 'text', description: 'text' });

// Methods
ResourceSchema.methods = {
  isAccessibleBy(userId: Types.ObjectId, userCommunities: Types.ObjectId[]): boolean {
    if (this.visibility === 'public') return true;
    if (this.uploader.equals(userId)) return true;
    if (this.visibility === 'community') {
      return userCommunities.some(communityId => 
        this.community.equals(communityId)
      );
    }
    return false;
  },

  async incrementDownloads(): Promise<void> {
    this.interactionStats.downloads += 1;
    await this.save();
  },

  async incrementViews(): Promise<void> {
    this.interactionStats.views += 1;
    await this.save();
  },

  async vote(userId: Types.ObjectId, voteType: 'upvote' | 'downvote'): Promise<void> {
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

  async addComment(userId: Types.ObjectId, content: string): Promise<void> {
    this.comments.push({ userId, content });
    await this.save();
  },

  async report(this: IResource, userId: Types.ObjectId, reason: string): Promise<void> {
    const existingReport = this.reports.find((r: IReport) => r.userId.equals(userId));
    if (existingReport) {
      return;
    }
    this.reports.push({ userId, reason, createdAt: new Date() });
    await this.save();
  }
};

export default model<IResource>('Resource', ResourceSchema);