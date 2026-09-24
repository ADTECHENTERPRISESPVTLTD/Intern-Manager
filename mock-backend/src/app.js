import { randomUUID } from "node:crypto";
import express from "express";
import multer from "multer";
import { AiRegistrationRejected, AiRejectedFrame, AiUnavailable } from "./aiClient.js";
import { createRateLimiter } from "./rateLimit.js";
import {
  activeSeconds,
  createStore,
  nextCheckDueAt,
  openCheck,
  registerFailedCheck,
  registerPassedCheck,
  startSession,
  tick,
} from "./engine.js";

// Demo accounts. Obviously fake: this whole folder is a throwaway mock.
const USERS = [
  { id: "intern-1", role: "INTERN", name: "Demo Intern", email: "intern@demo.local", designation: "Frontend Intern" },
  { id: "intern-2", role: "INTERN", name: "Second Intern", email: "intern2@demo.local", designation: "Backend Intern" },
  { id: "admin-1", role: "ADMIN", name: "Demo Admin", email: "admin@demo.local", designation: "Administrator" },
];
const DEMO_PASSWORD = "demo123";

const iso = (ms) => (ms == null ? null : new Date(ms).toISOString());
const isJpeg = (buf) => buf?.length > 2 && buf[0] === 0xff && buf[1] === 0xd8;

const ok = (res, data, message = "OK") => res.json({ success: true, data, message });
const fail = (res, status, code, message) => res.status(status).json({ success: false, message, code });

