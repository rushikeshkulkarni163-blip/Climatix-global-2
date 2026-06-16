"""
Climactix — Climate Financial Simulation Engine
================================================
Quantifies financial climate exposure under 6 institutional scenarios.
This is the differentiator: translating greenwashing risk and disclosure
gaps into concrete financial materiality signals.

Simulation Outputs:
  - Revenue at risk (% and absolute estimate)
  - Carbon tax / carbon pricing exposure
  - Regulatory penalty exposure
  - Litigation liability estimate
  - Stranded asset risk
  - Supply chain disruption cost
  - Insurance premium impact
  - EBITDA impact per scenario
  - Valuation exposure (EV impact)

Scenarios:
  1. 1.5°C Orderly Transition (IEA NZE 2050)
  2. 2°C Delayed Transition (NGFS Below 2°C)
  3. 3°C+ Disorderly / Failed Transition
  4. Policy Acceleration (Carbon Pricing Shock)
  5. Extreme Physical Weather Event
  6. Carbon Market Price Spike

Sector Carbon Intensity Profiles (tCO2e per $M revenue):
  Based on GHG Protocol sector average ranges.
"""

from __future__ import annotations

import re
from typing import Optional


# ── Sector carbon intensity (tCO2e per $1M revenue) ──────────────────────────
# Source: CDP, MSCI sector averages, S&P Global ESG data

SECTOR_INTENSITY: dict[str, dict] = {
    "energy": {
        "label": "Energy & Utilities",
        "carbon_intensity": 2400,   # tCO2e per $1M revenue
        "fossil_exposure": 0.85,
        "stranded_asset_risk": 0.70,
        "transition_cost_pct": 0.35,
        "physical_risk_pct": 0.12,
    },
    "materials": {
        "label": "Materials & Mining",
        "carbon_intensity": 1800,
        "fossil_exposure": 0.55,
        "stranded_asset_risk": 0.45,
        "transition_cost_pct": 0.25,
        "physical_risk_pct": 0.15,
    },
    "industrials": {
        "label": "Industrials & Manufacturing",
        "carbon_intensity": 950,
        "fossil_exposure": 0.40,
        "stranded_asset_risk": 0.25,
        "transition_cost_pct": 0.18,
        "physical_risk_pct": 0.10,
    },
    "consumer": {
        "label": "Consumer Goods & Retail",
        "carbon_intensity": 420,
        "fossil_exposure": 0.20,
        "stranded_asset_risk": 0.10,
        "transition_cost_pct": 0.12,
        "physical_risk_pct": 0.12,
    },
    "food_agriculture": {
        "label": "Food, Agriculture & Beverage",
        "carbon_intensity": 780,
        "fossil_exposure": 0.25,
        "stranded_asset_risk": 0.20,
        "transition_cost_pct": 0.15,
        "physical_risk_pct": 0.25,
    },
    "financials": {
        "label": "Financial Services",
        "carbon_intensity": 45,
        "fossil_exposure": 0.30,
        "stranded_asset_risk": 0.35,
        "transition_cost_pct": 0.08,
        "physical_risk_pct": 0.08,
    },
    "technology": {
        "label": "Technology & Software",
        "carbon_intensity": 120,
        "fossil_exposure": 0.15,
        "stranded_asset_risk": 0.05,
        "transition_cost_pct": 0.08,
        "physical_risk_pct": 0.06,
    },
    "healthcare": {
        "label": "Healthcare & Pharmaceuticals",
        "carbon_intensity": 280,
        "fossil_exposure": 0.20,
        "stranded_asset_risk": 0.08,
        "transition_cost_pct": 0.10,
        "physical_risk_pct": 0.08,
    },
    "real_estate": {
        "label": "Real Estate & Construction",
        "carbon_intensity": 650,
        "fossil_exposure": 0.45,
        "stranded_asset_risk": 0.40,
        "transition_cost_pct": 0.22,
        "physical_risk_pct": 0.30,
    },
    "transportation": {
        "label": "Transportation & Logistics",
        "carbon_intensity": 1200,
        "fossil_exposure": 0.75,
        "stranded_asset_risk": 0.55,
        "transition_cost_pct": 0.28,
        "physical_risk_pct": 0.18,
    },
    "default": {
        "label": "Diversified / General Industry",
        "carbon_intensity": 550,
        "fossil_exposure": 0.35,
        "stranded_asset_risk": 0.25,
        "transition_cost_pct": 0.15,
        "physical_risk_pct": 0.12,
    },
}

# ── Scenario parameters ────────────────────────────────────────────────────────

