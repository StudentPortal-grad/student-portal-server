import { Request, Response, NextFunction } from 'express';
import Event from '@models/Event';
import RSVP from '@models/RSVP';
import { Types } from 'mongoose';
import { AppError, ErrorCodes } from '@utils/appError';
import {
  generateEventCalendar,
  generateMultipleEventsCalendar,
  generateGoogleCalendarUrl,
  generateOutlookCalendarUrl,
} from '@utils/calendarUtils';
import { generateEventRecommendations } from '@utils/recommendationUtils';
import {
  NotFoundError,
  ValidationError,
  AuthorizationError,
} from '../utils/errors';
import { IEventDocument } from '../interfaces/event.interface';

/**
 * Get all events with pagination, filtering and sorting
 */
export const getAllEvents = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      visibility,
      communityId,
      sortBy = 'dateTime',
      sortOrder = 'asc',
    } = req.query;

    // Build filter
    const filter: any = {};
    if (status) filter.status = status;
    if (visibility) filter.visibility = visibility;
    if (communityId) filter.communityId = communityId;

    // Build sort
    const sort: any = {};
    sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

    // Calculate pagination
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Execute query with pagination
    const events = await Event.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .populate('creatorId', 'name profilePicture')
      .populate('communityId', 'name');

    // Get total count for pagination
    const total = await Event.countDocuments(filter);

    res.success({
      events,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(
      new AppError(
        error instanceof Error ? error.message : 'Failed to fetch events',
        500,
        ErrorCodes.INTERNAL_ERROR
      )
    );
  }
};

/**
 * Get event by ID
 */
export const getEventById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      return next(
        new AppError('Invalid event ID', 400, ErrorCodes.VALIDATION_ERROR)
      );
    }

    const event = await Event.findById(id)
      .populate('creatorId', 'name profilePicture')
      .populate('communityId', 'name');

    if (!event) {
      return next(new AppError('Event not found', 404, ErrorCodes.NOT_FOUND));
    }

    // Get RSVP counts
    const rsvpCounts = await RSVP.aggregate([
      { $match: { eventId: new Types.ObjectId(id) } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const rsvpStats = {
      attending: 0,
      maybe: 0,
      declined: 0,
    };

    rsvpCounts.forEach((item) => {
      if (item._id === 'attending') rsvpStats.attending = item.count;
      if (item._id === 'maybe') rsvpStats.maybe = item.count;
      if (item._id === 'declined') rsvpStats.declined = item.count;
    });

    res.success({
      event,
      rsvpStats,
    });
  } catch (_error) {
    next(new AppError('Failed to fetch event', 500, ErrorCodes.INTERNAL_ERROR));
  }
};

/**
 * Create a new event
 */
export const createEvent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      title,
      description,
      dateTime,
      location,
      capacity,
      visibility,
      communityId,
    } = req.body;
    const creatorId = req.user?.id;

    if (!creatorId) {
      return next(
        new AppError('User not authenticated', 401, ErrorCodes.UNAUTHORIZED)
      );
    }

    // Create event
    const event = await Event.create({
      title,
      description,
      dateTime,
      location,
      capacity,
      visibility,
      communityId,
      creatorId,
    });

    res.success({ event }, 'Event created successfully', 201);
  } catch (_error) {
    next(
      new AppError('Failed to create event', 500, ErrorCodes.INTERNAL_ERROR)
    );
  }
};

/**
 * Update an event
 */
