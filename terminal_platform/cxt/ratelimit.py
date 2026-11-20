"""
Request rate limiting (sliding window, per client address and route class).

State is held in process memory, which is correct for a single API process.
Behind several API replicas each replica enforces its own window; put a
shared limiter (gateway or Redis) in front for strict global limits — see
docs/DEPLOYMENT.md.
"""

from __future__ import annotations

import threading
import time
from collections import defaultdict, deque

from .config import get_settings

_lock = threading.Lock()
_hits: dict[str, deque] = defaultdict(deque)


def check(key: str, limit: int, window: float = 60.0) -> tuple[bool, int]:
    """Returns (allowed, retry_after_seconds)."""
    now = time.monotonic()
    with _lock:
        q = _hits[key]
        while q and q[0] <= now - window:
            q.popleft()
        if len(q) >= limit:
            return False, max(1, int(window - (now - q[0])))
        q.append(now)
        if len(_hits) > 50_000:                      # bound memory under address churn
            for k in [k for k, v in _hits.items() if not v or v[-1] <= now - window]:
                _hits.pop(k, None)
        return True, 0


def limits_for(path: str) -> tuple[str, int]:
    s = get_settings()
    if "/auth/login" in path or "/auth/password" in path or "/auth/invite" in path:
        return "auth", s.auth_rate_limit_per_minute
    return "api", s.rate_limit_per_minute


def reset() -> None:
    with _lock:
        _hits.clear()
