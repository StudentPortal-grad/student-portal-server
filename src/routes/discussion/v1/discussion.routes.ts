import express from 'express';
import asyncHandler from '@utils/asyncHandler';
import { validate } from '@middleware/validate';
import { authenticate, authorize } from '@middleware/auth';
import { discussionValidation } from '../../../validations/discussionValidation';
import { uploadDiscussionAttachments } from '../../../utils/uploadService';
import {
  createDiscussion,
  getDiscussionById,
  addReply,
  getAllDiscussions,
  updateDiscussion,
  deleteDiscussion,
  voteDiscussion,
  reportDiscussion,
  togglePinDiscussion,
  getDiscussionReplies,
  getTrendingDiscussions
} from '@controllers/discussion.controller';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// Public routes (still need authentication)
router.get('/', 
  validate(discussionValidation.getDiscussions), 
  asyncHandler(getAllDiscussions)
);

router.get('/trending', 
  asyncHandler(getTrendingDiscussions)
);

router.get('/:id', 
  asyncHandler(getDiscussionById)
);

router.get('/:id/replies', 
  validate(discussionValidation.getPaginatedItems),
  asyncHandler(getDiscussionReplies)
);

// Protected routes (need specific permissions)
router.post('/', 
  uploadDiscussionAttachments,
  validate(discussionValidation.createDiscussion), 
  asyncHandler(createDiscussion)
);

router.post('/:id/reply', 
  uploadDiscussionAttachments,
  validate(discussionValidation.addReply),
  asyncHandler(addReply)
);

router.patch('/:id', 
  validate(discussionValidation.updateDiscussion),
  asyncHandler(updateDiscussion)
);

router.delete('/:id', 
  asyncHandler(deleteDiscussion)
);

router.post('/:id/vote', 
  validate(discussionValidation.voteDiscussion),
  asyncHandler(voteDiscussion)
);

router.post('/:id/report',
  validate(discussionValidation.reportDiscussion),
  asyncHandler(reportDiscussion)
);

// Admin routes
router.patch('/:id/pin', 
  authorize('admin', 'superadmin', 'moderator'),
  validate(discussionValidation.pinDiscussion),
  asyncHandler(togglePinDiscussion)
);

export default router;