export const updateEvent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      dateTime,
      location,
      capacity,
      visibility,
      communityId,
    } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return next(
        new AppError('User not authenticated', 401, ErrorCodes.UNAUTHORIZED)
      );
    }

    if (!Types.ObjectId.isValid(id)) {
      return next(
        new AppError('Invalid event ID', 400, ErrorCodes.VALIDATION_ERROR)
      );
    }

    // Find event and check permissions
    const event = await Event.findById(id);

    if (!event) {
      return next(new AppError('Event not found', 404, ErrorCodes.NOT_FOUND));
    }

    // Check if user is creator or admin
    const isCreator = event.creatorId.toString() === userId.toString();
    const isAdmin =
      req.user?.role === 'admin' || req.user?.role === 'superadmin';

    if (!isCreator && !isAdmin) {
      return next(
        new AppError(
          'Not authorized to update this event',
          403,
          ErrorCodes.FORBIDDEN
        )
      );
    }

    // Update event
    const updatedEvent = await Event.findByIdAndUpdate(
      id,
      {
        title,
        description,
        dateTime,
        location,
        capacity,
        visibility,
        communityId,
      },
      { new: true, runValidators: true }
    );

    res.success({ event: updatedEvent }, 'Event updated successfully');
  } catch (_error) {
    next(
      new AppError('Failed to update event', 500, ErrorCodes.INTERNAL_ERROR)
    );
  }
};

/**
 * Delete an event
 */
export const deleteEvent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return next(
        new AppError('User not authenticated', 401, ErrorCodes.UNAUTHORIZED)
      );
    }

    if (!Types.ObjectId.isValid(id)) {
      return next(
        new AppError('Invalid event ID', 400, ErrorCodes.VALIDATION_ERROR)
      );
    }

    // Find event and check permissions
    const event = await Event.findById(id);

    if (!event) {
      return next(new AppError('Event not found', 404, ErrorCodes.NOT_FOUND));
    }

    // Check if user is creator or admin
    const isCreator = event.creatorId.toString() === userId.toString();
    const isAdmin =
      req.user?.role === 'admin' || req.user?.role === 'superadmin';

    if (!isCreator && !isAdmin) {
      return next(
        new AppError(
          'Not authorized to delete this event',
          403,
          ErrorCodes.FORBIDDEN
        )
      );
    }

    // Delete event
    await Event.findByIdAndDelete(id);

    // Delete associated RSVPs
    await RSVP.deleteMany({ eventId: id });

    res.success(null, 'Event deleted successfully');
  } catch (_error) {
    next(
      new AppError('Failed to delete event', 500, ErrorCodes.INTERNAL_ERROR)
    );
  }
};

/**
 * Get event attendees
 */
export const getEventAttendees = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      return next(
        new AppError('Invalid event ID', 400, ErrorCodes.VALIDATION_ERROR)
      );
    }

    const attendees = await RSVP.find({ eventId: id, status: 'attending' })
      .populate('userId', 'name profilePicture')
      .sort({ createdAt: 1 });

    res.success({ attendees });
  } catch (_error) {
    next(
      new AppError('Failed to fetch attendees', 500, ErrorCodes.INTERNAL_ERROR)
    );
  }
};

/**
 * Get event metrics and stats for dashboard
 */
export const getEventMetrics = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Get counts by status
    const statusCounts = await Event.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    // Format status counts
    const eventsByStatus = {
      upcoming: 0,
      ongoing: 0,
      completed: 0,
      cancelled: 0,
    };

    statusCounts.forEach((item) => {
      if (item._id in eventsByStatus) {
        eventsByStatus[item._id as keyof typeof eventsByStatus] = item.count;
      }
    });

    // Get counts by visibility
    const visibilityCounts = await Event.aggregate([
      { $group: { _id: '$visibility', count: { $sum: 1 } } },
    ]);

    // Format visibility counts
    const eventsByVisibility = {
      public: 0,
      private: 0,
      community: 0,
    };

    visibilityCounts.forEach((item) => {
      if (item._id in eventsByVisibility) {
        eventsByVisibility[item._id as keyof typeof eventsByVisibility] =
          item.count;
      }
    });

    // Get upcoming events count
    const upcomingEventsCount = await Event.countDocuments({
      status: 'upcoming',
      dateTime: { $gt: new Date() },
    });

    // Get total RSVP counts
    const rsvpCounts = await RSVP.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    // Format RSVP counts
    const rsvpByStatus = {
      attending: 0,
      maybe: 0,
      declined: 0,
    };

    rsvpCounts.forEach((item) => {
      if (item._id in rsvpByStatus) {
        rsvpByStatus[item._id as keyof typeof rsvpByStatus] = item.count;
      }
    });

    // Get events created in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentEventsCount = await Event.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
    });

    res.success(
      {
        eventsByStatus,
        eventsByVisibility,
        upcomingEventsCount,
        rsvpByStatus,
        recentEventsCount,
      },
      'Event metrics retrieved successfully'
    );
  } catch (_error) {
    next(
      new AppError(
        'Failed to fetch event metrics',
        500,
        ErrorCodes.INTERNAL_ERROR
      )
    );
  }
};

