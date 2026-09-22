"""Encrypts face templates into an opaque string. The frontend never sees or decodes one."""
import json
from typing import List

import numpy as np
from cryptography.fernet import Fernet, InvalidToken

_VERSION = 1
_MODEL = "sface-2021dec"


class InvalidTemplate(ValueError):
    pass


class TemplateCodec:
    def __init__(self, key: str):
        try:
            self._fernet = Fernet(key.encode())
        except (ValueError, TypeError) as exc:
            raise ValueError("TEMPLATE_ENCRYPTION_KEY is not a valid Fernet key") from exc

    def encode(self, embeddings: List[np.ndarray]) -> str:
        payload = {"v": _VERSION, "m": _MODEL, "e": [[round(float(x), 6) for x in e] for e in embeddings]}
        return self._fernet.encrypt(json.dumps(payload).encode()).decode()

    def decode(self, token: str) -> List[np.ndarray]:
        try:
            payload = json.loads(self._fernet.decrypt(token.encode()))
            if payload.get("v") != _VERSION or payload.get("m") != _MODEL:
                raise InvalidTemplate("unsupported template version")
            embeddings = [np.asarray(e, dtype=np.float32) for e in payload["e"]]
        except (InvalidToken, ValueError, KeyError, TypeError, AttributeError) as exc:
            raise InvalidTemplate("template could not be read") from exc
        if not embeddings or any(e.shape != (128,) for e in embeddings):
            raise InvalidTemplate("template has the wrong shape")
        return embeddings
