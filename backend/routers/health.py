"""
Vmic — Health-check router

Provides GET /api/health for monitoring.
"""

from datetime import datetime, timezone

from fastapi import APIRouter

from redis_client.connection import ping_redis

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health")
async def health_check() -> dict:
    """
    Returns server status and Redis connectivity.

    Response shape:
        {
            "status": "ok",
            "timestamp": "<ISO-8601>",
            "redis": true | false
        }
    """
    redis_ok = await ping_redis()
    return {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "redis": redis_ok,
    }
