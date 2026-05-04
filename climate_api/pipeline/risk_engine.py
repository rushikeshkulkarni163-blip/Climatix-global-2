"""
Climate Risk Scoring Engine — NGFS Phase IV calibrated.

Physical risk:  heat stress, flood, storm, drought, sea-level rise
Transition risk: carbon cost, policy pressure, tech disruption, market shift
Composite:      sector-weighted blend of physical + transition
"""
import math
from typing import Tuple

from ..models.schemas import (
    PhysicalRiskScores,
    TransitionRiskScores,
    ClimateBaseline,
    ClimateProjection,
    CountryMacroData,
    Sector,
    ScenarioId,
)

# ── NGFS Phase IV calibrated scenario parameters ───────────────────────────
NGFS: dict = {
    ScenarioId.NET_ZERO: {
        "cp_2030": 130, "cp_2050": 800,
        "pm_2030": 0.55, "pm_2050": 0.72,
        "tm_2030": 1.45, "tm_2050": 1.85,
        "warming_2100": 1.5,
    },
    ScenarioId.DELAYED: {
        "cp_2030": 40,  "cp_2050": 300,
        "pm_2030": 0.78, "pm_2050": 1.10,
        "tm_2030": 0.88, "tm_2050": 1.38,
        "warming_2100": 2.0,
    },
    ScenarioId.CURRENT: {
        "cp_2030": 28,  "cp_2050": 65,
        "pm_2030": 0.95, "pm_2050": 1.82,
        "tm_2030": 0.48, "tm_2050": 0.58,
        "warming_2100": 3.2,
    },
}

# ── Sector weights (physical/transition/carbon_intensity) ──────────────────
SECTOR_W: dict = {
    Sector.ENERGY:        {"p": 1.40, "t": 2.00, "ci": 2.8},
    Sector.MANUFACTURING: {"p": 1.20, "t": 1.50, "ci": 1.6},
    Sector.LOGISTICS:     {"p": 1.50, "t": 1.20, "ci": 1.1},
    Sector.FINANCE:       {"p": 0.80, "t": 1.80, "ci": 0.4},
    Sector.MINING:        {"p": 1.60, "t": 1.90, "ci": 2.2},
    Sector.TECHNOLOGY:    {"p": 1.00, "t": 0.90, "ci": 0.5},
    Sector.AGRICULTURE:   {"p": 2.00, "t": 0.80, "ci": 1.3},
    Sector.SHIPPING:      {"p": 1.30, "t": 1.60, "ci": 1.4},
    Sector.REAL_ESTATE:   {"p": 1.10, "t": 1.10, "ci": 0.8},
}

# Regional carbon-market readiness scores (0–100)
REGIONAL_CARBON_READINESS: dict = {
    "EU": 82, "UK": 76, "USA": 58, "Canada": 64, "Japan": 56,
    "SouthKorea": 50, "China": 44, "Australia": 38, "India": 28,
    "Brazil": 18, "LatAm": 14, "Russia": 9, "MENA": 11,
    "Africa": 8, "SEA": 20, "Global": 22,
}


# ── Interpolation ──────────────────────────────────────────────────────────

def _interp(year: int, v2024: float, v2030: float, v2050: float) -> float:
    if year <= 2024: return v2024
    if year >= 2100: return v2050 * (1 + (year - 2050) * 0.005)
    if year <= 2030:
        t = (year - 2024) / 6
        return v2024 + (v2030 - v2024) * t
    t = (year - 2030) / 20
    return v2030 + (v2050 - v2030) * t


def get_carbon_price(scenario: ScenarioId, year: int) -> float:
    s = NGFS[scenario]
    return _interp(year, 28.0, s["cp_2030"], s["cp_2050"])


# ── Physical risk ──────────────────────────────────────────────────────────

