"""Registration and verification decisions. No HTTP in here."""
from dataclasses import dataclass
from typing import List, Optional

from .config import Settings
from .face_engine import OK, FaceEngine, cosine_similarity
from .template import TemplateCodec

MATCH = "MATCH"
NO_MATCH = "NO_MATCH"
INCONSISTENT_FRAMES = "INCONSISTENT_FRAMES"


class InvalidRequest(ValueError):
    pass


@dataclass
class RegisterResult:
    template: Optional[str] = None
    error: Optional[str] = None
    frame_index: Optional[int] = None


@dataclass
class VerifyResult:
    decision: str
    confidence: Optional[float] = None


class VerificationService:
    def __init__(self, settings: Settings, engine: FaceEngine, codec: TemplateCodec):
        self._s = settings
        self._engine = engine
        self._codec = codec

    def register(self, frames: List[bytes]) -> RegisterResult:
        s = self._s
        if not s.min_register_frames <= len(frames) <= s.max_register_frames:
            raise InvalidRequest(
                f"send between {s.min_register_frames} and {s.max_register_frames} frames"
            )
        embeddings = []
        for i, frame in enumerate(frames):
            analysis = self._engine.analyze(frame)
            if analysis.status != OK:
                return RegisterResult(error=analysis.status, frame_index=i)
            # Every registration frame must show the same person.
            if embeddings and cosine_similarity(embeddings[0], analysis.embedding) < s.match_threshold:
                return RegisterResult(error=INCONSISTENT_FRAMES, frame_index=i)
            embeddings.append(analysis.embedding)
        return RegisterResult(template=self._codec.encode(embeddings))

    def verify(self, frame: bytes, template: str) -> VerifyResult:
        registered = self._codec.decode(template)
        analysis = self._engine.analyze(frame)
        if analysis.status != OK:
            return VerifyResult(decision=analysis.status)
        best = max(cosine_similarity(e, analysis.embedding) for e in registered)
        decision = MATCH if best >= self._s.match_threshold else NO_MATCH
        return VerifyResult(decision=decision, confidence=round(max(best, 0.0), 3))
