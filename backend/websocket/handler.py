"""
Vmic — WebSocket Signaling & Control Handler.

Manages real-time control-plane connections and dispatches the 13 signaling
message types. Audio NEVER flows through this channel.
"""

import json
import logging
from typing import Any, Dict, Optional, Set, Tuple

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from services.participant import (
    add_participant,
    remove_participant,
    update_participant_field,
)
from services.session import get_session

logger = logging.getLogger(__name__)
router = APIRouter(tags=["websocket"])


class ConnectionManager:
    """
    Tracks active WebSocket connections per session and participant.
    """

    def __init__(self):
        # sessionId -> { participantId: WebSocket }
        self._rooms: Dict[str, Dict[str, WebSocket]] = {}
        # WebSocket -> (sessionId, participantId)
        self._socket_map: Dict[WebSocket, Tuple[str, str]] = {}

    async def connect(
        self, websocket: WebSocket, session_id: str, participant_id: str
    ) -> None:
        if session_id not in self._rooms:
            self._rooms[session_id] = {}
        self._rooms[session_id][participant_id] = websocket
        self._socket_map[websocket] = (session_id, participant_id)

    def disconnect(self, websocket: WebSocket) -> Optional[Tuple[str, str]]:
        mapping = self._socket_map.pop(websocket, None)
        if mapping:
            session_id, participant_id = mapping
            if session_id in self._rooms:
                self._rooms[session_id].pop(participant_id, None)
                if not self._rooms[session_id]:
                    del self._rooms[session_id]
            return mapping
        return None

    async def send_to(
        self, session_id: str, target_participant_id: str, message: Dict[str, Any]
    ) -> bool:
        """Send message directly to a specific participant in a session."""
        room = self._rooms.get(session_id)
        if room and target_participant_id in room:
            ws = room[target_participant_id]
            try:
                await ws.send_json(message)
                return True
            except Exception as e:
                logger.warning(f"Error sending message to {target_participant_id}: {e}")
        return False

    async def broadcast(
        self,
        session_id: str,
        message: Dict[str, Any],
        exclude_participant_id: Optional[str] = None,
    ) -> None:
        """Broadcast a message to all participants in a session."""
        room = self._rooms.get(session_id, {})
        for pid, ws in list(room.items()):
            if exclude_participant_id and pid == exclude_participant_id:
                continue
            try:
                await ws.send_json(message)
            except Exception as e:
                logger.warning(f"Error broadcasting to {pid}: {e}")


