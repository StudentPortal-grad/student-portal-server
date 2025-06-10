import { DiscussionRepository } from '../repositories/discussion.repo';
import { Types } from 'mongoose';
import Discussion from '../models/Discussion';
import { IDiscussion, IReply, IVote } from '../models/types';
import { ICustomPaginateResult } from '../repositories/discussion.repo';
import { NotFoundError, AuthorizationError } from '../utils/errors';

// Use type alias to avoid conflicts with the imported interfaces
type RepoDiscussion = any;

export interface DiscussionQueryParams {
  page: number;
  limit: number;
  communityId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  currVoteSpecified?: boolean;
  userId?: Types.ObjectId;
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
    const result = await this.discussionRepository.create(discussion as unknown as RepoDiscussion);
    return result as unknown as IDiscussion;
  }

  /**
   * Generates a nested population object to a specified depth.
   * @param depth - The maximum depth to populate.
   * @returns A Mongoose population object.
   */
  private generateNestedPopulate(depth: number): any {
    const creatorPopulate = { path: 'creator', select: 'name username profilePicture' };

    if (depth <= 0) {
      return [creatorPopulate];
    }

    return [
      creatorPopulate,
      {
        path: 'replies',
        populate: this.generateNestedPopulate(depth - 1),
      },
    ];
  }

  /**
   * Get a discussion by ID, recursively populating creators for all replies up to a fixed depth.
   */
  async getDiscussionById(
    id: string,
    params: { currVoteSpecified?: boolean; userId?: Types.ObjectId } = {}
  ): Promise<any> {
    const { currVoteSpecified, userId } = params;
    const maxDepth = 10; // Set a reasonable depth limit

    const discussion = await Discussion.findById(id).populate([
      { path: 'creator', select: 'name username profilePicture' },
      {
        path: 'replies',
        populate: this.generateNestedPopulate(maxDepth),
      },
    ]);

    if (!discussion) {
      throw new NotFoundError('Discussion not found');
    }

    // If a userId is provided, convert the document to a plain object and add the currentVote property
    if (currVoteSpecified && userId) {
      const discussionObj = discussion.toObject();
      const vote = discussionObj.votes.find((v: IVote) => v.userId.equals(userId));
      const currentVote = vote ? (vote.voteType === 'upvote' ? 1 : -1) : 0;
      return { ...discussionObj, currentVote };
    }

    return discussion;
  }

  /**
   * Add a reply to a discussion
   */
  async addReply(discussionId: string, reply: any): Promise<IDiscussion | null> {
    const discussion = await this.discussionRepository.addReply(discussionId, reply);
    if (!discussion) {
      throw new NotFoundError('Discussion not found');
    }
    return discussion as unknown as IDiscussion;
  }

  /**
   * Get all discussions with pagination and filtering
   */
  async getAllDiscussions(params: DiscussionQueryParams): Promise<{
    discussions: IDiscussion[];
    pagination: ICustomPaginateResult<IDiscussion>;
  }> {
    const { page, limit, communityId, sortBy = 'createdAt', sortOrder = 'desc', search, currVoteSpecified, userId } = params;

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

    let discussions: any[] = docs;

    // If current vote is specified, convert docs to plain objects and add the vote status
    if (currVoteSpecified && userId) {
      discussions = docs.map(doc => {
        const plainDoc = doc.toObject();
        const vote = plainDoc.votes.find((v: IVote) => v.userId.equals(userId));
        plainDoc.currentVote = vote ? (vote.voteType === 'upvote' ? 1 : -1) : 0;
        return plainDoc;
      });
    }

    return {
      discussions,
      pagination: pagination as ICustomPaginateResult<IDiscussion>
    };
  }

  /**
   * Update a discussion
   */
  async updateDiscussion(id: string, updateData: Partial<IDiscussion>): Promise<IDiscussion | null> {
    const discussion = await this.discussionRepository.findByIdAndUpdate(id, updateData as unknown as RepoDiscussion);
    if (!discussion) {
      throw new NotFoundError('Discussion not found');
    }
    return discussion as unknown as IDiscussion;
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
  async voteDiscussion(discussionDocument: IDiscussion, userId: Types.ObjectId, voteType: 'upvote' | 'downvote'): Promise<IDiscussion> {
    await discussionDocument.vote(userId, voteType);
    return discussionDocument;
  }

  /**
   * Pin or unpin a discussion
   */
  async togglePinDiscussion(id: string, pinned: boolean): Promise<IDiscussion | null> {
    const discussion = await this.discussionRepository.findByIdAndUpdate(id, { isPinned: pinned } as unknown as RepoDiscussion);
    if (!discussion) {
      throw new NotFoundError('Discussion not found');
    }
    return discussion as unknown as IDiscussion;
  }

  /**
   * Get replies for a discussion with pagination
   */
  async getDiscussionReplies(id: string, page: number, limit: number): Promise<{
    replies: any[];
    pagination: ICustomPaginateResult<any>;
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

    const offset = skip;
    const pagingCounter = offset + 1;

    return {
      replies: populatedReplies,
      pagination: {
        docs: populatedReplies,
        total,
        page,
        limit,
        totalPages,
        hasNextPage,
        hasPrevPage,
        pagingCounter,
        prevPage: hasPrevPage ? page - 1 : null,
        nextPage: hasNextPage ? page + 1 : null,
        offset
      }
    };
  }

  /**
   * Get trending discussions
   */
  async getTrendingDiscussions(communityId?: string, limit: number = 10): Promise<IDiscussion[]> {
    if (communityId) {
      const result = await this.discussionRepository.findTrending(new Types.ObjectId(communityId), limit);
      return result as unknown as IDiscussion[];
    } else {
      const result = await this.discussionRepository.findTrending(undefined, limit);
      return result as unknown as IDiscussion[];
    }
  }

  /**
   * Edit a reply in a discussion.
   */
  async editReply(
    discussionId: string,
    replyId: string,
    userId: Types.ObjectId,
    content: string
  ): Promise<IDiscussion> {
    const discussion = await Discussion.findById(discussionId);
    if (!discussion) {
      throw new NotFoundError('Discussion not found');
    }

    const reply = this.findReplyRecursive(discussion.replies, replyId);
    if (!reply) {
      throw new NotFoundError('Reply not found');
    }

    if (!reply.creator.equals(userId)) {
      throw new AuthorizationError('You are not authorized to edit this reply');
    }

    reply.content = content;
    await discussion.save();
    return discussion;
  }

  /**
   * Delete a reply from a discussion.
   */
  async deleteReply(
    discussionId: string,
    replyId: string,
    userId: Types.ObjectId
  ): Promise<IDiscussion> {
    const discussion = await Discussion.findById(discussionId);
    if (!discussion) {
      throw new NotFoundError('Discussion not found');
    }

    const deleted = this.findAndRemoveReplyRecursive(
      discussion.replies,
      replyId,
      userId
    );
    if (!deleted) {
      throw new NotFoundError('Reply not found or you do not have permission to delete it');
    }

    await discussion.save();
    return discussion;
  }

  private findReplyRecursive(replies: IReply[], replyId: string): IReply | null {
    for (const reply of replies) {
      if ((reply as any)._id.equals(replyId)) {
        return reply;
      }
      if (reply.replies && reply.replies.length > 0) {
        const found = this.findReplyRecursive(reply.replies, replyId);
        if (found) {
          return found;
        }
      }
    }
    return null;
  }

  private findAndRemoveReplyRecursive(
    replies: IReply[],
    replyId: string,
    userId: Types.ObjectId
  ): boolean {
    for (let i = 0; i < replies.length; i++) {
      const reply = replies[i];
      if ((reply as any)._id.equals(replyId)) {
        if (!reply.creator.equals(userId)) {
          throw new AuthorizationError('You are not authorized to delete this reply');
        }
        replies.splice(i, 1);
        return true;
      }
      if (reply.replies && reply.replies.length > 0) {
        if (this.findAndRemoveReplyRecursive(reply.replies, replyId, userId)) {
          return true;
        }
      }
    }
    return false;
  }
}