SCENARIOS: dict[str, dict] = {
    "net_zero_1_5c": {
        "label": "1.5°C Orderly Transition",
        "description": "IEA Net Zero Emissions 2050 aligned. Carbon price rises to $250/tCO2e by 2050. Fossil assets stranded by 2035-2040.",
        "icon": "1.5°C",
        "color": "#00CC44",
        "horizon": "2030-2050",
        "carbon_price_2030": 130,      # $/tCO2e
        "carbon_price_2050": 250,
        "revenue_risk_multiplier": 1.00,
        "transition_cost_multiplier": 1.40,
        "physical_risk_multiplier": 0.40,
        "stranded_asset_multiplier": 1.60,
        "regulatory_penalty_multiplier": 0.50,
        "litigation_multiplier": 0.60,
        "insurance_multiplier": 1.20,
        "ebitda_impact_range": (-0.05, -0.18),
        "valuation_impact_range": (-0.08, -0.25),
    },
    "below_2c": {
        "label": "2°C Delayed Transition",
        "description": "NGFS Below 2°C scenario. Carbon price $100/tCO2e by 2030. Moderate policy tightening with technology substitution.",
        "icon": "2°C",
        "color": "#FFAA00",
        "horizon": "2030-2050",
        "carbon_price_2030": 100,
        "carbon_price_2050": 190,
        "revenue_risk_multiplier": 0.85,
        "transition_cost_multiplier": 1.20,
        "physical_risk_multiplier": 0.70,
        "stranded_asset_multiplier": 1.20,
        "regulatory_penalty_multiplier": 0.70,
        "litigation_multiplier": 0.80,
        "insurance_multiplier": 1.45,
        "ebitda_impact_range": (-0.04, -0.14),
        "valuation_impact_range": (-0.06, -0.20),
    },
    "3c_failed_transition": {
        "label": "3°C+ Failed Transition",
        "description": "Current Policies scenario. Minimal carbon pricing. Severe physical risks by 2040-2050. Systemic disruption.",
        "icon": "3°C+",
        "color": "#FF3333",
        "horizon": "2040-2060",
        "carbon_price_2030": 35,
        "carbon_price_2050": 80,
        "revenue_risk_multiplier": 1.40,
        "transition_cost_multiplier": 0.80,
        "physical_risk_multiplier": 2.20,
        "stranded_asset_multiplier": 0.90,
        "regulatory_penalty_multiplier": 0.40,
        "litigation_multiplier": 1.80,
        "insurance_multiplier": 2.80,
        "ebitda_impact_range": (-0.08, -0.28),
        "valuation_impact_range": (-0.12, -0.40),
    },
    "policy_acceleration": {
        "label": "Policy Acceleration Shock",
        "description": "Sudden policy tightening — carbon price jumps to $150/tCO2e within 2 years. Regulatory enforcement intensifies across all jurisdictions.",
        "icon": "POLICY",
        "color": "#FF6600",
        "horizon": "2024-2028",
        "carbon_price_2030": 150,
        "carbon_price_2050": 200,
        "revenue_risk_multiplier": 1.10,
        "transition_cost_multiplier": 1.80,
        "physical_risk_multiplier": 0.50,
        "stranded_asset_multiplier": 1.40,
        "regulatory_penalty_multiplier": 2.50,
        "litigation_multiplier": 1.60,
        "insurance_multiplier": 1.30,
        "ebitda_impact_range": (-0.06, -0.22),
        "valuation_impact_range": (-0.10, -0.30),
    },
    "extreme_weather": {
        "label": "Extreme Physical Weather Event",
        "description": "Compound extreme weather event (flood, heat stress, drought) affecting key operational assets. IPCC AR6 1-in-20 year scenario.",
        "icon": "CLIMATE",
        "color": "#3399FF",
        "horizon": "2025-2030",
        "carbon_price_2030": 75,
        "carbon_price_2050": 130,
        "revenue_risk_multiplier": 1.60,
        "transition_cost_multiplier": 0.70,
        "physical_risk_multiplier": 3.50,
        "stranded_asset_multiplier": 1.00,
        "regulatory_penalty_multiplier": 0.30,
        "litigation_multiplier": 1.20,
        "insurance_multiplier": 3.80,
        "ebitda_impact_range": (-0.10, -0.35),
        "valuation_impact_range": (-0.08, -0.22),
    },
    "carbon_price_spike": {
        "label": "Carbon Market Price Spike",
        "description": "ETS carbon price spike to $200+/tCO2e due to supply squeeze and political shocks. Compliance cost surge for high-emitters.",
        "icon": "CARBON",
        "color": "#CC66FF",
        "horizon": "2025-2027",
        "carbon_price_2030": 200,
        "carbon_price_2050": 220,
        "revenue_risk_multiplier": 1.05,
        "transition_cost_multiplier": 1.50,
        "physical_risk_multiplier": 0.35,
        "stranded_asset_multiplier": 1.10,
        "regulatory_penalty_multiplier": 0.80,
        "litigation_multiplier": 0.70,
        "insurance_multiplier": 1.10,
        "ebitda_impact_range": (-0.05, -0.20),
        "valuation_impact_range": (-0.06, -0.18),
    },
}