/**
 * Get events for chart display (date, time, attendees)
 */
export const getEventsForChart = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { startDate, endDate } = req.query;

    // Build date filter
    const dateFilter: any = {};
    if (startDate) {
      dateFilter.$gte = new Date(startDate as string);
    }
    if (endDate) {
      dateFilter.$lte = new Date(endDate as string);
    }

    const filter: any = {};
    if (Object.keys(dateFilter).length > 0) {
      filter.dateTime = dateFilter;
    }

    // Get events with attendance counts
    const events = await Event.aggregate([
      { $match: filter },
      {
        $lookup: {
          from: 'rsvps',
          localField: '_id',
          foreignField: 'eventId',
          as: 'rsvps',
        },
      },
      {
        $project: {
          title: 1,
          dateTime: 1,
          status: 1,
          attendeesCount: {
            $size: {
              $filter: {
                input: '$rsvps',
                as: 'rsvp',
                cond: { $eq: ['$$rsvp.status', 'attending'] },
              },
            },
          },
        },
      },
      { $sort: { dateTime: 1 } },
    ]);

    res.success({ events }, 'Events chart data retrieved successfully');
  } catch (_error) {
    next(
      new AppError(
        'Failed to fetch events chart data',
        500,
        ErrorCodes.INTERNAL_ERROR
      )
    );
  }
};

/**
 * Export event to iCal format
 */
export const exportEventToCalendar = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      return next(
        new AppError('Invalid event ID', 400, ErrorCodes.VALIDATION_ERROR)
      );
    }

    const event = (await Event.findById(id)) as IEventDocument;
    if (!event) {
      return next(new AppError('Event not found', 404, ErrorCodes.NOT_FOUND));
    }

    const calendar = generateEventCalendar(event);

    // Set response headers for file download
    res.setHeader('Content-Type', 'text/calendar');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="event-${id}.ics"`
    );

    // Send the calendar data
    res.send(calendar);
  } catch (error) {
    next(
      new AppError(
        error instanceof Error ? error.message : 'Failed to export event',
        500,
        ErrorCodes.INTERNAL_ERROR
      )
    );
  }
};

/**
 * Export multiple events to iCal format
 */
export const exportMultipleEventsToCalendar = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return next(
        new AppError(
          'Invalid or empty event IDs',
          400,
          ErrorCodes.VALIDATION_ERROR
        )
      );
    }

    // Validate all IDs
    const validIds = ids.filter((id) => Types.ObjectId.isValid(id));
    if (validIds.length !== ids.length) {
      return next(
        new AppError(
          'One or more invalid event IDs',
          400,
          ErrorCodes.VALIDATION_ERROR
        )
      );
    }

    // Find all events
    const events = (await Event.find({
      _id: { $in: validIds },
    })) as IEventDocument[];
    if (events.length === 0) {
      return next(new AppError('No events found', 404, ErrorCodes.NOT_FOUND));
    }

    const calendar = generateMultipleEventsCalendar(events);

    // Set response headers for file download
    res.setHeader('Content-Type', 'text/calendar');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="events-${new Date().toISOString().slice(0, 10)}.ics"`
    );

    // Send the calendar data
    res.send(calendar);
  } catch (error) {
    next(
      new AppError(
        error instanceof Error ? error.message : 'Failed to export events',
        500,
        ErrorCodes.INTERNAL_ERROR
      )
    );
  }
};

