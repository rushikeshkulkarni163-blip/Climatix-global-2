"""
Copernicus Climate Data Store (CDS) connector — ERA5 / ERA5-Land reanalysis.

This is a DIFFERENT system from copernicus_cdse.py (Sentinel imagery lives
on the Data Space Ecosystem; ERA5 reanalysis lives on the Climate Data
Store) — they have separate accounts, separate auth, separate SDKs. Do not
merge them.

Auth (verified against current docs, 2026 — the CDS-Beta migration
completed 2025-02-08 and the classic api/v2 + "UID:key" format is retired):
  ~/.cdsapirc:
    url: https://cds.climate.copernicus.eu/api
    key: <PERSONAL-ACCESS-TOKEN>
  Token from: https://cds.climate.copernicus.eu/profile
  Docs: https://cds.climate.copernicus.eu/how-to-api

The existing climate_api/connectors/copernicus.py predates this migration
and documents the retired `api/v2` + `UID:key` pattern — do not copy it;
this file is the corrected version for the Earth Observation module.
"""

from __future__ import annotations

import logging
import os
from typing import Optional

from ..types import Confidence, ConnectorResult, ObservationType, Provenance, now_iso

logger = logging.getLogger(__name__)

CDS_URL = "https://cds.climate.copernicus.eu/api"

CDS_AVAILABLE = False
try:
    import cdsapi  # type: ignore

    CDS_AVAILABLE = True
except ImportError:
    logger.info("cdsapi not installed — install with: pip install cdsapi")

ERA5_VARIABLES: dict[str, str] = {
    "temperature": "2m_temperature",
    "precipitation": "total_precipitation",
    "wind_u": "10m_u_component_of_wind",
    "wind_v": "10m_v_component_of_wind",
    "sea_level_pressure": "mean_sea_level_pressure",
    "soil_moisture": "volumetric_soil_water_layer_1",  # ERA5-Land
}


def cds_status() -> dict:
    token_configured = bool(os.getenv("CDS_API_TOKEN"))
    rc_path = os.path.expanduser("~/.cdsapirc")
    return {
        "available": CDS_AVAILABLE,
        "configured": token_configured or os.path.exists(rc_path),
        "url": CDS_URL,
        "auth_type": "api_token",
        "setup_url": "https://cds.climate.copernicus.eu/how-to-api",
        "note": "New CDS (post CDS-Beta migration) — single personal access token, not the retired UID:key format.",
    }


def _client() -> Optional["cdsapi.Client"]:
    if not CDS_AVAILABLE:
        return None
    token = os.getenv("CDS_API_TOKEN")
    if token:
        return cdsapi.Client(url=CDS_URL, key=token, quiet=True)
    if os.path.exists(os.path.expanduser("~/.cdsapirc")):
        return cdsapi.Client(quiet=True)
    return None


async def get_era5_reanalysis(
    lat: float,
    lng: float,
    variable: str = "temperature",
    year: int = 2023,
    dataset: str = "reanalysis-era5-land-monthly-means",
) -> ConnectorResult:
    """
    ERA5-Land monthly reanalysis for a small bounding box around a point.
    REANALYSIS, not a direct observation — must be labeled as such downstream.
    """
    era5_var = ERA5_VARIABLES.get(variable, variable)
    client = _client()

    if client is None:
        return ConnectorResult(
            data=_demo_reanalysis(variable, lat, lng, year),
            provenance=Provenance(
                source="Copernicus CDS (ERA5-Land)",
                method=f"reanalysis-era5-land-monthly-means / {era5_var}",
                observation_type=ObservationType.REANALYSIS,
                resolution="0.1° (~9km)",
                confidence=Confidence.LOW,
                date=now_iso(),
                demo=True,
                attribution="Generated using Copernicus Climate Change Service information",
                limitations="CDS_API_TOKEN not configured — demo value, not a live CDS retrieval.",
            ),
        )

    try:
        area = [lat + 0.5, lng - 0.5, lat - 0.5, lng + 0.5]  # N/W/S/E
        result = client.retrieve(
            dataset,
            {
                "product_type": "monthly_averaged_reanalysis",
                "variable": era5_var,
                "year": str(year),
                "month": [f"{m:02d}" for m in range(1, 13)],
                "time": "00:00",
                "area": area,
                "format": "netcdf",
            },
        )
        return ConnectorResult(
            data={"variable": era5_var, "year": year, "lat": lat, "lng": lng, "result_ref": str(result)},
            provenance=Provenance(
                source="Copernicus CDS (ERA5-Land)",
                method=f"reanalysis-era5-land-monthly-means / {era5_var}",
                observation_type=ObservationType.REANALYSIS,
                resolution="0.1° (~9km)",
                confidence=Confidence.HIGH,
                date=now_iso(),
                demo=False,
                attribution="Generated using Copernicus Climate Change Service information",
            ),
        )
    except Exception as e:
        logger.warning(f"ERA5 retrieval failed ({variable}, {lat},{lng}): {e}")
        return ConnectorResult(
            data=_demo_reanalysis(variable, lat, lng, year),
            provenance=Provenance(
                source="Copernicus CDS (ERA5-Land)",
                method=f"reanalysis-era5-land-monthly-means / {era5_var}",
                observation_type=ObservationType.REANALYSIS,
                resolution="0.1° (~9km)",
                confidence=Confidence.LOW,
                date=now_iso(),
                demo=True,
                limitations=f"Live CDS retrieval failed, showing demo value: {e}",
            ),
            error=str(e),
        )


def _demo_reanalysis(variable: str, lat: float, lng: float, year: int) -> dict:
    """Latitude-band climatology approximation — clearly a placeholder, not a CDS result."""
    a = abs(lat)
    demo_temp_c = 27.0 if a < 10 else 24.0 if a < 25 else 18.0 if a < 40 else 10.0 if a < 60 else 0.0
    values = {
        "temperature": demo_temp_c,
        "precipitation": 2.2 if a < 10 else 1.6,
        "soil_moisture": 0.28,
    }
    return {"variable": variable, "year": year, "lat": lat, "lng": lng, "value": values.get(variable, None)}
