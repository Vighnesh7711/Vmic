from pydantic import BaseModel, Field
from typing import Optional


class JoinSessionRequest(BaseModel):
    display_name: str = Field(
        min_length=1,
        max_length=50
    )

    transport: str = Field(
        default="wifi"
    )


class ParticipantResponse(BaseModel):
    participant_id: str
    display_name: str
    room_code: str
    connection_state: str
    transport: str
    muted: bool
    volume: float
