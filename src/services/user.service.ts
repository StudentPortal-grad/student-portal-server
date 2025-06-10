import { Types } from 'mongoose';
import { AppError, ErrorCodes } from '../utils/appError';
import { IUser } from '../models/types';
import { UserRepository } from '../repositories/user.repo';
import { EmailService } from '../utils/emailService';
import { generateHashedOTP } from '@utils/helpers';
import { DbOperations } from '../utils/dbOperations';
import User from '../models/User';
import { getPaginationOptions } from '@utils/pagination';
import { UploadService } from '../utils/uploadService';

export class UserService {
  /**
   * Get users with filtering, sorting, and pagination
   */
  static async getUsers(query: any) {
    const {
      role,
      search,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      ...filters
    } = query;

    // Build query
    const queryObj = { ...filters };
    if (role) queryObj.role = role;
    if (status) queryObj.status = status;
    if (search) {
      queryObj.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
      ];
    }

    const paginationOptions = getPaginationOptions({
      ...query,
      sortBy,
      sortOrder,
    });

    // Add field selection
    paginationOptions.select = '_id name email role createdAt';

    return await DbOperations.findWithPagination(
      User,
      queryObj,
      paginationOptions
    );
  }

  /**
   * Get user by ID
   * @param userId - The ID of the user to get
   * @param fields - The fields to select (optional)
   * @returns The user object
   */
  static async getUserById(userId: Types.ObjectId, fields?: string[]) {
    const user = await User.findById(userId).select(fields?.join(' ') || '');
    if (!user) {
      throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);
    }
    return { user };
  }

  /**
   * Create new user
   */
  static async createUser(userData: Partial<IUser>) {
    const existingUser = await UserRepository.findByEmail(userData.email!);
    if (existingUser) {
      throw new AppError(
        'Email already registered',
        400,
        ErrorCodes.ALREADY_EXISTS
      );
    }

    const user = await DbOperations.create(User, userData);
    return { user };
  }

  /**
   * Create new admin user (SuperAdmin only)
   */
  static async createAdmin(userData: Partial<IUser>) {
    const existingUser = await UserRepository.findByEmail(userData.email!);
    if (existingUser) {
      throw new AppError(
        'Email already registered',
        400,
        ErrorCodes.ALREADY_EXISTS
      );
    }
    // Always set role to 'admin'
    userData.role = 'admin';
    const user = await DbOperations.create(User, userData);

    // Generate and send verification OTP
    const { otp, hashedOtp } = generateHashedOTP();
    user.otp = {
      code: hashedOtp,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    };
    await user.save();
    await EmailService.sendVerificationOTP(user.email, otp);

    return { user };
  }

  /**
   * Update user
   */
  static async updateUser(userId: Types.ObjectId, updateData: Partial<IUser>) {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Handle profile picture update if it's being changed
    if (updateData.profilePicture && 
        user.profilePicture && 
        user.profilePicture !== updateData.profilePicture) {
      try {
        await UploadService.deleteFile(user.profilePicture);
      } catch (error) {
        console.error('Error deleting old profile picture:', error);
      }
    }

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
      runValidators: true,
    });

    return { user: updatedUser };
  }

  /**
   * Delete user
   */
  static async deleteUser(userId: Types.ObjectId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Delete profile picture if exists
    if (user.profilePicture) {
      try {
        await UploadService.deleteFile(user.profilePicture);
      } catch (error) {
        console.error('Error deleting profile picture:', error);
      }
    }

    await User.findByIdAndDelete(userId);
    return {};
  }

  /**
   * Bulk create users
   */
  static async bulkCreateUsers(users: Partial<IUser>[]) {
    const createdUsers = await DbOperations.create(User, users);
    return { users: createdUsers };
  }

  /**
   * Bulk update users
   */
  static async bulkUpdateUsers(
    updates: { userId: Types.ObjectId; data: Partial<IUser> }[]
  ) {
    const operations = updates.map((update) => ({
      updateOne: {
        filter: { _id: update.userId },
        update: { $set: update.data },
      },
    }));

    await User.bulkWrite(operations);
    return { count: updates.length };
  }

  /**
   * Bulk delete users
   */
  static async bulkDeleteUsers(userIds: string[]) {
    const result = await User.deleteMany({ _id: { $in: userIds } });
    return { count: result.deletedCount };
  }

  /**
   * Update user status
   */
  static async updateUserStatus(
    userId: Types.ObjectId,
    status: 'online' | 'offline' | 'idle' | 'dnd'
  ) {
    const user = await UserRepository.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);
    }

    user.status = status;
    await DbOperations.saveDocument(user);
    return { user };
  }

  /**
   * Update user role
   */
  static async updateUserRole(
    userId: Types.ObjectId,
    role: 'student' | 'faculty' | 'admin'
  ) {
    const user = await UserRepository.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);
    }

    user.role = role;
    await DbOperations.saveDocument(user);
    return { user };
  }

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
    return {};
  }

  /**
   * Suspend user account
   * @param userId - The ID of the user to suspend
   * @param suspensionData - Suspension details
   */
  static async suspendUser(
    userId: Types.ObjectId,
    suspensionData: { reason: string; duration?: number }
  ) {
    const user = await UserRepository.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Set suspension fields
    user.isSuspended = true;
    user.suspensionReason = suspensionData.reason;
    
    // Set suspension duration if provided
    if (suspensionData.duration) {
      const suspendedUntil = new Date();
      suspendedUntil.setDate(suspendedUntil.getDate() + suspensionData.duration);
      user.suspendedUntil = suspendedUntil;
    }

    await DbOperations.saveDocument(user);
    return { user };
  }

  /**
   * Unsuspend user account
   * @param userId - The ID of the user to unsuspend
   */
  static async unsuspendUser(userId: Types.ObjectId) {
    const user = await UserRepository.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Remove suspension
    user.isSuspended = false;
    user.suspensionReason = undefined;
    user.suspendedUntil = undefined;

    await DbOperations.saveDocument(user);
    return { user };
  }
}
