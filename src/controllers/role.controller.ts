import { Request, Response, NextFunction } from 'express';
import { RoleService } from '../services/role.service';
import { AppError, ErrorCodes } from '../utils/appError';
import { Types } from 'mongoose';
import { RolePermissions } from '../models/Role';

const roleService = new RoleService();

/**
 * Create a new role
 */
export const createRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Ensure the user has permission to create roles in this community
    const { communityId } = req.body;
    const userId = req.user?._id;
    
    if (!userId) {
      return next(new AppError('User not authenticated', 401, ErrorCodes.UNAUTHORIZED));
    }
    
    // Create the role
    const role = await roleService.createRole(req.body);
    res.success(role, 'Role created successfully', 201);
  } catch (error) {
    next(new AppError(error instanceof Error ? error.message : 'An unknown error occurred', 500, ErrorCodes.INTERNAL_ERROR));
  }
};

/**
 * Get all roles
 */
export const getAllRoles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const roles = await roleService.getAllRoles();
    res.success(roles, 'Roles retrieved successfully');
  } catch (error) {
    next(new AppError(error instanceof Error ? error.message : 'An unknown error occurred', 500, ErrorCodes.INTERNAL_ERROR));
  }
};

/**
 * Get a role by ID
 */
export const getRoleById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const role = await roleService.getRoleById(id);
    res.success(role, 'Role retrieved successfully');
  } catch (error) {
    next(new AppError(error instanceof Error ? error.message : 'An unknown error occurred', 500, ErrorCodes.INTERNAL_ERROR));
  }
};

/**
 * Get all roles for a community
 */
export const getCommunityRoles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { communityId } = req.params;
    const roles = await roleService.getCommunityRoles(communityId);
    res.success(roles, 'Community roles retrieved successfully');
  } catch (error) {
    next(new AppError(error instanceof Error ? error.message : 'An unknown error occurred', 500, ErrorCodes.INTERNAL_ERROR));
  }
};

/**
 * Update a role
 */
export const updateRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;
    
    if (!userId) {
      return next(new AppError('User not authenticated', 401, ErrorCodes.UNAUTHORIZED));
    }
    
    const updatedRole = await roleService.updateRole(id, req.body);
    res.success(updatedRole, 'Role updated successfully');
  } catch (error) {
    next(new AppError(error instanceof Error ? error.message : 'An unknown error occurred', 500, ErrorCodes.INTERNAL_ERROR));
  }
};

/**
 * Delete a role
 */
export const deleteRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;
    
    if (!userId) {
      return next(new AppError('User not authenticated', 401, ErrorCodes.UNAUTHORIZED));
    }
    
    const deletedRole = await roleService.deleteRole(id);
    res.success(deletedRole, 'Role deleted successfully');
  } catch (error) {
    next(new AppError(error instanceof Error ? error.message : 'An unknown error occurred', 500, ErrorCodes.INTERNAL_ERROR));
  }
};

/**
 * Add a permission to a role
 */
export const addPermission = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { permission } = req.body;
    const userId = req.user?._id;
    
    if (!userId) {
      return next(new AppError('User not authenticated', 401, ErrorCodes.UNAUTHORIZED));
    }
    
    // Validate permission
    const permissionValue = parseInt(permission);
    if (isNaN(permissionValue)) {
      return next(new AppError('Invalid permission value', 400, ErrorCodes.VALIDATION_ERROR));
    }
    
    const role = await roleService.addPermission(id, permissionValue);
    res.success(role, 'Permission added successfully');
  } catch (error) {
    next(new AppError(error instanceof Error ? error.message : 'An unknown error occurred', 500, ErrorCodes.INTERNAL_ERROR));
  }
};

/**
 * Remove a permission from a role
 */
export const removePermission = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { permission } = req.body;
    const userId = req.user?._id;
    
    if (!userId) {
      return next(new AppError('User not authenticated', 401, ErrorCodes.UNAUTHORIZED));
    }
    
    // Validate permission
    const permissionValue = parseInt(permission);
    if (isNaN(permissionValue)) {
      return next(new AppError('Invalid permission value', 400, ErrorCodes.VALIDATION_ERROR));
    }
    
    const role = await roleService.removePermission(id, permissionValue);
    res.success(role, 'Permission removed successfully');
  } catch (error) {
    next(new AppError(error instanceof Error ? error.message : 'An unknown error occurred', 500, ErrorCodes.INTERNAL_ERROR));
  }
};

/**
 * Assign a role to a community member
 */
export const assignRoleToMember = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { communityId, userId, roleId } = req.params;
    const currentUserId = req.user?._id;
    
    if (!currentUserId) {
      return next(new AppError('User not authenticated', 401, ErrorCodes.UNAUTHORIZED));
    }
    
    const success = await roleService.assignRoleToMember(communityId, userId, roleId);
    if (success) {
      res.success(null, 'Role assigned successfully');
    } else {
      next(new AppError('Failed to assign role', 400, ErrorCodes.INVALID_OPERATION));
    }
  } catch (error) {
    next(new AppError(error instanceof Error ? error.message : 'An unknown error occurred', 500, ErrorCodes.INTERNAL_ERROR));
  }
};

/**
 * Remove a role from a community member
 */
export const removeRoleFromMember = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { communityId, userId, roleId } = req.params;
    const currentUserId = req.user?._id;
    
    if (!currentUserId) {
      return next(new AppError('User not authenticated', 401, ErrorCodes.UNAUTHORIZED));
    }
    
    const success = await roleService.removeRoleFromMember(communityId, userId, roleId);
    if (success) {
      res.success(null, 'Role removed successfully');
    } else {
      next(new AppError('Failed to remove role', 400, ErrorCodes.INVALID_OPERATION));
    }
  } catch (error) {
    next(new AppError(error instanceof Error ? error.message : 'An unknown error occurred', 500, ErrorCodes.INTERNAL_ERROR));
  }
};

/**
 * Get all roles for a community member
 */
export const getMemberRoles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { communityId, userId } = req.params;
    const roles = await roleService.getMemberRoles(communityId, userId);
    res.success(roles, 'Member roles retrieved successfully');
  } catch (error) {
    next(new AppError(error instanceof Error ? error.message : 'An unknown error occurred', 500, ErrorCodes.INTERNAL_ERROR));
  }
};

/**
 * Check if a user has a specific permission in a community
 */
export const checkPermission = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { communityId, userId } = req.params;
    const { permission } = req.query;
    
    // Validate permission
    const permissionValue = parseInt(permission as string);
    if (isNaN(permissionValue)) {
      return next(new AppError('Invalid permission value', 400, ErrorCodes.VALIDATION_ERROR));
    }
    
    const hasPermission = await roleService.hasPermission(userId, communityId, permissionValue);
    res.success({ hasPermission }, 'Permission check completed');
  } catch (error) {
    next(new AppError(error instanceof Error ? error.message : 'An unknown error occurred', 500, ErrorCodes.INTERNAL_ERROR));
  }
};