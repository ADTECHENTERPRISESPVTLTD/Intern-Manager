# AI Presence-Verification Service

Small Flask service that answers one question: **is the person in this camera frame the registered intern?**
It is called only by the Node/Express backend, never by the browser. It stores nothing: no images, no templates, no database.

## How it works

1. **Detect** faces with OpenCV YuNet.
2. **Check the frame:** exactly one face, big enough (`MIN_FACE_PX`), not cut off, bright enough, sharp enough.
3. **Embed** the face into 128 numbers with OpenCV SFace.
4. **Compare** to the registered embeddings by cosine similarity. At or above `MATCH_THRESHOLD` (0.363) is a match.

Registration takes 3 to 5 frames, checks that they all show the same person, and returns an **encrypted template** (Fernet). The backend stores that string and sends it back with each verify call. Only this service holds the key, and the browser never sees a template.

## Setup

```bash
cd ai-service
python -m venv .venv
.venv\Scripts\activate            # Windows   (Linux/macOS: source .venv/bin/activate)
pip install -r requirements-dev.txt
python scripts/download_models.py # downloads 2 ONNX models (~39 MB), checksum-verified
copy .env.example .env            # then fill in the two secrets (commands are in the file)
python wsgi.py                    # http://127.0.0.1:5001
```

Run tests: `python -m pytest -q`

## Environment variables

| Name | Required | Purpose |
|---|---|---|
| `FACE_VERIFICATION_KEY` | yes | Shared secret. Express sends it as `X-API-Key`. |
| `TEMPLATE_ENCRYPTION_KEY` | yes | Fernet key that encrypts templates. **Losing it invalidates every registered face.** |
| `PORT` | no | Default 5001 |
| `MATCH_THRESHOLD` | no | Default 0.363. Higher is stricter. |
| `DETECTION_SCORE_THRESHOLD` | no | Default 0.8 |
| `MIN_FACE_PX` | no | Default 80 |
| `MIN_SHARPNESS` | no | Default 20 |
| `RATE_LIMIT_PER_MINUTE` | no | Default 120 requests/minute per process (0 = off). Per-intern limits belong in the main backend. |

The service **refuses to start** if a secret is missing, still says `change-me…`, or `FACE_VERIFICATION_KEY` is under 16 characters.

## API

All calls except `/health` need the header `X-API-Key: <FACE_VERIFICATION_KEY>`.

### `GET /health`
`{"ok": true}`

### `POST /v1/register` (multipart)
Field `frames`: 3 to 5 **JPEG** files (max 2 MB each). Other formats (PNG, GIF…) are rejected with `INVALID_IMAGE`, and the picture size is read from the JPEG header and refused if it is over 12 megapixels *before* any decoding happens.
- **200** `{"template": "<opaque string>"}`
- **422** `{"error": "NO_FACE" | "MULTIPLE_FACES" | "LOW_QUALITY" | "INCONSISTENT_FRAMES", "frameIndex": 1}`
- **400** `INVALID_REQUEST` (wrong number of frames), `INVALID_IMAGE`

### `POST /v1/verify` (multipart)
Fields: `frame` (one JPEG), `template` (string from register).
- **200** `{"decision": "MATCH" | "NO_MATCH" | "NO_FACE" | "MULTIPLE_FACES" | "LOW_QUALITY", "confidence": 0.81}`
  `confidence` is null unless a face was compared.
- **400** `INVALID_REQUEST`, `INVALID_IMAGE`, `INVALID_TEMPLATE`
- **401** `UNAUTHORIZED`
- **429** `RATE_LIMITED` (with a `Retry-After` header). Only callers holding the correct key count toward the limit.

Every response carries `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`.

Errors are always `{"error": CODE, "message": "..."}`. They never contain stack traces or file paths.

## Privacy

- Frames are decoded in memory and dropped. Nothing is written to disk.
- Logs record request lines and exception type only, never bodies.
- Templates are encrypted and only decodable with `TEMPLATE_ENCRYPTION_KEY`.

## Known limitations (be upfront with the team)

- **No liveness detection.** A printed photo or a photo on a phone held to the camera may pass. The task documents don't ask for liveness. It would be the natural next improvement.
- **Thresholds are not tuned on real interns' webcams.** The defaults come from OpenCV's published values and tests on public sample photos. Before launch, try it with a handful of volunteers and adjust `MATCH_THRESHOLD`, `MIN_FACE_PX` and `MIN_SHARPNESS`.
- Accuracy varies with lighting, glasses and angle. The retry policy (several attempts per check) is what absorbs this.
