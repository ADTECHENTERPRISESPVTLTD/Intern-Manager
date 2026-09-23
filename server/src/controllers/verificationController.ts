import { Response } from 'express';
import { PresenceVerification, IPresenceVerification } from '../models/PresenceVerification';
import { FaceTemplate } from '../models/FaceTemplate';
import { WorkSession } from '../models/WorkSession';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { env } from '../config/env';
import { AuditAction, SessionStatus, VerificationStatus, VERIFICATION_CONSTANTS } from '../constants';
import {
  FaceRegistrationRejectedError,
  FaceServiceRejectedFrameError,
  getOrCreateDueVerification,
  outcomeForDecision,
  registerFace,
  verifyFace,
} from '../services/verification.service';
import { writeAuditLog } from '../services/audit.service';

const currentCheckPayload = (v: IPresenceVerification) => ({
  verificationId: v._id,
  status: v.status,
  requestedAt: v.requestedAt,
  expiresAt: v.expiresAt,
  attemptsUsed: v.attemptsUsed,
  maxAttempts: VERIFICATION_CONSTANTS.MAX_ATTEMPTS,
});

const currentSessionFor = (internId: any) =>
  WorkSession.findOne({ internId }).sort({ startedAt: -1 });

export const getVerificationStatus = asyncHandler(async (req: any, res: Response) => {
  const now = new Date();
  const session = await currentSessionFor(req.user._id);

  if (!session) {
    return ApiResponse.success(
      res,
      {
        sessionId: null,
        verificationActive: false,
        verificationRequired: false,
        current: null,
        lastVerifiedAt: null,
        nextCheckDueAt: null,
        sessionVerificationStatus: 'NONE',
        serverTime: now.toISOString(),
      },
      'No work session yet'
    );
  }

  const { verification, sessionVerificationStatus, lastVerifiedAt, nextCheckDueAt } = await getOrCreateDueVerification({
    session,
    now,
  });
  const verificationActive = session.status !== SessionStatus.COMPLETED && env.ATTENDANCE_SYSTEM_ACTIVE;

  ApiResponse.success(
    res,
    {
      sessionId: session._id,
      verificationActive,
      verificationRequired: Boolean(verification),
      current: verification ? currentCheckPayload(verification) : null,
      lastVerifiedAt,
      nextCheckDueAt,
      sessionVerificationStatus,
      serverTime: now.toISOString(),
    },
    'Verification status loaded'
  );
});

/** Idempotent: returns the already-open check if one exists, otherwise 409 if nothing is due. */
export const requestVerification = asyncHandler(async (req: any, res: Response) => {
  const session = await currentSessionFor(req.user._id);
  if (!session) throw AppError.notFound('No work session found');

  const { verification } = await getOrCreateDueVerification({ session });
  if (!verification) throw AppError.conflict('No verification is due right now');

  ApiResponse.success(res, currentCheckPayload(verification), 'Verification ready');
});

export const getVerificationHistory = asyncHandler(async (req: any, res: Response) => {
  const records = await PresenceVerification.find({ internId: req.user._id }).sort({ requestedAt: -1 });
  ApiResponse.success(res, records, 'Verification history loaded');
});

/**
 * The endpoint that was missing entirely: the intern uploads one camera frame (multer,
 * memory storage — never written to disk) and this forwards it to the face service for a
 * real decision. See docs/verification-contract.md section 5.3 for the response shape.
 */
