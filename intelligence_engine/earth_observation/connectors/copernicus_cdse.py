"""
Copernicus Data Space Ecosystem (CDSE) connector — Sentinel-1/2/3/5P/6
scene DISCOVERY via STAC. Metadata only: this never downloads rasters
(spec §8) — it returns which scenes exist for a bbox/date range so the
indicator engine can decide what's worth pulling.

Auth (verified against current docs, 2026):
  OAuth2 client-credentials grant. Register a client at the Sentinel Hub
  Dashboard ("User settings" -> OAuth clients) inside dataspace.copernicus.eu,
  then set CDSE_CLIENT_ID / CDSE_CLIENT_SECRET.
  Token endpoint: https://identity.dataspace.copernicus.eu/auth/realms/cdse/protocol/openid-connect/token
  Docs: https://documentation.dataspace.copernicus.eu/APIs/Token.html

  This is NOT the classic Sentinel Hub OAuth flow and NOT the retired
  SciHub/ESA hub credentials — those are decommissioned.

STAC catalogue: https://documentation.dataspace.copernicus.eu/APIs/STAC.html
"""

from __future__ import annotations

import logging
import os
import time
from typing import Optional

import httpx

from ..types import Confidence, ConnectorResult, ObservationType, Provenance, now_iso, unavailable

logger = logging.getLogger(__name__)

TOKEN_URL = "https://identity.dataspace.copernicus.eu/auth/realms/cdse/protocol/openid-connect/token"
STAC_SEARCH_URL = "https://stac.dataspace.copernicus.eu/v1/search"

# Sentinel mission -> STAC collection id, and what each mission is used for
# (spec §2). Kept as a single lookup so the indicator engine and the
# /sources registry both read from one place.
SENTINEL_COLLECTIONS: dict[str, dict] = {
    "sentinel-1": {
        "stac_collection": "sentinel-1-grd",
        "use": "SAR — flood extent, land deformation, infrastructure monitoring, coastal change",
        "resolution": "5m-40m (mode-dependent)",
    },
    "sentinel-2": {
        "stac_collection": "sentinel-2-l2a",
        "use": "NDVI, vegetation, land cover/use change, surface water, burned area, industrial expansion",
        "resolution": "10m/20m/60m (band-dependent)",
    },
    "sentinel-3": {
        "stac_collection": "sentinel-3-slstr-lst-l2-ndsi",
        "use": "Land surface temperature, sea surface temperature, ocean colour",
        "resolution": "300m-1km",
    },
    "sentinel-5p": {
        "stac_collection": "sentinel-5p-l2",
        "use": "NO2, SO2, CO, CH4, O3, aerosols — atmospheric pollution indicators",
        "resolution": "3.5km x 5.5km-7km",
    },
    "sentinel-6": {
        "stac_collection": "sentinel-6",
        "use": "Sea level, sea-surface height, coastal exposure",
        "resolution": "along-track altimetry",
    },
}

_token_cache: dict[str, tuple[str, float]] = {}


def cdse_status() -> dict:
    configured = bool(os.getenv("CDSE_CLIENT_ID") and os.getenv("CDSE_CLIENT_SECRET"))
    return {
        "available": True,
        "configured": configured,
        "auth_type": "oauth2_client_credentials",
        "token_url": TOKEN_URL,
        "setup_url": "https://dataspace.copernicus.eu/analyse/apis",
        "note": "Register an OAuth client via the Sentinel Hub Dashboard inside dataspace.copernicus.eu.",
    }


