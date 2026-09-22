# Demo video script and submission checklist

Target length: **5 to 6 minutes**. Record the screen at 1280x720 with your voice. Each scene has what to **do**, what to **say** (short, plain sentences; use your own words), and what you should **see**. If something differs from "you should see", stop and fix it before recording.

## Before you press record

- [ ] `powershell -ExecutionPolicy Bypass -File scripts\start-demo.ps1` finished and printed the three OK lines
- [ ] Reset the demo data (the mock forgets everything on restart, or run this):
  ```powershell
  Invoke-RestMethod -Method Post http://127.0.0.1:4000/api/v1/dev/reset
  ```
- [ ] Open **http://localhost:5173** in Chrome (not an IP address; the camera needs `localhost`)
- [ ] Close other apps that use the camera (Teams, Zoom, Meet)
- [ ] Face a light source, plain background. Have **a second person** ready for the two-face scene
- [ ] Browser zoom 100%, bookmarks bar hidden, notifications muted (Windows: Focus Assist)
- [ ] A PowerShell window ready, for the admin scene
- [ ] Do one full dry run first. The first camera start is the slowest

## Scenes

### 1. Introduction (20 s)
- **Do:** show the browser on the login page.
- **Say:** "This is the presence-verification feature for the AD TECH Intern Platform. Every 30 minutes of an official work session, the system checks that the registered intern is actually there, using their webcam. The backend decides everything; the website only shows the result."
- *(Explain that this demo runs on a temporary mock backend with a 30-second interval so we don't wait 30 minutes. The real interval is 30 minutes.)*

### 2. Log in and register the face (45 s)
- **Do:** click **Log in** (demo intern is pre-filled). Allow the camera. Click **Start Camera**, then **Capture Photo** three times (straight, slightly left, slightly right).
- **Say:** "First-time setup: the intern registers their face with three photos. The system keeps only a numeric template, encrypted, not the photos."
- **See:** camera preview with an oval guide → "Face Registered" with a green dot.

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

### 10. Admin visibility (40 s)
The real admin screen is Akanksha's. Until it exists, show the data the admin screen will receive. Run this in PowerShell:
```powershell
$t = (Invoke-RestMethod -Method Post http://127.0.0.1:4000/api/v1/auth/login -ContentType application/json -Body '{"email":"admin@demo.local","password":"demo123"}').data.token
(Invoke-RestMethod http://127.0.0.1:4000/api/v1/admin/interns -Headers @{Authorization="Bearer $t"}).data | ConvertTo-Json -Depth 6
(Invoke-RestMethod "http://127.0.0.1:4000/api/v1/verifications/history?internId=intern-1" -Headers @{Authorization="Bearer $t"}).data.items | Format-Table status, reason, attempts, requestedAt
```
- **Say:** "The admin sees each intern's verification status, last verified time, failed and unverified counts, and the full history."
- **See:** a `verification` block with `status`, `lastVerifiedAt`, `failedCount`, `unverifiedCount`, and a history table with VERIFIED / FAILED / EXPIRED rows.

### 11. Wrap-up (30 s)
- **Do:** show the terminal running the tests (`npm test` in `presence-verification`, `pytest` in `ai-service`) and `npm run build`.
- **Say:** "All automated tests pass, the production build succeeds, and everything is in the repository with documentation."

## When the real backend replaces the mock

Redo scenes 2 to 10 against Adarsh's backend, and update these points:
- Use the real login instead of `intern@demo.local`.
- The **Demo controls** and `dev/advance` do not exist there. Either shorten `VERIFICATION_INTERVAL_SECONDS` for the recording (ask Adarsh), or show one real 30-minute cycle in a sped-up cut.
- Scene 10 becomes Akanksha's real admin screen.
- Say that verification history now persists in MongoDB.

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

- [ ] Work is on a feature branch, e.g. `feature/ai-presence-verification`. **Never pushed to `main`.**
- [ ] Pull request opened: feature branch → `development` → review → `main`
- [ ] No secrets committed: no `.env`, keys or credentials. `git status` shows only `.env.example` files
- [ ] Documentation: `docs/HOW-TO-RUN.md`, `docs/verification-contract.md`, and each folder's README
- [ ] Testing results: `docs/TESTING-RESULTS.md` is up to date (re-run the suites right before submitting)
- [ ] Production build passes: `npm run build` in `presence-verification`
- [ ] Working end-to-end demo video recorded
- [ ] Coordinated with Adarsh and Akanksha before merging
- [ ] Real-backend integration done, or clearly stated in the PR as pending

## Draft pull request description

> **feat: AI presence verification (face service, verification popup, registration)**
>
> **What this adds**
> - `ai-service/`: Python face-verification service (register, verify; no-face, multiple-face and low-quality handling; encrypted templates; rate-limited; nothing stored)
> - `presence-verification/`: React components: presence notification, mandatory camera popup, face registration, and the service layer that talks to the backend
> - `docs/`: API contract, how-to-run, testing results, demo script
> - `mock-backend/`: temporary stand-in for the backend, **to be deleted** once the real endpoints are connected
>
> **How to run it:** see `docs/HOW-TO-RUN.md`
>
> **Testing:** see `docs/TESTING-RESULTS.md`
>
> **Depends on:** Adarsh's verification endpoints (contract in `docs/verification-contract.md`) and Akanksha's dashboard mounting `<PresenceVerification />`
>
> **Known limits:** no liveness detection; matching thresholds not yet tuned on real intern webcams; tested in Chrome and Edge only
