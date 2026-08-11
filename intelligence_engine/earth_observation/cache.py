"""
In-process TTL cache (spec §27 — never call an external provider twice for
an identical request within its dataset's natural update cadence) plus
api_usage logging (spec §10/§25/§29 — prove caching/rate-limiting is real,
feed the Data Quality Dashboard). Same in-memory-dict-with-TTL pattern
already used by climate_api/connectors/worldbank.py and nasa_power.py —
kept process-local rather than introducing Redis for Phase 1's endpoint
volume; swap for Redis (already provisioned in docker-compose) if/when
multi-worker cache coherency becomes necessary.
"""

from __future__ import annotations

import time
from typing import Any, Optional

import asyncpg

_cache: dict[str, tuple[Any, float]] = {}

# TTL tuned to each dataset's real update_frequency (spec §27) — not a
# single global number, since a daily-refreshed pollution layer and a
# 30-year climatology baseline have very different staleness windows.
TTL_SECONDS = {
    "environmental-indicators": 3600,       # scene discovery/derived indicator — hourly is generous
    "imagery": 3600,
    "climate-risk": 3600,
    "climate-baseline": 86400,              # NASA POWER climatology barely changes
    "sources": 300,
}


def cache_get(bucket: str, key: str) -> Optional[Any]:
    full_key = f"{bucket}:{key}"
    entry = _cache.get(full_key)
    if entry is None:
        return None
    value, expires_at = entry
    if time.time() > expires_at:
        del _cache[full_key]
        return None
    return value


def cache_set(bucket: str, key: str, value: Any) -> None:
    ttl = TTL_SECONDS.get(bucket, 900)
    _cache[f"{bucket}:{key}"] = (value, time.time() + ttl)


async def log_usage(
    pool: asyncpg.Pool,
    source_key: Optional[str],
    endpoint: str,
    status_code: int,
    latency_ms: int,
    cached: bool,
) -> None:
    """Best-effort usage log — never let logging failure break the API response (spec §28)."""
    try:
        async with pool.acquire() as conn:
            source_id = None
            if source_key:
                source_id = await conn.fetchval(
                    "SELECT source_id FROM data_sources WHERE source_key = $1", source_key
                )
            await conn.execute(
                """
                INSERT INTO api_usage (source_id, endpoint, status_code, latency_ms, cached)
                VALUES ($1, $2, $3, $4, $5)
                """,
                source_id, endpoint, status_code, latency_ms, cached,
            )
    except Exception:
        pass