def compute_physical_risk(
    baseline: ClimateBaseline,
    projection: ClimateProjection,
    lat: float,
    lng: float,
    year: int,
) -> PhysicalRiskScores:
    effective_temp = baseline.temp_max_c + projection.temp_anomaly_c

    # 1. Heat stress ─────────────────────────────────────────────────────────
    # Wet-bulb temperature proxy: temp + humidity interaction
    rh_factor = 1.0 + (baseline.relative_humidity_pct or 60) / 300
    heat_raw = max(0, (effective_temp - 22) / 18 * 100) * rh_factor
    heat_stress = min(100, heat_raw * (1 + projection.extreme_heat_days / 180))

    # 2. Flood risk ──────────────────────────────────────────────────────────
    precip_norm  = min(1.6, baseline.precip_mm_year / 1000)
    precip_trend = max(0.0, projection.precip_change_pct / 100)
    coastal_mult = 1.35 if _is_coastal(lat, lng) else 1.0
    delta_precip_score = projection.extreme_precip_events / 45 * 30
    flood_risk = min(100, (
        precip_norm * 38 + precip_trend * 28 + delta_precip_score
    ) * coastal_mult)

    # 3. Storm / cyclone risk ────────────────────────────────────────────────
    storm_risk = _storm_risk(lat, lng, effective_temp)

    # 4. Drought risk ────────────────────────────────────────────────────────
    aridity = max(0.0, 1.0 - baseline.precip_mm_year / 2200)
    drying  = max(0.0, -projection.precip_change_pct / 100)
    drought_risk = min(100, aridity * 55 + drying * 35 + heat_stress * 0.25)

    # 5. Sea-level rise ──────────────────────────────────────────────────────
    slr = _sea_level_risk(lat, lng, year, projection.temp_anomaly_c)

    composite = min(100,
        heat_stress  * 0.28 +
        flood_risk   * 0.28 +
        storm_risk   * 0.18 +
        drought_risk * 0.16 +
        slr          * 0.10
    )

    return PhysicalRiskScores(
        heat_stress=round(heat_stress, 1),
        flood_risk=round(flood_risk, 1),
        storm_risk=round(storm_risk, 1),
        drought_risk=round(drought_risk, 1),
        sea_level_risk=round(slr, 1),
        composite=round(composite, 1),
    )


def _is_coastal(lat: float, lng: float) -> bool:
    # Major coastal population centres (simplified bounding boxes)
    COASTAL = [
        (20, 30, 50, 90),     # South/SE Asia coast
        (10, 70, 25, 90),     # Indian subcontinent coast
        (25, -90, 45, -65),   # US East Coast
        (30, -125, 50, -115), # US West Coast
        (-38, 140, -20, 155), # Australia east
        (48, -5, 60, 10),     # Northern Europe / UK
        (10, -90, 25, -60),   # Caribbean / Gulf of Mexico
        (-35, 15, -20, 35),   # Southern Africa coast
        (35, 125, 45, 145),   # Japan / Korean coast
        (50, 3, 58, 9),       # Netherlands / Belgium
    ]
    for lat1, lng1, lat2, lng2 in COASTAL:
        if lat1 <= lat <= lat2 and lng1 <= lng <= lng2:
            return True
    return False


def _storm_risk(lat: float, lng: float, sst_proxy_c: float) -> float:
    """Tropical cyclone probability based on SST threshold and latitude belt."""
    abs_lat = abs(lat)
    if 5 <= abs_lat <= 22:
        # Primary cyclone belt; intensifies with warming SST
        base = max(0, 60 + (sst_proxy_c - 27) * 6)
        return min(100, base)
    if 22 < abs_lat <= 35:
        return min(65, max(0, 55 - (abs_lat - 22) * 2.5))
    if 35 < abs_lat <= 55:
        return min(40, max(0, 35 - (abs_lat - 35) * 1.5))
    return max(0, 12 - (abs_lat - 55) * 0.4)


def _sea_level_risk(lat: float, lng: float, year: int, temp_anomaly: float) -> float:
    if not _is_coastal(lat, lng):
        return 5.0
    # IPCC AR6 median SLR: ~0.3m by 2050, ~0.6m by 2100 under moderate scenario
    slr_m = 0.3 * (year - 2020) / 30 * (1 + temp_anomaly * 0.12)
    low_lying = abs(lat) < 30  # low-latitude deltas / atolls most exposed
    return min(100, slr_m * 80 * (1.4 if low_lying else 0.8))


