# Presence Verification UI

React + TypeScript components for the AD TECH Intern Management Platform:

- `<PresenceVerification />`: the "Presence Verification Required" notification and the mandatory camera popup.
- `<FaceRegistration />`: the one-time onboarding screen (3 photos).
- `createVerificationService()`: the only code that calls the backend.

`src/demo/` is a throwaway shell that shows them working. **Akanksha's real dashboard replaces it.** Only `src/presence-verification/` is the deliverable.

## Run the demo

```bash
# 1. face service        (ai-service/)      python wsgi.py          -> :5001
# 2. mock backend        (mock-backend/)    npm start               -> :4000
# 3. this project
npm install
npm run dev                                                         # http://localhost:5173
```
Log in as `intern@demo.local` / `demo123`. The intern is asked to register a face, then: **Start Official Work Session → Skip ahead 30 s**, and the popup appears by itself. Use `localhost` (not an IP address): browsers only allow the camera on `localhost` or `https`.

```bash
npm test          # 48 tests (jsdom, camera mocked)
npm run build     # typecheck + production build
npm run e2e       # real browser (Chrome) with a fake camera; needs the demo running (scripts/start-demo.ps1)
npm run e2e -- --browser edge      # same in Edge
npm run e2e -- --browser firefox   # Firefox (run `npx playwright-core install firefox` once); skips verify/two, which need a real face
npm run e2e -- verify noface       # only some scenarios
```
`npm run e2e` plays a video file as if it were a webcam and drives the demo page through every scenario in the AI task document (success, no face, two faces, camera blocked, three failures, expiry, break, 8-hour completion). Screenshots go to `e2e/shots/`. Scenarios: `verify noface two exhaust denied nocamera inuse mobile minimise expire break complete`. "No camera" and "camera in use" are simulated (the browser is made to report those errors), because Chrome invents a fake camera even when none exists.

## Using it in the real dashboard

```tsx
import { createVerificationService, FaceRegistration, PresenceVerification } from "./presence-verification";

const service = useMemo(
  () => createVerificationService({ baseUrl: import.meta.env.VITE_API_BASE_URL, getToken: () => authToken }),
  [authToken],
);

<PresenceVerification
  service={service}
  onStatusChange={(s) => refreshSessionCard(s)}        // s.sessionVerificationStatus === "UNVERIFIED" -> show "Presence Unverified"
  onSessionExpired={() => navigate("/login")}          // backend answered 401
  onRegistrationRequired={() => setShowRegistration(true)}
/>

{showRegistration && <FaceRegistration service={service} onRegistered={() => setShowRegistration(false)} />}
```

Mount `<PresenceVerification />` **once**, inside the authenticated intern layout. Do not mount it on admin pages.

| Prop | Meaning |
|---|---|
| `service` (required) | From `createVerificationService`. Components never call `fetch` themselves. |
| `pollIntervalMs` | How often to ask the backend if a check is due. Default 15000. |
| `onStatusChange(status)` | Called after every refresh: use it to update the session card. |
| `onSessionExpired()` | The login token was rejected (401). |
| `onRegistrationRequired()` | The intern has no registered face. |
| `showConnectionWarning` | Slim "can't reach the server" bar. Default true. |

`getToken` is called on every request, so a refreshed token is picked up automatically. Keep the token in memory or an httpOnly cookie, not localStorage. Nothing in these components writes to browser storage.

## What the intern sees (states)

| Backend says | Popup shows |
|---|---|
| Nothing due | Nothing |
| Check due (`PENDING`) | Popup "Presence Verification Required", camera still off |
| Intern clicks **Verify Presence** | Camera permission, live preview, oval guide, tips, **Verify Now** |
| Frame sent | "Verifying…" (camera is already off) |
| `VERIFIED` | "Presence Verified", next check time, closes itself after 4 s |
| `FAILED`, attempts left | Reason (No Face / Multiple Faces / Image Not Clear / Verification Failed) + attempts left + **Try Again** |
| `FAILED`, no attempts left, or `EXPIRED` | "Presence Unverified" |
| `SERVICE_ERROR` or network error | "Verification Unavailable": **not counted** as an attempt |
| No registered face | "Face Registration Required" + `onRegistrationRequired` |
| Camera problem | "Camera Access Required" / "No Camera Found" / "Camera Unavailable" / "Camera Not Supported": **not counted** as an attempt |

**Cancel / Escape / clicking outside** minimises the popup to a banner: the check stays due until it expires. The result screens ("Presence Verified", "Presence Unverified") close for good.

## Rules these components follow

- **The backend decides everything.** The UI never sends or claims "verified". It sends one photo and displays the answer. The countdown is display-only; when it hits zero the UI asks the backend what happened.
- **Camera is on only while positioning.** It turns off right after the photo is taken, on Cancel, on success/failure, on leaving the page, and even if the permission prompt is answered after the popup closed.
- **One photo, in memory only.** Downscaled to 640 px wide JPEG under 300 KB; never stored, never in localStorage.
- **Double-clicks are safe.** Only one frame can be in flight.
- **Accessible.** The popup is a modal dialog with focus trap, Escape, focus return, and live-region announcements. Colour is never the only signal.
- **Responsive.** Checked at 320 px wide with no horizontal scroll.

## Files

| File | Purpose |
|---|---|
| `PresenceVerification.tsx` | Banner + popup UI |
| `usePresenceVerification.ts` | State machine: polling, phases, verify/retry logic |
| `useCamera.ts` | Owns the webcam: permission, capture, guaranteed release |
| `FaceRegistration.tsx` | 3-photo registration |
| `verificationService.ts` | All backend calls; `ApiError`; matches `docs/verification-contract.md` |
| `messages.ts` | All user-facing wording in one place |
| `types.ts` | Shared types (statuses, failure reasons) |
| `presence-verification.css` | AD TECH dark theme, prefixed `pv-` / `--pv-` so it cannot clash |

## Known limits

- The oval guide is a visual aid only; face position is judged by the AI service.
- No liveness check yet, so a photo of a photo may pass (see `ai-service/README.md`).
- Tested automatically in Chrome, Edge and Firefox (fake cameras) and jsdom. A real webcam, Safari and real phones should be tried by hand before launch.
