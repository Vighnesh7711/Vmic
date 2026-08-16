"""
Vmic — Direct Async WebSocket Signaling Test.

Uses the installed `websockets` package to connect two real client sockets
to the FastAPI WebSocket signaling router, verifying:
- Client A connects and sends JOIN_ROOM
- Client B connects and sends JOIN_ROOM
- Client A receives USER_JOINED for Client B
- Client B sends MUTE -> Client A receives MUTE
- Client B sends USER_LEFT -> Client A receives USER_LEFT
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

# Test app mounting the signaling router
test_app = FastAPI()
test_app.include_router(ws_router)

async def run_test():
    config = uvicorn.Config(test_app, host="127.0.0.1", port=8005, log_level="warning")
    server = uvicorn.Server(config)

    # Start server task
    server_task = asyncio.create_task(server.serve())
    await asyncio.sleep(0.6)

    ws_url = "ws://127.0.0.1:8005/ws"
    session_id = "test-session-live-01"

    try:
        print(f"Connecting Client A to {ws_url}...")
        async with websockets.connect(ws_url) as ws_a:
            # Client A joins
            await ws_a.send(json.dumps({
                "type": "JOIN_ROOM",
                "sessionId": session_id,
                "participantId": "host-01",
                "displayName": "Host Teacher",
                "role": "host",
            }))
            resp_a = json.loads(await ws_a.recv())
            print(f"Client A received: {resp_a}")
            assert resp_a["type"] == "USER_JOINED"
            assert resp_a["participant"]["id"] == "host-01"

            print(f"\nConnecting Client B to {ws_url}...")
            async with websockets.connect(ws_url) as ws_b:
                # Client B joins
                await ws_b.send(json.dumps({
                    "type": "JOIN_ROOM",
                    "sessionId": session_id,
                    "participantId": "student-02",
                    "displayName": "Student Phone",
                    "role": "attendee",
                }))

                resp_b_self = json.loads(await ws_b.recv())
                print(f"Client B received self-broadcast: {resp_b_self}")
                assert resp_b_self["type"] == "USER_JOINED"

                resp_a_b_joined = json.loads(await ws_a.recv())
                print(f"Client A received broadcast: {resp_a_b_joined}")
                assert resp_a_b_joined["type"] == "USER_JOINED"
                assert resp_a_b_joined["participant"]["id"] == "student-02"

                print("\nClient B sends MUTE signal...")
                await ws_b.send(json.dumps({
                    "type": "MUTE",
                    "sessionId": session_id,
                    "participantId": "student-02",
                }))

                resp_a_mute = json.loads(await ws_a.recv())
                print(f"Client A received MUTE: {resp_a_mute}")
                assert resp_a_mute["type"] == "MUTE"
                assert resp_a_mute["participantId"] == "student-02"

                print("\nClient B sends USER_LEFT...")
                await ws_b.send(json.dumps({
                    "type": "USER_LEFT",
                    "sessionId": session_id,
                    "participantId": "student-02",
                    "reason": "leaving",
                }))

                resp_a_left = json.loads(await ws_a.recv())
                print(f"Client A received USER_LEFT: {resp_a_left}")
                assert resp_a_left["type"] == "USER_LEFT"
                assert resp_a_left["participantId"] == "student-02"

        print("\n>>> ALL WEBSOCKET SIGNALING ASSERTIONS PASSED SUCCESSFULLY <<<")

    finally:
        server.should_exit = True
        await server_task

if __name__ == "__main__":
    asyncio.run(run_test())
