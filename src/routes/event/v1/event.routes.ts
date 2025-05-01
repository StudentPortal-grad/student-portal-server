import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '@middleware/auth';
import { validate } from '@middleware/validate';
import asyncHandler from '@utils/asyncHandler';
import {
  getAllEvents,
  getEventById,
  getEventAttendees,
  getEventMetrics,
  getEventsForChart,
  exportEventToCalendar,
  exportMultipleEventsToCalendar,
  getCalendarIntegrationUrls,
  getRecommendedEvents,
  updateEventRecommendations,
} from '@controllers/event.controller';
import { eventValidation } from '../../../validations/eventValidation';
import {
  validateEventCreation,
  validateEventUpdate,
} from '../../../validators/event.validator';
import { EventController } from '../../../controllers/event.controller';

const router = Router();
const eventController = new EventController();

// Apply authentication middleware to all routes
router.use(authenticate);

// Public routes (still need authentication)
router.get(
  '/',
  validate(eventValidation.getEvents),
  asyncHandler(getAllEvents)
);
router.get('/:id', asyncHandler(getEventById));
router.get('/:id/attendees', asyncHandler(getEventAttendees));

// Admin/Dashboard routes
router.get(
  '/metrics/dashboard',
  authorize('admin', 'superadmin'),
  asyncHandler(getEventMetrics)
);
router.get(
  '/metrics/chart',
  authorize('admin', 'superadmin'),
  asyncHandler(getEventsForChart)
);

// Protected routes (need specific permissions)
router.post(
  '/',
  validateEventCreation,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const response = await eventController.createEvent(req, res);
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }
);

router.patch(
  '/:id',
  validateEventUpdate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const response = await eventController.updateEvent(req, res);
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  '/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const response = await eventController.deleteEvent(req, res);
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

// RSVP routes
router.post(
  '/:eventId/rsvp',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const response = await eventController.createOrUpdateRSVP(req, res);
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/:eventId/rsvp',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const response = await eventController.getUserRSVP(req, res);
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  '/:eventId/rsvp',

  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const response = await eventController.deleteRSVP(req, res);
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/:eventId/rsvps',

  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const response = await eventController.getEventRSVPs(req, res);
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

// Calendar integration routes
router.get('/:id/export-calendar', asyncHandler(exportEventToCalendar));
router.post('/export-multiple', asyncHandler(exportMultipleEventsToCalendar));
router.get('/:id/calendar-urls', asyncHandler(getCalendarIntegrationUrls));

// Recommendation routes
router.get('/recommendations', asyncHandler(getRecommendedEvents));
router.patch(
  '/:id/recommendations',
  authorize('updateEvent'),
  asyncHandler(updateEventRecommendations)
);

export default router;
