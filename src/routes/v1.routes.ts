import { Router } from 'express';
import communityRoutes from './community/v1/community.routes';
import discussionRoutes from './discussion/v1/discussion.routes';
import authRoutes from './user/v1/auth/auth.routes';
import userRoutes from './user/v1/user.routes';
import { AppError, ErrorCodes } from '@utils/appError';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/communities', communityRoutes);
router.use('/discussions', discussionRoutes);

router.use('*', (req, res, next) => {
  next(
    new AppError(
      'Invalid routing path: ' + req.originalUrl,
      404,
      ErrorCodes.NOT_FOUND
    )
  );
});

export default router;
