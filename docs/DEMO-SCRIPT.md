# Demo video script and submission checklist

Target length: **5 to 6 minutes**. Record the screen at 1280x720 with your voice. Each scene has what to **do**, what to **say** (short, plain sentences; use your own words), and what you should **see**. If something differs from "you should see", stop and fix it before recording.

**This script shows the real integrated app** (Akanksha's frontend, `src/` in this repo — real login, real route protection, real admin data), not just the standalone `presence-verification/` demo page. Both work; this is the more honest and more impressive one to record.

## Before you press record

- [ ] Start all three pieces:
  ```powershell
  powershell -ExecutionPolicy Bypass -File scripts\start-demo.ps1
  cd Intern-Manager
  npm run dev
  ```
  (The script starts the face service, mock backend and the old standalone demo page on :5173. Since Akanksha's real app also wants :5173, either skip the standalone demo — run `scripts\start-demo.ps1 -FaceServiceOnly` plus the mock backend yourself, per `docs/HOW-TO-RUN.md` — or stop the standalone demo's Vite process and start `Intern-Manager`'s instead.)
- [ ] Reset the demo data (the mock forgets everything on restart, or run this):
  ```powershell
  Invoke-RestMethod -Method Post http://127.0.0.1:4000/api/v1/dev/reset
  ```
- [ ] Open **http://localhost:5173** in Chrome (not an IP address; the camera needs `localhost`)
- [ ] Close other apps that use the camera (Teams, Zoom, Meet)
- [ ] Face a light source, plain background. Have **a second person** ready for the two-face scene
- [ ] Browser zoom 100%, bookmarks bar hidden, notifications muted (Windows: Focus Assist)
- [ ] Know both demo logins: `intern@demo.local` / `demo123` and `admin@demo.local` / `demo123`
- [ ] Do one full dry run first. The first camera start is the slowest

## Scenes

### 1. Introduction (20 s)
- **Do:** show the browser on Akanksha's real login page (`/login`).
- **Say:** "This is the AD TECH Intern Platform. Login is real — wrong passwords are rejected by the backend. Once logged in, every 30 minutes of an official work session the system checks that the registered intern is actually there, using their webcam. The backend decides everything; the website only shows the result."
- *(Explain that this demo runs on a temporary mock backend with a 30-second interval so we don't wait 30 minutes, and that login/admin data is real but the tasks/attendance shown elsewhere are still sample data until Adarsh's backend exists.)*

### 2. Real login, and register the face (50 s)
- **Do:** type a wrong password first, show the real error message. Then log in correctly as `intern@demo.local` / `demo123`.
- **Say:** "That error came from the backend, not a hardcoded message. Now the real intern account."
- **See:** lands on the dashboard, sidebar shows the real name from the backend, not a hardcoded one.
- **Do:** go to `/dev-register-face` (a temporary page — the real onboarding step is Akanksha's to place properly later, e.g. inside Profile). Click **Start Camera**, then **Capture Photo** three times (straight, slightly left, slightly right).
- **Say:** "First-time setup: the intern registers their face with three photos. The system keeps only a numeric template, encrypted, not the photos."
- **See:** camera preview with an oval guide → "Face Registered" with a green dot → back on the dashboard.

### 3. Start the work session, notification appears (30 s)
- **Do:** click **Start Official Work Session**. Then click **Skip ahead 30 s**. Wait up to 3 seconds.
- **Say:** "The official session is running. I'm fast-forwarding the server clock 30 seconds. The backend decides the check is due, and the website notifies the intern."
- **See:** popup "Presence Verification Required", with a countdown and the privacy notice. **The camera is still off.**

### 4. Successful verification (40 s)
- **Do:** click **Verify Presence**. When the preview shows your face, click **Verify Now**.
- **Say:** "The camera opens only now. One photo is taken, and the camera turns off immediately, before we even wait for the answer."
- **See:** preview with your face → "Verifying…" → **"Presence Verified"**, "Next verification: approximately …", closes by itself. The camera light on your laptop goes off.

### 5. Failure cases (60 s)
Skip ahead 30 s again to get a new check each time.
- **No face:** cover the camera (or turn away), click **Verify Now**. **See:** "No Face Detected", "2 attempts remaining", **Try Again**. **Say:** "A failed try is not the end. The intern gets three attempts."
- **Two people:** have someone stand next to you, **Verify Now**. **See:** "Multiple Faces Detected". **Say:** "The system never verifies an arbitrary face when two are visible."

### 6. Camera blocked (30 s)
- **Do:** click the lock/camera icon in the address bar → set Camera to **Block** → reload the page → start a check (Skip ahead 30 s) → **Verify Presence**.
- **Say:** "If the camera is blocked, the intern gets clear instructions, and it does not count as a failed attempt."
- **See:** "Camera Access Required" and "This does not count as a failed attempt." Set the camera back to **Allow** afterwards.

### 7. Presence Unverified (30 s)
- **Do:** either fail three times in a row (cover the camera and press Try Again twice), or ignore a due check and click **Skip ahead 5 min**.
- **Say:** "If the intern doesn't verify, the backend records it as unverified and the dashboard shows Presence Unverified. It is never silently marked as verified."
- **See:** "Presence Unverified" in the popup, and the session card label changes to **Presence Unverified**.

### 8. Break pauses the check (25 s)
- **Do:** click **Take Break**, then **Skip ahead 5 min**, wait 4 seconds. Then **Resume Work**.
- **Say:** "Breaks are not work time, so no check is issued during a break."
- **See:** "Break Active", no popup after 5 minutes.

### 9. Eight hours complete (25 s)
- **Do:** click **Skip ahead 8 hours**.
- **Say:** "After 8 official hours the session is complete, verification stops, and extra time adds nothing. The platform stays usable."
- **See:** "8-Hour Work Session Completed", **960 / 960**, no popup, buttons still work.

### 10. Route protection, then real admin visibility (55 s)
- **Do:** while still logged in as the intern, type `/admin/interns` directly into the address bar.
- **Say:** "An intern can't reach admin pages, even by typing the URL directly — and this is enforced by the backend itself, not just hidden by the website."
- **See:** bounced straight back to the intern dashboard.
- **Do:** Logout, log in as `admin@demo.local` / `demo123`. Go to **Interns** in the sidebar.
- **Say:** "The admin sees each intern's real verification status, session state and designation, pulled live from the backend — this is the real Admin Interns page, not a mock-up."
- **See:** a real table (not hardcoded rows), a status badge per intern, and — if you completed the earlier verification — one row showing **Verified**. Try the search box with a name that doesn't exist, to show the empty state.

### 11. Wrap-up (30 s)
- **Do:** show the terminal running the tests (`npm test` in `presence-verification`, `pytest` in `ai-service`) and `npm run build`.
- **Say:** "All automated tests pass, the production build succeeds, and everything is in the repository with documentation."

## When the real backend replaces the mock

Redo scenes 2 to 10 against Adarsh's backend, and update these points:
- Use his real accounts instead of `intern@demo.local` / `admin@demo.local`.
- The **Demo controls** and `dev/advance` do not exist there. Either shorten the verification interval for the recording (ask Adarsh), or show one real 30-minute cycle in a sped-up cut.
- Remove `/dev-register-face` from scene 2 once there's a real onboarding step for it.
- Say that verification history now persists in MongoDB, and that tasks/attendance/reports (still sample data as of this recording) are now real too.

## Screenshots to save

The browser test writes screenshots to `presence-verification\e2e\shots\`. Copy these for the submission (or take your own with real faces):

| Screenshot | File |
|---|---|
| Notification popup | `chrome-verify-1-popup-due.png` |
| Camera popup | `chrome-verify-2-camera.png` |
| Phone width (320 px) | `chrome-verify-3-mobile-320.png` |
| Success | `chrome-verify-4-verified.png` |
| No face | `chrome-noface-1-no-face.png` |
| Multiple faces | `chrome-two-1-multiple-faces.png` |
| Camera blocked | `chrome-denied-1-camera-denied.png` |
| Presence Unverified | `chrome-exhaust-1-unverified.png` |
| Minimised banner | `chrome-minimise-1-banner.png` |
| Phone width: popup, failure, banner | `chrome-mobile-1-popup-320.png`, `chrome-mobile-2-failure-320.png`, `chrome-mobile-3-banner-320.png` (also `edge-` and `firefox-` versions) |
| 8 hours complete | `chrome-complete-1-completed.png` |

## Submission checklist (from the AI task document, sections 34 to 38)

- [x] Work is on a feature branch, `feature/ai-presence-verification`. **Never pushed to `main`.**
- [x] Pull request opened: **PR #2**, `feature/ai-presence-verification` → `development` (not `main` — `development` did not exist at first, so it was created)
- [x] No secrets committed: no `.env`, keys or credentials. Confirmed again in the security review, section 6 of `TESTING-RESULTS.md`
- [x] Documentation: `docs/HOW-TO-RUN.md`, `docs/verification-contract.md`, and each folder's README
- [x] Testing results: `docs/TESTING-RESULTS.md` is up to date as of 23 September, including the real-integration and security-review sections
- [x] Production build passes: `npm run build`, both in `presence-verification` and in `Intern-Manager` (Akanksha's real frontend)
- [ ] Working end-to-end demo video recorded — **still to do, this script is ready for it**
- [ ] Coordinated with Adarsh and Akanksha before merging — Akanksha's frontend is integrated; Adarsh's backend has not responded yet
- [x] Real-backend integration: **not done** (Adarsh's backend doesn't exist yet), clearly stated throughout `TESTING-RESULTS.md` and in the PR description

## Pull request description

Already posted as PR #2. Kept here for reference — update this section too if the PR description changes:

> **feat: AI presence verification (face service, verification UI, backend integration)**
>
> See the PR on GitHub for the full, current description (it now also covers the real-frontend integration and the security-review commit, added after the first version of this text).
>
> **Depends on:** Adarsh's verification endpoints (contract in `docs/verification-contract.md`) and Akanksha's dashboard mounting `<PresenceVerification />` — **done**, her real pages now use it
>
> **Known limits:** no liveness detection; matching thresholds not yet tuned on real intern webcams; Firefox could not be fully automated for a real face match (its fake camera is a static test pattern); tasks/attendance/reports elsewhere in the frontend are still sample data pending Adarsh's backend
