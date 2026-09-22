# Presence Verification: Integration Contract (DRAFT v0.1)

**Owner:** Soham (AI Lead) · **For review by:** Adarsh (backend), Akanksha (frontend)
**Status:** Proposal. Everything marked **PROPOSED** needs a yes/no before coding starts.

Source of truth for the rules below: the three task documents (Task-05 Frontend, Task-05 Backend, Task-06 AI).

---

## 1. Ownership

| Area | Owner |
|---|---|
| Face registration / matching logic (Python service) | Soham |
| Verification component (notification, popup, camera, states) | Soham builds, Akanksha mounts it in the dashboard |
| Verification endpoints, persistence, auth, session updates, scheduling of "due" | Adarsh |
| Dashboard/admin screens that display verification data | Akanksha |

## 2. Non-negotiable rules

1. The **backend is the only authority**. The frontend never sends or claims `verified = true`. It only sends a camera frame and displays what the backend returns.
2. **Backend decides when a check is due** (configurable interval), not a browser timer.
3. **Raw biometric data never goes to the frontend**, and camera frames are **never stored** (not in MongoDB, logs, localStorage or disk). They are discarded right after matching.
4. Camera is on **only while the popup is open**. Tracks are stopped on close, success, failure and unmount.
5. Verification is active only during the official 8-hour session and only when `attendanceSystemActive = true`. After the session is `COMPLETED`, no more checks are issued.
6. Never commit `.env`, keys or secrets. Provide `.env.example` only.

## 3. Response envelope (from Adarsh's doc)

```json
{ "success": true,  "data": { }, "message": "..." }
{ "success": false, "message": "...", "code": "SESSION_NOT_FOUND" }
```

All endpoints below use it. Base path: `/api/v1`. Auth: JWT, role taken from the token only.

## 4. States

Check-level status returned by the backend:

`PENDING` → `VERIFYING` → `VERIFIED`
Alternatives: `FAILED`, `EXPIRED`, `UNVERIFIED`

Failure **reason** codes (only present when a frame was rejected):

| reason | Meaning | UI message |
|---|---|---|
| `NO_FACE` | No face in frame | "No Face Detected" |
| `MULTIPLE_FACES` | More than one face | "Multiple Faces Detected" |
| `LOW_QUALITY` | Blur / dark / too small | "Make sure lighting is sufficient" |
| `NO_MATCH` | Face is not the registered intern | "Verification Failed" |
| `NOT_REGISTERED` | Intern has no registered face (backend decides, AI service is never called) | "Face registration required" |
| `SERVICE_ERROR` | AI service down or timeout | "Verification unavailable, try again" |

`CAMERA_ERROR` (permission denied, no camera, in use, unsupported browser) is **frontend-only**. It is never sent to the backend and never counts as an attempt. **PROPOSED**

## 5. Endpoints (PROPOSED names; Adarsh to confirm)

### 5.1 `GET /verifications/status` (INTERN)
Current verification state for the intern's active session. The frontend polls this (about every 15 s), or reads the same block from the heartbeat response.

```json
{
  "sessionId": "…",
  "verificationActive": true,
  "verificationRequired": true,
  "current": {
    "verificationId": "…",
    "status": "PENDING",
    "requestedAt": "2026-09-22T09:30:00Z",
    "expiresAt": "2026-09-22T09:35:00Z",
    "attemptsUsed": 0,
    "maxAttempts": 3
  },
  "lastVerifiedAt": "2026-09-22T09:00:00Z",
  "nextCheckDueAt": "2026-09-22T10:00:00Z",
  "sessionVerificationStatus": "PENDING",
  "serverTime": "2026-09-22T09:30:04Z"
}
```
`sessionVerificationStatus` is the session-level result (`NONE`, `PENDING`, `VERIFIED`, `UNVERIFIED`) that the dashboard uses for the "Presence Unverified" label. `serverTime` lets the "time left" countdown follow the server's clock instead of the intern's computer clock.
`verificationActive=false` when the session is not active, is completed, or `attendanceSystemActive` is off. `current` is `null` when nothing is due.

