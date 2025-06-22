import { Router } from 'express';
import { authenticate } from '../../../middleware/auth';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  createNotification,
  markConversationNotificationsAsRead,
  testNotification,
} from '../../../controllers/notification.controller';

const router = Router();

router.use(authenticate);

// Get user's notifications with pagination (includes unread count)
router.get('/', getNotifications);

// Create notification (for internal use)
router.post('/', createNotification);

// Mark specific notification as read
router.patch('/:notificationId/read', markAsRead);

// Mark all notifications as read
router.patch('/read-all', markAllAsRead);

// Mark conversation notifications as read
router.patch('/conversation/:conversationId/read', markConversationNotificationsAsRead);

// Test notification
router.post('/test', testNotification);

export default router;
