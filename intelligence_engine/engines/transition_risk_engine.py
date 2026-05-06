"""
Transition Risk Engine
======================
Models financial exposure to climate transition risks:
  - Carbon pricing & carbon tax cost
  - Regulatory compliance costs (CSRD, SEC, etc.)
  - Stranded asset probability (fossil fuels)
  - Technology disruption (fossil → renewable substitution)
  - Market demand shift (consumer preferences, investor mandates)
  - Reputational risk (ESG controversy scoring)

NGFS scenario-aligned.
"""

from dataclasses import dataclass, field
from typing import Optional, Dict, List, Any


@dataclass
class TransitionRiskInput:
    sector: str
    scenario: str = "2C"
    horizon: int = 2050
    revenue_usd_m: float = 1000.0
    ebitda_margin_pct: float = 20.0
    carbon_intensity_t_per_m_revenue: float = 150.0
    fossil_fuel_revenue_pct: float = 0.0
    renewable_revenue_pct: float = 0.0
    has_sbti: bool = False
    has_net_zero_target: bool = False
    country_jurisdiction: str = "EU"


@dataclass
class TransitionRiskScore:
    overall: float
    policy_risk: float
    technology_risk: float
    market_risk: float
    reputation_risk: float
    stranded_asset_probability: float
    carbon_cost_2030_usd_m: float
    carbon_cost_2050_usd_m: float
    revenue_at_risk_pct: float
    ebitda_impact_pct: float
    transition_readiness_score: float
    risk_rating: str
    drivers: Dict[str, Any] = field(default_factory=dict)


# Sector-level transition risk parameters
SECTOR_PARAMS = {
    "oil-gas": {
        "fossil_dep": 0.95, "tech_disrupt": 0.92, "market_shift": 0.88,
        "regulatory_exp": 0.90, "stranded_base": 0.72,
    },
    "utilities": {
        "fossil_dep": 0.55, "tech_disrupt": 0.64, "market_shift": 0.52,
        "regulatory_exp": 0.78, "stranded_base": 0.38,
    },
    "mining": {
        "fossil_dep": 0.35, "tech_disrupt": 0.45, "market_shift": 0.42,
        "regulatory_exp": 0.62, "stranded_base": 0.28,
    },
    "manufacturing": {
        "fossil_dep": 0.28, "tech_disrupt": 0.52, "market_shift": 0.38,
        "regulatory_exp": 0.55, "stranded_base": 0.15,
    },
    "transportation": {
        "fossil_dep": 0.72, "tech_disrupt": 0.78, "market_shift": 0.65,
        "regulatory_exp": 0.70, "stranded_base": 0.44,
    },
    "real-estate": {
        "fossil_dep": 0.22, "tech_disrupt": 0.35, "market_shift": 0.42,
        "regulatory_exp": 0.60, "stranded_base": 0.18,
    },
    "agriculture": {
        "fossil_dep": 0.18, "tech_disrupt": 0.28, "market_shift": 0.38,
        "regulatory_exp": 0.42, "stranded_base": 0.08,
    },
    "financials": {
        "fossil_dep": 0.05, "tech_disrupt": 0.32, "market_shift": 0.45,
        "regulatory_exp": 0.68, "stranded_base": 0.22,
    },
    "technology": {
        "fossil_dep": 0.08, "tech_disrupt": 0.18, "market_shift": 0.22,
        "regulatory_exp": 0.30, "stranded_base": 0.04,
    },
    "default": {
        "fossil_dep": 0.25, "tech_disrupt": 0.38, "market_shift": 0.32,
        "regulatory_exp": 0.45, "stranded_base": 0.12,
    },
}

CARBON_PRICE_PATHS = {
    "1.5C":   {2025: 65,  2030: 145, 2040: 280, 2050: 420},
    "2C":     {2025: 45,  2030: 95,  2040: 175, 2050: 250},
    "3C":     {2025: 25,  2030: 45,  2040: 65,  2050: 90},
    "4C+":    {2025: 10,  2030: 15,  2040: 20,  2050: 28},
}

SCENARIO_TRANSITION_SPEED = {
    "1.5C":   1.0,
    "2C":     0.72,
    "3C":     0.38,
    "4C+":    0.12,
}

JURISDICTION_EXPOSURE = {
    "EU":   1.0,   # Most aggressive: CSRD + EU-ETS
    "US":   0.68,  # SEC rule + state-level
    "UK":   0.82,  # UK-ETS + mandatory TCFD
    "AU":   0.74,  # Mandatory disclosure
    "IN":   0.55,  # BRSR mandatory
    "CN":   0.60,  # National ETS + mandates
    "BR":   0.38,
    "ROW":  0.42,
}


