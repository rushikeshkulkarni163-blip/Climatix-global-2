"""
Financial Translation Layer — converts physical + transition risk scores
into quantified financial impact metrics (TCFD-aligned).

Outputs per asset:
  • Revenue at Risk %          — income exposed to climate disruption
  • EBITDA Impact %            — margin compression from opex + compliance costs
  • Capex Increase %           — adaptation + decarbonisation investment required
  • Opex Increase %            — energy, insurance, logistics cost escalation
  • Asset Impairment %         — book value reduction (stranded risk + physical damage)
  • Supply Chain Disruption %  — upstream/downstream exposure
  • Compliance Cost $/tCO₂    — effective carbon obligation per unit
  • Stranded Asset Probability — 0–1 probability of economically stranded asset by year
"""
from ..models.schemas import (
    FinancialImpact,
    PhysicalRiskScores,
    TransitionRiskScores,
    CountryMacroData,
    Sector,
    ScenarioId,
)
from .risk_engine import get_carbon_price, NGFS

# ── Sector revenue sensitivity to climate risk ─────────────────────────────
# Values represent fraction of revenue exposed per unit of risk index (0-100)
REVENUE_SENSITIVITY: dict = {
    Sector.ENERGY:        {"physical": 0.18, "transition": 0.22, "supply": 0.08},
    Sector.MANUFACTURING: {"physical": 0.14, "transition": 0.12, "supply": 0.15},
    Sector.LOGISTICS:     {"physical": 0.20, "transition": 0.10, "supply": 0.12},
    Sector.FINANCE:       {"physical": 0.06, "transition": 0.16, "supply": 0.04},
    Sector.MINING:        {"physical": 0.22, "transition": 0.18, "supply": 0.09},
    Sector.TECHNOLOGY:    {"physical": 0.08, "transition": 0.07, "supply": 0.11},
    Sector.AGRICULTURE:   {"physical": 0.32, "transition": 0.06, "supply": 0.18},
    Sector.SHIPPING:      {"physical": 0.16, "transition": 0.14, "supply": 0.20},
    Sector.REAL_ESTATE:   {"physical": 0.12, "transition": 0.09, "supply": 0.05},
}

# Carbon intensity (tCO₂ per $M revenue) by sector — used for compliance cost calc
CARBON_INTENSITY: dict = {
    Sector.ENERGY:        450,
    Sector.MINING:        350,
    Sector.MANUFACTURING: 220,
    Sector.SHIPPING:      180,
    Sector.AGRICULTURE:   130,
    Sector.LOGISTICS:     110,
    Sector.REAL_ESTATE:    80,
    Sector.TECHNOLOGY:     50,
    Sector.FINANCE:        40,
}

# Capex adaptation multiplier by scenario (% of current capex required as incremental spend)
CAPEX_MULT: dict = {
    ScenarioId.NET_ZERO: 0.24,  # aggressive invest in low-carbon transition
    ScenarioId.DELAYED:  0.15,  # moderate, but concentrated in later period
    ScenarioId.CURRENT:  0.07,  # low now, large physical damage costs later
}

# Stranded asset threshold: composite risk score above which stranding is probable
STRANDED_THRESHOLD: dict = {
    Sector.ENERGY:        62,
    Sector.MINING:        58,
    Sector.MANUFACTURING: 52,
    Sector.SHIPPING:      50,
    Sector.LOGISTICS:     48,
    Sector.REAL_ESTATE:   44,
    Sector.FINANCE:       36,
    Sector.AGRICULTURE:   40,
    Sector.TECHNOLOGY:    32,
}


