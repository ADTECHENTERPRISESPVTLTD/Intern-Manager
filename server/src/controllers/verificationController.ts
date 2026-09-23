import { Request, Response } from 'express';
import { PresenceVerification } from '../models/PresenceVerification';
import { WorkSession } from '../models/WorkSession';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { isVerificationDue } from '../services/core';
import { triggerFaceVerification, updateVerificationRecord } from '../services/verification.service';
import { AuditAction, VerificationStatus } from '../constants';
import { writeAuditLog } from '../services/audit.service';

export const requestVerification = asyncHandler(async (req: any, res: Response) => {
  const session = await WorkSession.findOne({ _id: req.body.sessionId, internId: req.user._id });
  if (!session) throw AppError.notFound('Work session not found');

  const last = await PresenceVerification.findOne({ internId: req.user._id, sessionId: session._id }).sort({ requestedAt: -1 });
  const due = isVerificationDue({
    lastVerifiedAt: last && last.status === VerificationStatus.VERIFIED ? last.verifiedAt || last.requestedAt : last?.requestedAt,
    now: new Date(),
  });

  const verification = await PresenceVerification.create({
    internId: req.user._id,
    sessionId: session._id,
    requestedAt: new Date(),
    status: due ? VerificationStatus.PENDING : VerificationStatus.UNVERIFIED,
    provider: 'FACE_VERIFICATION_PROVIDER',
    externalReference: `verification-${Date.now()}`,
  });

  const providerResult = await triggerFaceVerification({
    internId: req.user._id.toString(),
    sessionId: session._id.toString(),
    provider: 'FACE_VERIFICATION_PROVIDER',
  });

  const resultStatus = providerResult.status as VerificationStatus;
  const updatedVerification = await updateVerificationRecord({
    verificationId: verification._id.toString(),
    status: resultStatus,
    provider: providerResult.provider,
    externalReference: providerResult.externalReference,
  });

  if (providerResult.error) {
    await writeAuditLog({
      actor: req.user._id,
      action: AuditAction.ADMIN_ACTION,
      target: verification._id,
      targetType: 'PresenceVerification',
      metadata: { providerError: providerResult.error, status: resultStatus },
    });
  }

  ApiResponse.created(res, updatedVerification || verification, 'Verification request created');
});

export const getVerificationHistory = asyncHandler(async (req: any, res: Response) => {
  const records = await PresenceVerification.find({ internId: req.user._id }).sort({ requestedAt: -1 });
  ApiResponse.success(res, records, 'Verification history loaded');
});

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
