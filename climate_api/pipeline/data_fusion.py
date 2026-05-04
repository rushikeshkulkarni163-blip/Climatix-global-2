"""
Data Fusion Layer — merges climate + economic data into a unified asset profile.

Priority order per data type:
  Climate baseline : Open-Meteo historical > NASA POWER > lat-based fallback
  Climate projection: Open-Meteo CMIP6 > physics-based fallback
  Country macro    : World Bank API > empty (graceful degradation)

All sources are fetched in parallel; results are blended by weighted average
where multiple authoritative sources agree, and flagged with their provenance.
"""
import asyncio
import logging
from typing import Tuple

from ..connectors import worldbank, open_meteo, nasa_power
from ..models.schemas import ClimateBaseline, ClimateProjection, CountryMacroData

logger = logging.getLogger(__name__)


async def fuse_asset_data(
    lat: float,
    lng: float,
    iso3: str,
    year: int,
) -> Tuple[ClimateBaseline, ClimateProjection, CountryMacroData]:
    """
    Parallel fetch + blend of all data sources for a single asset.

    Returns:
        baseline   — best-estimate historical climate at the asset location
        projection — CMIP6 climate projection for the requested year
        macro      — World Bank country economic indicators
    """
    om_hist_task  = open_meteo.get_historical_baseline(lat, lng)
    om_proj_task  = open_meteo.get_climate_projections(lat, lng, [year])
    nasa_task     = nasa_power.get_climate_baseline(lat, lng)
    wb_task       = worldbank.get_country_indicators(iso3)

    om_hist, om_proj, nasa_bl, wb_macro = await asyncio.gather(
        om_hist_task,
        om_proj_task,
        nasa_task,
        wb_task,
        return_exceptions=True,
    )

    baseline   = _resolve_baseline(om_hist, nasa_bl, lat, lng)
    projection = _resolve_projection(om_proj, year, lat)
    macro      = om_hist  # reuse var — reassign below
    macro      = wb_macro if isinstance(wb_macro, CountryMacroData) else CountryMacroData()

    return baseline, projection, macro


# ── Resolution helpers ─────────────────────────────────────────────────────

def _resolve_baseline(
    om_hist: object,
    nasa_bl: object,
    lat: float,
    lng: float,
) -> ClimateBaseline:
    has_om    = isinstance(om_hist, ClimateBaseline)
    has_nasa  = isinstance(nasa_bl, ClimateBaseline) and nasa_bl is not None

    if has_om and has_nasa:
        # Weighted blend: Open-Meteo gets 0.6 weight (longer record), NASA 0.4
        om: ClimateBaseline  = om_hist   # type: ignore
        na: ClimateBaseline  = nasa_bl   # type: ignore
        rh = na.relative_humidity_pct or om.relative_humidity_pct
        return ClimateBaseline(
            temp_mean_c=round(om.temp_mean_c * 0.6 + na.temp_mean_c * 0.4, 1),
            temp_max_c=round(om.temp_max_c   * 0.6 + na.temp_max_c   * 0.4, 1),
            precip_mm_year=round(om.precip_mm_year * 0.6 + na.precip_mm_year * 0.4, 0),
            wind_speed_ms=round(om.wind_speed_ms   * 0.6 + na.wind_speed_ms   * 0.4, 1),
            relative_humidity_pct=rh,
            source="blended-open-meteo+nasa-power",
        )

    if has_om:
        return om_hist  # type: ignore

    if has_nasa:
        return nasa_bl  # type: ignore

    logger.warning(f"All baseline sources failed for ({lat},{lng}). Using lat-fallback.")
    return open_meteo._fallback_baseline(lat, lng)


def _resolve_projection(
    om_proj: object,
    year: int,
    lat: float,
) -> ClimateProjection:
    if isinstance(om_proj, dict) and year in om_proj:
        return om_proj[year]  # type: ignore
    logger.debug(f"CMIP6 projection unavailable for year {year}. Using physics fallback.")
    return open_meteo._fallback_projection(year, lat)
