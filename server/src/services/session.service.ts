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
  const session = await WorkSession.findById(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  const state = calculateOfficialSessionState({
    startedAt: session.startedAt,
    lastHeartbeat: session.lastHeartbeat,
    activeSeconds: session.activeSeconds,
    completedIntervals: session.completedIntervals,
    status: session.status,
    totalBreakSeconds: session.totalBreakSeconds,
    now,
    maxOfficialSeconds: env.MAX_OFFICIAL_SECONDS,
    intervalSeconds: env.SESSION_INTERVAL_SECONDS,
  });

  session.lastHeartbeat = now;
  session.activeSeconds = Math.min(state.officialActiveSeconds, env.MAX_OFFICIAL_SECONDS);
  session.completedIntervals = state.completedIntervals;
  session.status = state.status as SessionStatus;

  if (state.status === 'COMPLETED') {
    session.endedAt = now;
    session.status = SessionStatus.COMPLETED;
  }

  await session.save();

  return session;
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
