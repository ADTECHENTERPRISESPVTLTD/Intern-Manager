"""Downloads the two ONNX models from the OpenCV model zoo and verifies their SHA-256."""
import hashlib
import sys
import urllib.request
from pathlib import Path

BASE = "https://github.com/opencv/opencv_zoo/raw/main/models"
MODELS_DIR = Path(__file__).resolve().parent.parent / "models"
MODELS = {
    "face_detection_yunet_2023mar.onnx": (
        f"{BASE}/face_detection_yunet/face_detection_yunet_2023mar.onnx",
        "8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4",
    ),
    "face_recognition_sface_2021dec.onnx": (
        f"{BASE}/face_recognition_sface/face_recognition_sface_2021dec.onnx",
        "0ba9fbfa01b5270c96627c4ef784da859931e02f04419c829e83484087c34e79",
    ),
}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    MODELS_DIR.mkdir(exist_ok=True)
    for name, (url, expected) in MODELS.items():
        target = MODELS_DIR / name
        if target.exists() and sha256(target) == expected:
            print(f"ok      {name}")
            continue
        print(f"fetch   {name}")
        urllib.request.urlretrieve(url, target)
        if sha256(target) != expected:
            target.unlink()
            print(f"FAILED  {name}: checksum mismatch", file=sys.stderr)
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
