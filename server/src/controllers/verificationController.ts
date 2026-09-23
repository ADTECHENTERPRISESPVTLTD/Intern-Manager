import { Request, Response } from 'express';
import { PresenceVerification } from '../models/PresenceVerification';
import { WorkSession } from '../models/WorkSession';
import { User } from '../models/User';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { env } from '../config/env';
import { AuditAction, VerificationStatus } from '../constants';
import { writeAuditLog } from '../services/audit.service';
import {
  createFaceVerificationClient,
  FaceDecision,
  FaceServiceUnavailableError,
  FaceServiceRejectedFrameError,
  FaceRegistrationRejectedError,
} from '../integrations/faceVerificationClient';

function isJpeg(buf?: Buffer): boolean {
  return Boolean(buf && buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8);
}

const faceClient = createFaceVerificationClient({
  baseUrl: env.FACE_VERIFICATION_URL,
  apiKey: env.FACE_VERIFICATION_KEY,
  timeoutMs: 5000,
});

/**
 * Returns current verification status for the intern's active session.
 * Automatically marks expired checks and schedules new checks when due.
 */
export const getStatus = asyncHandler(async (req: any, res: Response) => {
  const internId = req.user._id;
  const now = new Date();

  const session = await WorkSession.findOne({
    internId,
    status: { $in: ['ACTIVE', 'BREAK', 'UNVERIFIED'] },
  }).sort({ startedAt: -1 });

  let openCheck = await PresenceVerification.findOne({
    internId,
    closed: false,
  }).sort({ requestedAt: -1 });

  // Handle expired check window (5 minutes by default)
  if (openCheck && openCheck.expiresAt && now > openCheck.expiresAt) {
    openCheck.closed = true;
    openCheck.closedAt = openCheck.expiresAt;
    openCheck.status = VerificationStatus.EXPIRED;
    await openCheck.save();

    if (session) {
      session.verificationStatus = 'UNVERIFIED';
      session.nextDueActiveSec = (session.activeSeconds || 0) + (env.VERIFICATION_INTERVAL_MINUTES * 60);
      await session.save();
    }
    openCheck = null;
  }

  // Check if a new check is due (every 30 active minutes during official session)
  const isDue = Boolean(
    session &&
    session.status === 'ACTIVE' &&
    !openCheck &&
    (session.activeSeconds || 0) >= (session.nextDueActiveSec || env.VERIFICATION_INTERVAL_MINUTES * 60)
  );

  if (isDue && session) {
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);
    openCheck = await PresenceVerification.create({
      internId,
      sessionId: session._id,
      requestedAt: now,
      expiresAt,
      status: VerificationStatus.PENDING,
      closed: false,
      attemptsUsed: 0,
      failedAttempts: 0,
      provider: 'AI_FACE_VERIFICATION',
    });
    session.verificationStatus = 'PENDING';
    await session.save();
  }

  const remainingSeconds = session && session.status === 'ACTIVE'
    ? Math.max(0, (session.nextDueActiveSec || 1800) - (session.activeSeconds || 0))
    : null;
  const nextCheckDueAt = remainingSeconds !== null ? new Date(now.getTime() + remainingSeconds * 1000).toISOString() : null;

  ApiResponse.success(res, {
    sessionId: session?._id ?? null,
    verificationActive: Boolean(session && session.status !== 'COMPLETED'),
    verificationRequired: Boolean(openCheck && !openCheck.closed),
    current: openCheck && !openCheck.closed ? {
      verificationId: openCheck._id.toString(),
      status: openCheck.status,
      requestedAt: openCheck.requestedAt.toISOString(),
      expiresAt: openCheck.expiresAt ? openCheck.expiresAt.toISOString() : null,
      attemptsUsed: openCheck.attemptsUsed || 0,
      maxAttempts: 3,
    } : null,
    lastVerifiedAt: session?.lastVerifiedAt ? session.lastVerifiedAt.toISOString() : null,
    nextCheckDueAt,
    sessionVerificationStatus: session?.verificationStatus ?? 'NONE',
    serverTime: now.toISOString(),
  });
});

/**
 * Idempotently requests a check when due, or returns existing open check.
 */
export const requestVerification = asyncHandler(async (req: any, res: Response) => {
  const internId = req.user._id;
  const now = new Date();

  const session = await WorkSession.findOne({
    internId,
    status: { $in: ['ACTIVE', 'BREAK', 'UNVERIFIED'] },
  }).sort({ startedAt: -1 });

  if (!session) throw AppError.notFound('No active work session found');

  let openCheck = await PresenceVerification.findOne({
    internId,
    sessionId: session._id,
    closed: false,
  }).sort({ requestedAt: -1 });

  if (!openCheck) {
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);
    openCheck = await PresenceVerification.create({
      internId,
      sessionId: session._id,
      requestedAt: now,
      expiresAt,
      status: VerificationStatus.PENDING,
      closed: false,
      attemptsUsed: 0,
      failedAttempts: 0,
      provider: 'AI_FACE_VERIFICATION',
    });
    session.verificationStatus = 'PENDING';
    await session.save();
  }

  ApiResponse.success(res, {
    verificationId: openCheck._id.toString(),
    status: openCheck.status,
    requestedAt: openCheck.requestedAt.toISOString(),
    expiresAt: openCheck.expiresAt?.toISOString() || null,
    attemptsUsed: openCheck.attemptsUsed || 0,
    maxAttempts: 3,
  }, 'Verification check ready');
});