### 5.2 `POST /verifications/request` (INTERN)
Called when the intern clicks "Verify Presence". It is idempotent and returns the open PENDING check (creating it if the scheduler already marked one due). It returns `409 VERIFICATION_NOT_DUE` if nothing is due.

### 5.3 `POST /verifications/verify` (INTERN)
`multipart/form-data`: `verificationId`, `frame` (JPEG, at most 640px wide, at most 300 KB).
Backend sets `VERIFYING`, calls the AI service, stores the result, updates the session.

```json
{
  "verificationId": "…",
  "status": "VERIFIED",
  "reason": null,
  "attemptsRemaining": 2,
  "closed": true,
  "nextCheckDueAt": "2026-09-22T10:00:00Z",
  "sessionVerificationStatus": "VERIFIED"
}
```
`closed` tells the UI whether the check is finished (`true`) or the intern may retry (`false`). `nextCheckDueAt` is `null` while the check is still open. The match score is **never** returned to the browser.

Edge cases (implemented in `mock-backend/`, proposed for the real backend):
- **No registered face:** 200 with `reason: "NOT_REGISTERED"`. No attempt is used and the AI service is not called.
- **AI service down or timed out:** 200 with `reason: "SERVICE_ERROR"`. No attempt is used, so a broken service never counts against the intern.
- **Double submit:** second request gets 409 `VERIFICATION_IN_PROGRESS`.
- **Check already finished:** 409 `VERIFICATION_CLOSED`, or 409 `VERIFICATION_EXPIRED` if the window lapsed.
- **Not a JPEG:** 400 `INVALID_FRAME`. **Frame over 300 KB:** 413 `FRAME_TOO_LARGE`. Neither uses an attempt.

On a rejected frame: `status: "FAILED"` (with `reason`) while `attemptsRemaining > 0` and the window is still open, meaning the intern can retry. When attempts run out or the window closes, the check is closed and the session's `verificationStatus` becomes `UNVERIFIED`.

### 5.4 `GET /verifications/history?internId=&from=&to=&page=` (INTERN own, ADMIN any)
```json
{ "items": [ { "verificationId":"…", "sessionId":"…", "requestedAt":"…", "verifiedAt":"…|null",
               "status":"VERIFIED", "reason":null, "attempts":1 } ], "page":1, "total":16 }
```

### 5.5 Face registration (PROPOSED; not named in any doc yet)
- `POST /verifications/registration` (INTERN or ADMIN for an intern): `multipart` with 3 to 5 frames. Response: `{ "registered": true }`. No template is returned.
- `GET /verifications/registration` returns `{ "registered": true|false, "registeredAt": "…" }`.

### 5.6 Admin data (Akanksha's admin table and profile)
Admin intern list and intern profile include a `verification` block:
`{ "status": "VERIFIED|FAILED|UNVERIFIED|PENDING", "lastVerifiedAt": "…", "nextCheckDueAt": "…", "failedCount": 1, "unverifiedCount": 0 }`
Colors: Verified green, Failed red, Unverified orange, Pending yellow.

## 6. Internal AI service (Express → Python; never called by the browser)

Header: `X-API-Key: $FACE_VERIFICATION_KEY`. Base URL: `$FACE_VERIFICATION_URL`.

| Call | Body | Returns |
|---|---|---|
| `GET /health` | none | `{ "ok": true }` |
| `POST /v1/register` | multipart `frames` (3 to 5 JPEGs) | 200 `{ "template": "<opaque encrypted string>" }`, or 422 `{ "error": "NO_FACE" \| "MULTIPLE_FACES" \| "LOW_QUALITY" \| "INCONSISTENT_FRAMES", "frameIndex": 1 }` |
| `POST /v1/verify` | multipart `frame` (one JPEG) + form field `template` | 200 `{ "decision": "MATCH" \| "NO_MATCH" \| "NO_FACE" \| "MULTIPLE_FACES" \| "LOW_QUALITY", "confidence": 0.81 }` (`confidence` is null when no face was compared) |

