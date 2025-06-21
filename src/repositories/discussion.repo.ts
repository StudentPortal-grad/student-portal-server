import Discussion from '../models/Discussion';
import { Types, Document } from 'mongoose';
import User from '../models/User';
import { IDiscussion } from '../models/types';

export interface ICustomPaginateResult<T> {
  docs: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  pagingCounter: number;
  prevPage: number | null;
  nextPage: number | null;
  offset: number;
}



interface PaginationOptions {
  page: number;
  limit: number;
  sort?: any;
  populate?: any;
}

export class DiscussionRepository {
  /**
   * Create a new discussion
   */
  async create(discussion: Partial<IDiscussion>): Promise<IDiscussion> {
    return Discussion.create(discussion);
  }

  /**
   * Find a discussion by ID
   */
  async findById(id: string): Promise<IDiscussion | null> {
    return Discussion.findById(id)
      .populate('creator', 'name username profilePicture')
      .populate('communityId', 'name')
      .exec();
  }

  /**
   * Add a reply to a discussion
   */
  async addReply(discussionId: string, reply: any): Promise<IDiscussion | null> {
    return Discussion.findByIdAndUpdate(
      discussionId,
      { $push: { replies: reply } },
      { new: true }
    ).exec();
  }

  /**
   * Find discussions with pagination
   */
  async findWithPagination(query: any, options: PaginationOptions): Promise<ICustomPaginateResult<IDiscussion>> {
    const { page, limit, sort, populate } = options;
    const skip = (page - 1) * limit;

    // Execute the query with pagination
    const discussions = await Discussion.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate(populate)
      .exec();

    // Get total count for pagination
    const total = await Discussion.countDocuments(query);

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return {
      docs: discussions,
      total,
      page,
      limit,
      totalPages,
      hasNextPage,
      hasPrevPage,
      pagingCounter: skip + 1,
      prevPage: hasPrevPage ? page - 1 : null,
      nextPage: hasNextPage ? page + 1 : null,
      offset: skip
    };
  }

  /**
   * Update a discussion by ID
   */
  async findByIdAndUpdate(id: string, updates: Partial<IDiscussion>): Promise<IDiscussion | null> {
    return Discussion.findByIdAndUpdate(
      id,
      updates,
      { new: true }
    )
      .populate('creator', 'name username profilePicture')
      .populate('communityId', 'name')
      .exec();
  }

  /**
   * Find discussions by query
   */
  async find(query: any): Promise<IDiscussion[]> {
    return Discussion.find(query).exec();
  }

  /**
   * Delete a discussion by ID
   */
  async deleteById(id: string): Promise<IDiscussion | null> {
    return Discussion.findByIdAndDelete(id).exec();
  }

  /**
   * Delete multiple discussions by query
   */
  async deleteMany(query: any): Promise<{ deletedCount: number }> {
    const result = await Discussion.deleteMany(query).exec();
    return { deletedCount: result.deletedCount };
  }

  /**
   * Populate creator information for replies
   */
  async populateReplies(replies: any[]): Promise<any[]> {
    // Extract creator IDs from replies
    const creatorIds = replies.map(reply => reply.creator);

    // Fetch all creators in a single query
    const creators = await User.find({ _id: { $in: creatorIds } })
      .select('name username profilePicture')
      .exec();

    // Create a map of creator ID to creator data
    const creatorMap = new Map();
    creators.forEach(creator => {
      creatorMap.set(creator._id.toString(), creator);
    });

    // Replace creator IDs with creator data
    return replies.map(reply => ({
      ...reply.toObject ? reply.toObject() : reply,
      creator: creatorMap.get(reply.creator.toString())
    }));
  }

  /**
   * Find trending discussions
   */
  async findTrending(communityId: Types.ObjectId | undefined, limit: number): Promise<any[]> {
    // Build query
    const query: any = {};
    if (communityId) {
      query.communityId = communityId;
    }

    // Get discussions from the last 7 days
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    query.createdAt = { $gte: oneWeekAgo };

    // Find discussions and sort by vote count and reply count
    const discussions = await Discussion.find(query)
      .populate('creator', 'name username profilePicture')
      .populate('communityId', 'name')
      .exec();

    // Sort by engagement (votes + replies)
    return discussions
      .sort((a, b) => {
        const aEngagement = (a.votes?.length || 0) + (a.replies?.length || 0);
        const bEngagement = (b.votes?.length || 0) + (b.replies?.length || 0);
        return bEngagement - aEngagement;
      })
      .slice(0, limit);
  }
}