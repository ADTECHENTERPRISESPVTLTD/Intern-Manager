import { Request, Response } from 'express';
import { User } from '../models/User';
import { InternProfile } from '../models/InternProfile';
import { WorkSession } from '../models/WorkSession';
import { Attendance } from '../models/Attendance';
import { PresenceVerification } from '../models/PresenceVerification';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { AuditAction } from '../constants';
import { env } from '../config/env';
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

export const listInternsForAdmin = asyncHandler(async (_req: Request, res: Response) => {
  const interns = await User.find({ role: 'INTERN' }).select('-password').sort({ name: 1 });

  const internData = await Promise.all(
    interns.map(async (intern) => {
      const [profile, session, checks] = await Promise.all([
        InternProfile.findOne({ userId: intern._id }),
        WorkSession.findOne({ internId: intern._id }).sort({ startedAt: -1 }),
        PresenceVerification.find({ internId: intern._id }),
      ]);

      const interval = env.SESSION_INTERVAL_SECONDS;
      const target = env.MAX_OFFICIAL_SECONDS;

      return {
        id: intern._id.toString(),
        _id: intern._id,
        name: intern.name,
        email: intern.email,
        role: intern.role,
        status: intern.status,
        designation: profile?.designation || 'Intern',
        department: profile?.department || '',
        session: session
          ? {
              sessionId: session._id.toString(),
              status: session.status,
              activeSeconds: session.activeSeconds || 0,
              targetSeconds: target,
              completedIntervals: session.completedIntervals || Math.floor((session.activeSeconds || 0) / interval),
              totalIntervals: Math.floor(target / interval),
            }
          : null,
        verification: {
          status: session?.verificationStatus || 'NONE',
          lastVerifiedAt: session?.lastVerifiedAt ? session.lastVerifiedAt.toISOString() : null,
          nextCheckDueAt:
            session && session.status === 'ACTIVE'
              ? new Date(Date.now() + Math.max(0, (session.nextDueActiveSec || 1800) - (session.activeSeconds || 0)) * 1000).toISOString()
              : null,
          failedCount: checks.filter((c) => c.status === 'FAILED').length,
          unverifiedCount: checks.filter((c) => c.status === 'UNVERIFIED').length,
        },
      };
    })
  );

  ApiResponse.success(res, internData, 'Admin intern list loaded');
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