/**
 * Verifies face presence using uploaded camera frame against stored user face template.
 */
export const verifyPresenceFrame = asyncHandler(async (req: any, res: Response) => {
  const internId = req.user._id;
  const now = new Date();
  const verificationId = req.body?.verificationId || req.params?.id;

  const session = await WorkSession.findOne({
    internId,
    status: { $in: ['ACTIVE', 'BREAK', 'UNVERIFIED'] },
  }).sort({ startedAt: -1 });

  if (!session) throw AppError.notFound('No active work session found');

  const check = await PresenceVerification.findOne({
    _id: verificationId,
    internId,
  });

  if (!check) throw AppError.notFound('Verification record not found');
  if (check.closed) {
    const code = check.status === VerificationStatus.EXPIRED ? 'VERIFICATION_EXPIRED' : 'VERIFICATION_CLOSED';
    throw new AppError('This presence check is no longer open', 409, code);
  }

  const file = req.file;
  if (!file || !isJpeg(file.buffer)) {
    throw new AppError('Camera frame must be a valid JPEG image', 400, 'INVALID_FRAME');
  }

  const user = await User.findById(internId).select('+faceTemplate');
  if (!user || !user.faceTemplate) {
    return ApiResponse.success(res, {
      verificationId: check._id.toString(),
      status: check.status,
      reason: 'NOT_REGISTERED',
      attemptsRemaining: Math.max(0, 3 - (check.attemptsUsed || 0)),
      closed: false,
      nextCheckDueAt: null,
      sessionVerificationStatus: session.verificationStatus,
    }, 'Face registration required');
  }

  check.status = VerificationStatus.VERIFYING;
  await check.save();

  let decision: FaceDecision = 'MATCH';
  try {
    const result = await faceClient.verify(new Uint8Array(file.buffer), user.faceTemplate);
    decision = result.decision;
  } catch (err) {
    if (err instanceof FaceServiceRejectedFrameError) {
      check.status = VerificationStatus.PENDING;
      await check.save();
      throw new AppError('Camera frame could not be read', 400, 'INVALID_FRAME');
    }
    // If AI service is down or in dev mode without AI microservice running, fallback gracefully
    if (err instanceof FaceServiceUnavailableError || !env.FACE_VERIFICATION_ENABLED) {
      if (process.env.NODE_ENV !== 'production' && !env.FACE_VERIFICATION_ENABLED) {
        decision = 'MATCH'; // graceful fallback in dev/test when AI service isn't active
      } else {
        check.status = VerificationStatus.PENDING;
        await check.save();
        return ApiResponse.success(res, {
          verificationId: check._id.toString(),
          status: check.status,
          reason: 'SERVICE_ERROR',
          attemptsRemaining: Math.max(0, 3 - (check.attemptsUsed || 0)),
          closed: false,
          nextCheckDueAt: null,
          sessionVerificationStatus: session.verificationStatus,
        }, 'Verification service unavailable, try again');
      }
    }
  }

  check.attemptsUsed = (check.attemptsUsed || 0) + 1;

  if (decision === 'MATCH') {
    check.status = VerificationStatus.VERIFIED;
    check.closed = true;
    check.closedAt = now;
    check.verifiedAt = now;
    check.lastReason = null;
    await check.save();

    session.verificationStatus = 'VERIFIED';
    session.lastVerifiedAt = now;
    session.nextDueActiveSec = (session.activeSeconds || 0) + (env.VERIFICATION_INTERVAL_MINUTES * 60);
    await session.save();

    await writeAuditLog({
      actor: internId,
      action: AuditAction.ADMIN_ACTION,
      target: check._id,
      targetType: 'PresenceVerification',
      metadata: { status: 'VERIFIED', sessionId: session._id.toString() },
    });

    const nextDue = new Date(now.getTime() + env.VERIFICATION_INTERVAL_MINUTES * 60 * 1000).toISOString();
    return ApiResponse.success(res, {
      verificationId: check._id.toString(),
      status: 'VERIFIED',
      reason: null,
      attemptsRemaining: Math.max(0, 3 - check.attemptsUsed),
      closed: true,
      nextCheckDueAt: nextDue,
      sessionVerificationStatus: 'VERIFIED',
    }, 'Presence verified successfully');
  }

  // Not a match (NO_MATCH, NO_FACE, MULTIPLE_FACES, LOW_QUALITY)
  check.status = VerificationStatus.FAILED;
  check.failedAttempts = (check.failedAttempts || 0) + 1;
  check.lastReason = decision;

  if (check.attemptsUsed >= 3) {
    check.closed = true;
    check.closedAt = now;
    session.verificationStatus = 'UNVERIFIED';
    session.nextDueActiveSec = (session.activeSeconds || 0) + (env.VERIFICATION_INTERVAL_MINUTES * 60);
  }

  await check.save();
  await session.save();

  return ApiResponse.success(res, {
    verificationId: check._id.toString(),
    status: 'FAILED',
    reason: decision,
    attemptsRemaining: Math.max(0, 3 - check.attemptsUsed),
    closed: Boolean(check.closed),
    nextCheckDueAt: check.closed ? new Date(now.getTime() + env.VERIFICATION_INTERVAL_MINUTES * 60 * 1000).toISOString() : null,
    sessionVerificationStatus: session.verificationStatus,
  }, 'Verification failed');
});

