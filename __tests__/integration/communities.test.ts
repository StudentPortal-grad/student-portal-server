import request from 'supertest';
import app from '../../src/config/app';

describe('Community API Tests', () => {
  // Test data
  const testCommunity = {
    owner: '507f1f77bcf86cd799439011',
    name: 'Test Community',
    description: 'A test community',
    type: 'Community',
  };

  // Test: Create a new community
  it('should create a new community', async () => {
    const res = await request(app)
      .post('/api/communities/create')
      .send(testCommunity);

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe(testCommunity.name);
  });

  // Test: Join a community
  it('should join a community', async () => {
    // First, create a community
    const communityRes = await request(app)
      .post('/api/communities/create')
      .send(testCommunity);

    const communityId = communityRes.body.data._id;

    // Join the community
    const joinRes = await request(app)
      .post(`/api/communities/${communityId}/join`)
      .send({ userId: '507f1f77bcf86cd799439012' });

    expect(joinRes.status).toBe(200);
    expect(joinRes.body.data.members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: '507f1f77bcf86cd799439012',
          roleIds: [],
        }),
      ])
    );
  });

  // Test: Get all communities
  it('should get all communities', async () => {
    const res = await request(app).get('/api/communities');

    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
  });
});
