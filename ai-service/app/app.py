import hmac
import logging
from functools import wraps
from typing import Optional

from flask import Flask, jsonify, request

from .config import Settings, load_settings
from .face_engine import FaceEngine, InvalidImage
from .ratelimit import RateLimiter
from .service import InvalidRequest, VerificationService
from .template import InvalidTemplate, TemplateCodec

log = logging.getLogger("ai-service")


def _error(code: str, message: str, status: int):
    return jsonify({"error": code, "message": message}), status


def create_app(settings: Optional[Settings] = None, service: Optional[VerificationService] = None) -> Flask:
    settings = settings or load_settings()
    if service is None:
        service = VerificationService(settings, FaceEngine(settings), TemplateCodec(settings.template_key))

    app = Flask(__name__)
    # register accepts up to 5 frames; leave a little room for form overhead
    app.config["MAX_CONTENT_LENGTH"] = settings.max_frame_bytes * settings.max_register_frames + 64 * 1024

    # Counted only for callers that already proved they hold the key, so strangers cannot use up the quota.
    limiter = RateLimiter(settings.rate_limit_per_minute)

    def require_key(view):
        @wraps(view)
        def wrapper(*args, **kwargs):
            supplied = request.headers.get("X-API-Key", "")
            if not hmac.compare_digest(supplied.encode(), settings.api_key.encode()):
                return _error("UNAUTHORIZED", "invalid or missing API key", 401)
            if not limiter.allow():
                response, status = _error("RATE_LIMITED", "too many requests, slow down", 429)
                response.headers["Retry-After"] = str(limiter.retry_after())
                return response, status
            return view(*args, **kwargs)

        return wrapper

    @app.after_request
    def security_headers(response):
        # Responses can carry an encrypted template: never let a browser or proxy cache them.
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    def read_frame(storage) -> bytes:
        data = storage.read(settings.max_frame_bytes + 1)
        if len(data) > settings.max_frame_bytes:
            raise InvalidRequest("frame is too large")
        return data

    @app.get("/health")
    def health():
        return jsonify({"ok": True})

    @app.post("/v1/register")
    @require_key
    def register():
        files = request.files.getlist("frames")
        result = service.register([read_frame(f) for f in files])
        if result.error:
            return jsonify({"error": result.error, "frameIndex": result.frame_index}), 422
        return jsonify({"template": result.template})

    @app.post("/v1/verify")
    @require_key
    def verify():
        frame = request.files.get("frame")
        template = request.form.get("template", "")
        if frame is None or not template:
            raise InvalidRequest("frame and template are required")
        if len(template) > settings.max_template_chars:
            raise InvalidTemplate("template too long")
        result = service.verify(read_frame(frame), template)
        return jsonify({"decision": result.decision, "confidence": result.confidence})

    @app.errorhandler(InvalidRequest)
    def bad_request(exc):
        return _error("INVALID_REQUEST", str(exc), 400)

    @app.errorhandler(InvalidImage)
    def bad_image(exc):
        return _error("INVALID_IMAGE", "frame could not be read as an image", 400)

    @app.errorhandler(InvalidTemplate)
    def bad_template(exc):
        return _error("INVALID_TEMPLATE", "template is invalid", 400)

    @app.errorhandler(413)
    def too_large(exc):
        return _error("PAYLOAD_TOO_LARGE", "request is too large", 413)

    @app.errorhandler(404)
    def not_found(exc):
        return _error("NOT_FOUND", "no such endpoint", 404)

    @app.errorhandler(405)
    def wrong_method(exc):
        return _error("METHOD_NOT_ALLOWED", "method not allowed", 405)

    @app.errorhandler(Exception)
    def unexpected(exc):
        # Log the type only: never the request body, frames or templates.
        log.error("unhandled error: %s", type(exc).__name__)
        return _error("INTERNAL_ERROR", "unexpected error", 500)

    return app
