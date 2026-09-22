"""Sliding-window rate limiter (in memory, per process)."""
import threading
import time
from collections import deque
from typing import Callable, Deque


class RateLimiter:
    def __init__(self, limit: int, window_seconds: float = 60.0, clock: Callable[[], float] = time.monotonic):
        self._limit = limit
        self._window = window_seconds
        self._clock = clock
        self._hits: Deque[float] = deque()
        self._lock = threading.Lock()

    def allow(self) -> bool:
        """Records a request. Returns False if the limit for the current window is used up."""
        if self._limit <= 0:
            return True
        with self._lock:
            now = self._clock()
            while self._hits and now - self._hits[0] >= self._window:
                self._hits.popleft()
            if len(self._hits) >= self._limit:
                return False
            self._hits.append(now)
            return True

    def retry_after(self) -> int:
        """Whole seconds until a slot frees up (at least 1)."""
        with self._lock:
            if not self._hits:
                return 1
            return max(1, int(self._window - (self._clock() - self._hits[0])) + 1)
