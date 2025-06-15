import request from 'supertest';
import express from 'express';
import { AuthController } from '../../../src/controllers/auth/auth.controller';
import { AuthService } from '../../../src/services/auth.service';
import { errorHandler } from '../../../src/middleware/errorHandler';
import { ResponseBuilder } from '../../../src/utils/ApiResponse';
import { AppError } from '../../../src/utils/appError';

// Custom interface for our extended Response
interface CustomResponse extends express.Response {
    success: (data: any, message?: string, statusCode?: number) => express.Response;
}

// Mock the AuthService
jest.mock('../../../src/services/auth.service');

const app = express();
app.use(express.json());

// Extend Express Response
app.use((req, res: CustomResponse, next) => {
    res.success = (data, message, statusCode) => {
        const response = ResponseBuilder.success(data, message);
        return res.status(statusCode || 200).json(response);
    };
    next();
});

app.post('/signup', AuthController.signup);
app.post('/login', AuthController.login);

// Middleware to mock req.user for protected routes
const mockUserMiddleware = (req: any, res: any, next: any) => {
    req.user = { _id: 'mockUserId', name: 'Test User', email: 'test@test.com' };
    next();
};

app.post('/logout', mockUserMiddleware, AuthController.logout);
app.get('/me', mockUserMiddleware, AuthController.getMe);
app.post('/forgot-password', AuthController.forgotPassword);
app.post('/verify-reset-otp', AuthController.verifyResetOTP);
app.post('/reset-password', AuthController.resetPassword);
app.post('/change-password', mockUserMiddleware, AuthController.changePassword);
app.post('/verify-email', AuthController.verifyEmail);
app.post('/resend-verification-otp', AuthController.resendVerificationOTP);
app.post('/signup/initiate', AuthController.initiateSignup);
app.post('/signup/complete', mockUserMiddleware, AuthController.completeSignup);
app.use(errorHandler);

