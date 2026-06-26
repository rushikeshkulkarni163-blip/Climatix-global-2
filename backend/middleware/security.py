"""
Security middleware for Climactix Global backend.
Provides: security headers, rate limiting, request validation.
"""

import os
import time
import hashlib
from collections import defaultdict
from typing import Callable

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware


# ── Security Headers Middleware ────────────────────────────────────────────────

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Adds enterprise-grade security headers to every response."""

    STATIC_HEADERS = {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "0",  # modern browsers: disable legacy XSS filter, rely on CSP
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": (
            "geolocation=(), microphone=(), camera=(), payment=(), "
            "usb=(), bluetooth=(), magnetometer=(), gyroscope=()"
        ),
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Resource-Policy": "same-origin",
    }

    CSP = (
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "img-src 'self' data: https:; "
        "connect-src 'self'; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self';"
    )

    def __init__(self, app, enable_hsts: bool = True):
        super().__init__(app)
        self._enable_hsts = enable_hsts

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)
        for header, value in self.STATIC_HEADERS.items():
            response.headers[header] = value
        response.headers["Content-Security-Policy"] = self.CSP
        if self._enable_hsts:
            response.headers["Strict-Transport-Security"] = (
                "max-age=63072000; includeSubDomains; preload"
            )
        # Remove headers that leak server info
        for leaky_header in ("Server", "X-Powered-By"):
            if leaky_header in response.headers:
                del response.headers[leaky_header]
        return response


# ── Rate Limiting Middleware ────────────────────────────────────────────────────

class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Sliding-window rate limiter using in-process memory.
    For multi-worker deployments, replace the _store with Redis.
    """

    def __init__(
        self,
        app,
        default_limit: int = 120,   # requests per window
        window_seconds: int = 60,
        auth_limit: int = 10,        # stricter limit for auth endpoints
        auth_window: int = 60,
    ):
        super().__init__(app)
        self._default_limit = default_limit
        self._window = window_seconds
        self._auth_limit = auth_limit
        self._auth_window = auth_window
        # {ip: [(timestamp, path), ...]}
        self._store: dict[str, list[float]] = defaultdict(list)

    def _get_client_ip(self, request: Request) -> str:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    def _is_auth_path(self, path: str) -> bool:
        auth_prefixes = ("/auth/", "/admin/login", "/analyst/login")
        return any(path.startswith(p) for p in auth_prefixes)

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        ip = self._get_client_ip(request)
        now = time.time()
        path = request.url.path

        is_auth = self._is_auth_path(path)
        limit = self._auth_limit if is_auth else self._default_limit
        window = self._auth_window if is_auth else self._window

        key = f"{ip}:{'auth' if is_auth else 'default'}"
        timestamps = self._store[key]

        # Evict old entries
        cutoff = now - window
        self._store[key] = [t for t in timestamps if t > cutoff]
        count = len(self._store[key])

        if count >= limit:
            retry_after = int(window - (now - self._store[key][0]))
            return JSONResponse(
                status_code=429,
                content={"error": "Rate limit exceeded", "retry_after": retry_after},
                headers={"Retry-After": str(retry_after)},
            )

        self._store[key].append(now)
        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(limit - count - 1)
        response.headers["X-RateLimit-Reset"] = str(int(now + window))
        return response


# ── Startup secret validation ──────────────────────────────────────────────────

REQUIRED_SECRETS = [
    ("ADMIN_SECRET", 32),
    ("ANALYST_SECRET", 32),
]

WEAK_PATTERNS = [
    "change_in_production",
    "change-this",
    "replace",
    "secret_here",
    "your_secret",
    "dev-secret",
    "climactix2026",
    "analyst2026",
]


def validate_secrets_on_startup() -> None:
    """Raise RuntimeError if any required secret is missing or weak."""
    errors = []
    for name, min_len in REQUIRED_SECRETS:
        value = os.getenv(name, "")
        if not value:
            errors.append(f"{name} is not set")
            continue
        if len(value) < min_len:
            errors.append(f"{name} is too short (min {min_len} chars, got {len(value)})")
        if any(p in value.lower() for p in WEAK_PATTERNS):
            errors.append(f"{name} appears to use a placeholder value — set a real secret")

    if errors:
        raise RuntimeError(
            "STARTUP BLOCKED — insecure secrets detected:\n"
            + "\n".join(f"  • {e}" for e in errors)
            + "\n\nGenerate secrets: python3 -c \"import secrets; print(secrets.token_hex(64))\""
        )
