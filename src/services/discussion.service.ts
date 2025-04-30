import { DiscussionRepository } from '../repositories/discussion.repo';
import Discussion from '../models/Discussion';
import { Types, Document } from 'mongoose';
import { AppError, ErrorCodes } from '@utils/appError';

// Define the IDiscussion interface based on the model
interface IDiscussion extends Document {
  communityId: Types.ObjectId;
  title: string;
  content: string;
  creator: Types.ObjectId;
  attachments: Array<{
    type: string;
    resource: string;
  }>;
  replies: Array<{
    id: Types.ObjectId;
    content: string;
    creator: Types.ObjectId;
    createdAt: Date;
    attachments: Array<{
      type: string;
      resource: string;
    }>;
  }>;
  votes: Array<{
    userId: Types.ObjectId;
    voteType: 'upvote' | 'downvote';
    createdAt: Date;
  }>;
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
  vote: (userId: Types.ObjectId, voteType: 'upvote' | 'downvote') => void;
  getVoteCounts: () => { upvotes: number; downvotes: number; total: number };
}

interface DiscussionQueryParams {
  page: number;
  limit: number;
  communityId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

interface PaginationResult<T> {
  docs: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export class DiscussionService {
  private discussionRepository: DiscussionRepository;

  constructor() {
    this.discussionRepository = new DiscussionRepository();
  }

  /**
   * Create a new discussion
   */
  async createDiscussion(discussion: Partial<IDiscussion>): Promise<IDiscussion> {
    return this.discussionRepository.create(discussion);
  }

  /**
   * Get a discussion by ID
   */
  async getDiscussionById(id: string): Promise<IDiscussion | null> {
    return this.discussionRepository.findById(id);
  }

  /**
   * Add a reply to a discussion
   */
  async addReply(discussionId: string, reply: any): Promise<IDiscussion | null> {
    return this.discussionRepository.addReply(discussionId, reply);
  }

  /**
   * Get all discussions with pagination and filtering
   */
  async getAllDiscussions(params: DiscussionQueryParams): Promise<{
    discussions: IDiscussion[];
    pagination: PaginationResult<IDiscussion>;
  }> {
    const { page, limit, communityId, sortBy = 'createdAt', sortOrder = 'desc', search } = params;
    
    // Build query
    const query: any = {};
    if (communityId) {
      query.communityId = new Types.ObjectId(communityId);
    }
    
    // Add text search if provided
    if (search) {
      query.$text = { $search: search };
    }
    
    // Build sort
    const sort: any = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    // Execute query with pagination
    const result = await this.discussionRepository.findWithPagination(
      query,
      {
        page,
        limit,
        sort,
        populate: [
          { path: 'creator', select: 'name username profilePicture' },
          { path: 'communityId', select: 'name' }
        ]
      }
    );
    
    const { docs, ...pagination } = result;
    
    return {
      discussions: docs,
      pagination: pagination as PaginationResult<IDiscussion>
    };
  }

  /**
   * Update a discussion
   */
  async updateDiscussion(id: string, updates: Partial<IDiscussion>): Promise<IDiscussion | null> {
    // Ensure we don't update protected fields
    const allowedUpdates = ['title', 'content', 'attachments'];
    const updateData: Partial<IDiscussion> = {};
    
    Object.keys(updates).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updateData[key as keyof IDiscussion] = updates[key as keyof IDiscussion];
      }
    });
    
    return this.discussionRepository.findByIdAndUpdate(id, updateData);
  }

  /**
   * Delete a discussion
   */
  async deleteDiscussion(id: string): Promise<boolean> {
    const result = await this.discussionRepository.deleteById(id);
    return result !== null;
  }

  /**
   * Vote on a discussion
   */
  async voteDiscussion(id: string, userId: Types.ObjectId, voteType: 'upvote' | 'downvote'): Promise<IDiscussion | null> {
    const discussion = await this.discussionRepository.findById(id);
    if (!discussion) {
      return null;
    }
    
    // Add or update vote
    discussion.vote(userId, voteType);
    await discussion.save();
    
    return discussion;
  }

  /**
   * Pin or unpin a discussion
   */
  async togglePinDiscussion(id: string, pinned: boolean): Promise<IDiscussion | null> {
    return this.discussionRepository.findByIdAndUpdate(id, { isPinned: pinned });
  }

  /**
   * Get replies for a discussion with pagination
   */
  async getDiscussionReplies(id: string, page: number, limit: number): Promise<{
    replies: any[];
    pagination: PaginationResult<any>;
  } | null> {
    const discussion = await this.discussionRepository.findById(id);
    if (!discussion) {
      return null;
    }
    
    // Calculate pagination
    const total = discussion.replies.length;
    const totalPages = Math.ceil(total / limit);
    const skip = (page - 1) * limit;
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;
    
    // Get paginated replies
    const replies = discussion.replies
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(skip, skip + limit);
    
    // Populate creator information for each reply
    const populatedReplies = await this.discussionRepository.populateReplies(replies);
    
    return {
      replies: populatedReplies,
      pagination: {
        docs: populatedReplies,
        total,
        page,
        limit,
        totalPages,
        hasNextPage,
        hasPrevPage
      }
    };
  }

  /**
   * Get trending discussions
   */
  async getTrendingDiscussions(communityId: string | undefined, limit: number): Promise<IDiscussion[]> {
    if (communityId) {
      return this.discussionRepository.findTrending(new Types.ObjectId(communityId), limit);
    } else {
      // Get trending discussions across all communities
      return this.discussionRepository.findTrending(undefined, limit);
    }
  }
}