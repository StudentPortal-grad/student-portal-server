import { Types } from 'mongoose';
import User from '../models/User';
import { IUser } from '../models/types';
import { DbOperations } from '../utils/dbOperations';

export class UserRepository {
  static async findById(id: Types.ObjectId) {
    return DbOperations.findOne(User, { _id: id });
  }

  static async findByEmail(email: string) {
    return DbOperations.findOne(User, { email });
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

  static async findByEmailWithPassword(email: string) {
    return DbOperations.findOne(User, { email }, { password: 1 });
  }

  static async findByOTPCode(otpCode: string) {
    return DbOperations.findOne(
      User,
      {
        'otp.code': otpCode,
        'otp.expiresAt': { $gt: new Date() },
      },
      { password: 1 }
    );
  }
}
