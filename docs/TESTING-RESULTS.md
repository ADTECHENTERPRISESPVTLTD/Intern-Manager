# Testing results: AI presence verification

**Run date:** 21–23 September 2026 · **Machine:** Windows 11, Intel Core i5-13420H · Python 3.14.4, Node 24.15, npm 11.12 · Chrome 153.0.8010.48, Edge 153.0.4234.48, Firefox 156 installed (automated tests use Playwright's Firefox 155 build, same engine)

**Read this first.** Everything below was tested against the **temporary mock backend** (`mock-backend/`), not Adarsh's real backend, and with **stock sample photos and a fake camera**, not real interns on real webcams. Section 5 lists exactly what has not been tested yet. Re-run the suites before you submit (commands are in `docs/HOW-TO-RUN.md`).

**Update, 23 Sept:** the popup is no longer only a standalone demo page. It is now mounted inside **Akanksha's real frontend** (this repo, `src/`), behind a working login and role-based route protection, with the admin screen showing real backend data. Section 1a and section 7 cover this. `presence-verification/` (the original standalone demo) still exists and still works, kept for isolated component testing.

## 1. Summary

| Suite | What it checks | Result | Command |
|---|---|---|---|
| Face service (Python) | Detection, matching, quality, encryption, HTTP API, hardening | **61 passed** | `ai-service`: `python -m pytest -q` |
| Mock backend (Node) | Schedule, attempts, expiry, breaks, 8-hour completion, roles, admin data, login rate limiting | **32 passed** | `mock-backend`: `npm test` |
| Popup components (React) | Every screen and state, camera release, privacy, service layer | **48 passed** | `presence-verification`: `npm test` |
| Backend client (TypeScript) | The file the real backend copies: request format, API key, every failure kind, timeouts | **20 passed**, `tsc --strict` clean. Also run once against the real face service (register, match, non-JPEG, wrong key) | `backend-integration`: `npm test` |
| Type check | TypeScript, strict mode | **clean** | `npm run typecheck` |
| Production build | The build Akanksha's task requires | **succeeds** | `npm run build` |
| Real browser: Chrome 153 | Whole flow with a fake camera, real face service | **39 / 39 checks** | `npm run e2e` |
| Real browser: Edge 153 | Same | **39 / 39 checks** | `npm run e2e -- --browser edge` |
| Real browser: Firefox (155 engine) | Same, except the two scenarios that need a real face (see 5) | **28 / 28 checks** | `npm run e2e -- --browser firefox` |
| Speed | Face service, one verify call | **median 31 ms, 95% under 36 ms** (60 runs) | measured in-process |
| **Real integration (Intern-Manager frontend)** | Real login, route protection, real admin data, mobile fix — see section 1a | **23 / 23 checks** | see section 1a |
| Dependency security (npm) | Known-CVE scan, every Node project | **0 vulnerabilities** (was 2 moderate, fixed — see section 7) | `npm audit` in each project |
| Dependency security (pip) | Known-CVE scan, `ai-service` | **0 vulnerabilities** | `pip-audit -r requirements.txt` |

## 1a. Real integration into Akanksha's frontend (23 checks)

The popup, face registration, login, route protection and admin screen were tested together against her actual pages (`src/`), not the standalone demo. Two runs, both against the real mock backend, real Chrome, a fake camera for the face checks:

**Run 1 — auth, routing, admin data, mobile (18 checks, all passed):** wrong password is rejected with a real error message and does not let you in; correct intern login lands on the dashboard and shows the *real* logged-in name (not a hardcoded one); an intern never sees the Admin switch; an intern is bounced away if they navigate straight to `/admin/interns` by URL; a signed-out visit to any page redirects to `/login`; admin login lands on `/admin` directly; the Interns table shows real rows and a real designation pulled from the backend (`Frontend Intern`, `Backend Intern`), not the old hardcoded 5-row table; an admin never receives the intern's presence popup; searching for a name that doesn't exist shows a proper empty state, not a blank table; Login and Dashboard both checked with no horizontal scroll at 320 / 375 / 430 px.

**Run 2 — session persistence (5 checks, all passed):** staying logged in survives a hard page refresh (the real name is still shown afterward); Logout sends you to `/login`; Logout actually clears the stored session (`sessionStorage` empty afterward, confirmed by reading it directly, not just visually); after logout, the dashboard is blocked again — no stale session lets you back in.

The full register → check becomes due → camera opens → "Presence Verified" flow was also re-run through this real login (not the old standalone demo login) and still works end to end.

## 2. The required test scenarios (AI task document, section 30)

| Scenario | Flow | Evidence | Result |
|---|---|---|---|
| Successful verification | Camera → face → match → backend → Verified | Same person scores 0.77 to 0.93 against a 0.363 threshold (`test_service.py`, `test_api.py`); mock records it (`verifying` tests); real browser `verify` shows "Presence Verified" | **Pass** (mock backend) |
| Failed verification | Camera → face → no match → Failed | Different person scores 0.04 to 0.19 → `NO_MATCH` (`test_different_person_does_not_match`); mock allows retry; popup shows "Verification Failed" and attempts left (unit test) | **Pass in unit and API tests. Not run in a real browser**, because there is only one usable face photo set (see 5) |
| No face | Camera → no face → error → retry | `NO_FACE` in engine, API, mock and popup; real browser `noface` and `exhaust` | **Pass** |
| Multiple faces | Camera → multiple faces → reject | `MULTIPLE_FACES` in engine and API; real browser `two` | **Pass** |
| Camera denied | Browser → permission denied → proper UI | Unit tests for denied/no camera/in use/unsupported; real browser `denied` (real permission denial in Chrome and Edge; simulated in Firefox): "Camera Access Required" and the backend shows **0 attempts used** | **Pass** |
| Session completion | 8 hours → verification stops | Mock test; real browser `complete`: "8-Hour Work Session Completed", 960 / 960, no popup afterwards | **Pass** (mock backend) |
| Platform continuation | After 8 hours → platform remains usable | Real browser `complete`: extra time adds nothing, and the intern can start a new session | **Pass** (mock backend) |

## 3. What each suite covers

**Face service (61).** A clear face gives an embedding; blank frame, noise, too dark, too small, two faces → the right rejection; a tiny background face is ignored; same person matches and different person does not; registration rejects mixed people, missing faces and the wrong number of frames; templates are encrypted and unreadable without the key; a backend-facing HTTP API with proper 400/401/422/429 errors that never leak stack traces.
*Hardening added on 21 Sept:* only real JPEGs are accepted (PNG, GIF, junk and truncated files are rejected); a file that *claims* a huge picture size (a 60000x60000 header in under 100 bytes) is refused **before** any decoding; rate limiting (429 with `Retry-After`; strangers and `/health` don't use up the quota); `Cache-Control: no-store` on every response; an over-long template is rejected; the service refuses to start with placeholder or short secrets or with missing model files, and says why.

**Mock backend (29).** Nothing due before the interval, then a check appears; a break pauses the clock; `attendanceSystemActive=false` turns checks off; a match verifies and schedules the next; each failure reason allows a retry; three failures close the check and mark the session `UNVERIFIED`; an unanswered check expires and cannot be answered late; no registered face → `NOT_REGISTERED` without using an attempt; a broken face service does not use an attempt; double-submit is rejected; a non-JPEG or oversized frame is rejected; another intern cannot touch someone else's check; the browser cannot claim `verified=true`; after the target the session is `COMPLETED` and checks stop; admin sees status and counts; the server clock is sent to the UI.

**Popup (48).** Notification appears with the camera still off; privacy text shown first; Cancel and Escape minimise to a banner; the camera opens on click, one frame is sent, and the camera is **off before the answer arrives**; a double click sends only one frame; a too-large frame is re-encoded smaller; each failure reason shows its own message and the attempts left; a broken face service is shown as "unavailable", never as "failed"; network error, expired token and expired check are handled; camera problems never count as an attempt; closing the popup while the browser is asking for permission never leaves the camera on; leaving the page releases the camera; the popup cannot be dismissed while the answer is pending; polling, connection warning; **nothing is ever written to localStorage/sessionStorage**; the 3-photo registration and its error messages; the service layer's request/response handling.

**Real browser (39 checks in Chrome and Edge, 28 in Firefox).** In Chrome and Edge a video file is played as the webcam; Firefox uses its own test-pattern camera. Eleven scenarios: `verify` (UI registration, popup appears by itself, camera off until clicked, success, 320 px layout, camera released, storage empty, no console errors), `noface`, `two`, `exhaust` (three failures → Presence Unverified, dashboard label changes), `denied`, `nocamera`, `inuse`, `minimise`, `expire`, `break` (no popup during a break), `complete` (8 hours), and `mobile` (every popup state fits a 320 px screen). Screenshots are saved in `presence-verification/e2e/shots/`.

## 4. Problems the testing found (and fixed)

| Found by | Problem | Fix |
|---|---|---|
| Popup unit test | When the face service was down during **registration**, the screen said "Verification Unavailable" (check wording) | Registration now says "Registration Unavailable" |
| Real-browser test | The demo page removed the registration card the instant it succeeded, so the intern never saw "Face Registered" | Confirmation now stays visible for 4 s |
| Code review before the first run | The camera hook returned a new object every render, which would have restarted the polling loop on every render | Components use the hook's stable functions |
| Real-browser test | "No camera" cannot be produced with launch flags: Chrome invents a fake camera | Those two checks are labelled **[simulated]** (the browser is made to report `NotFoundError` / `NotReadableError`) |
| Real-browser test on Akanksha's real pages, 320 px | `.task-row` (the assigned-tasks list on the dashboard) used a fixed 3-column CSS grid that didn't collapse on narrow screens; content ran off the right edge under about 350 px wide | Stacks into a single column below 520 px, matching the rest of her mobile styles |
| Security review, direct API calls | `POST /auth/login` had no rate limiting — 10 rapid wrong-password guesses in a row all succeeded in reaching the server, no slowdown | Added: 5 attempts per email per minute. A genuine correct login always resets the count, so mistyping your own password twice never locks you out |
| `npm audit`, `Intern-Manager` | `react-router-dom@6.28.0` had 2 moderate CVEs (open redirect via backslash in `Link`/`useNavigate`; arbitrary constructor injection in SSR error hydration) | Upgraded to `7.18.4`. Rebuilt and reran the full 18-check integration suite afterward with no behaviour change; `npm audit` now clean |

## 5. Not tested, and known limits

Be upfront about these in the demo and PR.

0. **Render deployment is untested** (`ai-service/DEPLOY.md`): Render and Docker were not available on this machine.
1. **Adarsh's real backend is not connected.** Verification history, session updates, the 30-minute trigger and admin data are proven only against the in-memory mock. They still need to be re-tested against the real MongoDB backend.
2. **No real interns, no real webcams.** Matching used two stock sample people (one person appears in two photos: score 0.77; two different people: 0.04 to 0.19). That is a tiny sample and **not a measured false-accept / false-reject rate.** Before launch, register about 10 volunteers on their own laptops and record genuine and impostor scores, then set `MATCH_THRESHOLD`, `MIN_FACE_PX` and `MIN_SHARPNESS` from that data.
3. **No liveness detection.** A photo of a photo (for example, on a phone) may pass. This is not in the task documents but is the obvious next improvement.
4. **Browsers:** Chrome, Edge and Firefox were automated. **Safari was not tested** (not available on Windows). **Firefox could not automate a successful face match or the two-faces case**, because Firefox's built-in fake camera is a fixed test pattern and cannot play a face video (`verify` and `two` are skipped there). Everything else runs in Firefox, including capturing a frame, uploading it and getting an answer. Those two must be tried by hand in Firefox with a real webcam. Firefox was run with Playwright's build of Firefox 155, not the installed Firefox 156 app. No real phones: 320 px was checked as a resized desktop window in all three browsers (`mobile` scenario), not on a device.
5. **A failed *identity* check in a real browser** (the `NO_MATCH` screen after a real camera frame) was not run end to end, because there is only one usable set of face photos. It is covered by unit and API tests.
6. **"No camera", "camera in use"** (all browsers) **and "camera denied" in Firefox** are simulated: the browser is made to report the error a real browser would. They exercise the real code paths, but a real unplugged, busy or blocked camera was not tried in Firefox (Chrome and Edge did get a real permission denial).
7. **Real timings.** The browser tests use 30-second checks and a 2-minute window. The real 30-minute / 5-minute defaults were tested only with the mock's shorter values; the logic is the same but the real numbers have not been run.
8. **Speed.** 31 ms is the face service alone. It excludes the network, the HTTP upload and the browser's photo capture. A full round trip has not been timed.
9. **Accessibility:** focus handling and Escape are tested; a screen reader was not tried.
10. **Multi-tab, clock-skew and long-session behaviour** (an intern with two tabs open, a wrong computer clock, a session running all day) were not tested. The countdown uses the server's clock to avoid the skew problem, but it wasn't exercised with a skewed clock.

## 6. Security review (23 September)

A focused pass, not a full penetration test. What was checked, and what was found:

| Checked | Result |
|---|---|
| Secrets committed anywhere in the repo (API keys, passwords, tokens) | **None found.** Only `.env.example` files exist; the real `.env` files are git-ignored and were never committed |
| `dangerouslySetInnerHTML`, `eval(`, `new Function(` in any JS/JSX/TS file | **None found** |
| Node dependency vulnerabilities (`npm audit`), all 4 Node projects | **0** after the `react-router-dom` upgrade above (was 2 moderate) |
| Python dependency vulnerabilities (`pip-audit`), `ai-service` | **0** |
| **Is admin access actually enforced by the server, or only hidden by the UI?** | Tested directly: took a real intern's login token and called `GET /admin/interns` with it **over the API, bypassing the website entirely**. Got a real `403 FORBIDDEN` from the backend itself. Confirms the frontend route guard is a convenience, not the real security boundary — the real boundary already exists server-side |
| CORS configuration | Scoped to specific origins (`localhost:5173`, `localhost:3000` by default via `CORS_ORIGIN`), not a wildcard `*` |
| Login brute-force protection | **Gap found and fixed** — see section 4 |
| Session survives refresh / clears on logout | Tested directly by reading `sessionStorage` in the browser, not just by looking at the screen: confirmed empty after logout, confirmed every route re-blocks afterward |

**Known, accepted gaps** — not fixed, because they are really the real backend's decision, not this temporary mock's:
- Login tokens never expire (no refresh-token flow exists yet in the mock)
- No CSP or other security response headers (normally set at the hosting/reverse-proxy layer for a real deployment, not meaningfully testable on a throwaway local mock)
- The token is kept in `sessionStorage` rather than an httpOnly cookie — a reasonable choice for a pure API + SPA architecture, but Adarsh's real backend should make this call deliberately, not inherit it by default

## 7. Status against the AI task's Definition of Done (section 38)

| Item | Status |
|---|---|
| Face registration works | **Done** (service, UI, tested) |
| Face verification works | **Done** (tested with sample photos) |
| Verification is connected to the correct intern | Done in the mock. **Pending real backend** |
| 30-minute verification triggering works | Done in the mock. **Pending real backend** |
| Website notification appears / popup opens / camera works | **Done** (Chrome, Edge, Firefox, and now inside Akanksha's real dashboard, not only the standalone demo). A real-webcam face match in Firefox is still to be tried by hand |
| Successful verification updates the backend | Done in the mock. **Pending real backend** |
| Failed verification, no-face, multiple-face handled | **Done** |
| Camera permission errors handled | **Done** |
| Verification history stored | In memory in the mock. **Pending MongoDB** |
| Work-session status updates correctly | Done in the mock. **Pending real backend** |
| Admin can see verification status | **Done in the real integration**: `/admin/interns` fetches and displays live backend data (status, last verified, failed/unverified counts), with loading, error and empty states. **Pending real backend** for the data itself to be real MongoDB data instead of the mock's |
| Verification stops after 8 hours; platform usable after | Done in the mock. **Pending real backend** |
| Frontend, backend and AI work together | **Done with Akanksha's actual frontend** (real login, real route protection, real popup, real admin data) and the mock backend. **Pending Adarsh's real backend** in place of the mock |
| Login / authenticated routes / admin hidden from interns | **Done**: real login (wrong password rejected), route guards block signed-out visitors and block interns from every `/admin/*` route — enforced by the backend itself, not just hidden by the UI (confirmed by direct API call) |
| No sensitive credentials committed | **Done**: only `.env.example` files exist; the real `.env` files are git-ignored. Security review (section 6) found no secrets, no known dependency vulnerabilities, and fixed 2 real gaps (an outdated dependency, missing login rate limiting) |
| Documentation complete | **Done**: `HOW-TO-RUN.md`, contract, folder READMEs, this file |
| Production build succeeds | **Done** (frontend, after every change in this document, most recently the `react-router-dom` upgrade) |
| End-to-end demonstration works | Works, now through the real dashboard and real login. **Video not recorded yet** (`DEMO-SCRIPT.md`) |
| GitHub PR submitted | **Done**: PR #2 on `ADTECHENTERPRISESPVTLTD/Intern-Manager`, `feature/ai-presence-verification` → `development` |

