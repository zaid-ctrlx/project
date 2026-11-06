"""In-memory failed-attempt limiter for login. Per-process, so it resets on
restart and isn't shared across workers - fine for a single dev/FYP server;
use Redis (or a DB table) if the backend ever runs multi-process."""

import threading
import time
from collections import deque

from fastapi import HTTPException, status


class FailureLimiter:
    def __init__(self, max_failures: int, window_seconds: int) -> None:
        self.max_failures = max_failures
        self.window = window_seconds
        self._hits: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def _prune(self, key: str, now: float) -> deque[float]:
        hits = self._hits.setdefault(key, deque())
        while hits and hits[0] <= now - self.window:
            hits.popleft()
        return hits

    def check(self, key: str) -> None:
        """Raise 429 if `key` already has too many recent failures."""
        now = time.monotonic()
        with self._lock:
            hits = self._prune(key, now)
            if len(hits) >= self.max_failures:
                retry = int(hits[0] + self.window - now) + 1
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Too many failed attempts. Try again in {max(retry // 60, 1)} min.",
                    headers={"Retry-After": str(retry)},
                )

    def fail(self, key: str) -> None:
        now = time.monotonic()
        with self._lock:
            self._prune(key, now).append(now)
            if len(self._hits) > 10_000:  # bound memory: drop idle keys
                for k in [k for k, v in self._hits.items() if not v or v[-1] <= now - self.window]:
                    del self._hits[k]

    def reset(self, key: str) -> None:
        with self._lock:
            self._hits.pop(key, None)
