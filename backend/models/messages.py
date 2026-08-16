"""
Vmic — WebSocket Signaling & Control Message Models.

Strict schemas for the 13 control-plane message types.
Audio bytes NEVER pass through these messages.
"""

from typing import Any, Dict, Literal, Optional
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Core Participant Payload Model
# ---------------------------------------------------------------------------
class ParticipantPayload(BaseModel):
    id: str
    displayName: str
    role: Literal["host", "attendee"]
    state: str = "active"
    isMuted: bool = False
    hasFloor: bool = False


# ---------------------------------------------------------------------------
# 1. JOIN_ROOM (Client -> Server)
# ---------------------------------------------------------------------------
class JoinRoomMessage(BaseModel):
    type: Literal["JOIN_ROOM"] = "JOIN_ROOM"
    sessionId: str
    participantId: str
    displayName: str
    role: Literal["host", "attendee"] = "attendee"


# ---------------------------------------------------------------------------
# 2. USER_JOINED (Server -> Client broadcast)
# ---------------------------------------------------------------------------
class UserJoinedMessage(BaseModel):
    type: Literal["USER_JOINED"] = "USER_JOINED"
    sessionId: str
    participant: ParticipantPayload


# ---------------------------------------------------------------------------
# 3. USER_LEFT (Both directions)
# ---------------------------------------------------------------------------
class UserLeftMessage(BaseModel):
    type: Literal["USER_LEFT"] = "USER_LEFT"
    sessionId: str
    participantId: str
    reason: str = "disconnected"


# ---------------------------------------------------------------------------
# 4. WEBRTC_OFFER (Client A -> Server -> Client B)
# ---------------------------------------------------------------------------
class WebRTCOfferMessage(BaseModel):
    type: Literal["WEBRTC_OFFER"] = "WEBRTC_OFFER"
    sessionId: str
    fromParticipantId: str
    toParticipantId: str
    sdp: str


# ---------------------------------------------------------------------------
# 5. WEBRTC_ANSWER (Client B -> Server -> Client A)
# ---------------------------------------------------------------------------
class WebRTCAnswerMessage(BaseModel):
    type: Literal["WEBRTC_ANSWER"] = "WEBRTC_ANSWER"
    sessionId: str
    fromParticipantId: str
    toParticipantId: str
    sdp: str


# ---------------------------------------------------------------------------
# 6. ICE_CANDIDATE (Client A <-> Server <-> Client B)
# ---------------------------------------------------------------------------
class IceCandidatePayload(BaseModel):
    candidate: str
    sdpMid: Optional[str] = None
    sdpMLineIndex: Optional[int] = None
    usernameFragment: Optional[str] = None


class IceCandidateMessage(BaseModel):
    type: Literal["ICE_CANDIDATE"] = "ICE_CANDIDATE"
    sessionId: str
    fromParticipantId: str
    toParticipantId: str
    candidate: Dict[str, Any]


# ---------------------------------------------------------------------------
# 7. MUTE (Both directions)
# ---------------------------------------------------------------------------
class MuteMessage(BaseModel):
    type: Literal["MUTE"] = "MUTE"
    sessionId: str
    participantId: str


# ---------------------------------------------------------------------------
# 8. UNMUTE (Both directions)
# ---------------------------------------------------------------------------
class UnmuteMessage(BaseModel):
    type: Literal["UNMUTE"] = "UNMUTE"
    sessionId: str
    participantId: str


# ---------------------------------------------------------------------------
# 9. REQUEST_FLOOR (Both directions)
# ---------------------------------------------------------------------------
class RequestFloorMessage(BaseModel):
    type: Literal["REQUEST_FLOOR"] = "REQUEST_FLOOR"
    sessionId: str
    participantId: str


# ---------------------------------------------------------------------------
# 10. GRANT_FLOOR (Both directions)
# ---------------------------------------------------------------------------
class GrantFloorMessage(BaseModel):
    type: Literal["GRANT_FLOOR"] = "GRANT_FLOOR"
    sessionId: str
    participantId: str


# ---------------------------------------------------------------------------
# 11. RELEASE_FLOOR (Both directions)
# ---------------------------------------------------------------------------
class ReleaseFloorMessage(BaseModel):
    type: Literal["RELEASE_FLOOR"] = "RELEASE_FLOOR"
    sessionId: str
    participantId: str


# ---------------------------------------------------------------------------
# 12. SESSION_STARTED (Both directions)
# ---------------------------------------------------------------------------
class SessionStartedMessage(BaseModel):
    type: Literal["SESSION_STARTED"] = "SESSION_STARTED"
    sessionId: str
    startedAt: int = Field(default_factory=lambda: int(__import__("time").time() * 1000))


# ---------------------------------------------------------------------------
# 13. SESSION_ENDED (Both directions)
# ---------------------------------------------------------------------------
class SessionEndedMessage(BaseModel):
    type: Literal["SESSION_ENDED"] = "SESSION_ENDED"
    sessionId: str
    endedAt: int = Field(default_factory=lambda: int(__import__("time").time() * 1000))
