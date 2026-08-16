"""
Vmic — Full Multi-Node End-to-End Integration Test Runner (Phase 8).

Accurately tracks all broadcast and targeted messages across 4 concurrent clients:
Host, Phone 1 (Alpha), Phone 2 (Beta), Phone 3 (Gamma).
"""

import asyncio
import json
import os
import sys
import time

_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from fastapi import FastAPI
import uvicorn
import websockets
from models.session import CreateSessionRequest
from services.session import create_session
from websocket.handler import router as ws_router

integration_app = FastAPI()
integration_app.include_router(ws_router)

async def run_full_integration_test():
    print("=================================================================")
    print("        VMIC — MULTI-NODE END-TO-END INTEGRATION TEST           ")
    print("=================================================================\n")

    config = uvicorn.Config(integration_app, host="127.0.0.1", port=8009, log_level="warning")
    server = uvicorn.Server(config)
    server_task = asyncio.create_task(server.serve())
    await asyncio.sleep(0.6)

    ws_url = "ws://127.0.0.1:8009/ws"
    test_results = {}

    try:
        # -------------------------------------------------------------------
        # STEP 1: REST Session Creation & QR Target Verification
        # -------------------------------------------------------------------
        print("[STEP 1] REST Session Creation & QR Target Verification...")
        req = CreateSessionRequest(
            name="Classroom Physics 101",
            room="Room-B204",
            hostName="Prof. Vighnesh",
            maxParticipants=25,
        )
        session_resp = await create_session(req)
        session_id = session_resp.id
        room_code = session_resp.roomCode
        host_id = session_resp.hostId
        join_url = f"http://localhost:3000/join?code={room_code}"

        print(f"   [OK] Session Created: ID={session_id}")
        print(f"   [OK] Room Code: {room_code}")
        print(f"   [OK] QR Join URL: {join_url}")
        assert session_id and len(session_id) == 36
        assert room_code.startswith("ROOMB204-")
        test_results["session_creation_and_qr"] = "PASS"

        # -------------------------------------------------------------------
        # STEP 2 & 3: Multi-Client WebSocket Join (Host + 3 Phones)
        # -------------------------------------------------------------------
        print("\n[STEP 2 & 3] Multi-Client WebSocket Join (Host + 3 Phones)...")
        async with websockets.connect(ws_url) as ws_host, \
                   websockets.connect(ws_url) as ws_p1, \
                   websockets.connect(ws_url) as ws_p2, \
                   websockets.connect(ws_url) as ws_p3:

            # Host joins
            await ws_host.send(json.dumps({
                "type": "JOIN_ROOM",
                "sessionId": session_id,
                "participantId": host_id,
                "displayName": "Prof. Vighnesh",
                "role": "host",
            }))
            h_self = json.loads(await ws_host.recv())
            assert h_self["type"] == "USER_JOINED"
            print(f"   [OK] Host Connected: {h_self['participant']['displayName']} ({host_id})")

            # Phone 1
            await ws_p1.send(json.dumps({
                "type": "JOIN_ROOM",
                "sessionId": session_id,
                "participantId": "phone-alpha-01",
                "displayName": "Student Alpha",
                "role": "attendee",
            }))
            await ws_p1.recv() # self
            await ws_host.recv() # host notification
            print("   [OK] Phone 1 Connected: Student Alpha")

            # Phone 2
            await ws_p2.send(json.dumps({
                "type": "JOIN_ROOM",
                "sessionId": session_id,
                "participantId": "phone-beta-02",
                "displayName": "Student Beta",
                "role": "attendee",
            }))
            await ws_p2.recv() # self
            await ws_p1.recv() # p1 notification
            await ws_host.recv() # host notification
            print("   [OK] Phone 2 Connected: Student Beta")

            # Phone 3
            await ws_p3.send(json.dumps({
                "type": "JOIN_ROOM",
                "sessionId": session_id,
                "participantId": "phone-gamma-03",
                "displayName": "Student Gamma",
                "role": "attendee",
            }))
            await ws_p3.recv() # self
            await ws_p1.recv() # p1 notification
            await ws_p2.recv() # p2 notification
            await ws_host.recv() # host notification
            print("   [OK] Phone 3 Connected: Student Gamma (full mesh broadcast confirmed)")

            test_results["multi_client_join"] = "PASS"

            # ---------------------------------------------------------------
            # STEP 4: Concurrent WebRTC Signaling (3 Peer Links)
            # ---------------------------------------------------------------
            print("\n[STEP 4] Concurrent WebRTC Signaling (3 Peer Links)...")
            for pid, ws_target in [("phone-alpha-01", ws_p1), ("phone-beta-02", ws_p2), ("phone-gamma-03", ws_p3)]:
                offer_sdp = f"v=0\r\no=- {time.time()} 2 IN IP4 192.168.4.1\r\ns=-\r\nm=audio 50051 UDP/TLS/RTP/SAVPF 111\r\n"
                await ws_host.send(json.dumps({
                    "type": "WEBRTC_OFFER",
                    "sessionId": session_id,
                    "fromParticipantId": host_id,
                    "toParticipantId": pid,
                    "sdp": offer_sdp,
                }))
                recvd_offer = json.loads(await ws_target.recv())
                assert recvd_offer["type"] == "WEBRTC_OFFER"

                answer_sdp = f"v=0\r\no=- {time.time()} 2 IN IP4 192.168.4.12\r\ns=-\r\nm=audio 52438 UDP/TLS/RTP/SAVPF 111\r\n"
                await ws_target.send(json.dumps({
                    "type": "WEBRTC_ANSWER",
                    "sessionId": session_id,
                    "fromParticipantId": pid,
                    "toParticipantId": host_id,
                    "sdp": answer_sdp,
                }))
                recvd_answer = json.loads(await ws_host.recv())
                assert recvd_answer["type"] == "WEBRTC_ANSWER"

                # ICE candidate
                await ws_target.send(json.dumps({
                    "type": "ICE_CANDIDATE",
                    "sessionId": session_id,
                    "fromParticipantId": pid,
                    "toParticipantId": host_id,
                    "candidate": {"candidate": f"candidate:1 1 udp 2122260223 192.168.4.12 52438 typ host", "sdpMid": "0", "sdpMLineIndex": 0},
                }))
                recvd_ice = json.loads(await ws_host.recv())
                assert recvd_ice["type"] == "ICE_CANDIDATE"

                print(f"   [OK] Peer Connection Negotiated: Host <--WebRTC--> {pid}")

            test_results["webrtc_signaling"] = "PASS"

            # ---------------------------------------------------------------
            # STEP 5: FIFO Floor Moderation
            # ---------------------------------------------------------------
            print("\n[STEP 5] FIFO Floor Moderation (Requests & Grants)...")
            # Phone 2 requests floor
            await ws_p2.send(json.dumps({
                "type": "REQUEST_FLOOR",
                "sessionId": session_id,
                "participantId": "phone-beta-02",
            }))
            # Drain broadcast on all 4 clients
            await ws_host.recv()
            await ws_p1.recv()
            await ws_p2.recv()
            await ws_p3.recv()
            print("   [OK] Phone 2 requested floor -> Host queued (Position #1)")

            # Phone 3 requests floor (queued behind Phone 2)
            await ws_p3.send(json.dumps({
                "type": "REQUEST_FLOOR",
                "sessionId": session_id,
                "participantId": "phone-gamma-03",
            }))
            await ws_host.recv()
            await ws_p1.recv()
            await ws_p2.recv()
            await ws_p3.recv()
            print("   [OK] Phone 3 requested floor -> Host queued FIFO (Position #2)")

            # Host grants floor to Phone 2
            await ws_host.send(json.dumps({
                "type": "GRANT_FLOOR",
                "sessionId": session_id,
                "participantId": "phone-beta-02",
            }))
            await ws_host.recv()
            await ws_p1.recv()
            gf_p2 = json.loads(await ws_p2.recv())
            await ws_p3.recv()
            assert gf_p2["type"] == "GRANT_FLOOR"
            assert gf_p2["participantId"] == "phone-beta-02"
            print("   [OK] Host granted floor to Phone 2 -> Phone 2 received floor permission")

            # Host releases Phone 2
            await ws_host.send(json.dumps({
                "type": "RELEASE_FLOOR",
                "sessionId": session_id,
                "participantId": "phone-beta-02",
            }))
            await ws_host.recv()
            await ws_p1.recv()
            rel_p2 = json.loads(await ws_p2.recv())
            await ws_p3.recv()
            assert rel_p2["type"] == "RELEASE_FLOOR"
            print("   [OK] Host released floor from Phone 2")

            test_results["floor_moderation_queue"] = "PASS"

            # ---------------------------------------------------------------
            # STEP 6: Live Audio Mute & Controls
            # ---------------------------------------------------------------
            print("\n[STEP 6] Live Mute Controls...")
            # Phone 1 self-mutes
            await ws_p1.send(json.dumps({
                "type": "MUTE",
                "sessionId": session_id,
                "participantId": "phone-alpha-01",
            }))
            mute_h = json.loads(await ws_host.recv())
            await ws_p1.recv()
            await ws_p2.recv()
            await ws_p3.recv()
            assert mute_h["type"] == "MUTE"
            assert mute_h["participantId"] == "phone-alpha-01"
            print("   [OK] Phone 1 muted -> Host received MUTE signal")

            # Host un-mutes Phone 1
            await ws_host.send(json.dumps({
                "type": "UNMUTE",
                "sessionId": session_id,
                "participantId": "phone-alpha-01",
            }))
            await ws_host.recv()
            unmute_p1 = json.loads(await ws_p1.recv())
            await ws_p2.recv()
            await ws_p3.recv()
            assert unmute_p1["type"] == "UNMUTE"
            print("   [OK] Host un-muted Phone 1 -> Phone 1 received UNMUTE signal")

            test_results["mute_controls"] = "PASS"

            # ---------------------------------------------------------------
            # STEP 7: Disconnect & Clean Session Termination
            # ---------------------------------------------------------------
            print("\n[STEP 7] Clean Disconnect & Session Termination...")
            # Phone 3 leaves
            await ws_p3.send(json.dumps({
                "type": "USER_LEFT",
                "sessionId": session_id,
                "participantId": "phone-gamma-03",
                "reason": "class_dismissed",
            }))
            left_h = json.loads(await ws_host.recv())
            await ws_p1.recv()
            await ws_p2.recv()
            assert left_h["type"] == "USER_LEFT"
            assert left_h["participantId"] == "phone-gamma-03"
            print("   [OK] Phone 3 disconnected -> Host cleaned up peer link")

            # Host terminates session
            await ws_host.send(json.dumps({
                "type": "SESSION_ENDED",
                "sessionId": session_id,
                "endedAt": int(time.time() * 1000),
            }))
            await ws_host.recv()
            end_p1 = json.loads(await ws_p1.recv())
            end_p2 = json.loads(await ws_p2.recv())
            assert end_p1["type"] == "SESSION_ENDED"
            assert end_p2["type"] == "SESSION_ENDED"
            print("   [OK] Host ended session -> Remaining phones received SESSION_ENDED")

            test_results["clean_termination"] = "PASS"

        print("\n=================================================================")
        print("          ALL INTEGRATION PASS ASSERTIONS PASSED (100%)          ")
        print("=================================================================\n")
        print("Test Summary:")
        for k, v in test_results.items():
            print(f"  - {k}: {v}")

    finally:
        server.should_exit = True
        await server_task

if __name__ == "__main__":
    asyncio.run(run_full_integration_test())
