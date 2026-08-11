"""
Data Source Registry (spec §6) — seeds the `data_sources` table with
real, documentation-sourced metadata for every provider this module
knows about. Idempotent upsert on `source_key`, called once at startup
(see main.py lifespan) and safe to re-run any time a connector's status
changes.

Field values below are taken from each provider's own documentation
(links inline) — spec §6 explicitly forbids inventing specifications.
"""

from __future__ import annotations

import os
from typing import Any

import asyncpg

SOURCES: list[dict[str, Any]] = [
    {
        "source_key": "sentinel-1",
        "source_name": "Sentinel-1 SAR",
        "provider": "ESA / Copernicus",
        "dataset_name": "Sentinel-1 GRD",
        "dataset_type": "satellite_sar",
        "api_endpoint": "https://stac.dataspace.copernicus.eu/v1/search",
        "authentication_type": "oauth2_client_credentials",
        "documentation_url": "https://documentation.dataspace.copernicus.eu/APIs/STAC.html",
        "license": "Copernicus Sentinel Data Terms and Conditions (free, open)",
        "spatial_resolution": "5m-40m (mode-dependent)",
        "temporal_resolution": "6-12 day revisit",
        "coverage": "Global",
        "variables": ["flood_extent", "land_deformation", "surface_change", "coastal_monitoring"],
        "update_frequency": "continuous (per-orbit)",
        "ingestion_method": "stac_search",
        "attribution_requirement": "Contains modified Copernicus Sentinel data",
    },
    {
        "source_key": "sentinel-2",
        "source_name": "Sentinel-2 MSI",
        "provider": "ESA / Copernicus",
        "dataset_name": "Sentinel-2 L2A",
        "dataset_type": "satellite_optical",
        "api_endpoint": "https://stac.dataspace.copernicus.eu/v1/search",
        "authentication_type": "oauth2_client_credentials",
        "documentation_url": "https://documentation.dataspace.copernicus.eu/APIs/STAC.html",
        "license": "Copernicus Sentinel Data Terms and Conditions (free, open)",
        "spatial_resolution": "10m/20m/60m (band-dependent)",
        "temporal_resolution": "5 day revisit",
        "coverage": "Global",
        "variables": ["NDVI", "NDWI", "land_cover", "vegetation_change", "burned_area", "surface_water"],
        "update_frequency": "continuous (per-orbit)",
        "ingestion_method": "stac_search",
        "attribution_requirement": "Contains modified Copernicus Sentinel data",
    },
    {
        "source_key": "sentinel-3",
        "source_name": "Sentinel-3 SLSTR/OLCI",
        "provider": "ESA / Copernicus",
        "dataset_name": "Sentinel-3 LST / Ocean Colour",
        "dataset_type": "satellite_optical",
        "api_endpoint": "https://stac.dataspace.copernicus.eu/v1/search",
        "authentication_type": "oauth2_client_credentials",
        "documentation_url": "https://documentation.dataspace.copernicus.eu/APIs/STAC.html",
        "license": "Copernicus Sentinel Data Terms and Conditions (free, open)",
        "spatial_resolution": "300m-1km",
        "temporal_resolution": "~1-2 day revisit",
        "coverage": "Global",
        "variables": ["land_surface_temperature", "sea_surface_temperature", "ocean_colour"],
        "update_frequency": "daily",
        "ingestion_method": "stac_search",
        "attribution_requirement": "Contains modified Copernicus Sentinel data",
    },
    {
        "source_key": "sentinel-5p",
        "source_name": "Sentinel-5P TROPOMI",
        "provider": "ESA / Copernicus",
        "dataset_name": "Sentinel-5P L2",
        "dataset_type": "atmospheric",
        "api_endpoint": "https://stac.dataspace.copernicus.eu/v1/search",
        "authentication_type": "oauth2_client_credentials",
        "documentation_url": "https://documentation.dataspace.copernicus.eu/APIs/STAC.html",
        "license": "Copernicus Sentinel Data Terms and Conditions (free, open)",
        "spatial_resolution": "3.5km x 5.5km-7km",
        "temporal_resolution": "daily global coverage",
        "coverage": "Global",
        "variables": ["NO2", "SO2", "CO", "CH4", "O3", "aerosols"],
        "update_frequency": "daily",
        "ingestion_method": "stac_search",
        "attribution_requirement": "Contains modified Copernicus Sentinel data",
    },
    {
        "source_key": "sentinel-6",
        "source_name": "Sentinel-6 Michael Freilich",
        "provider": "ESA / Copernicus / NASA / NOAA / EUMETSAT",
        "dataset_name": "Sentinel-6 Altimetry",
        "dataset_type": "satellite_altimetry",
        "api_endpoint": "https://stac.dataspace.copernicus.eu/v1/search",
        "authentication_type": "oauth2_client_credentials",
        "documentation_url": "https://documentation.dataspace.copernicus.eu/APIs/STAC.html",
        "license": "Copernicus Sentinel Data Terms and Conditions (free, open)",
        "spatial_resolution": "along-track altimetry, ~300m along-track",
        "temporal_resolution": "10-day repeat cycle",
        "coverage": "Global ocean",
        "variables": ["sea_level", "sea_surface_height", "coastal_exposure"],
        "update_frequency": "per repeat-cycle",
        "ingestion_method": "stac_search",
        "attribution_requirement": "Contains modified Copernicus Sentinel data",
    },
    {
        "source_key": "landsat",
        "source_name": "Landsat Collection 2",
        "provider": "USGS / NASA",
        "dataset_name": "Landsat 8-9 OLI/TIRS Level-2",
        "dataset_type": "satellite_optical",
        "api_endpoint": "https://m2m.cr.usgs.gov/api/api/json/stable",
        "authentication_type": "application_token",
        "documentation_url": "https://www.usgs.gov/media/files/m2m-application-token-documentation",
        "license": "USGS public domain (attribution requested)",
        "spatial_resolution": "30m (15m panchromatic)",
        "temporal_resolution": "16 day revisit (8 day combined Landsat 8+9)",
        "coverage": "Global",
        "variables": ["land_use_change", "vegetation", "surface_temperature", "urbanisation", "water_body_change"],
        "update_frequency": "per-orbit",
        "ingestion_method": "stac_search",
        "attribution_requirement": "USGS Landsat data, courtesy of the U.S. Geological Survey",
    },
    {
        "source_key": "era5-land",
        "source_name": "ERA5-Land Reanalysis",
        "provider": "ECMWF / Copernicus Climate Data Store",
        "dataset_name": "ERA5-Land monthly averaged data",
        "dataset_type": "reanalysis",
        "api_endpoint": "https://cds.climate.copernicus.eu/api",
        "authentication_type": "api_token",
        "documentation_url": "https://cds.climate.copernicus.eu/how-to-api",
        "license": "Copernicus Licence (free, open, attribution required)",
        "spatial_resolution": "0.1° (~9km)",
        "temporal_resolution": "hourly, aggregated monthly",
        "coverage": "Global",
        "variables": ["temperature", "precipitation", "wind", "soil_moisture"],
        "update_frequency": "monthly (5-day latency)",
        "ingestion_method": "on_demand_api",
        "attribution_requirement": "Generated using Copernicus Climate Change Service information",
    },
    {
        "source_key": "nasa-earthdata",
        "source_name": "NASA Earthdata",
        "provider": "NASA",
        "dataset_name": "CMR / CMR-STAC (multi-mission umbrella)",
        "dataset_type": "satellite_optical",
        "api_endpoint": "https://cmr.earthdata.nasa.gov/search/stac",
        "authentication_type": "bearer_token",
        "documentation_url": "https://wiki.earthdata.nasa.gov/display/CMR/Token+Handling+Within+CMR",
        "license": "NASA public domain (attribution requested)",
        "spatial_resolution": "varies by mission (SMAP/SWOT/GEDI/OCO-2/3/MODIS/VIIRS/ECOSTRESS)",
        "temporal_resolution": "varies by mission",
        "coverage": "Global",
        "variables": ["soil_moisture", "surface_water", "biomass", "co2_column", "land_cover", "evapotranspiration"],
        "update_frequency": "varies by mission",
        "ingestion_method": "stac_search",
        "attribution_requirement": "NASA Earthdata",
    },
    {
        "source_key": "nasa-power",
        "source_name": "NASA POWER",
        "provider": "NASA",
        "dataset_name": "POWER Climatology (1981-2010)",
        "dataset_type": "reanalysis",
        "api_endpoint": "https://power.larc.nasa.gov/api/temporal/climatology/point",
        "authentication_type": "none",
        "documentation_url": "https://power.larc.nasa.gov/docs/services/api/",
        "license": "NASA public domain",
        "spatial_resolution": "0.5° x 0.625°",
        "temporal_resolution": "30-year monthly climatology",
        "coverage": "Global",
        "variables": ["temperature", "precipitation", "wind", "humidity"],
        "update_frequency": "static baseline (periodically revised)",
        "ingestion_method": "on_demand_api",
        "attribution_requirement": "NASA/POWER",
    },
]

