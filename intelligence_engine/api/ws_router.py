"""
Climactix Global — WebSocket Router
====================================
Provides real-time climate intelligence streaming via WebSocket.

Endpoints:
  WS  /ws/stream         — Full live climate data stream (metrics + ticker + alerts)
  WS  /ws/metrics        — Live metrics only (CO₂, temp, wildfires, etc.)
  WS  /ws/alerts         — Live alert events only
  GET /ws/status         — WebSocket service health check

Channels (send {"type":"subscribe","channel":"<name>"} after connect):
  live_metrics   — All quantitative climate metrics (~5s intervals)
  ticker         — Bloomberg-style ticker feed (~5s intervals)
  alerts         — Discrete alert events (as they occur)
"""

import asyncio
import json
import logging
from typing import Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse

from services.live_stream import stream_climate_data, get_current_state

logger = logging.getLogger("climactix.ws")
router = APIRouter(prefix="/ws", tags=["WebSocket"])

# ── Connection Manager ────────────────────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        self.active: Set[WebSocket] = set()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.add(ws)
        logger.info(f"WS connected. Total: {len(self.active)}")

    def disconnect(self, ws: WebSocket):
        self.active.discard(ws)
        logger.info(f"WS disconnected. Total: {len(self.active)}")

    async def broadcast(self, msg: str):
        dead = set()
        for ws in list(self.active):
            try:
                await ws.send_text(msg)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self.disconnect(ws)


manager = ConnectionManager()


# ── WebSocket Endpoints ───────────────────────────────────────────────────────

@router.websocket("/stream")
async def ws_stream(websocket: WebSocket):
    """
    Full live climate stream.
    Client can send:
      {"type": "subscribe",   "channel": "live_metrics|ticker|alerts"}
      {"type": "unsubscribe", "channel": "..."}
      {"type": "ping"}
    """
    await manager.connect(websocket)

    subscribed_channels = {"live_metrics", "ticker", "alerts"}
    stream_task: asyncio.Task | None = None

    async def send_message(msg_str: str):
        await websocket.send_text(msg_str)

    # Send initial state immediately on connect
    try:
        initial = {
            "type": "data",
            "channel": "live_metrics",
            "payload": get_current_state(),
            "timestamp": get_current_state()["last_updated"],
        }
        await websocket.send_text(json.dumps(initial))
        await websocket.send_text(json.dumps({
            "type": "data",
            "channel": "connection",
            "payload": {
                "status": "connected",
                "channels": list(subscribed_channels),
                "interval_s": 5,
            },
            "timestamp": initial["timestamp"],
        }))
    except Exception:
        manager.disconnect(websocket)
        return

    # Start streaming task
    stream_task = asyncio.create_task(
        stream_climate_data(send_message, interval=5.0, channels=list(subscribed_channels))
    )

    try:
        while True:
            try:
                raw = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                msg = json.loads(raw)

                if msg.get("type") == "ping":
                    await websocket.send_text(json.dumps({
                        "type": "pong",
                        "timestamp": msg.get("timestamp", ""),
                    }))

                elif msg.get("type") == "subscribe" and msg.get("channel"):
                    subscribed_channels.add(msg["channel"])
                    if stream_task and not stream_task.done():
                        stream_task.cancel()
                    stream_task = asyncio.create_task(
                        stream_climate_data(send_message, interval=5.0, channels=list(subscribed_channels))
                    )

                elif msg.get("type") == "unsubscribe" and msg.get("channel"):
                    subscribed_channels.discard(msg["channel"])

            except asyncio.TimeoutError:
                # Send keepalive ping
                try:
                    await websocket.send_text(json.dumps({"type": "ping", "timestamp": ""}))
                except Exception:
                    break

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.error(f"WS error: {exc}")
    finally:
        if stream_task and not stream_task.done():
            stream_task.cancel()
        manager.disconnect(websocket)


@router.websocket("/metrics")
async def ws_metrics(websocket: WebSocket):
    """Lightweight metrics-only stream."""
    await websocket.accept()
    try:
        await stream_climate_data(
            lambda msg: websocket.send_text(msg),
            interval=5.0,
            channels=["live_metrics"],
        )
    except WebSocketDisconnect:
        pass
    except Exception:
        pass


@router.websocket("/alerts")
async def ws_alerts(websocket: WebSocket):
    """Alert-events-only stream."""
    await websocket.accept()
    try:
        await stream_climate_data(
            lambda msg: websocket.send_text(msg),
            interval=10.0,
            channels=["alerts"],
        )
    except WebSocketDisconnect:
        pass
    except Exception:
        pass


@router.get("/status")
def ws_status():
    """WebSocket service health check."""
    return JSONResponse({
        "status": "operational",
        "active_connections": len(manager.active),
        "endpoints": ["/ws/stream", "/ws/metrics", "/ws/alerts"],
        "stream_interval_s": 5,
        "channels": ["live_metrics", "ticker", "alerts"],
    })
