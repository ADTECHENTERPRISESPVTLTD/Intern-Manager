"""Test fixtures. Photos come from the OpenCV sample/test data (see tests/fixtures/README.md)."""
from pathlib import Path

import cv2
import numpy as np
import pytest
from cryptography.fernet import Fernet

from app import create_app
from app.config import Settings
from app.face_engine import FaceEngine
from app.service import VerificationService
from app.template import TemplateCodec

FIXTURES = Path(__file__).parent / "fixtures"
API_KEY = "test-api-key"


def jpeg(img: np.ndarray) -> bytes:
    return cv2.imencode(".jpg", img)[1].tobytes()


def load(name: str) -> np.ndarray:
    return cv2.imread(str(FIXTURES / f"{name}.jpg"))


@pytest.fixture(scope="session")
def template_key() -> str:
    return Fernet.generate_key().decode()


@pytest.fixture(scope="session")
def strict_settings(template_key) -> Settings:
    """Production defaults: used for the quality checks."""
    return Settings(api_key=API_KEY, template_key=template_key)


@pytest.fixture(scope="session")
def relaxed_settings(template_key) -> Settings:
    """Lower face-size/sharpness limits so the small 320x240 fixture photos can be compared."""
    return Settings(api_key=API_KEY, template_key=template_key, min_face_px=40, min_sharpness=1.0)


@pytest.fixture(scope="session")
def strict_engine(strict_settings) -> FaceEngine:
    return FaceEngine(strict_settings)


@pytest.fixture(scope="session")
def relaxed_engine(relaxed_settings) -> FaceEngine:
    return FaceEngine(relaxed_settings)


@pytest.fixture(scope="session")
def service(relaxed_settings, relaxed_engine, template_key) -> VerificationService:
    return VerificationService(relaxed_settings, relaxed_engine, TemplateCodec(template_key))


@pytest.fixture(scope="session")
def client(relaxed_settings, service):
    app = create_app(relaxed_settings, service)
    app.config["TESTING"] = True
    return app.test_client()


@pytest.fixture(scope="session")
def lena() -> np.ndarray:
    return load("lena")


@pytest.fixture(scope="session")
def david1() -> np.ndarray:
    return load("david1")


@pytest.fixture(scope="session")
def david2() -> np.ndarray:
    return load("david2")


@pytest.fixture()
def blank() -> np.ndarray:
    return np.zeros((480, 640, 3), np.uint8)