Other errors are 400 (`INVALID_REQUEST`, `INVALID_IMAGE`, `INVALID_TEMPLATE`) and 401 (`UNAUTHORIZED`), always as `{ "error": CODE, "message": "…" }`.
Express maps the AI decision to the check result: `MATCH` → `VERIFIED`, `NO_MATCH` → `FAILED` with reason `NO_MATCH`, and the other three decisions → `FAILED` with the same reason code.
`INCONSISTENT_FRAMES` (registration frames showing different people) is a registration-only error.

The service is **stateless and stores nothing**. Decision only. It should answer within about 2 s, with a 5 s hard timeout on Express's side, which returns `SERVICE_ERROR`, not a false result. Full details are in `ai-service/README.md`.

## 7. Scheduling rules (PROPOSED defaults, all env-configurable)

| Setting | Default |
|---|---|
| `VERIFICATION_INTERVAL_MINUTES` | 30, measured in **official active time** (breaks excluded) |
| `VERIFICATION_WINDOW_MINUTES` | 5 to complete a due check |
| `VERIFICATION_MAX_ATTEMPTS` | 3 per check |
| During BREAK | Clock paused, no checks issued; on RESUME the interval continues |
| At 28,800 active seconds | Session `COMPLETED`, no further checks |
| `attendanceSystemActive = false` | `verificationActive=false`, UI shows "unofficial/testing" |

## 8. Frontend component contract (Akanksha ↔ Soham)

Soham delivers one self-contained component, plus the small service it uses:

```
<PresenceVerification />        // mounts once inside the authenticated intern layout
```
- Reads `GET /verifications/status`. Shows the notification banner when `current.status === PENDING`, and opens the modal on "Verify Presence".
- Modal states: permission request → live preview + positioning guidance → verifying (loading) → success / failed+retry / camera error / multiple faces / no face / expired.
- Uses only `verificationService` (no `fetch`/`axios` in components, per Akanksha's rule).
- Emits `onStatusChange(status)` so the dashboard can refresh the session card (Active / Presence Unverified).
- Close behaviour: while a check is `PENDING` or `FAILED`-with-attempts, closing only minimises to the banner. The check stays due until it expires.

Camera capture stays in memory: `getUserMedia` → canvas → JPEG blob → upload → discarded. **PROPOSED stack: React.** Akanksha to confirm the framework.

## 9. Security checklist for Adarsh

- Intern can act only on their own `verificationId`. Admin can read all and write none.
- `verify` is accepted only when status is `PENDING`/`FAILED` with attempts left and before `expiresAt`.
- Rate-limit `verify` (for example 10 per minute per user). Reject oversized frames.
- Face templates: stored encrypted, excluded from every API projection, never logged. **PROPOSED:** stored in MongoDB by Express (so the main platform owns the data) and passed to the AI service per request.
- Log verification events to `audit_logs`, but never frames or templates.

## 10. Open decisions

| # | Question | Proposed answer | Who decides |
|---|---|---|---|
| 1 | Who stores face templates? | Express/MongoDB, encrypted; AI service stateless | Adarsh + Soham |
| 2 | Is `CAMERA_ERROR` frontend-only? | Yes | Adarsh + Akanksha |
| 3 | Attempts per check / window length | 3 attempts / 5 min | Team lead |
| 4 | Check interval on active time vs wall clock | Active time, paused on break | Adarsh |
| 5 | How does the UI learn a check is due? | Poll `/status` about every 15 s, or piggyback on heartbeat | Adarsh + Akanksha |
| 6 | What do `EXPIRED` and `UNVERIFIED` each mean? | `EXPIRED` = check window lapsed, `UNVERIFIED` = the resulting session-level status | Adarsh |
| 7 | Frontend framework (React / Next.js)? | React component, framework-agnostic | Akanksha |
| 8 | Face registration endpoints and who triggers registration during onboarding | Section 5.5 | Adarsh + Soham |
