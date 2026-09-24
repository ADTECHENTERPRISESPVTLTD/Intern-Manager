import io

import cv2

from .conftest import API_KEY, jpeg

AUTH = {"X-API-Key": API_KEY}


def as_file(data: bytes, name: str = "frame.jpg"):
    return (io.BytesIO(data), name)


def register(client, images):
    data = {"frames": [as_file(jpeg(i), f"f{n}.jpg") for n, i in enumerate(images)]}
    return client.post("/v1/register", data=data, headers=AUTH, content_type="multipart/form-data")


def test_health_needs_no_key(client):
    assert client.get("/health").get_json() == {"ok": True}


def test_verify_without_key_is_401(client, david2):
    resp = client.post("/v1/verify", data={"frame": as_file(jpeg(david2)), "template": "x"})
    assert resp.status_code == 401
    assert resp.get_json()["error"] == "UNAUTHORIZED"


def test_wrong_key_is_401(client):
    resp = client.post("/v1/register", headers={"X-API-Key": "nope"})
    assert resp.status_code == 401


def test_register_then_verify_roundtrip(client, david1, david2):
    reg = register(client, [david1, david2, cv2.flip(david1, 1)])
    assert reg.status_code == 200
    template = reg.get_json()["template"]

    ok = client.post(
        "/v1/verify",
        data={"frame": as_file(jpeg(cv2.flip(david2, 1))), "template": template},
        headers=AUTH,
        content_type="multipart/form-data",
    )
    body = ok.get_json()
    assert ok.status_code == 200
    assert body["decision"] == "MATCH"
    assert 0.363 <= body["confidence"] <= 1.0


def test_verify_other_person_is_no_match(client, david1, david2, lena):
    template = register(client, [david1, david2, cv2.flip(david1, 1)]).get_json()["template"]
    resp = client.post(
        "/v1/verify",
        data={"frame": as_file(jpeg(lena)), "template": template},
        headers=AUTH,
        content_type="multipart/form-data",
    )
    assert resp.get_json()["decision"] == "NO_MATCH"


def test_register_rejection_is_422_with_reason(client, david1, david2, blank):
    resp = register(client, [david1, david2, blank])
    assert resp.status_code == 422
    assert resp.get_json() == {"error": "NO_FACE", "frameIndex": 2}


def test_register_with_too_few_frames_is_400(client, david1):
    resp = register(client, [david1])
    assert resp.status_code == 400
    assert resp.get_json()["error"] == "INVALID_REQUEST"


def test_verify_missing_fields_is_400(client):
    resp = client.post("/v1/verify", data={}, headers=AUTH, content_type="multipart/form-data")
    assert resp.status_code == 400
    assert resp.get_json()["error"] == "INVALID_REQUEST"


def test_verify_non_image_is_400(client, david1, david2):
    template = register(client, [david1, david2, cv2.flip(david1, 1)]).get_json()["template"]
    resp = client.post(
        "/v1/verify",
        data={"frame": as_file(b"definitely not a jpeg"), "template": template},
        headers=AUTH,
        content_type="multipart/form-data",
    )
    assert resp.status_code == 400
    assert resp.get_json()["error"] == "INVALID_IMAGE"


def test_verify_bad_template_is_400(client, david2):
    resp = client.post(
        "/v1/verify",
        data={"frame": as_file(jpeg(david2)), "template": "garbage"},
        headers=AUTH,
        content_type="multipart/form-data",
    )
    assert resp.status_code == 400
    assert resp.get_json()["error"] == "INVALID_TEMPLATE"


def test_unknown_route_is_json_404(client):
    resp = client.get("/nope")
    assert resp.status_code == 404
    assert resp.get_json()["error"] == "NOT_FOUND"


def test_errors_never_leak_internals(client):
    resp = client.post("/v1/verify", data={}, headers=AUTH, content_type="multipart/form-data")
    text = resp.get_data(as_text=True)
    assert "Traceback" not in text and ".py" not in text