export const submitVerification = asyncHandler(async (req: any, res: Response) => {
  const now = new Date();
  const verification = await PresenceVerification.findOne({ _id: req.params.id, internId: req.user._id });
  if (!verification) throw AppError.notFound('Verification not found');

  if (verification.status !== VerificationStatus.PENDING && verification.status !== VerificationStatus.FAILED) {
    throw AppError.conflict('This verification check is no longer open');
  }
  if (verification.expiresAt <= now) {
    verification.status = VerificationStatus.EXPIRED;
    await verification.save();
    throw AppError.conflict('The verification window has expired');
  }
  if (!req.file) throw AppError.badRequest('A camera frame is required');

  const attemptsRemaining = () => Math.max(VERIFICATION_CONSTANTS.MAX_ATTEMPTS - verification.attemptsUsed, 0);

  // No registered face: never call the face service, never consume an attempt.
  const template = await FaceTemplate.findOne({ internId: req.user._id }).select('+encryptedTemplate');
  if (!template) {
    return ApiResponse.success(
      res,
      {
        verificationId: verification._id,
        status: verification.status,
        reason: 'NOT_REGISTERED',
        attemptsRemaining: attemptsRemaining(),
        closed: false,
        nextCheckDueAt: null,
        sessionVerificationStatus: 'PENDING',
      },
      'Face registration required'
    );
  }

  let decision;
  try {
    ({ decision } = await verifyFace(req.file.buffer, template.encryptedTemplate));
  } catch (error) {
    if (error instanceof FaceServiceRejectedFrameError) throw AppError.badRequest('Camera frame could not be read');
    // Face service down/unreachable/wrong key: never the intern's fault, so no attempt is used.
    return ApiResponse.success(
      res,
      {
        verificationId: verification._id,
        status: verification.status,
        reason: 'SERVICE_ERROR',
        attemptsRemaining: attemptsRemaining(),
        closed: false,
        nextCheckDueAt: null,
        sessionVerificationStatus: 'PENDING',
      },
      'Verification unavailable, try again'
    );
  }

  const outcome = outcomeForDecision(decision);
  verification.attemptsUsed += 1;
  verification.reason = outcome.reason;

  let closed = false;
  let sessionVerificationStatus: 'VERIFIED' | 'PENDING' | 'UNVERIFIED' = 'PENDING';
  let nextCheckDueAt: Date | null = null;

  if (outcome.status === VerificationStatus.VERIFIED) {
    verification.status = VerificationStatus.VERIFIED;
    verification.verifiedAt = now;
    closed = true;
    sessionVerificationStatus = 'VERIFIED';
    nextCheckDueAt = new Date(now.getTime() + env.VERIFICATION_INTERVAL_MINUTES * 60 * 1000);
  } else {
    verification.status = VerificationStatus.FAILED;
    if (verification.attemptsUsed >= VERIFICATION_CONSTANTS.MAX_ATTEMPTS) {
      closed = true;
      sessionVerificationStatus = 'UNVERIFIED';
      nextCheckDueAt = new Date(now.getTime() + env.VERIFICATION_INTERVAL_MINUTES * 60 * 1000);
    }
  }

  await verification.save();

  if (closed) {
    await writeAuditLog({
      actor: req.user._id,
      action: AuditAction.ADMIN_ACTION,
      target: verification._id,
      targetType: 'PresenceVerification',
      metadata: { status: verification.status, sessionId: verification.sessionId.toString() },
    });
  }

  ApiResponse.success(
    res,
    {
      verificationId: verification._id,
      status: verification.status,
      reason: verification.reason,
      attemptsRemaining: attemptsRemaining(),
      closed,
      nextCheckDueAt,
      sessionVerificationStatus,
    },
    outcome.status === VerificationStatus.VERIFIED ? 'Presence verified' : 'Verification failed'
  );
});

/** One-time onboarding: 3-5 JPEG photos in, an encrypted template stored, never returned. */
export const registerFaceHandler = asyncHandler(async (req: any, res: Response) => {
  const files: Express.Multer.File[] = req.files || [];
  if (files.length < VERIFICATION_CONSTANTS.MIN_REGISTRATION_FRAMES || files.length > VERIFICATION_CONSTANTS.MAX_REGISTRATION_FRAMES) {
    throw AppError.badRequest(
      `Send between ${VERIFICATION_CONSTANTS.MIN_REGISTRATION_FRAMES} and ${VERIFICATION_CONSTANTS.MAX_REGISTRATION_FRAMES} frames`
    );
  }

  try {
    const template = await registerFace(files.map((f) => f.buffer));
    await FaceTemplate.findOneAndUpdate(
      { internId: req.user._id },
      { internId: req.user._id, encryptedTemplate: template, registeredAt: new Date() },
      { upsert: true, new: true }
    );
    ApiResponse.success(res, { registered: true }, 'Face registered');
  } catch (error) {
    if (error instanceof FaceRegistrationRejectedError) {
      return ApiResponse.error(
        res,
        `Registration photo rejected: ${error.reason}${error.frameIndex !== null ? ` (frame ${error.frameIndex + 1})` : ''}`,
        422,
        error.reason
      );
    }
    if (error instanceof FaceServiceRejectedFrameError) throw AppError.badRequest('A registration frame could not be read');
    throw AppError.internal('Face service unavailable, try again');
  }
});

export const getRegistrationStatus = asyncHandler(async (req: any, res: Response) => {
  const template = await FaceTemplate.findOne({ internId: req.user._id });
  ApiResponse.success(res, { registered: Boolean(template), registeredAt: template?.registeredAt ?? null }, 'Registration status loaded');
});

/** Admin-only manual override/correction. Unrelated to the AI pipeline above. */
export const verifySession = asyncHandler(async (req: any, res: Response) => {
  const verification = await PresenceVerification.findByIdAndUpdate(
    req.params.id,
    {
      $set: {
        status: req.body.status || VerificationStatus.VERIFIED,
        verifiedAt: new Date(),
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
