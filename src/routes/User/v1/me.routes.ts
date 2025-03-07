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

export default router; 