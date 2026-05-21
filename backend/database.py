"""
Climactix — Database connection pool (asyncpg).
Runs schema migration on first startup.
"""

import os
from pathlib import Path
from typing import Optional

import asyncpg

_pool: Optional[asyncpg.Pool] = None

DATABASE_URL: str = (
    os.getenv("DATABASE_URL", "postgresql://climactix:climactix@localhost:5432/climactix")
    .replace("postgresql+asyncpg://", "postgresql://")
)

_MIGRATIONS_DIR = Path(__file__).parent / "migrations"


async def init_pool() -> asyncpg.Pool:
    global _pool
    _pool = await asyncpg.create_pool(DATABASE_URL, min_size=2, max_size=10)
    await _run_migrations(_pool)
    return _pool


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(DATABASE_URL, min_size=2, max_size=10)
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


async def _run_migrations(pool: asyncpg.Pool) -> None:
    migrations = sorted(_MIGRATIONS_DIR.glob("*.sql"))
    async with pool.acquire() as conn:
        for path in migrations:
            await conn.execute(path.read_text())
