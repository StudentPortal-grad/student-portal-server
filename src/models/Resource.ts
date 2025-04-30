import { Schema, model, Types } from 'mongoose';
import { IResource } from './types';

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
    fileSize: {
      type: Number,
      required: true,
      min: 0
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
      ref: 'User',
      required: true
    },
    community: {
      type: Schema.Types.ObjectId,
      ref: 'Community',
      required: true
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
    ratings: [{
      userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }],
    comments: [{
      userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
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

  async addRating(userId: Types.ObjectId, rating: number): Promise<void> {
    // Remove existing rating by this user if it exists
    const existingRatingIndex = this.ratings.findIndex((r: { userId: Types.ObjectId }) => 
      r.userId.toString() === userId.toString()
    );
    
    if (existingRatingIndex !== -1) {
      this.ratings.splice(existingRatingIndex, 1);
    }
    
    // Add new rating
    this.ratings.push({ userId, rating });
    await this.save();
  },

  async addComment(userId: Types.ObjectId, content: string): Promise<void> {
    this.comments.push({ userId, content });
    await this.save();
  },

  getAverageRating(): number {
    if (this.ratings.length === 0) return 0;
    
    const sum = this.ratings.reduce((acc: number, curr: { rating: number }) => acc + curr.rating, 0);
    return parseFloat((sum / this.ratings.length).toFixed(1));
  }
};

export default model<IResource>('Resource', ResourceSchema);