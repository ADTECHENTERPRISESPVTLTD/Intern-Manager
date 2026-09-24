/** Shapes shared with the backend. See docs/verification-contract.md. */

export type CheckStatus = "PENDING" | "VERIFYING" | "VERIFIED" | "FAILED" | "EXPIRED" | "UNVERIFIED";

/** Why a camera frame was not accepted. Sent by the backend; the UI only displays it. */
export type FailureReason =
  | "NO_FACE"
  | "MULTIPLE_FACES"
  | "LOW_QUALITY"
  | "NO_MATCH"
  | "NOT_REGISTERED"
  | "SERVICE_ERROR";

/** Registration-only rejection reasons. */
export type RegistrationRejection = "NO_FACE" | "MULTIPLE_FACES" | "LOW_QUALITY" | "INCONSISTENT_FRAMES";

export interface CurrentCheck {
  verificationId: string;
  status: CheckStatus;
  requestedAt: string;
  expiresAt: string;
  attemptsUsed: number;
  maxAttempts: number;
}

export interface VerificationStatus {
  sessionId: string | null;
  verificationActive: boolean;
  verificationRequired: boolean;
  current: CurrentCheck | null;
  lastVerifiedAt: string | null;
  nextCheckDueAt: string | null;
  sessionVerificationStatus?: string;
  /** Server clock, so countdowns are not thrown off by a wrong clock on the intern's computer. */
  serverTime?: string;
}

export interface VerifyResult {
  verificationId: string;
  status: CheckStatus;
  reason: FailureReason | null;
  attemptsRemaining: number;
  /** true = this check is finished; false = the intern may try again. */
  closed: boolean;
  nextCheckDueAt: string | null;
  sessionVerificationStatus: string;
}

/** Camera problems are frontend-only. They are never sent to the backend and never use an attempt. */
export type CameraErrorKind = "PERMISSION_DENIED" | "NO_CAMERA" | "IN_USE" | "UNSUPPORTED" | "UNKNOWN";