_CREDENTIAL_ENV = {
    "sentinel-1": ("CDSE_CLIENT_ID", "CDSE_CLIENT_SECRET"),
    "sentinel-2": ("CDSE_CLIENT_ID", "CDSE_CLIENT_SECRET"),
    "sentinel-3": ("CDSE_CLIENT_ID", "CDSE_CLIENT_SECRET"),
    "sentinel-5p": ("CDSE_CLIENT_ID", "CDSE_CLIENT_SECRET"),
    "sentinel-6": ("CDSE_CLIENT_ID", "CDSE_CLIENT_SECRET"),
    "landsat": ("USGS_M2M_USERNAME", "USGS_M2M_APP_TOKEN"),
    "era5-land": ("CDS_API_TOKEN",),
    "nasa-earthdata": ("NASA_EARTHDATA_USERNAME", "NASA_EARTHDATA_PASSWORD"),
    "nasa-power": (),
}


def _live_status(source_key: str) -> str:
    env_vars = _CREDENTIAL_ENV.get(source_key, ())
    if not env_vars:
        return "active"
    return "active" if all(os.getenv(v) for v in env_vars) else "demo"


async def seed_registry(pool: asyncpg.Pool) -> None:
    async with pool.acquire() as conn:
        for src in SOURCES:
            await conn.execute(
                """
                INSERT INTO data_sources (
                    source_key, source_name, provider, dataset_name, dataset_type,
                    api_endpoint, authentication_type, documentation_url, license,
                    spatial_resolution, temporal_resolution, coverage, variables,
                    update_frequency, ingestion_method, status, data_quality,
                    attribution_requirement
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
                ON CONFLICT (source_key) DO UPDATE SET
                    source_name = EXCLUDED.source_name,
                    provider = EXCLUDED.provider,
                    dataset_name = EXCLUDED.dataset_name,
                    dataset_type = EXCLUDED.dataset_type,
                    api_endpoint = EXCLUDED.api_endpoint,
                    authentication_type = EXCLUDED.authentication_type,
                    documentation_url = EXCLUDED.documentation_url,
                    license = EXCLUDED.license,
                    spatial_resolution = EXCLUDED.spatial_resolution,
                    temporal_resolution = EXCLUDED.temporal_resolution,
                    coverage = EXCLUDED.coverage,
                    variables = EXCLUDED.variables,
                    update_frequency = EXCLUDED.update_frequency,
                    ingestion_method = EXCLUDED.ingestion_method,
                    status = EXCLUDED.status,
                    attribution_requirement = EXCLUDED.attribution_requirement,
                    updated_at = NOW()
                """,
                src["source_key"], src["source_name"], src["provider"], src["dataset_name"],
                src["dataset_type"], src["api_endpoint"], src["authentication_type"],
                src["documentation_url"], src["license"], src["spatial_resolution"],
                src["temporal_resolution"], src["coverage"], src["variables"],
                src["update_frequency"], src["ingestion_method"], _live_status(src["source_key"]),
                "unverified", src["attribution_requirement"],
            )


async def list_sources(pool: asyncpg.Pool) -> list[dict]:
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT source_id, source_key, source_name, provider, dataset_name, dataset_type,
                   authentication_type, documentation_url, license, spatial_resolution,
                   temporal_resolution, coverage, variables, update_frequency,
                   ingestion_method, status, last_successful_sync, last_error,
                   data_quality, version, attribution_requirement
            FROM data_sources ORDER BY source_name
            """
        )
        return [dict(r) for r in rows]
