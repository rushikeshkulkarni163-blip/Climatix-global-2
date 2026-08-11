"""
Earth Observation API Router — the internal abstraction layer (spec §9).

Everything outside `earth_observation/` — the Next.js frontend, the future
Terminal — talks to THIS router only, never to a satellite/climate provider
directly (spec §10). Every response carries source/date/method/resolution/
confidence (spec §16/§38); external failures are caught and degrade to the
spec's literal copy, never a raw provider error (spec §28).
"""

from __future__ import annotations

import os
import sys
import time
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import database
from earth_observation import registry
from earth_observation.cache import cache_get, cache_set, log_usage
from earth_observation.connectors import copernicus_cdse, landsat_usgs
from earth_observation.indicators import METHODOLOGIES, compute_indicator
from engines.physical_risk_engine import PhysicalRiskInput, PhysicalRiskScore, physical_risk_engine

router = APIRouter()

UNAVAILABLE_MESSAGE = "Earth observation data temporarily unavailable."


def _parse_location(location: str) -> tuple[float, float]:
    try:
        lat_str, lng_str = location.split(",")
        lat, lng = float(lat_str), float(lng_str)
        if not (-90 <= lat <= 90 and -180 <= lng <= 180):
            raise ValueError
        return lat, lng
    except Exception:
        raise HTTPException(status_code=400, detail="location must be 'lat,lng' with valid coordinates")


def _bbox_from_radius(lat: float, lng: float, radius_km: float) -> tuple[float, float, float, float]:
    deg = radius_km / 111.0
    return (lng - deg, lat - deg, lng + deg, lat + deg)


# ── Sources ─────────────────────────────────────────────────────────────────

@router.get("/sources", summary="Data Source Registry — every connected provider and its status")
async def get_sources():
    cached = cache_get("sources", "all")
    if cached is not None:
        return cached
    pool = await database.get_pool()
    sources = await registry.list_sources(pool)
    payload = {"count": len(sources), "sources": sources}
    cache_set("sources", "all", payload)
    return payload


# ── Datasets / catalogue search ──────────────────────────────────────────────

@router.get("/datasets", summary="Earth Observation dataset catalogue (metadata only, no raster storage)")
async def list_datasets(source_key: Optional[str] = Query(None), limit: int = Query(50, le=200)):
    pool = await database.get_pool()
    async with pool.acquire() as conn:
        if source_key:
            rows = await conn.fetch(
                """
                SELECT d.dataset_id, d.product_name, d.acquisition_time, d.cloud_cover_pct,
                       d.spatial_resolution, d.processing_level, d.reference_url, s.source_key
                FROM eo_datasets d JOIN data_sources s ON s.source_id = d.source_id
                WHERE s.source_key = $1 ORDER BY d.acquisition_time DESC LIMIT $2
                """,
                source_key, limit,
            )
        else:
            rows = await conn.fetch(
                """
                SELECT d.dataset_id, d.product_name, d.acquisition_time, d.cloud_cover_pct,
                       d.spatial_resolution, d.processing_level, d.reference_url, s.source_key
                FROM eo_datasets d JOIN data_sources s ON s.source_id = d.source_id
                ORDER BY d.acquisition_time DESC LIMIT $1
                """,
                limit,
            )
    return {"count": len(rows), "datasets": [dict(r) for r in rows]}


@router.get("/search", summary="Spatial/temporal/type-filtered dataset search")
async def search_datasets(
    lat: float = Query(...), lng: float = Query(...),
    radius_km: float = Query(10.0, gt=0, le=100),
    start_date: str = Query("2025-01-01"), end_date: str = Query("2026-01-01"),
    mission: str = Query("sentinel-2", description="sentinel-1|sentinel-2|sentinel-3|sentinel-5p|sentinel-6|landsat"),
):
    bbox = _bbox_from_radius(lat, lng, radius_km)
    start = time.monotonic()
    if mission.startswith("sentinel"):
        result = await copernicus_cdse.search_scenes(mission, bbox, start_date, end_date)
    elif mission == "landsat":
        result = await landsat_usgs.search_scenes(bbox, start_date, end_date)
    else:
        raise HTTPException(status_code=400, detail=f"Unknown mission '{mission}'")

    pool = await database.get_pool()
    await log_usage(pool, mission.split("-")[0] if mission.startswith("sentinel") else mission,
                     "/earth-observation/search", 200 if result.ok else 502,
                     int((time.monotonic() - start) * 1000), False)

    if not result.ok:
        raise HTTPException(status_code=503, detail=UNAVAILABLE_MESSAGE)
    return result.as_dict()


# ── Imagery (STAC scene metadata, not pixels) ────────────────────────────────

@router.get("/imagery", summary="Scene metadata for a location (discovery only, no raster download)")
async def get_imagery(
    lat: float = Query(...), lng: float = Query(...),
    radius_km: float = Query(5.0, gt=0, le=50),
    mission: str = Query("sentinel-2"),
):
    return await search_datasets(lat=lat, lng=lng, radius_km=radius_km, mission=mission,
                                  start_date="2025-01-01", end_date="2026-01-01")


