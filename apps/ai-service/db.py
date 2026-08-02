"""Shared asyncpg connection pool.

ai-service reads the same Postgres database the Prisma-managed schema owns
(DATABASE_URL_AI, same instance as apps/web's DATABASE_URL) but never writes
to it — schema ownership stays with Prisma/packages/db, this is a read-only
tenant-scoped query path for agent tools.
"""

from __future__ import annotations

import os

import asyncpg

_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        dsn = os.environ["DATABASE_URL_AI"]
        _pool = await asyncpg.create_pool(dsn=dsn, min_size=1, max_size=5)
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None
