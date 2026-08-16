"""
Vmic — Session service.

Handles session creation, room code generation, and Redis persistence.
Includes in-memory session cache for resilience.
"""

import json
import logging
import random
import string
import time
import uuid
from typing import Dict, Optional

from models.session import CreateSessionRequest, SessionResponse
from redis_client.connection import get_redis

logger = logging.getLogger(__name__)

# In-memory session cache
_in_memory_sessions: Dict[str, SessionResponse] = {}


def generate_room_code(room_name: str) -> str:
    """
    Generate a human-friendly room code.
    Algorithm: {CLEANED_ROOM_LOCATION}-{3_RANDOM_ALPHANUMERIC}
    Example: 'A101' -> 'A101-7XK'
    """
    clean_prefix = "".join(c for c in room_name.strip() if c.isalnum()).upper()
    if not clean_prefix:
        clean_prefix = "ROOM"
    
    suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=3))
    return f"{clean_prefix}-{suffix}"


async def create_session(request: CreateSessionRequest) -> SessionResponse:
    """
    Create a new session, persist it to Redis under `session:{id}`,
    and return the SessionResponse.
    """
    session_id = str(uuid.uuid4())
    host_id = str(uuid.uuid4())
    room_code = generate_room_code(request.room)
    created_at = int(time.time() * 1000)

    session_data = SessionResponse(
        id=session_id,
        name=request.name,
        room=request.room,
        hostName=request.hostName,
        hostId=host_id,
        roomCode=room_code,
        maxParticipants=request.maxParticipants,
        audioSettings=request.audioSettings,
        speakingMode=request.speakingMode,
        participantIds=[],
        status="created",
        createdAt=created_at,
    )

    _in_memory_sessions[session_id] = session_data

    try:
        redis = await get_redis()
        redis_key = f"session:{session_id}"
        await redis.set(redis_key, json.dumps(session_data.model_dump()))
    except Exception as exc:
        logger.warning(f"Could not persist session to Redis (using in-memory): {exc}")

    return session_data


async def get_session(session_id: str) -> Optional[SessionResponse]:
    """
    Fetch a session from Redis by session_id (falls back to in-memory).
    """
    try:
        redis = await get_redis()
        redis_key = f"session:{session_id}"
        raw_data = await redis.get(redis_key)
        if raw_data:
            data_dict = json.loads(raw_data)
            return SessionResponse(**data_dict)
    except Exception as exc:
        logger.warning(f"Could not fetch session from Redis: {exc}")

    return _in_memory_sessions.get(session_id)
