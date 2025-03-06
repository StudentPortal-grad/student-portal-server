import { Router } from 'express';
import { authenticate } from '@middleware/auth';
import meRoutes from './me.routes';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Mount /me routes
router.use('/me', meRoutes);

export default router;
