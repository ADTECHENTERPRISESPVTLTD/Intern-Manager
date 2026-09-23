import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface EnvConfig {
  PORT: number;
  NODE_ENV: string;
  MONGODB_URI: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  JWT_REFRESH_SECRET: string;
  JWT_REFRESH_EXPIRES_IN: string;
  FRONTEND_URL: string;
  CORS_ORIGIN: string;
  FACE_VERIFICATION_URL: string;
  FACE_VERIFICATION_KEY: string;
  FACE_VERIFICATION_ENABLED: boolean;
  ATTENDANCE_SYSTEM_ACTIVE: boolean;
  OFFICIAL_ATTENDANCE_START_DATE: string;
  SESSION_INTERVAL_SECONDS: number;
  MAX_OFFICIAL_SECONDS: number;
  VERIFICATION_INTERVAL_MINUTES: number;
}

const getEnvVar = (key: string, defaultValue?: string): string => {
  const value = process.env[key] || defaultValue;
  return value ?? 'development-placeholder';
};

const getBoolEnv = (key: string, defaultValue: boolean): boolean => {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true';
};

const getIntEnv = (key: string, defaultValue: number): number => {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) return defaultValue;
  return parsed;
};

export const env: EnvConfig = {
  PORT: getIntEnv('PORT', 5000),
  NODE_ENV: getEnvVar('NODE_ENV', 'development'),
  MONGODB_URI: getEnvVar('MONGODB_URI', 'mongodb://localhost:27017/intern-manager'),
  JWT_SECRET: getEnvVar('JWT_SECRET', 'dev_local_jwt_secret_change_me'),
  JWT_EXPIRES_IN: getEnvVar('JWT_EXPIRES_IN', '7d'),
  JWT_REFRESH_SECRET: getEnvVar('JWT_REFRESH_SECRET', 'dev_local_refresh_secret_change_me'),
  JWT_REFRESH_EXPIRES_IN: getEnvVar('JWT_REFRESH_EXPIRES_IN', '30d'),
  FRONTEND_URL: getEnvVar('FRONTEND_URL', 'http://localhost:3000'),
  CORS_ORIGIN: getEnvVar('CORS_ORIGIN', 'http://localhost:3000'),
  // Base URL of Soham's face service (ai-service/); this code appends /v1/register and /v1/verify.
  // See ai-service/README.md for the real contract.
  FACE_VERIFICATION_URL: getEnvVar('FACE_VERIFICATION_URL', 'http://127.0.0.1:5001'),
  FACE_VERIFICATION_KEY: getEnvVar('FACE_VERIFICATION_KEY', ''),
  FACE_VERIFICATION_ENABLED: getBoolEnv('FACE_VERIFICATION_ENABLED', false),
  ATTENDANCE_SYSTEM_ACTIVE: getBoolEnv('ATTENDANCE_SYSTEM_ACTIVE', false),
  OFFICIAL_ATTENDANCE_START_DATE: getEnvVar('OFFICIAL_ATTENDANCE_START_DATE', '2026-10-01'),
  SESSION_INTERVAL_SECONDS: getIntEnv('SESSION_INTERVAL_SECONDS', 30),
  MAX_OFFICIAL_SECONDS: getIntEnv('MAX_OFFICIAL_SECONDS', 28800),
  VERIFICATION_INTERVAL_MINUTES: getIntEnv('VERIFICATION_INTERVAL_MINUTES', 30),
};
