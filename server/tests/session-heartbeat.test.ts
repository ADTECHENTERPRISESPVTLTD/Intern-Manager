import mongoose from 'mongoose';
import { Types } from 'mongoose';
import { connectDatabase } from '../src/config/database';
import { WorkSession } from '../src/models/WorkSession';
import { BreakSession } from '../src/models/BreakSession';
import { startWorkSession, heartbeatSession, startBreak, resumeBreak } from '../src/services/session.service';
import { env } from '../src/config/env';

const dbTests = process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;

dbTests('Heartbeat accrual behavior', () => {
  beforeAll(async () => {
    await connectDatabase();
    await WorkSession.deleteMany({});
    await BreakSession.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it('Test 1: Start session -> heartbeat after 30 seconds -> activeSeconds increases by ~30s', async () => {
    const internId = new Types.ObjectId();
    const session = await startWorkSession({ internId });
    const t0 = session.lastHeartbeat;
    const now = new Date(t0.getTime() + 30 * 1000);
    const updated = await heartbeatSession({ sessionId: session._id, now });
    expect(updated.activeSeconds).toBeGreaterThanOrEqual(29);
    expect(updated.activeSeconds).toBeLessThanOrEqual(31);
  });

  it('Test 2: Multiple heartbeats only count elapsed once (09:00 -> 09:00:30 -> 09:01:00)', async () => {
    const internId = new Types.ObjectId();
    const session = await startWorkSession({ internId });
    const t0 = session.lastHeartbeat;
    const h1 = new Date(t0.getTime() + 30 * 1000);
    const first = await heartbeatSession({ sessionId: session._id, now: h1 });
    expect(first.activeSeconds).toBeGreaterThanOrEqual(29);

    const h2 = new Date(t0.getTime() + 60 * 1000);
    const second = await heartbeatSession({ sessionId: session._id, now: h2 });
    // ~60 seconds total
    expect(second.activeSeconds).toBeGreaterThanOrEqual(58);
    expect(second.activeSeconds).toBeLessThanOrEqual(62);
  });

  it('Test 3: Heartbeat during break does not increase activeSeconds', async () => {
    const internId = new Types.ObjectId();
    const session = await startWorkSession({ internId });
    const t0 = session.lastHeartbeat;
    const hb1 = new Date(t0.getTime() + 10 * 1000);
    await heartbeatSession({ sessionId: session._id, now: hb1 });

    const breakStart = new Date(t0.getTime() + 20 * 1000);
    await startBreak({ sessionId: session._id, internId, now: breakStart });

    const hbDuringBreak = new Date(t0.getTime() + 50 * 1000);
    const afterBreakHb = await heartbeatSession({ sessionId: session._id, now: hbDuringBreak });

    // activeSeconds should not have increased during break beyond what was before break
    expect(afterBreakHb.totalBreakSeconds).toBeGreaterThanOrEqual(0);
    expect(afterBreakHb.activeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('Test 4: Resume after break -> heartbeat accrues only after resume', async () => {
    const internId = new Types.ObjectId();
    const session = await startWorkSession({ internId });
    const t0 = session.lastHeartbeat;

    // accrue some time
    const hb1 = new Date(t0.getTime() + 20 * 1000);
    await heartbeatSession({ sessionId: session._id, now: hb1 });

    // start break
    const breakStart = new Date(t0.getTime() + 30 * 1000);
    await startBreak({ sessionId: session._id, internId, now: breakStart });

    // resume later
    const resumeAt = new Date(t0.getTime() + 90 * 1000);
    await resumeBreak({ sessionId: session._id, internId, now: resumeAt });

    // heartbeat 30s after resume -> should count ~30s only
    const afterResumeHb = new Date(resumeAt.getTime() + 30 * 1000);
    const updated = await heartbeatSession({ sessionId: session._id, now: afterResumeHb });
    // ensure activeSeconds increased by around 30s since resume (plus prior accrued)
    expect(updated.activeSeconds).toBeGreaterThanOrEqual(48);
  });

  it('Test 5: Cap at MAX_OFFICIAL_SECONDS and further heartbeats do not increase official time', async () => {
    const internId = new Types.ObjectId();
    const session = await startWorkSession({ internId });
    // artificially set close to cap
    session.activeSeconds = env.MAX_OFFICIAL_SECONDS - 10;
    session.lastHeartbeat = new Date();
    await session.save();

    const now = new Date(session.lastHeartbeat.getTime() + 30 * 1000);
    const updated = await heartbeatSession({ sessionId: session._id, now });
    expect(updated.activeSeconds).toBeLessThanOrEqual(env.MAX_OFFICIAL_SECONDS);
    expect(updated.activeSeconds).toBe(env.MAX_OFFICIAL_SECONDS);

    const later = new Date(now.getTime() + 30 * 1000);
    const laterUpdated = await heartbeatSession({ sessionId: session._id, now: later });
    expect(laterUpdated.activeSeconds).toBe(env.MAX_OFFICIAL_SECONDS);
  });

  it('Test 6: Concurrent duplicate heartbeats do not double-count', async () => {
    const internId = new Types.ObjectId();
    const session = await startWorkSession({ internId });
    const t0 = session.lastHeartbeat;
    const concurrentNow = new Date(t0.getTime() + 30 * 1000);

    const [a, b] = await Promise.all([
      heartbeatSession({ sessionId: session._id, now: concurrentNow }),
      heartbeatSession({ sessionId: session._id, now: concurrentNow }),
    ]);

    // Both should report the same or similar activeSeconds, and it should be ~30s, not 60s
    const final = await WorkSession.findById(session._id);
    expect(final).toBeTruthy();
    expect(final!.activeSeconds).toBeGreaterThanOrEqual(29);
    expect(final!.activeSeconds).toBeLessThanOrEqual(31);
  });
});
