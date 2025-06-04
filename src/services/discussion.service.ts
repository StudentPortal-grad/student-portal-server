import { DiscussionRepository } from '../repositories/discussion.repo';
import { Types } from 'mongoose';
import { IDiscussion, IDiscussionDocument } from '../interfaces/discussion.interface';
import { NotFoundError } from '../utils/errors';

// Use type alias to avoid conflicts with the imported interfaces
type RepoDiscussion = any;

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
  async createDiscussion(discussion: Partial<IDiscussion>): Promise<IDiscussionDocument> {
    const result = await this.discussionRepository.create(discussion as unknown as RepoDiscussion);
    return result as unknown as IDiscussionDocument;
  }

  /**
   * Get a discussion by ID
   */
  async getDiscussionById(id: string): Promise<IDiscussionDocument | null> {
    const discussion = await this.discussionRepository.findById(id);
    if (!discussion) {
      throw new NotFoundError('Discussion not found');
    }
    return discussion as unknown as IDiscussionDocument;
  }

  /**
   * Add a reply to a discussion
   */
  async addReply(discussionId: string, reply: any): Promise<IDiscussionDocument | null> {
    const discussion = await this.discussionRepository.addReply(discussionId, reply);
    if (!discussion) {
      throw new NotFoundError('Discussion not found');
    }
    return discussion as unknown as IDiscussionDocument;
  }

  /**
   * Get all discussions with pagination and filtering
   */
  async getAllDiscussions(params: DiscussionQueryParams): Promise<{
    discussions: IDiscussionDocument[];
    pagination: PaginationResult<IDiscussionDocument>;
  }> {
    const { page, limit, communityId, sortBy = 'createdAt', sortOrder = 'desc', search } = params;
    
    // Build query
    const query: any = {};
    if (params.communityId) {
      query.communityId = new Types.ObjectId(params.communityId);
    } else {
      // If no communityId is specified, fetch only global discussions
      query.communityId = { $exists: false };
    }
    
    // Add text search if provided
    if (params.search) {
      query.$text = { $search: params.search };
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
      discussions: docs as unknown as IDiscussionDocument[],
      pagination: pagination as PaginationResult<IDiscussionDocument>
    };
  }

  /**
   * Update a discussion
   */
  async updateDiscussion(id: string, updateData: Partial<IDiscussion>): Promise<IDiscussionDocument | null> {
    const discussion = await this.discussionRepository.findByIdAndUpdate(id, updateData as unknown as RepoDiscussion);
    if (!discussion) {
      throw new NotFoundError('Discussion not found');
    }
    return discussion as unknown as IDiscussionDocument;
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
  async voteDiscussion(id: string, userId: Types.ObjectId, voteType: 'upvote' | 'downvote'): Promise<IDiscussionDocument | null> {
    const discussion = await this.discussionRepository.findById(id) as any;
    if (!discussion) {
      return null;
    }
    
    // Add or update vote
    discussion.vote(userId, voteType);
    await discussion.save();
    
    return discussion as unknown as IDiscussionDocument;
  }

  /**
   * Pin or unpin a discussion
   */
  async togglePinDiscussion(id: string, pinned: boolean): Promise<IDiscussionDocument | null> {
    const discussion = await this.discussionRepository.findByIdAndUpdate(id, { isPinned: pinned } as unknown as RepoDiscussion);
    if (!discussion) {
      throw new NotFoundError('Discussion not found');
    }
    return discussion as unknown as IDiscussionDocument;
  }

  /**
   * Get replies for a discussion with pagination
   */
  async getDiscussionReplies(id: string, page: number, limit: number): Promise<{
    replies: any[];
    pagination: PaginationResult<any>;
  } | null> {
    const discussion = await this.discussionRepository.findById(id) as any;
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
      .sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime())
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
  async getTrendingDiscussions(communityId?: string, limit: number = 10): Promise<IDiscussionDocument[]> {
    if (communityId) {
      const result = await this.discussionRepository.findTrending(new Types.ObjectId(communityId), limit);
      return result as unknown as IDiscussionDocument[];
    } else {
      const result = await this.discussionRepository.findTrending(undefined, limit);
      return result as unknown as IDiscussionDocument[];
    }
  }
}