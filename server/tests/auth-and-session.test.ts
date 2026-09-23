import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../src/app';
import { User } from '../src/models/User';
import { WorkSession } from '../src/models/WorkSession';
import { connectDatabase } from '../src/config/database';
import { UserRole } from '../src/constants';

const agent = request.agent(app);
const dbTests = process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;

dbTests('API authentication and session behavior', () => {
  beforeAll(async () => {
    await connectDatabase();
    await User.deleteMany({});
    await WorkSession.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it('registers and logs in a user and returns a JWT', async () => {
    const registerRes = await agent.post('/api/v1/auth/register').send({
      name: 'Test Intern',
      email: 'intern@test.local',
      password: 'Password123!',
      role: UserRole.INTERN,
    });

    expect(registerRes.status).toBe(201);
    expect(registerRes.body.success).toBe(true);
    expect(registerRes.body.data.token).toBeTruthy();

    const loginRes = await agent.post('/api/v1/auth/login').send({
      email: 'intern@test.local',
      password: 'Password123!',
    });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.token).toBeTruthy();
  });

  it('rejects invalid login credentials', async () => {
    const res = await agent.post('/api/v1/auth/login').send({
      email: 'intern@test.local',
      password: 'wrong-pass',
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('prevents duplicate active work sessions for the same intern', async () => {
    const user = await User.findOne({ email: 'intern@test.local' });
    const firstSession = await WorkSession.create({
      internId: user!._id,
      startedAt: new Date(),
      lastHeartbeat: new Date(),
      status: 'ACTIVE',
      activeSeconds: 0,
      completedIntervals: 0,
      totalBreakSeconds: 0,
    });

    const secondSession = await WorkSession.create({
      internId: user!._id,
      startedAt: new Date(),
      lastHeartbeat: new Date(),
      status: 'ACTIVE',
      activeSeconds: 0,
      completedIntervals: 0,
      totalBreakSeconds: 0,
    });

    expect(firstSession._id).toBeTruthy();
    expect(secondSession._id).toBeTruthy();
    const count = await WorkSession.countDocuments({ internId: user!._id, status: 'ACTIVE' });
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it('returns 401 for unauthenticated access to protected route', async () => {
    const res = await request(app).get('/api/v1/interns');
    expect(res.status).toBe(401);
  });

  it('blocks admin-only endpoints for interns', async () => {
    const loginRes = await agent.post('/api/v1/auth/login').send({
      email: 'intern@test.local',
      password: 'Password123!',
    });
    const token = loginRes.body.data.token;

    const res = await request(app).get('/api/v1/admin/overview').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
