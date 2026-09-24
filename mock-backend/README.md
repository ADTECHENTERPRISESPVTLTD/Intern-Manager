# Mock backend (THROWAWAY)

A small stand-in for Adarsh's backend so the presence-verification flow can be built and demoed **before the real backend exists**. It implements only the verification endpoints from `docs/verification-contract.md`, plus the bare minimum of login and sessions needed to trigger them.

**It is not the real backend and must never be deployed.** State is in memory and resets when it restarts. When Adarsh's API is ready, delete this folder and point the frontend at the real one. The response shapes are the same on purpose, so the frontend should need no changes.

## Run it

```bash
# terminal 1: the face service
cd ai-service && python wsgi.py                  # http://127.0.0.1:5001

# terminal 2: this mock
cd mock-backend
npm install
copy .env.example .env      # set FACE_VERIFICATION_KEY to the same value as ai-service/.env
npm start                   # http://127.0.0.1:4000
npm test                    # 28 tests, no Python needed (uses a fake face service)
```

## Demo accounts (password `demo123`)

| Email | Role |
|---|---|
| `intern@demo.local` | INTERN |
| `intern2@demo.local` | INTERN |
| `admin@demo.local` | ADMIN |

Send the token from `POST /api/v1/auth/login` as `Authorization: Bearer <token>`.

## Endpoints

All responses use `{ success, data, message }` or `{ success:false, message, code }`.

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | `/api/v1/auth/login` | any | Get a token |
| GET | `/api/v1/auth/me` | any | Current user |
| POST | `/api/v1/verifications/registration` | intern | Register face: multipart `frames` (3 to 5 JPEGs) |
| GET | `/api/v1/verifications/registration` | intern | `{registered, registeredAt}` |
| GET | `/api/v1/verifications/status` | intern | Is a check due? (poll this) |
| POST | `/api/v1/verifications/request` | intern | Open check, or 409 `VERIFICATION_NOT_DUE` |
| POST | `/api/v1/verifications/verify` | intern | multipart `verificationId` + `frame` (JPEG, max 300 KB) |
| GET | `/api/v1/verifications/history` | intern / admin | Own history, or `?internId=` for admin |
| GET | `/api/v1/admin/interns` | admin | Interns with session + verification summary |
| POST | `/api/v1/sessions/start` `/break` `/resume`, GET `/current` | intern | Minimal session so checks can trigger |
| POST | `/api/v1/dev/advance` `{seconds}` | anyone | **Demo only:** fast-forward the server clock |
| POST | `/api/v1/dev/reset` | anyone | **Demo only:** clear all mock state |

## Demo timings

`.env.example` uses a 30 s interval and a 120 s answer window so you don't wait 30 minutes. The real defaults (1800 s / 300 s / 3 attempts) apply if the variables are unset. `POST /dev/advance {"seconds": 1800}` jumps the server clock forward instead of waiting.

## Behaviour worth knowing

- **The server clock decides everything.** The browser can't claim a check passed or shift the schedule.
- **Breaks pause the 30-minute clock.** It counts active time only. Nothing is issued during a break.
- **Failed attempts:** up to 3 per check. After the third, the check closes and the session shows `UNVERIFIED`. An unanswered check expires the same way (status `EXPIRED`).
- **A broken face service is not the intern's fault.** The attempt is not consumed and the reason is `SERVICE_ERROR`.
- **No registered face:** `reason: NOT_REGISTERED`, no attempt consumed, and the face service is not called.
- **Double-clicking Verify:** the second request gets 409 `VERIFICATION_IN_PROGRESS`.
- **The match score is never returned to the browser**, so it can't be used to probe the system.
- After the official target (28,800 active seconds) the session is `COMPLETED` and no more checks are issued. Extra time adds nothing to the count.
