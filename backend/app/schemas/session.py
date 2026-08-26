from pydantic import BaseModel, Field
from typing import Optional


class CreateSessionRequest(BaseModel):
    session_name: str = Field(
        min_length=1,
        max_length=100
    )

    host_name: str = Field(
        min_length=1,
        max_length=50
    )

    room: str = Field(
        default="",
        max_length=50
    )

    max_participants: int = Field(
        default=20,
        ge=1,
        le=100
    )

    transport_policy: str = Field(
        default="auto"
    )


class SessionResponse(BaseModel):
    session_id: str
    room_code: str
    session_name: str
    host_name: str
    room: str
    max_participants: int
    transport_policy: str
    status: str
    created_at: str
    ended_at: Optional[str] = None
    participant_count: int = 0
