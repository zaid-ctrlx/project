import uuid

from fastapi import WebSocket


class ConnectionManager:
    """In-process registry of each currently-connected user's single active
    WebSocket. No pub/sub, no Redis — single-process FYP deployment, so a
    plain dict is enough. A second connection for the same user (e.g.
    reopened on another device) simply replaces the first; multi-device
    fan-out is out of scope. Safe without locks: asyncio is single-threaded
    and every access here happens without an `await` in between, so no two
    coroutines can interleave a read/write on the same key."""

    def __init__(self) -> None:
        self._connections: dict[uuid.UUID, WebSocket] = {}

    def register(self, user_id: uuid.UUID, websocket: WebSocket) -> None:
        self._connections[user_id] = websocket

    def unregister(self, user_id: uuid.UUID, websocket: WebSocket) -> None:
        # Only clear if this socket is still on record — guards against a
        # stale connection's disconnect handler clobbering a newer reconnect.
        if self._connections.get(user_id) is websocket:
            del self._connections[user_id]

    async def send_to_user(self, user_id: uuid.UUID, payload: dict) -> bool:
        websocket = self._connections.get(user_id)
        if websocket is None:
            return False
        try:
            await websocket.send_json(payload)
            return True
        except Exception:
            self.unregister(user_id, websocket)
            return False


manager = ConnectionManager()
