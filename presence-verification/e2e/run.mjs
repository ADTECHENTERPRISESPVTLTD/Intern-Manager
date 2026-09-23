/**
 * Real-browser tests: drive the demo page in Chrome or Edge with a FAKE camera (a video file
 * played as if it were a webcam), against the real face service and the mock backend.
 *
 *   npm run e2e                          all scenarios in Chrome
 *   npm run e2e -- --browser edge        Edge
 *   npm run e2e -- verify noface         only these scenarios
 *
 * Needs the three servers running (scripts/start-demo.ps1) with the demo timings:
 * interval 30 s, window 120 s, 3 attempts, 8 h target.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, firefox } from "playwright-core";

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, ".fixtures");
const shots = join(here, "shots");
const API = process.env.API_URL ?? "http://127.0.0.1:4000/api/v1";
const APP = process.env.APP_URL ?? "http://localhost:5173/";

// ---- CLI --------------------------------------------------------------------------------
const args = process.argv.slice(2);
const bi = args.indexOf("--browser");
const browserName = bi >= 0 ? args.splice(bi, 2)[1] : "chrome";
const BROWSERS = {
  chrome: process.env.CHROME_PATH ?? (process.platform === "win32" ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" : "/usr/bin/google-chrome"),
  edge: process.env.EDGE_PATH ?? (process.platform === "win32" ? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" : "/usr/bin/microsoft-edge"),
};
const IS_FIREFOX = browserName === "firefox"; // uses Playwright's own Firefox build: run `npx playwright-core install firefox` once
if (!IS_FIREFOX && !BROWSERS[browserName]) throw new Error(`--browser must be one of: chrome, edge, firefox`);
if (!IS_FIREFOX && !existsSync(BROWSERS[browserName])) throw new Error(`${browserName} not found at ${BROWSERS[browserName]} (set CHROME_PATH / EDGE_PATH)`);
// Firefox's fake camera is a fixed test pattern: it cannot play our face video, so these two need a real face (test by hand).
const NEEDS_REAL_FACE = new Set(["verify", "two"]);

// ---- Fixtures ---------------------------------------------------------------------------
if (!existsSync(join(fixtures, "cam_lena.y4m"))) {
  const venvPython = resolve(here, "../../ai-service/.venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
  const r = spawnSync(venvPython, [join(here, "make-fixtures.py")], { stdio: "inherit" });
  if (r.status !== 0) throw new Error("could not build fixtures (is ai-service/.venv set up?)");
}
mkdirSync(shots, { recursive: true });

// ---- Helpers ----------------------------------------------------------------------------
async function api(method, path, { token, json, form } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(json ? { "Content-Type": "application/json" } : {}) },
    body: json ? JSON.stringify(json) : form,
  });
  return res.json();
}
const internToken = async () => (await api("POST", "/auth/login", { json: { email: "intern@demo.local", password: "demo123" } })).data.token;

async function registerViaApi() {
  const form = new FormData();
  for (const n of ["lena1.jpg", "lena2.jpg", "lena3.jpg"]) form.append("frames", new Blob([readFileSync(join(fixtures, n))], { type: "image/jpeg" }), n);
  const r = await api("POST", "/verifications/registration", { token: await internToken(), form });
  if (!r.success) throw new Error("API registration failed: " + JSON.stringify(r));
}

const results = [];
function check(scenario, name, ok, detail = "") {
  results.push({ scenario, name, ok });
  console.log(`   ${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  (" + detail + ")" : ""}`);
}

const T = { timeout: 20000 };
const heading = (page, name) => page.getByRole("heading", { name, exact: true });
const btn = (page, name) => page.getByRole("button", { name, exact: true });

async function launch({ video = "cam_lena.y4m", fakeCamera = true, autoAllow = true, denyPrompts = false, simulateCameraError = null } = {}) {
  let browser;
  if (IS_FIREFOX) {
    // Firefox's built-in fake camera shows a test pattern (no face). A real permission denial cannot be
    // produced headlessly, so the denied case is simulated (see scenarios.denied).
    browser = await firefox.launch({
      headless: true,
      firefoxUserPrefs: { "media.navigator.streams.fake": true, "media.navigator.permission.disabled": true },
    });
  } else {
    const flags = [];
    if (fakeCamera) flags.push("--use-fake-device-for-media-stream", `--use-file-for-fake-video-capture=${join(fixtures, video)}`);
    if (autoAllow) flags.push("--use-fake-ui-for-media-stream");
    if (denyPrompts) flags.push("--deny-permission-prompts");
    browser = await chromium.launch({ executablePath: BROWSERS[browserName], headless: true, args: flags });
  }
  const page = await (await browser.newContext({ viewport: { width: 1000, height: 800 } })).newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  // Remember every camera stream the page opens so we can prove they were all released.
  // Chrome invents a fake camera even when none is configured, so "no camera" / "camera in use"
  // cannot be produced with launch flags. For those two cases the browser is made to report the
  // same DOMException a real browser would (labelled "simulated" in the output).
  await page.addInitScript((simulated) => {
    window.__streams = [];
    const md = navigator.mediaDevices;
    if (!md) return;
    const orig = md.getUserMedia.bind(md);
    md.getUserMedia = async (c) => {
      if (simulated) throw new DOMException("simulated", simulated);
      const s = await orig(c);
      window.__streams.push(s);
      return s;
    };
  }, simulateCameraError);
  return { browser, page, errors };
}

const shot = (page, scenario, name) => page.screenshot({ path: join(shots, `${browserName}-${scenario}-${name}.png`) });
const cameraReleased = (page) => page.evaluate(() => window.__streams.length > 0 && window.__streams.every((s) => s.getTracks().every((t) => t.readyState === "ended")));
const cameraLive = (page) => page.evaluate(() => window.__streams.at(-1)?.getTracks().some((t) => t.readyState === "live") ?? false);
const storageEmpty = (page) => page.evaluate(() => localStorage.length === 0 && sessionStorage.length === 0);

async function login(page) {
  await page.goto(APP);
  await btn(page, "Log in").click();
  await page.getByRole("heading", { name: /Good Morning, Demo Intern/ }).waitFor(T);
}
async function startSessionAndWaitForPopup(page) {
  await btn(page, "Start Official Work Session").click();
  await btn(page, "Skip ahead 30 s").click();
  await page.getByRole("dialog", { name: "Presence Verification Required" }).waitFor(T);
}
async function openCamera(page) {
  await btn(page, "Verify Presence").click();
  await btn(page, "Verify Now").waitFor(T);
  await page.waitForFunction(() => { const v = document.querySelector(".pv-video"); return v && v.videoWidth > 0; }, null, T);
  await page.waitForFunction(() => !document.querySelector(".pv-stage__overlay"), null, T);
  await page.waitForFunction(() => !document.querySelector(".pv-panel button[disabled]"), null, T);
}
const dialogText = (page) => page.evaluate(() => document.querySelector('[role="dialog"]')?.innerText.replace(/\s+/g, " ") ?? "");

// ---- Scenarios (they mirror the test table in the AI task document, section 30) --------------
const scenarios = {
  // Successful verification: register through the UI, popup appears by itself, verify, camera released.
  async verify() {
    const { browser, page, errors } = await launch();
    try {
      await login(page);
      await btn(page, "Start Camera").click();
      for (const n of [1, 2, 3]) {
        await heading(page, `Photo ${n} of 3`).waitFor(T);
        await page.waitForFunction(() => { const v = document.querySelector("video"); return v && v.videoWidth > 0; }, null, T);
        await page.waitForFunction(() => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent === "Capture Photo"); return b && !b.disabled; }, null, T);
        await btn(page, "Capture Photo").click();
      }
      await heading(page, "Face Registered").waitFor(T);
      check("verify", "face registration through the UI works", true);
      await startSessionAndWaitForPopup(page);
      check("verify", "popup opened by itself when the check became due", true);
      await shot(page, "verify", "1-popup-due");
      check("verify", "camera is OFF until the intern clicks Verify Presence", !(await page.evaluate(() => window.__streams.length > 1)));
      await openCamera(page);
      check("verify", "camera is live while positioning", await cameraLive(page));
      await shot(page, "verify", "2-camera");
      await page.setViewportSize({ width: 320, height: 640 });
      const m = await page.evaluate(() => { const p = document.querySelector(".pv-panel").getBoundingClientRect(); return { over: document.documentElement.scrollWidth > innerWidth, l: p.left, r: p.right, w: innerWidth }; });
      check("verify", "fits a 320px phone screen with no sideways scroll", !m.over && m.l >= 0 && m.r <= m.w, JSON.stringify(m));
      await shot(page, "verify", "3-mobile-320");
      await page.setViewportSize({ width: 1000, height: 800 });
      await btn(page, "Verify Now").click();
      await heading(page, "Presence Verified").waitFor(T);
      check("verify", "shows 'Presence Verified'", true);
      await shot(page, "verify", "4-verified");
      check("verify", "camera fully released afterwards", await cameraReleased(page));
      check("verify", "nothing written to localStorage/sessionStorage", await storageEmpty(page));
      check("verify", "no console errors", errors.length === 0, errors.join(" | "));
    } finally { await browser.close(); }
  },

  // Failed verification / no face: empty camera view.
  async noface() {
    await registerViaApi();
    const { browser, page } = await launch({ video: "cam_blank.y4m" });
    try {
      await login(page);
      await startSessionAndWaitForPopup(page);
      await openCamera(page);
      await btn(page, "Verify Now").click();
      await heading(page, "No Face Detected").waitFor(T);
      const t = await dialogText(page);
      check("noface", "shows 'No Face Detected' and how to fix it", t.includes("position your face inside the camera frame"));
      check("noface", "shows 2 attempts remaining and Try Again", t.includes("2 attempts remaining") && t.includes("Try Again"));
      check("noface", "camera released", await cameraReleased(page));
      await shot(page, "noface", "1-no-face");
    } finally { await browser.close(); }
  },

  // Multiple faces are rejected.
  async two() {
    await registerViaApi();
    const { browser, page } = await launch({ video: "cam_two.y4m" });
    try {
      await login(page);
      await startSessionAndWaitForPopup(page);
      await openCamera(page);
      await btn(page, "Verify Now").click();
      await heading(page, "Multiple Faces Detected").waitFor(T);
      check("two", "shows 'Multiple Faces Detected'", (await dialogText(page)).includes("Only the registered intern should be visible"));
      check("two", "camera released", await cameraReleased(page));
      await shot(page, "two", "1-multiple-faces");
    } finally { await browser.close(); }
  },

  // Three failures close the check: Presence Unverified, no more retries, dashboard label changes.
  async exhaust() {
    await registerViaApi();
    const { browser, page } = await launch({ video: "cam_blank.y4m" });
    try {
      await login(page);
      await startSessionAndWaitForPopup(page);
      for (let i = 0; i < 3; i++) {
        if (i > 0) await btn(page, "Try Again").click();
        await openCameraOrRetry(page, i);
        await btn(page, "Verify Now").click();
        if (i < 2) await heading(page, "No Face Detected").waitFor(T);
      }
      await heading(page, "Presence Unverified").waitFor(T);
      const t = await dialogText(page);
      check("exhaust", "after 3 failed tries shows 'Presence Unverified'", true);
      check("exhaust", "no Try Again button is offered any more", !t.includes("Try Again"));
      await btn(page, "Close").click();
      await page.getByText("Presence Unverified").first().waitFor(T);
      check("exhaust", "dashboard label changes to 'Presence Unverified'", true);
      check("exhaust", "camera released after every attempt", await cameraReleased(page));
      await shot(page, "exhaust", "1-unverified");
    } finally { await browser.close(); }
    async function openCameraOrRetry(p) {
      await p.getByRole("button", { name: "Verify Now" }).or(p.getByRole("button", { name: "Verify Presence" })).first().waitFor(T);
      if (await p.getByRole("button", { name: "Verify Presence" }).count()) await btn(p, "Verify Presence").click();
      await btn(p, "Verify Now").waitFor(T);
      await p.waitForFunction(() => { const v = document.querySelector(".pv-video"); return v && v.videoWidth > 0; }, null, T);
      await p.waitForFunction(() => !document.querySelector(".pv-panel button[disabled]"), null, T);
    }
  },

  // Camera denied.
  async denied() {
    await registerViaApi();
    const tag = IS_FIREFOX ? "[simulated] " : "";
    const { browser, page } = await launch({ autoAllow: false, denyPrompts: true, simulateCameraError: IS_FIREFOX ? "NotAllowedError" : null });
    try {
      await login(page);
      await startSessionAndWaitForPopup(page);
      await btn(page, "Verify Presence").click();
      await heading(page, "Camera Access Required").waitFor(T);
      const t = await dialogText(page);
      check("denied", `${tag}shows 'Camera Access Required' with instructions`, t.includes("allow camera access"));
      check("denied", `${tag}says it does not count as a failed attempt`, t.includes("does not count as a failed attempt"));
      await shot(page, "denied", "1-camera-denied");
      await btn(page, "Cancel").click();
      const status = await api("GET", "/verifications/status", { token: await internToken() });
      check("denied", "backend still shows 0 attempts used", status.data.current?.attemptsUsed === 0, `attemptsUsed=${status.data.current?.attemptsUsed}`);
    } finally { await browser.close(); }
  },

  // No camera connected (simulated: the browser reports NotFoundError).
  async nocamera() {
    await registerViaApi();
    const { browser, page } = await launch({ simulateCameraError: "NotFoundError" });
    try {
      await login(page);
      await startSessionAndWaitForPopup(page);
      await btn(page, "Verify Presence").click();
      await heading(page, "No Camera Found").waitFor(T);
      check("nocamera", "[simulated] shows 'No Camera Found' instead of a blank screen", true);
      check("nocamera", "[simulated] intern can retry", (await page.getByRole("button", { name: "Try Again" }).count()) === 1);
      await shot(page, "nocamera", "1-no-camera");
    } finally { await browser.close(); }
  },

  // Camera busy in another app (simulated: the browser reports NotReadableError).
  async inuse() {
    await registerViaApi();
    const { browser, page } = await launch({ simulateCameraError: "NotReadableError" });
    try {
      await login(page);
      await startSessionAndWaitForPopup(page);
      await btn(page, "Verify Presence").click();
      await heading(page, "Camera Unavailable").waitFor(T);
      check("inuse", "[simulated] shows 'Camera Unavailable' with advice to close other apps", (await dialogText(page)).includes("in use by another app"));
      await shot(page, "inuse", "1-camera-in-use");
    } finally { await browser.close(); }
  },

  // Phone-width layout (320 px, the smallest the task requires): every popup state must fit, with no sideways scroll.
  async mobile() {
    await registerViaApi();
    const { browser, page } = await launch({ video: "cam_blank.y4m" });
    try {
      await page.setViewportSize({ width: 320, height: 640 });
      await login(page);
      const fits = async (label) => {
        const m = await page.evaluate(() => {
          const els = [...document.querySelectorAll(".pv-panel, .pv-banner")].map((e) => e.getBoundingClientRect());
          return { over: document.documentElement.scrollWidth > innerWidth, inside: els.length > 0 && els.every((r) => r.left >= 0 && r.right <= innerWidth), w: innerWidth };
        });
        check("mobile", `${label} fits 320px with no sideways scroll`, !m.over && m.inside, JSON.stringify(m));
      };
      await startSessionAndWaitForPopup(page);
      await fits("notification popup");
      await shot(page, "mobile", "1-popup-320");
      await openCamera(page);
      await fits("camera popup");
      await btn(page, "Verify Now").click();
      await heading(page, "No Face Detected").waitFor(T);
      await fits("failure message");
      await shot(page, "mobile", "2-failure-320");
      await btn(page, "Cancel").click();
      await page.getByRole("alert").filter({ hasText: "Presence Verification Required" }).waitFor(T);
      await fits("minimised banner");
      await shot(page, "mobile", "3-banner-320");
    } finally { await browser.close(); }
  },

  // Cancel minimises to a banner; the check stays due; camera goes off.
  async minimise() {
    await registerViaApi();
    const { browser, page } = await launch();
    try {
      await login(page);
      await startSessionAndWaitForPopup(page);
      await openCamera(page);
      await btn(page, "Cancel").click();
      await page.getByRole("alert").filter({ hasText: "Presence Verification Required" }).waitFor(T);
      check("minimise", "Cancel minimises to a banner (check stays due)", true);
      check("minimise", "camera turned off on Cancel", await cameraReleased(page));
      await shot(page, "minimise", "1-banner");
      await btn(page, "Verify Presence").click();
      await page.getByRole("dialog").waitFor(T);
      check("minimise", "banner reopens the popup", true);
    } finally { await browser.close(); }
  },

  // Unanswered check expires.
  async expire() {
    await registerViaApi();
    const { browser, page } = await launch();
    try {
      await login(page);
      await startSessionAndWaitForPopup(page);
      await api("POST", "/dev/advance", { json: { seconds: 125 } });
      await heading(page, "Presence Unverified").waitFor(T);
      check("expire", "an unanswered check turns into 'Presence Unverified'", (await dialogText(page)).includes("verification window ended"));
      await shot(page, "expire", "1-expired");
    } finally { await browser.close(); }
  },

  // A break pauses the 30-minute clock: no popup during a break.
  async break() {
    await registerViaApi();
    const { browser, page } = await launch();
    try {
      await login(page);
      await btn(page, "Start Official Work Session").click();
      await btn(page, "Take Break").click();
      await page.getByText("Break Active").waitFor(T);
      await btn(page, "Skip ahead 5 min").click();
      await page.waitForTimeout(4500); // longer than the page's 3 s poll
      check("break", "no popup appears during a break, even after 5 minutes", (await page.getByRole("dialog").count()) === 0);
      await shot(page, "break", "1-break");
      await btn(page, "Resume Work").click();
      await btn(page, "Skip ahead 30 s").click();
      await page.getByRole("dialog", { name: "Presence Verification Required" }).waitFor(T);
      check("break", "after Resume, the check comes due once 30 active seconds pass", true);
    } finally { await browser.close(); }
  },

  // 8 hours done: verification stops, the platform stays usable.
  async complete() {
    await registerViaApi();
    const { browser, page } = await launch();
    try {
      await login(page);
      await btn(page, "Start Official Work Session").click();
      await btn(page, "Skip ahead 8 hours").click();
      await page.getByText("8-Hour Work Session Completed").waitFor(T);
      await page.waitForTimeout(4500);
      check("complete", "shows '8-Hour Work Session Completed'", true);
      check("complete", "counter stops at 960 / 960", (await page.getByText("960 / 960").count()) === 1);
      check("complete", "no verification popup after the 8 hours", (await page.getByRole("dialog").count()) === 0);
      await btn(page, "Skip ahead 30 min").click();
      await page.waitForTimeout(4500);
      check("complete", "still no popup after more time; extra time adds nothing", (await page.getByRole("dialog").count()) === 0 && (await page.getByText("960 / 960").count()) === 1);
      check("complete", "platform still usable (Start a new session is offered)", (await btn(page, "Start Official Work Session").count()) === 1);
      await shot(page, "complete", "1-completed");
    } finally { await browser.close(); }
  },
};

// ---- Run --------------------------------------------------------------------------------
const requested = args.length ? args : Object.keys(scenarios);
for (const name of requested) if (!scenarios[name]) throw new Error(`unknown scenario "${name}". Choose from: ${Object.keys(scenarios).join(", ")}`);
const skipped = IS_FIREFOX ? requested.filter((n) => NEEDS_REAL_FACE.has(n)) : [];
const wanted = requested.filter((n) => !skipped.includes(n));

try {
  await api("POST", "/dev/reset");
  const app = await fetch(APP);
  if (!app.ok) throw new Error("demo page not reachable");
} catch (e) {
  console.error(`Servers are not running (${e.message}). Start them with scripts/start-demo.ps1 first.`);
  process.exit(2);
}

console.log(`Browser: ${browserName}`);
if (skipped.length) console.log(`SKIPPED in Firefox (its fake camera cannot show a face; test by hand with a real webcam): ${skipped.join(", ")}`);
console.log("");
for (const name of wanted) {
  console.log(`> ${name}`);
  await api("POST", "/dev/reset");
  try {
    await scenarios[name]();
  } catch (e) {
    check(name, "scenario ran to the end", false, e.message.split("\n")[0]);
  }
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${browserName}: ${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) failed.forEach((f) => console.log(`  FAILED: [${f.scenario}] ${f.name}`));
process.exit(failed.length ? 1 : 0);
