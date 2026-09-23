import { Request, Response } from 'express';
import { WorkSession } from '../models/WorkSession';
import { BreakSession } from '../models/BreakSession';
import { Attendance } from '../models/Attendance';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { env } from '../config/env';
import { startWorkSession, heartbeatSession, startBreak, resumeBreak } from '../services/session.service';

const formatSession = (session: any) => {
  if (!session) return null;
  const target = env.MAX_OFFICIAL_SECONDS;
  const interval = env.SESSION_INTERVAL_SECONDS;
  return {
    _id: session._id,
    sessionId: session._id.toString(),
    internId: session.internId,
    status: session.status,
    startedAt: session.startedAt,
    endedAt: session.endedAt || null,
    lastHeartbeat: session.lastHeartbeat,
    activeSeconds: session.activeSeconds || 0,
    targetSeconds: target,
    completedIntervals: session.completedIntervals || Math.floor((session.activeSeconds || 0) / interval),
    totalIntervals: Math.floor(target / interval),
    totalBreakSeconds: session.totalBreakSeconds || 0,
    isOfficial: session.isOfficial || false,
    verificationStatus: session.verificationStatus || 'NONE',
    officialAttendance: env.ATTENDANCE_SYSTEM_ACTIVE,
  };
};

export const startSession = asyncHandler(async (req: any, res: Response) => {
  const session = await startWorkSession({ internId: req.user._id });
  ApiResponse.created(res, formatSession(session), 'Work session started');
});

export const currentSession = asyncHandler(async (req: any, res: Response) => {
  const session = await WorkSession.findOne({ internId: req.user._id }).sort({ startedAt: -1 });
  ApiResponse.success(res, formatSession(session), 'Current session loaded');
});

export const heartbeat = asyncHandler(async (req: any, res: Response) => {
  const sessionId = req.params?.id || req.body?.sessionId;
  let session = null;
  if (sessionId) {
    session = await WorkSession.findOne({ _id: sessionId, internId: req.user._id });
  } else {
    session = await WorkSession.findOne({ internId: req.user._id, status: { $in: ['ACTIVE', 'BREAK', 'UNVERIFIED'] } }).sort({ startedAt: -1 });
  }

  if (!session) throw AppError.notFound('Session not found');

  const updatedSession = await heartbeatSession({ sessionId: session._id, now: new Date() });
  ApiResponse.success(res, formatSession(updatedSession), 'Heartbeat recorded');
});

export const startBreakSession = asyncHandler(async (req: any, res: Response) => {
  const sessionId = req.params?.id || req.body?.sessionId;
  let session = null;
  if (sessionId) {
    session = await WorkSession.findOne({ _id: sessionId, internId: req.user._id });
  } else {
    session = await WorkSession.findOne({ internId: req.user._id, status: 'ACTIVE' }).sort({ startedAt: -1 });
  }

  if (!session) throw AppError.notFound('Active session not found');

  await startBreak({ sessionId: session._id, internId: req.user._id, now: new Date() });
  const reloaded = await WorkSession.findById(session._id);
  ApiResponse.success(res, formatSession(reloaded), 'Break started');
});

export const resumeSession = asyncHandler(async (req: any, res: Response) => {
  const sessionId = req.params?.id || req.body?.sessionId;
  let session = null;
  if (sessionId) {
    session = await WorkSession.findOne({ _id: sessionId, internId: req.user._id });
  } else {
    session = await WorkSession.findOne({ internId: req.user._id, status: 'BREAK' }).sort({ startedAt: -1 });
  }

  if (!session) throw AppError.notFound('Paused/Break session not found');

  const updatedSession = await resumeBreak({ sessionId: session._id, internId: req.user._id, now: new Date() });
  ApiResponse.success(res, formatSession(updatedSession), 'Session resumed');
});

export const listAttendance = asyncHandler(async (req: any, res: Response) => {
  const records = await Attendance.find({ internId: req.user._id }).sort({ date: -1 });
  ApiResponse.success(res, records, 'Attendance retrieved');
});

export const getBreakHistory = asyncHandler(async (req: any, res: Response) => {
  const breaks = await BreakSession.find({ internId: req.user._id }).sort({ createdAt: -1 });
  ApiResponse.success(res, breaks, 'Break history retrieved');
});
