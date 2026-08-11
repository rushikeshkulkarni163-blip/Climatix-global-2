"""
NASA Earthdata connector — Phase 1 scope per spec §4: register the source
and wire the auth flow / CMR-STAC discovery only. Do NOT integrate every
dataset immediately (SMAP, SWOT, GEDI, OCO-2/3, MODIS, VIIRS, ECOSTRESS —
these get individually enabled in later phases via the same registry
pattern, no rewrite needed).

Auth (verified against current docs, 2026): NASA Earthdata Login (EDL)
bearer token.
  1. Create an account at https://urs.earthdata.nasa.gov/
  2. Mint a token: POST https://urs.earthdata.nasa.gov/api/users/tokens
     with HTTP Basic auth (base64 "username:password").
  3. Use "Authorization: Bearer <token>" on CMR/CMR-STAC requests.
Docs: https://wiki.earthdata.nasa.gov/display/CMR/Token+Handling+Within+CMR

CMR-STAC search: https://cmr.earthdata.nasa.gov/search/stac/
"""

from __future__ import annotations

import base64
import logging
import os
from typing import Optional

import httpx

from ..types import Confidence, ConnectorResult, ObservationType, Provenance, now_iso, unavailable

logger = logging.getLogger(__name__)

EDL_TOKEN_URL = "https://urs.earthdata.nasa.gov/api/users/tokens"
CMR_STAC_URL = "https://cmr.earthdata.nasa.gov/search/stac"

# Datasets this connector is EXTENSIBLE to (spec §4) — not built this phase.
# Each entry is what the registry needs to add live support later without
# a schema or router rewrite: just a new function reading the same token.
PLANNED_DATASETS = {
    "SMAP": "Soil moisture",
    "SWOT": "Surface water and ocean topography",
    "GEDI": "Vegetation structure / biomass (lidar)",
    "OCO-2": "Atmospheric CO2 column",
    "OCO-3": "Atmospheric CO2 column (ISS)",
    "MODIS": "Land cover, vegetation indices, LST, fire",
    "VIIRS": "Nighttime lights, land cover, fire, vegetation",
    "ECOSTRESS": "Evapotranspiration / plant water stress",
}


def earthdata_status() -> dict:
    configured = bool(os.getenv("NASA_EARTHDATA_USERNAME") and os.getenv("NASA_EARTHDATA_PASSWORD"))
    return {
        "available": True,
        "configured": configured,
        "auth_type": "bearer_token",
        "token_url": EDL_TOKEN_URL,
        "setup_url": "https://urs.earthdata.nasa.gov/users/new",
        "note": "Phase 1: auth + CMR-STAC discovery wired. Dataset-specific pulls (SMAP/MODIS/...) are Phase 2.",
        "planned_datasets": PLANNED_DATASETS,
    }


async def _mint_token() -> Optional[str]:
    username = os.getenv("NASA_EARTHDATA_USERNAME")
    password = os.getenv("NASA_EARTHDATA_PASSWORD")
    if not username or not password:
        return None

    basic = base64.b64encode(f"{username}:{password}".encode()).decode()
    try:
        async with httpx.AsyncClient() as client:
            r = await client.post(
                EDL_TOKEN_URL,
                headers={"Authorization": f"Basic {basic}"},
                timeout=15.0,
            )
            r.raise_for_status()
            tokens = r.json()
            if isinstance(tokens, list) and tokens:
                return tokens[0].get("access_token")
    except Exception as e:
        logger.warning(f"NASA EDL token mint failed: {e}")
    return None


async def search_collections(keyword: str = "") -> ConnectorResult:
    """CMR-STAC provider/collection discovery — proves the auth flow works end to end."""
    token = await _mint_token()

    if token is None:
        return ConnectorResult(
            data={"providers": list(PLANNED_DATASETS.keys())},
            provenance=Provenance(
                source="NASA Earthdata (CMR-STAC)",
                method="CMR-STAC collection discovery",
                observation_type=ObservationType.DIRECT_OBSERVATION,
                resolution="varies by dataset",
                confidence=Confidence.LOW,
                date=now_iso(),
                demo=True,
                limitations="NASA_EARTHDATA_USERNAME/PASSWORD not configured — showing planned dataset registry only.",
            ),
        )

    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(
                f"{CMR_STAC_URL}/",
                headers={"Authorization": f"Bearer {token}"},
                timeout=15.0,
            )
            r.raise_for_status()
            data = r.json()
    except Exception as e:
        logger.warning(f"CMR-STAC discovery failed: {e}")
        return unavailable("NASA Earthdata (CMR-STAC)", str(e))

    return ConnectorResult(
        data=data,
        provenance=Provenance(
            source="NASA Earthdata (CMR-STAC)",
            method="CMR-STAC collection discovery",
            observation_type=ObservationType.DIRECT_OBSERVATION,
            resolution="varies by dataset",
            confidence=Confidence.HIGH,
            date=now_iso(),
            demo=False,
        ),
    )