# ── Transition risk ────────────────────────────────────────────────────────

def compute_transition_risk(
    scenario: ScenarioId,
    year: int,
    sector: Sector,
    country_macro: CountryMacroData,
    region: str = "Global",
) -> TransitionRiskScores:
    s  = NGFS[scenario]
    sw = SECTOR_W.get(sector, {"p": 1.0, "t": 1.0, "ci": 1.0})

    # 1. Carbon cost ──────────────────────────────────────────────────────────
    eff_cp = get_carbon_price(scenario, year)
    carbon_cost = min(100, (eff_cp / 800) * 100 * sw["ci"])

    # 2. Policy pressure ──────────────────────────────────────────────────────
    cr_score = REGIONAL_CARBON_READINESS.get(region, 22)
    pm = _interp(year, 0.18, s["pm_2030"], s["pm_2050"])
    policy_risk = min(100, cr_score * pm * sw["t"] * 0.85)

    # 3. Technology disruption ────────────────────────────────────────────────
    tech_base = {
        Sector.ENERGY: 72, Sector.MINING: 58, Sector.SHIPPING: 52,
        Sector.MANUFACTURING: 46, Sector.LOGISTICS: 42, Sector.AGRICULTURE: 36,
        Sector.REAL_ESTATE: 32, Sector.FINANCE: 28, Sector.TECHNOLOGY: 18,
    }.get(sector, 36)
    scn_acc = {ScenarioId.NET_ZERO: 1.35, ScenarioId.DELAYED: 1.0, ScenarioId.CURRENT: 0.65}
    tech_disruption = min(100, tech_base * scn_acc[scenario] * ((year - 2024) / 76 * 0.8 + 0.3))

    # 4. Market shift ─────────────────────────────────────────────────────────
    ms_base = {
        Sector.ENERGY: 68, Sector.MINING: 62, Sector.FINANCE: 48,
        Sector.SHIPPING: 42, Sector.MANUFACTURING: 40, Sector.LOGISTICS: 32,
        Sector.REAL_ESTATE: 30, Sector.AGRICULTURE: 26, Sector.TECHNOLOGY: 16,
    }.get(sector, 36)
    yr_factor = min(1.0, (year - 2024) / 50)
    market_shift = min(100, ms_base * scn_acc[scenario] * yr_factor)

    # Country CO₂ adjustment: high-emitter countries face heavier transition burden
    co2_adj = 1.0
    if country_macro.co2_per_capita and country_macro.co2_per_capita > 10:
        co2_adj = 1.15
    elif country_macro.co2_per_capita and country_macro.co2_per_capita < 3:
        co2_adj = 0.88

    composite = min(100, (
        carbon_cost    * 0.35 +
        policy_risk    * 0.28 +
        tech_disruption * 0.22 +
        market_shift   * 0.15
    ) * co2_adj)

    return TransitionRiskScores(
        carbon_cost=round(carbon_cost, 1),
        policy_risk=round(policy_risk, 1),
        technology_disruption=round(tech_disruption, 1),
        market_shift=round(market_shift, 1),
        composite=round(composite, 1),
    )


# ── Composite ─────────────────────────────────────────────────────────────

def compute_composite_risk(
    physical: PhysicalRiskScores,
    transition: TransitionRiskScores,
    sector: Sector,
) -> Tuple[float, str]:
    sw = SECTOR_W.get(sector, {"p": 1.0, "t": 1.0, "ci": 1.0})

    # Normalise weights so they sum to 1.0 across physical + transition
    total_w = sw["p"] + sw["t"]
    p_w = sw["p"] / total_w
    t_w = sw["t"] / total_w

    composite = min(100, physical.composite * p_w + transition.composite * t_w)

    if   composite >= 68: level = "critical"
    elif composite >= 46: level = "high"
    elif composite >= 26: level = "medium"
    else:                 level = "low"

    return round(composite, 1), level
