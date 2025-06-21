import { Request, Response, NextFunction } from 'express';
import User from '../models/User';
import { AppError, ErrorCodes } from '../utils/appError';
import { HttpStatus } from '../utils/ApiResponse';
import asyncHandler from '../utils/asyncHandler';
import FCMUtils from '../utils/fcmUtils';

/**
 * Update user's FCM token
 * @route POST /api/v1/fcm/token
 */
export const updateFCMToken = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { fcmToken, platform = 'mobile' } = req.body;
    const userId = req.user?._id;

    if (!userId) {
        return next(new AppError('User not authenticated', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED));
    }

    if (!fcmToken) {
        return next(new AppError('FCM token is required', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR));
    }

    // Validate FCM token format (basic validation)
    if (typeof fcmToken !== 'string' || fcmToken.length < 100) {
        return next(new AppError('Invalid FCM token format', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR));
    }

    try {
        // Validate the FCM token with Firebase
        const isValidToken = await FCMUtils.validateToken(fcmToken);
        
        if (!isValidToken) {
            return next(new AppError('Invalid FCM token', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR));
        }

        // Update user's FCM token
        const user = await User.findByIdAndUpdate(
            userId,
            { 
                fcmToken,
                $set: {
                    'metadata.platform': platform,
                    'metadata.lastFCMUpdate': new Date()
                }
            },
            { new: true, runValidators: false }
        );

        if (!user) {
            return next(new AppError('User not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND));
        }

        // Send a test notification to verify the token works
        try {
            await FCMUtils.sendToToken(fcmToken, {
                title: 'Token Updated',
                body: 'Your push notification token has been successfully updated.',
            }, {
                type: 'token_update',
                userId: userId.toString(),
                timestamp: new Date().toISOString()
            });
        } catch (fcmError) {
            console.warn('Failed to send test notification:', fcmError);
            // Don't fail the request if test notification fails
        }

        res.success({ 
            message: 'FCM token updated successfully',
            fcmToken: fcmToken.substring(0, 20) + '...', // Return partial token for verification
            platform
        }, 'FCM token updated successfully');

    } catch (error) {
        console.error('Error updating FCM token:', error);
        return next(new AppError('Failed to update FCM token', HttpStatus.INTERNAL_SERVER_ERROR, ErrorCodes.INTERNAL_ERROR));
    }
});

/**
 * Remove user's FCM token (logout)
 * @route DELETE /api/v1/fcm/token
 */
export const removeFCMToken = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?._id;

    if (!userId) {
        return next(new AppError('User not authenticated', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED));
    }

    try {
        const user = await User.findByIdAndUpdate(
            userId,
            { 
                fcmToken: null,
                $unset: {
                    'metadata.platform': 1,
                    'metadata.lastFCMUpdate': 1
                }
            },
            { new: true, runValidators: false }
        );

        if (!user) {
            return next(new AppError('User not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND));
        }

        res.success({ message: 'FCM token removed successfully' }, 'FCM token removed successfully');

    } catch (error) {
        console.error('Error removing FCM token:', error);
        return next(new AppError('Failed to remove FCM token', HttpStatus.INTERNAL_SERVER_ERROR, ErrorCodes.INTERNAL_ERROR));
    }
});

/**
 * Get user's FCM token status
 * @route GET /api/v1/fcm/status
 */
export const getFCMStatus = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?._id;

    if (!userId) {
        return next(new AppError('User not authenticated', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED));
    }

    try {
        const user = await User.findById(userId).select('fcmToken').lean();

        if (!user) {
            return next(new AppError('User not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND));
        }

        const hasToken = !!user.fcmToken;
        let tokenValid = false;

        if (hasToken && user.fcmToken) {
            try {
                tokenValid = await FCMUtils.validateToken(user.fcmToken);
                
                // If token is invalid, remove it
                if (!tokenValid) {
                    await User.findByIdAndUpdate(userId, { fcmToken: null });
                }
            } catch (error) {
                console.error('Error validating FCM token:', error);
                tokenValid = false;
            }
        }

        res.success({
            hasToken,
            tokenValid,
            platform: null, // Not implemented in current schema
            lastUpdate: null // Not implemented in current schema
        }, 'FCM status retrieved successfully');

    } catch (error) {
        console.error('Error getting FCM status:', error);
        return next(new AppError('Failed to get FCM status', HttpStatus.INTERNAL_SERVER_ERROR, ErrorCodes.INTERNAL_ERROR));
    }
});

/**
 * Subscribe user to a topic
 * @route POST /api/v1/fcm/subscribe
 */
export const subscribeToTopic = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { topic } = req.body;
    const userId = req.user?._id;

    if (!userId) {
        return next(new AppError('User not authenticated', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED));
    }

    if (!topic) {
        return next(new AppError('Topic is required', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR));
    }

    try {
        const user = await User.findById(userId).select('fcmToken');

        if (!user) {
            return next(new AppError('User not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND));
        }

        if (!user.fcmToken) {
            return next(new AppError('No FCM token found for user', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR));
        }

        const response = await FCMUtils.subscribeToTopic([user.fcmToken], topic);

        res.success({
            topic,
            successCount: response.successCount,
            failureCount: response.failureCount
        }, 'Successfully subscribed to topic');

    } catch (error) {
        console.error('Error subscribing to topic:', error);
        return next(new AppError('Failed to subscribe to topic', HttpStatus.INTERNAL_SERVER_ERROR, ErrorCodes.INTERNAL_ERROR));
    }
});

/**
 * Unsubscribe user from a topic
 * @route POST /api/v1/fcm/unsubscribe
 */
export const unsubscribeFromTopic = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { topic } = req.body;
    const userId = req.user?._id;

    if (!userId) {
        return next(new AppError('User not authenticated', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED));
    }

    if (!topic) {
        return next(new AppError('Topic is required', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR));
    }

    try {
        const user = await User.findById(userId).select('fcmToken');

        if (!user) {
            return next(new AppError('User not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND));
        }

        if (!user.fcmToken) {
            return next(new AppError('No FCM token found for user', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR));
        }

        const response = await FCMUtils.unsubscribeFromTopic([user.fcmToken], topic);

        res.success({
            topic,
            successCount: response.successCount,
            failureCount: response.failureCount
        }, 'Successfully unsubscribed from topic');

    } catch (error) {
        console.error('Error unsubscribing from topic:', error);
        return next(new AppError('Failed to unsubscribe from topic', HttpStatus.INTERNAL_SERVER_ERROR, ErrorCodes.INTERNAL_ERROR));
    }
}); 