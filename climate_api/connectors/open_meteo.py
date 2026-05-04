"""
Open-Meteo Climate API connector — CMIP6 projections + historical archive.
Free, no API key: https://open-meteo.com/en/docs/climate-api
"""
import httpx
import statistics
import logging
from typing import List, Dict, Optional

from ..models.schemas import ClimateBaseline, ClimateProjection

logger = logging.getLogger(__name__)

CLIMATE_API    = "https://climate-api.open-meteo.com/v1/climate"
HISTORICAL_API = "https://archive-api.open-meteo.com/v1/archive"

# High-resolution CMIP6 model (25 km global)
CMIP6_MODEL = "MRI_AGCM3_2_S"

_cache: Dict[str, object] = {}


# ── Historical baseline ────────────────────────────────────────────────────

async def get_historical_baseline(lat: float, lng: float) -> ClimateBaseline:
    key = f"hist_{lat:.2f}_{lng:.2f}"
    if key in _cache:
        return _cache[key]  # type: ignore

    params = {
        "latitude":  lat,
        "longitude": lng,
        "start_date": "2000-01-01",
        "end_date":   "2023-12-31",
        "daily": ",".join([
            "temperature_2m_max",
            "temperature_2m_min",
            "precipitation_sum",
            "windspeed_10m_max",
        ]),
        "models": "best_match",
    }

    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(HISTORICAL_API, params=params, timeout=30.0)
            r.raise_for_status()
            daily = r.json().get("daily", {})

        t_max  = [v for v in daily.get("temperature_2m_max", [])  if v is not None]
        t_min  = [v for v in daily.get("temperature_2m_min",  []) if v is not None]
        precip = [v for v in daily.get("precipitation_sum",   []) if v is not None]
        wind   = [v for v in daily.get("windspeed_10m_max",   []) if v is not None]

        years_sampled = max(1, len(t_max) / 365)

        baseline = ClimateBaseline(
            temp_mean_c=round(
                statistics.mean([(a + b) / 2 for a, b in zip(t_max, t_min)]) if t_max else 20.0, 1
            ),
            temp_max_c=round(statistics.mean(sorted(t_max)[-365:]) if t_max else 30.0, 1),
            precip_mm_year=round(sum(precip) / years_sampled if precip else 800.0, 0),
            wind_speed_ms=round(statistics.mean(wind) if wind else 5.0, 1),
            source="open-meteo-historical",
        )
        _cache[key] = baseline
        return baseline

    except Exception as e:
        logger.warning(f"Open-Meteo historical ({lat},{lng}): {e}")
        return _fallback_baseline(lat, lng)


# ── CMIP6 projections ──────────────────────────────────────────────────────

