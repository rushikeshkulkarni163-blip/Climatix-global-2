"""
Climactix Climate Risk API — FastAPI application
Start: uvicorn climate_api.main:app --host 0.0.0.0 --port 8000 --reload

Endpoints:
  GET  /api/health                     — service health + data source status
  POST /api/risk/score                 — full risk score for one asset
  GET  /api/risk/score                 — same via query params
  GET  /api/worldbank/{iso3}           — country macro indicators
  GET  /api/climate/baseline           — historical climate at a point
  GET  /api/climate/projections        — CMIP6 projections at a point
  POST /api/scenario/compare           — side-by-side NGFS scenario comparison
  POST /api/portfolio/analyze          — portfolio-level aggregate risk
  GET  /api/grid/heatmap               — GeoJSON heatmap grid for map overlay
  GET  /api/docs                       — Swagger UI
"""
import asyncio
import logging
from datetime import datetime
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .models.schemas import (
    AssetInput, AssetRiskResponse, PortfolioAnalysisRequest,
    PortfolioRiskSummary, PortfolioAsset, ScenarioId, Sector,
)
from .pipeline.data_fusion import fuse_asset_data
from .pipeline.risk_engine import (
    compute_physical_risk,
    compute_transition_risk,
    compute_composite_risk,
    get_carbon_price,
)
from .pipeline.financial_impact import compute_financial_impact
from .connectors.copernicus import cds_status
from .connectors import open_meteo

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Climactix Climate Risk API",
    description=(
        "Institutional-grade climate risk operating system. "
        "NGFS Phase IV scenarios · Copernicus CDS · World Bank · NASA POWER · Open-Meteo CMIP6."
    ),
    version="2.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],      # Restrict to your domain in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Health ─────────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {
        "status":    "operational",
        "version":   "2.0.0",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "data_sources": {
            "world_bank":    {"status": "active",  "key_required": False},
            "open_meteo":    {"status": "active",  "key_required": False},
            "nasa_power":    {"status": "active",  "key_required": False},
            "copernicus_cds": cds_status(),
        },
    }


# ── Asset risk score ───────────────────────────────────────────────────────

async def _score(asset: AssetInput) -> AssetRiskResponse:
    """Core scoring logic — called by both POST and GET endpoints."""
    try:
        # Parallel data fetch + fusion
        baseline, projection, macro = await fuse_asset_data(
            asset.lat, asset.lng, asset.iso3, asset.year
        )

        # Determine region for carbon-market readiness lookup
        region = _lat_lng_to_region(asset.lat, asset.lng)

        # Risk scores
        physical   = compute_physical_risk(baseline, projection, asset.lat, asset.lng, asset.year)
        transition = compute_transition_risk(asset.scenario, asset.year, asset.sector, macro, region)
        composite_score, risk_level = compute_composite_risk(physical, transition, asset.sector)

        # Financial impact
        financial = compute_financial_impact(
            physical=physical,
            transition=transition,
            sector=asset.sector,
            scenario=asset.scenario,
            year=asset.year,
            country_macro=macro,
            asset_value_usd=asset.asset_value_usd,
            annual_revenue_usd=asset.annual_revenue_usd,
        )

        sources = ["open-meteo-cmip6", "nasa-power", "world-bank-api", "ngfs-phase-iv"]
        if baseline.source.startswith("blended"):
            sources.append("blended-multi-source")

        return AssetRiskResponse(
            lat=asset.lat,
            lng=asset.lng,
            scenario=asset.scenario.value,
            year=asset.year,
            physical_risk=physical,
            transition_risk=transition,
            financial_impact=financial,
            composite_risk_score=composite_score,
            risk_level=risk_level,
            country_macro=macro,
            climate_baseline=baseline,
            projection=projection,
            data_freshness=datetime.utcnow().isoformat() + "Z",
            sources=sources,
        )
    except Exception as e:
        logger.error(f"Risk scoring error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/risk/score", response_model=AssetRiskResponse)
async def score_post(asset: AssetInput):
    """Full climate risk score for a single asset (POST body)."""
    return await _score(asset)