# ── Revenue extraction ─────────────────────────────────────────────────────────

_RX_REVENUE_B = re.compile(
    r"(?:revenue|turnover|net\s+sales|total\s+sales)\s*(?:of|was|were|:)?\s*"
    r"(?:usd|inr|eur|gbp|aud|cad|\$|€|£|₹)?\s*([\d,]+\.?\d*)\s*(billion|bn)\b",
    re.IGNORECASE,
)
_RX_REVENUE_M = re.compile(
    r"(?:revenue|turnover|net\s+sales|total\s+sales)\s*(?:of|was|were|:)?\s*"
    r"(?:usd|inr|eur|gbp|aud|cad|\$|€|£|₹)?\s*([\d,]+\.?\d*)\s*(million|mn|m)\b",
    re.IGNORECASE,
)
_RX_REVENUE_T = re.compile(
    r"(?:revenue|turnover|net\s+sales|total\s+sales)\s*(?:of|was|were|:)?\s*"
    r"(?:usd|inr|eur|gbp|aud|cad|\$|€|£|₹)?\s*([\d,]+\.?\d*)\s*(trillion|tn)\b",
    re.IGNORECASE,
)

_RX_SECTOR = re.compile(
    r"\b(energy|oil|gas|coal|power|utility|utilities"
    r"|mining|metal|steel|cement|chemical|material"
    r"|manufactur|automotive|industri|aerospace"
    r"|retail|consumer|fashion|apparel|textile"
    r"|food|agriculture|beverage|farm"
    r"|bank|financial|insur|invest|asset\s+manag"
    r"|tech|software|digital|semiconductor|cloud"
    r"|health|pharma|hospital|medical"
    r"|real\s+estate|construction|building|infrastructure"
    r"|transport|logistics|shipping|aviation|rail)\b",
    re.IGNORECASE,
)


def _extract_revenue_usdm(text: str) -> Optional[float]:
    """Extract revenue estimate in USD millions from report text."""
    m = _RX_REVENUE_T.search(text)
    if m:
        return float(m.group(1).replace(",", "")) * 1_000_000

    m = _RX_REVENUE_B.search(text)
    if m:
        return float(m.group(1).replace(",", "")) * 1_000

    m = _RX_REVENUE_M.search(text)
    if m:
        return float(m.group(1).replace(",", ""))

    return None


def _detect_sector(text: str) -> str:
    """Infer primary sector from report text keywords."""
    matches = _RX_SECTOR.findall(text[:5000])
    if not matches:
        return "default"

    keyword = matches[0].lower()

    if any(k in keyword for k in ["oil", "gas", "coal", "energy", "power", "utility", "utilities"]):
        return "energy"
    if any(k in keyword for k in ["mining", "metal", "steel", "cement", "chemical", "material"]):
        return "materials"
    if any(k in keyword for k in ["manufactur", "automotive", "industri", "aerospace"]):
        return "industrials"
    if any(k in keyword for k in ["food", "agriculture", "beverage", "farm"]):
        return "food_agriculture"
    if any(k in keyword for k in ["bank", "financial", "insur", "invest", "asset"]):
        return "financials"
    if any(k in keyword for k in ["tech", "software", "digital", "semiconductor", "cloud"]):
        return "technology"
    if any(k in keyword for k in ["health", "pharma", "hospital", "medical"]):
        return "healthcare"
    if any(k in keyword for k in ["real estate", "construction", "building"]):
        return "real_estate"
    if any(k in keyword for k in ["transport", "logistics", "shipping", "aviation", "rail"]):
        return "transportation"
    if any(k in keyword for k in ["retail", "consumer", "fashion", "apparel", "textile"]):
        return "consumer"

    return "default"


def _extract_scope1_tonnes(data: dict) -> Optional[float]:
    """Extract Scope 1 in tCO2e from extracted data dict."""
    s1 = data.get("scope_1")
    if not s1:
        return None

    value = float(s1["value"])
    unit = s1["unit"].lower()

    if "mt" in unit or "million" in unit:
        return value * 1_000_000
    if "kt" in unit or "thousand" in unit:
        return value * 1_000
    return value


