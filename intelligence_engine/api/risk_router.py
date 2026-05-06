"""Risk API Router — Physical + Transition Risk endpoints."""

from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from engines.physical_risk_engine import physical_risk_engine, PhysicalRiskInput
from engines.transition_risk_engine import transition_risk_engine, TransitionRiskInput
from engines.financial_impact_engine import financial_impact_engine, FinancialImpactInput

router = APIRouter()


# ── Physical Risk ─────────────────────────────────────────────────────────────

class PhysicalRiskRequest(BaseModel):
    lat: float = Field(..., ge=-90, le=90, description="Latitude of asset")
    lng: float = Field(..., ge=-180, le=180, description="Longitude of asset")
    scenario: str = Field("2C", description="NGFS scenario: 1.5C | 2C | 3C | 4C+")
    horizon: int = Field(2050, ge=2025, le=2100, description="Target year for risk projection")
    asset_type: str = Field("generic", description="Asset type classification")
    elevation_m: Optional[float] = Field(None, description="Elevation in metres (improves sea-level accuracy)")
    distance_to_coast_km: Optional[float] = Field(None, description="Distance to coast in km")


@router.post("/physical", summary="Compute physical climate risk score for a location")
async def physical_risk(req: PhysicalRiskRequest):
    inp = PhysicalRiskInput(
        lat=req.lat, lng=req.lng, scenario=req.scenario,
        horizon=req.horizon, asset_type=req.asset_type,
        elevation_m=req.elevation_m,
        distance_to_coast_km=req.distance_to_coast_km,
    )
    result = await physical_risk_engine.compute(inp)
    return {
        "status": "success",
        "input": {"lat": req.lat, "lng": req.lng, "scenario": req.scenario, "horizon": req.horizon},
        "risk_score": {
            "overall": result.overall,
            "risk_rating": result.risk_rating,
            "confidence": result.confidence,
            "hazards": {
                "flood_risk": result.flood_risk,
                "heat_stress_acute": result.heat_stress_acute,
                "heat_stress_chronic": result.heat_stress_chronic,
                "wildfire_risk": result.wildfire_risk,
                "sea_level_rise_exposure": result.sea_level_rise_exposure,
                "storm_intensity": result.storm_intensity,
                "water_stress": result.water_stress,
                "permafrost_risk": result.permafrost_risk,
            },
            "drivers": result.drivers,
        }
    }


@router.get("/physical", summary="GET version of physical risk score")
async def physical_risk_get(
    lat: float = Query(...), lng: float = Query(...),
    scenario: str = Query("2C"), horizon: int = Query(2050),
):
    inp = PhysicalRiskInput(lat=lat, lng=lng, scenario=scenario, horizon=horizon)
    result = await physical_risk_engine.compute(inp)
    return {
        "status": "success",
        "overall": result.overall,
        "risk_rating": result.risk_rating,
        "confidence": result.confidence,
        "hazards": {
            "flood_risk": result.flood_risk,
            "heat_stress_acute": result.heat_stress_acute,
            "wildfire_risk": result.wildfire_risk,
            "sea_level_rise_exposure": result.sea_level_rise_exposure,
            "storm_intensity": result.storm_intensity,
            "water_stress": result.water_stress,
        }
    }


# ── Transition Risk ───────────────────────────────────────────────────────────

class TransitionRiskRequest(BaseModel):
    sector: str = Field(..., description="Industry sector")
    scenario: str = Field("2C")
    horizon: int = Field(2050, ge=2025, le=2100)
    revenue_usd_m: float = Field(1000.0, gt=0)
    ebitda_margin_pct: float = Field(20.0)
    carbon_intensity_t_per_m_revenue: float = Field(150.0, ge=0)
    fossil_fuel_revenue_pct: float = Field(0.0, ge=0, le=100)
    renewable_revenue_pct: float = Field(0.0, ge=0, le=100)
    has_sbti: bool = Field(False)
    has_net_zero_target: bool = Field(False)
    country_jurisdiction: str = Field("EU")


@router.post("/transition", summary="Compute transition risk score for a company")
async def transition_risk(req: TransitionRiskRequest):
    inp = TransitionRiskInput(**req.dict())
    result = transition_risk_engine.compute(inp)
    return {
        "status": "success",
        "risk_score": {
            "overall": result.overall,
            "risk_rating": result.risk_rating,
            "dimensions": {
                "policy_risk": result.policy_risk,
                "technology_risk": result.technology_risk,
                "market_risk": result.market_risk,
                "reputation_risk": result.reputation_risk,
            },
            "financial_exposure": {
                "carbon_cost_2030_usd_m": result.carbon_cost_2030_usd_m,
                "carbon_cost_2050_usd_m": result.carbon_cost_2050_usd_m,
                "revenue_at_risk_pct": result.revenue_at_risk_pct,
                "ebitda_impact_pct": result.ebitda_impact_pct,
                "stranded_asset_probability": result.stranded_asset_probability,
            },
            "transition_readiness_score": result.transition_readiness_score,
            "drivers": result.drivers,
        }
    }


# ── Financial Impact ──────────────────────────────────────────────────────────

class FinancialImpactRequest(BaseModel):
    physical_risk_score: float = Field(..., ge=0, le=100)
    transition_risk_score: float = Field(..., ge=0, le=100)
    revenue_usd_m: float = Field(..., gt=0)
    ebitda_usd_m: float = Field(..., gt=0)
    asset_value_usd_m: float = Field(..., gt=0)
    debt_usd_m: float = Field(0.0, ge=0)
    sector: str
    scenario: str = Field("2C")
    horizon: int = Field(2050)
    discount_rate_pct: float = Field(8.0)
    credit_rating: str = Field("BBB")


@router.post("/financial-impact", summary="Convert climate risk into financial metrics")
async def financial_impact(req: FinancialImpactRequest):
    inp = FinancialImpactInput(**req.dict())
    result = financial_impact_engine.compute(inp)
    return {
        "status": "success",
        "financial_impact": {
            "revenue_at_risk_usd_m": result.revenue_at_risk_usd_m,
            "ebitda_at_risk_usd_m": result.ebitda_at_risk_usd_m,
            "asset_impairment_usd_m": result.asset_impairment_usd_m,
            "npv_climate_costs_usd_m": result.npv_climate_costs_usd_m,
            "stranded_asset_value_usd_m": result.stranded_asset_value_usd_m,
            "total_financial_exposure_usd_m": result.total_financial_exposure_usd_m,
            "exposure_as_pct_revenue": result.exposure_as_pct_revenue,
        },
        "capital_market_impact": {
            "cost_of_capital_uplift_bps": result.cost_of_capital_uplift_bps,
            "credit_spread_widening_bps": result.credit_spread_widening_bps,
            "equity_discount_pct": result.equity_discount_pct,
        },
        "risk_metrics": {
            "climate_var_1yr_pct": result.climate_var_1yr_pct,
            "climate_var_10yr_pct": result.climate_var_10yr_pct,
            "insurance_cost_increase_pct": result.insurance_cost_increase_pct,
            "risk_materiality": result.risk_materiality,
        },
        "breakdown": result.breakdown,
    }
