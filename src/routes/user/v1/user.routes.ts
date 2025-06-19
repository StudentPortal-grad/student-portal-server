import { Router } from 'express';
import { authenticate, authorize } from '@middleware/auth';
import { validate } from '@middleware/validate';
import { userValidation } from '@validations/userValidation';
import { UserController } from '@controllers/user.controller';
import * as blockValidation from '@validations/block.validation';
import * as followValidation from '@validations/follow.validation';
import * as blockController from '@controllers/block.controller';
import * as followController from '@controllers/follow.controller';
import { checkBlocked } from '@middleware/checkBlocked';
import { preventSelfAction } from '@middleware/preventSelfAction.middleware';
import meRoutes from './me.routes';
import { uploadProfilePicture } from '@utils/uploadService';
import friendRoutes from './friend.routes';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Route for SuperAdmin to create Admin users
router.post(
  '/admin',
  authorize('superadmin'),
  validate(userValidation.createUser),
  UserController.createAdmin
);

router.use("/friends", friendRoutes);

// Mount /me routes
router.use('/me', meRoutes);

// Get sibling students
router.get(
  '/siblings',
  validate(userValidation.getSiblingStudentsQuery),
  UserController.getSiblingStudents
);

// Admin/Dashboard routes
// Get users with filtering, sorting, and pagination
router.get(
  '/',
  // authorize('superadmin', 'admin', 'faculty'),
  validate(userValidation.getUsersQuery),
  UserController.getUsers
);

// Get specific user by ID
router.get(
  '/:userId',
  // authorize('superadmin', 'admin', 'faculty'), // For getting profiles in mobile app search
  validate(userValidation.getUserById.params, 'params'),
  validate(userValidation.getUserById.query, 'query'),
  UserController.getUserById
);

// Create new user (admin only)
router.post(
  '/',
  authorize('superadmin', 'admin'),
  uploadProfilePicture,
  validate(userValidation.createUser),
  UserController.createUser
);

// Update user (admin only)
router.patch(
  '/:userId',
  authorize('superadmin', 'admin'),
  uploadProfilePicture,
  validate(userValidation.updateUser),
  UserController.updateUser
);

// Delete user (admin only)
router.delete(
  '/:userId',
  authorize('superadmin', 'admin'),
  validate(userValidation.deleteUser, 'params'),
  UserController.deleteUser
);

// Bulk operations (admin only)
router.post(
  '/bulk/create',
  authorize('superadmin', 'admin'),
  validate(userValidation.bulkCreateUsers),
  UserController.bulkCreateUsers
);

router.patch(
  '/bulk/update',
  authorize('superadmin', 'admin'),
  validate(userValidation.bulkUpdateUsers),
  UserController.bulkUpdateUsers
);

router.delete(
  '/bulk/delete',
  authorize('superadmin', 'admin'),
  validate(userValidation.bulkDeleteUsers),
  UserController.bulkDeleteUsers
);

// User status management
router.patch(
  '/:userId/status',
  authorize('superadmin', 'admin'),
  validate(userValidation.updateUserStatus),
  UserController.updateUserStatus
);

// User suspension management
router.patch(
  '/:userId/suspend',
  authorize('admin', 'superadmin'),
  validate(userValidation.suspendUser),
  UserController.suspendUser
);

router.patch(
  '/:userId/unsuspend',
  authorize('admin', 'superadmin'),
  UserController.unsuspendUser
);

// Role management
router.patch(
  '/:userId/role',
  authorize('superadmin', 'admin'),
  validate(userValidation.updateUserRole),
  UserController.updateUserRole
);

// Block management
router.patch(
  '/:userId/block',
  validate(blockValidation.blockUser.params, 'params'),
  preventSelfAction,
  blockController.blockUser
);

router.patch(
  '/:userId/unblock',
  validate(blockValidation.unblockUser.params, 'params'),
  preventSelfAction,
  blockController.unblockUser
);

// Follow management

router.post('/:userId/follow', validate(followValidation.followUser.params, 'params'), preventSelfAction, checkBlocked, followController.followUser);
router.post('/:userId/unfollow', validate(followValidation.unfollowUser.params, 'params'), preventSelfAction, checkBlocked, followController.unfollowUser);

// Get followers/following
router.get('/:userId/followers', validate(followValidation.getFollowers.params, 'params'), validate(followValidation.getFollowers.query, 'query'), checkBlocked, followController.getFollowers);
router.get('/:userId/following', validate(followValidation.getFollowing.params, 'params'), validate(followValidation.getFollowing.query, 'query'), checkBlocked, followController.getFollowing);

// Check following status
router.get('/:userId/following/:targetUserId', validate(followValidation.isFollowing.params, 'params'), checkBlocked, followController.isFollowing);

// Get mutual followers
router.get('/:userId/followers/mutual', validate(followValidation.getMutualFollowers.params, 'params'), checkBlocked, followController.getMutualFollowers);

// Get follow suggestions
router.get('/suggestions', validate(followValidation.getFollowSuggestions.query, 'query'), followController.getFollowSuggestions);


export default router;
