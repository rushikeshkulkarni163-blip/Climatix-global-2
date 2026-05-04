"""
Copernicus Climate Data Store (CDS) API connector.

Setup (one-time):
  1. Register at https://cds.climate.copernicus.eu/
  2. Install: pip install cdsapi
  3. Create ~/.cdsapirc:
       url: https://cds.climate.copernicus.eu/api/v2
       key: YOUR-UID:YOUR-API-KEY

Provides:
  - ERA5 reanalysis (1940-present, 0.25° global)
  - CMIP6 projections via SSP scenarios (SSP1-1.9, SSP2-4.5, SSP5-8.5)
  - Sea level, wind, precipitation at sub-daily resolution
"""
import os
import logging
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

CDS_AVAILABLE = False
try:
    import cdsapi  # type: ignore
    CDS_AVAILABLE = True
except ImportError:
    logger.info("cdsapi not installed — install with: pip install cdsapi")

# NGFS scenario → CMIP6 SSP mapping
SCENARIO_TO_SSP = {
    "1.5": "ssp119",   # Net Zero 2050  → SSP1-1.9
    "2.0": "ssp245",   # Delayed Trans. → SSP2-4.5
    "3.0": "ssp585",   # Current Policy → SSP5-8.5
}

ERA5_VARIABLES = {
    "temperature":      "2m_temperature",
    "precipitation":    "total_precipitation",
    "wind_u":           "10m_u_component_of_wind",
    "wind_v":           "10m_v_component_of_wind",
    "sea_level_press":  "mean_sea_level_pressure",
    "heat_index":       "heat_index",
}


def cds_status() -> Dict[str, Any]:
    rc_path = os.path.expanduser("~/.cdsapirc")
    return {
        "available":  CDS_AVAILABLE,
        "configured": os.path.exists(rc_path),
        "setup_url":  "https://cds.climate.copernicus.eu/how-to-api",
        "note":       "Requires free registration at Copernicus Climate Data Store",
    }


async def get_era5_monthly(
    lat: float,
    lng: float,
    variable: str = "2m_temperature",
    year: int = 2023,
) -> Optional[Dict]:
    """ERA5 monthly reanalysis for a 2° bounding box around the point."""
    if not CDS_AVAILABLE:
        logger.warning("CDS not available. Install cdsapi and configure ~/.cdsapirc")
        return None

    try:
        c = cdsapi.Client(quiet=True)
        area = [lat + 1, lng - 1, lat - 1, lng + 1]  # N/W/S/E

        result = c.retrieve(
            "reanalysis-era5-single-levels-monthly-means",
            {
                "product_type": "monthly_averaged_reanalysis",
                "variable":     variable,
                "year":         str(year),
                "month":        [f"{m:02d}" for m in range(1, 13)],
                "time":         "00:00",
                "area":         area,
                "format":       "netcdf",
            },
        )
        return {
            "variable": variable,
            "year":     year,
            "lat":      lat,
            "lng":      lng,
            "result":   result,
        }
    except Exception as e:
        logger.error(f"ERA5 error: {e}")
        return None


async def get_cmip6_projections(
    lat: float,
    lng: float,
    ngfs_scenario: str = "2.0",
    start_year: int = 2024,
    end_year: int = 2100,
) -> Optional[Dict]:
    """
    CMIP6 future climate projections from Copernicus.
    Maps NGFS scenarios to SSP equivalents.
    """
    if not CDS_AVAILABLE:
        return None

    ssp = SCENARIO_TO_SSP.get(ngfs_scenario, "ssp245")

    try:
        c = cdsapi.Client(quiet=True)
        result = c.retrieve(
            "projections-cmip6",
            {
                "temporal_resolution": "monthly",
                "experiment":          ssp,
                "level":               "single_levels",
                "variable": [
                    "near_surface_air_temperature",
                    "precipitation_flux",
                    "near_surface_wind_speed",
                ],
                "model":  "mri_esm2_0",
                "date":   f"{start_year}-01-01/{end_year}-12-31",
                "area":   [lat + 2, lng - 2, lat - 2, lng + 2],
                "format": "zip",
            },
        )
        return {
            "scenario":    ngfs_scenario,
            "ssp":         ssp,
            "lat":         lat,
            "lng":         lng,
            "start_year":  start_year,
            "end_year":    end_year,
            "result":      result,
        }
    except Exception as e:
        logger.error(f"CMIP6 error: {e}")
        return None


async def get_era5_extreme_indices(
    lat: float,
    lng: float,
    year_range: tuple = (2000, 2023),
) -> Optional[Dict]:
    """
    Extreme climate indices from ERA5: heat-wave days, heavy precip events,
    strong wind days. Used to calibrate physical risk baselines.
    """
    if not CDS_AVAILABLE:
        return None

    try:
        c = cdsapi.Client(quiet=True)
        result = c.retrieve(
            "derived-era5-single-levels-daily-statistics",
            {
                "product_type": "reanalysis",
                "variable": [
                    "2m_temperature",
                    "total_precipitation",
                    "10m_wind_speed",
                ],
                "statistic":  "daily_maximum",
                "year":       [str(y) for y in range(year_range[0], year_range[1] + 1)],
                "month":      [f"{m:02d}" for m in range(1, 13)],
                "day":        [f"{d:02d}" for d in range(1, 32)],
                "area":       [lat + 0.5, lng - 0.5, lat - 0.5, lng + 0.5],
                "format":     "netcdf",
            },
        )
        return {"lat": lat, "lng": lng, "year_range": year_range, "result": result}
    except Exception as e:
        logger.error(f"ERA5 extreme indices error: {e}")
        return None
