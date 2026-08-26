import socketio

from app.services.session_service import get_session


sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
)

socket_metadata = {}


@sio.event
async def connect(
    sid,
    environ,
    auth
):
    socket_metadata[sid] = {
        "role": None,
        "room_code": None,
        "participant_id": None,
    }

    print(
        f"[Socket.IO] Connected: {sid}"
    )


@sio.event
async def disconnect(
    sid
):

    metadata = socket_metadata.pop(
        sid,
        None
    )

    print(
        f"[Socket.IO] Disconnected: {sid}"
    )

    if not metadata:
        return

    room_code = metadata.get(
        "room_code"
    )

    participant_id = metadata.get(
        "participant_id"
    )

    role = metadata.get(
        "role"
    )

    if (
        role != "participant"
        or not room_code
        or not participant_id
    ):

        return

    await sio.emit(
        "participant_left",
        {
            "participant_id":
                participant_id
        },
        room=room_code
    )


@sio.event
async def join_room(
    sid,
    data
):

    room_code = data.get(
        "room_code"
    )

    role = data.get(
        "role"
    )

    participant_id = data.get(
        "participant_id"
    )

    if not room_code:

        await sio.emit(
            "error",
            {
                "message":
                    "room_code is required"
            },
            to=sid
        )

        return

    room_code = room_code.upper()

    session = get_session(
        room_code
    )

    if session is None:

        await sio.emit(
            "error",
            {
                "message":
                    "Session not found"
            },
            to=sid
        )

        return

    await sio.enter_room(
        sid,
        room_code
    )

    socket_metadata[sid] = {
        "role": role,
        "room_code": room_code,
        "participant_id":
            participant_id,
    }

    print(
        f"[Socket.IO] {sid} joined {room_code} as {role}"
    )

    await sio.emit(
        "room_joined",
        {
            "room_code":
                room_code,

            "session_name":
                session[
                    "session_name"
                ],
        },
        to=sid
    )

    if role == "participant":

        participant = None

        for p in session.get(
            "participants",
            []
        ):

            if (
                p["participant_id"]
                == participant_id
            ):

                participant = p
                break

        if participant:

            await sio.emit(
                "participant_joined",
                {
                    "participant":
                        participant
                },
                room=room_code,
                skip_sid=sid
            )


@sio.event
async def request_floor(
    sid,
    data=None
):

    metadata = socket_metadata.get(
        sid
    )

    if not metadata:
        return

    room_code = metadata.get(
        "room_code"
    )

    participant_id = metadata.get(
        "participant_id"
    )

    if (
        not room_code
        or not participant_id
    ):
        return

    session = get_session(
        room_code
    )

    if not session:
        return

    floor = session.setdefault(
        "floor",
        {
            "current_speaker": None,
            "queue": []
        }
    )

    current_speaker = floor.get(
        "current_speaker"
    )

    if current_speaker:

        if participant_id not in floor["queue"] and participant_id != current_speaker:

            floor["queue"].append(
                participant_id
            )

    else:

        floor["current_speaker"] = (
            participant_id
        )

    await sio.emit(
        "floor_updated",
        {
            "current_speaker":
                floor[
                    "current_speaker"
                ],

            "queue":
                floor[
                    "queue"
                ]
        },
        room=room_code
    )


@sio.event
async def grant_floor(
    sid,
    data
):

    metadata = socket_metadata.get(
        sid
    )

    if not metadata:
        return

    if metadata.get("role") != "host":
        return

    room_code = metadata.get(
        "room_code"
    )

    participant_id = data.get(
        "participant_id"
    )

    if (
        not room_code
        or not participant_id
    ):
        return

    session = get_session(
        room_code
    )

    if not session:
        return

    floor = session.setdefault(
        "floor",
        {
            "current_speaker": None,
            "queue": []
        }
    )

    floor[
        "current_speaker"
    ] = participant_id

    floor[
        "queue"
    ] = [
        pid
        for pid in floor[
            "queue"
        ]
        if pid != participant_id
    ]

    await sio.emit(
        "floor_updated",
        {
            "current_speaker":
                participant_id,

            "queue":
                floor[
                    "queue"
                ]
        },
        room=room_code
    )


@sio.event
async def release_floor(
    sid,
    data=None
):

    metadata = socket_metadata.get(
        sid
    )

    if not metadata:
        return

    room_code = metadata.get(
        "room_code"
    )

    if not room_code:
        return

    session = get_session(
        room_code
    )

    if not session:
        return

    floor = session.get(
        "floor"
    )

    if not floor:
        return

    floor[
        "current_speaker"
    ] = None

    if floor["queue"]:

        next_speaker = (
            floor["queue"].pop(0)
        )

        floor[
            "current_speaker"
        ] = next_speaker

    await sio.emit(
        "floor_updated",
        {
            "current_speaker":
                floor[
                    "current_speaker"
                ],

            "queue":
                floor[
                    "queue"
                ]
        },
        room=room_code
    )


@sio.event
async def push_to_talk(
    sid,
    data
):

    metadata = socket_metadata.get(
        sid
    )

    if not metadata:
        return

    if metadata.get("role") != "participant":
        return

    room_code = metadata.get(
        "room_code"
    )

    participant_id = metadata.get(
        "participant_id"
    )

    active = bool(
        data.get("active", False)
    )

    if not room_code or not participant_id:
        return

    session = get_session(
        room_code
    )

    if not session:
        return

    floor = session.get(
        "floor",
        {}
    )

    current_speaker = floor.get(
        "current_speaker"
    )

    if (
        active
        and current_speaker != participant_id
    ):
        active = False

    await sio.emit(
        "push_to_talk_updated",
        {
            "participant_id":
                participant_id,

            "active":
                active
        },
        room=room_code
    )


