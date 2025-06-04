import { Request, Response, NextFunction } from 'express';
import Event from '@models/Event';
import RSVP from '@models/RSVP';
import { Types } from 'mongoose';
import { AppError, ErrorCodes } from '@utils/appError';
import { HttpStatus } from '@utils/ApiResponse';
import {
  generateEventCalendar,
  generateMultipleEventsCalendar,
  generateGoogleCalendarUrl,
  generateOutlookCalendarUrl,
} from '@utils/calendarUtils';
import { generateEventRecommendations } from '@utils/recommendationUtils';
import asyncHandler from '../utils/asyncHandler';
import { IEventDocument } from '../interfaces/event.interface';

/**
 * Get all events with pagination, filtering and sorting
 */
export const getAllEvents = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const {
      page = 1,
      limit = 10,
      status,
      visibility,
      communityId,
      sortBy = 'startDate',
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
      .populate('communityId', 'name')
      .populate('rsvps.userId', 'name profilePicture');

    // Get total count for pagination
    const total = await Event.countDocuments(filter);
    const totalPages = Math.ceil(total / limitNum);

    res.paginated(
      events,
      {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
      'Events retrieved successfully'
    );
  }
);

/**
 * Get event by ID
 */
export const getEventById = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      throw new AppError('Invalid event ID', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    const event = await Event.findById(id)
      .populate('creatorId', 'name profilePicture')
      .populate('communityId', 'name')
      .populate('rsvps.userId', 'name profilePicture');

    if (!event) {
      res.notFound('Event not found');
      return;
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
  }
);

/**
 * Get event attendees
 */
export const getEventAttendees = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      throw new AppError('Invalid event ID', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    const attendees = await RSVP.find({ eventId: id, status: 'attending' })
      .populate('userId', 'name profilePicture')
      .sort({ createdAt: 1 });

    res.success({ attendees });
  }
);

/**
 * Get event metrics and stats for dashboard
 */
export const getEventMetrics = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
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
      startDate: { $gt: new Date() },
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
  }
);

/**
 * Get events for chart display (date, time, attendees)
 */
export const getEventsForChart = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
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
      filter.startDate = dateFilter;
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
          startDate: 1,
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
      { $sort: { startDate: 1 } },
    ]);

    res.success({ events }, 'Events chart data retrieved successfully');
  }
);

/**
 * Export event to iCal format
 */
export const exportEventToCalendar = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      throw new AppError('Invalid event ID', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    const event = (await Event.findById(id)) as IEventDocument;
    if (!event) {
      res.notFound('Event not found');
      return;
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
  }
);

/**
 * Export multiple events to iCal format
 */
export const exportMultipleEventsToCalendar = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      throw new AppError('Invalid or empty event IDs', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    // Validate all IDs
    const validIds = ids.filter((id) => Types.ObjectId.isValid(id));
    if (validIds.length !== ids.length) {
      throw new AppError('One or more invalid event IDs', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    // Find all events
    const events = (await Event.find({
      _id: { $in: validIds },
    })) as IEventDocument[];

    if (events.length === 0) {
      res.notFound('No events found');
      return;
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
  }
);

/**
 * Get calendar integration URLs for an event (Google, Outlook)
 */
export const getCalendarIntegrationUrls = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      throw new AppError('Invalid event ID', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    const event = (await Event.findById(id)) as IEventDocument;
    if (!event) {
      res.notFound('Event not found');
      return;
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
  }
);

/**
 * Get recommended events for the current user
 */
export const getRecommendedEvents = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      res.unauthorized('User not authenticated');
      return;
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
  }
);

/**
 * Update event recommendations for a specific event
 */
export const updateEventRecommendations = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { id } = req.params;
    const { recommendationIds } = req.body;

    if (!Types.ObjectId.isValid(id)) {
      throw new AppError('Invalid event ID', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    // Validate recommendation IDs
    if (!Array.isArray(recommendationIds)) {
      throw new AppError('recommendationIds must be an array', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    const validIds = recommendationIds.filter((recId) =>
      Types.ObjectId.isValid(recId)
    );
    if (validIds.length !== recommendationIds.length) {
      throw new AppError('One or more invalid recommendation IDs', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    // Update event recommendations
    const event = await Event.findByIdAndUpdate(
      id,
      { recommendations: validIds },
      { new: true }
    );

    if (!event) {
      res.notFound('Event not found');
      return;
    }

    res.success(event, 'Event recommendations updated successfully');
  }
);

/**
 * Update event image
 */
export const updateEventImage = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { id } = req.params;
    const { eventImage } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.unauthorized('User not authenticated');
      return;
    }

    if (!Types.ObjectId.isValid(id)) {
      throw new AppError('Invalid event ID', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    // Find event and check permissions
    const event = await Event.findById(id);

    if (!event) {
      res.notFound('Event not found');
      return;
    }

    // Check if user is creator or admin
    const isCreator = event.creatorId.toString() === userId.toString();
    const isAdmin =
      req.user?.role === 'admin' || req.user?.role === 'superadmin';

    if (!isCreator && !isAdmin) {
      res.failure(
        'Not authorized to update this event',
        ErrorCodes.FORBIDDEN,
        HttpStatus.FORBIDDEN
      );
      return;
    }

    // Update event image
    const updatedEvent = await Event.findByIdAndUpdate(
      id,
      { eventImage },
      { new: true }
    );

    res.success({ event: updatedEvent }, 'Event image updated successfully');
  }
);

/**
 * Create a new event
 */
export const createEvent = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { title, description, startDate, endDate, location, eventImage } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.unauthorized('User not authenticated');
      return;
    }

    const event = await Event.create({
      title,
      description,
      startDate,
      endDate,
      location,
      eventImage,
      creatorId: new Types.ObjectId(userId),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    res.success({ event }, 'Event created successfully', HttpStatus.CREATED);
  }
);

/**
 * Update an existing event
 */
export const updateEvent = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.unauthorized('User not authenticated');
      return;
    }

    if (!Types.ObjectId.isValid(id)) {
      res.badRequest('Invalid event ID');
      return;
    }

    const event = await Event.findById(id).exec();
    if (!event) {
      res.notFound('Event not found');
      return;
    }

    if (event.creatorId.toString() !== userId) {
      res.failure(
        'Not authorized to update this event',
        ErrorCodes.FORBIDDEN,
        HttpStatus.FORBIDDEN
      );
      return;
    }

    await Event.updateOne({ _id: id }, { ...req.body, updatedAt: new Date() });

    res.success(
      { event: await Event.findById(id).exec() },
      'Event updated successfully'
    );
  }
);

