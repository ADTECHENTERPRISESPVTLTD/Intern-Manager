import assert from "node:assert/strict";
import http from "node:http";
import { after, before, beforeEach, describe, test } from "node:test";
import { createAiClient } from "../src/aiClient.js";
import { createApp } from "../src/app.js";
import { createClock, loadConfig } from "../src/config.js";

// ---- Fake face service ---------------------------------------------------------------------
function startFakeAi() {
  const fake = { decision: "MATCH", mode: "ok", delayMs: 0, registerError: null, calls: 0 };
  const server = http.createServer((req, res) => {
    req.resume();
    req.on("end", async () => {
      fake.calls += 1;
      if (fake.delayMs) await new Promise((r) => setTimeout(r, fake.delayMs));
      const send = (status, body) => {
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(body));
      };
      if (fake.mode === "down") return send(503, { error: "INTERNAL_ERROR" });
      if (req.url === "/v1/register") {
        return fake.registerError ? send(422, { error: fake.registerError, frameIndex: 1 }) : send(200, { template: "opaque-template" });
      }
      if (req.url === "/v1/verify") return send(200, { decision: fake.decision, confidence: 0.9 });
      send(404, {});
    });
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ fake, server, url: `http://127.0.0.1:${server.address().port}` })));
}

// ---- Harness -------------------------------------------------------------------------------
let fake, aiServer, server, base, clock, config;
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1]);

before(async () => {
  const ai = await startFakeAi();
  fake = ai.fake;
  aiServer = ai.server;
  config = loadConfig({
    FACE_VERIFICATION_URL: ai.url,
    FACE_VERIFICATION_KEY: "k",
    VERIFICATION_INTERVAL_SECONDS: "60",
    VERIFICATION_WINDOW_SECONDS: "30",
    VERIFICATION_MAX_ATTEMPTS: "3",
    SESSION_TARGET_SECONDS: "300",
    AI_TIMEOUT_MS: "1000",
  });
  clock = createClock();
  const app = createApp({ config, ai: createAiClient({ url: config.aiUrl, key: "k", timeoutMs: config.aiTimeoutMs }), clock });
  server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  aiServer.close();
});

async function call(method, path, { token, json, form } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(json ? { "Content-Type": "application/json" } : {}) },
    body: json ? JSON.stringify(json) : form,
  });
  return { status: res.status, body: await res.json() };
}

const login = async (email) => (await call("POST", "/api/v1/auth/login", { json: { email, password: "demo123" } })).body.data.token;

function frameForm(extra = {}, jpeg = JPEG) {
  const form = new FormData();
  form.append("frame", new Blob([jpeg], { type: "image/jpeg" }), "f.jpg");
  for (const [k, v] of Object.entries(extra)) form.append(k, v);
  return form;
}

const verify = (token, id, jpeg) => call("POST", "/api/v1/verifications/verify", { token, form: frameForm({ verificationId: id }, jpeg) });

async function register(token) {
  const form = new FormData();
  for (let i = 0; i < 3; i++) form.append("frames", new Blob([JPEG], { type: "image/jpeg" }), `f${i}.jpg`);
  return call("POST", "/api/v1/verifications/registration", { token, form });
}

let intern;
/** Fresh state, registered intern, active session, and a check that is due. */
async function dueCheck({ registered = true } = {}) {
  await call("POST", "/api/v1/dev/reset");
  Object.assign(fake, { decision: "MATCH", mode: "ok", delayMs: 0, registerError: null, calls: 0 });
  intern = await login("intern@demo.local");
  if (registered) await register(intern);
  await call("POST", "/api/v1/sessions/start", { token: intern });
  clock.advance(60);
  const status = await call("GET", "/api/v1/verifications/status", { token: intern });
  return status.body.data.current;
}

// ---- Tests ---------------------------------------------------------------------------------
describe("auth and roles", () => {
  test("verification endpoints need a login", async () => {
    assert.equal((await call("GET", "/api/v1/verifications/status")).status, 401);
  });

  test("an intern cannot use admin endpoints", async () => {
    const token = await login("intern@demo.local");
    const res = await call("GET", "/api/v1/admin/interns", { token });
    assert.equal(res.status, 403);
    assert.equal(res.body.code, "FORBIDDEN");
  });

  test("responses use the agreed envelope", async () => {
    const token = await login("intern@demo.local");
    const ok = await call("GET", "/api/v1/verifications/status", { token });
    assert.deepEqual(Object.keys(ok.body).sort(), ["data", "message", "success"]);
    const bad = await call("GET", "/nope");
    assert.deepEqual(bad.body, { success: false, message: "No such endpoint", code: "NOT_FOUND" });
  });

  test("status includes the server clock so the UI countdown ignores the intern's clock", async () => {
    const token = await login("intern@demo.local");
    const { serverTime } = (await call("GET", "/api/v1/verifications/status", { token })).body.data;
    assert.ok(Math.abs(Date.parse(serverTime) - clock.now()) < 5000);
  });
});

