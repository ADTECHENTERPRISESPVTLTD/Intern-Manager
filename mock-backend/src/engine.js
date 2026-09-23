/**
 * Session + verification-schedule logic, evaluated lazily on every request.
 * Time comes from the server clock only. Nothing here trusts the browser.
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
  if (s.status === "COMPLETED") {
    // Verification stops once the official 8 hours are done.
    if (open) closeCheck(open, "EXPIRED", now);
    return s;
  }

  const active = activeSeconds(s, now, config.targetSec);
  if (open && now > open.expiresAt) {
    closeCheck(open, "EXPIRED", open.expiresAt);
    s.verificationStatus = "UNVERIFIED";
    s.nextDueActiveSec = active + config.intervalSec;
  }

  const stillOpen = openCheck(store, internId);
  if (config.attendanceSystemActive && s.status === "ACTIVE" && !stillOpen && active >= s.nextDueActiveSec) {
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
  if (existing && existing.status !== "COMPLETED") return { error: "SESSION_ALREADY_ACTIVE" };
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
  };
  store.sessions.set(internId, session);
  return { session };
}