describe('AuthController', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('signup', () => {
        it('should return 201 and user data on successful signup', async () => {
            const mockUser = { _id: '1', name: 'Test User', email: 'test@test.com' };
            const mockToken = 'mockToken';

            (AuthService.signup as jest.Mock).mockResolvedValue({ user: mockUser, token: mockToken });

            const response = await request(app)
                .post('/signup')
                .send({ name: 'Test User', email: 'test@test.com', password: 'password123' });

            expect(response.status).toBe(201);
            expect(response.body.data.user).toEqual(mockUser);
            expect(response.body.data.token).toEqual(mockToken);
            expect(response.body.message).toBe('Registration successful');
        });

        it('should return 400 if signup fails', async () => {
            (AuthService.signup as jest.Mock).mockRejectedValue(new AppError('Email already exists', 400, 'ALREADY_EXISTS'));

            const response = await request(app)
                .post('/signup')
                .send({ name: 'Test User', email: 'test@test.com', password: 'password123' });

            expect(response.status).toBe(400);
            expect(response.body.message).toBe('Email already exists');
        });
    });

    describe('login', () => {
        it('should return 200 and user data on successful login', async () => {
            const mockUser = { _id: '1', name: 'Test User', email: 'test@test.com', toObject: () => mockUser };
            const mockToken = 'mockToken';

            (AuthService.login as jest.Mock).mockResolvedValue({ user: mockUser, token: mockToken });

            const response = await request(app)
                .post('/login')
                .send({ email: 'test@test.com', password: 'password123' });

            expect(response.status).toBe(200);
            expect(response.body.data.user).toEqual({ ...mockUser, password: undefined });
            expect(response.body.data.token).toEqual(mockToken);
            expect(response.body.message).toBe('Login successful');
        });

        it('should return 401 for invalid credentials', async () => {
            (AuthService.login as jest.Mock).mockRejectedValue(new AppError('Invalid email or password', 401, 'UNAUTHORIZED'));

            const response = await request(app)
                .post('/login')
                .send({ email: 'wrong@test.com', password: 'wrongpassword' });

            expect(response.status).toBe(401);
            expect(response.body.message).toBe('Invalid email or password');
        });
    });

    describe('logout', () => {
        it('should return 200 on successful logout', async () => {
            (AuthService.logout as jest.Mock).mockResolvedValue({});

            const response = await request(app).post('/logout');

            expect(response.status).toBe(200);
            expect(response.body.message).toBe('Logout successful');
        });
    });

    describe('getMe', () => {
        it('should return 200 and user data on success', async () => {
            const mockUser = { _id: 'mockUserId', name: 'Test User', email: 'test@test.com' };
            (AuthService.getUserById as jest.Mock).mockResolvedValue(mockUser);

            const response = await request(app).get('/me');

            expect(response.status).toBe(200);
            expect(response.body.data.user).toEqual(mockUser);
            expect(response.body.message).toBe('User retrieved successfully');
        });

        it('should return 404 if user not found', async () => {
            (AuthService.getUserById as jest.Mock).mockRejectedValue(new AppError('User not found', 404, 'NOT_FOUND'));

            const response = await request(app).get('/me');

            expect(response.status).toBe(404);
            expect(response.body.message).toBe('User not found');
        });
    });

    describe('Password Management', () => {
        describe('forgotPassword', () => {
            it('should return 200 on successful request', async () => {
                (AuthService.forgotPassword as jest.Mock).mockResolvedValue({});
                const response = await request(app)
                    .post('/forgot-password')
                    .send({ email: 'test@test.com' });
                expect(response.status).toBe(200);
                expect(response.body.message).toBe('Password reset email sent');
            });

            it('should return 404 if user not found', async () => {
                (AuthService.forgotPassword as jest.Mock).mockRejectedValue(new AppError('User not found', 404, 'NOT_FOUND'));
                const response = await request(app)
                    .post('/forgot-password')
                    .send({ email: 'notfound@test.com' });
                expect(response.status).toBe(404);
                expect(response.body.message).toBe('User not found');
            });
        });

        describe('verifyResetOTP', () => {
            it('should return 200 and reset token on success', async () => {
                (AuthService.verifyForgotPasswordOTP as jest.Mock).mockResolvedValue({ resetToken: 'resetToken' });
                const response = await request(app)
                    .post('/verify-reset-otp')
                    .send({ email: 'test@test.com', otp: '123456' });
                expect(response.status).toBe(200);
                expect(response.body.data.resetToken).toBe('resetToken');
                expect(response.body.message).toBe('OTP verified successfully');
            });
        });

        describe('resetPassword', () => {
            it('should return 200 on successful password reset', async () => {
                (AuthService.resetPassword as jest.Mock).mockResolvedValue({});
                const response = await request(app)
                    .post('/reset-password')
                    .send({ resetToken: 'validToken', password: 'newPassword123' });
                expect(response.status).toBe(200);
                expect(response.body.message).toBe('Password reset successful');
            });

            it('should return 400 for an invalid token', async () => {
                (AuthService.resetPassword as jest.Mock).mockRejectedValue(new AppError('Invalid or expired token', 400, 'INVALID_TOKEN'));
                const response = await request(app)
                    .post('/reset-password')
                    .send({ resetToken: 'invalidToken', password: 'newPassword123' });
                expect(response.status).toBe(400);
                expect(response.body.message).toBe('Invalid or expired token');
            });
        });
    });

    describe('changePassword', () => {
        it('should return 200 on successful password change', async () => {
            (AuthService.changePassword as jest.Mock).mockResolvedValue({});
            const response = await request(app)
                .post('/change-password')
                .send({ currentPassword: 'oldPassword', newPassword: 'newPassword' });

            expect(response.status).toBe(200);
            expect(response.body.message).toBe('Password changed successfully');
        });

        it('should return 401 for incorrect current password', async () => {
            (AuthService.changePassword as jest.Mock).mockRejectedValue(new AppError('Incorrect password', 401, 'UNAUTHORIZED'));
            const response = await request(app)
                .post('/change-password')
                .send({ currentPassword: 'wrongPassword', newPassword: 'newPassword' });

            expect(response.status).toBe(401);
            expect(response.body.message).toBe('Incorrect password');
        });
    });

    describe('Email Verification', () => {
        describe('verifyEmail', () => {
            it('should return 200 on successful verification', async () => {
                const mockUser = { _id: '1', name: 'Test User' };
                const mockToken = 'mockToken';
                (AuthService.verifyEmail as jest.Mock).mockResolvedValue({ user: mockUser, token: mockToken, message: 'Email verified successfully' });

                const response = await request(app)
                    .post('/verify-email')
                    .send({ code: 'validCode' });

                expect(response.status).toBe(200);
                expect(response.body.message).toBe('Email verified successfully');
                expect(response.body.data.user).toEqual(mockUser);
                expect(response.body.data.token).toBe(mockToken);
            });

            it('should return 400 for an invalid code', async () => {
                (AuthService.verifyEmail as jest.Mock).mockRejectedValue(new AppError('Invalid or expired verification code', 400, 'INVALID_TOKEN'));
                const response = await request(app)
                    .post('/verify-email')
                    .send({ code: 'invalidCode' });

                expect(response.status).toBe(400);
                expect(response.body.message).toBe('Invalid or expired verification code');
            });
        });

        describe('resendVerificationOTP', () => {
            it('should return 200 on successful resend', async () => {
                (AuthService.resendVerificationOTP as jest.Mock).mockResolvedValue({});
                const response = await request(app)
                    .post('/resend-verification-otp')
                    .send({ email: 'test@test.com' });

                expect(response.status).toBe(200);
                expect(response.body.message).toBe('Verification OTP resent successfully');
            });
        });
    });

    describe('Multi-step Signup', () => {
        describe('initiateSignup', () => {
            it('should return 201 and user data on success', async () => {
                const mockUser = { _id: '1', name: 'Test User' };
                (AuthService.initiateSignup as jest.Mock).mockResolvedValue({ user: mockUser, message: 'Signup initiated' });

                const response = await request(app)
                    .post('/signup/initiate')
                    .send({ name: 'Test User', email: 'test@test.com', password: 'password' });

                expect(response.status).toBe(201);
                expect(response.body.data.user).toEqual(mockUser);
                expect(response.body.message).toBe('Signup initiated');
            });
        });

        describe('completeSignup', () => {
            it('should return 200 on successful completion', async () => {
                (AuthService.completeSignup as jest.Mock).mockResolvedValue({});
                const response = await request(app)
                    .post('/signup/complete')
                    .send({ faculty: 'Engineering' });

                expect(response.status).toBe(200);
                expect(response.body.message).toBe('Signup completed successfully');
            });
        });
    });
});
