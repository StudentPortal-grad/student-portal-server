import { Request, Response, NextFunction } from 'express';
import RSVP from '@models/RSVP';
import Event from '@models/Event';
import { Types } from 'mongoose';
import { AppError, ErrorCodes } from '@utils/appError';

/**
 * Create or update RSVP for an event
 * @route POST /events/:eventId/rsvp
 */
export const createOrUpdateRSVP = async (req: Request, res: Response, next: NextFunction) => {
  try {
  const { eventId } = req.params;
  const { status } = req.body;
  const userId = req.user?._id;

  if (!userId) {
    return res.unauthorized('User not authenticated');
  }

  // Validate event ID
  if (!Types.ObjectId.isValid(eventId)) {
    return res.validationError('Invalid event ID', { field: 'eventId' });
  }

  // Check if event exists
  const event = await Event.findById(eventId);
  if (!event) {
    return res.notFound('Event not found');
  }

  // Check if event is in the past
  if (new Date(event.dateTime) < new Date()) {
    return res.badRequest('Cannot RSVP to past events');
  }

  // Check if event capacity is reached for 'attending' status
  if (status === 'attending' && event.capacity) {
    const attendingCount = await RSVP.countDocuments({ eventId, status: 'attending' });
    if (attendingCount >= event.capacity) {
      return res.badRequest('Event capacity has been reached');
    }
  }

  // Find existing RSVP or create new one
  let rsvp = await RSVP.findOne({ eventId, userId });

  if (rsvp) {
    // Update existing RSVP
    rsvp.status = status;
    await rsvp.save();
  } else {
    // Create new RSVP
    rsvp = await RSVP.create({
      eventId,
      userId,
      status
    });
  }

  // Populate user data
  await rsvp.populate('userId', 'name profilePicture');

    res.success({ rsvp }, 'RSVP updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Get user's RSVP status for an event
 * @route GET /events/:eventId/rsvp
 */
export const getUserRSVP = async (req: Request, res: Response, next: NextFunction) => {
  try {
  const { eventId } = req.params;
  const userId = req.user?._id;

  if (!userId) {
    return res.unauthorized('User not authenticated');
  }

  // Validate event ID
  if (!Types.ObjectId.isValid(eventId)) {
    return res.validationError('Invalid event ID', { field: 'eventId' });
  }

  // Find RSVP
  const rsvp = await RSVP.findOne({ eventId, userId }).populate('userId', 'name profilePicture');

  if (!rsvp) {
    return res.notFound('No RSVP found for this event');
  }

    res.success({ rsvp }, 'RSVP retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Delete RSVP (cancel attendance)
 * @route DELETE /events/:eventId/rsvp
 */
export const deleteRSVP = async (req: Request, res: Response, next: NextFunction) => {
  try {
  const { eventId } = req.params;
  const userId = req.user?._id;

  if (!userId) {
    return res.unauthorized('User not authenticated');
  }

  // Validate event ID
  if (!Types.ObjectId.isValid(eventId)) {
    return res.validationError('Invalid event ID', { field: 'eventId' });
  }

  // Delete RSVP
  const result = await RSVP.deleteOne({ eventId, userId });

  if (result.deletedCount === 0) {
    return res.notFound('No RSVP found for this event');
  }

    res.success(null, 'RSVP cancelled successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * List all RSVPs for an event
 * @route GET /events/:eventId/rsvps
 */
export const getEventRSVPs = async (req: Request, res: Response, next: NextFunction) => {
  try {
  const { eventId } = req.params;
  const { status, page = 1, limit = 10 } = req.query;
  const userId = req.user?._id;

  if (!userId) {
    return res.unauthorized('User not authenticated');
  }

  // Validate event ID
  if (!Types.ObjectId.isValid(eventId)) {
    return res.validationError('Invalid event ID', { field: 'eventId' });
  }

  // Check if event exists
  const event = await Event.findById(eventId);
  if (!event) {
    return res.notFound('Event not found');
  }

  // Build query
  const query: any = { eventId };
  if (status) {
    query.status = status;
  }

  // Calculate pagination
  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);
  const skip = (pageNum - 1) * limitNum;

  // Execute query with pagination
  const rsvps = await RSVP.find(query)
    .populate('userId', 'name email profilePicture')
    .skip(skip)
    .limit(limitNum);

  // Get total count for pagination
  const total = await RSVP.countDocuments(query);

  // Calculate pagination metadata
  const totalPages = Math.ceil(total / limitNum);
  const hasNextPage = pageNum < totalPages;
  const hasPrevPage = pageNum > 1;

  const paginationMetadata = {
    total,
    page: pageNum,
    limit: limitNum,
    totalPages,
    hasNextPage,
    hasPrevPage
  };

    res.paginated(rsvps, paginationMetadata, 'RSVPs retrieved successfully');
  } catch (error) {
    next(error);
  }
};