describe("scheduling", () => {
  test("nothing is due before the interval, then a check appears", async () => {
    await call("POST", "/api/v1/dev/reset");
    const token = await login("intern@demo.local");
    await call("POST", "/api/v1/sessions/start", { token });
    clock.advance(59);
    let s = (await call("GET", "/api/v1/verifications/status", { token })).body.data;
    assert.equal(s.verificationActive, true);
    assert.equal(s.verificationRequired, false);
    assert.equal(s.current, null);
    clock.advance(1);
    s = (await call("GET", "/api/v1/verifications/status", { token })).body.data;
    assert.equal(s.verificationRequired, true);
    assert.equal(s.current.status, "PENDING");
    assert.equal(s.current.maxAttempts, 3);
  });

  test("request is idempotent and 409s when nothing is due", async () => {
    await call("POST", "/api/v1/dev/reset");
    const token = await login("intern@demo.local");
    await call("POST", "/api/v1/sessions/start", { token });
    assert.equal((await call("POST", "/api/v1/verifications/request", { token })).body.code, "VERIFICATION_NOT_DUE");
    clock.advance(60);
    const a = await call("POST", "/api/v1/verifications/request", { token });
    const b = await call("POST", "/api/v1/verifications/request", { token });
    assert.equal(a.body.data.verificationId, b.body.data.verificationId);
  });

  test("the interval counts active time only: a break pauses it", async () => {
    await call("POST", "/api/v1/dev/reset");
    const token = await login("intern@demo.local");
    await call("POST", "/api/v1/sessions/start", { token });
    clock.advance(30);
    await call("POST", "/api/v1/sessions/break", { token });
    clock.advance(600);
    let s = (await call("GET", "/api/v1/verifications/status", { token })).body.data;
    assert.equal(s.current, null, "no check may appear during a break");
    await call("POST", "/api/v1/sessions/resume", { token });
    clock.advance(29);
    s = (await call("GET", "/api/v1/verifications/status", { token })).body.data;
    assert.equal(s.current, null, "only 59 active seconds so far");
    clock.advance(1);
    s = (await call("GET", "/api/v1/verifications/status", { token })).body.data;
    assert.equal(s.current.status, "PENDING");
  });

  test("attendanceSystemActive=false turns verification off", async () => {
    await call("POST", "/api/v1/dev/reset");
    config.attendanceSystemActive = false;
    try {
      const token = await login("intern@demo.local");
      await call("POST", "/api/v1/sessions/start", { token });
      clock.advance(120);
      const s = (await call("GET", "/api/v1/verifications/status", { token })).body.data;
      assert.equal(s.verificationActive, false);
      assert.equal(s.current, null);
      const session = (await call("GET", "/api/v1/sessions/current", { token })).body.data;
      assert.equal(session.officialAttendance, false);
    } finally {
      config.attendanceSystemActive = true;
    }
  });
});