# ── Assets ────────────────────────────────────────────────────────────────

class AssetCreate(BaseModel):
    company_id: Optional[str] = None
    asset_name: str
    asset_type: str = "other"
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    country: Optional[str] = None
    region: Optional[str] = None
    industry: Optional[str] = None
    operational_status: str = "active"


@router.get("/assets", summary="List assets (optionally filtered by company)")
async def list_assets(company_id: Optional[str] = Query(None), limit: int = Query(100, le=500)):
    pool = await database.get_pool()
    async with pool.acquire() as conn:
        if company_id:
            rows = await conn.fetch(
                """SELECT asset_id, company_id, asset_name, asset_type, lat, lng, country, region,
                          industry, operational_status, date_added FROM eo_assets
                   WHERE company_id = $1 ORDER BY date_added DESC LIMIT $2""",
                company_id, limit,
            )
        else:
            rows = await conn.fetch(
                """SELECT asset_id, company_id, asset_name, asset_type, lat, lng, country, region,
                          industry, operational_status, date_added FROM eo_assets
                   ORDER BY date_added DESC LIMIT $1""",
                limit,
            )
    return {"count": len(rows), "assets": [dict(r) for r in rows]}


@router.post("/assets", summary="Register a new asset (factory, port, mine, film location, ...)")
async def create_asset(asset: AssetCreate):
    pool = await database.get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO eo_assets (company_id, asset_name, asset_type, lat, lng, country, region,
                                    industry, operational_status)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            RETURNING asset_id, company_id, asset_name, asset_type, lat, lng, country, region,
                      industry, operational_status, date_added
            """,
            asset.company_id, asset.asset_name, asset.asset_type, asset.lat, asset.lng,
            asset.country, asset.region, asset.industry, asset.operational_status,
        )
    return dict(row)


@router.get("/assets/{asset_id}", summary="Single asset detail")
async def get_asset(asset_id: str):
    pool = await database.get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM eo_assets WHERE asset_id = $1", asset_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Asset not found")
    return dict(row)


# ── Time-series ─────────────────────────────────────────────────────────────

@router.get("/time-series", summary="Historical indicator time-series for an asset")
async def get_time_series(
    asset_id: str = Query(...),
    indicator_name: str = Query(...),
    limit: int = Query(200, le=2000),
):
    pool = await database.get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT time, value, unit, source, confidence, is_demo FROM eo_time_series
               WHERE asset_id = $1 AND indicator_name = $2 ORDER BY time DESC LIMIT $3""",
            asset_id, indicator_name, limit,
        )
    if not rows:
        # Spec §14: never manufacture historical values — say so plainly.
        return {"asset_id": asset_id, "indicator_name": indicator_name, "status": "DATA NOT AVAILABLE",
                "points": []}
    return {"asset_id": asset_id, "indicator_name": indicator_name, "status": "ok",
             "points": [dict(r) for r in rows]}


# ── Environmental indicators (buffer analysis, spec §13) ────────────────────

@router.get("/environmental-indicators", summary="NDVI/NDWI/LST for an asset or a lat/lng + buffer radius")
async def get_environmental_indicators(
    asset_id: Optional[str] = Query(None),
    lat: Optional[float] = Query(None), lng: Optional[float] = Query(None),
    radius_km: float = Query(5.0, description="Buffer radius: 1, 5, 10, 25 or 50 km"),
):
    if radius_km not in (1, 5, 10, 25, 50):
        raise HTTPException(status_code=400, detail="radius_km must be one of 1, 5, 10, 25, 50")

    pool = await database.get_pool()
    if asset_id:
        async with pool.acquire() as conn:
            asset = await conn.fetchrow("SELECT lat, lng FROM eo_assets WHERE asset_id = $1", asset_id)
        if asset is None:
            raise HTTPException(status_code=404, detail="Asset not found")
        lat, lng = float(asset["lat"]), float(asset["lng"])
    elif lat is None or lng is None:
        raise HTTPException(status_code=400, detail="Provide either asset_id or lat+lng")

    cache_key = f"{lat:.3f}_{lng:.3f}_{radius_km}"
    cached = cache_get("environmental-indicators", cache_key)
    if cached is not None:
        return cached

    start = time.monotonic()
    results = {}
    for name in METHODOLOGIES:
        r = await compute_indicator(name, lat, lng, radius_km)
        results[name] = r.as_dict()

    payload = {
        "lat": lat, "lng": lng, "radius_km": radius_km,
        "indicators": results,
        "note": "Satellite-derived observations are contextual evidence and cannot by themselves "
                "attribute environmental performance to a company (spec §16).",
    }
    cache_set("environmental-indicators", cache_key, payload)
    await log_usage(pool, "sentinel-2", "/earth-observation/environmental-indicators", 200,
                     int((time.monotonic() - start) * 1000), False)
    return payload


# ── Location-based risk wrappers (reuse physical_risk_engine, no duplicate scoring) ──

async def _physical_risk(lat: float, lng: float) -> PhysicalRiskScore:
    inp = PhysicalRiskInput(lat=lat, lng=lng)
    return await physical_risk_engine.compute(inp)


