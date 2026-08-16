"""
Vmic — Participant Redis State Service.

Manages participant membership, lifecycle states, mute flags, and floor grants
in Redis under the explicit key schema:
- session:{id}:participants -> Set of participant IDs
- session:{id}:participant:{pid} -> Hash of participant properties
"""

import logging
import time
from typing import Any, Dict, List, Optional
from redis_client.connection import get_redis

logger = logging.getLogger(__name__)


async def add_participant(
    session_id: str,
    participant_id: str,
    display_name: str,
    role: str = "attendee",
) -> Dict[str, Any]:
    """
    Register a participant in Redis under session:{id}:participants
    and session:{id}:participant:{pid}.
    """
    now_ms = int(time.time() * 1000)
    participant_record = {
        "id": participant_id,
        "displayName": display_name,
        "role": role,
        "state": "active",
        "isMuted": False,
        "hasFloor": False,
        "joinedAt": now_ms,
    }

    try:
        redis = await get_redis()
        # 1. Add to session participants set
        await redis.sadd(f"session:{session_id}:participants", participant_id)

        # 2. Store participant state hash
        participant_data = {
            "id": participant_id,
            "displayName": display_name,
            "role": role,
            "state": "active",
            "muted": "false",
            "floor": "none",
            "joinedAt": str(now_ms),
        }
        await redis.hset(
            f"session:{session_id}:participant:{participant_id}",
            mapping=participant_data,
        )
    except Exception as exc:
        logger.warning(f"Could not persist participant to Redis: {exc}")

    return participant_record


async def remove_participant(session_id: str, participant_id: str) -> None:
    """
    Remove participant from session set and delete their state hash.
    """
    try:
        redis = await get_redis()
        await redis.srem(f"session:{session_id}:participants", participant_id)
        await redis.delete(f"session:{session_id}:participant:{participant_id}")
    except Exception as exc:
        logger.warning(f"Could not remove participant from Redis: {exc}")


async def update_participant_field(
    session_id: str,
    participant_id: str,
    field: str,
    value: str,
) -> None:
    """
    Update a specific field in the participant hash (e.g. muted, floor, state).
    """
    try:
        redis = await get_redis()
        key = f"session:{session_id}:participant:{participant_id}"
        if await redis.exists(key):
            await redis.hset(key, field, value)
    except Exception as exc:
        logger.warning(f"Could not update participant field in Redis: {exc}")


async def get_participant(
    session_id: str,
    participant_id: str,
) -> Optional[Dict[str, Any]]:
    """
    Retrieve participant state from Redis.
    """
    try:
        redis = await get_redis()
        data = await redis.hgetall(f"session:{session_id}:participant:{participant_id}")
        if not data:
            return None

        return {
            "id": data.get("id", participant_id),
            "displayName": data.get("displayName", ""),
            "role": data.get("role", "attendee"),
            "state": data.get("state", "active"),
            "isMuted": data.get("muted") == "true",
            "hasFloor": data.get("floor") == "granted",
            "joinedAt": int(data.get("joinedAt", "0")),
        }
    except Exception as exc:
        logger.warning(f"Could not get participant from Redis: {exc}")
        return None


async def get_session_participants(session_id: str) -> List[Dict[str, Any]]:
    """
    Get all active participants in a session.
    """
    try:
        redis = await get_redis()
        participant_ids = await redis.smembers(f"session:{session_id}:participants")
        results = []

        for pid in participant_ids:
            p_data = await get_participant(session_id, pid)
            if p_data:
                results.append(p_data)

        return results
    except Exception as exc:
        logger.warning(f"Could not get session participants from Redis: {exc}")
        return []