/**
 * Get calendar integration URLs for an event (Google, Outlook)
 */
export const getCalendarIntegrationUrls = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      return next(
        new AppError('Invalid event ID', 400, ErrorCodes.VALIDATION_ERROR)
      );
    }

    const event = (await Event.findById(id)) as IEventDocument;
    if (!event) {
      return next(new AppError('Event not found', 404, ErrorCodes.NOT_FOUND));
    }

    // Generate calendar URLs
    const googleUrl = generateGoogleCalendarUrl(event);
    const outlookUrl = generateOutlookCalendarUrl(event);

    res.success(
      {
        google: googleUrl,
        outlook: outlookUrl,
        ical: `${req.protocol}://${req.get('host')}/api/v1/events/${id}/export-calendar`,
      },
      'Calendar integration URLs generated successfully'
    );
  } catch (error) {
    next(
      new AppError(
        error instanceof Error
          ? error.message
          : 'Failed to generate calendar URLs',
        500,
        ErrorCodes.INTERNAL_ERROR
      )
    );
  }
};

/**
 * Get recommended events for the current user
 */
export const getRecommendedEvents = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return next(
        new AppError('User not authenticated', 401, ErrorCodes.UNAUTHORIZED)
      );
    }

    const { limit = 5 } = req.query;
    const limitNum = parseInt(limit as string, 10);

    // Generate recommendations
    const recommendations = await generateEventRecommendations(
      userId.toString(),
      limitNum
    );

    res.success(
      {
        recommendations,
        count: recommendations.length,
      },
      'Event recommendations generated successfully'
    );
  } catch (error) {
    next(
      new AppError(
        error instanceof Error
          ? error.message
          : 'Failed to generate event recommendations',
        500,
        ErrorCodes.INTERNAL_ERROR
      )
    );
  }
};

/**
 * Update event recommendations for a specific event
 */
export const updateEventRecommendations = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { recommendationIds } = req.body;

    if (!Types.ObjectId.isValid(id)) {
      return next(
        new AppError('Invalid event ID', 400, ErrorCodes.VALIDATION_ERROR)
      );
    }

    // Validate recommendation IDs
    if (!Array.isArray(recommendationIds)) {
      return next(
        new AppError(
          'recommendationIds must be an array',
          400,
          ErrorCodes.VALIDATION_ERROR
        )
      );
    }

    const validIds = recommendationIds.filter((recId) =>
      Types.ObjectId.isValid(recId)
    );
    if (validIds.length !== recommendationIds.length) {
      return next(
        new AppError(
          'One or more invalid recommendation IDs',
          400,
          ErrorCodes.VALIDATION_ERROR
        )
      );
    }

    // Update event recommendations
    const event = await Event.findByIdAndUpdate(
      id,
      { recommendations: validIds },
      { new: true }
    );

    if (!event) {
      return next(new AppError('Event not found', 404, ErrorCodes.NOT_FOUND));
    }

    res.success(event, 'Event recommendations updated successfully');
  } catch (error) {
    next(
      new AppError(
        error instanceof Error
          ? error.message
          : 'Failed to update event recommendations',
        500,
        ErrorCodes.INTERNAL_ERROR
      )
    );
  }
};

export class EventController {
  async createEvent(req: Request, _res: Response) {
    const { title, description, startDate, endDate, location } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      throw new AuthorizationError('User not authenticated');
    }