async def get_climate_projections(
    lat: float,
    lng: float,
    target_years: Optional[List[int]] = None,
) -> Dict[int, ClimateProjection]:
    if target_years is None:
        target_years = [2024, 2030, 2040, 2050, 2060, 2075, 2100]

    key = f"proj_{lat:.2f}_{lng:.2f}"
    if key in _cache:
        return _cache[key]  # type: ignore

    # Fetch 2024-2060 (CMIP6 model available range)
    params = {
        "latitude":   lat,
        "longitude":  lng,
        "start_date": "2024-01-01",
        "end_date":   "2060-12-31",
        "models":     CMIP6_MODEL,
        "daily": ",".join([
            "temperature_2m_max",
            "temperature_2m_min",
            "precipitation_sum",
            "windspeed_10m_max",
        ]),
    }

    projections: Dict[int, ClimateProjection] = {}

    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(CLIMATE_API, params=params, timeout=40.0)
            r.raise_for_status()
            daily = r.json().get("daily", {})

        times  = daily.get("time", [])
        t_max  = daily.get("temperature_2m_max", [])
        t_min  = daily.get("temperature_2m_min", [])
        precip = daily.get("precipitation_sum", [])

        # Aggregate to annual stats
        annual: Dict[int, Dict] = {}
        for i, ts in enumerate(times):
            yr = int(ts[:4])
            if yr not in annual:
                annual[yr] = {"t_max": [], "t_min": [], "precip": [],
                              "extreme_heat": 0, "extreme_precip": 0}
            if i < len(t_max) and t_max[i] is not None:
                annual[yr]["t_max"].append(t_max[i])
                if t_max[i] > 35:
                    annual[yr]["extreme_heat"] += 1
            if i < len(t_min) and t_min[i] is not None:
                annual[yr]["t_min"].append(t_min[i])
            if i < len(precip) and precip[i] is not None:
                annual[yr]["precip"].append(precip[i])
                if precip[i] > 50:
                    annual[yr]["extreme_precip"] += 1

        # Build 2024-baseline from first 3 available years
        base_yrs = sorted(y for y in annual if y <= 2027)[:3]
        baseline_t = statistics.mean(
            statistics.mean(annual[y]["t_max"]) for y in base_yrs if annual[y]["t_max"]
        ) if base_yrs else _lat_mean_temp(lat)
        baseline_p = statistics.mean(
            sum(annual[y]["precip"]) for y in base_yrs if annual[y]["precip"]
        ) if base_yrs else 800.0

        for target_yr in target_years:
            nearest = min(annual.keys(), key=lambda y: abs(y - target_yr), default=None)
            if nearest is None:
                projections[target_yr] = _fallback_projection(target_yr, lat)
                continue
            yd = annual[nearest]
            t_mean = statistics.mean(yd["t_max"]) if yd["t_max"] else baseline_t
            p_tot  = sum(yd["precip"])             if yd["precip"] else baseline_p
            projections[target_yr] = ClimateProjection(
                year=target_yr,
                temp_anomaly_c=round(t_mean - baseline_t, 2),
                precip_change_pct=round((p_tot - baseline_p) / max(baseline_p, 1) * 100, 1),
                extreme_heat_days=yd["extreme_heat"],
                extreme_precip_events=yd["extreme_precip"],
                source="open-meteo-cmip6",
            )

        _cache[key] = projections
        return projections

    except Exception as e:
        logger.warning(f"Open-Meteo CMIP6 ({lat},{lng}): {e}")
        return {yr: _fallback_projection(yr, lat) for yr in target_years}


# ── Fallbacks ──────────────────────────────────────────────────────────────

def _lat_mean_temp(lat: float) -> float:
    a = abs(lat)
    if a < 10:  return 28.0
    if a < 25:  return 24.0
    if a < 40:  return 18.0
    if a < 60:  return 10.0
    return 2.0


def _fallback_baseline(lat: float, lng: float) -> ClimateBaseline:
    a = abs(lat)
    if a < 10:
        return ClimateBaseline(temp_mean_c=27.0, temp_max_c=33.0, precip_mm_year=2200,
                               wind_speed_ms=3.5, source="fallback-lat")
    if a < 25:
        return ClimateBaseline(temp_mean_c=24.0, temp_max_c=35.0, precip_mm_year=900,
                               wind_speed_ms=5.0, source="fallback-lat")
    if a < 40:
        return ClimateBaseline(temp_mean_c=18.0, temp_max_c=30.0, precip_mm_year=650,
                               wind_speed_ms=5.5, source="fallback-lat")
    if a < 60:
        return ClimateBaseline(temp_mean_c=10.0, temp_max_c=20.0, precip_mm_year=700,
                               wind_speed_ms=7.0, source="fallback-lat")
    return ClimateBaseline(temp_mean_c=0.0, temp_max_c=8.0, precip_mm_year=350,
                           wind_speed_ms=8.5, source="fallback-lat")


def _fallback_projection(year: int, lat: float) -> ClimateProjection:
    # Physics-based linear approximation: ~0.028°C/year, amplified at high latitudes
    lat_factor = 1.0 + abs(lat) / 90 * 0.6
    delta = (year - 2024) * 0.028 * lat_factor
    # Subtropical drying, tropical wetting
    precip_chg = -delta * 4 if 20 < abs(lat) < 45 else delta * 2.5
    return ClimateProjection(
        year=year,
        temp_anomaly_c=round(delta, 2),
        precip_change_pct=round(precip_chg, 1),
        extreme_heat_days=max(0, int(delta * 9)),
        extreme_precip_events=max(0, int(delta * 3)),
        source="fallback-physics",
    )
