import { Types } from 'mongoose';
import User from '../models/User';
import { AppError, ErrorCodes } from '../utils/appError';
import { EmailService } from '../utils/emailService';
import { DbOperations } from '../utils/dbOperations';
import crypto from 'crypto';
import { generateHashedOTP, generateUsernameFromEmail } from '@utils/helpers';
import { IUser } from '../models/types';
import { UserRepository } from '../repositories/user.repo';
import { ChatbotService } from './chatbot.service';

export class AuthService {
  /**
   * Register a new user
   */
  static async signup(userData: {
    name: string;
    email: string;
    password: string;
    role: 'student' | 'faculty' | 'admin' | 'superadmin';
    level?: number;
  }) {
    const existingUser = await UserRepository.findByEmail(userData.email);

    if (existingUser) {
      throw new AppError(
        'Email already registered',
        400,
        ErrorCodes.ALREADY_EXISTS
      );
    }

    // Enforce only one superadmin in the database
    // Disable For Testing For now
    /*if (userData.role === 'superadmin') {
      const superadminExists = await User.exists({ role: 'superadmin' });
      if (superadminExists) {
        throw new AppError(
          'A superadmin already exists. Only one superadmin is allowed.',
          400,
          ErrorCodes.ALREADY_EXISTS
        );
      }
    }*/

    // Set level only for students, remove for other roles
    const userDataToSave = {
      ...userData,
      level: userData.role === 'student' ? userData.level || 1 : undefined,
    };

    const user = await DbOperations.create<IUser>(User, userDataToSave);

    // Generate and send verification OTP
    const { otp, hashedOtp } = generateHashedOTP();
    user.otp = {
      code: hashedOtp,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    };
    await user.save();

    await EmailService.sendVerificationOTP(user.email, otp);

    // Create chatbot conversation for students
    if (user.role === 'student') {
      // TODO: This is now a direct call, no longer queued
      await ChatbotService.createChatbotConversation(user._id.toString());
    }

    const token = user.generateAuthToken();
    
    return { user, token };
  }

  /**
   * Login user
   */
  static async login(email: string, password: string) {
    const user = await UserRepository.findByEmailWithPassword(email);
    if (!user) {
      throw new AppError(
        'Invalid email or password',
        401,
        ErrorCodes.UNAUTHORIZED
      );
    }

    if (!user.emailVerified) {
      throw new AppError(
        'Email not verified',
        401,
        ErrorCodes.EMAIL_NOT_VERIFIED
      );
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new AppError(
        'Invalid email or password',
        401,
        ErrorCodes.UNAUTHORIZED
      );
    }

    // Update user status to online
    await user.updateStatus('online');

    const token = user.generateAuthToken();    
    return { user, token };
  }