    const event = await Event.create({
      title,
      description,
      startDate,
      endDate,
      location,
      creatorId: new Types.ObjectId(userId),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return {
      success: true,
      data: {
        event,
      },
    };
  }

  async getAllEvents(_req: Request, _res: Response) {
    const events = await Event.find().exec();
    return {
      success: true,
      data: {
        events,
      },
    };
  }

  async getEventById(req: Request, _res: Response) {
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      throw new ValidationError('Invalid event ID');
    }

    const event = await Event.findById(id).exec();
    if (!event) {
      throw new NotFoundError('Event not found');
    }

    return {
      success: true,
      data: {
        event,
      },
    };
  }

  async updateEvent(req: Request, _res: Response) {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      throw new AuthorizationError('User not authenticated');
    }

    if (!Types.ObjectId.isValid(id)) {
      throw new ValidationError('Invalid event ID');
    }

    const event = await Event.findById(id).exec();
    if (!event) {
      throw new NotFoundError('Event not found');
    }

    if (event.creatorId.toString() !== userId) {
      throw new AuthorizationError('Not authorized to update this event');
    }

    await Event.updateOne({ _id: id }, { ...req.body, updatedAt: new Date() });

    return {
      success: true,
      data: {
        event: await Event.findById(id).exec(),
      },
    };
  }

  async deleteEvent(req: Request, _res: Response) {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      throw new AuthorizationError('User not authenticated');
    }

    if (!Types.ObjectId.isValid(id)) {
      throw new ValidationError('Invalid event ID');
    }

    const event = await Event.findById(id).exec();
    if (!event) {
      throw new NotFoundError('Event not found');
    }

    if (event.creatorId.toString() !== userId) {
      throw new AuthorizationError('Not authorized to delete this event');
    }

    await Event.deleteOne({ _id: id });

    return {
      success: true,
      message: 'Event deleted successfully',
    };
  }

  async createOrUpdateRSVP(req: Request, _res: Response) {
    const { id } = req.params;
    const userId = req.user?.id;
    const { status } = req.body;

    if (!userId) {
      throw new AuthorizationError('User not authenticated');
    }

    if (!Types.ObjectId.isValid(id)) {
      throw new ValidationError('Invalid event ID');
    }

    const event = await Event.findById(id).exec();
    if (!event) {
      throw new NotFoundError('Event not found');
    }

    const rsvp = {
      userId: new Types.ObjectId(userId),
      status,
      updatedAt: new Date(),
    };

    await Event.updateOne(
      { _id: id },
      {
        $pull: { rsvps: { userId: rsvp.userId } },
        $push: { rsvps: rsvp },
      }
    );

    return {
      success: true,
      data: {
        rsvp,
      },
    };
  }

  async getUserRSVP(req: Request, _res: Response) {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      throw new AuthorizationError('User not authenticated');
    }

    if (!Types.ObjectId.isValid(id)) {
      throw new ValidationError('Invalid event ID');
    }

    const event = await Event.findById(id).exec();
    if (!event) {
      throw new NotFoundError('Event not found');
    }

    const rsvp = event.rsvps.find(
      (r: { userId: Types.ObjectId; status: string; updatedAt: Date }) =>
        r.userId.toString() === userId
    );

    return {
      success: true,
      data: {
        rsvp: rsvp || null,
      },
    };
  }

  async deleteRSVP(req: Request, _res: Response) {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      throw new AuthorizationError('User not authenticated');
    }

    if (!Types.ObjectId.isValid(id)) {
      throw new ValidationError('Invalid event ID');
    }

    const event = await Event.findById(id).exec();
    if (!event) {
      throw new NotFoundError('Event not found');
    }

    await Event.updateOne(
      { _id: id },
      { $pull: { rsvps: { userId: new Types.ObjectId(userId) } } }
    );

    return {
      success: true,
      message: 'RSVP deleted successfully',
    };
  }

  async getEventRSVPs(req: Request, _res: Response) {
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      throw new ValidationError('Invalid event ID');
    }

    const event = await Event.findById(id).exec();
    if (!event) {
      throw new NotFoundError('Event not found');
    }

    return {
      success: true,
      data: {
        rsvps: event.rsvps || [],
      },
    };
  }
}
