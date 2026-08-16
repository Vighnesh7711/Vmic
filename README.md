<<<<<<< HEAD
=======

# Vmic
<br>
##Architechture Diagram
<img width="1536" height="1024" alt="b35f8247-9cd9-4007-81cc-46ec5af1eb8a" src="https://github.com/user-attachments/assets/56489bbf-301c-40a7-9ef5-f530a122abd4" />
>>>>>>> f2507ef0b92302e328a59b84455215f76b50e547
# Vmic

Local wireless multi-phone microphone and audio mixing system.  
Turn attendee phones into wireless mics over local Wi-Fi — no cloud required.

## Tech Stack

| Layer    | Technology                                  |
| -------- | ------------------------------------------- |
| Frontend | Next.js · React · TypeScript · Tailwind CSS |
| Backend  | Python · FastAPI · WebSocket                |
| State    | Redis                                       |
| Audio    | WebRTC · Web Audio API · AudioWorklet       |

## Project Structure

```
Vmic/
├── frontend/                # Next.js application
│   ├── app/                 # App Router pages and layout
│   ├── components/          # React components (Stitch UI)
│   ├── hooks/               # Custom React hooks
│   ├── lib/
│   │   ├── audio/           # Web Audio API module
│   │   ├── constants.ts     # Shared enums (states, roles)
│   │   ├── types.ts         # TypeScript interfaces
│   │   ├── webrtc/          # WebRTC peer connection module
│   │   └── websocket/       # WebSocket client module
│   └── public/              # Static assets
├── backend/                 # FastAPI application
│   ├── main.py              # App entry point
│   ├── config.py            # Environment configuration
│   ├── routers/
│   │   └── health.py        # GET /api/health
│   ├── websocket/
│   │   └── handler.py       # WS /ws endpoint
│   ├── services/            # Business logic (Phase 2)
│   └── redis_client/
│       └── connection.py    # Async Redis client
└── audio/
    └── worklets/            # AudioWorklet processors (Phase 3)
```

## Prerequisites

- **Node.js** ≥ 20 (with npm)
- **Python** ≥ 3.11
- **Redis** (optional for Phase 1 — health endpoint reports connectivity)

## Setup

### Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

### Backend

```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
# source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
# → http://localhost:8000
```

### Verify

```bash
# Health check
curl http://localhost:8000/api/health

# WebSocket (wscat or browser devtools)
wscat -c ws://localhost:8000/ws
```

## Architecture Principles

- **Audio never touches FastAPI/WebSocket/Redis** — it flows peer-to-peer via WebRTC.
- **WebSocket is for signaling and control only** — session join/leave, ICE relay, mute state.
- **Clean layer separation** — UI, networking, audio, and backend are independent modules.
- **Local-first** — operates entirely on local Wi-Fi, no Internet required for core session.