@app.get("/api/risk/score", response_model=AssetRiskResponse)
async def score_get(
    lat:      float      = Query(..., ge=-90,  le=90,  description="Latitude"),
    lng:      float      = Query(..., ge=-180, le=180, description="Longitude"),
    iso3:     str        = Query(..., min_length=2, max_length=3, description="ISO-3166-1 alpha-3"),
    sector:   Sector     = Query(Sector.ENERGY),
    scenario: ScenarioId = Query(ScenarioId.NET_ZERO),
    year:     int        = Query(2030, ge=2024, le=2100),
    revenue:  Optional[float] = Query(None, description="Annual revenue USD"),
    value:    Optional[float] = Query(None, description="Asset value USD"),
):
    """Full climate risk score via query parameters."""
    return await _score(AssetInput(
        lat=lat, lng=lng, iso3=iso3, sector=sector,
        scenario=scenario, year=year,
        annual_revenue_usd=revenue, asset_value_usd=value,
    ))


# ── Country data ───────────────────────────────────────────────────────────

@app.get("/api/worldbank/{iso3}")
async def country_data(iso3: str):
    """World Bank country macro + climate indicators."""
    from .connectors.worldbank import get_country_indicators
    try:
        return await get_country_indicators(iso3)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Climate data ───────────────────────────────────────────────────────────

@app.get("/api/climate/baseline")
async def climate_baseline(
    lat: float = Query(..., ge=-90,  le=90),
    lng: float = Query(..., ge=-180, le=180),
):
    """Historical climate baseline (blended Open-Meteo + NASA POWER)."""
    from .connectors.nasa_power import get_climate_baseline as nasa_bl
    om_task   = open_meteo.get_historical_baseline(lat, lng)
    nasa_task = nasa_bl(lat, lng)
    om, nasa  = await asyncio.gather(om_task, nasa_task, return_exceptions=True)
    return {
        "lat": lat, "lng": lng,
        "open_meteo": om   if not isinstance(om,   Exception) else None,
        "nasa_power": nasa if not isinstance(nasa, Exception) else None,
    }


@app.get("/api/climate/projections")
async def climate_projections(
    lat:   float = Query(..., ge=-90,  le=90),
    lng:   float = Query(..., ge=-180, le=180),
    years: str   = Query("2030,2040,2050,2060,2075,2100"),
):
    """CMIP6 climate projections via Open-Meteo."""
    year_list   = [int(y.strip()) for y in years.split(",")]
    projections = await open_meteo.get_climate_projections(lat, lng, year_list)
    return {
        "lat": lat, "lng": lng,
        "model":  "MRI_AGCM3_2_S (CMIP6 25 km)",
        "source": "open-meteo-climate-api",
        "projections": {str(yr): p.model_dump() for yr, p in projections.items()},
    }


# ── Scenario comparison ────────────────────────────────────────────────────

