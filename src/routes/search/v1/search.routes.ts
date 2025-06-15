import { Router } from 'express';
import { authenticate } from '@middleware/auth';
import { globalSearch, searchPeers, searchPeersByFilter, searchRecommendedPeers } from '../../../controllers/search.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Global search for discussions, resources, and users
router.get('/', globalSearch);

// Basic peer search
router.get('/peers', searchPeers);

// Advanced peer search with filters
router.get('/peers/filter', searchPeersByFilter);

// Recommended peers based on profile similarity
router.get('/peers/recommended', searchRecommendedPeers);

export default router;
