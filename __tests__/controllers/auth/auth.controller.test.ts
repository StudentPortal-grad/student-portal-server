import request from 'supertest';
import app from '../../../src/config/app';
import { AuthService } from '../../../src/services/auth.service';
import { AppError, ErrorCodes } from '../../../src/utils/appError';
import * as authMiddleware from '../../../src/middleware/auth';

// Mock the entire AuthService
jest.mock('../../../src/services/auth.service');

// Mock the authentication middleware
jest.mock('../../../src/middleware/auth', () => ({
    ...jest.requireActual('../../../src/middleware/auth'), // Import and retain default exports
    authenticate: jest.fn((req, res, next) => {
        // Mock a user on the request object for protected routes
        req.user = { _id: 'mockUserId', name: 'Test User', email: 'test@test.com' };
        next();
    }),
}));

describe('AuthController', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /api/auth/signup', () => {
        it('should return 201 and user data on successful signup', async () => {
            const mockUser = { _id: '1', name: 'Test User', email: 'test@test.com' };
            const mockToken = 'mockToken';

            (AuthService.signup as jest.Mock).mockResolvedValue({ user: mockUser, token: mockToken });

            const response = await request(app)
                .post('/api/auth/signup')
                .send({ name: 'Test User', email: 'test@test.com', password: 'password123' });

            expect(response.status).toBe(201);
            expect(response.body.data.user).toEqual(mockUser);
            expect(response.body.data.token).toEqual(mockToken);
            expect(response.body.message).toBe('Registration successful');
        });

        it('should return 400 if signup fails (e.g., email exists)', async () => {
            (AuthService.signup as jest.Mock).mockRejectedValue(new AppError('Email already exists', 400, ErrorCodes.ALREADY_EXISTS));

            const response = await request(app)
                .post('/api/auth/signup')
                .send({ name: 'Test User', email: 'test@test.com', password: 'password123' });

            expect(response.status).toBe(400);
            expect(response.body.message).toBe('Email already exists');
        });
    });

    describe('POST /api/auth/login', () => {
        it('should return 200 and token on successful login', async () => {
            const mockUser = { _id: '1', name: 'Test User', email: 'test@test.com' };
            const mockToken = 'mockToken';

            (AuthService.login as jest.Mock).mockResolvedValue({ user: mockUser, token: mockToken });

            const response = await request(app)
                .post('/api/auth/login')
                .send({ email: 'test@test.com', password: 'password123' });

            expect(response.status).toBe(200);
            expect(response.body.data.token).toBe(mockToken);
        });

        it('should return 401 for invalid credentials', async () => {
            (AuthService.login as jest.Mock).mockRejectedValue(new AppError('Invalid email or password', 401, ErrorCodes.UNAUTHORIZED));

            const response = await request(app)
                .post('/api/auth/login')
                .send({ email: 'wrong@test.com', password: 'wrongpassword' });

            expect(response.status).toBe(401);
            expect(response.body.message).toBe('Invalid email or password');
        });
    });

    describe('POST /api/auth/logout', () => {
        it('should return 200 on successful logout', async () => {
            (AuthService.logout as jest.Mock).mockResolvedValue({});

            const response = await request(app).post('/api/auth/logout');

            expect(response.status).toBe(200);
            expect(response.body.message).toBe('Logged out successfully');
            expect(authMiddleware.authenticate).toHaveBeenCalled(); 
        });
    });

    describe('GET /api/auth/me', () => {
        it('should return 200 and user data for an authenticated user', async () => {
            const mockUser = { _id: 'mockUserId', name: 'Test User' };
            (AuthService.getUserById as jest.Mock).mockResolvedValue(mockUser);

            const response = await request(app).get('/api/auth/me');

            expect(response.status).toBe(200);
            expect(response.body.data).toEqual(mockUser);
            expect(authMiddleware.authenticate).toHaveBeenCalled();
        });
    });

    describe('POST /api/auth/forgot-password', () => {
        it('should return 200 on successful request', async () => {
            (AuthService.forgotPassword as jest.Mock).mockResolvedValue({});

            const response = await request(app)
                .post('/api/auth/forgot-password')
                .send({ email: 'test@test.com' });

            expect(response.status).toBe(200);
            expect(response.body.message).toBe('Password reset email sent');
        });

        it('should return 404 if user not found', async () => {
            (AuthService.forgotPassword as jest.Mock).mockRejectedValue(new AppError('User not found', 404, ErrorCodes.NOT_FOUND));

            const response = await request(app)
                .post('/api/auth/forgot-password')
                .send({ email: 'notfound@test.com' });

            expect(response.status).toBe(404);
            expect(response.body.message).toBe('User not found');
        });
    });

    describe('POST /api/auth/verify-reset-otp', () => {
        it('should return 200 and reset token on success', async () => {
            (AuthService.verifyForgotPasswordOTP as jest.Mock).mockResolvedValue({ resetToken: 'resetToken' });

            const response = await request(app)
                .post('/api/auth/verify-reset-otp')
                .send({ email: 'test@test.com', otp: '123456' });

            expect(response.status).toBe(200);
            expect(response.body.data.resetToken).toBe('resetToken');
            expect(response.body.message).toBe('OTP verified successfully');
        });
    });

    describe('POST /api/auth/reset-password', () => {
        it('should return 200 on successful password reset', async () => {
            (AuthService.resetPassword as jest.Mock).mockResolvedValue({});

            const response = await request(app)
                .post('/api/auth/reset-password')
                .send({ resetToken: 'validToken', password: 'newPassword123' });

            expect(response.status).toBe(200);
            expect(response.body.message).toBe('Password reset successful');
        });

        it('should return 400 for an invalid token', async () => {
            (AuthService.resetPassword as jest.Mock).mockRejectedValue(new AppError('Invalid or expired token', 400, ErrorCodes.INVALID_TOKEN));

            const response = await request(app)
                .post('/api/auth/reset-password')
                .send({ resetToken: 'invalidToken', password: 'newPassword123' });

            expect(response.status).toBe(400);
            expect(response.body.message).toBe('Invalid or expired token');
        });
    });

    describe('POST /api/auth/change-password', () => {
        it('should return 200 on successful password change', async () => {
            (AuthService.changePassword as jest.Mock).mockResolvedValue({});

            const response = await request(app)
                .post('/api/auth/change-password')
                .send({ currentPassword: 'oldPassword', newPassword: 'newPassword' });

            expect(response.status).toBe(200);
            expect(response.body.message).toBe('Password changed successfully');
            expect(authMiddleware.authenticate).toHaveBeenCalled(); 
        });

        it('should return 401 for incorrect current password', async () => {
            (AuthService.changePassword as jest.Mock).mockRejectedValue(new AppError('Incorrect password', 401, ErrorCodes.UNAUTHORIZED));

            const response = await request(app)
                .post('/api/auth/change-password')
                .send({ currentPassword: 'wrongPassword', newPassword: 'newPassword' });

            expect(response.status).toBe(401);
            expect(response.body.message).toBe('Incorrect password');
        });
    });

    describe('POST /api/auth/verify-email', () => {
        it('should return 200 on successful verification', async () => {
            const mockUser = { _id: '1', name: 'Test User' };
            const mockToken = 'mockToken';
            (AuthService.verifyEmail as jest.Mock).mockResolvedValue({ user: mockUser, token: mockToken, message: 'Email verified successfully' });

            const response = await request(app)
                .post('/api/auth/verify-email')
                .send({ code: 'validCode' });

            expect(response.status).toBe(200);
            expect(response.body.message).toBe('Email verified successfully');
            expect(response.body.data.user).toEqual(mockUser);
            expect(response.body.data.token).toBe(mockToken);
        });

        it('should return 400 for an invalid code', async () => {
            (AuthService.verifyEmail as jest.Mock).mockRejectedValue(new AppError('Invalid or expired verification code', 400, ErrorCodes.INVALID_TOKEN));

            const response = await request(app)
                .post('/api/auth/verify-email')
                .send({ code: 'invalidCode' });

            expect(response.status).toBe(400);
            expect(response.body.message).toBe('Invalid or expired verification code');
        });
    });

    describe('POST /api/auth/resend-verification-otp', () => {
        it('should return 200 on successful resend', async () => {
            (AuthService.resendVerificationOTP as jest.Mock).mockResolvedValue({});

            const response = await request(app)
                .post('/api/auth/resend-verification-otp')
                .send({ email: 'test@test.com' });

            expect(response.status).toBe(200);
            expect(response.body.message).toBe('Verification OTP resent successfully');
        });
    });

    describe('POST /api/auth/signup/initiate', () => {
        it('should return 201 and user data on success', async () => {
            const mockUser = { _id: '1', name: 'Test User' };
            (AuthService.initiateSignup as jest.Mock).mockResolvedValue({ user: mockUser, message: 'Signup initiated' });

            const response = await request(app)
                .post('/api/auth/signup/initiate')
                .send({ name: 'Test User', email: 'test@test.com', password: 'password' });

            expect(response.status).toBe(201);
            expect(response.body.data.user).toEqual(mockUser);
            expect(response.body.message).toBe('Signup initiated');
        });
    });

    describe('POST /api/auth/signup/complete', () => {
        it('should return 200 on successful completion', async () => {
            (AuthService.completeSignup as jest.Mock).mockResolvedValue({});

            const response = await request(app)
                .post('/api/auth/signup/complete')
                .send({ faculty: 'Engineering' });

            expect(response.status).toBe(200);
            expect(response.body.message).toBe('Signup completed successfully');
            expect(authMiddleware.authenticate).toHaveBeenCalled(); 
        });
    });
});
