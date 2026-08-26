from typing import Any

from pydantic import BaseModel


class WebRTCOffer(BaseModel):
    participant_id: str
    sdp: str


class WebRTCAnswer(BaseModel):
    participant_id: str
    sdp: str


class ICECandidate(BaseModel):
    participant_id: str
    candidate: dict[str, Any]
