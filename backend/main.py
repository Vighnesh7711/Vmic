"""
Vmic — FastAPI application

Entry point for the backend. Mounts routers, configures CORS,
and manages the Redis connection lifecycle.
"""

import os
import sys
from contextlib import asynccontextmanager
from typing import AsyncGenerator
import logging

# Ensure backend root is always present on python path for module resolution
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import FRONTEND_ORIGIN
from redis_client.connection import close_redis, verify_connection
from routers.health import router as health_router
from routers.sessions import router as sessions_router
from websocket.handler import router as ws_router

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Application lifecycle
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Startup / shutdown hooks."""
    # Startup — verify Redis is reachable. Logs warning if not running locally,
    # and falls back to in-memory state store.
    try:
        await verify_connection()
    except Exception as exc:
        logger.warning("Redis server offline — running in local in-memory fallback mode: %s", exc)
    yield
    # Shutdown — close the Redis connection pool.
    await close_redis()


# ---------------------------------------------------------------------------
# Application instance
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Vmic API",
    description="Local wireless multi-phone microphone and audio mixing system",
    version="0.1.0",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

app.include_router(health_router)
app.include_router(sessions_router)
app.include_router(ws_router)
