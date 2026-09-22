# Deploying the face service (Render)

**Status: these settings are UNTESTED.** I could not try Render or Docker from this machine. They follow Render's standard Python setup, but expect to adjust once when you deploy for real. Locally everything is tested (see `docs/TESTING-RESULTS.md`).

The face service is its own service, separate from the Node backend. The backend calls it over HTTPS with a secret key.

## Render settings (new "Web Service", connect the repo)

| Field | Value |
|---|---|
| Root Directory | `ai-service` |
| Runtime | Python 3 |
| Build Command | `pip install -r requirements.txt && python scripts/download_models.py` |
| Start Command | `gunicorn --workers 1 --threads 4 --timeout 30 --bind 0.0.0.0:$PORT wsgi:app` |
| Health Check Path | `/health` |

**Environment variables** (Render dashboard, "Environment"; never put these in Git):

| Name | Value |
|---|---|
| `FACE_VERIFICATION_KEY` | a long random string (16+ characters). Use the **same** value in the Node backend. |
| `TEMPLATE_ENCRYPTION_KEY` | a Fernet key. Generate one with `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`. **Keep a safe copy: if it is lost or changed, every registered face stops working and everyone must register again.** |
| `PYTHON_VERSION` | e.g. `3.12.3` (any 3.10+; it was developed on 3.14) |
| `RATE_LIMIT_PER_MINUTE` | optional, default 120 |

Then in the Node backend set `FACE_VERIFICATION_URL` to the Render URL (e.g. `https://face-service-xxxx.onrender.com`) and the same `FACE_VERIFICATION_KEY`.

## Notes

- **Why `--workers 1`:** each worker loads the face models into memory (roughly 200 to 300 MB), and the built-in rate limiter counts per worker. One worker with a few threads handles this workload easily (about 30 ms per verification).
- **Memory:** a 512 MB instance should be enough for one worker, but is untested. If it restarts with an out-of-memory error, use the next size up.
- **Free plans sleep** after inactivity, so the first check after a quiet period can be slow or fail once. The backend already treats a slow or unreachable service as `SERVICE_ERROR` without using an attempt, but for real use pick a plan that stays awake.
- **Public but locked:** the service is reachable from the internet but every call except `/health` needs the key. Keep the key secret.
- The models are downloaded during the build (checksum-verified), not stored in Git.

## Linux/macOS locally

```bash
cd ai-service
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python scripts/download_models.py
cp .env.example .env     # then put real values in it
python wsgi.py           # http://127.0.0.1:5001
```
