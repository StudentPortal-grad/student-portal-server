import { Types } from 'mongoose';
import { AppError, ErrorCodes } from '../utils/appError';
import { IUser } from '../models/types';
import { UserRepository } from '../repositories/user.repo';
import { EmailService } from '../utils/emailService';
import { generateHashedOTP } from '@utils/helpers';

export class UserService {
  /**
   * Update user profile
   */
  static async updateProfile(user: IUser, updateData: Partial<IUser>) {
    // Remove sensitive fields that shouldn't be updated directly
    const sanitizedData = { ...updateData };
    delete sanitizedData.email;
    delete sanitizedData.password;
    delete sanitizedData.emailVerified;
    delete sanitizedData.universityEmail;
    delete sanitizedData.universityEmailVerified;
    delete sanitizedData.otp;
    delete sanitizedData.roles;

    const updatedUser = await UserRepository.update(user._id, sanitizedData);
    if (!updatedUser) {
      throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);
    }

    return { user: updatedUser };
  }

  /**
   * Delete user account
   */
  static async deleteAccount(userId: Types.ObjectId) {
    const user = await UserRepository.delete(userId);
    if (!user) {
      throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);
    }
  }

  /**
   * Update user password
   */
  static async updatePassword(user: IUser, currentPassword: string, newPassword: string) {
    const userWithPassword = await UserRepository.findByIdWithPassword(user._id);
    if (!userWithPassword) {
      throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);
    }

    const isMatch = await userWithPassword.comparePassword(currentPassword);
    if (!isMatch) {
      throw new AppError(
        'Current password is incorrect',
        401,
        ErrorCodes.UNAUTHORIZED
      );
    }

    userWithPassword.password = newPassword;
    await userWithPassword.save();

    return { message: 'Password updated successfully' };
  }

  /**
   * Update university email
   */
  static async updateUniversityEmail(user: IUser, universityEmail: string) {
    // Check if email is already in use
    const existingUser = await UserRepository.findByUniversityEmail(universityEmail);
    if (existingUser && existingUser._id.toString() !== user._id.toString()) {
      throw new AppError(
        'University email already registered',
        400,
        ErrorCodes.ALREADY_EXISTS
      );
    }

    // Update university email and reset verification
    const updatedUser = await UserRepository.update(user._id, {
      universityEmail,
      universityEmailVerified: false,
    });

    if (!updatedUser) {
      throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);
    }

    return { user: updatedUser };
  }

  /**
   * Initiate email change
   */
  static async initiateEmailChange(userId: Types.ObjectId, newEmail: string) {
    const user = await UserRepository.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Check if new email is already in use
    const existingUser = await UserRepository.findByEmail(newEmail);
    if (existingUser) {
      throw new AppError(
        'Email already registered',
        400,
        ErrorCodes.ALREADY_EXISTS
      );
    }

    // Generate and store OTP
    const { otp, hashedOtp } = generateHashedOTP();
    user.otp = {
      code: hashedOtp,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    };
    user.set('tempEmail', newEmail);
    await user.save();

    // Send verification email
    await EmailService.sendVerificationOTP(newEmail, otp);

    return { message: 'Verification code sent to new email' };
  }
}
