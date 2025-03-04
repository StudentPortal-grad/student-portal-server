import { Router } from 'express';
import communityRoutes from './v1/community.routes';
import discussionRoutes from './v1/discussion.routes';
import roleRoutes from './v1/role.routes';
import { AppError, ErrorCodes } from '@utils/appError';

const router = Router();

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
