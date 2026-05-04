"""
NASA POWER Climatology API connector.
Free, no API key. 30-year monthly climate averages (1981-2010 baseline).
https://power.larc.nasa.gov/docs/services/api/
"""
import httpx
import statistics
import logging
from typing import Optional, Dict

from ..models.schemas import ClimateBaseline

logger = logging.getLogger(__name__)

NASA_BASE = "https://power.larc.nasa.gov/api/temporal/climatology/point"

# Parameters: 2m temp, max temp, precipitation, wind speed, relative humidity, UV
NASA_PARAMS = "T2M,T2M_MAX,PRECTOTCORR,WS10M,RH2M"

_cache: Dict[str, ClimateBaseline] = {}


async def get_climate_baseline(lat: float, lng: float) -> Optional[ClimateBaseline]:
    """
    Returns 1981-2010 monthly climate averages for a point.
    Blends perfectly with Open-Meteo historical data.
    """
    key = f"nasa_{lat:.2f}_{lng:.2f}"
    if key in _cache:
        return _cache[key]

    params = {
        "parameters": NASA_PARAMS,
        "community":  "RE",
        "longitude":  lng,
        "latitude":   lat,
        "format":     "JSON",
        "header":     "true",
    }

    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(NASA_BASE, params=params, timeout=20.0)
            r.raise_for_status()
            props = r.json().get("properties", {}).get("parameter", {})

        def annual(param: str) -> Optional[float]:
            monthly = props.get(param, {})
            # "ANN" key = annual average; individual months are "JAN".."DEC"
            ann = monthly.get("ANN")
            if ann not in (None, -999.0):
                return float(ann)
            vals = [v for k, v in monthly.items() if k != "ANN" and v not in (None, -999.0)]
            return statistics.mean(vals) if vals else None

        t2m     = annual("T2M")
        t2m_max = annual("T2M_MAX")
        precip  = annual("PRECTOTCORR")   # mm/day
        wind    = annual("WS10M")
        rh      = annual("RH2M")

        baseline = ClimateBaseline(
            temp_mean_c=round(t2m, 1)          if t2m     is not None else 20.0,
            temp_max_c=round(t2m_max, 1)       if t2m_max is not None else 28.0,
            precip_mm_year=round(precip * 365) if precip  is not None else 800.0,
            wind_speed_ms=round(wind, 1)       if wind    is not None else 5.0,
            relative_humidity_pct=round(rh, 1) if rh     is not None else None,
            source="nasa-power-1981-2010",
        )
        _cache[key] = baseline
        return baseline

    except Exception as e:
        logger.warning(f"NASA POWER ({lat},{lng}): {e}")
        return None