@app.get("/api/scenario/compare")
async def compare_scenarios(
    lat:    float  = Query(..., ge=-90,  le=90),
    lng:    float  = Query(..., ge=-180, le=180),
    iso3:   str    = Query(...),
    sector: Sector = Query(Sector.ENERGY),
    year:   int    = Query(2050, ge=2024, le=2100),
):
    """Side-by-side NGFS scenario comparison for a location."""
    tasks = [
        _score(AssetInput(lat=lat, lng=lng, iso3=iso3, sector=sector, scenario=scn, year=year))
        for scn in [ScenarioId.NET_ZERO, ScenarioId.DELAYED, ScenarioId.CURRENT]
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    def safe(r):
        return r.model_dump() if not isinstance(r, Exception) else {"error": str(r)}

    return {
        "lat": lat, "lng": lng, "sector": sector, "year": year,
        "scenarios": {
            "net_zero_1.5":  safe(results[0]),
            "delayed_2.0":   safe(results[1]),
            "current_3.0":   safe(results[2]),
        },
    }


# ── Portfolio analysis ─────────────────────────────────────────────────────

@app.post("/api/portfolio/analyze", response_model=PortfolioRiskSummary)
async def portfolio_analyze(request: PortfolioAnalysisRequest):
    """Portfolio-level aggregate climate risk analysis."""
    tasks = [
        _score(AssetInput(
            lat=a.lat, lng=a.lng, iso3=a.iso3, sector=a.sector,
            scenario=request.scenario, year=request.year,
            asset_value_usd=a.asset_value_usd,
            annual_revenue_usd=a.annual_revenue_usd,
        ))
        for a in request.assets
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    valid: List[AssetRiskResponse] = [r for r in results if not isinstance(r, Exception)]

    if not valid:
        raise HTTPException(status_code=500, detail="All asset risk scores failed")

    n = len(valid)
    w_phys  = sum(r.physical_risk.composite   for r in valid) / n
    w_trans = sum(r.transition_risk.composite  for r in valid) / n
    w_comp  = sum(r.composite_risk_score       for r in valid) / n
    avg_rar = sum(r.financial_impact.revenue_at_risk_pct for r in valid) / n
    total_usd = (
        sum(r.financial_impact.revenue_at_risk_usd for r in valid
            if r.financial_impact.revenue_at_risk_usd is not None)
        if any(r.financial_impact.revenue_at_risk_usd for r in valid) else None
    )

    return PortfolioRiskSummary(
        total_assets=n,
        weighted_physical_risk=round(w_phys, 1),
        weighted_transition_risk=round(w_trans, 1),
        weighted_composite_risk=round(w_comp, 1),
        critical_assets=sum(1 for r in valid if r.risk_level == "critical"),
        high_risk_assets=sum(1 for r in valid if r.risk_level == "high"),
        total_revenue_at_risk_pct=round(avg_rar, 2),
        total_financial_exposure_usd=round(total_usd, 0) if total_usd else None,
        asset_breakdown=valid,
    )


# ── Heatmap grid ───────────────────────────────────────────────────────────

@app.get("/api/grid/heatmap")
async def heatmap_grid(
    lat_min:    float      = Query(-60.0),
    lat_max:    float      = Query(72.0),
    lng_min:    float      = Query(-175.0),
    lng_max:    float      = Query(175.0),
    resolution: float      = Query(5.0, ge=1.0, le=20.0),
    layer:      str        = Query("physical"),
    scenario:   ScenarioId = Query(ScenarioId.NET_ZERO),
    year:       int        = Query(2050, ge=2024, le=2100),
):
    """
    Fast heatmap grid for map overlay.
    Uses physics-based fallbacks (no external API calls) for speed.
    """
    from .connectors.open_meteo import _fallback_baseline, _fallback_projection

    points = []
    lat = lat_min
    while lat <= lat_max + 0.01:
        lng = lng_min
        while lng <= lng_max + 0.01:
            baseline   = _fallback_baseline(lat, lng)
            projection = _fallback_projection(year, lat)
            physical   = compute_physical_risk(baseline, projection, lat, lng, year)

            layer_map = {
                "physical":   physical.composite,
                "heat":       physical.heat_stress,
                "flood":      physical.flood_risk,
                "storm":      physical.storm_risk,
                "drought":    physical.drought_risk,
                "sea_level":  physical.sea_level_risk,
            }
            value = layer_map.get(layer, physical.composite)
            points.append({"lat": round(lat, 1), "lng": round(lng, 1), "v": round(value, 1)})
            lng += resolution
        lat += resolution

    return {
        "points":   points,
        "layer":    layer,
        "scenario": scenario,
        "year":     year,
        "count":    len(points),
    }


# ── Helpers ────────────────────────────────────────────────────────────────

def _lat_lng_to_region(lat: float, lng: float) -> str:
    if -10 <= lng <= 40 and 35 <= lat <= 72:   return "EU"
    if  -9 <= lng <=  2 and 49 <= lat <= 61:   return "UK"
    if -130 <= lng <= -60 and 24 <= lat <= 50: return "USA"
    if -140 <= lng <= -50 and 50 <= lat <= 75: return "Canada"
    if  129 <= lng <= 146 and 30 <= lat <= 45: return "Japan"
    if  125 <= lng <= 130 and 33 <= lat <= 40: return "SouthKorea"
    if   75 <= lng <= 135 and 18 <= lat <= 54: return "China"
    if   68 <= lng <=  97 and  8 <= lat <= 36: return "India"
    if  112 <= lng <= 180 and -50 <= lat <= -10: return "Australia"
    if  -74 <= lng <= -34 and -34 <= lat <=  5: return "Brazil"
    if -120 <= lng <= -34 and -56 <= lat <= 24: return "LatAm"
    if   28 <= lng <= 190 and  50 <= lat <= 78: return "Russia"
    if   25 <= lng <=  65 and  12 <= lat <= 42: return "MENA"
    if  -18 <= lng <=  52 and -36 <= lat <= 37: return "Africa"
    if   92 <= lng <= 145 and -12 <= lat <= 28: return "SEA"
    return "Global"
