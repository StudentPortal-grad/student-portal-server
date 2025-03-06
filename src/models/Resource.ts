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
      rating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
      }
    }
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
  }
};

export default model<IResource>('Resource', ResourceSchema);