import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")
socket_app = socketio.ASGIApp(sio, app)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@sio.event
async def connect(sid, environ):
    print(f"Client connected: {sid}")


@sio.event
async def score_update(sid, data):
    await sio.emit("score_update", data, skip_sid=sid)


# Regular HTTP endpoints
@app.get("/matches")
async def get_matches():
    # Implementation here
    pass