def compute_financial_impact(
    physical: PhysicalRiskScores,
    transition: TransitionRiskScores,
    sector: Sector,
    scenario: ScenarioId,
    year: int,
    country_macro: CountryMacroData,
    asset_value_usd: float | None = None,
    annual_revenue_usd: float | None = None,
) -> FinancialImpact:

    sens = REVENUE_SENSITIVITY.get(sector, {"physical": 0.12, "transition": 0.12, "supply": 0.08})
    cp   = get_carbon_price(scenario, year)
    ci   = CARBON_INTENSITY.get(sector, 150)   # tCO₂ per $M revenue

    # ── Revenue at Risk ──────────────────────────────────────────────────────
    rar_phys  = (physical.composite   / 100) * sens["physical"]
    rar_trans = (transition.composite / 100) * sens["transition"]
    rar_pct   = min(48.0, (rar_phys + rar_trans) * 100)

    # ── Supply chain disruption ──────────────────────────────────────────────
    sc_pct = min(25.0, (physical.composite / 100) * sens["supply"] * 100)

    # ── EBITDA impact ────────────────────────────────────────────────────────
    # Operating cost escalation from carbon, insurance, energy
    carbon_opex_pct = min(12.0, cp * ci / 1_000_000 * 100)  # % of revenue
    insurance_inc   = physical.composite / 100 * 4.5         # % points
    ebitda_pct      = min(35.0, rar_pct * 0.55 + carbon_opex_pct + insurance_inc)

    # ── Compliance cost ──────────────────────────────────────────────────────
    compliance_usd_tonne = cp  # direct carbon price pass-through

    # ── Capex increase ───────────────────────────────────────────────────────
    capex_base = CAPEX_MULT.get(scenario, 0.15)
    risk_load  = (physical.composite + transition.composite) / 200
    capex_pct  = min(42.0, capex_base * risk_load * 100 * 2)

    # ── Opex increase ────────────────────────────────────────────────────────
    energy_cost_inc  = transition.carbon_cost / 100 * 8.0   # % opex
    logistics_inc    = physical.flood_risk    / 100 * 5.5
    insurance_pct    = physical.composite     / 100 * 4.0
    opex_pct         = min(30.0, energy_cost_inc + logistics_inc + insurance_pct)

    # ── Asset impairment ─────────────────────────────────────────────────────
    # Present value of future cash-flow risk + structural damage
    impairment_pct = min(45.0, (physical.composite * 0.38 + transition.composite * 0.32) / 100 * 60)

    # ── Stranded asset probability ────────────────────────────────────────────
    threshold  = STRANDED_THRESHOLD.get(sector, 50)
    composite  = physical.composite * 0.5 + transition.composite * 0.5
    if composite <= threshold:
        stranded_prob = 0.0
    elif composite >= 95:
        stranded_prob = 0.92
    else:
        stranded_prob = (composite - threshold) / (100 - threshold) * 0.90

    # Country macro adjustments ───────────────────────────────────────────────
    if country_macro.gdp_growth_pct is not None and country_macro.gdp_growth_pct < -1:
        # Recession amplifies revenue risk
        rar_pct = min(48, rar_pct * 1.12)
    if country_macro.renewable_energy_pct is not None and country_macro.renewable_energy_pct > 40:
        # High renewable penetration reduces transition risk
        transition_discount = 1 - (country_macro.renewable_energy_pct - 40) / 300
        capex_pct  *= transition_discount
        carbon_opex_pct *= transition_discount

    # Absolute USD exposure ───────────────────────────────────────────────────
    rar_usd = (annual_revenue_usd * rar_pct / 100) if annual_revenue_usd else None

    return FinancialImpact(
        revenue_at_risk_pct=round(rar_pct, 2),
        revenue_at_risk_usd=round(rar_usd, 0) if rar_usd else None,
        ebitda_impact_pct=round(ebitda_pct, 2),
        capex_increase_pct=round(capex_pct, 2),
        opex_increase_pct=round(opex_pct, 2),
        asset_impairment_pct=round(impairment_pct, 2),
        supply_chain_disruption_pct=round(sc_pct, 2),
        compliance_cost_usd_tonne=round(compliance_usd_tonne, 2),
        stranded_asset_probability=round(stranded_prob, 3),
    )
