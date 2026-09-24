import { Types } from 'mongoose';
import { BreakSession } from '../models/BreakSession';
import { WorkSession } from '../models/WorkSession';
import { Attendance } from '../models/Attendance';
import { env } from '../config/env';
import { SessionStatus } from '../constants';
import { calculateOfficialSessionState } from './core';

export const startWorkSession = async ({ internId }: { internId: string | Types.ObjectId }) => {
  const existing = await WorkSession.findOne({ internId, status: { $in: ['ACTIVE', 'BREAK', 'UNVERIFIED'] } }).sort({ startedAt: -1 });
  if (existing) {
    return existing;
  }

  const session = await WorkSession.create({
    internId,
    startedAt: new Date(),
    lastHeartbeat: new Date(),
    status: 'ACTIVE',
    activeSeconds: 0,
    completedIntervals: 0,
    totalBreakSeconds: 0,
    isOfficial: false,
  });

  return session;
};

export const heartbeatSession = async ({ sessionId, now = new Date() }: { sessionId: string | Types.ObjectId; now?: Date }) => {
  // We perform an atomic update pattern to avoid double-counting when
  // concurrent/duplicate heartbeats arrive. Attempt a few retries if a
  // concurrent update races us.
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    const session = await WorkSession.findById(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Calculate how many whole seconds have elapsed since the last authoritative server heartbeat
    const secondsSinceLast = Math.max(0, Math.floor((now.getTime() - session.lastHeartbeat.getTime()) / 1000));

    // Only accrue time when session is ACTIVE and while under the official max
    let secondsToAdd = 0;
    if (session.status === SessionStatus.ACTIVE && session.activeSeconds < env.MAX_OFFICIAL_SECONDS) {
      const remaining = Math.max(0, env.MAX_OFFICIAL_SECONDS - session.activeSeconds);
      secondsToAdd = Math.min(secondsSinceLast, remaining);
    }

    const update: any = { $set: { lastHeartbeat: now } };
    if (secondsToAdd > 0) {
      update.$inc = { activeSeconds: secondsToAdd };
    }

    // Try to apply update only if lastHeartbeat hasn't changed in the meantime
    const updated = await WorkSession.findOneAndUpdate({ _id: sessionId, lastHeartbeat: session.lastHeartbeat }, update, { new: true });

    if (updated) {
      // Recompute derived state based on the newly-updated activeSeconds
      const state = calculateOfficialSessionState({
        startedAt: updated.startedAt,
        lastHeartbeat: updated.lastHeartbeat,
        activeSeconds: updated.activeSeconds,
        completedIntervals: updated.completedIntervals,
        status: updated.status,
        totalBreakSeconds: updated.totalBreakSeconds,
        now,
        maxOfficialSeconds: env.MAX_OFFICIAL_SECONDS,
        intervalSeconds: env.SESSION_INTERVAL_SECONDS,
      });

      // Apply canonical values and persist
      updated.activeSeconds = Math.min(state.officialActiveSeconds, env.MAX_OFFICIAL_SECONDS);
      updated.completedIntervals = state.completedIntervals;
      updated.status = state.status as SessionStatus;

      if (state.status === 'COMPLETED') {
        updated.endedAt = now;
        updated.status = SessionStatus.COMPLETED;
      }

      await updated.save();
      return updated;
    }

    // A concurrent update changed lastHeartbeat; retry to compute remaining time correctly
    attempts += 1;
  }

  // If retries exhausted, return latest session state (best-effort)
  const finalSession = await WorkSession.findById(sessionId);
  if (!finalSession) throw new Error('Session not found');

  const finalState = calculateOfficialSessionState({
    startedAt: finalSession.startedAt,
    lastHeartbeat: finalSession.lastHeartbeat,
    activeSeconds: finalSession.activeSeconds,
    completedIntervals: finalSession.completedIntervals,
    status: finalSession.status,
    totalBreakSeconds: finalSession.totalBreakSeconds,
    now,
    maxOfficialSeconds: env.MAX_OFFICIAL_SECONDS,
    intervalSeconds: env.SESSION_INTERVAL_SECONDS,
  });

  finalSession.activeSeconds = Math.min(finalState.officialActiveSeconds, env.MAX_OFFICIAL_SECONDS);
  finalSession.completedIntervals = finalState.completedIntervals;
  finalSession.status = finalState.status as SessionStatus;
  if (finalState.status === 'COMPLETED') {
    finalSession.endedAt = now;
    finalSession.status = SessionStatus.COMPLETED;
  }

  await finalSession.save();
  return finalSession;
};

export const createAttendanceFromSession = async ({
  internId,
  sessionId,
  date,
}: {
  internId: string | Types.ObjectId;
  sessionId: string | Types.ObjectId;
  date: Date;
}) => {
  const session = await WorkSession.findById(sessionId);
  if (!session) return null;

  const record = await Attendance.findOneAndUpdate(
    { internId, date: new Date(date.toDateString()) },
    {
      internId,
      date: new Date(date.toDateString()),
      sessionId,
      officialWorkSeconds: session.activeSeconds,
      completedIntervals: session.completedIntervals,
      breakSeconds: session.totalBreakSeconds,
      attendanceStatus: session.activeSeconds >= env.MAX_OFFICIAL_SECONDS ? 'COMPLETED' : 'PRESENT',
    },
    { upsert: true, new: true }
  );

  return record;
};

export const startBreak = async ({ sessionId, internId, now = new Date() }: { sessionId: string | Types.ObjectId; internId: string | Types.ObjectId; now?: Date }) => {
  const session = await WorkSession.findById(sessionId);
  if (!session || session.internId.toString() !== internId.toString()) {
    throw new Error('Session not found for this intern');
  }

  session.status = SessionStatus.BREAK;
  session.lastHeartbeat = now;
  await session.save();

  return await BreakSession.create({ sessionId, internId, breakStartedAt: now, breakDuration: 0 });
};

export const resumeBreak = async ({ sessionId, internId, now = new Date() }: { sessionId: string | Types.ObjectId; internId: string | Types.ObjectId; now?: Date }) => {
  const session = await WorkSession.findById(sessionId);
  if (!session || session.internId.toString() !== internId.toString()) {
    throw new Error('Session not found for this intern');
  }

  const breakRecord = await BreakSession.findOne({ sessionId, internId, breakEndedAt: null }).sort({ breakStartedAt: -1 });
  if (breakRecord) {
    const seconds = Math.max(0, Math.floor((now.getTime() - breakRecord.breakStartedAt.getTime()) / 1000));
    breakRecord.breakEndedAt = now;
    breakRecord.breakDuration = seconds;
    session.totalBreakSeconds += seconds;
    session.status = SessionStatus.ACTIVE;
    session.lastHeartbeat = now;
    await breakRecord.save();
    await session.save();
  }

  return session;
};
