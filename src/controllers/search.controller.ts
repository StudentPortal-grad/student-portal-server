import { Request, Response, NextFunction } from 'express';
import { SearchService } from '../services/search.service';
import { AppError, ErrorCodes } from '@utils/appError';
import asyncHandler from '@utils/asyncHandler';
import { ResponseBuilder, HttpStatus } from '@utils/ApiResponse';

/**
 * Global search for discussions, resources, and users
 * @route GET /api/v1/search
 */
export const globalSearch = asyncHandler(async (req: Request, res: Response) => {
  const { q, type, currVoteSpecified } = req.query;

  if (typeof q !== 'string') {
    throw new AppError('Search query must be a string.', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
  }

  const user = req.user;
  const currVoteSpecifiedBool = currVoteSpecified === 'true';

  let results;
  if (!type) {
    results = await SearchService.globalSearch(q, user, currVoteSpecifiedBool);
  } else {
    switch (type) {
      case 'discussions':
        results = { discussions: await SearchService.globalDiscussionsSearch(q, user, currVoteSpecifiedBool) };
        break;
      case 'resources':
        results = { resources: await SearchService.globalResourcesSearch(q, user, currVoteSpecifiedBool) };
        break;
      case 'users':
        results = { users: await SearchService.globalUsersSearch(q) };
        break;
      default:
        throw new AppError('Invalid search type', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }
  }


  res.success(results, 'Search results retrieved successfully');
});


/**
 * Search for peers
 * @route GET /api/v1/search/peers
 */
export const searchPeers = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user;

  if (!user) {
    throw new AppError('User not authenticated', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
  }

  const { query } = req.query;

  const peers = await SearchService.searchPeers(user, query as string);

    res.success({ peers }, 'Peers retrieved successfully');
});

/**
 * Search for peers with advanced filters
 * @route GET /api/v1/search/peers/filter
 */
export const searchPeersByFilter = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.user?._id?.toString();

  if (!userId) {
    throw new AppError('User not authenticated', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
  }

  const filters = req.query;

  const peers = await SearchService.searchPeersByFilter(userId, filters);

  res.success({ peers }, 'Filtered peers retrieved successfully');
});

/**
 * Get recommended peers based on profile similarity
 * @route GET /api/v1/search/peers/recommended
 */
export const searchRecommendedPeers = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.user?._id?.toString();

  if (!userId) {
    throw new AppError('User not authenticated', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
  }

  const peers = await SearchService.searchRecommendedPeers(userId);

  res.success({ peers }, 'Recommended peers retrieved successfully');
});

