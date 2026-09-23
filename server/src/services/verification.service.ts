import axios from 'axios';
import { env } from '../config/env';
import { PresenceVerification } from '../models/PresenceVerification';
import { VerificationStatus } from '../constants';

export const isVerificationDue = ({
  lastVerifiedAt,
  now,
  intervalMinutes = env.VERIFICATION_INTERVAL_MINUTES,
}: {
  lastVerifiedAt?: Date | null;
  now: Date;
  intervalMinutes?: number;
}) => {
  if (!lastVerifiedAt) return true;
  return (now.getTime() - lastVerifiedAt.getTime()) / (60 * 1000) >= intervalMinutes;
};

type FaceVerificationResponse = {
  status?: VerificationStatus | string;
  verificationId?: string;
  id?: string;
};

export const triggerFaceVerification = async ({
  internId,
  sessionId,
  provider = 'FACE_VERIFICATION_PROVIDER',
}: {
  internId: string;
  sessionId: string;
  provider?: string;
}) => {
  const payload = {
    internId,
    sessionId,
    provider,
    timestamp: new Date().toISOString(),
  };

  try {
    const response = await axios.post<FaceVerificationResponse>(
      env.FACE_VERIFICATION_URL,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Verification-Key': env.FACE_VERIFICATION_KEY,
        },
        timeout: 10000,
      }
    );

    const data = response?.data ?? {};
    const status = data.status || VerificationStatus.VERIFIED;
    return {
      provider,
      status,
      externalReference: data.verificationId || data.id || undefined,
    };
  } catch (error) {
    return {
      provider,
      status: VerificationStatus.FAILED,
      externalReference: undefined,
      error: error instanceof Error ? error.message : 'Verification request failed',
    };
  }
};

export const updateVerificationRecord = async ({
  verificationId,
  status,
  provider,
  externalReference,
}: {
  verificationId: string;
  status: VerificationStatus;
  provider?: string;
  externalReference?: string;
}) => {
  return PresenceVerification.findByIdAndUpdate(
    verificationId,
    {
      $set: {
        status,
        provider,
        externalReference,
        verifiedAt: status === VerificationStatus.VERIFIED ? new Date() : undefined,
      },
    },
    { new: true }
  );
};
