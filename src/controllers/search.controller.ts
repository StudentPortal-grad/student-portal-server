import { Request, Response, NextFunction } from 'express';
import { SearchService } from '../services/search.service';
import { AppError, ErrorCodes } from '@utils/appError';
import asyncHandler from '@utils/asyncHandler';
import { ResponseBuilder, HttpStatus } from '@utils/ApiResponse';

/**
 * Search for peers
 * @route GET /api/v1/search/peers
 */
export const searchPeers = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.user?._id?.toString();

  if (!userId) {
    throw new AppError('User not authenticated', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
  }

  const { query } = req.query;

  const peers = await SearchService.searchPeers(userId, query as string);

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

