// ============================================
// AD TECH Intern Manager - Application Constants
// ============================================

// --- Roles ---
export enum UserRole {
  INTERN = 'INTERN',
  ADMIN = 'ADMIN',
  TEAM_LEAD = 'TEAM_LEAD', // Future-proof
}

// --- User Status ---
export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

// --- Internship Status ---
export enum InternshipStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  TERMINATED = 'TERMINATED',
  ON_LEAVE = 'ON_LEAVE',
}

// --- Task Status ---
export enum TaskStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  COMPLETED = 'COMPLETED',
  REWORK_REQUIRED = 'REWORK_REQUIRED',
}

// --- Task Priority ---
export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

// --- Submission Status ---
export enum SubmissionStatus {
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED = 'APPROVED',
  REWORK_REQUIRED = 'REWORK_REQUIRED',
}

// --- Project Status ---
export enum ProjectStatus {
  PLANNING = 'PLANNING',
  ACTIVE = 'ACTIVE',
  ON_HOLD = 'ON_HOLD',
  COMPLETED = 'COMPLETED',
  ARCHIVED = 'ARCHIVED',
}

// --- Session Status ---
export enum SessionStatus {
  ACTIVE = 'ACTIVE',
  BREAK = 'BREAK',
  UNVERIFIED = 'UNVERIFIED',
  COMPLETED = 'COMPLETED',
  ABANDONED = 'ABANDONED',
}

// --- Attendance Status ---
export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  PARTIAL = 'PARTIAL',
  ABSENT = 'ABSENT',
  UNVERIFIED = 'UNVERIFIED',
  COMPLETED = 'COMPLETED',
}

// --- Verification Status ---
export enum VerificationStatus {
  PENDING = 'PENDING',
  VERIFYING = 'VERIFYING',
  VERIFIED = 'VERIFIED',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
  UNVERIFIED = 'UNVERIFIED',
}

// --- Report Status ---
export enum ReportStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  REVIEWED = 'REVIEWED',
}

// --- Notification Type ---
export enum NotificationType {
  TASK_ASSIGNED = 'TASK_ASSIGNED',
  TASK_UPDATED = 'TASK_UPDATED',
  TASK_REVIEWED = 'TASK_REVIEWED',
  SESSION_COMPLETED = 'SESSION_COMPLETED',
  VERIFICATION_REQUIRED = 'VERIFICATION_REQUIRED',
  VERIFICATION_FAILED = 'VERIFICATION_FAILED',
  REPORT_FEEDBACK = 'REPORT_FEEDBACK',
  SYSTEM = 'SYSTEM',
}

// --- Audit Actions ---
export enum AuditAction {
  TASK_CREATED = 'TASK_CREATED',
  TASK_EDITED = 'TASK_EDITED',
  TASK_ASSIGNED = 'TASK_ASSIGNED',
  TASK_REASSIGNED = 'TASK_REASSIGNED',
  TASK_ARCHIVED = 'TASK_ARCHIVED',
  TASK_REVIEWED = 'TASK_REVIEWED',
  ATTENDANCE_MODIFIED = 'ATTENDANCE_MODIFIED',
  PERFORMANCE_UPDATED = 'PERFORMANCE_UPDATED',
  INTERN_STATUS_CHANGED = 'INTERN_STATUS_CHANGED',
  INTERN_CREATED = 'INTERN_CREATED',
  INTERN_EDITED = 'INTERN_EDITED',
  DESIGNATION_CHANGED = 'DESIGNATION_CHANGED',
  ADMIN_ACTION = 'ADMIN_ACTION',
}

// --- Session Constants ---
export const SESSION_CONSTANTS = {
  INTERVAL_SECONDS: 30,
  MAX_OFFICIAL_SECONDS: 28800, // 8 hours
  MAX_OFFICIAL_INTERVALS: 960, // 28800 / 30
  VERIFICATION_INTERVAL_MINUTES: 30,
  HEARTBEAT_TIMEOUT_SECONDS: 120, // 2 minutes without heartbeat = stale
} as const;

// --- API Constants ---
export const API_PREFIX = '/api/v1';

// --- Pagination ---
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;
