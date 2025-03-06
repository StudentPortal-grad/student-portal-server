import { Router } from 'express';
import { UserController } from '@controllers/user.controller';
import { AuthController } from '@controllers/auth/auth.controller';
import { validate } from '@middleware/validate';
import { userValidation } from '@validations/userValidation';
import { authValidation } from '@validations/authValidation';

const router = Router();

// Profile routes
router.get('/', UserController.getMe);
router.patch(
  '/',
  validate(userValidation.updateProfile),
  UserController.updateMe
);
router.delete('/', UserController.deleteMe);

// Password management
router.post(
  '/password',
  validate(authValidation.changePassword),
  AuthController.changePassword
);

// Email management
router.patch(
  '/email',
  validate(userValidation.updateEmail),
  UserController.updateMyEmail
);

// University email management
router.patch(
  '/university-email',
  validate(userValidation.updateUniversityEmail),
  UserController.updateUniversityEmail
);

export default router; 