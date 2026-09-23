import cv2
import numpy as np
import pytest

from app.face_engine import LOW_QUALITY, MULTIPLE_FACES, NO_FACE, OK, InvalidImage

from .conftest import jpeg


def test_clear_face_gives_embedding(strict_engine, lena):
    result = strict_engine.analyze(jpeg(lena))
    assert result.status == OK
    assert result.embedding.shape == (128,)


def test_blank_frame_is_no_face(strict_engine, blank):
    assert strict_engine.analyze(jpeg(blank)).status == NO_FACE


def test_random_noise_is_no_face(strict_engine):
    noise = np.random.default_rng(0).integers(0, 255, (480, 640, 3), dtype=np.uint8)
    assert strict_engine.analyze(jpeg(noise)).status == NO_FACE


def test_too_dark_is_low_quality(strict_engine, lena):
    dark = cv2.convertScaleAbs(lena, alpha=0.25, beta=0)
    assert strict_engine.analyze(jpeg(dark)).status == LOW_QUALITY


def test_face_too_small_is_low_quality(strict_engine, lena):
    small = cv2.resize(lena, (256, 256))  # face ends up about 72px wide, under the 80px minimum
    assert strict_engine.analyze(jpeg(small)).status == LOW_QUALITY


def test_two_people_are_rejected(strict_engine, lena, david1):
    david_big = cv2.resize(david1, None, fx=2, fy=2)
    canvas = np.zeros((520, 1152, 3), np.uint8)
    canvas[:512, :512] = lena
    canvas[:480, 512:] = david_big
    assert strict_engine.analyze(jpeg(canvas)).status == MULTIPLE_FACES


def test_tiny_background_face_is_ignored(strict_engine, lena, david1):
    """A very small second face (poster, far away) must not block verification."""
    tiny = cv2.resize(david1, (40, 30))
    img = lena.copy()
    img[10:40, 10:50] = tiny
    assert strict_engine.analyze(jpeg(img)).status == OK


def test_undecodable_bytes_raise(strict_engine):
    with pytest.raises(InvalidImage):
        strict_engine.analyze(b"this is not an image")


def test_empty_bytes_raise(strict_engine):
    with pytest.raises(InvalidImage):
        strict_engine.analyze(b"")
