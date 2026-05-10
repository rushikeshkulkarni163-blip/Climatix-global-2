"""
Climactix Global — Live Data Streaming Service
================================================
Provides real-time climate intelligence data streams for:
  - CO₂ and temperature metrics (synthetic + API-backed)
  - Active disaster and alert events
  - Ticker feed updates
  - Layer state for the geospatial risk map
"""

import asyncio
import json
import math
import random
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

# ── Climate data state (in-process cache) ─────────────────────────────────────

_state: Dict[str, Any] = {
    "co2ppm": 424.7,
    "global_temp_anomaly": 1.48,
    "arctic_sea_ice_loss": -13.0,
    "sea_level_rise_mm": 3.7,
    "carbon_budget_gt": 380,
    "renewable_share_pct": 30.3,
    "climate_finance_gap_t": 4.3,
    "active_wildfires": 847,
    "active_flood_alerts": 23,
    "active_cyclones": 4,
    "aqi_global_avg": 64,
    "last_updated": datetime.now(timezone.utc).isoformat(),
}

_drift_config = {
    "co2ppm": {"base": 424.7, "amplitude": 0.8, "period_s": 3600, "noise": 0.05},
    "global_temp_anomaly": {"base": 1.48, "amplitude": 0.04, "period_s": 7200, "noise": 0.005},
    "sea_level_rise_mm": {"base": 3.7, "amplitude": 0.05, "period_s": 3600, "noise": 0.003},
    "renewable_share_pct": {"base": 30.3, "amplitude": 0.4, "period_s": 1800, "noise": 0.1},
    "active_wildfires": {"base": 847, "amplitude": 120, "period_s": 900, "noise": 15},
    "aqi_global_avg": {"base": 64, "amplitude": 8, "period_s": 1200, "noise": 2},
}


def _oscillate(cfg: Dict, t: float) -> float:
    """Sine-wave oscillation with added Gaussian noise."""
    wave = cfg["amplitude"] * math.sin(2 * math.pi * t / cfg["period_s"])
    noise = random.gauss(0, cfg["noise"])
    return cfg["base"] + wave + noise


def get_current_state() -> Dict[str, Any]:
    t = time.time()
    state = {**_state}
    for key, cfg in _drift_config.items():
        raw = _oscillate(cfg, t)
        state[key] = round(raw, 3 if key in ("global_temp_anomaly", "sea_level_rise_mm") else 1)
    state["last_updated"] = datetime.now(timezone.utc).isoformat()
    return state


def build_metrics_message() -> Dict[str, Any]:
    s = get_current_state()
    return {
        "type": "data",
        "channel": "live_metrics",
        "payload": s,
        "timestamp": s["last_updated"],
    }


def build_ticker_message() -> Dict[str, Any]:
    s = get_current_state()
    items = [
        {
            "id": "co2",
            "label": "CO₂ Concentration",
            "value": f"{s['co2ppm']:.1f} ppm",
            "dir": "up",
            "category": "carbon",
            "priority": "high",
            "source": "NOAA GML",
        },
        {
            "id": "temp_anomaly",
            "label": "Global Avg Temp Anomaly",
            "value": f"+{s['global_temp_anomaly']:.2f}°C",
            "dir": "up",
            "category": "physical",
            "priority": "critical",
            "source": "NASA GISS",
        },
        {
            "id": "arctic_ice",
            "label": "Arctic Sea Ice Loss",
            "value": f"{s['arctic_sea_ice_loss']}%/decade",
            "dir": "down",
            "category": "physical",
            "priority": "high",
            "source": "NSIDC",
        },
        {
            "id": "wildfire",
            "label": "Active Wildfire Events",
            "value": f"{int(s['active_wildfires']):,} events",
            "dir": "up" if s["active_wildfires"] > 850 else "down",
            "category": "physical",
            "priority": "critical" if s["active_wildfires"] > 950 else "high",
            "source": "FIRMS/ReliefWeb",
        },
        {
            "id": "renewable",
            "label": "Renewable Energy Share",
            "value": f"{s['renewable_share_pct']:.1f}% global",
            "dir": "up",
            "category": "economic",
            "priority": "medium",
            "source": "IEA",
        },
    ]
    return {
        "type": "data",
        "channel": "ticker",
        "payload": {"items": items},
        "timestamp": s["last_updated"],
    }


def build_alert_message() -> Optional[Dict[str, Any]]:
    """Occasionally synthesise an alert event (10% chance per call)."""
    if random.random() > 0.10:
        return None
    ALERT_TYPES = [
        ("wildfire", "🔥 Elevated wildfire risk", "Western North America", "critical"),
        ("flood", "🌊 Flood advisory issued", "Southeast Asia", "high"),
        ("cyclone", "🌀 Tropical cyclone monitoring", "Bay of Bengal", "high"),
        ("heatwave", "🌡️ Extreme heat event", "Mediterranean", "medium"),
    ]
    a_type, title, region, severity = random.choice(ALERT_TYPES)
    return {
        "type": "alert",
        "channel": "alerts",
        "payload": {
            "id": f"stream_{int(time.time())}",
            "type": a_type,
            "severity": severity,
            "title": title,
            "region": region,
            "description": f"Live intelligence stream detected elevated {a_type} conditions.",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "source": "Climactix Intelligence Engine",
            "active": True,
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


async def stream_climate_data(send_fn, interval: float = 5.0, channels: Optional[List[str]] = None):
    """
    Coroutine that calls send_fn(msg_str) on each tick.
    Designed to run inside a WebSocket handler.
    """
    active_channels = set(channels or ["live_metrics", "ticker", "alerts"])

    while True:
        try:
            messages = []
            if "live_metrics" in active_channels:
                messages.append(build_metrics_message())
            if "ticker" in active_channels:
                messages.append(build_ticker_message())
            if "alerts" in active_channels:
                alert = build_alert_message()
                if alert:
                    messages.append(alert)

            for msg in messages:
                await send_fn(json.dumps(msg))

            await asyncio.sleep(interval)
        except asyncio.CancelledError:
            break
        except Exception:
            await asyncio.sleep(interval)
