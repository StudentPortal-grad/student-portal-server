import { Router } from 'express';
import { authenticate } from '@middleware/auth';
import { validate } from '@middleware/validate';
import { searchValidation } from '../../../validations/searchValidation';
import { searchPeers, searchPeersByFilter, searchRecommendedPeers } from '../../../controllers/search.controller';
import asyncHandler from '@utils/asyncHandler';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Basic peer search
router.get('/peers', searchPeers);

// Advanced peer search with filters
router.get('/peers/filter', searchPeersByFilter);

// Recommended peers based on profile similarity
router.get('/peers/recommended', searchRecommendedPeers);

export default router;
