import { Types } from 'mongoose';
import User from '../models/User';
import { IUser } from '../models/types';
import { DbOperations } from '../utils/dbOperations';

export class UserRepository {
  static async findById(id: Types.ObjectId) {
    return DbOperations.findOne(User, { _id: id });
  }

  /**
   * Find user by email (checks both regular and university email)
   */
  static async findByEmail(email: string) {
    return DbOperations.findOne(User, {
      $or: [{ email }, { universityEmail: email }]
    });
  }

  static async findByUniversityEmail(email: string) {
    return DbOperations.findOne(User, { universityEmail: email });
  }

  static async update(id: Types.ObjectId, updateData: Partial<IUser>) {
    return DbOperations.updateOne(User, { _id: id }, updateData, { new: true });
  }

  static async delete(id: Types.ObjectId) {
    return DbOperations.deleteOne(User, { _id: id });
  }

  static async findByIdWithPassword(id: Types.ObjectId) {
    return DbOperations.findOne(User, { _id: id }, { password: 1 });
  }

  /**
   * Find user by email with password field
   */
  static async findByEmailWithPassword(email: string) {
    return DbOperations.findOne(
      User,
      { email },
      { password: 1 }
    );
  }

  /**
   * Find user by OTP code that hasn't expired
   */
  static async findByOTPCode(otpCode: string) {
    return DbOperations.findOne(
      User,
      {
        'otp.code': otpCode,
        'otp.expiresAt': { $gt: new Date() }
      },
      { password: 1 }
    );
  }

  /**
   * Update user document directly without querying
   */
  static async updateDocument(user: IUser, updateData: Partial<IUser>, skipValidation: boolean = false) {
    return DbOperations.updateDocument(user, updateData, { runValidators: !skipValidation });
  }

  /**
   * Delete user document directly without querying
   */
  static async deleteDocument(user: IUser) {
    return DbOperations.deleteDocument(user);
  }

  /**
   * Save user document with option to skip validation
   */
  static async saveDocument(user: IUser, skipValidation: boolean = false) {
    return DbOperations.saveDocument(user, skipValidation);
  }

  /**
   * Update user status directly without validation
   */
  static async updateStatus(user: IUser, status: 'online' | 'offline' | 'idle' | 'dnd') {
    return DbOperations.updateDocument(user, { status }, { runValidators: false });
  }

  /**
   * Find online users with minimal fields
   */
  static async findOnlineUsers() {
    return DbOperations.findMany(
      User,
      { status: 'online' },
      { name: 1, status: 1 }
    );
  }

  /**
   * Check if email is already in use by another user
   */
  static async isEmailTaken(email: string, excludeUserId?: Types.ObjectId) {
    const query = excludeUserId 
      ? { email, _id: { $ne: excludeUserId } }
      : { email };
    
    return DbOperations.findOne(User, query) !== null;
  }

  /**
   * Check if university email is already in use by another user
   */
  static async isUniversityEmailTaken(email: string, excludeUserId?: Types.ObjectId) {
    const query = excludeUserId 
      ? { universityEmail: email, _id: { $ne: excludeUserId } }
      : { universityEmail: email };
    
    return DbOperations.findOne(User, query) !== null;
  }
}
