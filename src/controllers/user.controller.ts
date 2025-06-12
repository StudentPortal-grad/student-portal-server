import { Request, Response, NextFunction } from 'express';
import { AuthorizationError } from '../utils/errors';
import asyncHandler from '../utils/asyncHandler';
import { UserService } from '../services/user.service';
import { Types } from 'mongoose';
export class UserController {
  /**
   * @route   GET /v1/users
   * @desc    Get users with filtering, sorting, and pagination
   * @access  Admin, Faculty
   */
  static getUsers = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const { data, pagination } = await UserService.getUsers(req.query);
      res.paginated(data, pagination, 'Users retrieved successfully');
    }
  );

  static getSiblingStudents = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const user = req.user;
      if (!user) {
        throw new AuthorizationError('User not authenticated');
      }
      const { data, pagination } = await UserService.getSiblingStudents(
        user,
        req.query
      );
      res.paginated(data, pagination, 'Sibling students retrieved successfully');
    }
  );

  /**
   * @route   GET /v1/users/:userId
   * @desc    Get user by ID
   * @access  Admin, Faculty
   * @query   fields - The fields to select (optional)
   */
  static getUserById = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const fields = req.query.fields
        ? String(req.query.fields).split(',')
        : undefined;
      const result = await UserService.getUserById(
        new Types.ObjectId(req.params.userId),
        fields
      );
      res.success(result, 'User retrieved successfully');
    }
  );

  /**
   * @route   POST /v1/users
   * @desc    Create new user
   * @access  Admin
   */
  static createUser = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const result = await UserService.createUser(req.body);
      res.success(result, 'User created successfully', 201);
    }
  );

  /**
   * @route   PATCH /v1/users/:userId
   * @desc    Update user
   * @access  Admin
   */
  static updateUser = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const result = await UserService.updateUser(
        new Types.ObjectId(req.params.userId),
        req.body
      );
      res.success(result, 'User updated successfully');
    }
  );

  /**
   * @route   DELETE /v1/users/:userId
   * @desc    Delete user
   * @access  Admin
   */
  static deleteUser = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const userId = req.params.userId;
      await UserService.deleteUser(new Types.ObjectId(userId));
      res.success({ id: userId }, 'User deleted successfully');
    }
  );

  /**
   * @route   POST /v1/users/bulk/create
   * @desc    Bulk create users
   * @access  Admin
   */
  static bulkCreateUsers = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const result = await UserService.bulkCreateUsers(req.body.users);
      // Map users to only include allowed fields
      const users = (result.users || []).map((user: any) => ({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
      }));
      res.success({ users }, 'Users created successfully', 201);
    }
  );

  /**
   * @route   PATCH /v1/users/bulk/update
   * @desc    Bulk update users
   * @access  Admin
   */
  static bulkUpdateUsers = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const result = await UserService.bulkUpdateUsers(req.body.updates);
      res.success(result, 'Users updated successfully');
    }
  );

  /**
   * @route   DELETE /v1/users/bulk/delete
   * @desc    Bulk delete users
   * @access  Admin
   */
  static bulkDeleteUsers = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const result = await UserService.bulkDeleteUsers(req.body.userIds);
      res.success({
        deletedIds: req.body.userIds,
        count: result.count,
      }, 'Users deleted successfully');
    }
  );

  /**
   * @route   PATCH /v1/users/:userId/status
   * @desc    Update user status
   * @access  Admin
   */
  static updateUserStatus = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const userId = req.params.userId;
      const status = req.body.status;
      await UserService.updateUserStatus(
        new Types.ObjectId(userId),
        status
      );
      res.success({ id: userId, status }, 'User status updated successfully');
    }
  );

  /**
   * @route   PATCH /v1/users/:userId/role
   * @desc    Update user role
   * @access  Admin
   */
  static updateUserRole = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const result = await UserService.updateUserRole(
        new Types.ObjectId(req.params.userId),
        req.body.role
      );
      const user = result.user;
      res.success({
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        }
      }, 'User role updated successfully');
    }
  );

  /**
   * @route   GET /v1/users/me
   * @desc    Get current user profile
   */
  static getMe = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const user = req.user!;
      res.success({ user }, 'Profile retrieved successfully');
    }
  );

  /**
   * @route   PATCH /v1/users/me
   * @desc    Update current user profile
   */
  static updateMe = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const result = await UserService.updateUser(req.user!._id, req.body);
      res.success(result, 'Profile updated successfully');
    }
  );

  /**
   * @route   DELETE /v1/users/me
   * @desc    Delete current user account
   */
  static deleteMe = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      await UserService.deleteUser(req.user!._id);
      res.success({}, 'Account deleted successfully');
    }
  );

  /**
   * @route   PATCH /v1/users/me/password
   * @desc    Update current user password
   */
  static updateMyPassword = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const { currentPassword, newPassword } = req.body;
      const result = await UserService.updatePassword(
        req.user!,
        currentPassword,
        newPassword
      );
      res.success(result, 'Password updated successfully');
    }
  );

  /**
   * @route   PATCH /v1/users/me/email
   * @desc    Update current user email
   */
  static updateMyEmail = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const { newEmail } = req.body;
      const result = await UserService.initiateEmailChange(req.user!, newEmail);
      res.success(result, 'Email change initiated successfully');
    }
  );

  /**
   * @route   PATCH /v1/users/me/university-email
   * @desc    Update university email
   */
  static updateUniversityEmail = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const { universityEmail } = req.body;
      const result = await UserService.updateUniversityEmail(
        req.user!,
        universityEmail
      );
      res.success(result, 'University email updated successfully');
    }
  );

  /**
   * @route   PATCH /v1/users/:userId/suspend
   * @desc    Suspend user account
   * @access  Admin, Superadmin
   */
  static suspendUser = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const { reason, duration } = req.body;
      const result = await UserService.suspendUser(
        new Types.ObjectId(req.params.userId),
        { reason, duration }
      );
      const user = result.user;
      res.success({
        user: {
          id: user._id,
          isSuspended: user.isSuspended,
          suspensionReason: user.suspensionReason,
          suspendedUntil: user.suspendedUntil,
        }
      }, 'User suspended successfully');
    }
  );

  /**
   * @route   PATCH /v1/users/:userId/unsuspend
   * @desc    Unsuspend user account
   * @access  Admin, Superadmin
   */
  static unsuspendUser = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const result = await UserService.unsuspendUser(
        new Types.ObjectId(req.params.userId)
      );
      const user = result.user;
      res.success({
        user: {
          id: user._id,
          isSuspended: user.isSuspended,
        }
      }, 'User unsuspended successfully');
    }
  );

  /**
   * @route   POST /v1/users/admin
   * @desc    Create new admin user (SuperAdmin only)
   * @access  SuperAdmin
   */
  static createAdmin = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      // Always set role to 'admin' regardless of input
      const adminData = { ...req.body, role: 'admin' };
      const result = await UserService.createAdmin(adminData);
      const user = result.user;
      res.success({
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          createdAt: user.createdAt,
        }
      }, 'Admin user created successfully', 201);
    }
  );
}
