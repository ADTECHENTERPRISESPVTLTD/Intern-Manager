"""Builds the fake-camera videos and registration photos used by the browser tests.

Chrome/Edge can play a .y4m file as if it were a webcam (--use-file-for-fake-video-capture).
Run with the face service's Python (it has OpenCV):  ai-service/.venv/Scripts/python e2e/make-fixtures.py
"""
from pathlib import Path

import cv2
import numpy as np

HERE = Path(__file__).resolve().parent
OUT = HERE / ".fixtures"
SOURCE = HERE.parents[1] / "ai-service" / "tests" / "fixtures" / "lena.jpg"


def write_y4m(path: Path, frame_bgr, frames: int = 10) -> None:
    h, w = frame_bgr.shape[:2]
    yuv = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2YUV_I420)
    with open(path, "wb") as f:
        f.write(f"YUV4MPEG2 W{w} H{h} F30:1 Ip A1:1 C420jpeg\n".encode())
        for _ in range(frames):
            f.write(b"FRAME\n")
            f.write(yuv.tobytes())


def blank():
    return np.zeros((480, 640, 3), np.uint8)


def main() -> None:
    OUT.mkdir(exist_ok=True)
    lena = cv2.imread(str(SOURCE))
    if lena is None:
        raise SystemExit(f"cannot read {SOURCE}")

    one = blank()
    one[:, 80:560] = cv2.resize(lena, (480, 480))
    write_y4m(OUT / "cam_lena.y4m", one)  # one clear face

    write_y4m(OUT / "cam_blank.y4m", blank())  # nobody in front of the camera

    two = blank()
    small = cv2.resize(lena, (320, 320))
    two[80:400, 0:320] = small
    two[80:400, 320:640] = cv2.flip(small, 1)
    write_y4m(OUT / "cam_two.y4m", two)  # two faces

    cv2.imwrite(str(OUT / "lena1.jpg"), lena)
    cv2.imwrite(str(OUT / "lena2.jpg"), cv2.flip(lena, 1))
    cv2.imwrite(str(OUT / "lena3.jpg"), cv2.convertScaleAbs(lena, alpha=1, beta=25))
    print("fixtures written to", OUT)


if __name__ == "__main__":
    main()
