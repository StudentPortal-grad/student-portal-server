import { Router } from 'express';
import { UserController } from '../../controllers/user.controller';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { userValidation } from '../../validations/userValidation';

const router = Router();

// All routes require authentication
router.use(authenticate);

// User profile routes
router.get('/me', UserController.getMe);
router.patch(
  '/me',
  validate(userValidation.updateProfile),
  UserController.updateMe
);
router.delete('/me', UserController.deleteMe);

// Password update
router.patch(
  '/me/password',
  validate(userValidation.updatePassword),
  UserController.updateMyPassword
);

// Email management
router.patch(
  '/me/email',
  validate(userValidation.updateEmail),
  UserController.updateMyEmail
);

// University email management
router.patch(
  '/me/university-email',
  validate(userValidation.updateUniversityEmail),
  UserController.updateUniversityEmail
);

export default router;
