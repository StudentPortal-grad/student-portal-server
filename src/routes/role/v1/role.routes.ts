import express from 'express';
import * as roleController from '@controllers/role.controller';
import { validate } from '@middleware/validate';
import { createRoleSchema, updateRoleSchema } from '@validations/roleValidation';
import { authenticate, authorize } from '@middleware/auth';
import { RolePermissions } from '@models/Role';

const router = express.Router();

// Apply authentication middleware to all role routes
router.use(authenticate);

// Create a new role
router.post(
  '/',
  validate(createRoleSchema),
  roleController.createRole
);

// Get all roles
router.get('/', roleController.getAllRoles);

// Get a role by ID
router.get('/:id', roleController.getRoleById);

// Get all roles for a community
router.get('/community/:communityId', roleController.getCommunityRoles);

// Update a role
router.put(
  '/:id',
  validate(updateRoleSchema),
  roleController.updateRole
);

// Delete a role
router.delete('/:id', roleController.deleteRole);

// Add a permission to a role
router.post('/:id/permissions', roleController.addPermission);

// Remove a permission from a role
router.delete('/:id/permissions', roleController.removePermission);

// Assign a role to a community member
router.post(
  '/community/:communityId/user/:userId/role/:roleId',
  roleController.assignRoleToMember
);

// Remove a role from a community member
router.delete(
  '/community/:communityId/user/:userId/role/:roleId',
  roleController.removeRoleFromMember
);

// Get all roles for a community member
router.get(
  '/community/:communityId/user/:userId',
  roleController.getMemberRoles
);

// Check if a user has a specific permission in a community
router.get(
  '/community/:communityId/user/:userId/check-permission',
  roleController.checkPermission
);

export default router;
