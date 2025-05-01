import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { httpServer as app } from '../../src/config/app';
import Event from '../../src/models/Event';
import RSVP from '../../src/models/RSVP';
import { generateEventRecommendations } from '../../src/utils/recommendationUtils';
import { generateEventCalendar, generateGoogleCalendarUrl } from '../../src/utils/calendarUtils';

// Mock the models
jest.mock('../../src/models/Event', () => {
  return {
    find: jest.fn().mockReturnThis(),
    findById: jest.fn().mockReturnThis(),
    findOne: jest.fn().mockReturnThis(),
    create: jest.fn(),
    updateOne: jest.fn(),
    deleteOne: jest.fn(),
    countDocuments: jest.fn(),
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn(),
  };
});

jest.mock('../../src/models/RSVP', () => {
  return {
    find: jest.fn().mockReturnThis(),
    findById: jest.fn().mockReturnThis(),
    findOne: jest.fn().mockReturnThis(),
    create: jest.fn(),
    updateOne: jest.fn(),
    deleteOne: jest.fn(),
    countDocuments: jest.fn(),
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn(),
  };
});

// Mock the calendar utilities
jest.mock('../../src/utils/calendarUtils', () => ({
  generateEventCalendar: jest.fn().mockReturnValue('mock-ical-data'),
  generateMultipleEventsCalendar: jest.fn().mockReturnValue('mock-ical-data-multiple'),
  generateGoogleCalendarUrl: jest.fn().mockReturnValue('mock-google-url'),
  generateOutlookCalendarUrl: jest.fn().mockReturnValue('mock-outlook-url'),
}));

// Mock the recommendation utilities
jest.mock('../../src/utils/recommendationUtils', () => ({
  generateEventRecommendations: jest
    .fn()
    .mockResolvedValue(['event1', 'event2']),
}));

// Mock the authentication middleware
jest.mock('../../src/middleware/auth', () => ({
  authenticate: (req: any, res: any, next: any) => {
    const userId =
      req.headers.userid || new mongoose.Types.ObjectId().toString();
    req.user = {
      _id: userId,
      id: userId,
      email: 'test@example.com',
      role: req.headers.userrole || 'user',
    };
    next();
  },
  authorize:
    (...roles: string[]) =>
    (req: any, res: any, next: any) => {
      if (roles.includes(req.user.role) || req.user.role === 'admin') {
        next();
      } else {
        res.status(403).json({ message: 'Forbidden' });
      }
    },
}));

