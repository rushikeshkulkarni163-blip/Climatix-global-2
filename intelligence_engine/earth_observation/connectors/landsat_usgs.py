"""
USGS Landsat Machine-to-Machine (M2M) API connector — Collection 2 scene
DISCOVERY (metadata + scene search, not bulk download — spec §3/§8).

Auth (verified against current docs, 2026): the classic username/password
`/login` endpoint was deprecated 2025-02-26. Auth is now an application
token against `/login-token`:
  1. Generate a token in your ERS profile (M2M Application Token).
  2. POST https://m2m.cr.usgs.gov/api/api/json/stable/login-token
     {"username": USGS_M2M_USERNAME, "token": USGS_M2M_APP_TOKEN}
  3. Use the returned X-Auth-Token header on subsequent scene-search calls.
Docs: https://www.usgs.gov/media/files/m2m-application-token-documentation

Used for: historical land-use change, vegetation, surface temperature,
urbanisation, water-body change, long-term environmental baseline (spec §3).
"""

from __future__ import annotations

import logging
import os
import time
from typing import Optional

import httpx

from ..types import Confidence, ConnectorResult, ObservationType, Provenance, now_iso, unavailable

logger = logging.getLogger(__name__)

M2M_BASE = "https://m2m.cr.usgs.gov/api/api/json/stable"
LOGIN_TOKEN_URL = f"{M2M_BASE}/login-token"
SEARCH_URL = f"{M2M_BASE}/scene-search"

# Landsat Collection 2 dataset names as registered in M2M
DATASETS = {
    "landsat-8-9": "landsat_ot_c2_l2",
    "landsat-4-5-7": "landsat_etm_c2_l2",
}

_token_cache: dict[str, tuple[str, float]] = {}
_TOKEN_TTL_SECONDS = 3600  # M2M tokens are valid ~2h; refresh conservatively


def usgs_status() -> dict:
    configured = bool(os.getenv("USGS_M2M_USERNAME") and os.getenv("USGS_M2M_APP_TOKEN"))
    return {
        "available": True,
        "configured": configured,
        "auth_type": "application_token",
        "login_url": LOGIN_TOKEN_URL,
        "setup_url": "https://ers.cr.usgs.gov/password/appgenerate",
        "note": "Uses the current login-token M2M flow, not the retired username/password /login endpoint.",
    }


async def _get_token() -> Optional[str]:
    username = os.getenv("USGS_M2M_USERNAME")
    app_token = os.getenv("USGS_M2M_APP_TOKEN")
    if not username or not app_token:
        return None

    cached = _token_cache.get("token")
    if cached and cached[1] > time.time() + 60:
        return cached[0]

    try:
        async with httpx.AsyncClient() as client:
            r = await client.post(
                LOGIN_TOKEN_URL,
                json={"username": username, "token": app_token},
                timeout=15.0,
            )
            r.raise_for_status()
            body = r.json()
            token = body.get("data")
            if not token:
                return None
            _token_cache["token"] = (token, time.time() + _TOKEN_TTL_SECONDS)
            return token
    except Exception as e:
        logger.warning(f"USGS M2M login-token failed: {e}")
        return None


async def search_scenes(
    bbox: tuple[float, float, float, float],
    start_date: str,
    end_date: str,
    dataset_key: str = "landsat-8-9",
    max_cloud_cover: int = 30,
    limit: int = 10,
) -> ConnectorResult:
    """`bbox` = (min_lng, min_lat, max_lng, max_lat)."""
    dataset_name = DATASETS.get(dataset_key, DATASETS["landsat-8-9"])
    token = await _get_token()

    if token is None:
        return ConnectorResult(
            data=_demo_scenes(dataset_key, bbox),
            provenance=Provenance(
                source=f"USGS Landsat ({dataset_key})",
                method="M2M scene-search — historical land-use/vegetation/LST baseline",
                observation_type=ObservationType.DIRECT_OBSERVATION,
                resolution="30m (15m panchromatic)",
                confidence=Confidence.LOW,
                date=now_iso(),
                demo=True,
                attribution="USGS Landsat data, courtesy of the U.S. Geological Survey",
                limitations="USGS_M2M_USERNAME/USGS_M2M_APP_TOKEN not configured — demo scene list.",
            ),
        )

    try:
        async with httpx.AsyncClient() as client:
            r = await client.post(
                SEARCH_URL,
                json={
                    "datasetName": dataset_name,
                    "sceneFilter": {
                        "spatialFilter": {
                            "filterType": "mbr",
                            "lowerLeft": {"longitude": bbox[0], "latitude": bbox[1]},
                            "upperRight": {"longitude": bbox[2], "latitude": bbox[3]},
                        },
                        "acquisitionFilter": {"start": start_date, "end": end_date},
                        "cloudCoverFilter": {"min": 0, "max": max_cloud_cover},
                    },
                    "maxResults": limit,
                },
                headers={"X-Auth-Token": token},
                timeout=25.0,
            )
            r.raise_for_status()
            results = r.json().get("data", {}).get("results", [])
    except Exception as e:
        logger.warning(f"USGS M2M scene-search failed: {e}")
        return unavailable(f"USGS Landsat ({dataset_key})", str(e))

    return ConnectorResult(
        data=[
            {
                "scene_id": s.get("entityId"),
                "acquisition_time": s.get("temporalCoverage", {}).get("startDate"),
                "cloud_cover_pct": s.get("cloudCover"),
                "reference_url": s.get("browse", [{}])[0].get("browsePath") if s.get("browse") else None,
            }
            for s in results
        ],
        provenance=Provenance(
            source=f"USGS Landsat ({dataset_key})",
            method="M2M scene-search — historical land-use/vegetation/LST baseline",
            observation_type=ObservationType.DIRECT_OBSERVATION,
            resolution="30m (15m panchromatic)",
            confidence=Confidence.HIGH,
            date=now_iso(),
            demo=False,
            attribution="USGS Landsat data, courtesy of the U.S. Geological Survey",
        ),
    )


def _demo_scenes(dataset_key: str, bbox: tuple[float, float, float, float]) -> list[dict]:
    cx = (bbox[0] + bbox[2]) / 2
    cy = (bbox[1] + bbox[3]) / 2
    return [
        {
            "scene_id": f"DEMO_{dataset_key.upper()}_{i}",
            "acquisition_time": now_iso(),
            "cloud_cover_pct": 8.0,
            "reference_url": None,
        }
        for i in range(1, 3)
    ]
