import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { mongoIdSchema } from '../validators/common.validator';
import { BreakSession } from '../models/BreakSession';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { WorkSession } from '../models/WorkSession';
import { SessionStatus } from '../constants';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(async (req: any, res) => {
  const breaks = await BreakSession.find({ internId: req.user._id }).sort({ createdAt: -1 });
  ApiResponse.success(res, breaks, 'Break history loaded');
}));

router.post('/start', validate({ body: z.object({ sessionId: mongoIdSchema }) }), asyncHandler(async (req: any, res) => {
  const session = await WorkSession.findOne({ _id: req.body.sessionId, internId: req.user._id, status: { $ne: SessionStatus.COMPLETED } });
  if (!session) {
    return res.status(404).json({ success: false, message: 'Active session not found', code: 'NOT_FOUND' });
  }

  const activeBreak = await BreakSession.findOne({ sessionId: session._id, internId: req.user._id, breakEndedAt: null });
  if (activeBreak) {
    return res.status(409).json({ success: false, message: 'Break is already active', code: 'CONFLICT' });
  }

  session.status = SessionStatus.BREAK;
  await session.save();

  const breakRecord = await BreakSession.create({
    sessionId: session._id,
    internId: req.user._id,
    breakStartedAt: new Date(),
    breakDuration: 0,
  });

  ApiResponse.created(res, breakRecord, 'Break started');
}));

router.post('/end', validate({ body: z.object({ sessionId: mongoIdSchema }) }), asyncHandler(async (req: any, res) => {
  const session = await WorkSession.findOne({ _id: req.body.sessionId, internId: req.user._id });
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found', code: 'NOT_FOUND' });
  }

  const breakRecord = await BreakSession.findOne({ sessionId: session._id, internId: req.user._id, breakEndedAt: null });
  if (!breakRecord) {
    return res.status(409).json({ success: false, message: 'No active break to end', code: 'CONFLICT' });
  }

  const endedAt = new Date();
  const breakDuration = Math.max(0, Math.floor((endedAt.getTime() - breakRecord.breakStartedAt.getTime()) / 1000));
  breakRecord.breakEndedAt = endedAt;
  breakRecord.breakDuration = breakDuration;
  session.totalBreakSeconds += breakDuration;
  session.status = SessionStatus.ACTIVE;
  await breakRecord.save();
  await session.save();

  ApiResponse.success(res, { breakRecord, session }, 'Break ended');
}));

export default router;
