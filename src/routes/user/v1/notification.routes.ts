import { Router } from 'express';
import { authenticate } from '../../../middleware/auth';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  createNotification,
} from '../../../controllers/notification.controller';

const router = Router();

router.use(authenticate);

router.post('/', createNotification);
router.get('/', getNotifications);
router.patch('/:notificationId/read', markAsRead);
router.patch('/read-all', markAllAsRead);

export default router; 