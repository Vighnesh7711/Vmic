"""
Vmic — Session domain models and schemas.
"""

from typing import Literal
from pydantic import BaseModel, Field


class AudioSettings(BaseModel):
    transport: Literal["auto", "wifi", "bluetooth"] = "auto"
    echoCancellation: bool = True
    noiseSuppression: bool = True
    defaultVolume: int = Field(default=80, ge=0, le=100)


class CreateSessionRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    room: str = Field(..., min_length=1, max_length=50)
    hostName: str = Field(..., min_length=1, max_length=50)
    maxParticipants: int = Field(default=20, ge=2, le=100)
    audioSettings: AudioSettings = Field(default_factory=AudioSettings)
    speakingMode: Literal["open_floor", "controlled_floor"] = "open_floor"


class SessionResponse(BaseModel):
    id: str
    name: str
    room: str
    hostName: str
    hostId: str
    roomCode: str
    maxParticipants: int
    audioSettings: AudioSettings
    speakingMode: str = "open_floor"
    participantIds: list[str] = Field(default_factory=list)
    status: str = "created"
    createdAt: int
