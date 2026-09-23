import axios from 'axios';
import FormData from 'form-data';
import { env } from '../config/env';
import { SessionStatus, VerificationStatus, VERIFICATION_CONSTANTS } from '../constants';
import { PresenceVerification, IPresenceVerification } from '../models/PresenceVerification';
import { IWorkSession } from '../models/WorkSession';

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

/**
 * Calls Soham's face service (ai-service/). Never called from the browser — only from here.
 * The service is stateless: it stores nothing, decides only. Contract: ai-service/README.md.
 */
const faceServiceClient = axios.create({
  baseURL: env.FACE_VERIFICATION_URL,
  timeout: 5000,
  headers: { 'X-API-Key': env.FACE_VERIFICATION_KEY },
});

export type FaceDecision = 'MATCH' | 'NO_MATCH' | 'NO_FACE' | 'MULTIPLE_FACES' | 'LOW_QUALITY';
export type RegistrationRejection = 'NO_FACE' | 'MULTIPLE_FACES' | 'LOW_QUALITY' | 'INCONSISTENT_FRAMES';

export class FaceServiceUnavailableError extends Error {}
export class FaceServiceRejectedFrameError extends Error {}
export class FaceRegistrationRejectedError extends Error {
  constructor(
    public readonly reason: RegistrationRejection,
    public readonly frameIndex: number | null
  ) {
    super(reason);
  }
}

/**
 * Registers a face: 3-5 JPEG frames in, one encrypted template string out. The template is
 * opaque — store it, never inspect or decode it, never return it to the frontend.
 */
export const registerFace = async (frames: Buffer[]): Promise<string> => {
  const form = new FormData();
  frames.forEach((frame, i) => form.append('frames', frame, { filename: `frame${i}.jpg`, contentType: 'image/jpeg' }));

  try {
    const response = await faceServiceClient.post<{ template: string }>('/v1/register', form, { headers: form.getHeaders() });
    return response.data.template;
  } catch (error: any) {
    if (error.response?.status === 422 && error.response.data?.error) {
      throw new FaceRegistrationRejectedError(error.response.data.error, error.response.data.frameIndex ?? null);
    }
    if (error.response?.status === 400 && error.response.data?.error === 'INVALID_IMAGE') {
      throw new FaceServiceRejectedFrameError('a registration frame is not a readable JPEG');
    }
    throw new FaceServiceUnavailableError(error.message);
  }
};

/**
 * Compares one JPEG frame against a stored template. `confidence` is never surfaced to the
 * frontend (see docs/verification-contract.md: the match score is never returned to the browser).
 */
export const verifyFace = async (frame: Buffer, encryptedTemplate: string): Promise<{ decision: FaceDecision }> => {
  const form = new FormData();
  form.append('frame', frame, { filename: 'frame.jpg', contentType: 'image/jpeg' });
  form.append('template', encryptedTemplate);

  try {
    const response = await faceServiceClient.post<{ decision: FaceDecision }>('/v1/verify', form, { headers: form.getHeaders() });
    return { decision: response.data.decision };
  } catch (error: any) {
    if (error.response?.status === 400 && error.response.data?.error === 'INVALID_IMAGE') {
      throw new FaceServiceRejectedFrameError('frame is not a readable JPEG');
    }
    // Wrong/expired key, rate limited, service down, timed out — never the intern's fault.
    throw new FaceServiceUnavailableError(error.message);
  }
};

/** Maps a face-service decision onto the verification record. MATCH is the only success case. */
export const outcomeForDecision = (
  decision: FaceDecision
): { status: VerificationStatus.VERIFIED | VerificationStatus.FAILED; reason: string | null } =>
  decision === 'MATCH'
    ? { status: VerificationStatus.VERIFIED, reason: null }
    : { status: VerificationStatus.FAILED, reason: decision };

export interface DueVerificationResult {
  verification: IPresenceVerification | null;
  sessionVerificationStatus: 'NONE' | 'PENDING' | 'VERIFIED' | 'UNVERIFIED';
  lastVerifiedAt: Date | null;
  nextCheckDueAt: Date | null;
}

/**
 * The single source of truth for "is a presence check due right now", shared by the status
 * poll and the request endpoint so they can never disagree. Expires a stale PENDING check,
 * and creates a new PENDING one if the interval has elapsed — matching the recommended
 * architecture in the backend task doc ("the backend should determine whether verification
 * is due", section 23). Never issues a check for a session that is not ACTIVE, or while
 * ATTENDANCE_SYSTEM_ACTIVE is off (section 20/45 of the backend task doc).
 */
export const getOrCreateDueVerification = async ({
  session,
  now = new Date(),
}: {
  session: IWorkSession;
  now?: Date;
}): Promise<DueVerificationResult> => {
  const history = await PresenceVerification.find({ internId: session.internId, sessionId: session._id }).sort({
    requestedAt: -1,
  });
  const lastVerified = history.find((v) => v.status === VerificationStatus.VERIFIED) ?? null;
  const lastVerifiedAt = lastVerified?.verifiedAt ?? null;

  let open = history.find((v) => v.status === VerificationStatus.PENDING || v.status === VerificationStatus.FAILED) ?? null;

  // A due check that nobody answered in time: close it as EXPIRED, not left dangling forever.
  if (open && open.expiresAt <= now) {
    open.status = VerificationStatus.EXPIRED;
    await open.save();
    open = null;
  }

  const inactive = session.status !== SessionStatus.ACTIVE || !env.ATTENDANCE_SYSTEM_ACTIVE;
  if (inactive) {
    return { verification: open, sessionVerificationStatus: sessionStatusFrom(history), lastVerifiedAt, nextCheckDueAt: null };
  }

  if (!open) {
    // No prior record: the baseline is the session start, so the first check is due one
    // interval after starting, not immediately (a plain `lastVerifiedAt: undefined` would
    // make isVerificationDue() return true at t=0).
    const baseline = lastVerifiedAt ?? history[0]?.requestedAt ?? session.startedAt;
    const due = isVerificationDue({ lastVerifiedAt: baseline, now });
    if (due) {
      open = await PresenceVerification.create({
        internId: session.internId,
        sessionId: session._id,
        requestedAt: now,
        expiresAt: new Date(now.getTime() + VERIFICATION_CONSTANTS.WINDOW_MINUTES * 60 * 1000),
        status: VerificationStatus.PENDING,
        attemptsUsed: 0,
      });
      history.unshift(open);
    }
  }

  const nextCheckDueAt = open
    ? null
    : new Date((lastVerifiedAt ?? session.startedAt).getTime() + env.VERIFICATION_INTERVAL_MINUTES * 60 * 1000);

  return { verification: open, sessionVerificationStatus: sessionStatusFrom(history), lastVerifiedAt, nextCheckDueAt };
};

const sessionStatusFrom = (history: IPresenceVerification[]): DueVerificationResult['sessionVerificationStatus'] => {
  const latest = history[0];
  if (!latest) return 'NONE';
  if (latest.status === VerificationStatus.VERIFIED) return 'VERIFIED';
  if (latest.status === VerificationStatus.PENDING) return 'PENDING';
  return 'UNVERIFIED'; // FAILED (exhausted), EXPIRED
};
