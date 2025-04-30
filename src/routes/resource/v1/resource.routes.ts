import express from 'express';
import { authenticate, authorize } from '@middleware/auth';
import { validate } from '@middleware/validate';
import asyncHandler from '@utils/asyncHandler';
import {
  getAllResources,
  getResourceById,
  createResource,
  updateResource,
  deleteResource,
  getResourceMetrics,
  rateResource,
  commentResource,
  getResourceComments,
  trackDownload,
  trackView,
  getRecommendedResources
} from '@controllers/resource.controller';
import { resourceValidation } from '../../../validations/resourceValidation';
import { uploadFile } from '@utils/uploadService';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// Public routes (still need authentication)
router.get('/', validate(resourceValidation.getResources), asyncHandler(getAllResources));
router.get('/:id', asyncHandler(getResourceById));
router.get('/:id/comments', validate(resourceValidation.getResourceComments), asyncHandler(getResourceComments));

// Admin/Dashboard routes
router.get('/metrics/dashboard', authorize('admin', 'superadmin'), asyncHandler(getResourceMetrics));

// Protected routes (need specific permissions)
router.post(
  '/',
  authorize('createResource'),
  uploadFile,
  validate(resourceValidation.createResource),
  asyncHandler(createResource)
);

router.patch(
  '/:id',
  authorize('updateResource'),
  validate(resourceValidation.updateResource),
  asyncHandler(updateResource)
);

router.delete(
  '/:id',
  authorize('deleteResource'),
  asyncHandler(deleteResource)
);

// Resource interaction routes
router.post(
  '/:id/rate',
  validate(resourceValidation.rateResource),
  asyncHandler(rateResource)
);

router.post(
  '/:id/comment',
  validate(resourceValidation.commentResource),
  asyncHandler(commentResource)
);

router.post(
  '/:id/track-download',
  validate(resourceValidation.trackDownload),
  asyncHandler(trackDownload)
);

router.post(
  '/:id/track-view',
  validate(resourceValidation.trackView),
  asyncHandler(trackView)
);

// Recommendation routes
router.get('/recommendations', asyncHandler(getRecommendedResources));

export default router;
