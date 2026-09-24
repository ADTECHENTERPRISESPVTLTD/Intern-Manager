"""Face detection, quality checks and embedding. Images live in memory only."""
import threading
from dataclasses import dataclass
from typing import Optional

import cv2
import numpy as np

from .config import ConfigError, Settings

OK = "OK"
NO_FACE = "NO_FACE"
MULTIPLE_FACES = "MULTIPLE_FACES"
LOW_QUALITY = "LOW_QUALITY"


class InvalidImage(ValueError):
    pass


def jpeg_dimensions(data: bytes):
    """Reads (width, height) from a JPEG header without decoding pixels. None if it is not a JPEG."""
    if len(data) < 4 or data[0] != 0xFF or data[1] != 0xD8 or data[2] != 0xFF:
        return None
    i = 2
    n = len(data)
    while i + 3 < n:
        if data[i] != 0xFF:
            return None
        marker = data[i + 1]
        if marker == 0xFF:  # fill byte
            i += 1
            continue
        if marker == 0xD9 or marker == 0xDA:  # end of image / start of scan reached before any frame header
            return None
        if 0xD0 <= marker <= 0xD7 or marker in (0x01, 0xD8):  # markers that carry no length
            i += 2
            continue
        length = (data[i + 2] << 8) | data[i + 3]
        if marker in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
            if i + 9 > n:
                return None
            height = (data[i + 5] << 8) | data[i + 6]
            width = (data[i + 7] << 8) | data[i + 8]
            return (width, height) if width and height else None
        i += 2 + length
    return None


@dataclass
class Analysis:
    status: str
    embedding: Optional[np.ndarray] = None


class FaceEngine:
    def __init__(self, settings: Settings):
        self._s = settings
        for model in (settings.detector_model, settings.recognizer_model):
            if not model.exists():
                raise ConfigError(f"Model file missing: {model.name}. Run: python scripts/download_models.py")
        self._detector = cv2.FaceDetectorYN.create(
            str(settings.detector_model), "", (320, 320), settings.detection_score_threshold, 0.3, 50
        )
        self._recognizer = cv2.FaceRecognizerSF.create(str(settings.recognizer_model), "")
        # The OpenCV models keep internal state, so calls are serialised.
        self._lock = threading.Lock()

    def analyze(self, image_bytes: bytes) -> Analysis:
        img = self._decode(image_bytes)
        with self._lock:
            self._detector.setInputSize((img.shape[1], img.shape[0]))
            _, faces = self._detector.detect(img)
            if faces is None or len(faces) == 0:
                return Analysis(NO_FACE)

            faces = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)
            main = faces[0]
            main_area = main[2] * main[3]
            significant = [f for f in faces if f[2] * f[3] >= self._s.secondary_face_area_ratio * main_area]
            if len(significant) > 1:
                return Analysis(MULTIPLE_FACES)

            if not self._quality_ok(img, main):
                return Analysis(LOW_QUALITY)

            aligned = self._recognizer.alignCrop(img, main)
            feature = self._recognizer.feature(aligned)
        return Analysis(OK, np.asarray(feature, dtype=np.float32).reshape(-1).copy())

    def _decode(self, image_bytes: bytes) -> np.ndarray:
        # Only JPEG is accepted, and its size is checked from the header BEFORE any pixels are decoded.
        dims = jpeg_dimensions(image_bytes)
        if dims is None:
            raise InvalidImage("not a JPEG")
        if dims[0] * dims[1] > self._s.max_input_pixels:
            raise InvalidImage("image dimensions too large")
        buf = np.frombuffer(image_bytes, dtype=np.uint8)
        img = cv2.imdecode(buf, cv2.IMREAD_COLOR) if buf.size else None
        if img is None:
            raise InvalidImage("not a decodable image")
        longest = max(img.shape[:2])
        if longest > self._s.max_image_side:
            scale = self._s.max_image_side / longest
            img = cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
        return img

    def _quality_ok(self, img: np.ndarray, face: np.ndarray) -> bool:
        s = self._s
        x, y, w, h = (float(v) for v in face[:4])
        ih, iw = img.shape[:2]
        if min(w, h) < s.min_face_px:
            return False
        # Face must not be cut off by the frame edge.
        if x < -0.05 * w or y < -0.05 * h or x + w > iw + 0.05 * w or y + h > ih + 0.05 * h:
            return False
        x0, y0 = max(int(x), 0), max(int(y), 0)
        x1, y1 = min(int(x + w), iw), min(int(y + h), ih)
        crop = cv2.cvtColor(img[y0:y1, x0:x1], cv2.COLOR_BGR2GRAY)
        if crop.size == 0:
            return False
        brightness = float(crop.mean())
        if not (s.min_brightness <= brightness <= s.max_brightness):
            return False
        sharpness = cv2.Laplacian(cv2.resize(crop, (112, 112)), cv2.CV_64F).var()
        return sharpness >= s.min_sharpness


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    denom = float(np.linalg.norm(a) * np.linalg.norm(b))
    return float(np.dot(a, b) / denom) if denom else 0.0
