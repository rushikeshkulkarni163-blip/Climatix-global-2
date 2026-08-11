"""
NASA POWER Climatology API connector. Free, no API key — 1981-2010
30-year monthly climate averages. https://power.larc.nasa.gov/docs/services/api/

Self-contained here (not imported from climate_api/, which is a separate
deployable service/container and can't be cross-imported at runtime) —
same provider and logic as climate_api/connectors/nasa_power.py, wired
into the Earth Observation registry as a CLIMATOLOGY source.
"""

from __future__ import annotations

import logging
import statistics
from typing import Dict, Optional

import httpx

from ..types import Confidence, ConnectorResult, ObservationType, Provenance, now_iso, unavailable

logger = logging.getLogger(__name__)

NASA_POWER_BASE = "https://power.larc.nasa.gov/api/temporal/climatology/point"
NASA_POWER_PARAMS = "T2M,T2M_MAX,PRECTOTCORR,WS10M,RH2M"

_cache: Dict[str, ConnectorResult] = {}


def nasa_power_status() -> dict:
    return {
        "available": True,
        "configured": True,
        "auth_type": "none",
        "note": "Free public API, no credentials required.",
    }


async def get_climate_baseline(lat: float, lng: float) -> ConnectorResult:
    key = f"{lat:.2f}_{lng:.2f}"
    if key in _cache:
        return _cache[key]

    params = {
        "parameters": NASA_POWER_PARAMS,
        "community": "RE",
        "longitude": lng,
        "latitude": lat,
        "format": "JSON",
        "header": "true",
    }

    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(NASA_POWER_BASE, params=params, timeout=20.0)
            r.raise_for_status()
            props = r.json().get("properties", {}).get("parameter", {})

        def annual(param: str) -> Optional[float]:
            monthly = props.get(param, {})
            ann = monthly.get("ANN")
            if ann not in (None, -999.0):
                return float(ann)
            vals = [v for k, v in monthly.items() if k != "ANN" and v not in (None, -999.0)]
            return statistics.mean(vals) if vals else None

        result = ConnectorResult(
            data={
                "temp_mean_c": round(annual("T2M"), 1) if annual("T2M") is not None else None,
                "temp_max_c": round(annual("T2M_MAX"), 1) if annual("T2M_MAX") is not None else None,
                "precip_mm_year": round(annual("PRECTOTCORR") * 365, 0) if annual("PRECTOTCORR") is not None else None,
                "wind_speed_ms": round(annual("WS10M"), 1) if annual("WS10M") is not None else None,
                "relative_humidity_pct": round(annual("RH2M"), 1) if annual("RH2M") is not None else None,
            },
            provenance=Provenance(
                source="NASA POWER",
                method="30-year climatology (1981-2010) point query",
                observation_type=ObservationType.REANALYSIS,
                resolution="0.5° x 0.625°",
                confidence=Confidence.HIGH,
                date=now_iso(),
                demo=False,
                attribution="NASA/POWER (Prediction Of Worldwide Energy Resources)",
            ),
        )
        _cache[key] = result
        return result

    except Exception as e:
        logger.warning(f"NASA POWER ({lat},{lng}): {e}")
        return unavailable("NASA POWER", str(e))