describe("verifying", () => {
  beforeEach(() => {
    Object.assign(fake, { decision: "MATCH", mode: "ok", delayMs: 0 });
  });

  test("a match verifies the check and schedules the next one", async () => {
    const check = await dueCheck();
    const res = await verify(intern, check.verificationId);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, "VERIFIED");
    assert.equal(res.body.data.closed, true);
    assert.equal(res.body.data.reason, null);
    assert.ok(res.body.data.nextCheckDueAt);
    assert.equal("confidence" in res.body.data, false, "score is never sent to the browser");
    const s = (await call("GET", "/api/v1/verifications/status", { token: intern })).body.data;
    assert.equal(s.current, null);
    assert.equal(s.sessionVerificationStatus, "VERIFIED");
    assert.ok(s.lastVerifiedAt);
  });

  test("the next check comes one interval after a successful one", async () => {
    const check = await dueCheck();
    await verify(intern, check.verificationId);
    clock.advance(59);
    assert.equal((await call("GET", "/api/v1/verifications/status", { token: intern })).body.data.current, null);
    clock.advance(1);
    assert.equal((await call("GET", "/api/v1/verifications/status", { token: intern })).body.data.current.status, "PENDING");
  });

  for (const reason of ["NO_FACE", "MULTIPLE_FACES", "LOW_QUALITY", "NO_MATCH"]) {
    test(`${reason} fails the attempt but allows a retry`, async () => {
      const check = await dueCheck();
      fake.decision = reason;
      const res = await verify(intern, check.verificationId);
      assert.equal(res.body.data.status, "FAILED");
      assert.equal(res.body.data.reason, reason);
      assert.equal(res.body.data.attemptsRemaining, 2);
      assert.equal(res.body.data.closed, false);
      fake.decision = "MATCH";
      const retry = await verify(intern, check.verificationId);
      assert.equal(retry.body.data.status, "VERIFIED");
    });
  }

  test("three failures close the check and mark the session UNVERIFIED", async () => {
    const check = await dueCheck();
    fake.decision = "NO_MATCH";
    let res;
    for (let i = 0; i < 3; i++) res = await verify(intern, check.verificationId);
    assert.equal(res.body.data.status, "FAILED");
    assert.equal(res.body.data.attemptsRemaining, 0);
    assert.equal(res.body.data.closed, true);
    assert.equal(res.body.data.sessionVerificationStatus, "UNVERIFIED");
    const again = await verify(intern, check.verificationId);
    assert.equal(again.status, 409);
    assert.equal(again.body.code, "VERIFICATION_CLOSED");
  });

  test("an unanswered check expires as UNVERIFIED and cannot be answered late", async () => {
    const check = await dueCheck();
    clock.advance(31);
    const s = (await call("GET", "/api/v1/verifications/status", { token: intern })).body.data;
    assert.equal(s.current, null);
    assert.equal(s.sessionVerificationStatus, "UNVERIFIED");
    const late = await verify(intern, check.verificationId);
    assert.equal(late.status, 409);
    assert.equal(late.body.code, "VERIFICATION_EXPIRED");
    const history = (await call("GET", "/api/v1/verifications/history", { token: intern })).body.data;
    assert.equal(history.items[0].status, "EXPIRED");
  });

  test("an intern who never registered a face gets NOT_REGISTERED and keeps all attempts", async () => {
    const check = await dueCheck({ registered: false });
    const res = await verify(intern, check.verificationId);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.reason, "NOT_REGISTERED");
    assert.equal(res.body.data.attemptsRemaining, 3);
    assert.equal(fake.calls, 0, "face service must not be called without a template");
  });

  test("a broken face service is not counted against the intern", async () => {
    const check = await dueCheck();
    fake.mode = "down";
    const res = await verify(intern, check.verificationId);
    assert.equal(res.body.data.reason, "SERVICE_ERROR");
    assert.equal(res.body.data.attemptsRemaining, 3);
    assert.equal(res.body.data.closed, false);
    fake.mode = "ok";
    assert.equal((await verify(intern, check.verificationId)).body.data.status, "VERIFIED");
  });

  test("a double submit is rejected while the first is still running", async () => {
    const check = await dueCheck();
    fake.delayMs = 150;
    const [a, b] = await Promise.all([verify(intern, check.verificationId), verify(intern, check.verificationId)]);
    const codes = [a, b].map((r) => r.body.code ?? r.body.data.status).sort();
    assert.deepEqual(codes, ["VERIFICATION_IN_PROGRESS", "VERIFIED"]);
  });

  test("a non-JPEG upload is rejected and costs no attempt", async () => {
    const check = await dueCheck();
    const callsBefore = fake.calls; // setup already registered a face
    const res = await verify(intern, check.verificationId, Buffer.from("not a jpeg at all"));
    assert.equal(res.status, 400);
    assert.equal(res.body.code, "INVALID_FRAME");
    assert.equal(fake.calls, callsBefore, "the face service must not be called for a non-JPEG");
    const s = (await call("GET", "/api/v1/verifications/status", { token: intern })).body.data;
    assert.equal(s.current.attemptsUsed, 0);
  });

  test("an oversized frame is rejected with 413", async () => {
    const check = await dueCheck();
    const big = Buffer.concat([JPEG, Buffer.alloc(400 * 1024)]);
    const res = await verify(intern, check.verificationId, big);
    assert.equal(res.status, 413);
    assert.equal(res.body.code, "FRAME_TOO_LARGE");
  });

  test("another intern cannot answer someone else's check", async () => {
    const check = await dueCheck();
    const other = await login("intern2@demo.local");
    const res = await verify(other, check.verificationId);
    assert.equal(res.status, 404);
  });

  test("the browser cannot claim verified=true", async () => {
    const check = await dueCheck();
    fake.decision = "NO_MATCH";
    const res = await call("POST", "/api/v1/verifications/verify", {
      token: intern,
      form: frameForm({ verificationId: check.verificationId, verified: "true", status: "VERIFIED" }),
    });
    assert.equal(res.body.data.status, "FAILED");
  });
});

