import { Router } from 'express';
import { authenticate, authorize } from '@middleware/auth';
import { validate } from '@middleware/validate';
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
  updateEventImage,
  createEvent,
  updateEvent,
  bulkDeleteEvents,
  deleteEvent,
  createOrUpdateRSVP,
  getUserRSVP,
  deleteRSVP,
  getEventRSVPs
} from '@controllers/event.controller';
import { eventValidation } from '../../../validations/eventValidation';
import {
  validateEventCreation,
  validateEventUpdate,
} from '../../../validators/event.validator';
import { uploadEventImage } from '../../../utils/uploadService';
import asyncHandler from '@utils/asyncHandler';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// GET routes
router.get(
  '/',
  validate(eventValidation.getEvents),
  getAllEvents
);

router.get('/recommendations', getRecommendedEvents);
router.get('/:id', getEventById);
router.get('/:id/attendees', getEventAttendees);
router.get('/:id/export-calendar', exportEventToCalendar);
router.get('/:id/calendar-urls', getCalendarIntegrationUrls);
router.get('/:eventId/rsvp', getUserRSVP);
router.get('/:eventId/rsvps', getEventRSVPs);

// Admin/Dashboard routes
router.get(
  '/metrics/dashboard',
  authorize('admin', 'superadmin'),
  getEventMetrics
);

router.get(
  '/metrics/chart',
  authorize('admin', 'superadmin'),
  getEventsForChart
);

// POST routes
router.post(
  '/',
  uploadEventImage,
  validateEventCreation,
  createEvent
);

router.post('/export-multiple', exportMultipleEventsToCalendar);
router.post('/:eventId/rsvp', createOrUpdateRSVP);

// PATCH routes
router.patch(
  '/:id',
  validateEventUpdate,
  updateEvent
);

router.patch(
  '/:id/image', 
  uploadEventImage, 
  validate(eventValidation.updateEventImage),
  updateEventImage
);

router.patch(
  '/:id/update-image',
  uploadEventImage,
  updateEventImage
);

router.patch(
  '/:id/recommendations',
  authorize('updateEvent'),
  updateEventRecommendations
);

// DELETE routes
router.delete('/bulk', validate(eventValidation.bulkDeleteEvents), asyncHandler(bulkDeleteEvents));
router.delete('/:id', deleteEvent);
router.delete('/:eventId/rsvp', deleteRSVP);

export default router;
