# For the backend developer: connecting to the face service

**You do not need to know or touch any Python.** The face service is a small separate web service. Your Node/Express backend talks to it with two HTTP calls, and this folder gives you a ready-made, tested TypeScript file that makes them.

```
Browser  ->  YOUR backend (decides everything, stores results in MongoDB)  ->  face service (answers "same person?")
```

## What you do

### 1. Copy one file
Copy `faceVerificationClient.ts` into your backend, e.g. `backend/src/integrations/faceVerificationClient.ts`. Nothing to install: it uses only Node 18+ built-ins.

### 2. Add two environment variables (names from your task document)
```
FACE_VERIFICATION_URL=http://127.0.0.1:5001
FACE_VERIFICATION_KEY=<the same secret the face service was started with>
```

### 3. Use it
```ts
import { createFaceVerificationClient, toCheckOutcome,
         FaceServiceUnavailableError, FaceServiceRejectedFrameError,
         FaceRegistrationRejectedError } from "../integrations/faceVerificationClient";

const face = createFaceVerificationClient({
  baseUrl: process.env.FACE_VERIFICATION_URL!,
  apiKey: process.env.FACE_VERIFICATION_KEY!,
});

// Registration: 3 to 5 JPEG buffers from the upload. Store the returned string on the intern's record.
// It is encrypted and opaque; NEVER include it in any API response.
const template = await face.register(frames);

// Verification: one JPEG buffer + the stored template.
const { decision } = await face.verify(frame, template);
const { status, reason } = toCheckOutcome(decision);   // -> VERIFIED, or FAILED with a reason
```

### 4. Handle the three kinds of failure (this matters)

| Thrown | Meaning | What your API should do |
|---|---|---|
| `FaceServiceUnavailableError` | Face service down, slow (over 5 s), or wrong key | Answer the browser with `reason: "SERVICE_ERROR"` and **do not use up one of the intern's attempts** |
| `FaceServiceRejectedFrameError` | The upload was not a real JPEG | `400 INVALID_FRAME`, no attempt used |
| `FaceRegistrationRejectedError` | A registration photo was refused | `422`, with `error.reason` as the code (`NO_FACE`, `MULTIPLE_FACES`, `LOW_QUALITY`, `INCONSISTENT_FRAMES`) and `frameIndex` |

A `decision` other than `MATCH` (`NO_MATCH`, `NO_FACE`, `MULTIPLE_FACES`, `LOW_QUALITY`) is a normal result, not an error: `toCheckOutcome` turns it into `FAILED` plus that reason, and it **does** use an attempt.

## What is your backend's job (the face service does none of this)

The face service only answers "same person?". Everything else is yours, and it is all written down in `docs/verification-contract.md`. A working example of all of it exists in plain JavaScript and is easy to read, since you know Node:

| Your job | Where to see it working |
|---|---|
| The endpoints and response shapes | `mock-backend/src/app.js` (the `/verifications/...` routes) |
| When a check becomes due, breaks pausing the clock, expiry, attempts, 8-hour completion | `mock-backend/src/engine.js` (`tick`, `startSession`) |
| Every rule above, written as tests | `mock-backend/test/verification.test.js` (29 tests) |

The mock keeps everything in memory. In the real backend the same records go into MongoDB (`presence_verifications`, plus the template on the intern's profile), and the same tests are a good checklist.

## Rules that must hold in the real backend

- **The frontend never says "verified".** Only the backend sets that, from the face service's answer.
- **Time is the server's.** Never trust a timer or a value sent by the browser.
- **The template never leaves the backend.** Not in responses, logs or errors.
- **Camera frames are never stored** (not in MongoDB, not on disk, not in logs). Read them from the request, send to the face service, drop them.
- Only the authenticated intern may act on their own check. Admins can read everything and change nothing here.
- Rate-limit the verify endpoint per intern (the face service also limits itself, per process).

## Running the face service locally

One command from the project root (Windows):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\start-demo.ps1 -FaceServiceOnly
```

It sets everything up the first time (secrets, a 39 MB model download), starts the service on port 5001, and prints the two values to put in your `.env`. Stop it with `scripts\stop-demo.ps1`. On Linux/macOS or for deployment, see `ai-service/DEPLOY.md`.

## Check the file works

```bash
cd backend-integration
npm install
npm test          # 20 tests, no Python needed (uses a fake service)
npm run typecheck
```

## What we still need from you

1. The real endpoint names (the contract proposes `/api/v1/verifications/status`, `/request`, `/verify`, `/history` and `/registration`).
2. Confirmation of the retry rule: 3 attempts per check and 5 minutes to finish (still only a proposal).
3. Where the face service will run in production. Render is fine: see `ai-service/DEPLOY.md`. It is a separate Render service from your backend.