@sio.event
async def latency_ping(
    sid,
    data
):

    metadata = socket_metadata.get(
        sid
    )

    if not metadata:
        return

    room_code = metadata.get(
        "room_code"
    )

    participant_id = metadata.get(
        "participant_id"
    )

    send_timestamp = data.get(
        "timestamp"
    )

    if not room_code or not participant_id or not send_timestamp:
        return

    await sio.emit(
        "latency_ping",
        {
            "participant_id": participant_id,
            "timestamp": send_timestamp,
        },
        room=room_code,
        skip_sid=sid
    )


@sio.event
async def mute_participant(
    sid,
    data
):

    metadata = socket_metadata.get(
        sid
    )

    if not metadata:
        return

    if metadata.get("role") != "host":
        return

    room_code = metadata.get(
        "room_code"
    )

    participant_id = data.get(
        "participant_id"
    )

    session = get_session(
        room_code
    )

    if not session:
        return

    for participant in session.get(
        "participants",
        []
    ):

        if (
            participant[
                "participant_id"
            ]
            == participant_id
        ):

            participant[
                "muted"
            ] = True

            break

    await sio.emit(
        "audio_control_updated",
        {
            "participant_id":
                participant_id,

            "muted":
                True
        },
        room=room_code
    )


@sio.event
async def unmute_participant(
    sid,
    data
):

    metadata = socket_metadata.get(
        sid
    )

    if not metadata:
        return

    if metadata.get("role") != "host":
        return

    room_code = metadata.get(
        "room_code"
    )

    participant_id = data.get(
        "participant_id"
    )

    session = get_session(
        room_code
    )

    if not session:
        return

    for participant in session.get(
        "participants",
        []
    ):

        if (
            participant[
                "participant_id"
            ]
            == participant_id
        ):

            participant[
                "muted"
            ] = False

            break

    await sio.emit(
        "audio_control_updated",
        {
            "participant_id":
                participant_id,

            "muted":
                False
        },
        room=room_code
    )


@sio.event
async def set_participant_volume(
    sid,
    data
):

    metadata = socket_metadata.get(
        sid
    )

    if not metadata:
        return

    if metadata.get("role") != "host":
        return

    room_code = metadata.get(
        "room_code"
    )

    participant_id = data.get(
        "participant_id"
    )

    volume = data.get(
        "volume"
    )

    try:

        volume = float(
            volume
        )

    except (
        TypeError,
        ValueError
    ):

        return

    volume = max(
        0.0,
        min(
            1.0,
            volume
        )
    )

    session = get_session(
        room_code
    )

    if not session:
        return

    for participant in session.get(
        "participants",
        []
    ):

        if (
            participant[
                "participant_id"
            ]
            == participant_id
        ):

            participant[
                "volume"
            ] = volume

            break

    await sio.emit(
        "audio_control_updated",
        {
            "participant_id":
                participant_id,

            "volume":
                volume
        },
        room=room_code
    )


@sio.event
async def webrtc_offer(
    sid,
    data
):

    room_code = data.get("room_code")
    participant_id = data.get("participant_id")
    sdp = data.get("sdp")

    if not room_code or not participant_id or not sdp:
        return

    room_code = room_code.upper()

    session = get_session(room_code)

    if session is None:
        return

    print(
        f"[WebRTC] Offer from {participant_id}"
    )

    await sio.emit(
        "webrtc_offer",
        {
            "participant_id": participant_id,
            "sdp": sdp
        },
        room=room_code,
        skip_sid=sid
    )


@sio.event
async def webrtc_answer(
    sid,
    data
):

    room_code = data.get("room_code")
    participant_id = data.get("participant_id")
    sdp = data.get("sdp")

    if not room_code or not participant_id or not sdp:
        return

    room_code = room_code.upper()

    session = get_session(room_code)

    if session is None:
        return

    print(
        f"[WebRTC] Answer from {participant_id}"
    )

    await sio.emit(
        "webrtc_answer",
        {
            "participant_id": participant_id,
            "sdp": sdp
        },
        room=room_code,
        skip_sid=sid
    )


@sio.event
async def ice_candidate(
    sid,
    data
):

    room_code = data.get("room_code")
    participant_id = data.get("participant_id")
    candidate = data.get("candidate")

    if not room_code or not participant_id or not candidate:
        return

    room_code = room_code.upper()

    session = get_session(room_code)

    if session is None:
        return

    print(
        f"[WebRTC] ICE candidate from {participant_id}"
    )

    await sio.emit(
        "ice_candidate",
        {
            "participant_id": participant_id,
            "candidate": candidate
        },
        room=room_code,
        skip_sid=sid
    )


async def broadcast_participant_joined(
    room_code: str,
    participant: dict
):
    await sio.emit(
        "participant_joined",
        {
            "participant": participant
        },
        room=room_code
    )


async def broadcast_participant_left(
    room_code: str,
    participant_id: str
):
    await sio.emit(
        "participant_left",
        {
            "participant_id": participant_id
        },
        room=room_code
    )


async def broadcast_session_ended(
    room_code: str
):
    await sio.emit(
        "session_ended",
        {
            "room_code": room_code
        },
        room=room_code
    )
