from fastapi import APIRouter, HTTPException

from app.schemas.session import (
    CreateSessionRequest,
    SessionResponse
)

from app.schemas.participant import (
    JoinSessionRequest,
    ParticipantResponse
)

from app.services.session_service import (
    create_session,
    get_session,
    get_all_sessions,
    start_session,
    end_session,
    add_participant,
    get_participants
)

from app.websocket.socket_manager import (
    broadcast_participant_joined,
    broadcast_session_ended
)


router = APIRouter(
    prefix="/api/sessions",
    tags=["Sessions"]
)


def _session_response(session: dict) -> dict:
    """Build a SessionResponse-compatible dict from internal session state."""
    return {
        "session_id": session["session_id"],
        "room_code": session["room_code"],
        "session_name": session["session_name"],
        "host_name": session["host_name"],
        "room": session.get("room", ""),
        "max_participants": session["max_participants"],
        "transport_policy": session.get("transport_policy", "auto"),
        "status": session["status"],
        "created_at": session["created_at"],
        "ended_at": session.get("ended_at"),
        "participant_count": len(session.get("participants", [])),
        "current_speaker": session.get("floor", {}).get("current_speaker"),
        "speaker_queue": session.get("floor", {}).get("queue", []),
    }


@router.post(
    "",
    response_model=SessionResponse
)
async def create_new_session(
    request: CreateSessionRequest
):

    session = create_session(
        session_name=request.session_name,
        host_name=request.host_name,
        max_participants=request.max_participants,
        room=request.room,
        transport_policy=request.transport_policy
    )

    return _session_response(session)


@router.get(
    "",
    response_model=list[SessionResponse]
)
async def list_sessions():
    all_sessions = get_all_sessions()
    return [_session_response(s) for s in all_sessions]


@router.get(
    "/{room_code}",
    response_model=SessionResponse
)
async def get_existing_session(
    room_code: str
):

    session = get_session(room_code)

    if session is None:
        raise HTTPException(
            status_code=404,
            detail="Session not found"
        )

    return _session_response(session)


@router.post(
    "/{room_code}/start",
    response_model=SessionResponse
)
async def start_existing_session(
    room_code: str
):

    session, error = start_session(room_code)

    if error == "SESSION_NOT_FOUND":
        raise HTTPException(
            status_code=404,
            detail="Session not found"
        )

    if error == "SESSION_ALREADY_STARTED":
        raise HTTPException(
            status_code=409,
            detail="Session has already been started"
        )

    return _session_response(session)


@router.post(
    "/{room_code}/end",
    response_model=SessionResponse
)
async def end_existing_session(
    room_code: str
):

    session, error = end_session(room_code)

    if error == "SESSION_NOT_FOUND":
        raise HTTPException(
            status_code=404,
            detail="Session not found"
        )

    if error == "SESSION_ALREADY_ENDED":
        raise HTTPException(
            status_code=409,
            detail="Session has already ended"
        )

    await broadcast_session_ended(room_code.upper())

    return _session_response(session)


@router.post(
    "/{room_code}/participants",
    response_model=ParticipantResponse
)
async def join_session(
    room_code: str,
    request: JoinSessionRequest
):

    participant, error = add_participant(
        room_code=room_code,
        display_name=request.display_name,
        transport=request.transport
    )

    if error == "SESSION_NOT_FOUND":
        raise HTTPException(
            status_code=404,
            detail="Session not found"
        )

    if error == "SESSION_ENDED":
        raise HTTPException(
            status_code=409,
            detail="Session has ended"
        )

    if error == "SESSION_FULL":
        raise HTTPException(
            status_code=409,
            detail="Session is full"
        )

    if error == "DUPLICATE_DISPLAY_NAME":
        raise HTTPException(
            status_code=409,
            detail="That participant name is already in use. Please choose a different name."
        )

    await broadcast_participant_joined(
        room_code=room_code.upper(),
        participant=participant
    )

    return participant


@router.get(
    "/{room_code}/participants",
    response_model=list[ParticipantResponse]
)
async def list_participants(
    room_code: str
):

    participants = get_participants(room_code)

    if participants is None:
        raise HTTPException(
            status_code=404,
            detail="Session not found"
        )

    return participants
