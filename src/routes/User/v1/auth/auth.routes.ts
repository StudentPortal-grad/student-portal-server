import { Router } from 'express';
import { AuthController } from '@controllers/auth/auth.controller';
import { authenticate } from '@middleware/auth';
import { validate } from '@middleware/validate';
import { authValidation } from '@validations/authValidation';
import { uploadProfilePicture } from '@utils/uploadService';

const router = Router();

// Public routes
// Stepped signup process
router.post(
  '/signup/initiate',
  validate(authValidation.initiateSignup),
  AuthController.initiateSignup
);
router.post(
  '/verify-email',
  validate(authValidation.verifyEmail),
  AuthController.verifyEmail
);
router.post(
  '/resend-verification',
  validate(authValidation.resendVerificationOTP),
  AuthController.resendVerificationOTP
);

// Legacy signup (to be deprecated)
router.post('/signup', validate(authValidation.signup), AuthController.signup);

// Authentication routes
router.post('/login', validate(authValidation.login), AuthController.login);
router.post(
  '/forgot-password',
  validate(authValidation.forgotPassword),
  AuthController.forgotPassword
);
router.post(
  '/verify-reset-otp',
  validate(authValidation.verifyForgotPasswordOTP),
  AuthController.verifyResetOTP
);
router.post(
  '/reset-password',
  validate(authValidation.resetPassword),
  AuthController.resetPassword
);

// Protected routes
router.use(authenticate); // Apply authentication middleware to all routes below

// Complete signup process (requires authentication)
router.post(
  '/signup/complete',
  uploadProfilePicture, // Handle file upload first
  validate(authValidation.completeSignup),
  AuthController.completeSignup
);

// Email management routes
router.post(
  '/email/change',
  validate(authValidation.initiateEmailChange),
  AuthController.initiateEmailChange
);
router.post(
  '/email/verify',
  validate(authValidation.verifyNewEmail),
  AuthController.verifyNewEmail
);
router.post(
  '/university-email/verify/initiate',
  AuthController.initiateUniversityEmailVerification
);
router.post(
  '/university-email/verify',
  validate(authValidation.verifyUniversityEmail),
  AuthController.verifyUniversityEmail
);

// User management
router.post('/logout', AuthController.logout);
router.post(
  '/change-password',
  validate(authValidation.changePassword),
  AuthController.changePassword
);

export default router;