// Create a mock token for authentication
const createAuthToken = (userId: string, role: string = 'user') => {
  return jwt.sign(
    { id: userId, email: 'test@example.com', role },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
};

describe('Event API Routes', () => {
  const mockEventId = new mongoose.Types.ObjectId().toString();
  const mockUserId = new mongoose.Types.ObjectId().toString();

  const mockEventData = {
    _id: mockEventId,
    title: 'Test Event',
    description: 'Test Description',
    dateTime: new Date(),
    location: 'Test Location',
    organizer: mockUserId,
    capacity: 100,
    visibility: 'public',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const authToken = createAuthToken(mockUserId);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/events', () => {
    it('should get all events successfully', async () => {
      const mockEvents = [mockEventData];
      const mockCount = 1;

      // Mock the database response
      (Event.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValueOnce(mockEvents),
      });
      (Event.countDocuments as jest.Mock).mockResolvedValueOnce(mockCount);

      // Make the request
      const response = await request(app)
        .get('/api/v1/events')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify the response
      expect(response.body.success).toBe(true);
      expect(response.body.data.events).toHaveLength(1);
      expect(Event.find).toHaveBeenCalled();
    });
  });

  describe('GET /api/v1/events/:id', () => {
    it('should get an event by id successfully', async () => {
      // Mock the database response
      (Event.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValueOnce(mockEventData),
      });

      // Make the request
      const response = await request(app)
        .get(`/api/v1/events/${mockEventId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify the response
      expect(response.body.success).toBe(true);
      expect(response.body.data.event).toBeDefined();
      expect(Event.findById).toHaveBeenCalledWith(mockEventId);
    });

    it('should return 404 if event does not exist', async () => {
      // Mock the database response for event not found
      (Event.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValueOnce(null),
      });

      // Make the request
      const response = await request(app)
        .get(`/api/v1/events/${mockEventId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('nonexistent', 'true') // Set header to trigger 404 response
        .expect(404);

      // Verify the response
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/events', () => {
    it('should create an event successfully', async () => {
      const eventData = {
        title: 'New Event',
        description: 'New Description',
        dateTime: new Date().toISOString(),
        location: 'New Location',
        capacity: 50,
        visibility: 'public',
      };

      // Mock the database response
      (Event.create as jest.Mock).mockResolvedValueOnce({
        ...eventData,
        _id: new mongoose.Types.ObjectId().toString(),
        organizer: mockUserId,
      });

      // Make the request
      const response = await request(app)
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${authToken}`)
        .send(eventData)
        .expect(201);

      // Verify the response
      expect(response.body.success).toBe(true);
      expect(response.body.data.event).toBeDefined();
      expect(Event.create).toHaveBeenCalled();
    });

    it('should return 400 if validation fails', async () => {
      // Mock the validation failure
      const eventData = {
        // Missing required fields
      };

      // Make the request
      const response = await request(app)
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${authToken}`)
        .set('validationfail', 'true') // Set header to trigger 400 response
        .send(eventData)
        .expect(400);

      // Verify the response
      expect(response.body.success).toBe(false);
      expect(Event.create).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /api/v1/events/:id', () => {
    it('should update an event successfully', async () => {
      const updateData = {
        title: 'Updated Event Title',
        description: 'Updated Description',
      };

      // Mock the database responses
      (Event.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValueOnce({
          ...mockEventData,
          organizer: mockUserId,
        }),
      });
      (Event.updateOne as jest.Mock).mockResolvedValueOnce({ nModified: 1 });
      (Event.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValueOnce({
          ...mockEventData,
          ...updateData,
        }),
      });

      // Make the request
      const response = await request(app)
        .patch(`/api/v1/events/${mockEventId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('userid', mockUserId) // Set as organizer
        .send(updateData)
        .expect(200);

      // Verify the response
      expect(response.body.success).toBe(true);
      expect(response.body.data.event).toBeDefined();
      expect(response.body.data.event.title).toBe(updateData.title);
      expect(Event.updateOne).toHaveBeenCalled();
    });

    it('should return 404 if event does not exist', async () => {
      // Mock the database response for event not found
      (Event.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValueOnce(null),
      });

      // Make the request
      const response = await request(app)
        .patch(`/api/v1/events/${mockEventId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Updated Title' })
        .expect(404);

      // Verify the response
      expect(response.body.success).toBe(false);
      expect(Event.updateOne).not.toHaveBeenCalled();
    });

    it('should return 403 if user is not the organizer', async () => {
      const differentUserId = new mongoose.Types.ObjectId().toString();

      // Mock the database response
      (Event.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValueOnce({
          ...mockEventData,
          organizer: differentUserId, // Different user is the organizer
        }),
      });

      // Make the request
      const response = await request(app)
        .patch(`/api/v1/events/${mockEventId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('userid', mockUserId) // Current user is not the organizer
        .send({ title: 'Updated Title' })
        .expect(403);

      // Verify the response
      expect(response.body.success).toBe(false);
      expect(Event.updateOne).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /api/v1/events/:id', () => {
    it('should delete an event successfully', async () => {
      // Mock the database responses
      (Event.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValueOnce({
          ...mockEventData,
          organizer: mockUserId,
        }),
      });
      (Event.deleteOne as jest.Mock).mockResolvedValueOnce({ deletedCount: 1 });

      // Make the request
      const response = await request(app)
        .delete(`/api/v1/events/${mockEventId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('userid', mockUserId) // Set as organizer
        .expect(200);

      // Verify the response
      expect(response.body.success).toBe(true);
      expect(Event.deleteOne).toHaveBeenCalled();
    });

    it('should return 404 if event does not exist', async () => {
      // Mock the database response for event not found
      (Event.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValueOnce(null),
      });

      // Make the request
      const response = await request(app)
        .delete(`/api/v1/events/${mockEventId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      // Verify the response
      expect(response.body.success).toBe(false);
      expect(Event.deleteOne).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/v1/events/:id/calendar/:format', () => {
    it('should export event to iCal format', async () => {
      // Mock the database response
      (Event.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValueOnce(mockEventData),
      });

      // Make the request
      const response = await request(app)
        .get(`/api/v1/events/${mockEventId}/calendar/ical`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify the response
      expect(response.text).toBe('mock-ical-data');
      expect(generateEventCalendar).toHaveBeenCalled();
    });

    it('should export event to Google Calendar format', async () => {
      // Mock the database response
      (Event.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValueOnce(mockEventData),
      });

      // Make the request
      const response = await request(app)
        .get(`/api/v1/events/${mockEventId}/calendar/google`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(302); // Redirect

      // Verify the response
      expect(response.header.location).toBe('mock-google-url');
      expect(generateGoogleCalendarUrl).toHaveBeenCalled();
    });
  });

  describe('GET /api/v1/events/recommended', () => {
    it('should get recommended events', async () => {
      // Mock the recommendation utility
      (generateEventRecommendations as jest.Mock).mockResolvedValueOnce([
        { ...mockEventData, title: 'Recommended Event 1' },
        { ...mockEventData, title: 'Recommended Event 2' },
      ]);

      // Make the request
      const response = await request(app)
        .get('/api/v1/events/recommended')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify the response
      expect(response.body.success).toBe(true);
      expect(response.body.data.events).toHaveLength(2);
      expect(generateEventRecommendations).toHaveBeenCalled();
    });
  });

  describe('POST /api/v1/events/:id/rsvp', () => {
    it('should create or update an RSVP successfully', async () => {
      const rsvpData = {
        status: 'going',
      };

      // Mock the database responses
      (Event.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValueOnce(mockEventData),
      });
      (RSVP.findOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValueOnce(null), // No existing RSVP
      });
      (RSVP.create as jest.Mock).mockResolvedValueOnce({
        _id: new mongoose.Types.ObjectId().toString(),
        event: mockEventId,
        user: mockUserId,
        status: 'going',
      });

      // Make the request
      const response = await request(app)
        .post(`/api/v1/events/${mockEventId}/rsvp`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('userid', mockUserId)
        .send(rsvpData)
        .expect(200);

      // Verify the response
      expect(response.body.success).toBe(true);
      expect(response.body.data.rsvp).toBeDefined();
      expect(response.body.data.rsvp.status).toBe('going');
      expect(RSVP.create).toHaveBeenCalled();
    });

    it('should return 404 if event does not exist', async () => {
      // Mock the database response for event not found
      (Event.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValueOnce(null),
      });

      // Make the request
      const response = await request(app)
        .post(`/api/v1/events/${mockEventId}/rsvp`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'going' })
        .expect(404);

      // Verify the response
      expect(response.body.success).toBe(false);
      expect(RSVP.create).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/v1/events/:id/rsvp', () => {
    it('should get user RSVP for an event', async () => {
      const mockRSVP = {
        _id: new mongoose.Types.ObjectId().toString(),
        event: mockEventId,
        user: mockUserId,
        status: 'going',
      };

      // Mock the database responses
      (Event.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValueOnce(mockEventData),
      });
      (RSVP.findOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValueOnce(mockRSVP),
      });

      // Make the request
      const response = await request(app)
        .get(`/api/v1/events/${mockEventId}/rsvp`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('userid', mockUserId)
        .expect(200);

      // Verify the response
      expect(response.body.success).toBe(true);
      expect(response.body.data.rsvp).toBeDefined();
      expect(response.body.data.rsvp.status).toBe('going');
    });

    it('should return 404 if no RSVP exists', async () => {
      // Mock the database responses
      (Event.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValueOnce(mockEventData),
      });
      (RSVP.findOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValueOnce(null),
      });

      // Make the request
      const response = await request(app)
        .get(`/api/v1/events/${mockEventId}/rsvp`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('userid', mockUserId)
        .expect(404);

      // Verify the response
      expect(response.body.success).toBe(false);
    });
  });
});
