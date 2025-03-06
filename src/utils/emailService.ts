import nodemailer from 'nodemailer';
import { AppError, ErrorCodes } from './appError';
import { config } from 'dotenv';

/* global process */
config();

export class EmailService {
  private static transporter = nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    secure: true,
    port: 465,
    auth: {
      user: process.env.MAILER_USER,
      pass: process.env.MAILER_PASS,
    },
  });

  /**
   * Send an email
   */
  static async sendEmail(options: {
    to: string;
    subject: string;
    html: string;
    text: string;
    from?: string;
  }): Promise<void> {
    try {
      const info = await this.transporter.sendMail({
        from: options.from || process.env.MAILER_USER,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      console.log('Message sent: %s', info.envelope);
    } catch (error) {
      throw new AppError(
        'Failed to send email',
        500,
        ErrorCodes.EMAIL_ERROR,
        error
      );
    }
  }

  /**
   * Send password reset email
   */
  static async sendPasswordResetEmail(
    email: string,
    resetToken: string
  ): Promise<void> {
    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;
    const html = `
      <h1>Password Reset Request</h1>
      <p>Click the link below to reset your password:</p>
      <a href="${resetUrl}">Reset Password</a>
      <p>If you didn't request this, please ignore this email.</p>
      <p>This link will expire in 1 hour.</p>
    `;
    const text = `
      Password Reset Request
      Click the link below to reset your password:
      Reset Password
      url: ${resetUrl}
      If you didn't request this, please ignore this email.
      This link will expire in 1 hour.
    `;

    await this.sendEmail({
      to: email,
      subject: 'Password Reset Request',
      html,
      text,
    });
  }

  /**
   * Send welcome email
   */
  static async sendWelcomeEmail(email: string, name: string): Promise<void> {
    const html = `
      <h1>Welcome to ${process.env.APP_NAME}!</h1>
      <p>Hello ${name},</p>
      <p>Thank you for joining us. We're excited to have you on board!</p>
      <p>If you have any questions, feel free to reach out to our support team.</p>
    `;
    const text = `
      Welcome to ${process.env.APP_NAME}!
      Hello ${name},
      Thank you for joining us. We're excited to have you on board!
      If you have any questions, feel free to reach out to our support team.
    `;

    await this.sendEmail({
      to: email,
      subject: `Welcome to ${process.env.APP_NAME}!`,
      html,
      text,
    });
  }

  /**
   * Send verification OTP email
   */
  static async sendVerificationOTP(email: string, otp: string): Promise<void> {
    const html = `
      <h1>Email Verification</h1>
      <p>Your verification code is: <strong>${otp}</strong></p>
      <p>This code will expire in 10 minutes.</p>
      <p>If you didn't request this, please ignore this email.</p>
    `;
    const text = `
      Email Verification
      Your verification code is: ${otp}
      This code will expire in 10 minutes.
      If you didn't request this, please ignore this email.
    `;

    await this.sendEmail({
      to: email,
      subject: 'Email Verification Code',
      html,
      text,
    });
  }

  /**
   * Send password reset OTP email
   */
  static async sendPasswordResetOTP(email: string, otp: string): Promise<void> {
    const html = `
      <h1>Password Reset Request</h1>
      <p>Your password reset code is: <strong>${otp}</strong></p>
      <p>This code will expire in 10 minutes.</p>
      <p>If you didn't request this, please ignore this email.</p>
    `;
    const text = `
      Password Reset Request
      Your password reset code is: ${otp}
      This code will expire in 10 minutes.
      If you didn't request this, please ignore this email.
    `;

    await this.sendEmail({
      to: email,
      subject: 'Password Reset Code',
      html,
      text,
    });
  }

  /**
   * Send email change confirmation
   */
  static async sendEmailChangeConfirmation(
    oldEmail: string,
    newEmail: string
  ): Promise<void> {
    const oldEmailHtml = `
      <h1>Email Change Notification</h1>
      <p>Your email has been changed from ${oldEmail} to ${newEmail}.</p>
      <p>If you did not make this change, please contact support immediately.</p>
    `;
    const oldEmailText = `
      Email Change Notification
      Your email has been changed from ${oldEmail} to ${newEmail}.
      If you did not make this change, please contact support immediately.
    `;

    const newEmailHtml = `
      <h1>Email Change Confirmation</h1>
      <p>Your email has been successfully changed to this address.</p>
      <p>You can now use this email to log in to your account.</p>
    `;
    const newEmailText = `
      Email Change Confirmation
      Your email has been successfully changed to this address.
      You can now use this email to log in to your account.
    `;

    await Promise.all([
      this.sendEmail({
        to: oldEmail,
        subject: 'Email Change Notification',
        html: oldEmailHtml,
        text: oldEmailText,
      }),
      this.sendEmail({
        to: newEmail,
        subject: 'Email Change Confirmation',
        html: newEmailHtml,
        text: newEmailText,
      }),
    ]);
  }
}
