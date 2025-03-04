import express from 'express';
import asyncHandler from '@utils/asyncHandler';
import { validate } from '@middleware/validate';
import {
  createCommunitySchema,
  joinCommunitySchema,
} from '@validators/communityValidator';
import {
  createCommunity,
  getAllCommunities,
  joinCommunity,
} from '@controllers/community.controller';

const router = express.Router();

router.post(
  '/create',
  validate(createCommunitySchema),
  asyncHandler(createCommunity)
);
router.get('/', asyncHandler(getAllCommunities));
router.post(
  '/:id/join',
  validate(joinCommunitySchema),
  asyncHandler(joinCommunity)
);

export default router;