/**
 * Face registration: receives 3 to 5 camera frames, sends to AI service,
 * and saves encrypted face template to MongoDB User record.
 */
export const registerFace = asyncHandler(async (req: any, res: Response) => {
  const internId = req.user.role === 'ADMIN' && req.body?.internId ? req.body.internId : req.user._id;
  const files = (req.files as Express.Multer.File[]) || [];

  if (files.length < 3 || files.length > 5) {
    throw new AppError('Send between 3 and 5 photo frames for registration', 400, 'INVALID_REQUEST');
  }

  for (const f of files) {
    if (!isJpeg(f.buffer)) {
      throw new AppError('Every registration frame must be a valid JPEG', 400, 'INVALID_FRAME');
    }
  }

  const frames = files.map((f) => new Uint8Array(f.buffer));
  let template = 'simulated_template_' + Date.now();

  try {
    template = await faceClient.register(frames);
  } catch (err) {
    if (err instanceof FaceRegistrationRejectedError) {
      return res.status(422).json({
        success: false,
        message: 'Registration photo rejected',
        code: err.reason,
        frameIndex: err.frameIndex,
      });
    }
    if (err instanceof FaceServiceRejectedFrameError) {
      throw new AppError('A registration frame could not be read', 400, 'INVALID_FRAME');
    }
    if (!env.FACE_VERIFICATION_ENABLED && process.env.NODE_ENV !== 'production') {
      template = 'mock_encrypted_template_' + internId;
    } else {
      throw new AppError('Face registration service currently unavailable', 503, 'SERVICE_ERROR');
    }
  }

  await User.findByIdAndUpdate(internId, {
    $set: {
      faceTemplate: template,
      faceRegisteredAt: new Date(),
    },
  });

  await writeAuditLog({
    actor: req.user._id,
    action: AuditAction.ADMIN_ACTION,
    target: internId,
    targetType: 'User',
    metadata: { action: 'FACE_REGISTERED', frameCount: files.length },
  });

  ApiResponse.success(res, { registered: true }, 'Face registered successfully');
});

/**
 * Gets face registration status for current intern.
 */
export const getRegistrationStatus = asyncHandler(async (req: any, res: Response) => {
  const user = await User.findById(req.user._id).select('+faceTemplate');
  ApiResponse.success(res, {
    registered: Boolean(user?.faceTemplate),
    registeredAt: user?.faceRegisteredAt ? user.faceRegisteredAt.toISOString() : null,
  });
});

/**
 * Verification history for the authenticated intern or for admin viewing an intern.
 */
export const getVerificationHistory = asyncHandler(async (req: any, res: Response) => {
  const internId = req.user.role === 'ADMIN' && req.query.internId ? req.query.internId : req.user._id;
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const pageSize = 20;

  const [records, total] = await Promise.all([
    PresenceVerification.find({ internId })
      .sort({ requestedAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize),
    PresenceVerification.countDocuments({ internId }),
  ]);

  const items = records.map((c) => ({
    verificationId: c._id.toString(),
    sessionId: c.sessionId.toString(),
    requestedAt: c.requestedAt.toISOString(),
    verifiedAt: c.verifiedAt ? c.verifiedAt.toISOString() : null,
    status: c.status,
    reason: c.status === VerificationStatus.VERIFIED ? null : c.lastReason,
    attempts: c.attemptsUsed || 0,
  }));

  ApiResponse.success(res, { items, page, total }, 'Verification history loaded');
});

/**
 * Admin manual verification override.
 */
export const verifySession = asyncHandler(async (req: any, res: Response) => {
  const verification = await PresenceVerification.findByIdAndUpdate(
    req.params.id,
    {
      $set: {
        status: req.body.status || VerificationStatus.VERIFIED,
        verifiedAt: new Date(),
        closed: true,
        closedAt: new Date(),
        externalReference: req.body.externalReference || undefined,
      },
    },
    { new: true }
  );

  if (!verification) throw AppError.notFound('Verification record not found');

  await writeAuditLog({
    actor: req.user._id,
    action: AuditAction.ADMIN_ACTION,
    target: verification._id,
    targetType: 'PresenceVerification',
    metadata: { status: verification.status, sessionId: verification.sessionId.toString() },
  });

  ApiResponse.success(res, verification, 'Verification status updated');
});
