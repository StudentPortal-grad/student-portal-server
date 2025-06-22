import Discussion from '@models/Discussion';
import Resource from '@models/Resource';
import User from '@models/User';
import { IUser } from '@models/types';
import { Types } from 'mongoose';
import { AppError, ErrorCodes } from '@utils/appError';
import { HttpStatus } from '@utils/ApiResponse';

// Import types for socket.io global instance
declare global {
  // eslint-disable-next-line no-var
  var io: any;
}

export class SearchService {
  static async globalSearch(query: string, user?: IUser, currVoteSpecified?: boolean): Promise<object> {
    if (!query || query.trim().length < 2) {
      throw new AppError(
        'Search query must be at least 2 characters long.',
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    const [discussions, resources, users] = await Promise.all([
      this.globalDiscussionsSearch(query, user, currVoteSpecified),
      this.globalResourcesSearch(query, user, currVoteSpecified),
      this.globalUsersSearch(query),
    ]);

    return { discussions, resources, users };
  }

  static async globalDiscussionsSearch(query: string, user?: IUser, currVoteSpecified?: boolean) {
    const searchQuery = { $text: { $search: query } };
    const userId = user ? new Types.ObjectId(user._id) : null;

    const addFieldsStage: any = {
      score: { $meta: 'textScore' },
    };

    const projectStage: any = {
      title: 1,
      content: 1,
      createdAt: 1,
      score: 1,
      creator: {
        name: '$creator.name',
        profilePicture: '$creator.profilePicture',
      },
    };

    if (currVoteSpecified && userId) {
      addFieldsStage.currentVote = {
        $let: {
          vars: {
            userVote: {
              $arrayElemAt: [
                {
                  $filter: {
                    input: { $ifNull: ['$votes', []] },
                    as: 'vote',
                    cond: { $eq: ['$$vote.userId', userId] },
                  },
                },
                0,
              ],
            },
          },
          in: {
            $cond: {
              if: { $eq: ['$$userVote.voteType', 'upvote'] },
              then: 1,
              else: {
                $cond: {
                  if: { $eq: ['$$userVote.voteType', 'downvote'] },
                  then: -1,
                  else: 0,
                },
              },
            },
          },
        },
      };
      projectStage.currentVote = 1;
    }

    const aggregationPipeline: any[] = [
      { $match: searchQuery },
      { $addFields: addFieldsStage },
      { $sort: { score: { $meta: 'textScore' } } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: 'creator',
          foreignField: '_id',
          as: 'creator',
        },
      },
      { $unwind: '$creator' },
      { $project: projectStage },
    ];

    return Discussion.aggregate(aggregationPipeline);
  }

  static async globalResourcesSearch(query: string, user?: IUser, currVoteSpecified?: boolean) {
    const searchQuery = { $text: { $search: query } };
    const userId = user ? new Types.ObjectId(user._id) : null;

    const addFieldsStage: any = {
      score: { $meta: 'textScore' },
    };

    const projectStage: any = {
      title: 1,
      description: 1,
      createdAt: 1,
      score: 1,
      uploader: {
        name: '$uploader.name',
        profilePicture: '$uploader.profilePicture',
      },
    };

    if (currVoteSpecified && userId) {
      addFieldsStage.currentVote = {
        $let: {
          vars: {
            userVote: {
              $arrayElemAt: [
                {
                  $filter: {
                    input: { $ifNull: ['$votes', []] },
                    as: 'vote',
                    cond: { $eq: ['$$vote.userId', userId] },
                  },
                },
                0,
              ],
            },
          },
          in: {
            $cond: {
              if: { $eq: ['$$userVote.voteType', 'upvote'] },
              then: 1,
              else: {
                $cond: {
                  if: { $eq: ['$$userVote.voteType', 'downvote'] },
                  then: -1,
                  else: 0,
                },
              },
            },
          },
        },
      };
      projectStage.currentVote = 1;
    }

    const aggregationPipeline: any[] = [
      { $match: searchQuery },
      { $addFields: addFieldsStage },
      { $sort: { score: { $meta: 'textScore' } } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: 'uploader',
          foreignField: '_id',
          as: 'uploader',
        },
      },
      { $unwind: '$uploader' },
      { $project: projectStage },
    ];

    return Resource.aggregate(aggregationPipeline);
  }

  static async globalUsersSearch(query: string) {
    const regex = new RegExp(query, 'i'); // i for case-insensitive

    return User.find({
      $or: [{ name: regex }, { username: regex }],
      isChatbot: { $ne: true },
      role: { $nin: ['faculty', 'superadmin', 'chatbot'] },
    })
      .select({
        name: 1,
        username: 1,
        profilePicture: 1,
      })
      .limit(10)
      .lean();
  }

