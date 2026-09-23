import io
import struct

import cv2
import numpy as np
import pytest

from app import create_app
from app.config import ConfigError, Settings, load_settings
from app.face_engine import FaceEngine, InvalidImage, jpeg_dimensions
from app.ratelimit import RateLimiter

from .conftest import API_KEY, jpeg

AUTH = {"X-API-Key": API_KEY}


def fake_jpeg_claiming(width: int, height: int) -> bytes:
    """A tiny file whose header claims a huge picture. Decoding it for real would eat gigabytes."""
    sof = b"\xff\xc0" + struct.pack(">HBHHB", 11, 8, height, width, 1) + b"\x01\x11\x00"
    return b"\xff\xd8\xff\xe0\x00\x04\x00\x00" + sof + b"\xff\xda\x00\x02" + b"\x00" * 16


# ---- JPEG-only input, size checked before decoding ----------------------------------------------
def test_jpeg_dimensions_match_the_real_image(lena):
    assert jpeg_dimensions(jpeg(lena)) == (512, 512)


def test_jpeg_dimensions_of_a_non_square_frame(blank):
    assert jpeg_dimensions(jpeg(blank)) == (640, 480)


def test_png_is_rejected(strict_engine, lena):
    png = cv2.imencode(".png", lena)[1].tobytes()
    with pytest.raises(InvalidImage):
        strict_engine.analyze(png)


@pytest.mark.parametrize("junk", [b"", b"\xff", b"\xff\xd8", b"\xff\xd8\xff", b"GIF89a....", b"\x00" * 100])
def test_junk_is_rejected(strict_engine, junk):
    with pytest.raises(InvalidImage):
        strict_engine.analyze(junk)


def test_truncated_jpeg_header_is_rejected(strict_engine, lena):
    with pytest.raises(InvalidImage):
        strict_engine.analyze(jpeg(lena)[:20])


def test_huge_claimed_dimensions_are_refused_before_decoding(strict_engine):
    bomb = fake_jpeg_claiming(60000, 60000)
    assert len(bomb) < 100
    with pytest.raises(InvalidImage, match="too large"):
        strict_engine.analyze(bomb)


def test_normal_webcam_size_is_not_refused(strict_engine, blank):
    assert strict_engine.analyze(jpeg(blank)).status == "NO_FACE"


# ---- Rate limiting -----------------------------------------------------------------------------
def test_limiter_allows_up_to_the_limit_then_blocks():
    now = [0.0]
    limiter = RateLimiter(3, 60, clock=lambda: now[0])
    assert [limiter.allow() for _ in range(4)] == [True, True, True, False]


def test_limiter_window_slides():
    now = [0.0]
    limiter = RateLimiter(2, 60, clock=lambda: now[0])
    assert limiter.allow() and limiter.allow() and not limiter.allow()
    now[0] = 61.0
    assert limiter.allow()


def test_limiter_can_be_switched_off():
    limiter = RateLimiter(0)
    assert all(limiter.allow() for _ in range(1000))


def test_limiter_says_how_long_to_wait():
    now = [0.0]
    limiter = RateLimiter(1, 60, clock=lambda: now[0])
    limiter.allow()
    now[0] = 10.0
    assert 49 <= limiter.retry_after() <= 51


def _limited_client(service, template_key):
    settings = Settings(api_key=API_KEY, template_key=template_key, rate_limit_per_minute=3)
    app = create_app(settings, service)
    return app.test_client()


def test_api_returns_429_with_retry_after(service, template_key):
    client = _limited_client(service, template_key)
    call = lambda: client.post("/v1/verify", data={}, headers=AUTH, content_type="multipart/form-data")
    assert [call().status_code for _ in range(3)] == [400, 400, 400]
    blocked = call()
    assert blocked.status_code == 429
    assert blocked.get_json()["error"] == "RATE_LIMITED"
    assert int(blocked.headers["Retry-After"]) >= 1


def test_health_and_strangers_do_not_use_up_the_quota(service, template_key):
    client = _limited_client(service, template_key)
    for _ in range(10):
        client.get("/health")
        client.post("/v1/verify", headers={"X-API-Key": "wrong"})
    resp = client.post("/v1/verify", data={}, headers=AUTH, content_type="multipart/form-data")
    assert resp.status_code == 400  # still allowed: the strangers were not counted


# ---- Response headers, oversized fields --------------------------------------------------------
def test_responses_are_never_cacheable(client):
    for resp in (client.get("/health"), client.post("/v1/verify", headers=AUTH)):
        assert resp.headers["Cache-Control"] == "no-store"
        assert resp.headers["X-Content-Type-Options"] == "nosniff"


def test_absurdly_long_template_is_rejected(client, david2):
    resp = client.post(
        "/v1/verify",
        data={"frame": (io.BytesIO(jpeg(david2)), "f.jpg"), "template": "A" * 40_000},
        headers=AUTH,
        content_type="multipart/form-data",
    )
    assert resp.status_code == 400
    assert resp.get_json()["error"] == "INVALID_TEMPLATE"


def test_png_upload_is_a_400_over_http(client, lena):
    png = cv2.imencode(".png", lena)[1].tobytes()
    resp = client.post(
        "/v1/register",
        data={"frames": [(io.BytesIO(png), f"{i}.png") for i in range(3)]},
        headers=AUTH,
        content_type="multipart/form-data",
    )
    assert resp.status_code == 400
    assert resp.get_json()["error"] == "INVALID_IMAGE"


# ---- Startup checks ----------------------------------------------------------------------------
GOOD = {"FACE_VERIFICATION_KEY": "k" * 32, "TEMPLATE_ENCRYPTION_KEY": "t" * 44}


def test_good_config_loads():
    assert load_settings(GOOD).rate_limit_per_minute == 120


@pytest.mark.parametrize(
    "env",
    [
        {},
        {"FACE_VERIFICATION_KEY": "k" * 32},
        {**GOOD, "FACE_VERIFICATION_KEY": "change-me-long-random-string"},
        {**GOOD, "TEMPLATE_ENCRYPTION_KEY": "change-me-generate-with-command-above"},
        {**GOOD, "FACE_VERIFICATION_KEY": "short"},
    ],
)
def test_bad_config_refuses_to_start(env):
    with pytest.raises(ConfigError):
        load_settings(env)


def test_missing_model_file_gives_a_helpful_message(tmp_path, template_key):
    settings = Settings(api_key=API_KEY, template_key=template_key, detector_model=tmp_path / "nope.onnx")
    with pytest.raises(ConfigError, match="download_models.py"):
        FaceEngine(settings)


def test_rate_limit_is_configurable_from_the_environment():
    assert load_settings({**GOOD, "RATE_LIMIT_PER_MINUTE": "5"}).rate_limit_per_minute == 5
