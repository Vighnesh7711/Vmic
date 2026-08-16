"""
Vmic — Sessions router.

Endpoints for creating and retrieving session metadata.
"""

from fastapi import APIRouter, HTTPException, status

from models.session import CreateSessionRequest, SessionResponse
from services.session import create_session, get_session

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_new_session(request: CreateSessionRequest) -> SessionResponse:
    """
    Create a new Vmic session.
    """
    return await create_session(request)


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session_by_id(session_id: str) -> SessionResponse:
    """
    Retrieve session metadata by session_id.
    """
    session = await get_session(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found",
        )
    return session
