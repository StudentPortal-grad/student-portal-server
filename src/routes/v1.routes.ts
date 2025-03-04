import { Router } from 'express';
import communityRoutes from './community/v1/community.routes';
import discussionRoutes from './discussion/v1/discussion.routes';
import roleRoutes from './role/v1/role.routes';
import authRoutes from './User/v1/auth/auth.routes';
import { AppError, ErrorCodes } from '@utils/appError';

const router = Router();

router.use('/auth', authRoutes);
router.use('/communities', communityRoutes);
router.use('/discussions', discussionRoutes);
router.use('/roles', roleRoutes);

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
