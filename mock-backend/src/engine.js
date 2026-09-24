/**
 * Session + verification-schedule logic, evaluated lazily on every request.
 * Time comes from the server clock only. Nothing here trusts the browser.
 *
 * Enforcement rule: a failed or expired presence check pauses the session (time stops
 * accruing, exactly like a break) and immediately opens a new check so the intern can
 * retry right away. Passing it resumes the session. Racking up too many failed checks in
 * one session marks it INCOMPLETE and ends it for the day - that time does not count
 * toward attendance. A failed check is never silently absorbed into "flag it and move on";
 * it either gets fixed by the intern within a few tries, or the session stops.
 */
import { randomUUID } from "node:crypto";

export function createStore() {
  return {
    sessions: new Map(), // internId -> session (one active/latest session per intern)
    checks: [], // every verification check, oldest first
    templates: new Map(), // internId -> encrypted face template (never sent to any client)
    registeredAt: new Map(),
  };
}

export function activeSeconds(session, now, targetSec) {
  const ms = session.accumulatedMs + (session.lastResumeAt === null ? 0 : now - session.lastResumeAt);
  return Math.min(Math.floor(ms / 1000), targetSec);
}

export const isOpen = (check) => !check.closed;

export function openCheck(store, internId) {
  return store.checks.findLast((c) => c.internId === internId && isOpen(c)) ?? null;
}

function closeCheck(check, status, now) {
  check.status = status;
  check.closed = true;
  check.closedAt = now;
}

/** Freezes the session clock, same mechanic as a manually-taken break. Idempotent. */
function freeze(session, now) {
  if (session.lastResumeAt !== null) {
    session.accumulatedMs += now - session.lastResumeAt;
    session.lastResumeAt = null;
  }
}

/**
 * Called whenever a check ends without a MATCH (exhausted attempts, or the response
 * window expired). Pauses the session and either schedules an immediate retry (LOCKED)
 * or, past the failure limit, ends the session for the day (INCOMPLETE).
 */
export function registerFailedCheck(session, config, now) {
  freeze(session, now);
  session.failedCheckCount += 1;
  if (session.failedCheckCount >= config.maxFailedChecks) {
    session.status = "INCOMPLETE";
    session.verificationStatus = "INCOMPLETE";
    session.completedAt = now;
  } else {
    session.status = "LOCKED";
    session.verificationStatus = "UNVERIFIED";
  }
}

/** Called on a MATCH. Resumes a locked session; a no-op on timing for a normal scheduled check. */
export function registerPassedCheck(session, config, now, active) {
  session.verificationStatus = "VERIFIED";
  session.lastVerifiedAt = now;
  session.nextDueActiveSec = active + config.intervalSec;
  if (session.status === "LOCKED") {
    session.status = "ACTIVE";
    session.lastResumeAt = now;
  }
}

/** Applies everything that should have happened by `now`: completion, expiry, new due checks. */
export function tick(store, config, internId, now) {
  const s = store.sessions.get(internId);
  if (!s) return null;

  if (s.status === "ACTIVE" && activeSeconds(s, now, config.targetSec) >= config.targetSec) {
    s.accumulatedMs = config.targetSec * 1000;
    s.lastResumeAt = null;
    s.status = "COMPLETED";
    s.completedAt = now;
  }

  const open = openCheck(store, internId);
  if (s.status === "COMPLETED" || s.status === "INCOMPLETE") {
    // Terminal states: no more checks, ever, for this session.
    if (open) closeCheck(open, "EXPIRED", now);
    return s;
  }

  if (open && now > open.expiresAt) {
    closeCheck(open, "EXPIRED", open.expiresAt);
    registerFailedCheck(s, config, open.expiresAt);
    if (s.status === "INCOMPLETE") return s;
  }

  const active = activeSeconds(s, now, config.targetSec);
  const stillOpen = openCheck(store, internId);
  const normallyDue = s.status === "ACTIVE" && active >= s.nextDueActiveSec;
  const lockedRetry = s.status === "LOCKED";
  if (config.attendanceSystemActive && !stillOpen && (normallyDue || lockedRetry)) {
    store.checks.push({
      verificationId: randomUUID(),
      internId,
      sessionId: s.sessionId,
      status: "PENDING",
      closed: false,
      requestedAt: now,
      expiresAt: now + config.windowSec * 1000,
      verifiedAt: null,
      closedAt: null,
      attemptsUsed: 0,
      lastReason: null,
      failedAttempts: 0,
    });
    s.verificationStatus = "PENDING";
  }
  return s;
}

export function nextCheckDueAt(session, config, now) {
  if (!session || session.status !== "ACTIVE" || !config.attendanceSystemActive) return null;
  const remaining = Math.max(0, session.nextDueActiveSec - activeSeconds(session, now, config.targetSec));
  return now + remaining * 1000;
}

export function startSession(store, config, internId, now) {
  const existing = store.sessions.get(internId);
  if (existing && existing.status !== "COMPLETED" && existing.status !== "INCOMPLETE") {
    return { error: "SESSION_ALREADY_ACTIVE" };
  }
  const session = {
    sessionId: randomUUID(),
    internId,
    status: "ACTIVE",
    startedAt: now,
    accumulatedMs: 0,
    lastResumeAt: now,
    breaks: [],
    nextDueActiveSec: config.intervalSec,
    verificationStatus: "NONE",
    lastVerifiedAt: null,
    failedCheckCount: 0,
  };
  store.sessions.set(internId, session);
  return { session };
}