export function createApp({ config, ai, clock }) {
  const store = createStore();
  const tokens = new Map(); // bearer token -> user
  // 5 attempts per email per minute. Keeps a brute-force script from hammering the login
  // endpoint; a real person mistyping their password a couple of times is unaffected.
  const loginLimiter = createRateLimiter({ limit: 5, windowMs: 60_000 });
  const app = express();
  app.disable("x-powered-by");

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.maxFrameBytes, files: 5, fields: 10, fieldSize: 4096 },
  });

  // ---- CORS -------------------------------------------------------------------------------
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && config.corsOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    }
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });
  app.use(express.json({ limit: "10kb" }));

  // ---- Auth -------------------------------------------------------------------------------
  const auth = (...roles) => (req, res, next) => {
    const header = req.headers.authorization ?? "";
    const user = header.startsWith("Bearer ") ? tokens.get(header.slice(7)) : null;
    if (!user) return fail(res, 401, "UNAUTHORIZED", "Please log in again");
    if (roles.length && !roles.includes(user.role)) return fail(res, 403, "FORBIDDEN", "You do not have access to this");
    req.user = user;
    next();
  };

  const publicUser = ({ id, role, name, email, designation }) => ({ id, role, name, email, designation });

  app.post("/api/v1/auth/login", (req, res) => {
    const { email, password } = req.body ?? {};
    const key = String(email ?? "").toLowerCase();
    const limit = loginLimiter.hit(key);
    if (!limit.allowed) {
      res.setHeader("Retry-After", String(limit.retryAfterSeconds));
      return fail(res, 429, "TOO_MANY_ATTEMPTS", "Too many login attempts. Please wait a moment and try again.");
    }
    const user = USERS.find((u) => u.email === email);
    if (!user || password !== DEMO_PASSWORD) return fail(res, 401, "INVALID_CREDENTIALS", "Incorrect email or password");
    loginLimiter.reset(key);
    const token = randomUUID();
    tokens.set(token, user);
    ok(res, { token, user: publicUser(user) }, "Logged in");
  });

  app.get("/api/v1/auth/me", auth(), (req, res) => ok(res, publicUser(req.user)));

  // ---- Views ------------------------------------------------------------------------------
  const checkView = (c) => ({
    verificationId: c.verificationId,
    status: c.status,
    requestedAt: iso(c.requestedAt),
    expiresAt: iso(c.expiresAt),
    attemptsUsed: c.attemptsUsed,
    maxAttempts: config.maxAttempts,
  });

  function sessionView(s, now) {
    if (!s) return null;
    const active = activeSeconds(s, now, config.targetSec);
    const interval = 30;
    return {
      sessionId: s.sessionId,
      status: s.status,
      startedAt: iso(s.startedAt),
      activeSeconds: active,
      targetSeconds: config.targetSec,
      completedIntervals: Math.min(Math.floor(active / interval), config.targetSec / interval),
      totalIntervals: config.targetSec / interval,
      officialAttendance: config.attendanceSystemActive,
      failedCheckCount: s.failedCheckCount,
      maxFailedChecks: config.maxFailedChecks,
    };
  }

  function statusView(internId, now) {
    const s = tick(store, config, internId, now);
    const current = s ? openCheck(store, internId) : null;
    return {
      sessionId: s?.sessionId ?? null,
      verificationActive: Boolean(s) && config.attendanceSystemActive && s.status !== "COMPLETED",
      verificationRequired: current !== null,
      current: current ? checkView(current) : null,
      lastVerifiedAt: iso(s?.lastVerifiedAt),
      nextCheckDueAt: iso(nextCheckDueAt(s, config, now)),
      sessionVerificationStatus: s?.verificationStatus ?? "NONE",
      // Lets the UI's countdown follow the server clock, not the intern's computer clock.
      serverTime: iso(now),
    };
  }

  // ---- Sessions (minimal, so the verification flow can be demoed) --------------------------
  app.post("/api/v1/sessions/start", auth("INTERN"), (req, res) => {
    const { session, error } = startSession(store, config, req.user.id, clock.now());
    if (error) return fail(res, 409, error, "A work session is already active");
    ok(res, sessionView(session, clock.now()), "Work session started");
  });

  app.get("/api/v1/sessions/current", auth("INTERN"), (req, res) => {
    const now = clock.now();
    const s = tick(store, config, req.user.id, now);
    ok(res, sessionView(s, now));
  });

  app.post("/api/v1/sessions/break", auth("INTERN"), (req, res) => {
    const now = clock.now();
    const s = tick(store, config, req.user.id, now);
    if (!s || s.status !== "ACTIVE") return fail(res, 409, "SESSION_NOT_ACTIVE", "No active session to pause");
    s.accumulatedMs += now - s.lastResumeAt;
    s.lastResumeAt = null;
    s.status = "BREAK";
    s.breaks.push({ startedAt: now, endedAt: null });
    ok(res, sessionView(s, now), "Break started");
  });

  app.post("/api/v1/sessions/resume", auth("INTERN"), (req, res) => {
    const now = clock.now();
    const s = tick(store, config, req.user.id, now);
    if (!s || s.status !== "BREAK") return fail(res, 409, "SESSION_NOT_ON_BREAK", "Session is not on a break");
    s.lastResumeAt = now;
    s.status = "ACTIVE";
    s.breaks.at(-1).endedAt = now;
    ok(res, sessionView(s, now), "Work session resumed");
  });

  // ---- Verifications ----------------------------------------------------------------------
  app.get("/api/v1/verifications/status", auth("INTERN"), (req, res) => {
    ok(res, statusView(req.user.id, clock.now()));
  });

  app.post("/api/v1/verifications/request", auth("INTERN"), (req, res) => {
    const now = clock.now();
    const view = statusView(req.user.id, now);
    if (!view.current) return fail(res, 409, "VERIFICATION_NOT_DUE", "No presence check is due right now");
    ok(res, view.current, "Verification ready");
  });

  app.post("/api/v1/verifications/verify", auth("INTERN"), upload.single("frame"), async (req, res) => {
    const now = clock.now();
    const internId = req.user.id;
    const session = tick(store, config, internId, now);
    const check = store.checks.find((c) => c.verificationId === req.body?.verificationId && c.internId === internId);

    if (!check) return fail(res, 404, "VERIFICATION_NOT_FOUND", "Verification not found");
    if (check.closed) {
      const code = check.status === "EXPIRED" ? "VERIFICATION_EXPIRED" : "VERIFICATION_CLOSED";
      return fail(res, 409, code, "This presence check is no longer open");
    }
    // No `await` between this test and setting VERIFYING below, so a double-click cannot slip through.
    if (check.status === "VERIFYING") return fail(res, 409, "VERIFICATION_IN_PROGRESS", "Verification already in progress");
    if (!req.file || !isJpeg(req.file.buffer)) return fail(res, 400, "INVALID_FRAME", "Send one JPEG camera frame");

    const template = store.templates.get(internId);
    const result = (extra = {}) => ({
      verificationId: check.verificationId,
      status: check.status,
      reason: check.lastReason,
      attemptsRemaining: Math.max(config.maxAttempts - check.attemptsUsed, 0),
      closed: check.closed,
      nextCheckDueAt: check.closed ? iso(nextCheckDueAt(session, config, now)) : null,
      sessionVerificationStatus: session.verificationStatus,
      ...extra,
    });

    if (!template) return ok(res, result({ reason: "NOT_REGISTERED" }), "Face registration required");

    const previous = check.status;
    check.status = "VERIFYING";
    let outcome;
    try {
      outcome = await ai.verify(req.file.buffer, template);
    } catch (err) {
      check.status = previous;
      if (err instanceof AiRejectedFrame) return fail(res, 400, "INVALID_FRAME", "Camera frame could not be read");
      // A broken face service is not the intern's fault: the attempt is not consumed.
      return ok(res, result({ reason: "SERVICE_ERROR" }), "Verification unavailable, try again");
    }
    if (check.closed) return fail(res, 409, "VERIFICATION_CLOSED", "This presence check is no longer open");

    check.attemptsUsed += 1;
    const active = activeSeconds(session, now, config.targetSec);
    if (outcome.decision === "MATCH") {
      check.status = "VERIFIED";
      check.closed = true;
      check.closedAt = now;
      check.verifiedAt = now;
      check.lastReason = null;
      registerPassedCheck(session, config, now, active);
      return ok(res, result({ sessionStatus: session.status }), "Presence verified");
    }

    check.status = "FAILED";
    check.failedAttempts += 1;
    check.lastReason = outcome.decision; // NO_MATCH | NO_FACE | MULTIPLE_FACES | LOW_QUALITY
    if (check.attemptsUsed >= config.maxAttempts) {
      check.closed = true;
      check.closedAt = now;
      registerFailedCheck(session, config, now);
    }
    ok(res, result({ sessionStatus: session.status }), "Verification failed");
  });

  app.get("/api/v1/verifications/history", auth("INTERN", "ADMIN"), (req, res) => {
    const internId = req.query.internId ?? req.user.id;
    if (req.user.role === "INTERN" && internId !== req.user.id) return fail(res, 403, "FORBIDDEN", "You do not have access to this");
    const page = Math.max(Number.parseInt(req.query.page ?? "1", 10) || 1, 1);
    const pageSize = 20;
    const all = store.checks
      .filter((c) => c.internId === internId)
      .toReversed()
      .map((c) => ({
        verificationId: c.verificationId,
        sessionId: c.sessionId,
        requestedAt: iso(c.requestedAt),
        verifiedAt: iso(c.verifiedAt),
        status: c.status,
        reason: c.status === "VERIFIED" ? null : c.lastReason,
        attempts: c.attemptsUsed,
      }));
    ok(res, { items: all.slice((page - 1) * pageSize, page * pageSize), page, total: all.length });
  });

  // ---- Face registration ------------------------------------------------------------------
  app.post("/api/v1/verifications/registration", auth("INTERN", "ADMIN"), upload.array("frames", 5), async (req, res) => {
    const internId = req.user.role === "ADMIN" ? req.body?.internId : req.user.id;
    if (!USERS.some((u) => u.id === internId && u.role === "INTERN")) return fail(res, 400, "INVALID_REQUEST", "Unknown intern");
    const frames = (req.files ?? []).map((f) => f.buffer);
    if (frames.length < 3 || frames.length > 5) return fail(res, 400, "INVALID_REQUEST", "Send between 3 and 5 frames");
    if (!frames.every(isJpeg)) return fail(res, 400, "INVALID_FRAME", "Every frame must be a JPEG");

    try {
      const template = await ai.register(frames);
      store.templates.set(internId, template);
      store.registeredAt.set(internId, clock.now());
      ok(res, { registered: true }, "Face registered");
    } catch (err) {
      if (err instanceof AiRegistrationRejected) {
        return res.status(422).json({ success: false, message: "Registration photo rejected", code: err.reason, frameIndex: err.frameIndex });
      }
      if (err instanceof AiRejectedFrame) return fail(res, 400, "INVALID_FRAME", "A frame could not be read");
      fail(res, 503, "SERVICE_ERROR", "Face service unavailable, try again");
    }
  });

  app.get("/api/v1/verifications/registration", auth("INTERN"), (req, res) => {
    ok(res, { registered: store.templates.has(req.user.id), registeredAt: iso(store.registeredAt.get(req.user.id)) });
  });

  // ---- Admin ------------------------------------------------------------------------------
  app.get("/api/v1/admin/interns", auth("ADMIN"), (req, res) => {
    const now = clock.now();
    const interns = USERS.filter((u) => u.role === "INTERN").map((u) => {
      const view = statusView(u.id, now);
      const checks = store.checks.filter((c) => c.internId === u.id);
      return {
        ...publicUser(u),
        session: sessionView(store.sessions.get(u.id), now),
        verification: {
          status: view.sessionVerificationStatus,
          lastVerifiedAt: view.lastVerifiedAt,
          nextCheckDueAt: view.nextCheckDueAt,
          failedCount: checks.reduce((n, c) => n + c.failedAttempts, 0),
          unverifiedCount: checks.filter((c) => c.closed && c.status !== "VERIFIED").length,
        },
      };
    });
    ok(res, interns);
  });

  // ---- Dev helpers (demo only) --------------------------------------------------------------
  // Auth-gated even in the mock: this state (sessions, registered faces) is now reachable over
  // the LAN for real-device testing, so an unauthenticated reset/clock-jump is a real DoS against
  // whoever is mid-demo, not just a local convenience.
  if (config.devRoutes) {
    app.post("/api/v1/dev/advance", auth(), (req, res) => {
      const seconds = Number(req.body?.seconds);
      if (!Number.isFinite(seconds) || seconds < 0 || seconds > 86400) return fail(res, 400, "INVALID_REQUEST", "seconds must be 0 to 86400");
      clock.advance(seconds);
      ok(res, { now: iso(clock.now()) }, "Clock advanced");
    });
    app.post("/api/v1/dev/reset", auth(), (req, res) => {
      store.sessions.clear();
      store.checks.length = 0;
      store.templates.clear();
      store.registeredAt.clear();
      clock.reset();
      ok(res, {}, "Mock state reset");
    });
  }

  app.get("/health", (req, res) => ok(res, { mock: true }));

  // ---- Errors: always the standard envelope, never stack traces ---------------------------
  app.use((req, res) => fail(res, 404, "NOT_FOUND", "No such endpoint"));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") return fail(res, 413, "FRAME_TOO_LARGE", "Camera frame is too large");
      return fail(res, 400, "INVALID_REQUEST", "Invalid upload");
    }
    if (err?.type === "entity.parse.failed" || err?.type === "entity.too.large") return fail(res, 400, "INVALID_REQUEST", "Invalid request body");
    console.error("unhandled error:", err?.name);
    fail(res, 500, "INTERNAL_ERROR", "Something went wrong");
  });

  return app;
}
