import { Request, Response } from 'express';
import { WorkSession } from '../models/WorkSession';
import { BreakSession } from '../models/BreakSession';
import { Attendance } from '../models/Attendance';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { startWorkSession, heartbeatSession, startBreak, resumeBreak } from '../services/session.service';

export const startSession = asyncHandler(async (req: any, res: Response) => {
  const session = await startWorkSession({ internId: req.user._id });
  ApiResponse.created(res, session, 'Work session started');
});

export const currentSession = asyncHandler(async (req: any, res: Response) => {
  const session = await WorkSession.findOne({ internId: req.user._id, status: { $ne: 'COMPLETED' } }).sort({ startedAt: -1 });
  ApiResponse.success(res, session || null, 'Current session loaded');
});

export const heartbeat = asyncHandler(async (req: any, res: Response) => {
  const session = await WorkSession.findOne({ _id: req.params.id, internId: req.user._id });
  if (!session) throw AppError.notFound('Session not found');

  const updatedSession = await heartbeatSession({ sessionId: session._id, now: new Date() });
  ApiResponse.success(res, updatedSession, 'Heartbeat recorded');
});

export const startBreakSession = asyncHandler(async (req: any, res: Response) => {
  const session = await WorkSession.findOne({ _id: req.params.id, internId: req.user._id });
  if (!session) throw AppError.notFound('Session not found');

  const breakRecord = await startBreak({ sessionId: session._id, internId: req.user._id, now: new Date() });
  ApiResponse.success(res, breakRecord, 'Break started');
});

export const resumeSession = asyncHandler(async (req: any, res: Response) => {
  const session = await WorkSession.findOne({ _id: req.params.id, internId: req.user._id });
  if (!session) throw AppError.notFound('Session not found');

  const updatedSession = await resumeBreak({ sessionId: session._id, internId: req.user._id, now: new Date() });
  ApiResponse.success(res, updatedSession, 'Session resumed');
});

export const listAttendance = asyncHandler(async (req: any, res: Response) => {
  const records = await Attendance.find({ internId: req.user._id }).sort({ date: -1 });
  ApiResponse.success(res, records, 'Attendance retrieved');
});

export const getBreakHistory = asyncHandler(async (req: any, res: Response) => {
  const breaks = await BreakSession.find({ internId: req.user._id }).sort({ createdAt: -1 });
  ApiResponse.success(res, breaks, 'Break history retrieved');
});
