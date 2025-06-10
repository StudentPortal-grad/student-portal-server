import express from 'express';
import asyncHandler from '@utils/asyncHandler';
import { validate } from '@middleware/validate';
import { authenticate, authorize } from '@middleware/auth';
import { uploadCommunityImages } from '@utils/uploadService';
import {
  createCommunitySchema,
  updateCommunitySchema,
  joinCommunitySchema,
  addMemberSchema
} from '@validations/communityValidation';
import {
  createCommunity,
  getAllCommunities,
  getCommunityById,
  updateCommunity,
  deleteCommunity,
  joinCommunity,
  leaveCommunity,
  generateInviteLink,
  getCommunityMembers,
  getCommunityRoles,
  getCommunityResources,
  addCommunityMember,
  removeCommunityMember,
  getCommunityMetrics
} from '@controllers/community.controller';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// Public routes (still need authentication)
router.get('/', asyncHandler(getAllCommunities));
router.get('/metrics', asyncHandler(getCommunityMetrics));
router.get('/:id', asyncHandler(getCommunityById));
router.get('/:id/members', asyncHandler(getCommunityMembers));
router.get('/:id/roles', asyncHandler(getCommunityRoles));

// Protected routes (need specific permissions)
router.post(
  '/create',
  authorize('createCommunity'),
  uploadCommunityImages,
  validate(createCommunitySchema),
  asyncHandler(createCommunity)
);

router.patch(
  '/:id',
  authorize('updateCommunity'),
  uploadCommunityImages,
  validate(updateCommunitySchema),
  asyncHandler(updateCommunity)
);

router.delete(
  '/:id',
  authorize('deleteCommunity'),
  asyncHandler(deleteCommunity)
);

router.post(
  '/:id/join',
  validate(joinCommunitySchema),
  asyncHandler(joinCommunity)
);

router.delete(
  '/:id/leave',
  asyncHandler(leaveCommunity)
);

router.post(
  '/:id/invite',
  authorize('generateInviteLink'),
  asyncHandler(generateInviteLink)
);

// Resources routes
router.get(
  '/:communityId/resources',
  asyncHandler(getCommunityResources)
);

// Member management routes
router.post(
  '/:communityId/members',
  authorize('manageCommunityMembers'),
  validate(addMemberSchema),
  asyncHandler(addCommunityMember)
);

router.delete(
  '/:communityId/members/:userId',
  authorize('manageCommunityMembers'),
  asyncHandler(removeCommunityMember)
);
export default router;
