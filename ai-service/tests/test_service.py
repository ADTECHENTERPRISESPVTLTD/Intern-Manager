import cv2
import pytest
from cryptography.fernet import Fernet

from app.service import INCONSISTENT_FRAMES, MATCH, NO_MATCH, InvalidRequest
from app.template import InvalidTemplate, TemplateCodec

from .conftest import jpeg


@pytest.fixture()
def david_frames(david1, david2):
    return [jpeg(david1), jpeg(david2), jpeg(cv2.flip(david1, 1))]


def test_register_returns_opaque_template(service, david_frames):
    result = service.register(david_frames)
    assert result.error is None
    assert isinstance(result.template, str) and result.template


def test_same_person_matches(service, david_frames, david2):
    template = service.register(david_frames).template
    result = service.verify(jpeg(cv2.flip(david2, 1)), template)
    assert result.decision == MATCH
    assert result.confidence >= 0.363


def test_different_person_does_not_match(service, david_frames, lena):
    template = service.register(david_frames).template
    result = service.verify(jpeg(lena), template)
    assert result.decision == NO_MATCH


def test_registration_rejects_mixed_people(service, david1, lena, david2):
    result = service.register([jpeg(david1), jpeg(lena), jpeg(david2)])
    assert result.error == INCONSISTENT_FRAMES
    assert result.frame_index == 1


def test_registration_reports_which_frame_has_no_face(service, david1, david2, blank):
    result = service.register([jpeg(david1), jpeg(david2), jpeg(blank)])
    assert result.error == "NO_FACE"
    assert result.frame_index == 2


def test_registration_needs_enough_frames(service, david1, david2):
    with pytest.raises(InvalidRequest):
        service.register([jpeg(david1), jpeg(david2)])


def test_registration_rejects_too_many_frames(service, david1):
    with pytest.raises(InvalidRequest):
        service.register([jpeg(david1)] * 6)


def test_verify_without_face_gives_reason_and_no_confidence(service, david_frames, blank):
    template = service.register(david_frames).template
    result = service.verify(jpeg(blank), template)
    assert result.decision == "NO_FACE"
    assert result.confidence is None


def test_verify_rejects_garbage_template(service, david2):
    with pytest.raises(InvalidTemplate):
        service.verify(jpeg(david2), "not-a-template")


def test_template_from_another_key_is_rejected(service, david_frames):
    template = service.register(david_frames).template
    other = TemplateCodec(Fernet.generate_key().decode())
    with pytest.raises(InvalidTemplate):
        other.decode(template)


def test_template_does_not_leak_readable_embedding(service, david_frames):
    template = service.register(david_frames).template
    assert "[" not in template and "0." not in template
