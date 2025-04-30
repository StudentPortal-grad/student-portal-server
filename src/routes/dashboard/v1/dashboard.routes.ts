import express from 'express';
import { authenticate, authorize } from '@middleware/auth';
import asyncHandler from '@utils/asyncHandler';
import {
  getDashboardStats,
  getUserCountHistory,
  getRecentNotifications
} from '@controllers/dashboard.controller';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// All dashboard routes require admin or faculty access
router.use(authorize('admin', 'superadmin', 'faculty'));

// Dashboard home routes
router.get('/stats', asyncHandler(getDashboardStats));
router.get('/user-history', asyncHandler(getUserCountHistory));
router.get('/notifications', asyncHandler(getRecentNotifications));

export default router;
