import { Request, Response, NextFunction } from 'express';
import User from '@models/User';
import Community from '@models/Community';
import Event from '@models/Event';
import Resource from '@models/Resource';
import { AppError, ErrorCodes } from '@utils/appError';
import { ResponseBuilder, HttpStatus } from '@utils/ApiResponse';
import asyncHandler from '@utils/asyncHandler';

/**
 * Get aggregated dashboard data
 * Returns counts of students, active events, resources, and communities
 */
export const getDashboardStats = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  // Run all queries in parallel for better performance
  const [
    totalStudents,
    totalFaculty,
    totalAdmins,
    activeEvents,
    totalResources,
    totalCommunities,
    officialCommunities,
    userCommunities
  ] = await Promise.all([
    User.countDocuments({ role: 'student' }),
    User.countDocuments({ role: 'faculty' }),
    User.countDocuments({ role: { $in: ['admin', 'superadmin'] } }),
    Event.countDocuments({ status: { $in: ['upcoming', 'ongoing'] } }),
    Resource.countDocuments({}),
    Community.countDocuments({}),
    Community.countDocuments({ type: 'official' }),
    Community.countDocuments({ type: 'user' })
  ]);

  // Calculate total users
  const totalUsers = totalStudents + totalFaculty + totalAdmins;

  const dashboardData = {
    users: {
      total: totalUsers,
      students: totalStudents,
      faculty: totalFaculty,
      admins: totalAdmins
    },
    events: {
      active: activeEvents
    },
    resources: {
      total: totalResources
    },
    communities: {
      total: totalCommunities,
      official: officialCommunities,
      user: userCommunities
    }
  };

  res.success(dashboardData, 'Dashboard stats retrieved successfully');
});

/**
 * Get user count history for charts
 * Returns user registration data over time
 */
export const getUserCountHistory = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { period = 'month', role } = req.query;

  // Determine start date based on period
  const startDate = new Date();
  if (period === 'week') {
    startDate.setDate(startDate.getDate() - 7);
  } else if (period === 'month') {
    startDate.setMonth(startDate.getMonth() - 1);
  } else if (period === 'year') {
    startDate.setFullYear(startDate.getFullYear() - 1);
  } else {
    throw new AppError('Invalid period specified', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
  }

  // Build match stage for aggregation
  const matchStage: any = {
    createdAt: { $gte: startDate }
  };

  // Add role filter if specified
  if (role) {
    matchStage.role = role;
  }

  // Group by date format based on period
  let dateFormat;
  if (period === 'week') {
    dateFormat = '%Y-%m-%d'; // Daily for week
  } else if (period === 'month') {
    dateFormat = '%Y-%m-%d'; // Daily for month
  } else {
    dateFormat = '%Y-%m'; // Monthly for year
  }

  // Run aggregation
  const userHistory = await User.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: dateFormat, date: '$createdAt' } },
          role: '$role'
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { '_id.date': 1 } },
    {
      $group: {
        _id: '$_id.date',
        roles: {
          $push: {
            role: '$_id.role',
            count: '$count'
          }
        },
        totalCount: { $sum: '$count' }
      }
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        date: '$_id',
        roles: 1,
        totalCount: 1,
        _id: 0
      }
    }
  ]);

  res.success({ period, userHistory }, 'User count history retrieved successfully');
});

/**
 * Get recent notifications for dashboard
 * Returns recent events, new users, resources, and communities
 */
export const getRecentNotifications = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { limit = 5 } = req.query;
  const limitNum = parseInt(limit as string, 10);

  // Get recent data from each collection (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [recentUsers, recentEvents, recentResources, recentCommunities] = await Promise.all([
    User.find({ createdAt: { $gte: thirtyDaysAgo } })
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .select('name profilePicture role createdAt'),

    Event.find({ createdAt: { $gte: thirtyDaysAgo } })
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .select('title dateTime status createdAt')
      .populate('creatorId', 'name profilePicture'),

    Resource.find({ createdAt: { $gte: thirtyDaysAgo } })
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .select('title category createdAt')
      .populate('uploader', 'name profilePicture'),

    Community.find({ createdAt: { $gte: thirtyDaysAgo } })
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .select('name type createdAt')
      .populate('owner', 'name profilePicture')
  ]);

  // Combine and sort all notifications by date
  const allNotifications = [
    ...recentUsers.map(user => ({
      type: 'user',
      data: user,
      createdAt: user.createdAt
    })),
    ...recentEvents.map(event => ({
      type: 'event',
      data: event,
      createdAt: event.createdAt
    })),
    ...recentResources.map(resource => ({
      type: 'resource',
      data: resource,
      createdAt: resource.createdAt
    })),
    ...recentCommunities.map(community => ({
      type: 'community',
      data: community,
      createdAt: community.createdAt
    }))
  ];

  // Sort by date (newest first) and limit
  const sortedNotifications = allNotifications
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limitNum);

  res.success({ notifications: sortedNotifications }, 'Recent notifications retrieved successfully');
});
