from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import socketio

from app.api.routes.health import router as health_router
from app.api.routes.sessions import router as session_router
from app.websocket.socket_manager import sio


fastapi_app = FastAPI(
    title="VMIC Backend",
    description="Virtual Microphone and Integrated Controller",
    version="0.1.0",
)

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


fastapi_app.include_router(health_router)
fastapi_app.include_router(session_router)


@fastapi_app.get("/")
async def root():
    return {
        "message": "VMIC backend is running"
    }


app = socketio.ASGIApp(
    sio,
    other_asgi_app=fastapi_app,
    socketio_path="socket.io",
)