/**
 * Delete an event
 */
export const deleteEvent = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.unauthorized('User not authenticated');
      return;
    }

    if (!Types.ObjectId.isValid(id)) {
      res.badRequest('Invalid event ID');
      return;
    }

    const event = await Event.findById(id).exec();
    if (!event) {
      res.notFound('Event not found');
      return;
    }

    if (event.creatorId.toString() !== userId) {
      res.failure(
        'Not authorized to delete this event',
        ErrorCodes.FORBIDDEN,
        HttpStatus.FORBIDDEN
      );
      return;
    }

    await Event.deleteOne({ _id: id });

    res.success(null, 'Event deleted successfully');
  }
);

/**
 * Create or update RSVP for an event
 */
export const createOrUpdateRSVP = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { eventId } = req.params;
    const userId = req.user?.id;
    const { status } = req.body;

    if (!userId) {
      res.unauthorized('User not authenticated');
      return;
    }

    if (!Types.ObjectId.isValid(eventId)) {
      res.badRequest('Invalid event ID');
      return;
    }

    const rsvpPayload = {
      userId: new Types.ObjectId(userId),
      status,
      updatedAt: new Date(),
    };

    // Step 1: Pull any existing RSVP for the user.
    // This also checks if the event exists. If eventId is not found, eventAfterPull will be null.
    const eventAfterPull = await Event.findOneAndUpdate(
      { _id: eventId },
      { $pull: { rsvps: { userId: rsvpPayload.userId } } },
      { new: true } // `new: true` ensures we get the document state after the pull or null if not found.
    ).exec();

    if (!eventAfterPull) {
      res.notFound('Event not found');
      return;
    }

    // Step 2: Push the new RSVP.
    // We use findOneAndUpdate again to confirm the operation's success and handle race conditions.
    const finalEvent = await Event.findOneAndUpdate(
      { _id: eventId },
      { $push: { rsvps: rsvpPayload } },
      { new: true, upsert: false } // `upsert: false` is default, explicitly stating we don't create event here.
    ).exec();

    if (!finalEvent) {
      // This rare case means the event was deleted between the pull and push operations.
      _next(new Error('Failed to save RSVP. Event may have been modified concurrently. Please try again.'));
      return;
    }

    res.success({ rsvp: rsvpPayload }, 'RSVP updated successfully');
  }
);

/**
 * Get RSVP status for current user
 */
export const getUserRSVP = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { eventId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.unauthorized('User not authenticated');
      return;
    }

    if (!Types.ObjectId.isValid(eventId)) {
      res.badRequest('Invalid event ID');
      return;
    }

    const event = await Event.findById(eventId)
      .populate({
        path: 'rsvps.userId',
        select: 'name profilePicture email', // Populating user details
      })
      .exec();
    if (!event) {
      res.notFound('Event not found');
      return;
    }

    const rsvp = event.rsvps.find(
      (r: any) => r.userId && r.userId._id.toString() === userId
    );

    res.success({ rsvp: rsvp || null }, 'RSVP retrieved successfully');
  }
);

/**
 * Delete user's RSVP
 */
export const deleteRSVP = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { eventId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.unauthorized('User not authenticated');
      return;
    }

    if (!Types.ObjectId.isValid(eventId)) {
      res.badRequest('Invalid event ID');
      return;
    }

    const event = await Event.findById(eventId).exec();
    if (!event) {
      res.notFound('Event not found');
      return;
    }

    await Event.updateOne(
      { _id: eventId },
      { $pull: { rsvps: { userId: new Types.ObjectId(userId) } } }
    );

    res.success(null, 'RSVP deleted successfully');
  }
);

/**
 * Get all RSVPs for an event
 */
export const getEventRSVPs = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { eventId } = req.params;

    if (!Types.ObjectId.isValid(eventId)) {
      res.badRequest('Invalid event ID');
      return;
    }

    const event = await Event.findById(eventId)
      .populate({
        path: 'rsvps.userId',
        select: 'name profilePicture email', // Populating user details
      })
      .exec();
    if (!event) {
      res.notFound('Event not found');
      return;
    }

    res.success({ rsvps: event.rsvps || [] }, 'RSVPs retrieved successfully');
  }
);