def _fmt(v: float, decimals: int = 1) -> str:
    if v >= 1_000:
        return f"${v/1_000:.{decimals}f}B"
    if v >= 1:
        return f"${v:.{decimals}f}M"
    return f"${v * 1_000:.0f}K"


def _range_mid(low: float, high: float) -> float:
    return (low + high) / 2


# ── Core simulation ────────────────────────────────────────────────────────────

def simulate_financial_exposure(
    data: dict,
    text: str,
    gw_risk_score: int,
    credibility_score: int,
) -> dict:
    """
    Run 6-scenario climate financial simulation.

    Inputs:
      data             — extracted ESG data dict from extract_data()
      text             — raw report text
      gw_risk_score    — 0-100 greenwashing risk score
      credibility_score — 0-100 climate credibility score

    Returns comprehensive financial exposure analysis.
    """
    # Base parameters
    sector_key = _detect_sector(text)
    sector = SECTOR_INTENSITY[sector_key]
    revenue_usdm = _extract_revenue_usdm(text) or 500.0   # default $500M if not found
    scope1_tonnes = _extract_scope1_tonnes(data)

    # Estimate total emissions from scope1 or sector-based proxy
    if scope1_tonnes:
        total_emissions_t = scope1_tonnes
        if data.get("scope_2"):
            # rough estimate: scope2 ≈ 0.6x scope1 for most sectors
            total_emissions_t *= 1.6
        if data.get("scope_3"):
            total_emissions_t *= 4.0  # scope3 typically ~3-5x scope1+2
        else:
            # Estimate scope3 if missing (sector multiplier)
            total_emissions_t *= 2.5
    else:
        # Estimate from sector carbon intensity and revenue
        total_emissions_t = revenue_usdm * sector["carbon_intensity"]

    # Greenwashing risk penalty factor — higher gw risk = more financial exposure
    gw_penalty = 1.0 + (gw_risk_score / 100) * 0.35
    disclosure_gap_factor = 1.0 + ((100 - credibility_score) / 100) * 0.25

    scenario_results = []

    for scenario_id, scenario in SCENARIOS.items():
        carbon_price = scenario["carbon_price_2030"]

        # Carbon tax exposure (annual, near-term)
        carbon_tax_annual = (total_emissions_t * carbon_price) / 1_000_000  # $M

        # Revenue at risk
        rev_risk_pct = (
            sector["fossil_exposure"]
            * scenario["revenue_risk_multiplier"]
            * gw_penalty
            * 0.08  # base 8% revenue at risk rate
        )
        rev_risk_pct = min(0.45, rev_risk_pct)
        revenue_at_risk = revenue_usdm * rev_risk_pct

        # Transition costs (green CAPEX, technology retrofit, compliance)
        transition_cost = (
            revenue_usdm
            * sector["transition_cost_pct"]
            * scenario["transition_cost_multiplier"]
            * disclosure_gap_factor
        )

        # Physical risk costs (asset damage, supply chain disruption, productivity)
        physical_risk = (
            revenue_usdm
            * sector["physical_risk_pct"]
            * scenario["physical_risk_multiplier"]
        )

        # Stranded asset risk (NPV of potentially stranded fossil assets)
        stranded_asset_risk = (
            revenue_usdm
            * sector["stranded_asset_risk"]
            * scenario["stranded_asset_multiplier"]
            * 0.35   # 35% probability-weighted exposure
        )

        # Regulatory penalties (non-disclosure, greenwashing enforcement)
        reg_penalty_base = revenue_usdm * 0.025  # 2.5% base penalty assumption
        regulatory_penalties = (
            reg_penalty_base
            * scenario["regulatory_penalty_multiplier"]
            * gw_penalty
        )

        # Litigation liability
        litigation_base = revenue_usdm * 0.015
        litigation_exposure = (
            litigation_base
            * scenario["litigation_multiplier"]
            * gw_penalty
        )

        # Insurance premium increase (annual impact)
        insurance_base = revenue_usdm * 0.005
        insurance_impact = (
            insurance_base
            * scenario["insurance_multiplier"]
        )

        # Total financial exposure
        total_exposure = (
            revenue_at_risk
            + transition_cost
            + physical_risk
            + stranded_asset_risk
            + regulatory_penalties
            + litigation_exposure
            + insurance_impact
            + carbon_tax_annual
        )

        # EBITDA impact (midpoint of range)
        ebitda_low = abs(scenario["ebitda_impact_range"][0])
        ebitda_high = abs(scenario["ebitda_impact_range"][1])
        ebitda_mid = _range_mid(ebitda_low, ebitda_high)

        # Scale EBITDA impact by sector and GW risk
        ebitda_impact_pct = ebitda_mid * sector["fossil_exposure"] * gw_penalty
        ebitda_impact_pct = min(0.50, ebitda_impact_pct)
        ebitda_impact_usdm = revenue_usdm * ebitda_impact_pct * 0.25  # assume 25% EBITDA margin

        # Valuation impact
        val_low = abs(scenario["valuation_impact_range"][0])
        val_high = abs(scenario["valuation_impact_range"][1])
        val_mid = _range_mid(val_low, val_high)
        val_impact_pct = val_mid * sector["fossil_exposure"] * gw_penalty
        ev_assumed = revenue_usdm * 8  # 8x EV/Revenue multiple assumption
        valuation_impact = ev_assumed * val_impact_pct

        # Risk level for this scenario
        if total_exposure > revenue_usdm * 0.30:
            risk_level = "Critical"
        elif total_exposure > revenue_usdm * 0.15:
            risk_level = "High"
        elif total_exposure > revenue_usdm * 0.07:
            risk_level = "Moderate"
        else:
            risk_level = "Low"

        scenario_results.append({
            "scenario_id": scenario_id,
            "label": scenario["label"],
            "description": scenario["description"],
            "icon": scenario["icon"],
            "color": scenario["color"],
            "horizon": scenario["horizon"],
            "risk_level": risk_level,
            "carbon_price_2030": carbon_price,
            "metrics": {
                "revenue_at_risk_usdm": round(revenue_at_risk, 1),
                "revenue_at_risk_pct": round(rev_risk_pct * 100, 1),
                "carbon_tax_exposure_usdm": round(carbon_tax_annual, 1),
                "transition_cost_usdm": round(transition_cost, 1),
                "physical_risk_cost_usdm": round(physical_risk, 1),
                "stranded_asset_risk_usdm": round(stranded_asset_risk, 1),
                "regulatory_penalty_usdm": round(regulatory_penalties, 1),
                "litigation_exposure_usdm": round(litigation_exposure, 1),
                "insurance_impact_usdm": round(insurance_impact, 1),
                "total_financial_exposure_usdm": round(total_exposure, 1),
                "ebitda_impact_usdm": round(ebitda_impact_usdm, 1),
                "ebitda_impact_pct": round(ebitda_impact_pct * 100, 1),
                "valuation_impact_usdm": round(valuation_impact, 1),
                "valuation_impact_pct": round(val_impact_pct * 100, 1),
            },
            "formatted": {
                "revenue_at_risk": _fmt(revenue_at_risk),
                "carbon_tax_exposure": _fmt(carbon_tax_annual),
                "total_exposure": _fmt(total_exposure),
                "ebitda_impact": _fmt(ebitda_impact_usdm),
                "valuation_impact": _fmt(valuation_impact),
            },
        })

    # Cross-scenario summary
    worst_case = max(scenario_results, key=lambda s: s["metrics"]["total_financial_exposure_usdm"])
    best_case = min(scenario_results, key=lambda s: s["metrics"]["total_financial_exposure_usdm"])

    max_exposure = worst_case["metrics"]["total_financial_exposure_usdm"]
    min_exposure = best_case["metrics"]["total_financial_exposure_usdm"]

    return {
        "sector": sector_key,
        "sector_label": sector["label"],
        "revenue_estimated_usdm": round(revenue_usdm, 1),
        "total_emissions_estimated_t": round(total_emissions_t),
        "gw_risk_penalty_factor": round(gw_penalty, 2),
        "scenarios": scenario_results,
        "summary": {
            "worst_case_scenario": worst_case["label"],
            "worst_case_exposure_usdm": round(max_exposure, 1),
            "worst_case_exposure_formatted": _fmt(max_exposure),
            "best_case_scenario": best_case["label"],
            "best_case_exposure_usdm": round(min_exposure, 1),
            "best_case_exposure_formatted": _fmt(min_exposure),
            "average_exposure_usdm": round(
                sum(s["metrics"]["total_financial_exposure_usdm"] for s in scenario_results) / len(scenario_results), 1
            ),
            "exposure_range_formatted": f"{_fmt(min_exposure)} – {_fmt(max_exposure)}",
            "carbon_liability_note": (
                f"Carbon tax exposure estimated at {total_emissions_t:,.0f} tCO2e "
                f"× carbon price per applicable scenario. Higher greenwashing risk "
                f"and lower credibility amplify financial exposure by "
                f"{round((gw_penalty - 1.0) * 100)}% (GW risk factor)."
            ),
        },
    }
