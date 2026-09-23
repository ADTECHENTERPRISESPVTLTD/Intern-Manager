import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env';

export type OfficialSessionStatus = 'ACTIVE' | 'BREAK' | 'UNVERIFIED' | 'COMPLETED';

export interface CalculateOfficialSessionStateInput {
  startedAt: Date;
  lastHeartbeat: Date;
  activeSeconds: number;
  completedIntervals: number;
  status: OfficialSessionStatus | string;
  totalBreakSeconds: number;
  now: Date;
  maxOfficialSeconds?: number;
  intervalSeconds?: number;
}

export interface OfficialSessionStateResult {
  officialActiveSeconds: number;
  completedIntervals: number;
  status: OfficialSessionStatus;
  elapsedSeconds: number;
  isCapped: boolean;
}

export const calculateOfficialSessionState = ({
  startedAt,
  lastHeartbeat,
  activeSeconds,
  completedIntervals,
  status,
  totalBreakSeconds,
  now,
  maxOfficialSeconds = env.MAX_OFFICIAL_SECONDS,
  intervalSeconds = env.SESSION_INTERVAL_SECONDS,
}: CalculateOfficialSessionStateInput): OfficialSessionStateResult => {
  const wallElapsedSeconds = Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / 1000));
  const heartbeatElapsedSeconds = Math.max(0, Math.floor((now.getTime() - lastHeartbeat.getTime()) / 1000));
  const effectiveActiveSeconds = Math.max(0, Number(activeSeconds) || 0);
  const cappedActiveSeconds = Math.min(effectiveActiveSeconds, maxOfficialSeconds);
  const cappedIntervals = Math.min(
    Math.floor(cappedActiveSeconds / intervalSeconds),
    Math.floor(maxOfficialSeconds / intervalSeconds)
  );

  const completed = cappedActiveSeconds >= maxOfficialSeconds || cappedIntervals >= Math.floor(maxOfficialSeconds / intervalSeconds);

  return {
    officialActiveSeconds: cappedActiveSeconds,
    completedIntervals: completed ? Math.floor(maxOfficialSeconds / intervalSeconds) : cappedIntervals,
    status: completed ? 'COMPLETED' : (status === 'BREAK' ? 'BREAK' : 'ACTIVE'),
    elapsedSeconds: wallElapsedSeconds,
    isCapped: effectiveActiveSeconds > maxOfficialSeconds || cappedIntervals > Math.floor(maxOfficialSeconds / intervalSeconds),
  };
};

export const isVerificationDue = ({
  lastVerifiedAt,
  now,
  intervalMinutes = env.VERIFICATION_INTERVAL_MINUTES,
}: {
  lastVerifiedAt?: Date | null;
  now: Date;
  intervalMinutes?: number;
}): boolean => {
  if (!lastVerifiedAt) return true;
  const diffMinutes = (now.getTime() - lastVerifiedAt.getTime()) / (60 * 1000);
  return diffMinutes >= intervalMinutes;
};

export const buildAuthToken = ({
  id,
  role,
  expiresIn = env.JWT_EXPIRES_IN,
}: {
  id: string;
  role: string;
  expiresIn?: string;
}): string => {
  const jti = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return jwt.sign({ id, role, jti }, env.JWT_SECRET, { expiresIn: expiresIn as any });
};
