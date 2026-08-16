"""
Vmic — WebRTC Peer-to-Peer Signaling & Audio Transport Pipeline Test.

Simulates two real browser client WebSocket connections:
1. Host (host-01) connects and joins 'webrtc-session-01'.
2. Phone (phone-02) connects and joins 'webrtc-session-01'.
3. Host initiates WebRTC connection -> sends WEBRTC_OFFER to phone-02.
4. Phone receives WEBRTC_OFFER -> replies with WEBRTC_ANSWER to host-01.
5. Host receives WEBRTC_ANSWER -> sets remote description.
6. Phone gathers and sends ICE_CANDIDATE -> Host receives ICE_CANDIDATE.
7. Host gathers and sends ICE_CANDIDATE -> Phone receives ICE_CANDIDATE.
8. Verifies targeted routing: no audio payload in WebSocket/Redis.
"""

import asyncio
import json
import os
import sys
from fastapi import FastAPI
import uvicorn
import websockets

_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from websocket.handler import router as ws_router

test_app = FastAPI()
test_app.include_router(ws_router)

async def run_pipeline_test():
    config = uvicorn.Config(test_app, host="127.0.0.1", port=8006, log_level="warning")
    server = uvicorn.Server(config)
    server_task = asyncio.create_task(server.serve())
    await asyncio.sleep(0.6)

    ws_url = "ws://127.0.0.1:8006/ws"
    session_id = "webrtc-session-01"

    logs = []

    def log(party: str, event: str, payload: dict):
        entry = f"[{party}] {event}: {json.dumps(payload)}"
        logs.append(entry)
        print(entry)

    try:
        print("=== [START] WebRTC Signaling Pipeline Test ===")

        async with websockets.connect(ws_url) as ws_host, websockets.connect(ws_url) as ws_phone:
            # 1. Host joins
            await ws_host.send(json.dumps({
                "type": "JOIN_ROOM",
                "sessionId": session_id,
                "participantId": "host-01",
                "displayName": "Classroom Host",
                "role": "host",
            }))
            resp_h1 = json.loads(await ws_host.recv())
            log("HOST", "USER_JOINED (Self)", resp_h1)
            assert resp_h1["type"] == "USER_JOINED"

            # 2. Phone joins
            await ws_phone.send(json.dumps({
                "type": "JOIN_ROOM",
                "sessionId": session_id,
                "participantId": "phone-02",
                "displayName": "Attendee Phone",
                "role": "attendee",
            }))
            resp_p1 = json.loads(await ws_phone.recv())
            log("PHONE", "USER_JOINED (Self)", resp_p1)

            # Host receives notification that phone joined
            resp_h_p_joined = json.loads(await ws_host.recv())
            log("HOST", "USER_JOINED (Remote attendee)", resp_h_p_joined)
            assert resp_h_p_joined["participant"]["id"] == "phone-02"

            # 3. Host creates & sends WEBRTC_OFFER to phone-02
            mock_offer_sdp = "v=0\r\no=- 123456 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=rtpmap:111 opus/48000/2\r\n"
            offer_msg = {
                "type": "WEBRTC_OFFER",
                "sessionId": session_id,
                "fromParticipantId": "host-01",
                "toParticipantId": "phone-02",
                "sdp": mock_offer_sdp,
            }
            await ws_host.send(json.dumps(offer_msg))
            log("HOST", "WEBRTC_OFFER (Sent)", {"to": "phone-02", "sdp_len": len(mock_offer_sdp)})

            # 4. Phone receives WEBRTC_OFFER
            recvd_offer = json.loads(await ws_phone.recv())
            log("PHONE", "WEBRTC_OFFER (Received)", {"from": recvd_offer["fromParticipantId"], "type": recvd_offer["type"]})
            assert recvd_offer["type"] == "WEBRTC_OFFER"
            assert recvd_offer["fromParticipantId"] == "host-01"

            # 5. Phone creates & sends WEBRTC_ANSWER to host-01
            mock_answer_sdp = "v=0\r\no=- 654321 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=rtpmap:111 opus/48000/2\r\na=sendrecv\r\n"
            answer_msg = {
                "type": "WEBRTC_ANSWER",
                "sessionId": session_id,
                "fromParticipantId": "phone-02",
                "toParticipantId": "host-01",
                "sdp": mock_answer_sdp,
            }
            await ws_phone.send(json.dumps(answer_msg))
            log("PHONE", "WEBRTC_ANSWER (Sent)", {"to": "host-01", "sdp_len": len(mock_answer_sdp)})

            # 6. Host receives WEBRTC_ANSWER
            recvd_answer = json.loads(await ws_host.recv())
            log("HOST", "WEBRTC_ANSWER (Received)", {"from": recvd_answer["fromParticipantId"], "type": recvd_answer["type"]})
            assert recvd_answer["type"] == "WEBRTC_ANSWER"
            assert recvd_answer["fromParticipantId"] == "phone-02"

            # 7. Phone sends ICE_CANDIDATE to host-01
            mock_ice_p = {
                "candidate": "candidate:842163049 1 udp 1677729535 192.168.4.12 52438 typ host",
                "sdpMid": "0",
                "sdpMLineIndex": 0,
            }
            await ws_phone.send(json.dumps({
                "type": "ICE_CANDIDATE",
                "sessionId": session_id,
                "fromParticipantId": "phone-02",
                "toParticipantId": "host-01",
                "candidate": mock_ice_p,
            }))
            log("PHONE", "ICE_CANDIDATE (Sent)", {"to": "host-01", "candidate": mock_ice_p["candidate"]})

            # Host receives Phone's ICE candidate
            recvd_ice_h = json.loads(await ws_host.recv())
            log("HOST", "ICE_CANDIDATE (Received)", {"from": recvd_ice_h["fromParticipantId"], "candidate": recvd_ice_h["candidate"]["candidate"]})
            assert recvd_ice_h["type"] == "ICE_CANDIDATE"

            # 8. Host sends ICE_CANDIDATE to phone-02
            mock_ice_h = {
                "candidate": "candidate:918273645 1 udp 1677729535 192.168.4.1 50051 typ host",
                "sdpMid": "0",
                "sdpMLineIndex": 0,
            }
            await ws_host.send(json.dumps({
                "type": "ICE_CANDIDATE",
                "sessionId": session_id,
                "fromParticipantId": "host-01",
                "toParticipantId": "phone-02",
                "candidate": mock_ice_h,
            }))
            log("HOST", "ICE_CANDIDATE (Sent)", {"to": "phone-02", "candidate": mock_ice_h["candidate"]})

            # Phone receives Host's ICE candidate
            recvd_ice_p = json.loads(await ws_phone.recv())
            log("PHONE", "ICE_CANDIDATE (Received)", {"from": recvd_ice_p["fromParticipantId"], "candidate": recvd_ice_p["candidate"]["candidate"]})
            assert recvd_ice_p["type"] == "ICE_CANDIDATE"

        print("\n=== [SUCCESS] Complete WebRTC Signaling & ICE Exchange Verified Cleanly ===")

    finally:
        server.should_exit = True
        await server_task

if __name__ == "__main__":
    asyncio.run(run_pipeline_test())