  /**
   * Get user by ID
   */
  static async getUserById(userId: Types.ObjectId) {
    const user = await UserRepository.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);
    }
    return user;
  }

  /**
   * Request password reset
   */
  static async forgotPassword(email: string) {
    const user = await UserRepository.findByEmail(email);
    if (!user) {
      throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);
    }

    const { otp, hashedOtp } = generateHashedOTP();
    user.otp = {
      code: hashedOtp,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    };
    await user.save();

    await EmailService.sendPasswordResetOTP(email, otp);
    return {};
  }

  /**
   * Verify forgot password OTP and generate reset token
   */
  static async verifyForgotPasswordOTP(email: string, otp: string) {
    const user = await UserRepository.findByEmail(email);
    if (!user) {
      throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);
    }

    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

    if (
      !user.otp ||
      user.otp.code !== hashedOtp ||
      user.otp.expiresAt < new Date()
    ) {
      throw new AppError(
        'Invalid or expired verification code',
        400,
        ErrorCodes.INVALID_TOKEN
      );
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.otp = {
      code: crypto.createHash('sha256').update(resetToken).digest('hex'),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    };
    await user.save();

    return { resetToken };
  }

  /**
   * Reset password with reset token
   */
  static async resetPassword(resetToken: string, newPassword: string) {
    const hashedToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    const user = await User.findOne({
      'otp.code': hashedToken,
      'otp.expiresAt': { $gt: new Date() },
    }).select('+password');

    if (!user) {
      throw new AppError(
        'Invalid or expired reset token',
        400,
        ErrorCodes.INVALID_TOKEN
      );
    }

    user.password = newPassword;
    user.otp = undefined;
    await user.save();
    return {};
  }

  /**
   * Change password (when logged in)
   */
  static async changePassword(
    userId: Types.ObjectId,
    currentPassword: string,
    newPassword: string
  ) {
    const user = await UserRepository.findByIdWithPassword(userId);
    if (!user) {
      throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      throw new AppError(
        'Current password is incorrect',
        401,
        ErrorCodes.UNAUTHORIZED
      );
    }

    user.password = newPassword;
    await user.save();
    return {};
  }

  /**
   * Verify email with OTP
   */
  static async verifyEmail(otp: string) {
    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

    const user = await User.findOne({
      'otp.code': hashedOtp,
      'otp.expiresAt': { $gt: new Date() },
    });

    if (!user) {
      throw new AppError(
        'Invalid or expired verification code',
        400,
        ErrorCodes.INVALID_TOKEN
      );
    }

    user.emailVerified = true;
    user.signupStep = 'verified';
    user.otp = undefined;
    await user.save();

    const token = user.generateAuthToken();

    return { user, token, message: 'Email verified successfully' };
  }

  /**
   * Logout user
   */
  static async logout(user: IUser) {
    await user.updateStatus('offline');
    return {};
  }

  /**
   * Resend verification OTP
   */
  static async resendVerificationOTP(email: string) {
    const user = await UserRepository.findByEmail(email);
    if (!user) {
      throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);
    }

    if (user.emailVerified) {
      throw new AppError(
        'Email already verified',
        400,
        ErrorCodes.INVALID_OPERATION
      );
    }

    const { otp, hashedOtp } = generateHashedOTP();
    user.otp = {
      code: hashedOtp,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    };
    await user.save();

    await EmailService.sendVerificationOTP(email, otp);
    return {};
  }

  /**
   * Initial signup step - collect name, email and password
   */
  static async initiateSignup(userData: {
    name: string;
    email: string;
    password: string;
  }) {
    const existingUser = await UserRepository.findByEmail(userData.email);

    if (existingUser) {
      throw new AppError(
        'Email already registered',
        400,
        ErrorCodes.ALREADY_EXISTS
      );
    }

    // Generate a username from email
    const username = generateUsernameFromEmail(userData.email);

    const user = await DbOperations.create(User, {
      ...userData,
      username,
      signupStep: 'initial',
    });

    console.log('Created user', user);

    // Generate and send verification OTP
    const { otp, hashedOtp } = generateHashedOTP();
    user.otp = {
      code: hashedOtp,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    };
    await DbOperations.saveDocument(user);

    await EmailService.sendVerificationOTP(user.email, otp);

    return {
      user,
      message: 'Signup initiated. Please verify your email.',
    };
  }

  /**
   * Complete signup with additional user data
   */
  static async completeSignup(user: IUser, userData: Partial<IUser>) {
    if (user.signupStep !== 'verified') {
      throw new AppError(
        'Email must be verified before completing signup',
        400,
        ErrorCodes.INVALID_OPERATION
      );
    }

    // Handle role-specific validations
    if (userData.role) {
      if (userData.role === 'student') {
        if (!userData.level) {
          throw new AppError(
            'Level is required for students',
            400,
            ErrorCodes.VALIDATION_ERROR
          );
        }
      } else {
        // Remove student-specific fields for non-students
        delete userData.level;
        delete userData.gpa;
      }
    }

    // Update all provided fields
    delete userData.password;
    Object.assign(user, userData);

    user.signupStep = 'completed';
    await DbOperations.saveDocument(user, true);

    // Send welcome email after completion
    await EmailService.sendWelcomeEmail(user.email, user.name);

    return { user, message: 'Signup completed successfully' };
  }

  /**
   * Initiate email change process
   */
  static async initiateEmailChange(userId: Types.ObjectId, newEmail: string) {
    const user = await UserRepository.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);
    }

    const isEmailTaken = await UserRepository.isEmailTaken(newEmail, user._id);
    if (isEmailTaken) {
      throw new AppError(
        'Email already registered',
        400,
        ErrorCodes.ALREADY_EXISTS
      );
    }

    const { otp, hashedOtp } = generateHashedOTP();
    user.otp = {
      code: hashedOtp,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    };
    user.set('tempEmail', newEmail);
    await user.save();

    await EmailService.sendVerificationOTP(newEmail, otp);
    return {};
  }

  /**
   * Verify and complete email change
   */
  static async verifyNewEmail(userId: Types.ObjectId, code: string) {
    const user = await UserRepository.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);
    }

    const hashedOtp = crypto.createHash('sha256').update(code).digest('hex');

    if (!user.otp || !user.get('tempEmail')) {
      throw new AppError(
        'No email change in progress',
        400,
        ErrorCodes.INVALID_OPERATION
      );
    }

    if (user.otp.code !== hashedOtp || user.otp.expiresAt < new Date()) {
      throw new AppError(
        'Invalid or expired verification code',
        400,
        ErrorCodes.INVALID_TOKEN
      );
    }

    // Update email and clear temporary data
    const oldEmail = user.email;
    user.email = user.get('tempEmail')!;
    user.set('tempEmail', undefined);
    user.otp = undefined;
    await user.save();

    // Send confirmation emails
    await EmailService.sendEmailChangeConfirmation(oldEmail, user.email);

    return {};
  }

  /**
   * Initiate university email verification (first time)
   */
  static async initiateUniversityEmailVerification(userId: Types.ObjectId) {
    const user = await UserRepository.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);
    }

    if (!user.universityEmail) {
      throw new AppError(
        'No university email set',
        400,
        ErrorCodes.INVALID_OPERATION
      );
    }

    if (user.universityEmailVerified) {
      throw new AppError(
        'University email already verified',
        400,
        ErrorCodes.INVALID_OPERATION
      );
    }

    // Generate and send OTP
    const { otp, hashedOtp } = generateHashedOTP();
    user.otp = {
      code: hashedOtp,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    };
    await user.save();

    await EmailService.sendVerificationOTP(user.universityEmail, otp);
    return {};
  }

  /**
   * Verify university email (first time)
   */
  static async verifyUniversityEmail(userId: Types.ObjectId, code: string) {
    const user = await UserRepository.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);
    }

    const hashedOtp = crypto.createHash('sha256').update(code).digest('hex');

    if (!user.otp || !user.universityEmail) {
      throw new AppError(
        'No university email verification in progress',
        400,
        ErrorCodes.INVALID_OPERATION
      );
    }

    if (user.otp.code !== hashedOtp || user.otp.expiresAt < new Date()) {
      throw new AppError(
        'Invalid or expired verification code',
        400,
        ErrorCodes.INVALID_TOKEN
      );
    }

    user.universityEmailVerified = true;
    user.otp = undefined;
    await user.save();
    return {};
  }

  /**
   * Initiate university email change
   */
  static async initiateUniversityEmailChange(userId: Types.ObjectId, newEmail: string) {
    const user = await UserRepository.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Check if email is already in use
    const isEmailTaken = await UserRepository.isUniversityEmailTaken(newEmail, user._id);
    if (isEmailTaken) {
      throw new AppError(
        'University email already registered',
        400,
        ErrorCodes.ALREADY_EXISTS
      );
    }

    // Generate and store OTP
    const { otp, hashedOtp } = generateHashedOTP();
    user.otp = {
      code: hashedOtp,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    };
    user.set('tempUniversityEmail', newEmail);
    await user.save();

    // Send verification email
    await EmailService.sendVerificationOTP(newEmail, otp);

    return {};
  }

  /**
   * Verify university email change
   */
  static async verifyUniversityEmailChange(userId: Types.ObjectId, code: string) {
    const user = await UserRepository.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);
    }

    const hashedOtp = crypto.createHash('sha256').update(code).digest('hex');

    if (!user.otp || !user.get('tempUniversityEmail')) {
      throw new AppError(
        'No university email change in progress',
        400,
        ErrorCodes.INVALID_OPERATION
      );
    }

    if (user.otp.code !== hashedOtp || user.otp.expiresAt < new Date()) {
      throw new AppError(
        'Invalid or expired verification code',
        400,
        ErrorCodes.INVALID_TOKEN
      );
    }

    // Update university email and clear temporary data
    const oldEmail = user.universityEmail;
    user.universityEmail = user.get('tempUniversityEmail')!;
    user.universityEmailVerified = true;
    user.set('tempUniversityEmail', undefined);
    user.otp = undefined;
    await user.save();

    if (oldEmail && user.universityEmail) {
      await EmailService.sendEmailChangeConfirmation(oldEmail, user.universityEmail);
    }

    return {};
  }

  /**
   * Get user from reset token
   */
  static async getUserFromResetToken(resetToken: string) {
    const hashedToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    const user = await User.findOne({
      'otp.code': hashedToken,
      'otp.expiresAt': { $gt: new Date() },
    });

    return user;
  }
}
