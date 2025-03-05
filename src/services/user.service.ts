import { Types } from 'mongoose';
import { AppError, ErrorCodes } from '../utils/appError';
import { IUser } from '../models/types';
import { UserRepository } from '../repositories/user.repo';
import { EmailService } from '../utils/emailService';
import { generateHashedOTP } from '@utils/helpers';
import { DbOperations } from '../utils/dbOperations';
import User from '../models/User';

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

    return { user: await DbOperations.updateDocument(user, sanitizedData) };
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
  static async updatePassword(
    user: IUser,
    currentPassword: string,
    newPassword: string
  ) {
    const userWithPassword = await DbOperations.findOne(
      User,
      { _id: user._id },
      { password: 1 }
    );

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
    await DbOperations.saveDocument(userWithPassword);

    return { message: 'Password updated successfully' };
  }

  /**
   * Update university email
   */
  static async updateUniversityEmail(user: IUser, universityEmail: string) {
    // Check if email is already in use
    const isEmailTaken = await UserRepository.isUniversityEmailTaken(
      universityEmail,
      user._id
    );
    if (isEmailTaken) {
      throw new AppError(
        'University email already registered',
        400,
        ErrorCodes.ALREADY_EXISTS
      );
    }

    // Update university email and reset verification
    return {
      user: await DbOperations.updateDocument(user, {
        universityEmail,
        universityEmailVerified: false,
      }),
    };
  }

  /**
   * Initiate email change
   */
  static async initiateEmailChange(user: IUser, newEmail: string) {
    // Check if new email is already in use
    const isEmailTaken = await UserRepository.isEmailTaken(newEmail, user._id);
    if (isEmailTaken) {
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
    await DbOperations.saveDocument(user);

    // Send verification email
    await EmailService.sendVerificationOTP(newEmail, otp);

    return { message: 'Verification code sent to new email' };
  }

  static async deleteProfile(user: IUser) {
    await DbOperations.deleteDocument(user);
    return { message: 'User deleted successfully' };
  }
}
