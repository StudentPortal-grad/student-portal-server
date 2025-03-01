import express from 'express';
import asyncHandler from '../../utils/asyncHandler';
import { validate } from '../../middlewares/validate';
import { createDiscussionSchema } from '../../validators/discussionValidator';
import {
  createDiscussion,
  getDiscussionById,
  addReply,
} from '../../controllers/discussion.controller';

const router = express.Router();

router.post('/', 
    validate(createDiscussionSchema), 
    asyncHandler(createDiscussion)
);
router.get('/:id', 
    asyncHandler(getDiscussionById)
);
router.post('/:id/reply', 
    asyncHandler(addReply)
);

export default router;