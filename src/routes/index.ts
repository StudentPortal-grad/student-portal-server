import { Router } from 'express';
import communityRoutes from './community.routes';
import discussionRoutes from './discussion.routes';
import roleRoutes from './role.routes';
import AppError from '../utils/appError';

const router = Router();

router.use('/communities', communityRoutes);
router.use('/discussions', discussionRoutes);
router.use('/roles', roleRoutes);

// Handle invalid routes
router.use('*', (req, res, next) => {
    next(new AppError('Invalid routing path: ' + req.originalUrl, 404));
});

export default router;