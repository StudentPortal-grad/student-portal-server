import { Router } from 'express';
import { authenticate } from '@middleware/auth';
import { authorize } from '@middleware/auth';
import { validate } from '@middleware/validate';
import { userValidation } from '@validations/userValidation';
import { UserController } from '@controllers/user.controller';
import meRoutes from './me.routes';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Mount /me routes
router.use('/me', meRoutes);

// Admin/Dashboard routes
// Get users with filtering, sorting, and pagination
router.get(
  '/',
  authorize('admin', 'faculty'),
  validate(userValidation.getUsersQuery),
  UserController.getUsers
);

// Get specific user by ID
router.get(
  '/:userId',
  authorize('admin', 'faculty'),
  UserController.getUserById
);

// Create new user (admin only)
router.post(
  '/',
  authorize('admin'),
  validate(userValidation.createUser),
  UserController.createUser
);

// Update user (admin only)
router.patch(
  '/:userId',
  authorize('admin'),
  validate(userValidation.updateUser),
  UserController.updateUser
);

// Delete user (admin only)
router.delete(
  '/:userId',
  authorize('admin'),
  validate(userValidation.deleteUser),
  UserController.deleteUser
);

// Bulk operations (admin only)
router.post(
  '/bulk/create',
  authorize('admin'),
  validate(userValidation.bulkCreateUsers),
  UserController.bulkCreateUsers
);

router.patch(
  '/bulk/update',
  authorize('admin'),
  validate(userValidation.bulkUpdateUsers),
  UserController.bulkUpdateUsers
);

router.delete(
  '/bulk/delete',
  authorize('admin'),
  validate(userValidation.bulkDeleteUsers),
  UserController.bulkDeleteUsers
);

// User status management
router.patch(
  '/:userId/status',
  authorize('admin'),
  validate(userValidation.updateUserStatus),
  UserController.updateUserStatus
);

// Role management
router.patch(
  '/:userId/role',
  authorize('admin'),
  validate(userValidation.updateUserRole),
  UserController.updateUserRole
);

export default router;