describe("registration", () => {
  test("registers and never returns the template", async () => {
    await call("POST", "/api/v1/dev/reset");
    const token = await login("intern@demo.local");
    assert.equal((await call("GET", "/api/v1/verifications/registration", { token })).body.data.registered, false);
    const res = await register(token);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data, { registered: true });
    assert.equal(JSON.stringify(res.body).includes("opaque-template"), false);
    assert.equal((await call("GET", "/api/v1/verifications/registration", { token })).body.data.registered, true);
  });

  test("a rejected registration photo comes back as 422 with the reason", async () => {
    await call("POST", "/api/v1/dev/reset");
    fake.registerError = "MULTIPLE_FACES";
    const token = await login("intern@demo.local");
    const res = await register(token);
    fake.registerError = null;
    assert.equal(res.status, 422);
    assert.equal(res.body.code, "MULTIPLE_FACES");
    assert.equal(res.body.frameIndex, 1);
  });

  test("fewer than 3 frames is a 400", async () => {
    const token = await login("intern@demo.local");
    const form = new FormData();
    form.append("frames", new Blob([JPEG], { type: "image/jpeg" }), "a.jpg");
    const res = await call("POST", "/api/v1/verifications/registration", { token, form });
    assert.equal(res.status, 400);
  });
});

describe("session completion and admin visibility", () => {
  test("after the official target: session COMPLETED, checks stop, platform still answers", async () => {
    const check = await dueCheck();
    await verify(intern, check.verificationId);
    clock.advance(400); // target is 300 active seconds
    const s = (await call("GET", "/api/v1/verifications/status", { token: intern })).body.data;
    assert.equal(s.verificationActive, false);
    assert.equal(s.current, null);
    const session = (await call("GET", "/api/v1/sessions/current", { token: intern })).body.data;
    assert.equal(session.status, "COMPLETED");
    assert.equal(session.activeSeconds, 300, "extra time must not add official seconds");
    assert.equal(session.completedIntervals, 10);
    clock.advance(600);
    assert.equal((await call("GET", "/api/v1/verifications/status", { token: intern })).body.data.current, null);
    assert.equal((await call("GET", "/api/v1/auth/me", { token: intern })).status, 200);
  });

  test("admin sees status, failed and unverified counts; interns only see their own history", async () => {
    const check = await dueCheck();
    fake.decision = "NO_FACE";
    await verify(intern, check.verificationId);
    clock.advance(31); // expires
    await call("GET", "/api/v1/verifications/status", { token: intern });

    const admin = await login("admin@demo.local");
    const list = (await call("GET", "/api/v1/admin/interns", { token: admin })).body.data;
    const row = list.find((i) => i.id === "intern-1");
    assert.equal(row.verification.status, "UNVERIFIED");
    assert.equal(row.verification.failedCount, 1);
    assert.equal(row.verification.unverifiedCount, 1);

    const asAdmin = await call("GET", "/api/v1/verifications/history?internId=intern-1", { token: admin });
    assert.equal(asAdmin.body.data.total, 1);
    const snoop = await call("GET", "/api/v1/verifications/history?internId=intern-1", { token: await login("intern2@demo.local") });
    assert.equal(snoop.status, 403);
  });

  test("a second session cannot start while one is active", async () => {
    await call("POST", "/api/v1/dev/reset");
    const token = await login("intern@demo.local");
    assert.equal((await call("POST", "/api/v1/sessions/start", { token })).status, 200);
    const again = await call("POST", "/api/v1/sessions/start", { token });
    assert.equal(again.status, 409);
    assert.equal(again.body.code, "SESSION_ALREADY_ACTIVE");
  });
});
