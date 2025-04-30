import express from 'express';
import { authenticate, authorize } from '@middleware/auth';
import { validate } from '@middleware/validate';
import asyncHandler from '@utils/asyncHandler';
import {
  getAllEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  getEventAttendees,
  getEventMetrics,
  getEventsForChart,
  exportEventToCalendar,
  exportMultipleEventsToCalendar,
  getCalendarIntegrationUrls,
  getRecommendedEvents,
  updateEventRecommendations
} from '@controllers/event.controller';
import {
  createOrUpdateRSVP,
  getUserRSVP,
  deleteRSVP,
  getEventRSVPs
} from '@controllers/rsvp.controller';
import { eventValidation } from '../../../validations/eventValidation';
import { rsvpValidation } from '../../../validations/rsvpValidation';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// Public routes (still need authentication)
router.get('/', validate(eventValidation.getEvents), asyncHandler(getAllEvents));
router.get('/:id', asyncHandler(getEventById));
router.get('/:id/attendees', asyncHandler(getEventAttendees));

// Admin/Dashboard routes
router.get('/metrics/dashboard', authorize('admin', 'superadmin'), asyncHandler(getEventMetrics));
router.get('/metrics/chart', authorize('admin', 'superadmin'), asyncHandler(getEventsForChart));

// Protected routes (need specific permissions)
router.post(
  '/',
  authorize('createEvent'),
  validate(eventValidation.createEvent),
  asyncHandler(createEvent)
);

router.patch(
  '/:id',
  authorize('updateEvent'),
  validate(eventValidation.updateEvent),
  asyncHandler(updateEvent)
);

router.delete(
  '/:id',
  authorize('deleteEvent'),
  asyncHandler(deleteEvent)
);

// RSVP routes
router.post(
  '/:eventId/rsvp',
  validate(rsvpValidation.createOrUpdateRSVP),
  createOrUpdateRSVP
);

router.get(
  '/:eventId/rsvp',
  getUserRSVP
);

router.delete(
  '/:eventId/rsvp',
  deleteRSVP
);

router.get(
  '/:eventId/rsvps',
  validate(rsvpValidation.getRSVPs),
  getEventRSVPs
);

// Calendar integration routes
router.get('/:id/export-calendar', asyncHandler(exportEventToCalendar));
router.post('/export-multiple', asyncHandler(exportMultipleEventsToCalendar));
router.get('/:id/calendar-urls', asyncHandler(getCalendarIntegrationUrls));

// Recommendation routes
router.get('/recommendations', asyncHandler(getRecommendedEvents));
router.patch('/:id/recommendations', authorize('updateEvent'), asyncHandler(updateEventRecommendations));

export default router;
