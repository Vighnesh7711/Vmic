import secrets
import string
import uuid
from datetime import datetime, timezone


sessions = {}

# Auto-create a default dev session on server startup
_default_session = {
    "session_id": "dev-default-session-id",
    "room_code": "DEMO01",
    "session_name": "Classroom Session",
    "host_name": "Host",
    "room": "Room A101",
    "max_participants": 20,
    "transport_policy": "auto",
    "status": "WAITING",
    "created_at": datetime.now(timezone.utc).isoformat(),
    "ended_at": None,
    "participants": [],
    "floor": {
        "current_speaker": None,
        "queue": []
    }
}
sessions["DEMO01"] = _default_session


def generate_room_code(length: int = 6) -> str:
    characters = string.ascii_uppercase + string.digits

    while True:
        code = "".join(
            secrets.choice(characters)
            for _ in range(length)
        )

        if code not in sessions:
            return code


def create_session(
    session_name: str,
    host_name: str,
    max_participants: int,
    room: str = "",
    transport_policy: str = "auto"
):
    session_id = str(uuid.uuid4())

    room_code = generate_room_code()

    session = {
        "session_id": session_id,
        "room_code": room_code,
        "session_name": session_name,
        "host_name": host_name,
        "room": room,
        "max_participants": max_participants,
        "transport_policy": transport_policy,
        "status": "WAITING",
        "created_at": datetime.now(
            timezone.utc
        ).isoformat(),
        "ended_at": None,
        "participants": [],
        "floor": {
            "current_speaker": None,
            "queue": []
        }
    }

    sessions[room_code] = session

    return session


def get_session(room_code: str):
    return sessions.get(room_code.upper())


def get_all_sessions():
    return list(sessions.values())


def start_session(room_code: str):
    session = get_session(room_code)

    if session is None:
        return None, "SESSION_NOT_FOUND"

    if session["status"] not in ("WAITING",):
        return None, "SESSION_ALREADY_STARTED"

    session["status"] = "ACTIVE"

    return session, None


def end_session(room_code: str):
    session = get_session(room_code)

    if session is None:
        return None, "SESSION_NOT_FOUND"

    if session["status"] == "ENDED":
        return None, "SESSION_ALREADY_ENDED"

    session["status"] = "ENDED"
    session["ended_at"] = datetime.now(
        timezone.utc
    ).isoformat()

    return session, None


def add_participant(
    room_code: str,
    display_name: str,
    transport: str = "wifi"
):
    session = get_session(room_code)

    if session is None:
        return None, "SESSION_NOT_FOUND"

    if session["status"] == "ENDED":
        return None, "SESSION_ENDED"

    if len(session["participants"]) >= session["max_participants"]:
        return None, "SESSION_FULL"

    normalized_name = display_name.strip().casefold()
    if any(
        participant["display_name"].strip().casefold() == normalized_name
        for participant in session["participants"]
    ):
        return None, "DUPLICATE_DISPLAY_NAME"

    participant_id = str(uuid.uuid4())

    participant = {
        "participant_id": participant_id,
        "display_name": display_name.strip(),
        "room_code": session["room_code"],
        "connection_state": "JOINING",
        "transport": transport.upper(),
        "muted": False,
        "volume": 1.0
    }

    session["participants"].append(participant)

    return participant, None


def remove_participant(
    room_code: str,
    participant_id: str
):
    session = get_session(room_code)

    if session is None:
        return

    session["participants"] = [
        p for p in session["participants"]
        if p["participant_id"] != participant_id
    ]

    # Clean up floor state
    floor = session.get("floor", {})
    if floor.get("current_speaker") == participant_id:
        floor["current_speaker"] = None
        if floor.get("queue"):
            floor["current_speaker"] = floor["queue"].pop(0)

    if participant_id in floor.get("queue", []):
        floor["queue"].remove(participant_id)


def get_participant(
    room_code: str,
    participant_id: str
):
    session = get_session(room_code)

    if session is None:
        return None

    for participant in session["participants"]:
        if participant["participant_id"] == participant_id:
            return participant

    return None


def get_participants(room_code: str):
    session = get_session(room_code)

    if session is None:
        return None

    return session["participants"]
