import { DiscussionRepository } from '../repositories/discussion.repo';
import { Types } from 'mongoose';
import Discussion from '../models/Discussion';
import { IDiscussion, IReply, IVote, IAttachment } from '../models/types';
import { ICustomPaginateResult } from '../repositories/discussion.repo';
import { NotFoundError, AuthorizationError } from '../utils/errors';
import { UploadService } from '../utils/uploadService';
import { RecommendationService } from './recommendation.service';

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
  ai_enabled?: boolean;
}

export class DiscussionService {
  private discussionRepository: DiscussionRepository;
  private uploadService: UploadService;

  constructor(discussionRepository: DiscussionRepository, uploadService: UploadService) {
    this.discussionRepository = discussionRepository;
    this.uploadService = uploadService;
  }

  /**
   * Create a new discussion
   */
  async createDiscussion(discussion: Partial<IDiscussion>): Promise<IDiscussion> {
    const result = await this.discussionRepository.create(discussion as unknown as RepoDiscussion);
    return result as unknown as IDiscussion;
  }

  /**
   * Vote on a discussion
   */
  async voteDiscussion(discussionId: string, userId: string, voteType: 'upvote' | 'downvote'): Promise<IDiscussion | null> {
    const discussion = await this.discussionRepository.findById(discussionId);
    if (!discussion) {
      throw new NotFoundError('Discussion not found');
    }
    await discussion.vote(new Types.ObjectId(userId), voteType);
    return discussion.save();
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
   * Update a discussion
   */
  async updateDiscussion(discussionId: string, updateBody: Partial<IDiscussion>): Promise<IDiscussion | null> {
    return this.discussionRepository.findByIdAndUpdate(discussionId, updateBody);
  }

  /**
   * Get all discussions with pagination and filtering
   */
  async getAllDiscussions(params: DiscussionQueryParams): Promise<{
    discussions: IDiscussion[];
    pagination: ICustomPaginateResult<IDiscussion>;
  }> {
    const { page, limit, communityId, sortBy = 'createdAt', sortOrder = 'desc', search, currVoteSpecified, userId, ai_enabled } = params;

    let recommendations: IDiscussion[] = [];
    if (ai_enabled && userId) {
        // TODO: The user's selected topics should be fetched, for now using an empty array.
        recommendations = await RecommendationService.getPersonalizedRecommendations(userId.toString(), []);
    }

    // Build query
    const query: any = {};
    if (communityId) {
      query.communityId = new Types.ObjectId(communityId);
    } else {
      // If no communityId is specified, fetch only global discussions
      query.communityId = { $exists: false };
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

    let discussions: any[] = docs;

    // If current vote is specified, convert docs to plain objects and add the vote status
    if (currVoteSpecified && userId) {
      discussions = docs.map((doc: IDiscussion) => {
        const plainDoc = doc.toObject();
        const vote = plainDoc.votes.find((v: IVote) => v.userId.equals(userId));
        plainDoc.currentVote = vote ? (vote.voteType === 'upvote' ? 1 : -1) : 0;
        return plainDoc;
      });
    }

    // Combine recommendations with the regular discussion list
    // TODO: When recommendations are live, pagination logic will need to be adjusted
    // to account for the combined list size.
    const combinedDiscussions = [...recommendations, ...discussions];

    return {
      discussions: combinedDiscussions,
      pagination: { ...pagination, docs: combinedDiscussions } as ICustomPaginateResult<IDiscussion>,
    };
  }

  /**
   * Recursively collects all attachment URLs from a discussion and its replies.
   * @param discussion - The discussion document.
   * @returns An array of attachment URLs.
   */
  private _collectAttachments(discussion: IDiscussion): IAttachment[] {
    const attachments: IAttachment[] = [];

    if (discussion.attachments && discussion.attachments.length > 0) {
      attachments.push(...discussion.attachments);
    }

    const collectFromReplies = (replies: IReply[]) => {
      for (const reply of replies) {
        if (reply.attachments && reply.attachments.length > 0) {
          attachments.push(...reply.attachments);
        }
        if (reply.replies && reply.replies.length > 0) {
          collectFromReplies(reply.replies);
        }
      }
    };

    if (discussion.replies && discussion.replies.length > 0) {
      collectFromReplies(discussion.replies);
    }

    return attachments;
  }

  /**
   * Delete a discussion and its attachments.
   */
  async deleteDiscussion(id: string): Promise<boolean> {
    const discussion = await Discussion.findById(id).lean();
    if (!discussion) {
      throw new NotFoundError('Discussion not found');
    }

    const attachments = this._collectAttachments(discussion as IDiscussion);
    const publicIds = attachments.map(a => a.checksum).filter((cs): cs is string => !!cs);

    if (publicIds.length > 0) {
      await this.uploadService.deleteFiles(publicIds).catch((err: unknown) => {
        console.error(`Failed to delete discussion attachments for ${id}:`, err);
      });
    }

    await Discussion.findByIdAndDelete(id);
    return true;
  }

  /**
   * Bulk delete discussions and their attachments.
   * @param discussionIds - An array of discussion IDs to delete.
   * @returns A promise that resolves to the number of deleted discussions.
   */
  async bulkDeleteDiscussions(discussionIds: string[]): Promise<number> {
    const discussions = await Discussion.find({
      _id: { $in: discussionIds.map(id => new Types.ObjectId(id)) },
    }).lean();

    const publicIds: string[] = [];
    discussions.forEach(discussion => {
      const attachments = this._collectAttachments(discussion as IDiscussion);
      attachments.forEach(att => {
        if (att.checksum) {
          publicIds.push(att.checksum);
        }
      });
    });

    if (publicIds.length > 0) {
      await this.uploadService.deleteFiles(publicIds).catch((err: unknown) => {
        console.error(`Failed to bulk delete discussion attachments:`, err);
      });
    }

    const result = await Discussion.deleteMany({
      _id: { $in: discussionIds.map(id => new Types.ObjectId(id)) },
    });

    return result.deletedCount || 0;
  }

  /**
   * Pin or unpin a discussion
   */
  async pinDiscussion(discussionId: string, pinned: boolean): Promise<IDiscussion | null> {
    const discussion = await this.discussionRepository.findById(discussionId);
    if (!discussion) {
      throw new NotFoundError('Discussion not found');
    }
    discussion.isPinned = pinned;
    return discussion.save();
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