class TransitionRiskEngine:

    def compute(self, inp: TransitionRiskInput) -> TransitionRiskScore:
        sector_key = inp.sector.lower().replace(" ", "-").replace("&", "")
        params = SECTOR_PARAMS.get(sector_key, SECTOR_PARAMS["default"])
        trans_speed = SCENARIO_TRANSITION_SPEED.get(inp.scenario, 0.5)
        jur_exp = JURISDICTION_EXPOSURE.get(inp.country_jurisdiction, 0.45)
        h_factor = max(0.1, (inp.horizon - 2025) / 25)

        # Carbon pricing exposure
        carbon_paths = CARBON_PRICE_PATHS.get(inp.scenario, CARBON_PRICE_PATHS["2C"])
        cp_2030 = carbon_paths[2030]
        cp_2050 = carbon_paths.get(2050, carbon_paths[2040])

        annual_emissions_t = inp.carbon_intensity_t_per_m_revenue * inp.revenue_usd_m
        carbon_cost_2030 = (annual_emissions_t * cp_2030) / 1_000_000  # $M
        carbon_cost_2050 = (annual_emissions_t * cp_2050) / 1_000_000  # $M

        # Policy risk (regulatory compliance burden)
        policy_risk = min(100, (
            params["regulatory_exp"] * jur_exp * trans_speed * 80 +
            (0.0 if inp.has_sbti else 15) +
            (0.0 if inp.has_net_zero_target else 10)
        ))

        # Technology disruption risk
        tech_risk = min(100, (
            params["tech_disrupt"] * trans_speed * 70 * h_factor +
            max(0, inp.fossil_fuel_revenue_pct - inp.renewable_revenue_pct) * 0.3
        ))

        # Market demand shift risk
        market_risk = min(100, (
            params["market_shift"] * trans_speed * 65 * h_factor +
            params["fossil_dep"] * inp.fossil_fuel_revenue_pct * 0.4
        ))

        # Reputation risk
        rep_risk = min(100, (
            params["fossil_dep"] * 50 +
            (0.0 if inp.has_sbti else 20) +
            (0.0 if inp.has_net_zero_target else 15)
        ))

        # Stranded asset probability
        stranded_prob = min(100, (
            params["stranded_base"] * trans_speed * 100 * h_factor +
            inp.fossil_fuel_revenue_pct * params["fossil_dep"] * 0.5
        ))

        # Revenue at risk (pct)
        revenue_risk = (
            params["fossil_dep"] * inp.fossil_fuel_revenue_pct * trans_speed * h_factor * 0.6 +
            (carbon_cost_2050 / inp.revenue_usd_m) * 100
        )
        revenue_at_risk = min(80, revenue_risk)

        # EBITDA impact (pct)
        ebitda_base = inp.ebitda_margin_pct
        ebitda_impact = min(ebitda_base, revenue_at_risk * 1.4)

        # Transition readiness
        readiness = max(0, 100 - (
            params["fossil_dep"] * inp.fossil_fuel_revenue_pct +
            (0 if inp.has_sbti else 20) +
            (0 if inp.has_net_zero_target else 15) -
            inp.renewable_revenue_pct * 0.5
        ))

        overall = (
            policy_risk * 0.28 +
            tech_risk * 0.22 +
            market_risk * 0.24 +
            rep_risk * 0.16 +
            stranded_prob * 0.10
        )

        risk_rating = (
            "CRITICAL" if overall >= 75 else
            "HIGH"     if overall >= 55 else
            "MEDIUM"   if overall >= 35 else
            "LOW"      if overall >= 15 else "MINIMAL"
        )

        return TransitionRiskScore(
            overall=round(overall, 2),
            policy_risk=round(policy_risk, 2),
            technology_risk=round(tech_risk, 2),
            market_risk=round(market_risk, 2),
            reputation_risk=round(rep_risk, 2),
            stranded_asset_probability=round(stranded_prob, 2),
            carbon_cost_2030_usd_m=round(carbon_cost_2030, 2),
            carbon_cost_2050_usd_m=round(carbon_cost_2050, 2),
            revenue_at_risk_pct=round(revenue_at_risk, 2),
            ebitda_impact_pct=round(ebitda_impact, 2),
            transition_readiness_score=round(readiness, 2),
            risk_rating=risk_rating,
            drivers={
                "sector": inp.sector,
                "scenario": inp.scenario,
                "carbon_price_2050": f"${cp_2050}/tCO₂",
                "primary_driver": max(
                    [("Policy", policy_risk), ("Technology", tech_risk),
                     ("Market", market_risk), ("Reputation", rep_risk)],
                    key=lambda x: x[1]
                )[0],
                "jurisdiction_multiplier": jur_exp,
                "methodology": "NGFS Phase 4 Transition Risk Framework",
            }
        )


transition_risk_engine = TransitionRiskEngine()
