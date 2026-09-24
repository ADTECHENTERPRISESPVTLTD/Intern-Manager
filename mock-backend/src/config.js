const num = (value, fallback) => {
  const n = Number(value);
  return value !== undefined && value !== "" && Number.isFinite(n) ? n : fallback;
};

export function loadConfig(env = process.env) {
  return {
    port: num(env.PORT, 4000),
    // Stays localhost-only by default (safest). Set HOST=0.0.0.0 to test from another device
    // on the same network, e.g. a real phone.
    host: env.HOST ?? "127.0.0.1",
    corsOrigins: (env.CORS_ORIGIN ?? "http://localhost:5173,http://localhost:3000")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    aiUrl: (env.FACE_VERIFICATION_URL ?? "http://127.0.0.1:5001").replace(/\/$/, ""),
    aiKey: env.FACE_VERIFICATION_KEY ?? "",
    aiTimeoutMs: num(env.AI_TIMEOUT_MS, 5000),
    intervalSec: num(env.VERIFICATION_INTERVAL_SECONDS, 30 * 60),
    windowSec: num(env.VERIFICATION_WINDOW_SECONDS, 5 * 60),
    maxAttempts: num(env.VERIFICATION_MAX_ATTEMPTS, 3),
    // After this many failed/expired checks in one session, the session ends as INCOMPLETE
    // instead of pausing again - it stops counting toward attendance for the day.
    maxFailedChecks: num(env.VERIFICATION_MAX_FAILED_CHECKS, 3),
    targetSec: num(env.SESSION_TARGET_SECONDS, 8 * 60 * 60),
    attendanceSystemActive: env.ATTENDANCE_SYSTEM_ACTIVE !== "false",
    devRoutes: env.MOCK_DEV_ROUTES !== "false",
    maxFrameBytes: 300 * 1024,
  };
}

/** Clock with an offset, so the demo (and tests) can fast-forward time. */
export function createClock() {
  const clock = {
    offsetMs: 0,
    now: () => Date.now() + clock.offsetMs,
    advance: (seconds) => {
      clock.offsetMs += seconds * 1000;
    },
    reset: () => {
      clock.offsetMs = 0;
    },
  };
  return clock;
}
