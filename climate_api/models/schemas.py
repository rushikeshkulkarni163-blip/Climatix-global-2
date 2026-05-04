from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum


class ScenarioId(str, Enum):
    NET_ZERO = "1.5"
    DELAYED  = "2.0"
    CURRENT  = "3.0"


class Sector(str, Enum):
    ENERGY       = "Energy"
    MANUFACTURING = "Manufacturing"
    LOGISTICS    = "Logistics"
    FINANCE      = "Finance"
    MINING       = "Mining"
    TECHNOLOGY   = "Technology"
    AGRICULTURE  = "Agriculture"
    SHIPPING     = "Shipping"
    REAL_ESTATE  = "Real Estate"


# ── Input ──────────────────────────────────────────────────────────────────

class AssetInput(BaseModel):
    lat:                float   = Field(..., ge=-90,   le=90)
    lng:                float   = Field(..., ge=-180,  le=180)
    iso3:               str     = Field(..., min_length=2, max_length=3)
    sector:             Sector
    scenario:           ScenarioId = ScenarioId.NET_ZERO
    year:               int     = Field(2030, ge=2024, le=2100)
    asset_value_usd:    Optional[float] = None
    annual_revenue_usd: Optional[float] = None


class PortfolioAsset(BaseModel):
    id:                 str
    name:               str
    lat:                float
    lng:                float
    iso3:               str
    sector:             Sector
    asset_value_usd:    Optional[float] = None
    annual_revenue_usd: Optional[float] = None


class PortfolioAnalysisRequest(BaseModel):
    assets:   List[PortfolioAsset]
    scenario: ScenarioId = ScenarioId.NET_ZERO
    year:     int        = 2030


# ── Climate data ───────────────────────────────────────────────────────────

class ClimateBaseline(BaseModel):
    temp_mean_c:          float
    temp_max_c:           float
    precip_mm_year:       float
    wind_speed_ms:        float
    relative_humidity_pct: Optional[float] = None
    source:               str = "estimated"


class ClimateProjection(BaseModel):
    year:                 int
    temp_anomaly_c:       float
    precip_change_pct:    float
    extreme_heat_days:    int
    extreme_precip_events: int
    source:               str = "estimated"


# ── Risk scores ────────────────────────────────────────────────────────────

class PhysicalRiskScores(BaseModel):
    heat_stress:   float = Field(..., ge=0, le=100)
    flood_risk:    float = Field(..., ge=0, le=100)
    storm_risk:    float = Field(..., ge=0, le=100)
    drought_risk:  float = Field(..., ge=0, le=100)
    sea_level_risk: float = Field(..., ge=0, le=100)
    composite:     float = Field(..., ge=0, le=100)


class TransitionRiskScores(BaseModel):
    carbon_cost:            float = Field(..., ge=0, le=100)
    policy_risk:            float = Field(..., ge=0, le=100)
    technology_disruption:  float = Field(..., ge=0, le=100)
    market_shift:           float = Field(..., ge=0, le=100)
    composite:              float = Field(..., ge=0, le=100)


# ── Financial impact ───────────────────────────────────────────────────────

class FinancialImpact(BaseModel):
    revenue_at_risk_pct:        float
    revenue_at_risk_usd:        Optional[float] = None
    ebitda_impact_pct:          float
    capex_increase_pct:         float
    opex_increase_pct:          float
    asset_impairment_pct:       float
    supply_chain_disruption_pct: float
    compliance_cost_usd_tonne:  float
    stranded_asset_probability: float


# ── Country macro ──────────────────────────────────────────────────────────

class CountryMacroData(BaseModel):
    gdp_usd:                  Optional[float] = None
    gdp_growth_pct:           Optional[float] = None
    co2_per_capita:           Optional[float] = None
    population:               Optional[float] = None
    energy_use_per_capita:    Optional[float] = None
    renewable_energy_pct:     Optional[float] = None
    carbon_price_usd:         Optional[float] = None
    data_year:                Optional[int]   = None


# ── Full response ──────────────────────────────────────────────────────────

class AssetRiskResponse(BaseModel):
    lat:                  float
    lng:                  float
    scenario:             str
    year:                 int
    physical_risk:        PhysicalRiskScores
    transition_risk:      TransitionRiskScores
    financial_impact:     FinancialImpact
    composite_risk_score: float
    risk_level:           str
    country_macro:        CountryMacroData
    climate_baseline:     ClimateBaseline
    projection:           ClimateProjection
    data_freshness:       str
    sources:              List[str]


class PortfolioRiskSummary(BaseModel):
    total_assets:              int
    weighted_physical_risk:    float
    weighted_transition_risk:  float
    weighted_composite_risk:   float
    critical_assets:           int
    high_risk_assets:          int
    total_revenue_at_risk_pct: float
    total_financial_exposure_usd: Optional[float] = None
    asset_breakdown:           List[AssetRiskResponse]
