import { Request, Response } from 'express';
import { User } from '../models/User';
import { WorkSession } from '../models/WorkSession';
import { Attendance } from '../models/Attendance';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { AuditAction } from '../constants';
import { writeAuditLog } from '../services/audit.service';

export const adminOverview = asyncHandler(async (_req: Request, res: Response) => {
  const [internCount, sessionCount, attendanceCount] = await Promise.all([
    User.countDocuments({ role: 'INTERN' }),
    WorkSession.countDocuments(),
    Attendance.countDocuments(),
  ]);

  ApiResponse.success(
    res,
    {
      internCount,
      sessionCount,
      attendanceCount,
      timestamp: new Date().toISOString(),
    },
    'Admin overview loaded'
  );
});

export const listAllSessions = asyncHandler(async (_req: Request, res: Response) => {
  const sessions = await WorkSession.find().sort({ startedAt: -1 }).limit(100);
  ApiResponse.success(res, sessions, 'Sessions retrieved');
});

export const listAttendanceRecords = asyncHandler(async (_req: Request, res: Response) => {
  const records = await Attendance.find().sort({ date: -1 }).limit(100);
  ApiResponse.success(res, records, 'Attendance records retrieved');
});

export const listAllUsers = asyncHandler(async (_req: Request, res: Response) => {
  const users = await User.find().select('-password').sort({ createdAt: -1 });
  ApiResponse.success(res, users, 'Users retrieved');
});

export const changeUserStatus = asyncHandler(async (req: any, res: Response) => {
  const user = await User.findByIdAndUpdate(req.params.id, { $set: { status: req.body.status } }, { new: true }).select('-password');
  if (!user) throw AppError.notFound('User not found');

  await writeAuditLog({
    actor: req.user._id,
    action: AuditAction.INTERN_STATUS_CHANGED,
    target: user._id,
    targetType: 'User',
    metadata: { status: req.body.status, previousStatus: user.status },
  });

  ApiResponse.success(res, user, 'User status updated');
});
