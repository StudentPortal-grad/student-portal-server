import { Router } from 'express';
import { authenticate } from '../../../middleware/auth';
import {
  updateFCMToken,
  removeFCMToken,
  getFCMStatus,
  subscribeToTopic,
  unsubscribeFromTopic,
} from '../../../controllers/fcm.controller';

const router = Router();

// Apply authentication middleware to all FCM routes
router.use(authenticate);

// Update FCM token
router.post('/token', updateFCMToken);

// Remove FCM token (logout)
router.delete('/token', removeFCMToken);

// Get FCM status
router.get('/status', getFCMStatus);

// Subscribe to topic
router.post('/subscribe', subscribeToTopic);

// Unsubscribe from topic
router.post('/unsubscribe', unsubscribeFromTopic);

export default router; 