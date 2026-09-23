# How to run the presence-verification feature

Another developer should be able to follow this page alone and get the whole feature running. Tested on Windows 11 with Python 3.14, Node 24 and npm 11.

## What the pieces are

| Folder | What it is | Port | Who normally owns it |
|---|---|---|---|
| `ai-service/` | Python face service: "is this the registered person?" | 5001 | Soham |
| `presence-verification/` | React components (popup, registration) + a demo page | 5173 | Soham (the components), Akanksha (her real dashboard replaces the demo page) |
| `mock-backend/` | **Throwaway** fake of Adarsh's backend, so the flow can be demoed early | 4000 | Delete it when the real backend is ready |
| `backend-integration/` | A ready-made TypeScript file the real Node backend copies to call the face service (no Python needed), plus a guide for the backend developer | none | Adarsh copies it |
| `docs/` | The API contract and these guides | none | none |

```
Browser  ->  Backend (mock for now, Adarsh's later)  ->  ai-service
(camera)        decides everything, stores results        answers MATCH / NO_MATCH / ...
```

## Prerequisites

- Python 3.10 or newer, Node 22 or newer
- Chrome, Edge or Firefox for the camera demo (Safari has not been tested)
- Internet on first run (Python and npm packages, plus a 39 MB model download)

## One-time setup

From the project root:

```powershell
# 1. Face service
cd ai-service
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe scripts\download_models.py      # 2 face models, checksum-verified
cd ..

# 2. Mock backend and demo page
cd mock-backend;          npm install; cd ..
cd presence-verification; npm install; cd ..
```

Linux/macOS: use `.venv/bin/python` instead of `.\.venv\Scripts\python.exe`.

## Easiest: start everything with one command

```powershell
powershell -ExecutionPolicy Bypass -File scripts\start-demo.ps1
```

It creates `ai-service\.env` with fresh random secrets if it is missing, starts all three servers with demo timings (a check every **30 seconds**, a 2-minute answer window, 3 attempts), waits until each answers, and prints the address. Then open **http://localhost:5173**.

> Use `localhost`, not `127.0.0.1` or a network IP. Browsers only allow the camera on `localhost` or `https`.

**Only the face service** (what the backend developer needs; no mock, no demo page):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\start-demo.ps1 -FaceServiceOnly
```
It prints the two values to put in the backend's `.env`. Deployment notes are in `ai-service/DEPLOY.md`, and the backend developer's guide is `backend-integration/README.md`.

Stop it:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\stop-demo.ps1
```

Logs are in `scripts\.logs\`.

## Or start each piece by hand (three terminals)

```powershell
# Terminal 1: face service
cd ai-service
copy .env.example .env      # then put real values in it (commands are inside the file)
.\.venv\Scripts\python.exe wsgi.py

# Terminal 2: mock backend
cd mock-backend
copy .env.example .env      # set FACE_VERIFICATION_KEY to the same value as ai-service\.env
npm start

# Terminal 3: demo page
cd presence-verification
npm run dev
```

## Try it

1. Log in as `intern@demo.local` / `demo123`. Allow the camera when asked.
2. **Register your face** (5 photos, from a few angles). This happens once.
3. Click **Start Official Work Session**, then **Skip ahead 30 s**. The popup appears by itself.
4. Click **Verify Presence**, then **Verify Now**. You should see **Presence Verified**.

The buttons under "Demo controls" fast-forward the *server's* clock so you never wait 30 minutes. The full walkthrough for recording a video is in `docs/DEMO-SCRIPT.md`.

## Running the real Intern-Manager app instead of the standalone demo

Everything above runs the standalone `presence-verification/` demo page. To see the feature inside
Akanksha's actual app (`Intern-Manager/`) - the real login, dashboard, admin pages, and the
enforcement behavior below - run that instead:

```powershell
# Terminal 1 and 2: ai-service and mock-backend, same as above

# Terminal 3: the real app
cd Intern-Manager
npm install
npm run dev
```

Open `http://localhost:5173`. This talks to the mock-backend directly over plain HTTP, which is
fine on the same machine.

**To test on a phone (or any second device) on the same network**, the browser's camera API
requires `https://` for any address that isn't `localhost` - a plain `http://<LAN-IP>` link will
show "Camera Not Supported" with no way through. Start both servers in HTTPS mode instead:

```powershell
# mock-backend
$env:HOST="0.0.0.0"; $env:HTTPS="1"; npm start
# (first time only) generate a cert: scripts\generate-local-cert.sh <your-lan-ip>

# Intern-Manager
$env:VITE_HTTPS="1"; npm run dev
```

The frontend calls the backend through Vite's dev-server proxy (`/api/*` in `vite.config.js`,
proxied to `MOCK_BACKEND_TARGET`, default `https://127.0.0.1:4000`) rather than a separate
cross-origin request - this means there is exactly **one** self-signed-certificate warning to
accept in the browser, not two. Open `https://<your-lan-ip>:5173` on the phone, accept that one
warning, and log in as usual.

### Enforcement: a failed check pauses the session, not just logs it

Unlike the standalone demo, the real app's mock-backend does not just record a failed or expired
check as a flag for admins - it actually pauses the session (`LOCKED`, clock frozen, exactly like
a break) and opens a new check immediately so the intern can retry. After
`VERIFICATION_MAX_FAILED_CHECKS` (default 3) failed checks in one session, the session ends as
`INCOMPLETE` and does not count toward attendance; the intern can start a fresh session right
away. See `mock-backend/src/engine.js` for the state machine.

