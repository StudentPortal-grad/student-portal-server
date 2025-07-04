import { Request, Response, NextFunction } from "express";
import { AuthService } from "../../services/auth.service";
import asyncHandler from "../../utils/asyncHandler";
import notificationService from "@services/notification.service";

export class AuthController {
    /**
     * @route   POST /v1/auth/signup
     * @desc    Register a new user
     */
    static signup = asyncHandler(
        async (req: Request, res: Response, _next: NextFunction) => {
            const { user, token } = await AuthService.signup(req.body);
            res.success({ user, token }, "Registration successful", 201);
        }
    );

    /**
     * @route   POST /v1/auth/login
     * @desc    Login user
     */
    static login = asyncHandler(
        async (req: Request, res: Response, _next: NextFunction) => {
            const { email, password } = req.body;
            const { user, token } = await AuthService.login(email, password);

            res.success(
                { user: { ...user.toObject(), password: undefined }, token },
                "Login successful"
            );
        }
    );

    /**
     * @route   POST /v1/auth/logout
     * @desc    Logout user
     */
    static logout = asyncHandler(
        async (req: Request, res: Response, _next: NextFunction) => {
            const result = await AuthService.logout(req.user!);
            res.success(result, "Logout successful");
        }
    );

    /**
     * @route   GET /v1/auth/me
     * @desc    Get current user
     */
    static getMe = asyncHandler(
        async (req: Request, res: Response, _next: NextFunction) => {
            const user = await AuthService.getUserById(req.user!._id);
            res.success({ user }, "User retrieved successfully");
        }
    );

    /**
     * @route   POST /v1/auth/forgot-password
     * @desc    Request password reset
     */
    static forgotPassword = asyncHandler(
        async (req: Request, res: Response, _next: NextFunction) => {
            const { email } = req.body;
            const result = await AuthService.forgotPassword(email);
            res.success(result, "Password reset email sent");
        }
    );

    /**
     * @route   POST /v1/auth/verify-reset-otp
     * @desc    Verify reset OTP and get reset token
     */
    static verifyResetOTP = asyncHandler(
        async (req: Request, res: Response, _next: NextFunction) => {
            const { email, otp } = req.body;
            const result = await AuthService.verifyForgotPasswordOTP(
                email,
                otp
            );
            res.success(result, "OTP verified successfully");
        }
    );

    /**
     * @route   POST /v1/auth/reset-password
     * @desc    Reset password with reset token
     */
    static resetPassword = asyncHandler(
        async (req: Request, res: Response, _next: NextFunction) => {
            const { resetToken, password } = req.body;
            const result = await AuthService.resetPassword(
                resetToken,
                password
            );

            // Get user from the reset token
            const user = await AuthService.getUserFromResetToken(resetToken);
            if (user) {
                // Create notification for password reset
                await notificationService.createNotification(
                    user._id,
                    'PASSWORD_RESET',
                    'Your password has been reset successfully',
                    {
                        resetAt: new Date()
                    }
                );
            }

            res.success(result, "Password reset successful");
        }
    );

    /**
     * @route   POST /v1/auth/change-password
     * @desc    Change password (when logged in)
     */
    static changePassword = asyncHandler(
        async (req: Request, res: Response, _next: NextFunction) => {
            const { currentPassword, newPassword } = req.body;
            const result = await AuthService.changePassword(
                req.user!._id,
                currentPassword,
                newPassword
            );

            // Create notification for password change
            await notificationService.createNotification(
                req.user!._id,
                'PASSWORD_CHANGED',
                'Your password has been changed successfully',
                {
                    changedAt: new Date()
                }
            );

            res.success(result, "Password changed successfully");
        }
    );

    /**
     * @route   POST /v1/auth/verify-email
     * @desc    Verify email with OTP
     */
    static verifyEmail = asyncHandler(
        async (req: Request, res: Response, _next: NextFunction) => {
            const { code } = req.body;
            const { user, token, message } =
                await AuthService.verifyEmail(code);
            res.success({ user, token }, message);
        }
    );

    /**
     * @route   POST /v1/auth/resend-verification
     * @desc    Resend verification OTP
     */
    static resendVerificationOTP = asyncHandler(
        async (req: Request, res: Response, _next: NextFunction) => {
            const { email } = req.body;
            const result = await AuthService.resendVerificationOTP(email);
            res.success(result, "Verification code resent successfully");
        }
    );

    /**
     * @route   POST /v1/auth/signup/initiate
     * @desc    Start signup process with name, email and password
     */
    static initiateSignup = asyncHandler(
        async (req: Request, res: Response, _next: NextFunction) => {
            const { user, message } = await AuthService.initiateSignup(
                req.body
            );
            res.success({ user }, message, 201);
        }
    );

    /**
     * @route   POST /v1/auth/signup/complete
     * @desc    Complete signup with additional user data
     */
    static completeSignup = asyncHandler(
        async (req: Request, res: Response, _next: NextFunction) => {
            const result = await AuthService.completeSignup(
                req.user!,
                req.body
            );
            res.success(result, "Signup completed successfully");
        }
    );

    /**
     * @route   POST /v1/auth/email/change
     * @desc    Initiate email change process
     */
    static initiateEmailChange = asyncHandler(
        async (req: Request, res: Response, _next: NextFunction) => {
            const { newEmail } = req.body;
            const result = await AuthService.initiateEmailChange(
                req.user!._id,
                newEmail
            );
            res.success(result, "Verification code sent to new email");
        }
    );

    /**
     * @route   POST /v1/auth/email/verify
     * @desc    Verify and complete email change
     */
    static verifyNewEmail = asyncHandler(
        async (req: Request, res: Response, _next: NextFunction) => {
            const { code } = req.body;
            const result = await AuthService.verifyNewEmail(
                req.user!._id,
                code
            );
            res.success(result, "Email changed successfully");
        }
    );

    /**
     * @route   POST /v1/auth/university-email/verify/initiate
     * @desc    Initiate university email verification
     */
    static initiateUniversityEmailVerification = asyncHandler(
        async (req: Request, res: Response, _next: NextFunction) => {
            const result =
                await AuthService.initiateUniversityEmailVerification(
                    req.user!._id
                );
            res.success(result, "Verification code sent to university email");
        }
    );

    /**
     * @route   POST /v1/auth/university-email/change
     * @desc    Initiate university email change process
     */
    static initiateUniversityEmailChange = asyncHandler(
        async (req: Request, res: Response, _next: NextFunction) => {
            const { newEmail } = req.body;
            const result = await AuthService.initiateUniversityEmailChange(
                req.user!._id,
                newEmail
            );
            res.success(
                result,
                "Verification code sent to new university email"
            );
        }
    );

    /**
     * @route   POST /v1/auth/university-email/verify
     * @desc    Verify and complete university email change
     */
    static verifyUniversityEmail = asyncHandler(
        async (req: Request, res: Response, _next: NextFunction) => {
            const { code } = req.body;
            const result = await AuthService.verifyUniversityEmail(
                req.user!._id,
                code
            );
            res.success(result, "University email verified successfully");
        }
    );

    /**
     * @route   POST /v1/auth/university-email/change/verify
     * @desc    Verify and complete university email change
     */
    static verifyUniversityEmailChange = asyncHandler(
        async (req: Request, res: Response, _next: NextFunction) => {
            const { code } = req.body;
            const result = await AuthService.verifyUniversityEmailChange(
                req.user!._id,
                code
            );
            res.success(result, "University email changed successfully");
        }
    );
}