manager = ConnectionManager()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    """
    Primary WebSocket signaling endpoint.
    Accepts connections and processes control/signaling messages.
    """
    await websocket.accept()

    try:
        while True:
            raw_text = await websocket.receive_text()
            try:
                data = json.loads(raw_text)
            except Exception:
                await websocket.send_json({"error": "Invalid JSON format"})
                continue

            msg_type = data.get("type")
            session_id = data.get("sessionId")

            if not msg_type or not session_id:
                await websocket.send_json(
                    {"error": "Missing 'type' or 'sessionId' in message payload"}
                )
                continue

            # ---------------------------------------------------------------
            # 1. JOIN_ROOM
            # ---------------------------------------------------------------
            if msg_type == "JOIN_ROOM":
                participant_id = data.get("participantId")
                display_name = data.get("displayName", "Guest")
                role = data.get("role", "attendee")

                if not participant_id:
                    await websocket.send_json({"error": "Missing participantId"})
                    continue

                # Add to connection manager
                await manager.connect(websocket, session_id, participant_id)

                # Persist in Redis
                participant_record = await add_participant(
                    session_id=session_id,
                    participant_id=participant_id,
                    display_name=display_name,
                    role=role,
                )

                # Broadcast USER_JOINED to all participants in room
                broadcast_msg = {
                    "type": "USER_JOINED",
                    "sessionId": session_id,
                    "participant": participant_record,
                }
                await manager.broadcast(session_id, broadcast_msg)

            # ---------------------------------------------------------------
            # 2. USER_LEFT
            # ---------------------------------------------------------------
            elif msg_type == "USER_LEFT":
                participant_id = data.get("participantId")
                reason = data.get("reason", "normal")

                if participant_id:
                    await remove_participant(session_id, participant_id)
                    manager.disconnect(websocket)
                    await manager.broadcast(
                        session_id,
                        {
                            "type": "USER_LEFT",
                            "sessionId": session_id,
                            "participantId": participant_id,
                            "reason": reason,
                        },
                    )

            # ---------------------------------------------------------------
            # 3. WEBRTC_OFFER (Targeted peer relay)
            # ---------------------------------------------------------------
            elif msg_type == "WEBRTC_OFFER":
                to_pid = data.get("toParticipantId")
                if to_pid:
                    await manager.send_to(session_id, to_pid, data)

            # ---------------------------------------------------------------
            # 4. WEBRTC_ANSWER (Targeted peer relay)
            # ---------------------------------------------------------------
            elif msg_type == "WEBRTC_ANSWER":
                to_pid = data.get("toParticipantId")
                if to_pid:
                    await manager.send_to(session_id, to_pid, data)

            # ---------------------------------------------------------------
            # 5. ICE_CANDIDATE (Targeted peer relay)
            # ---------------------------------------------------------------
            elif msg_type == "ICE_CANDIDATE":
                to_pid = data.get("toParticipantId")
                if to_pid:
                    await manager.send_to(session_id, to_pid, data)

            # ---------------------------------------------------------------
            # 6. MUTE
            # ---------------------------------------------------------------
            elif msg_type == "MUTE":
                participant_id = data.get("participantId")
                if participant_id:
                    await update_participant_field(
                        session_id, participant_id, "muted", "true"
                    )
                    await manager.broadcast(session_id, data)

            # ---------------------------------------------------------------
            # 7. UNMUTE
            # ---------------------------------------------------------------
            elif msg_type == "UNMUTE":
                participant_id = data.get("participantId")
                if participant_id:
                    await update_participant_field(
                        session_id, participant_id, "muted", "false"
                    )
                    await manager.broadcast(session_id, data)

            # ---------------------------------------------------------------
            # 8. REQUEST_FLOOR
            # ---------------------------------------------------------------
            elif msg_type == "REQUEST_FLOOR":
                participant_id = data.get("participantId")
                if participant_id:
                    await update_participant_field(
                        session_id, participant_id, "floor", "requested"
                    )
                    await manager.broadcast(session_id, data)

            # ---------------------------------------------------------------
            # 9. GRANT_FLOOR
            # ---------------------------------------------------------------
            elif msg_type == "GRANT_FLOOR":
                participant_id = data.get("participantId")
                if participant_id:
                    await update_participant_field(
                        session_id, participant_id, "floor", "granted"
                    )
                    await manager.broadcast(session_id, data)

            # ---------------------------------------------------------------
            # 10. RELEASE_FLOOR
            # ---------------------------------------------------------------
            elif msg_type == "RELEASE_FLOOR":
                participant_id = data.get("participantId")
                if participant_id:
                    await update_participant_field(
                        session_id, participant_id, "floor", "none"
                    )
                    await manager.broadcast(session_id, data)

            # ---------------------------------------------------------------
            # 11. SESSION_STARTED
            # ---------------------------------------------------------------
            elif msg_type == "SESSION_STARTED":
                await manager.broadcast(session_id, data)

            # ---------------------------------------------------------------
            # 12. SESSION_ENDED
            # ---------------------------------------------------------------
            elif msg_type == "SESSION_ENDED":
                await manager.broadcast(session_id, data)

            else:
                await websocket.send_json({"error": f"Unknown message type: {msg_type}"})

    except WebSocketDisconnect:
        # Graceful cleanup on client connection drop
        mapping = manager.disconnect(websocket)
        if mapping:
            s_id, p_id = mapping
            try:
                await remove_participant(s_id, p_id)
                await manager.broadcast(
                    s_id,
                    {
                        "type": "USER_LEFT",
                        "sessionId": s_id,
                        "participantId": p_id,
                        "reason": "abrupt_disconnect",
                    },
                )
            except Exception as e:
                logger.error(f"Error cleaning up disconnected participant {p_id}: {e}")
