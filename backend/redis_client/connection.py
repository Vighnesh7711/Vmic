"""
Vmic — Redis connection service

Provides an async Redis client factory, a startup connectivity check,
and a non-fatal health probe. Uses redis.asyncio for non-blocking I/O
inside FastAPI.
"""

import logging

import redis.asyncio as aioredis
from redis.exceptions import RedisError

from config import REDIS_HOST, REDIS_PORT

logger = logging.getLogger(__name__)

# Module-level connection pool (initialized on first call to get_redis).
_pool: aioredis.ConnectionPool | None = None


async def get_redis() -> aioredis.Redis:
    """
    Return an async Redis client backed by a shared connection pool.
    Creates the pool on first invocation. A short connect timeout keeps
    startup failures fast rather than hanging.
    """
    global _pool
    if _pool is None:
        _pool = aioredis.ConnectionPool.from_url(
            f"redis://{REDIS_HOST}:{REDIS_PORT}",
            decode_responses=True,
            socket_connect_timeout=2,
        )
    return aioredis.Redis(connection_pool=_pool)


async def verify_connection() -> None:
    """
    Eagerly verify Redis is reachable. Called once on application startup.

    Fails loudly per project rule: logs an ERROR and raises if the server
    cannot be reached, so the app never boots with a dead state store.
    """
    client = await get_redis()
    try:
        await client.ping()
    except (RedisError, OSError) as exc:
        logger.error(
            "Redis unreachable at %s:%s — %s", REDIS_HOST, REDIS_PORT, exc
        )
        raise RuntimeError(
            f"Cannot start: Redis unreachable at {REDIS_HOST}:{REDIS_PORT}"
        ) from exc
    logger.info("Redis connection verified at %s:%s", REDIS_HOST, REDIS_PORT)


async def ping_redis() -> bool:
    """
    Non-fatal liveness probe used by the health endpoint.

    Returns True if Redis responds, False otherwise. Unlike verify_connection
    this does NOT raise — but it always logs a failure, so it is never a
    silent no-op.
    """
    try:
        client = await get_redis()
        return bool(await client.ping())
    except (RedisError, OSError) as exc:
        logger.warning(
            "Redis ping failed at %s:%s — %s", REDIS_HOST, REDIS_PORT, exc
        )
        return False


async def close_redis() -> None:
    """
    Close the shared connection pool. Call during app shutdown.
    """
    global _pool
    if _pool is not None:
        await _pool.aclose()
        _pool = None