@router.get("/climate-risk/{location}", summary="Overall physical climate risk for 'lat,lng'")
async def climate_risk(location: str):
    lat, lng = _parse_location(location)
    result = await _physical_risk(lat, lng)
    return {"lat": lat, "lng": lng, "overall_risk": result.overall, "risk_rating": result.risk_rating,
            "confidence": result.confidence, "methodology": result.methodology}


@router.get("/water-risk/{location}", summary="Water stress risk for 'lat,lng'")
async def water_risk(location: str):
    lat, lng = _parse_location(location)
    result = await _physical_risk(lat, lng)
    return {"lat": lat, "lng": lng, "water_stress": result.water_stress, "methodology": result.methodology}


@router.get("/flood-risk/{location}", summary="Flood risk for 'lat,lng'")
async def flood_risk(location: str):
    lat, lng = _parse_location(location)
    result = await _physical_risk(lat, lng)
    return {"lat": lat, "lng": lng, "flood_risk": result.flood_risk, "methodology": result.methodology}


@router.get("/heat-risk/{location}", summary="Heat stress risk for 'lat,lng'")
async def heat_risk(location: str):
    lat, lng = _parse_location(location)
    result = await _physical_risk(lat, lng)
    return {"lat": lat, "lng": lng, "heat_stress_acute": result.heat_stress_acute,
            "heat_stress_chronic": result.heat_stress_chronic, "methodology": result.methodology}


@router.get("/nature-risk/{location}", summary="Vegetation/nature exposure for 'lat,lng' (NDVI-derived)")
async def nature_risk(location: str):
    lat, lng = _parse_location(location)
    ndvi = await compute_indicator("NDVI", lat, lng)
    return {"lat": lat, "lng": lng, "ndvi": ndvi.as_dict()}


@router.get("/air-quality/{location}", summary="Air quality exposure for 'lat,lng'")
async def air_quality(location: str):
    lat, lng = _parse_location(location)
    # Phase 1: Sentinel-5P is registered but pollutant indicators aren't computed
    # yet (only NDVI/NDWI/LST are, per plan scope) — say so honestly rather than
    # fabricate a value (spec §14/§38).
    return {
        "lat": lat, "lng": lng, "status": "DATA NOT AVAILABLE",
        "note": "Sentinel-5P (NO2/SO2/CO/CH4/O3) is registered in the Data Source Registry but "
                "pollutant indicator computation is scheduled for Phase 2.",
    }


@router.get("/land-use-change/{location}", summary="Land-use change for 'lat,lng'")
async def land_use_change(location: str):
    lat, lng = _parse_location(location)
    # Requires a multi-date time-series comparison, which needs eo_time_series
    # history this deployment hasn't accumulated yet — never fabricate a trend.
    return {
        "lat": lat, "lng": lng, "status": "DATA NOT AVAILABLE",
        "note": "Land-use change requires a multi-date NDVI/Landsat time-series baseline that has not "
                "yet been accumulated for this location.",
    }


# ── Composite profiles ───────────────────────────────────────────────────────

@router.get("/asset-climate-profile/{asset_id}", summary="Full climate profile for one asset")
async def asset_climate_profile(asset_id: str):
    pool = await database.get_pool()
    async with pool.acquire() as conn:
        asset = await conn.fetchrow("SELECT * FROM eo_assets WHERE asset_id = $1", asset_id)
    if asset is None:
        raise HTTPException(status_code=404, detail="Asset not found")

    lat, lng = float(asset["lat"]), float(asset["lng"])
    risk = await _physical_risk(lat, lng)
    indicators = await get_environmental_indicators(asset_id=asset_id, radius_km=5)

    return {
        "asset": dict(asset),
        "physical_risk": {
            "overall": risk.overall, "risk_rating": risk.risk_rating,
            "flood_risk": risk.flood_risk, "heat_stress_acute": risk.heat_stress_acute,
            "water_stress": risk.water_stress, "confidence": risk.confidence,
        },
        "environmental_indicators": indicators["indicators"],
    }


@router.get("/company-climate-profile/{company_id}", summary="Aggregated climate profile across a company's assets")
async def company_climate_profile(company_id: str):
    pool = await database.get_pool()
    async with pool.acquire() as conn:
        assets = await conn.fetch("SELECT asset_id, asset_name, lat, lng, country FROM eo_assets WHERE company_id = $1",
                                   company_id)

    if not assets:
        return {"company_id": company_id, "asset_count": 0, "countries": [], "assets": []}

    profiles = []
    for a in assets:
        risk = await _physical_risk(float(a["lat"]), float(a["lng"]))
        profiles.append({
            "asset_id": str(a["asset_id"]), "asset_name": a["asset_name"], "country": a["country"],
            "overall_risk": risk.overall, "risk_rating": risk.risk_rating,
        })

    countries = sorted({p["country"] for p in profiles if p["country"]})
    avg_risk = round(sum(p["overall_risk"] for p in profiles) / len(profiles), 1)

    return {
        "company_id": company_id, "asset_count": len(profiles), "countries": countries,
        "average_physical_risk": avg_risk, "assets": profiles,
    }
