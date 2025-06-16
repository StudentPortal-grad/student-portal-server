import request from 'supertest';
import app from '../../src/config/app';
import User from '../../src/models/User';
import Event from '../../src/models/Event';
import Resource from '../../src/models/Resource';
import Community from '../../src/models/Community';
import * as authMiddleware from '../../src/middleware/auth';

// Mock the models
jest.mock('../../src/models/User');
jest.mock('../../src/models/Event');
jest.mock('../../src/models/Resource');
jest.mock('../../src/models/Community');

// Mock the authentication middleware
jest.mock('../../src/middleware/auth', () => ({
    ...jest.requireActual('../../src/middleware/auth'),
    authenticate: jest.fn((req, res, next) => {
        req.user = { _id: 'mockUserId', name: 'Test User', email: 'test@test.com' };
        next();
    }),
}));

describe('DashboardController', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/dashboard/stats', () => {
        it('should return dashboard statistics', async () => {
            // Mock the countDocuments method for each model
            (User.countDocuments as jest.Mock)
                .mockResolvedValueOnce(150) // totalStudents
                .mockResolvedValueOnce(25)  // totalFaculty
                .mockResolvedValueOnce(5);  // totalAdmins
            (Event.countDocuments as jest.Mock).mockResolvedValueOnce(10); // activeEvents
            (Resource.countDocuments as jest.Mock).mockResolvedValueOnce(200); // totalResources
            (Community.countDocuments as jest.Mock)
                .mockResolvedValueOnce(50) // totalCommunities
                .mockResolvedValueOnce(10) // officialCommunities
                .mockResolvedValueOnce(40); // userCommunities

            const response = await request(app).get('/api/dashboard/stats');

            expect(response.status).toBe(200);
            expect(authMiddleware.authenticate).toHaveBeenCalled();
            expect(response.body.data).toEqual({
                totalUsers: 180, // 150 + 25 + 5
                totalStudents: 150,
                totalFaculty: 25,
                totalAdmins: 5,
                activeEvents: 10,
                totalResources: 200,
                totalCommunities: 50,
                officialCommunities: 10,
                userCommunities: 40,
            });
        });

        it('should handle errors gracefully', async () => {
            (User.countDocuments as jest.Mock).mockRejectedValue(new Error('Database error'));

            const response = await request(app).get('/api/dashboard/stats');

            expect(response.status).toBe(500);
            expect(response.body.message).toBe('An internal server error occurred');
        });
    });

    describe('GET /api/dashboard/user-history', () => {
        it('should return user count history for a given period', async () => {
            const mockHistory = [
                { date: '2024-01-01', totalCount: 5, roles: [{ role: 'student', count: 5 }] },
                { date: '2024-01-02', totalCount: 3, roles: [{ role: 'student', count: 3 }] },
            ];
            (User.aggregate as jest.Mock).mockResolvedValue(mockHistory);

            const response = await request(app).get('/api/dashboard/user-history?period=month');

            expect(response.status).toBe(200);
            expect(response.body.data.userHistory).toEqual(mockHistory);
            expect(User.aggregate).toHaveBeenCalled();
        });

        it('should return a 400 error for an invalid period', async () => {
            const response = await request(app).get('/api/dashboard/user-history?period=invalid');

            expect(response.status).toBe(400);
            expect(response.body.message).toBe('Invalid period specified');
        });
    });

    describe('GET /api/dashboard/notifications', () => {
        const mockQuery = (data: any) => ({
            sort: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            populate: jest.fn().mockResolvedValue(data),
        });

        it('should return a sorted and limited list of recent notifications', async () => {
            const mockUsers = [{ _id: 'user1', name: 'New User', createdAt: new Date('2024-01-04T10:00:00Z') }];
            const mockEvents = [{ _id: 'event1', title: 'New Event', createdAt: new Date('2024-01-03T10:00:00Z') }];
            const mockResources = [{ _id: 'resource1', title: 'New Resource', createdAt: new Date('2024-01-02T10:00:00Z') }];
            const mockCommunities = [{ _id: 'community1', name: 'New Community', createdAt: new Date('2024-01-01T10:00:00Z') }];

            (User.find as jest.Mock).mockReturnValue(mockQuery(mockUsers));
            (Event.find as jest.Mock).mockReturnValue(mockQuery(mockEvents));
            (Resource.find as jest.Mock).mockReturnValue(mockQuery(mockResources));
            (Community.find as jest.Mock).mockReturnValue(mockQuery(mockCommunities));

            const response = await request(app).get('/api/dashboard/notifications');

            expect(response.status).toBe(200);
            expect(response.body.data.notifications).toHaveLength(4);
            // Check if the notifications are sorted correctly (newest first)
            expect(response.body.data.notifications[0].data.name).toBe('New User');
        });

        it('should respect the limit query parameter', async () => {
            (User.find as jest.Mock).mockReturnValue(mockQuery([{ _id: 'user1', createdAt: new Date() }]));
            (Event.find as jest.Mock).mockReturnValue(mockQuery([{ _id: 'event1', createdAt: new Date() }]));
            (Resource.find as jest.Mock).mockReturnValue(mockQuery([{ _id: 'resource1', createdAt: new Date() }]));
            (Community.find as jest.Mock).mockReturnValue(mockQuery([{ _id: 'community1', createdAt: new Date() }]));

            const response = await request(app).get('/api/dashboard/notifications?limit=2');

            expect(response.status).toBe(200);
            expect(response.body.data.notifications).toHaveLength(2);
        });
    });
});
