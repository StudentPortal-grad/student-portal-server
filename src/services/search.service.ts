import User from '@models/User';
import { Types } from 'mongoose';
import { AppError, ErrorCodes } from '@utils/appError';
import { HttpStatus } from '@utils/ApiResponse';

// Import types for socket.io global instance
declare global {
  var io: any;
}

export class SearchService {
  /**
   * Search for peers
   */
  static async searchPeers(userId: string, query?: string) {
    // Get current user's level
    const currentUser = await User.findById(userId)
      .select('level')
      .lean();

    if (!currentUser) {
      return [];
    }

    // Create optimized query with index-friendly conditions
    const searchQuery: any = {
      _id: { $ne: userId },
      role: 'student',
      $or: [
        { signupStep: 'completed' },
        { signupStep: 'verified' },
      ],
      isGraduated: false,
      level: currentUser.level,
    };

    // Add text search if query provided
    if (query && query.length > 2) {
      searchQuery.$or = [
        ...searchQuery.$or,
        { name: { $regex: query, $options: 'i' } },
        { username: { $regex: query, $options: 'i' } },
        { universityEmail: { $regex: query, $options: 'i' } },
      ];
    }

    // Use projection and lean for better performance
    const peers = await User.find(searchQuery)
      .select('name username profilePicture level status lastSeen college gpa profile.bio profile.interests')
      .limit(20)
      .lean();

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
