"""
Climactix Intelligence Score (CIS) Engine v1.0
Core scoring methodology for the Climactix Global Climate Risk Intelligence Platform.
Generates institutional-grade climate risk ratings comparable to Moody's, MSCI, and S&P.

Architecture:
  AssessmentInput → 6 Pillar Scorers → Industry Weight Adjustment →
  Verification Engine → Confidence Engine → Greenwashing Detector →
  Financial Impact Translator → Benchmarking Engine → CISReport

Proprietary IP of Climactix Global. All rights reserved.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

from services.industry_ontology import get_industry_config
from services.verification_engine import assess_evidence
from services.benchmarking_engine import benchmark_company


# ── Rating scale (Moody's / S&P style) ───────────────────────────────────────

RATING_BANDS: List[Tuple[float, float, str, str]] = [
    (95, 100, "AAA",  "Climate Intelligence Leader"),
    (90,  94, "AA+",  "Climate Excellence"),
    (85,  89, "AA",   "Advanced Climate Resilience"),
    (80,  84, "AA-",  "Strong Climate Preparedness"),
    (75,  79, "A+",   "Above-Average Climate Readiness"),
    (70,  74, "A",    "Solid Climate Readiness"),
    (65,  69, "A-",   "Adequate Climate Management"),
    (60,  64, "BBB+", "Developing Climate Capabilities"),
    (55,  59, "BBB",  "Baseline Climate Risk"),
    (50,  54, "BBB-", "Moderate Climate Exposure"),
    (45,  49, "BB",   "Elevated Climate Risk"),
    (40,  44, "B",    "High Climate Risk"),
    (30,  39, "CCC",  "Severe Climate Vulnerability"),
    (20,  29, "CC",   "Critical Climate Exposure"),
    (10,  19, "C",    "Near-Default Climate Risk"),
    ( 0,   9, "D",    "Climate Risk Default"),
]


def _assign_rating(score: float) -> Tuple[str, str]:
    for lo, hi, grade, desc in RATING_BANDS:
        if lo <= score <= hi:
            return grade, desc
    return "D", "Climate Risk Default"


# ── Input data models ─────────────────────────────────────────────────────────

@dataclass
class GovernanceInput:
    board_climate_committee: bool     = False
    cco_or_equivalent: bool           = False
    executive_remuneration_linked: bool = False
    board_agenda_frequency: str       = "none"   # quarterly / biannual / annual / none
    climate_strategy_documented: bool = False
    targets_board_approved: bool      = False
    climate_in_enterprise_risk: bool  = False
    external_assurance: bool          = False
    climate_board_training: bool      = False
    climate_opportunity_strategy: bool = False


@dataclass
class PhysicalRiskInput:
    country: str                              = ""
    facility_locations: List[str]             = field(default_factory=list)
    total_facilities: int                     = 1
    coastal_facilities_pct: float             = 0.0   # 0–1
    flood_zone_pct: float                     = 0.0   # fraction of facilities in flood zones
    heat_stress_score: float                  = 0.0   # 0–100 composite
    water_stress_score: float                 = 0.0   # 0–100
    cyclone_exposure: bool                    = False
    wildfire_exposure: bool                   = False
    sea_level_risk: bool                      = False
    supply_chain_geo_concentration: float     = 0.0   # 0–1


@dataclass
class TransitionRiskInput:
    carbon_intensity: float               = 0.0   # tCO2e per $M revenue
    scope1_mtco2e: float                  = 0.0
    scope2_mtco2e: float                  = 0.0
    scope3_mtco2e: float                  = 0.0
    fossil_fuel_pct: float                = 0.0   # 0–100
    net_zero_target_year: Optional[int]   = None
    sbti_aligned: bool                    = False
    carbon_price_exposure_musd: float     = 0.0
    cbam_exposed: bool                    = False
    ets_participation: bool               = False
    stranded_asset_risk_musd: float       = 0.0
    regulatory_jurisdiction: str          = "Global"


@dataclass
class DisclosureInput:
    brsr_completeness: float      = 0.0     # 0–1
    tcfd_status: str              = "missing"   # aligned / partial / missing
    gri_status: str               = "missing"
    sasb_status: str              = "missing"
    issb_status: str              = "missing"
    cdp_response: bool            = False
    third_party_assurance: bool   = False
    data_years_available: int     = 0
    scope_coverage: str           = "limited"   # complete / partial / limited
    restatements_count: int       = 0
    quantified_targets: bool      = False


@dataclass
class ResilienceInput:
    adaptation_plan_documented: bool      = False
    bcm_includes_climate: bool            = False
    climate_capex_pct: float              = 0.0   # % of total CAPEX
    resilience_projects_count: int        = 0
    scenario_analysis_conducted: bool     = False
    supply_chain_resilience_plan: bool    = False
    insurance_climate_coverage: bool      = False
    risk_quantification_methodology: bool = False
    climate_stress_testing: bool          = False


@dataclass
class FinancialMaterialityInput:
    revenue_at_risk_pct: float            = 0.0
    cost_escalation_pct: float            = 0.0
    ebitda_sensitivity_pct: float         = 0.0
    asset_impairment_pct: float           = 0.0
    capex_transition_pct: float           = 0.0
    financial_scenarios_modeled: bool     = False
    climate_in_financial_statements: bool = False
    investor_materiality_disclosed: bool  = False


@dataclass
class EvidenceItem:
    claim_id: str
    claim_text: str
    evidence_type: str       # document / regulatory / third_party / audited / website / self_declared
    evidence_source: str
    verified: bool           = False
    contradictory: bool      = False


@dataclass
class AssessmentInput:
    company_id: str
    company_name: str
    industry: str
    country: str
    fiscal_year: int

    governance:    GovernanceInput           = field(default_factory=GovernanceInput)
    physical_risk: PhysicalRiskInput         = field(default_factory=PhysicalRiskInput)
    transition_risk: TransitionRiskInput     = field(default_factory=TransitionRiskInput)
    disclosure:    DisclosureInput           = field(default_factory=DisclosureInput)
    resilience:    ResilienceInput           = field(default_factory=ResilienceInput)
    financial:     FinancialMaterialityInput = field(default_factory=FinancialMaterialityInput)
    evidence:      List[EvidenceItem]        = field(default_factory=list)


# ── Output models ─────────────────────────────────────────────────────────────

@dataclass
class PillarBreakdown:
    governance: float
    physical_risk: float
    transition_risk: float
    disclosure: float
    resilience: float
    financial_materiality: float


@dataclass
class FinancialImpact:
    revenue_at_risk_pct: float
    ebitda_impact_pct: float
    asset_impairment_pct: float
    capex_transition_pct: float
    scenario_1_5c_impact: float
    scenario_2c_impact: float
    scenario_3c_impact: float
    scenario_4c_impact: float


@dataclass
class MethodologyTrace:
    governance_indicators: Dict
    physical_risk_indicators: Dict
    transition_risk_indicators: Dict
    disclosure_indicators: Dict
    resilience_indicators: Dict
    financial_indicators: Dict
    industry_weights: Dict
    evidence_summary: Dict


@dataclass
class CISReport:
    company_id: str
    company_name: str
    cis_score: float
    rating_grade: str
    rating_description: str

    confidence_score: float
    confidence_level: str
    verification_score: float

    greenwashing_risk: str
    greenwashing_flags: List[str]

    pillars: PillarBreakdown
    financial_impact: FinancialImpact
    benchmark: Dict
    methodology: MethodologyTrace


# ── Pillar 1: Climate Governance (15% default weight) ────────────────────────

def _score_governance(g: GovernanceInput) -> Tuple[float, Dict]:
    trace: Dict = {}

    # Board-level climate accountability (40 pts)
    board  = 15 if g.board_climate_committee else 0
    board += 10 if g.cco_or_equivalent else 0
    board += 15 if g.executive_remuneration_linked else 0
    trace["board_accountability"] = board

    # Climate strategy integration (35 pts)
    strategy  = 10 if g.climate_strategy_documented else 0
    strategy += 10 if g.targets_board_approved else 0
    strategy += 10 if g.climate_in_enterprise_risk else 0
    strategy +=  5 if g.climate_opportunity_strategy else 0
    trace["strategy_integration"] = strategy

    # Board engagement frequency (15 pts)
    freq = {"quarterly": 15, "biannual": 10, "annual": 5, "none": 0}.get(
        g.board_agenda_frequency, 0
    )
    trace["board_frequency"] = freq

    # Assurance & capability (10 pts)
    assurance  = 5 if g.external_assurance else 0
    assurance += 5 if g.climate_board_training else 0
    trace["assurance_capability"] = assurance

    score = _clamp(board + strategy + freq + assurance, 0, 100)
    trace["final_score"] = score
    return score, trace


# ── Pillar 2: Physical Risk Exposure (20% default weight) ────────────────────

def _score_physical_risk(p: PhysicalRiskInput) -> Tuple[float, Dict]:
    """
    Returns exposure score (0–100, higher = more exposed) and its
    CIS contribution (inverted: lower exposure → higher CIS pillar score).
    """
    trace: Dict = {}

    flood   = _clamp(p.flood_zone_pct * 50, 0, 25)
    heat    = _clamp(p.heat_stress_score / 5, 0, 20)
    water   = _clamp(p.water_stress_score / 5, 0, 20)
    coastal = _clamp(p.coastal_facilities_pct * 15, 0, 15)
    if p.sea_level_risk:
        coastal = _clamp(coastal + 5, 0, 15)
    cyclone  = 10 if p.cyclone_exposure else 0
    wildfire =  8 if p.wildfire_exposure else 0
    supply   = _clamp(p.supply_chain_geo_concentration * 10, 0, 10)

    trace.update({
        "flood": round(flood, 1), "heat": round(heat, 1),
        "water": round(water, 1), "coastal_sea_level": round(coastal, 1),
        "cyclone": cyclone, "wildfire": wildfire, "supply_chain": round(supply, 1),
    })

    exposure = _clamp(flood + heat + water + coastal + cyclone + wildfire + supply, 0, 100)
    cis_contribution = 100.0 - exposure
    trace["exposure_score"]   = round(exposure, 1)
    trace["cis_contribution"] = round(cis_contribution, 1)
    return cis_contribution, trace


# ── Pillar 3: Transition Risk Readiness (20% default weight) ─────────────────

def _score_transition_risk(t: TransitionRiskInput) -> Tuple[float, Dict]:
    """
    Returns transition readiness score (0–100). Higher = better prepared.
    Computed as 100 minus accumulated exposure penalties.
    """
    trace: Dict = {}
    exposure = 0.0

    ci_penalty  = _clamp(t.carbon_intensity / 2.0 * 30, 0, 30)
    exposure   += ci_penalty
    trace["carbon_intensity_penalty"] = round(ci_penalty, 1)

    fossil_pen  = (t.fossil_fuel_pct / 100) * 20
    exposure   += fossil_pen
    trace["fossil_dependency_penalty"] = round(fossil_pen, 1)

    nz_pen = 15
    if t.net_zero_target_year:
        if t.sbti_aligned:
            nz_pen = 0
        elif t.net_zero_target_year <= 2040:
            nz_pen = 3
        elif t.net_zero_target_year <= 2050:
            nz_pen = 8
        else:
            nz_pen = 12
    exposure += nz_pen
    trace["net_zero_pathway_penalty"] = nz_pen

    reg_pen  = (8 if t.cbam_exposed else 0) + (7 if t.ets_participation else 0)
    exposure += reg_pen
    trace["regulatory_exposure_penalty"] = reg_pen

    sa_pen   = _clamp(t.stranded_asset_risk_musd / 200, 0, 10)
    exposure += sa_pen
    trace["stranded_asset_penalty"] = round(sa_pen, 1)

    cp_pen   = _clamp(t.carbon_price_exposure_musd / 500, 0, 10)
    exposure += cp_pen
    trace["carbon_price_penalty"] = round(cp_pen, 1)

    total_exposure   = _clamp(exposure, 0, 100)
    cis_contribution = 100.0 - total_exposure
    trace["exposure_score"]   = round(total_exposure, 1)
    trace["cis_contribution"] = round(cis_contribution, 1)
    return cis_contribution, trace


# ── Pillar 4: Disclosure & Data Quality (15% default weight) ─────────────────

def _score_disclosure(d: DisclosureInput) -> Tuple[float, Dict]:
    trace: Dict = {}
    fw_map = {"aligned": 1.0, "partial": 0.5, "missing": 0.0}

    # Framework alignment (0–40)
    fw  = fw_map.get(d.tcfd_status, 0) * 10
    fw += fw_map.get(d.gri_status,  0) * 8
    fw += fw_map.get(d.sasb_status, 0) * 8
    fw += fw_map.get(d.issb_status, 0) * 10
    fw += d.brsr_completeness * 4
    trace["framework_alignment"] = round(fw, 1)

    # Scope & depth (0–30)
    depth  = 15 if d.cdp_response else 0
    depth += {"complete": 10, "partial": 5, "limited": 0}.get(d.scope_coverage, 0)
    depth += _clamp(d.data_years_available * 1.5, 0, 5)
    trace["scope_depth"] = round(depth, 1)

    # Quality & assurance (0–30)
    quality  = 15 if d.third_party_assurance else 0
    quality += 10 if d.quantified_targets else 0
    quality -= _clamp(d.restatements_count * 3, 0, 15)
    quality  = max(quality, 0)
    trace["quality_assurance"] = round(quality, 1)

    score = _clamp(fw + depth + quality, 0, 100)
    trace["final_score"] = score
    return score, trace


# ── Pillar 5: Resilience & Adaptation (15% default weight) ───────────────────

def _score_resilience(r: ResilienceInput) -> Tuple[float, Dict]:
    trace: Dict = {}

    # Planning & scenario work (0–40)
    plan  = 15 if r.adaptation_plan_documented else 0
    plan += 10 if r.bcm_includes_climate else 0
    plan += 10 if r.scenario_analysis_conducted else 0
    plan +=  5 if r.climate_stress_testing else 0
    trace["planning"] = plan

    # Investment allocation (0–35)
    capex    = _clamp(r.climate_capex_pct * 3.5, 0, 20)
    projects = _clamp(r.resilience_projects_count * 3, 0, 15)
    trace["investment"] = round(capex + projects, 1)

    # Coverage breadth (0–25)
    coverage  = 10 if r.supply_chain_resilience_plan else 0
    coverage += 10 if r.insurance_climate_coverage else 0
    coverage +=  5 if r.risk_quantification_methodology else 0
    trace["coverage"] = coverage

    score = _clamp(plan + capex + projects + coverage, 0, 100)
    trace["final_score"] = score
    return score, trace


# ── Pillar 6: Financial Materiality (15% default weight) ─────────────────────

def _score_financial_materiality(f: FinancialMaterialityInput) -> Tuple[float, Dict]:
    """
    Measures quality of financial risk management and quantification.
    Raw exposure feeds into the financial impact report, not directly into CIS.
    """
    trace: Dict = {}

    # Composite exposure signal (for penalty calculation only)
    raw_exposure = (
        f.revenue_at_risk_pct     * 0.35 +
        f.ebitda_sensitivity_pct  * 0.30 +
        f.asset_impairment_pct    * 0.20 +
        f.cost_escalation_pct     * 0.15
    )
    trace["composite_exposure"] = round(raw_exposure, 1)

    # Management quality (0–85)
    mgmt  = 35 if f.financial_scenarios_modeled else 0
    mgmt += 30 if f.climate_in_financial_statements else 0
    mgmt += 20 if f.investor_materiality_disclosed else 0

    # Penalty for high unmanaged exposure
    exposure_penalty = _clamp(raw_exposure / 2, 0, 15)
    mgmt = max(mgmt - exposure_penalty, 0)
    trace["management_quality"] = round(mgmt, 1)

    # Quantification base credit
    q_base = 15 if (f.revenue_at_risk_pct > 0 or f.ebitda_sensitivity_pct > 0
                    or f.asset_impairment_pct > 0) else 0
    trace["quantification_credit"] = q_base

    score = _clamp(mgmt + q_base, 0, 100)
    trace["final_score"] = score
    return score, trace


# ── Confidence engine ─────────────────────────────────────────────────────────

def _calculate_confidence(inp: AssessmentInput, verification_score: float) -> Tuple[float, str]:
    completeness_checks = [
        inp.governance.board_climate_committee is not None,
        inp.governance.climate_strategy_documented is not None,
        inp.physical_risk.country != "",
        inp.transition_risk.carbon_intensity > 0 or inp.transition_risk.scope1_mtco2e > 0,
        inp.disclosure.brsr_completeness > 0 or inp.disclosure.tcfd_status != "missing",
        inp.resilience.adaptation_plan_documented is not None,
        inp.financial.financial_scenarios_modeled is not None,
    ]
    completeness = sum(completeness_checks) / len(completeness_checks) * 40

    ev_component = verification_score / 100 * 35

    consistency  = 10 if inp.disclosure.data_years_available >= 3 else 0
    consistency += 10 if inp.disclosure.third_party_assurance else 0
    consistency +=  5 if inp.disclosure.restatements_count == 0 else 0
    consistency  = min(consistency, 25)

    score = _clamp(completeness + ev_component + consistency, 0, 100)
    if   score >= 90: level = "Very High"
    elif score >= 80: level = "High"
    elif score >= 65: level = "Moderate"
    elif score >= 50: level = "Low"
    else:             level = "Insufficient"
    return round(score, 1), level


# ── Greenwashing detector ─────────────────────────────────────────────────────

_GW_RISK_LABELS = {0: "Low", 1: "Low", 2: "Moderate", 3: "Elevated", 4: "High"}

def _detect_greenwashing(inp: AssessmentInput) -> Tuple[str, List[str]]:
    flags: List[str] = []
    t, d, r, f = inp.transition_risk, inp.disclosure, inp.resilience, inp.financial

    total_scope = t.scope1_mtco2e + t.scope2_mtco2e + t.scope3_mtco2e

    if t.net_zero_target_year and not t.sbti_aligned and t.fossil_fuel_pct > 60:
        flags.append(
            f"Net-zero target {t.net_zero_target_year} declared with "
            f"{t.fossil_fuel_pct:.0f}% fossil dependency and no SBTi pathway alignment"
        )

    if t.net_zero_target_year and d.brsr_completeness < 0.5:
        flags.append("Climate targets declared but core BRSR disclosure <50% complete")

    if total_scope > 10.0 and not d.third_party_assurance:
        flags.append(
            f"Total emissions {total_scope:.1f} MtCO2e with no third-party assurance"
        )

    if f.revenue_at_risk_pct > 15 and not f.climate_in_financial_statements:
        flags.append(
            f"Revenue-at-risk estimated at {f.revenue_at_risk_pct:.1f}% "
            "but climate risk absent from financial statements"
        )

    if t.net_zero_target_year and r.climate_capex_pct < 1.0 and t.fossil_fuel_pct < 30:
        flags.append(
            "Clean energy targets declared with <1% CAPEX allocated to climate investments"
        )

    if inp.industry in {"banking", "insurance", "oil_gas"} and not r.scenario_analysis_conducted:
        flags.append(
            f"Sector ({inp.industry}) requires ISSB S2 scenario analysis — none conducted or disclosed"
        )

    if total_scope > 5.0 and not d.cdp_response:
        flags.append("Material emitter with no CDP disclosure response")

    if d.tcfd_status == "missing" and d.issb_status == "missing":
        flags.append(
            "No TCFD or ISSB S2 alignment — climate risk undisclosed under any international framework"
        )

    risk = _GW_RISK_LABELS.get(len(flags), "Critical")
    return risk, flags


# ── Financial impact translator ───────────────────────────────────────────────

# NGFS-derived scenario revenue-impact multipliers
_SCENARIO_MULTIPLIERS = {"1_5c": 0.85, "2c": 1.00, "3c": 1.45, "4c": 2.10}

def _build_financial_impact(f: FinancialMaterialityInput) -> FinancialImpact:
    base = f.revenue_at_risk_pct
    return FinancialImpact(
        revenue_at_risk_pct   = base,
        ebitda_impact_pct     = f.ebitda_sensitivity_pct,
        asset_impairment_pct  = f.asset_impairment_pct,
        capex_transition_pct  = f.capex_transition_pct,
        scenario_1_5c_impact  = round(base * _SCENARIO_MULTIPLIERS["1_5c"], 1),
        scenario_2c_impact    = round(base * _SCENARIO_MULTIPLIERS["2c"],   1),
        scenario_3c_impact    = round(base * _SCENARIO_MULTIPLIERS["3c"],   1),
        scenario_4c_impact    = round(base * _SCENARIO_MULTIPLIERS["4c"],   1),
    )


# ── Master entry point ────────────────────────────────────────────────────────

def generate_cis_report(inp: AssessmentInput) -> CISReport:
    """
    Primary entry point. Accepts a fully populated AssessmentInput and returns
    a complete CISReport — auditable, explainable, benchmark-referenced.
    """
    industry_cfg = get_industry_config(inp.industry)
    w = industry_cfg.pillar_weights

    gov_score,  gov_trace  = _score_governance(inp.governance)
    phys_score, phys_trace = _score_physical_risk(inp.physical_risk)
    tran_score, tran_trace = _score_transition_risk(inp.transition_risk)
    disc_score, disc_trace = _score_disclosure(inp.disclosure)
    res_score,  res_trace  = _score_resilience(inp.resilience)
    fin_score,  fin_trace  = _score_financial_materiality(inp.financial)

    cis_raw = (
        gov_score  * w["governance"] +
        phys_score * w["physical_risk"] +
        tran_score * w["transition_risk"] +
        disc_score * w["disclosure"] +
        res_score  * w["resilience"] +
        fin_score  * w["financial_materiality"]
    )
    cis_score = _clamp(round(cis_raw, 1), 0, 100)
    grade, description = _assign_rating(cis_score)

    ev_result = assess_evidence(inp.evidence)
    confidence_score, confidence_level = _calculate_confidence(inp, ev_result.verification_score)
    gw_risk, gw_flags = _detect_greenwashing(inp)
    fin_impact = _build_financial_impact(inp.financial)

    bm = benchmark_company(
        industry=inp.industry,
        country=inp.country,
        cis_score=cis_score,
        pillar_scores={
            "governance":           gov_score,
            "physical_risk":        phys_score,
            "transition_risk":      tran_score,
            "disclosure":           disc_score,
            "resilience":           res_score,
            "financial_materiality": fin_score,
        },
    )

    return CISReport(
        company_id=inp.company_id,
        company_name=inp.company_name,
        cis_score=cis_score,
        rating_grade=grade,
        rating_description=description,
        confidence_score=confidence_score,
        confidence_level=confidence_level,
        verification_score=round(ev_result.verification_score, 1),
        greenwashing_risk=gw_risk,
        greenwashing_flags=gw_flags,
        pillars=PillarBreakdown(
            governance=gov_score, physical_risk=phys_score,
            transition_risk=tran_score, disclosure=disc_score,
            resilience=res_score, financial_materiality=fin_score,
        ),
        financial_impact=fin_impact,
        benchmark=bm,
        methodology=MethodologyTrace(
            governance_indicators=gov_trace,
            physical_risk_indicators=phys_trace,
            transition_risk_indicators=tran_trace,
            disclosure_indicators=disc_trace,
            resilience_indicators=res_trace,
            financial_indicators=fin_trace,
            industry_weights=w,
            evidence_summary=ev_result.__dict__,
        ),
    )


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))