  /**
   * Search for peers
   */
  static async searchPeers(currentUser: IUser, query?: string) {

    // Create optimized query with index-friendly conditions
    const searchQuery: any = {
      _id: { $ne: currentUser._id },
      role: 'student',
      $or: [
        { signupStep: 'completed' },
        { signupStep: 'verified' },
        { signupStep: 'complete' }, // Handle inconsistent data
      ],
      isGraduated: false,
      level: currentUser.level,
    };

    // Add text search if query provided
    if (query && query.length > 2) {
      searchQuery.$text = { $search: query };
    }

    const queryBuilder = User.find(searchQuery);

    // Use projection and lean for better performance
    if (query && query.length > 2) {
      // When searching, project the score and sort by it
      queryBuilder
        .select({
          name: 1,
          username: 1,
          profilePicture: 1,
          level: 1,
          status: 1,
          lastSeen: 1,
          college: 1,
          gpa: 1,
          'profile.bio': 1,
          'profile.interests': 1,
          score: { $meta: 'textScore' },
        })
        .sort({ score: { $meta: 'textScore' } });
    } else {
      // Default projection without search
      queryBuilder.select(
        'name username profilePicture level status lastSeen college gpa profile.bio profile.interests'
      );
    }

    const peers = await queryBuilder.limit(20).lean();

    return peers;
  }

  /**
   * Search for peers with advanced filters
   */
  static async searchPeersByFilter(userId: string, filters: any) {
    // Create base query with index-friendly conditions
    const baseQuery = {
      _id: { $ne: userId },
      role: 'student',
      signupStep: 'completed',
      isGraduated: false,
    };

    // Add filters conditionally to optimize query
    const filterQuery: any = { ...baseQuery };

    // Add university filter (high selectivity)
    if (filters.university) {
      filterQuery.university = filters.university;
    }

    // Add level filter (medium selectivity)
    if (filters.level) {
      filterQuery.level = Number(filters.level);
    }

    // Add gender filter (low selectivity)
    if (filters.gender) {
      filterQuery.gender = filters.gender;
    }

    // Add GPA range filter
    if (filters.minGpa !== undefined && filters.maxGpa !== undefined) {
      filterQuery.gpa = {
        $gte: Number(filters.minGpa),
        $lte: Number(filters.maxGpa),
      };
    }

    // Add interests filter
    if (filters.interests) {
      const interestsArray = Array.isArray(filters.interests)
        ? filters.interests
        : [filters.interests];

      if (interestsArray.length > 0) {
        filterQuery['profile.interests'] = { $in: interestsArray };
      }
    }

    // Add graduation year filter
    if (filters.graduationYear) {
      filterQuery.graduationYear = Number(filters.graduationYear);
    }

    // Add text search if query provided
    if (filters.query && filters.query.length > 2) {
      filterQuery.$or = [
        { name: { $regex: filters.query, $options: 'i' } },
        { username: { $regex: filters.query, $options: 'i' } },
        { universityEmail: { $regex: filters.query, $options: 'i' } },
      ];
    }

    // Use projection, sorting and lean for better performance
    const peers = await User.find(filterQuery)
      .select('name username profilePicture gender level status lastSeen college university gpa graduationYear profile.bio profile.interests')
      .sort({ level: 1, gpa: -1, name: 1 })
      .limit(20)
      .lean();

    return peers;
  }

  /**
   * Get recommended peers based on profile similarity
   */
  static async searchRecommendedPeers(userId: string) {
    // Get only needed user fields
    const currentUser = await User.findById(userId)
      .select('university college level profile.interests')
      .lean();

    if (!currentUser) {
      throw new AppError('User not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }

    // Use caching hint for better performance
    const aggregationPipeline = [
      {
        $match: {
          _id: { $ne: new Types.ObjectId(userId) },
          role: 'student',
          signupStep: 'completed',
          isGraduated: false,
          university: currentUser.university,
          college: currentUser.college,
          // Use $in for better index usage
          level: {
            $in: [
              currentUser.level,
              currentUser.level + 1,
              currentUser.level - 1,
            ],
          },
        },
      },
      {
        // Use efficient $addFields to calculate similarity metrics
        $addFields: {
          commonInterests: {
            $size: {
              $setIntersection: [
                '$profile.interests',
                currentUser.profile?.interests || [],
              ],
            },
          },
          levelDiff: {
            $abs: { $subtract: ['$level', currentUser.level] },
          },
        },
      },
      {
        // Sort by calculated fields
        $sort: {
          commonInterests: -1,
          levelDiff: 1,
          gpa: -1,
        } as any, // Type assertion to fix the type error
      },
      {
        // Project only needed fields
        $project: {
          name: 1,
          username: 1,
          profilePicture: 1,
          gender: 1,
          level: 1,
          status: 1,
          lastSeen: 1,
          college: 1,
          gpa: 1,
          'profile.bio': 1,
          'profile.interests': 1,
          commonInterests: 1,
        },
      },
      {
        // Limit results
        $limit: 20,
      },
    ];

    const peers = await User.aggregate(aggregationPipeline);
    return peers;
  }
}
