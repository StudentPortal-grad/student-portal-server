import { Types } from 'mongoose';
import { AppError, ErrorCodes } from '../utils/appError';
import { IUser } from '../models/types';
import { UserRepository } from '../repositories/user.repo';
import { EmailService } from '../utils/emailService';
import { generateHashedOTP } from '@utils/helpers';
import { DbOperations } from '../utils/dbOperations';
import User from '../models/User';
import Discussion from '../models/Discussion';
import Resource from '../models/Resource';
import { getPaginationOptions, ParsedPaginationOptions } from '@utils/pagination';
import { NotFoundError } from '../utils/errors';
import { UploadService } from '../utils/uploadService';

export class UserService {
  /**
   * Get users with filtering, sorting, and pagination
   */
  // TODO: Get Profile Pic
  static async getUsers(query: any, currentUser?: IUser) {
    const {
      role,
      search,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      populateFollowers,
      populateFollowing,
      isFollowed,
      isBlocked,
      ...filters
    } = query;

    // Build query
    const queryObj: any = {};
    if (role) queryObj.role = role;
    if (status) queryObj.status = status;
    if (search) {
      queryObj.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
      ];
    }

    // Add conditional population
    const populatePaths: any[] = [];
    if (populateFollowers === 'true') {
      populatePaths.push({
        path: 'followers',
        select: '_id name username profilePicture'
      });
    }
    if (populateFollowing === 'true') {
      populatePaths.push({
        path: 'following',
        select: '_id name username profilePicture'
      });
    }

    const paginationOptions: ParsedPaginationOptions = getPaginationOptions({
      page: query.page,
      limit: query.limit,
      sortBy,
      sortOrder,
      populate: populatePaths.length > 0 ? populatePaths : undefined,
    });

    // Add field selection
    paginationOptions.select = '_id name email role createdAt followers following profilePicture';
    if (isBlocked === 'true') {
      paginationOptions.select += ' blockedUsers';
    }

    const result = await DbOperations.findWithPagination(
      User,
      queryObj,
      paginationOptions
    );

    if ((isFollowed === 'true' || isBlocked === 'true') && currentUser && result.data.length > 0) {
      const followingSet = isFollowed === 'true'
        ? new Set(currentUser.following?.map(id => id.toString()))
        : new Set();

      const users = result.data.map((user: any) => {
        const userObj = user.toObject();

        if (isFollowed === 'true') {
          userObj.isFollowed = followingSet.has(user._id.toString());
        }

        if (isBlocked === 'true') {
          const iBlockUser = currentUser.blockedUsers?.some((blockedId: any) => blockedId.equals(user._id)) ?? false;
          const userBlocksMe = user.blockedUsers?.some((blockedId: any) => blockedId.equals(currentUser._id)) ?? false;
          userObj.isBlocked = iBlockUser || userBlocksMe;
        }

        delete userObj.blockedUsers;
        return userObj;
      });

      result.data = users;
    }

    // Clean up followers array if not requested
    if (populateFollowers !== 'true') {
      result.data = result.data.map((user: any) => {
        const userObj = user.toObject ? user.toObject() : user;
        delete userObj.followers;
        return userObj;
      });
    }

    return result;
  }

  static async getSiblingStudents(currentUser: IUser, query: any) {
    if (!currentUser.level) {
      throw new NotFoundError('User level not set, cannot find siblings.');
    }

    const {
      search,
      sortBy = 'name',
      sortOrder = 'asc',
      ...filters
    } = query;

    const queryObj: any = {
      level: currentUser.level,
      _id: { $ne: currentUser._id }, // Exclude the current user
      role: 'student', // Ensure we only get students
    };

    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      queryObj.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { username: searchRegex },
      ];
    }

    const paginationOptions: ParsedPaginationOptions = getPaginationOptions({
      ...query,
      sortBy,
      sortOrder,
    });

    // Fields to be returned
    paginationOptions.select = '_id name username profilePicture level';

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
  static async getUserById(
    userId: Types.ObjectId,
    currentUser?: IUser,
    fields?: string[],
    options: {
      populateFollowers?: boolean;
      populateFollowing?: boolean;
      showPosts?: boolean;
      showResources?: boolean;
      limit?: number;
    } = {}
  ) {
    const { populateFollowers, populateFollowing, showPosts, showResources, limit = 10 } = options;
    // If fields are provided, use them; otherwise, select only the UI-needed fields
    let selectFields = fields?.length
      ? fields.join(' ')
      : '_id name email role createdAt profilePicture profile status level username following';

    // Ensure necessary fields are selected for isFollowed and isBlocked checks
    if (currentUser) {
      if (!selectFields.includes('followers')) selectFields += ' followers';
      if (!selectFields.includes('blockedUsers')) selectFields += ' blockedUsers';
    }

    let query = User.findById(userId).select(selectFields);

    if (populateFollowers) {
      query = query.populate({
        path: 'followers',
        select: '_id name username profilePicture'
      });
    }

    if (populateFollowing) {
      query = query.populate({
        path: 'following',
        select: '_id name username profilePicture'
      });
    }

    const user = await query;
    if (!user) {
      throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);
    }

    const userObj: Record<string, any> = user.toObject();

    if (currentUser) {
      userObj.isFollowed = user.followers?.some((followerId: any) => followerId.equals(currentUser._id)) ?? false;

      const iBlockUser = currentUser.blockedUsers?.some((blockedId: any) => blockedId.equals(user._id)) ?? false;
      const userBlocksMe = user.blockedUsers?.some((blockedId: any) => blockedId.equals(currentUser._id)) ?? false;
      userObj.isBlocked = iBlockUser || userBlocksMe;
    }

    // Clean up sensitive fields before returning
    if (userObj.blockedUsers) {
      delete userObj.blockedUsers;
    }
    // Clean up followers if not populated
    if (!populateFollowers && userObj.followers) {
      delete userObj.followers;
    }

    if (showPosts) {
      const posts = await Discussion.find({ creator: userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .select('title createdAt communityId');
      userObj.posts = posts;
    }

    if (showResources) {
      const resources = await Resource.find({ uploader: userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .select('title fileType createdAt');
      userObj.resources = resources;
    }

    return { user: userObj };
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