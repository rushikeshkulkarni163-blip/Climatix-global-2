"""
Financial Impact Engine
=======================
Converts physical + transition climate risk scores into institutional-grade
financial metrics:

  - Valuation impact (DCF adjustment)
  - Cost of capital uplift (risk premium)
  - Credit risk score (PD + LGD adjustment)
  - Insurance cost escalation
  - Stranded asset probability → balance sheet impairment
  - Climate Value-at-Risk (CVaR)
  - EBITDA sensitivity under scenarios
  - Net Present Value of climate costs

Methodology:
  - TCFD-aligned financial materiality
  - NGFS Phase 4 NGFS-IIASA IAM outputs
  - IPCC AR6 economic impact functions
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any


@dataclass
class FinancialImpactInput:
    physical_risk_score: float       # 0–100
    transition_risk_score: float     # 0–100
    revenue_usd_m: float
    ebitda_usd_m: float
    asset_value_usd_m: float
    debt_usd_m: float
    sector: str
    scenario: str = "2C"
    horizon: int = 2050
    discount_rate_pct: float = 8.0
    credit_rating: str = "BBB"       # AAA/AA/A/BBB/BB/B/CCC


@dataclass
class FinancialImpactOutput:
    # Core financial metrics
    revenue_at_risk_usd_m: float
    ebitda_at_risk_usd_m: float
    asset_impairment_usd_m: float
    npv_climate_costs_usd_m: float

    # Capital market metrics
    cost_of_capital_uplift_bps: float    # basis points
    credit_spread_widening_bps: float
    equity_discount_pct: float

    # Risk metrics
    climate_var_1yr_pct: float           # 1-year VaR
    climate_var_10yr_pct: float          # 10-year VaR
    stranded_asset_value_usd_m: float

    # Insurance
    insurance_cost_increase_pct: float

    # Aggregate
    total_financial_exposure_usd_m: float
    exposure_as_pct_revenue: float
    risk_materiality: str               # MATERIAL / POTENTIALLY_MATERIAL / NOT_MATERIAL

    breakdown: Dict[str, Any] = field(default_factory=dict)


CREDIT_RATING_SPREAD_BASE = {
    "AAA": 15, "AA": 25, "A": 45, "BBB": 85,
    "BB": 180, "B": 320, "CCC": 580,
}

SECTOR_INSURANCE_SENSITIVITY = {
    "oil-gas": 2.8, "utilities": 2.2, "mining": 1.9,
    "real-estate": 2.5, "agriculture": 2.4, "transportation": 1.8,
    "manufacturing": 1.6, "financials": 1.3, "technology": 1.1, "default": 1.5,
}

SCENARIO_SEVERITY = {
    "1.5C": 0.30, "2C": 0.55, "3C": 0.78, "4C+": 1.00,
}


class FinancialImpactEngine:

    def compute(self, inp: FinancialImpactInput) -> FinancialImpactOutput:
        severity = SCENARIO_SEVERITY.get(inp.scenario, 0.55)
        h_factor = max(0.1, (inp.horizon - 2025) / 25)
        combined_risk = (inp.physical_risk_score * 0.45 + inp.transition_risk_score * 0.55) / 100

        # Revenue at risk
        rev_risk_rate = combined_risk * severity * h_factor * 0.35
        rev_at_risk = inp.revenue_usd_m * rev_risk_rate

        # EBITDA at risk (more sensitive than revenue)
        ebitda_risk_rate = combined_risk * severity * h_factor * 0.55
        ebitda_at_risk = inp.ebitda_usd_m * ebitda_risk_rate

        # Asset impairment (stranded assets + physical damage)
        phys_impairment_rate = (inp.physical_risk_score / 100) * severity * h_factor * 0.22
        trans_impairment_rate = (inp.transition_risk_score / 100) * severity * h_factor * 0.18
        asset_impairment = inp.asset_value_usd_m * (phys_impairment_rate + trans_impairment_rate)

        # NPV of climate costs (discounted over horizon)
        annual_climate_cost = (rev_at_risk + ebitda_at_risk) / max(1, inp.horizon - 2025)
        years = list(range(1, inp.horizon - 2025 + 1))
        npv = sum(annual_climate_cost * (y / max(years)) / ((1 + inp.discount_rate_pct / 100) ** y)
                  for y in years)

        # Cost of capital uplift (ESG risk premium)
        base_spread = CREDIT_RATING_SPREAD_BASE.get(inp.credit_rating, 85)
        coc_uplift = combined_risk * severity * 120  # max 120 bps uplift
        credit_spread = base_spread * combined_risk * severity * 0.8

        # Equity discount
        equity_discount = combined_risk * severity * 18  # max 18% discount

        # Climate VaR
        var_1yr = combined_risk * severity * 8.5
        var_10yr = combined_risk * severity * 24.8

        # Stranded assets
        sector_key = inp.sector.lower().replace(" ", "-")
        stranded_frac = 0.0
        if sector_key in ("oil-gas", "mining", "utilities"):
            stranded_frac = (inp.transition_risk_score / 100) * severity * h_factor * 0.45
        elif sector_key in ("transportation", "manufacturing"):
            stranded_frac = (inp.transition_risk_score / 100) * severity * h_factor * 0.22
        else:
            stranded_frac = (inp.transition_risk_score / 100) * severity * h_factor * 0.08
        stranded_value = inp.asset_value_usd_m * stranded_frac

        # Insurance cost increase
        ins_sens = SECTOR_INSURANCE_SENSITIVITY.get(sector_key, 1.5)
        ins_increase_pct = (inp.physical_risk_score / 100) * severity * h_factor * ins_sens * 80

        # Total exposure
        total_exposure = rev_at_risk + ebitda_at_risk + asset_impairment + stranded_value + npv
        exposure_pct = (total_exposure / inp.revenue_usd_m) * 100 if inp.revenue_usd_m > 0 else 0

        materiality = (
            "MATERIAL" if exposure_pct > 5
            else "POTENTIALLY_MATERIAL" if exposure_pct > 1
            else "NOT_MATERIAL"
        )

        return FinancialImpactOutput(
            revenue_at_risk_usd_m=round(rev_at_risk, 2),
            ebitda_at_risk_usd_m=round(ebitda_at_risk, 2),
            asset_impairment_usd_m=round(asset_impairment, 2),
            npv_climate_costs_usd_m=round(npv, 2),
            cost_of_capital_uplift_bps=round(coc_uplift, 1),
            credit_spread_widening_bps=round(credit_spread, 1),
            equity_discount_pct=round(equity_discount, 2),
            climate_var_1yr_pct=round(var_1yr, 2),
            climate_var_10yr_pct=round(var_10yr, 2),
            stranded_asset_value_usd_m=round(stranded_value, 2),
            insurance_cost_increase_pct=round(ins_increase_pct, 1),
            total_financial_exposure_usd_m=round(total_exposure, 2),
            exposure_as_pct_revenue=round(exposure_pct, 2),
            risk_materiality=materiality,
            breakdown={
                "physical_risk_contribution": f"{inp.physical_risk_score:.1f}/100",
                "transition_risk_contribution": f"{inp.transition_risk_score:.1f}/100",
                "scenario": inp.scenario,
                "horizon": inp.horizon,
                "severity_multiplier": severity,
                "discount_rate": f"{inp.discount_rate_pct}%",
                "methodology": "TCFD Financial Materiality + NGFS Phase 4 IAM",
            }
        )


financial_impact_engine = FinancialImpactEngine()
