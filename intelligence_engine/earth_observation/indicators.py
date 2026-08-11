"""
Environmental Indicator engine — Phase 1 scope: NDVI, NDWI, Land Surface
Temperature only (spec §11). Each indicator documents formula, input
dataset, resolution, temporal aggregation, assumptions, and limitations —
scientific methodologies only, nothing invented (spec §11 hard rule).

Phase 1 does NOT do live pixel math: that needs downloaded Sentinel-2/
Landsat band rasters and a rasterio band-math pipeline, which requires
real CDSE/USGS credentials this deployment doesn't have yet. What Phase 1
DOES do: confirm real scene availability via the CDSE/USGS connectors,
then return a demo-calibrated value (never presented as a live pixel
result — `is_demo=True`, `confidence=LOW`) until Phase 2 wires the pixel
pipeline in. This file is the seam where that upgrade plugs in — the
methodology metadata below does not change when the computation does.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from .connectors import copernicus_cdse
from .types import Confidence, ConnectorResult, ObservationType, Provenance, now_iso


@dataclass(frozen=True)
class IndicatorMethodology:
    name: str
    category: str
    formula: str
    input_dataset: str
    spatial_resolution: str
    temporal_aggregation: str
    assumptions: str
    limitations: str
    unit: str


NDVI = IndicatorMethodology(
    name="NDVI",
    category="LAND",
    formula="(NIR - Red) / (NIR + Red)",
    input_dataset="Sentinel-2 L2A bands B8 (NIR), B4 (Red)",
    spatial_resolution="10m",
    temporal_aggregation="per-scene, cloud-filtered composite recommended for trend analysis",
    assumptions="Cloud-free pixels; no atmospheric-correction residuals; single-date snapshot unless a "
    "multi-scene composite is requested.",
    limitations="Sensitive to cloud/shadow contamination and soil background in sparse vegetation; "
    "does not distinguish crop type or vegetation health cause.",
    unit="index (-1 to 1)",
)

NDWI = IndicatorMethodology(
    name="NDWI",
    category="WATER",
    formula="(Green - NIR) / (Green + NIR)  [McFeeters 1996]",
    input_dataset="Sentinel-2 L2A bands B3 (Green), B8 (NIR)",
    spatial_resolution="10m",
    temporal_aggregation="per-scene",
    assumptions="Open water surfaces; built-up areas can produce false positives with the McFeeters formulation.",
    limitations="Not a water-depth or water-quality measure — surface extent only.",
    unit="index (-1 to 1)",
)

LST = IndicatorMethodology(
    name="Land Surface Temperature",
    category="CLIMATE",
    formula="Mono-window algorithm on thermal-infrared brightness temperature (Landsat TIRS Band 10 / "
    "Sentinel-3 SLSTR), corrected for land-surface emissivity",
    input_dataset="Landsat Collection 2 Level-2 ST product, or Sentinel-3 SLSTR LST product",
    spatial_resolution="30m (Landsat) / 1km (Sentinel-3)",
    temporal_aggregation="instantaneous at satellite overpass time",
    assumptions="Clear-sky pixel; emissivity estimated from NDVI-based land-cover classification.",
    limitations="Surface temperature, not 2m air temperature — can differ substantially, especially over "
    "bare soil/urban surfaces in direct sun.",
    unit="°C",
)

METHODOLOGIES = {"NDVI": NDVI, "NDWI": NDWI, "LST": LST}


def _demo_value(name: str, lat: float) -> float:
    """
    Latitude/biome-plausible placeholder, same spirit as the existing
    lat-band fallbacks in climate_api/connectors/open_meteo.py. Never
    claimed as a real pixel measurement — see is_demo=True downstream.
    """
    a = abs(lat)
    if name == "NDVI":
        return 0.65 if a < 15 else 0.45 if a < 35 else 0.30 if a < 55 else 0.10
    if name == "NDWI":
        return -0.10
    if name == "LST":
        return 30.0 if a < 15 else 24.0 if a < 35 else 15.0 if a < 55 else 2.0
    return 0.0


async def compute_indicator(name: str, lat: float, lng: float, radius_km: float = 5.0) -> ConnectorResult:
    if name not in METHODOLOGIES:
        raise ValueError(f"Unknown indicator '{name}'. Supported in Phase 1: {list(METHODOLOGIES)}")

    m = METHODOLOGIES[name]

    # Confirm real scene availability where possible — even in demo mode
    # this proves the discovery connector is wired correctly.
    deg = radius_km / 111.0
    bbox = (lng - deg, lat - deg, lng + deg, lat + deg)
    scene_check = await copernicus_cdse.search_scenes(
        "sentinel-2", bbox, "2025-01-01", "2026-01-01", limit=1
    )

    value = _demo_value(name, lat)

    return ConnectorResult(
        data={
            "name": m.name,
            "value": round(value, 3),
            "unit": m.unit,
            "formula": m.formula,
            "input_dataset": m.input_dataset,
            "assumptions": m.assumptions,
            "nearby_scene_available": bool(scene_check.data),
        },
        provenance=Provenance(
            source=m.input_dataset,
            method=m.formula,
            observation_type=ObservationType.DERIVED_INDICATOR,
            resolution=m.spatial_resolution,
            confidence=Confidence.LOW,
            date=now_iso(),
            demo=True,
            limitations=m.limitations
            + " Phase 1: demo-calibrated value, not a live pixel computation — "
            "see indicators.py module docstring.",
        ),
    )
