import { Request, Response, NextFunction } from 'express';
import asyncHandler from '../utils/asyncHandler';
import { UserService } from '../services/user.service';

export class UserController {
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
      const result = await UserService.updateProfile(req.user!, req.body);
      res.success(result, 'Profile updated successfully');
    }
  );

  /**
   * @route   DELETE /v1/users/me
   * @desc    Delete current user account
   */
  static deleteMe = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      await UserService.deleteAccount(req.user!._id);
      res.success(null, 'Account deleted successfully');
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
}
