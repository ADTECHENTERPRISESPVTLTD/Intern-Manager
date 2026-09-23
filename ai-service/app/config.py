import os
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping

BASE_DIR = Path(__file__).resolve().parent.parent
MODELS_DIR = BASE_DIR / "models"


class ConfigError(RuntimeError):
    pass


@dataclass(frozen=True)
class Settings:
    api_key: str
    template_key: str
    detector_model: Path = MODELS_DIR / "face_detection_yunet_2023mar.onnx"
    recognizer_model: Path = MODELS_DIR / "face_recognition_sface_2021dec.onnx"
    # Cosine similarity at or above this counts as the same person (OpenCV SFace default).
    match_threshold: float = 0.363
    detection_score_threshold: float = 0.8
    # A second face only counts as "another person" if it is at least this fraction of
    # the main face's area. Ignores tiny faces on posters or far in the background.
    secondary_face_area_ratio: float = 0.25
    min_face_px: int = 80
    min_sharpness: float = 20.0
    min_brightness: float = 40.0
    max_brightness: float = 220.0
    max_frame_bytes: int = 2 * 1024 * 1024
    max_image_side: int = 960
    min_register_frames: int = 3
    max_register_frames: int = 5
    # Refuse absurd image sizes before decoding (a tiny file can claim 60000x60000 pixels).
    max_input_pixels: int = 12_000_000
    max_template_chars: int = 32 * 1024
    # Per process. 0 turns the limiter off. Per-intern limits belong in the main backend.
    rate_limit_per_minute: int = 120


def load_settings(env: Mapping[str, str] = os.environ) -> Settings:
    api_key = env.get("FACE_VERIFICATION_KEY", "")
    template_key = env.get("TEMPLATE_ENCRYPTION_KEY", "")
    if not api_key or not template_key:
        raise ConfigError(
            "FACE_VERIFICATION_KEY and TEMPLATE_ENCRYPTION_KEY must be set (see .env.example)"
        )
    if api_key.lower().startswith("change-me") or template_key.lower().startswith("change-me"):
        raise ConfigError("Replace the placeholder secrets from .env.example with real ones")
    if len(api_key) < 16:
        raise ConfigError("FACE_VERIFICATION_KEY must be at least 16 characters")
    d = Settings(api_key=api_key, template_key=template_key)
    return Settings(
        api_key=api_key,
        template_key=template_key,
        rate_limit_per_minute=int(env.get("RATE_LIMIT_PER_MINUTE", d.rate_limit_per_minute)),
        match_threshold=float(env.get("MATCH_THRESHOLD", d.match_threshold)),
        detection_score_threshold=float(
            env.get("DETECTION_SCORE_THRESHOLD", d.detection_score_threshold)
        ),
        min_face_px=int(env.get("MIN_FACE_PX", d.min_face_px)),
        min_sharpness=float(env.get("MIN_SHARPNESS", d.min_sharpness)),
    )
