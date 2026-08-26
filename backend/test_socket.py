import socketio


sio = socketio.Client()


ROOM_CODE = "YOUR_ROOM_CODE"
PARTICIPANT_ID = "test-participant"


@sio.event
def connect():

    print("Connected")

    sio.emit(
        "join_room",
        {
            "room_code": ROOM_CODE
        }
    )


@sio.on("room_joined")
def room_joined(data):

    print(
        "Room joined:",
        data
    )

    send_offer()


def send_offer():

    fake_sdp = """
    v=0
    o=- 123456 2 IN IP4 127.0.0.1
    s=VMIC Test
    t=0 0
    """

    print("Sending test WebRTC offer")

    sio.emit(
        "webrtc_offer",
        {
            "room_code": ROOM_CODE,
            "participant_id": PARTICIPANT_ID,
            "sdp": fake_sdp
        }
    )


@sio.on("webrtc_offer")
def received_offer(data):

    print(
        "Received WebRTC offer:"
    )

    print(data)


@sio.on("webrtc_answer")
def received_answer(data):

    print(
        "Received WebRTC answer:"
    )

    print(data)


@sio.on("ice_candidate")
def received_ice(data):

    print(
        "Received ICE candidate:"
    )

    print(data)


@sio.on("error")
def server_error(data):

    print(
        "Server error:",
        data
    )


sio.connect(
    "http://localhost:8000"
)

sio.wait()