async def _get_token() -> Optional[str]:
    client_id = os.getenv("CDSE_CLIENT_ID")
    client_secret = os.getenv("CDSE_CLIENT_SECRET")
    if not client_id or not client_secret:
        return None

    cached = _token_cache.get("token")
    if cached and cached[1] > time.time() + 30:
        return cached[0]

    try:
        async with httpx.AsyncClient() as client:
            r = await client.post(
                TOKEN_URL,
                data={
                    "grant_type": "client_credentials",
                    "client_id": client_id,
                    "client_secret": client_secret,
                },
                timeout=15.0,
            )
            r.raise_for_status()
            body = r.json()
            token = body["access_token"]
            expires_at = time.time() + float(body.get("expires_in", 600))
            _token_cache["token"] = (token, expires_at)
            return token
    except Exception as e:
        logger.warning(f"CDSE token request failed: {e}")
        return None


async def search_scenes(
    mission: str,
    bbox: tuple[float, float, float, float],
    start_date: str,
    end_date: str,
    limit: int = 10,
) -> ConnectorResult:
    """
    Discover Sentinel scenes covering `bbox` in [start_date, end_date].
    `bbox` = (min_lng, min_lat, max_lng, max_lat).
    Returns STAC item metadata only — no raster download.
    """
    mission_key = mission.lower()
    if mission_key not in SENTINEL_COLLECTIONS:
        return unavailable("copernicus-cdse", f"Unknown Sentinel mission '{mission}'")

    coll = SENTINEL_COLLECTIONS[mission_key]
    token = await _get_token()

    if token is None:
        return ConnectorResult(
            data=_demo_scenes(mission_key, bbox),
            provenance=Provenance(
                source=f"Copernicus Sentinel ({mission_key})",
                method=f"STAC search — {coll['use']}",
                observation_type=ObservationType.DIRECT_OBSERVATION,
                resolution=coll["resolution"],
                confidence=Confidence.LOW,
                date=now_iso(),
                demo=True,
                attribution="Contains modified Copernicus Sentinel data",
                limitations="CDSE_CLIENT_ID/CDSE_CLIENT_SECRET not configured — demo scene list, not a live catalogue search.",
            ),
        )

    try:
        async with httpx.AsyncClient() as client:
            r = await client.post(
                STAC_SEARCH_URL,
                json={
                    "collections": [coll["stac_collection"]],
                    "bbox": list(bbox),
                    "datetime": f"{start_date}T00:00:00Z/{end_date}T23:59:59Z",
                    "limit": limit,
                },
                headers={"Authorization": f"Bearer {token}"},
                timeout=20.0,
            )
            r.raise_for_status()
            items = r.json().get("features", [])
    except Exception as e:
        logger.warning(f"CDSE STAC search failed for {mission_key}: {e}")
        return unavailable(f"Copernicus Sentinel ({mission_key})", str(e))

    return ConnectorResult(
        data=[
            {
                "scene_id": it.get("id"),
                "acquisition_time": it.get("properties", {}).get("datetime"),
                "cloud_cover_pct": it.get("properties", {}).get("eo:cloud_cover"),
                "bbox": it.get("bbox"),
                "reference_url": it.get("links", [{}])[0].get("href"),
            }
            for it in items
        ],
        provenance=Provenance(
            source=f"Copernicus Sentinel ({mission_key})",
            method=f"CDSE STAC search — {coll['use']}",
            observation_type=ObservationType.DIRECT_OBSERVATION,
            resolution=coll["resolution"],
            confidence=Confidence.HIGH,
            date=now_iso(),
            demo=False,
            attribution="Contains modified Copernicus Sentinel data, processed by Climactix",
        ),
    )


def _demo_scenes(mission_key: str, bbox: tuple[float, float, float, float]) -> list[dict]:
    """Clearly-labeled synthetic scene list — never presented as a live catalogue result."""
    cx = (bbox[0] + bbox[2]) / 2
    cy = (bbox[1] + bbox[3]) / 2
    return [
        {
            "scene_id": f"DEMO_{mission_key.upper()}_{i}",
            "acquisition_time": now_iso(),
            "cloud_cover_pct": 12.5,
            "bbox": [cx - 0.05, cy - 0.05, cx + 0.05, cy + 0.05],
            "reference_url": None,
        }
        for i in range(1, 3)
    ]