## Running the tests

| What | Command (from the folder) | Needs servers running? |
|---|---|---|
| Face service | `cd ai-service` then `.\.venv\Scripts\python.exe -m pytest -q` | No |
| Mock backend | `cd mock-backend` then `npm test` | No (it fakes the face service) |
| Popup components | `cd presence-verification` then `npm test` | No (camera is mocked) |
| Backend client (TypeScript) | `cd backend-integration` then `npm install`, `npm test` and `npm run typecheck` | No (uses a fake face service) |
| Production build | `cd presence-verification` then `npm run build` | No |
| **Real browser** | `cd presence-verification` then `npm run e2e` (add `-- --browser edge` or `-- --browser firefox`) | **Yes**: start the demo first |

For Firefox, run `npx playwright-core install firefox` once first (a 122 MB download). Firefox skips the two scenarios that need a real face on camera (`verify`, `two`), because its fake camera cannot show one; try those by hand with your webcam.

The real-browser run plays a video file as a fake webcam. It saves screenshots to `presence-verification\e2e\shots\`. Results are written up in `docs/TESTING-RESULTS.md`.

## Settings (environment variables)

| Variable | Where | Meaning | Demo value | Real default |
|---|---|---|---|---|
| `FACE_VERIFICATION_KEY` | ai-service **and** the backend | Shared secret, sent as `X-API-Key`. Same value on both sides. | random | required, 16+ chars |
| `TEMPLATE_ENCRYPTION_KEY` | ai-service only | Encrypts stored face templates. **Losing it invalidates every registered face.** | random | required |
| `FACE_VERIFICATION_URL` | backend | Where the face service lives | `http://127.0.0.1:5001` | none |
| `VERIFICATION_INTERVAL_SECONDS` | backend | Active work time between checks | 30 | 1800 |
| `VERIFICATION_WINDOW_SECONDS` | backend | Time allowed to answer a check | 120 | 300 |
| `VERIFICATION_MAX_ATTEMPTS` | backend | Tries per check | 3 | 3 |
| `VERIFICATION_MAX_FAILED_CHECKS` | mock backend | Failed/expired checks allowed before the session ends as `INCOMPLETE` | 3 | n/a |
| `SESSION_TARGET_SECONDS` | backend | Official work target | 28800 | 28800 |
| `ATTENDANCE_SYSTEM_ACTIVE` | backend | `false` = testing mode, checks off | true | true |
| `MOCK_DEV_ROUTES` | mock only | Enables the time-skip buttons. **Never on a real backend.** They require a valid login token, same as every other route - an unauthenticated call gets `401`. | true | n/a |
| `CORS_ORIGIN` | backend | Allowed website address(es) | `http://localhost:5173` | none |
| `VITE_API_BASE_URL` | demo page | Backend address | `http://127.0.0.1:4000/api/v1` | none |
| `VITE_HTTPS` | Intern-Manager frontend | `1` serves over a local self-signed HTTPS cert, needed for camera access from a phone/second device | unset | n/a |
| `HTTPS` / `HOST` | mock backend | `HTTPS=1` serves over the same self-signed cert; `HOST=0.0.0.0` binds beyond `localhost` so another device can reach it | unset / `127.0.0.1` | n/a |
| `MOCK_BACKEND_TARGET` | Intern-Manager frontend | Where Vite's dev-server proxy forwards `/api/*` | `http(s)://127.0.0.1:4000` | n/a |
| `MATCH_THRESHOLD`, `MIN_FACE_PX`, `MIN_SHARPNESS`, `RATE_LIMIT_PER_MINUTE` | ai-service | Matching strictness and limits. See `ai-service/README.md`. | defaults | defaults |

Each folder has a `.env.example` with placeholders only. **Never commit a real `.env`.**

## Switching from the mock to Adarsh's real backend

1. Point `VITE_API_BASE_URL` (or the `baseUrl` given to `createVerificationService`) at the real backend.
2. Make sure the real backend implements the endpoints and response shapes in `docs/verification-contract.md`.
3. Give the real backend the same `FACE_VERIFICATION_KEY` and set `FACE_VERIFICATION_URL` to the face service.
4. Delete `mock-backend/`. No component changes are needed if the contract is followed.

## Troubleshooting

| Problem | Fix |
|---|---|
| Camera never asks / "Camera Not Supported" | Open the page as `http://localhost:5173`, not by IP. Check the browser has camera permission for the site. |
| "Camera Access Required" | Click the camera icon in the address bar, allow it, press Try Again. |
| "Port 5001/4000/5173 is already in use" | Run `scripts\stop-demo.ps1`, or close the program using that port. |
| Face service says "Model file missing" | Run `python scripts\download_models.py` in `ai-service`. |
| Face service refuses to start about secrets | `.env` still has `change-me…` placeholders or a key under 16 characters. Generate real ones. |
| Popup says "Verification Unavailable" every time | The backend cannot reach the face service, or the two `FACE_VERIFICATION_KEY` values differ. Check `scripts\.logs\`. |
| "Face Registration Required" | The intern has no registered face. Register first. |
| Nothing happens after "Skip ahead" | The page checks the backend every 3 seconds in the demo. Wait a moment. |
| `.ps1` scripts are blocked | Run them with `powershell -ExecutionPolicy Bypass -File …` as shown above. |
