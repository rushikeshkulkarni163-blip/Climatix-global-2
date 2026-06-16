"""
Climactix — Climate Credibility Intelligence Engine
====================================================
Institutional-grade orchestration engine for greenwashing detection and
climate credibility scoring. Coordinates all detection modules and produces
a comprehensive institutional risk assessment.

Architecture:
  8 Detection Modules (deterministic + LLM-enhanced):
    1. Narrative Inflation Detector
    2. Future-Washing Detector
    3. Carbon Reality Gap Detector
    4. CAPEX Misalignment Detector
    5. Supply Chain Contradiction Detector
    6. Scope 3 Omission Detector
    7. Offset Dependency Risk Detector
    8. Regulatory Misalignment Detector

  7-Dimension Climate Credibility Score:
    - Emission Integrity       (25%)
    - Narrative Credibility    (20%)
    - Disclosure Transparency  (15%)
    - CAPEX Alignment          (15%)
    - Regulatory Alignment     (10%)
    - Supply Chain Integrity   (10%)
    - Transition Plan Credibility (5%)

  Outputs:
    - Greenwashing Risk Score    (0–100, higher = more risk)
    - Climate Credibility Score  (0–100, higher = more credible)
    - Institutional Risk Rating  (AAA → CCC)
    - Greenwashing Risk Level    (Credible | Moderate | High | Severe)
"""

from __future__ import annotations

import json
import os
import re
from typing import Optional

from openai import OpenAI

from services.greenwashing_scanner import (
    extract_claims,
    extract_data,
    validate_claims,
    map_frameworks,
    compute_risk_score,
    generate_recommendations,
)
from services.contradiction_detector import detect_contradictions
from services.esg_framework_intelligence import run_intelligence_analysis

MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")

_client: Optional[OpenAI] = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY not set.")
        _client = OpenAI(api_key=api_key)
    return _client


def _parse_json(raw: str) -> dict:
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        if m:
            return json.loads(m.group())
        raise


# ══════════════════════════════════════════════════════════════════════════════
# DETECTION MODULES
# ══════════════════════════════════════════════════════════════════════════════

# Signal patterns
_RX_VAGUE_TERMS = re.compile(
    r"\b(?:committed to|striving to|working towards|aspiring|aiming|endeavour"
    r"|on track|journey|holistic|sustainable future|greener tomorrow|planet-positive"
    r"|eco-friendly|environmentally conscious|responsible growth)\b",
    re.IGNORECASE,
)
_RX_QUANTIFIED = re.compile(
    r"\d+\.?\d*\s*(?:%|percent|tco2e|ktco2e|mtco2e|gwh|mwh|tj|million\s+tonnes?)",
    re.IGNORECASE,
)
_RX_NET_ZERO_2050 = re.compile(r"net[\s\-]zero\s+(?:by\s+)?20[45]\d", re.IGNORECASE)
_RX_INTERIM = re.compile(
    r"(?:2025|2027|2030)\s+(?:target|goal|milestone|reduction|commitment|net)",
    re.IGNORECASE
)
_RX_CAPEX_GREEN = re.compile(
    r"(?:green|clean|sustainable|renewable|low[\s\-]carbon)\s+(?:capex|investment"
    r"|capital\s+expenditure)|capex\s+(?:in|for|allocated\s+to)\s+(?:green|clean"
    r"|renewable|sustainable)", re.IGNORECASE,
)
_RX_CAPEX_FOSSIL = re.compile(
    r"(?:oil|gas|coal|fossil|upstream|lng|refinery)\s+(?:capex|investment"
    r"|capital\s+expenditure)|capex\s+(?:in|for)\s+(?:oil|gas|coal|fossil)",
    re.IGNORECASE,
)
_RX_OFFSET_RELIANCE = re.compile(
    r"carbon\s+offset|offset\s+(?:credit|purchase|scheme)|voluntary\s+carbon\s+market"
    r"|carbon\s+credit|redd\+|nature[\s\-]based\s+(?:solution|offset)",
    re.IGNORECASE,
)
_RX_RESIDUAL_OFFSET = re.compile(
    r"residual\s+emission|unavoidable\s+emission|hard[\s\-]to[\s\-]abate",
    re.IGNORECASE,
)
_RX_EU_TAXONOMY = re.compile(
    r"eu\s+taxonomy|taxonomy[\s\-]aligned|article\s+8|article\s+9|sfdr"
    r"|csrd|esrs|non[\s\-]financial\s+reporting", re.IGNORECASE,
)
_RX_SEC_CLIMATE = re.compile(
    r"sec\s+climate|climate\s+disclosure\s+rule|sec\s+rule|10[\s\-]k\s+climate",
    re.IGNORECASE,
)
_RX_TCFD_REF = re.compile(r"\btcfd\b", re.IGNORECASE)
_RX_SBTI = re.compile(
    r"\bsbti\b|science\s+based\s+targets?\s+initiative|1\.5[°℃\s]?c\s+aligned",
    re.IGNORECASE,
)
_RX_EMISSION_REDUCTION = re.compile(
    r"reduc(?:ed?|tion|ing)\s+(?:emission|carbon|ghg|scope\s*[123])\s+(?:by\s+)?"
    r"([\d\.]+)\s*(?:%|percent)",
    re.IGNORECASE,
)
_RX_SUPPLIER_SCOPE3 = re.compile(
    r"supplier\s+(?:esg|emission|carbon|ghg|scope\s*3)|scope\s*3\s+(?:category\s+[12]"
    r"|purchased\s+goods|supply\s+chain)",
    re.IGNORECASE,
)


def _mod(name: str, score: int, status: str, signals: list[str], risk: str, weight: float) -> dict:
    """Create a standardised detection module result."""
    return {
        "module": name,
        "score": score,
        "status": status,
        "risk_level": risk,
        "signals_detected": signals,
        "weight": weight,
        "weighted_risk": round(score * weight, 1),
    }


def _run_narrative_inflation(claims: list, text: str) -> dict:
    """Detect marketing inflation: vague language vs quantified substantiation."""
    vague_matches = _RX_VAGUE_TERMS.findall(text)
    quant_matches = _RX_QUANTIFIED.findall(text)
    total_claims = len(claims)
    unsupported = sum(1 for c in claims if not c.get("has_supporting_data"))

    vague_count = len(vague_matches)
    quant_count = len(quant_matches)

    ratio = vague_count / max(quant_count, 1)

    if ratio >= 4:
        score, status, risk = 85, "HIGH_INFLATION", "High"
    elif ratio >= 2:
        score, status, risk = 60, "MODERATE_INFLATION", "Medium"
    elif ratio >= 1:
        score, status, risk = 35, "LOW_INFLATION", "Low"
    else:
        score, status, risk = 15, "CLEAN", "Minimal"

    # Penalty for high unsupported claim ratio
    if total_claims > 0 and (unsupported / total_claims) > 0.6:
        score = min(100, score + 15)

    signals = []
    if vague_count > 5:
        signals.append(f"{vague_count} vague sustainability marketing terms detected")
    if quant_count < 3:
        signals.append(f"Only {quant_count} quantified metrics found")
    if unsupported > 2:
        signals.append(f"{unsupported}/{total_claims} claims lack supporting data")

    return _mod("NARRATIVE_INFLATION", score, status, signals, risk, 0.15)


def _run_future_washing(data: dict, text: str) -> dict:
    """Detect future-washing: long-term targets without near-term accountability."""
    has_2050 = bool(_RX_NET_ZERO_2050.search(text))
    has_interim = bool(_RX_INTERIM.search(text))
    has_transition = data.get("transition_pathway_present", False)
    net_zero_year = data.get("net_zero_target_year")

    if has_2050 and not has_interim and not has_transition:
        score, status, risk = 88, "SEVERE_FUTURE_WASHING", "Critical"
    elif has_2050 and (has_interim or has_transition):
        score, status, risk = 35, "CREDIBLE_PATHWAY", "Low"
    elif net_zero_year and net_zero_year > 2045 and not has_interim:
        score, status, risk = 70, "FUTURE_WASHING", "High"
    else:
        score, status, risk = 20, "ACCEPTABLE", "Low"

    signals = []
    if has_2050 and not has_interim:
        signals.append("2050 net-zero target without 2030 interim milestone")
    if not has_transition:
        signals.append("No transition plan or decarbonisation roadmap disclosed")
    if net_zero_year and net_zero_year > 2045:
        signals.append(f"Target year {net_zero_year} is beyond credible accountability horizon")

    return _mod("FUTURE_WASHING", score, status, signals, risk, 0.15)


def _run_carbon_reality_gap(data: dict, claims: list, text: str) -> dict:
    """Detect gap between carbon reduction claims and actual data trajectory."""
    has_scope1 = data.get("scope_1") is not None
    has_scope2 = data.get("scope_2") is not None
    has_scope3 = data.get("scope_3") is not None
    has_baseline = data.get("baseline_year") is not None
    has_reduction_claimed = data.get("emission_reduction_stated", False)
    has_assurance = data.get("third_party_assurance", False)

    reduction_matches = _RX_EMISSION_REDUCTION.findall(text)
    net_zero_claims = [c for c in claims if c.get("type") in ("net_zero", "carbon_neutral")]

    score = 0
    signals = []

    if net_zero_claims and not has_scope1:
        score += 30
        signals.append("Net-zero claim without Scope 1 quantification")

    if has_reduction_claimed and not has_baseline:
        score += 25
        signals.append("Reduction claim without baseline year — unverifiable")

    if not has_scope3 and net_zero_claims:
        score += 20
        signals.append("Net-zero claim excludes Scope 3 value chain emissions")

    if not has_assurance and (has_scope1 or has_scope2):
        score += 15
        signals.append("Emissions data not independently assured")

    if not has_scope2 and has_scope1:
        score += 10
        signals.append("Scope 2 (energy indirect) emissions absent")

    score = min(100, score)

    if score >= 70:
        status, risk = "CRITICAL_GAP", "Critical"
    elif score >= 45:
        status, risk = "SIGNIFICANT_GAP", "High"
    elif score >= 20:
        status, risk = "MODERATE_GAP", "Medium"
    else:
        status, risk = "MINIMAL_GAP", "Low"

    return _mod("CARBON_REALITY_GAP", score, status, signals, risk, 0.20)


def _run_capex_misalignment(text: str) -> dict:
    """Detect misalignment between green narrative and capital allocation."""
    has_green_capex = bool(_RX_CAPEX_GREEN.search(text))
    has_fossil_capex = bool(_RX_CAPEX_FOSSIL.search(text))

    if has_fossil_capex and not has_green_capex:
        score, status, risk = 90, "CRITICAL_MISALIGNMENT", "Critical"
        signals = [
            "Fossil fuel CAPEX disclosed without green/clean CAPEX counterpart",
            "Financial commitments contradict stated climate strategy",
        ]
    elif has_fossil_capex and has_green_capex:
        score, status, risk = 45, "PARTIAL_ALIGNMENT", "Medium"
        signals = ["Both fossil and green CAPEX present — ratio analysis required"]
    elif has_green_capex and not has_fossil_capex:
        score, status, risk = 15, "ALIGNED", "Low"
        signals = ["Green CAPEX allocation disclosed"]
    else:
        score, status, risk = 55, "NO_CAPEX_DATA", "Medium"
        signals = ["No CAPEX allocation data disclosed — transparency gap"]

    return _mod("CAPEX_MISALIGNMENT", score, status, signals, risk, 0.15)


def _run_supply_chain_contradictions(data: dict, claims: list, text: str) -> dict:
    """Detect supply chain sustainability claims without supporting supplier data."""
    has_supplier_scope3 = bool(_RX_SUPPLIER_SCOPE3.search(text))
    has_scope3 = data.get("scope_3") is not None

    sustain_supply_claims = [
        c for c in claims
        if c.get("type") in ("supply_chain",)
        or "supply chain" in c.get("claim", "").lower()
    ]

    score = 0
    signals = []

    if sustain_supply_claims and not has_supplier_scope3:
        score += 40
        signals.append(f"{len(sustain_supply_claims)} supply chain claim(s) without supplier data")

    if not has_scope3:
        score += 35
        signals.append("Scope 3 (supply chain) emissions not quantified")

    if sustain_supply_claims and not has_scope3:
        score += 25
        signals.append("Supply chain sustainability claimed but Scope 3 absent — structurally contradictory")

    score = min(100, score)

    if score >= 70:
        status, risk = "CRITICAL_CONTRADICTION", "Critical"
    elif score >= 40:
        status, risk = "SIGNIFICANT_RISK", "High"
    elif score >= 20:
        status, risk = "MODERATE_RISK", "Medium"
    else:
        status, risk = "LOW_RISK", "Low"

    return _mod("SUPPLY_CHAIN_CONTRADICTIONS", score, status, signals, risk, 0.10)


def _run_scope3_omission(data: dict, claims: list, text: str) -> dict:
    """Detect Scope 3 omission risk relative to stated ambition level."""
    has_scope3 = data.get("scope_3") is not None
    has_scope1 = data.get("scope_1") is not None
    has_net_zero = bool(re.search(r"net[\s\-]zero|carbon[\s\-]neutral", text, re.IGNORECASE))
    is_large_org = data.get("is_large_org_signals", False)

    if has_net_zero and not has_scope3:
        score, status, risk = 88, "CRITICAL_OMISSION", "Critical"
        signals = [
            "Net-zero claim structurally incomplete without Scope 3 coverage",
            "Value chain emissions (typically >70% of total) unaccounted",
        ]
    elif has_scope1 and not has_scope3 and is_large_org:
        score, status, risk = 65, "HIGH_OMISSION_RISK", "High"
        signals = ["Large organisation — Scope 3 omission is material disclosure gap"]
    elif has_scope1 and not has_scope3:
        score, status, risk = 45, "MODERATE_OMISSION", "Medium"
        signals = ["Scope 1/2 reported but Scope 3 absent — partial disclosure"]
    elif has_scope3:
        score, status, risk = 10, "COMPLETE", "Low"
        signals = ["Scope 3 emissions disclosed"]
    else:
        score, status, risk = 60, "NO_EMISSIONS_DATA", "High"
        signals = ["No emissions data detected — full scope omission"]

    return _mod("SCOPE3_OMISSION", score, status, signals, risk, 0.10)


def _run_offset_dependency(data: dict, text: str) -> dict:
    """Detect over-reliance on carbon offsets vs genuine operational decarbonization."""
    has_offsets = bool(_RX_OFFSET_RELIANCE.search(text))
    has_residual_context = bool(_RX_RESIDUAL_OFFSET.search(text))
    has_net_zero = bool(re.search(r"net[\s\-]zero|carbon[\s\-]neutral", text, re.IGNORECASE))

    if has_offsets and has_net_zero and not has_residual_context:
        score, status, risk = 80, "HIGH_DEPENDENCY", "High"
        signals = [
            "Offsets used to achieve net-zero without restricting to residual emissions",
            "No 'hard-to-abate' or 'residual emissions' context — offset-as-substitute risk",
        ]
    elif has_offsets and has_residual_context:
        score, status, risk = 25, "ACCEPTABLE_USE", "Low"
        signals = ["Offsets referenced in residual emissions context — credible use case"]
    elif has_offsets:
        score, status, risk = 50, "MODERATE_DEPENDENCY", "Medium"
        signals = ["Carbon offset usage detected — dependency level unclear"]
    else:
        score, status, risk = 10, "NO_OFFSET_DEPENDENCY", "Minimal"
        signals = ["No carbon offset dependency detected"]

    return _mod("OFFSET_DEPENDENCY_RISK", score, status, signals, risk, 0.10)


def _run_regulatory_misalignment(data: dict, text: str) -> dict:
    """Detect misalignment with major climate disclosure regulations."""
    has_tcfd = bool(_RX_TCFD_REF.search(text))
    has_eu = bool(_RX_EU_TAXONOMY.search(text))
    has_sec = bool(_RX_SEC_CLIMATE.search(text))
    has_sbti = bool(_RX_SBTI.search(text))
    has_transition = data.get("transition_pathway_present", False)
    has_assurance = data.get("third_party_assurance", False)
    has_scope3 = data.get("scope_3") is not None

    score = 0
    signals = []

    if not has_tcfd:
        score += 20
        signals.append("No TCFD alignment disclosed — mandatory in UK, NZ, Singapore, Japan")

    if not has_scope3:
        score += 20
        signals.append("Scope 3 absent — required under ISSB S2, CSRD ESRS E1-6")

    if not has_transition:
        score += 20
        signals.append("No transition plan — required under TCFD, ISSB S2, UK TPT")

    if not has_assurance:
        score += 15
        signals.append("No external assurance — required under EU CSRD from 2025")

    if not has_sbti:
        score += 15
        signals.append("No SBTi alignment — expected by NZAM, GFANZ, institutional investors")

    if not has_eu and not has_sec:
        score += 10
        signals.append("No reference to EU Taxonomy or SEC Climate Rule compliance")

    score = min(100, score)

    if score >= 70:
        status, risk = "CRITICAL_MISALIGNMENT", "Critical"
    elif score >= 45:
        status, risk = "HIGH_MISALIGNMENT", "High"
    elif score >= 25:
        status, risk = "MODERATE_MISALIGNMENT", "Medium"
    else:
        status, risk = "ALIGNED", "Low"

    return _mod("REGULATORY_MISALIGNMENT", score, status, signals, risk, 0.05)


def run_detection_modules(claims: list, data: dict, text: str) -> dict:
    """Execute all 8 detection modules and return consolidated results."""
    modules = {
        "narrative_inflation": _run_narrative_inflation(claims, text),
        "future_washing": _run_future_washing(data, text),
        "carbon_reality_gap": _run_carbon_reality_gap(data, claims, text),
        "capex_misalignment": _run_capex_misalignment(text),
        "supply_chain_contradictions": _run_supply_chain_contradictions(data, claims, text),
        "scope3_omission": _run_scope3_omission(data, claims, text),
        "offset_dependency_risk": _run_offset_dependency(data, text),
        "regulatory_misalignment": _run_regulatory_misalignment(data, text),
    }

    # Aggregate module risk: weighted sum of module scores by their weights
    total_weighted = sum(m["weighted_risk"] for m in modules.values())
    total_weight = sum(m["weight"] for m in modules.values())
    aggregate_module_score = round(total_weighted / total_weight) if total_weight else 0

    # Determine overall module status
    critical_modules = [k for k, m in modules.items() if m["risk_level"] == "Critical"]
    high_modules = [k for k, m in modules.items() if m["risk_level"] in ("Critical", "High")]

    if critical_modules:
        module_status = "CRITICAL"
    elif len(high_modules) >= 3:
        module_status = "HIGH"
    elif len(high_modules) >= 1:
        module_status = "ELEVATED"
    else:
        module_status = "MODERATE"

    return {
        "modules": modules,
        "aggregate_module_score": aggregate_module_score,
        "module_status": module_status,
        "critical_module_count": len(critical_modules),
        "high_risk_module_count": len(high_modules),
        "flagged_modules": critical_modules,
    }


# ══════════════════════════════════════════════════════════════════════════════
# 7-DIMENSION CREDIBILITY SCORING
# ══════════════════════════════════════════════════════════════════════════════

def _score_dimension(raw: int, weight: float) -> int:
    """Clamp and return a 0-100 dimension score."""
    return max(0, min(100, raw))


def compute_credibility_breakdown(
    claims: list,
    data: dict,
    text: str,
    flags: list,
    framework_results: dict,
    detection_modules: dict,
) -> dict:
    """
    Compute 7-dimension Climate Credibility Score breakdown.
    Returns scores where 100 = fully credible, 0 = critically deficient.
    """
    modules = detection_modules.get("modules", {})

    # Dimension 1: Emission Integrity (25%)
    scope_coverage = sum([
        30 if data.get("scope_1") else 0,
        30 if data.get("scope_2") else 0,
        30 if data.get("scope_3") else 0,
    ])
    baseline_bonus = 10 if data.get("baseline_year") else 0
    assurance_bonus = 15 if data.get("third_party_assurance") else 0
    intensity_bonus = 5 if data.get("emission_intensity_reported") else 0
    emission_integrity_raw = min(100, scope_coverage + baseline_bonus + assurance_bonus + intensity_bonus)
    gap_module = modules.get("carbon_reality_gap", {})
    emission_penalty = int(gap_module.get("score", 0) * 0.35)
    emission_integrity = max(0, emission_integrity_raw - emission_penalty)

    # Dimension 2: Narrative Credibility (20%)
    inflation_score = modules.get("narrative_inflation", {}).get("score", 50)
    future_wash = modules.get("future_washing", {}).get("score", 50)
    narrative_raw = 100 - int((inflation_score * 0.55 + future_wash * 0.45))
    narrative_credibility = max(0, min(100, narrative_raw))

    # Dimension 3: Disclosure Transparency (15%)
    coverage = framework_results.get("coverage_pct", 0)
    assurance_pts = 20 if data.get("third_party_assurance") else 0
    materiality_pts = 10 if bool(re.search(
        r"material(?:ity)?\s+(?:assessment|analysis|topic)", text, re.IGNORECASE
    )) else 0
    disclosure_transparency = min(100, int(coverage * 0.70) + assurance_pts + materiality_pts)

    # Dimension 4: CAPEX Alignment (15%)
    capex_score = modules.get("capex_misalignment", {}).get("score", 55)
    capex_alignment = max(0, 100 - capex_score)

    # Dimension 5: Regulatory Alignment (10%)
    reg_score = modules.get("regulatory_misalignment", {}).get("score", 50)
    regulatory_alignment = max(0, 100 - reg_score)

    # Dimension 6: Supply Chain Integrity (10%)
    supply_score = modules.get("supply_chain_contradictions", {}).get("score", 50)
    scope3_score = modules.get("scope3_omission", {}).get("score", 50)
    supply_chain_integrity = max(0, 100 - int((supply_score * 0.55 + scope3_score * 0.45)))

    # Dimension 7: Transition Plan Credibility (5%)
    has_transition = data.get("transition_pathway_present", False)
    has_interim = bool(re.search(
        r"(?:2025|2030)\s+(?:target|milestone|goal)", text, re.IGNORECASE
    ))
    has_sbti = bool(re.search(r"\bsbti\b|science\s+based\s+targets", text, re.IGNORECASE))
    offset_dep = modules.get("offset_dependency_risk", {}).get("score", 50)
    transition_raw = (
        (40 if has_transition else 0)
        + (30 if has_interim else 0)
        + (20 if has_sbti else 0)
        + max(0, 10 - int(offset_dep * 0.10))
    )
    transition_credibility = min(100, transition_raw)

    # Weighted composite Climate Credibility Score
    weighted_sum = (
        emission_integrity * 0.25
        + narrative_credibility * 0.20
        + disclosure_transparency * 0.15
        + capex_alignment * 0.15
        + regulatory_alignment * 0.10
        + supply_chain_integrity * 0.10
        + transition_credibility * 0.05
    )
    climate_credibility_score = round(weighted_sum)

    def _rating(score: int) -> str:
        if score >= 85: return "AAA"
        if score >= 75: return "AA"
        if score >= 65: return "A"
        if score >= 50: return "BBB"
        if score >= 35: return "BB"
        if score >= 20: return "B"
        return "CCC"

    def _label(score: int) -> str:
        if score >= 80: return "Highly Credible"
        if score >= 65: return "Credible"
        if score >= 50: return "Partially Credible"
        if score >= 35: return "Questionable"
        if score >= 20: return "Low Credibility"
        return "Critical Credibility Risk"

    return {
        "dimensions": {
            "emission_integrity": {
                "score": emission_integrity,
                "weight": "25%",
                "rating": _rating(emission_integrity),
                "label": _label(emission_integrity),
                "evidence": (
                    "Scope 1/2/3 coverage, baseline year, assurance, intensity reporting"
                ),
            },
            "narrative_credibility": {
                "score": narrative_credibility,
                "weight": "20%",
                "rating": _rating(narrative_credibility),
                "label": _label(narrative_credibility),
                "evidence": "Marketing language vs quantified evidence ratio, future-washing analysis",
            },
            "disclosure_transparency": {
                "score": disclosure_transparency,
                "weight": "15%",
                "rating": _rating(disclosure_transparency),
                "label": _label(disclosure_transparency),
                "evidence": "Framework coverage %, third-party assurance, materiality assessment",
            },
            "capex_alignment": {
                "score": capex_alignment,
                "weight": "15%",
                "rating": _rating(capex_alignment),
                "label": _label(capex_alignment),
                "evidence": "Green vs fossil capital expenditure alignment analysis",
            },
            "regulatory_alignment": {
                "score": regulatory_alignment,
                "weight": "10%",
                "rating": _rating(regulatory_alignment),
                "label": _label(regulatory_alignment),
                "evidence": "TCFD, ISSB S2, SBTi, EU Taxonomy, SEC Climate Rule coverage",
            },
            "supply_chain_integrity": {
                "score": supply_chain_integrity,
                "weight": "10%",
                "rating": _rating(supply_chain_integrity),
                "label": _label(supply_chain_integrity),
                "evidence": "Scope 3 value chain coverage, supplier ESG data, assessment processes",
            },
            "transition_credibility": {
                "score": transition_credibility,
                "weight": "5%",
                "rating": _rating(transition_credibility),
                "label": _label(transition_credibility),
                "evidence": "Transition plan presence, interim milestones, SBTi validation, offset reliance",
            },
        },
        "climate_credibility_score": climate_credibility_score,
        "climate_credibility_rating": _rating(climate_credibility_score),
        "climate_credibility_label": _label(climate_credibility_score),
    }


# ══════════════════════════════════════════════════════════════════════════════
# GREENWASHING RISK SCORE → INSTITUTIONAL RATING
# ══════════════════════════════════════════════════════════════════════════════

def _greenwashing_to_institutional_rating(risk_score: int) -> dict:
    """Map greenwashing risk score (0–100) to institutional risk tier."""
    if risk_score <= 15:
        return {"rating": "AAA", "level": "Credible", "color": "#00CC44",
                "description": "Disclosure meets institutional credibility standards."}
    if risk_score <= 25:
        return {"rating": "AA", "level": "Low Risk", "color": "#22CC66",
                "description": "Minor disclosure gaps. Overall credible."}
    if risk_score <= 35:
        return {"rating": "A", "level": "Moderate", "color": "#88BB00",
                "description": "Some narrative-data mismatches. Remediation recommended."}
    if risk_score <= 50:
        return {"rating": "BBB", "level": "Elevated", "color": "#FFAA00",
                "description": "Material disclosure gaps detected. Due diligence required."}
    if risk_score <= 65:
        return {"rating": "BB", "level": "High Risk", "color": "#FF6600",
                "description": "Significant greenwashing indicators. Investor alert."}
    if risk_score <= 80:
        return {"rating": "B", "level": "Severe", "color": "#FF3333",
                "description": "Severe narrative-reality divergence. Regulatory exposure likely."}
    return {"rating": "CCC", "level": "Critical", "color": "#CC0000",
            "description": "Critical greenwashing risk. Enforcement-level concern."}


# ══════════════════════════════════════════════════════════════════════════════
# LLM: KEY FINDINGS + EXPLAINABILITY
# ══════════════════════════════════════════════════════════════════════════════

_FINDINGS_SYSTEM = """You are a principal climate intelligence analyst at a sovereign-grade
institutional research firm. You produce institutional-grade written assessments in the style
of Moody's ESG Solutions, MSCI Climate Analytics, and BlackRock Risk Insights.

Your findings are used by institutional investors, regulators, and audit committees.
Always return valid JSON — no markdown, no code fences."""

_FINDINGS_USER_TMPL = """Based on this comprehensive climate credibility analysis, produce:

1. 4-6 key intelligence findings (institutional-grade, Moody's style)
2. Score rationale: why the company received this specific credibility rating
3. Benchmark context: how this compares to institutional expectations

ANALYSIS SUMMARY:
- Greenwashing Risk Score: {gw_score}/100 ({gw_level})
- Climate Credibility Score: {cred_score}/100 ({cred_rating})
- Contradiction Count: {contradiction_count} ({contradiction_severity})
- High/Critical Risk Modules: {critical_modules}
- Top Risk Flags: {top_flags}
- Key Data Gaps: {data_gaps}

Return ONLY this JSON:
{{
  "key_findings": [
    {{
      "finding_id": "F-001",
      "category": "Emissions|CAPEX|Narrative|Supply Chain|Regulatory|Transition",
      "severity": "Critical|High|Medium|Informational",
      "title": "short title (max 10 words)",
      "finding": "2-3 sentence institutional finding",
      "implication": "1 sentence on investor/regulatory implication"
    }}
  ],
  "score_rationale": "3-4 sentence explanation of why this score was assigned",
  "benchmark_context": "2-3 sentence comparison vs institutional expectations"
}}"""


def generate_explainability(
    gw_score: int,
    gw_level: str,
    cred_score: int,
    cred_rating: str,
    contradiction_result: dict,
    detection_modules: dict,
    flags: list,
    data: dict,
) -> dict:
    """Generate AI explainability layer — key findings + score rationale."""
    client = _get_client()

    top_flags = [
        {"title": f["title"], "severity": f["severity"]}
        for f in flags[:5]
    ]

    critical_modules = [
        k for k, m in detection_modules.get("modules", {}).items()
        if m.get("risk_level") in ("Critical", "High")
    ]

    data_gaps = {
        "no_scope3": data.get("scope_3") is None,
        "no_baseline": data.get("baseline_year") is None,
        "no_assurance": not data.get("third_party_assurance"),
        "no_transition_plan": not data.get("transition_pathway_present"),
    }

    try:
        resp = client.chat.completions.create(
            model=MODEL,
            max_tokens=1800,
            temperature=0.20,
            messages=[
                {"role": "system", "content": _FINDINGS_SYSTEM},
                {"role": "user", "content": _FINDINGS_USER_TMPL.format(
                    gw_score=gw_score,
                    gw_level=gw_level,
                    cred_score=cred_score,
                    cred_rating=cred_rating,
                    contradiction_count=contradiction_result.get("contradiction_count", 0),
                    contradiction_severity=contradiction_result.get("overall_severity", "Unknown"),
                    critical_modules=", ".join(critical_modules) or "None",
                    top_flags=json.dumps(top_flags),
                    data_gaps=json.dumps(data_gaps),
                )},
            ],
        )
        parsed = _parse_json(resp.choices[0].message.content)
        return {
            "key_findings": parsed.get("key_findings", []),
            "score_rationale": parsed.get("score_rationale", ""),
            "benchmark_context": parsed.get("benchmark_context", ""),
        }
    except Exception:
        return {
            "key_findings": [],
            "score_rationale": (
                f"Greenwashing Risk Score of {gw_score}/100 reflects weighted analysis across "
                f"8 detection modules, contradiction detection, and framework alignment assessment. "
                f"Climate Credibility Score of {cred_score}/100 (rated {cred_rating}) derived from "
                f"7 weighted credibility dimensions."
            ),
            "benchmark_context": (
                "Institutional credibility benchmark: scores below 50 on Climate Credibility "
                "Index fall below GFANZ and PRI minimum expectations for portfolio inclusion."
            ),
        }


# ══════════════════════════════════════════════════════════════════════════════
# MAIN ORCHESTRATION PIPELINE
# ══════════════════════════════════════════════════════════════════════════════

def run_full_credibility_scan(text: str, company_name: str = "The Company") -> dict:
    """
    Full Climate Credibility Intelligence Engine pipeline.

    Stages:
      1. Claim Extraction (LLM)
      2. Data Extraction (regex)
      3. Risk Flag Validation (rule-based)
      4. Framework Mapping (GRI, TCFD, ISSB)
      5. Greenwashing Risk Scoring
      6. Contradiction Detection (rule + LLM)
      7. 8 Detection Modules
      8. 7-Dimension Credibility Scoring
      9. Recommendations (LLM)
     10. Key Findings + Explainability (LLM)
     11. ESG Framework Intelligence Layer
    """
    import uuid
    from datetime import datetime, timezone

    scan_id = str(uuid.uuid4())
    scan_timestamp = datetime.now(timezone.utc).isoformat()

    # Stage 1-2: Extract claims and quantitative data
    claims = extract_claims(text)
    data = extract_data(text)

    # Stage 3: Risk flag validation
    flags = validate_claims(claims, data, text)

    # Stage 4: Framework mapping
    framework_results = map_frameworks(data, text)

    # Stage 5: Greenwashing risk scoring (base)
    score_result = compute_risk_score(flags, framework_results, claims)
    gw_risk_score = score_result["risk_score"]

    # Stage 6: Contradiction detection
    contradiction_result = detect_contradictions(claims, data, text, company_name)

    # Boost greenwashing score based on contradictions
    contradiction_boost = min(25, (
        contradiction_result.get("critical_count", 0) * 10
        + contradiction_result.get("high_count", 0) * 5
        + contradiction_result.get("medium_count", 0) * 2
    ))
    gw_risk_score = min(100, gw_risk_score + contradiction_boost)

    # Stage 7: 8 Detection Modules
    detection_result = run_detection_modules(claims, data, text)

    # Blend module aggregate score into final GW risk score (30% weight)
    module_score = detection_result.get("aggregate_module_score", gw_risk_score)
    gw_risk_score = round(gw_risk_score * 0.70 + module_score * 0.30)

    # Stage 8: 7-Dimension Credibility Scoring
    credibility = compute_credibility_breakdown(
        claims, data, text, flags, framework_results, detection_result
    )

    # Stage 9: Recommendations
    recommendations = generate_recommendations(flags, claims, data)

    # Stage 10: Explainability
    institutional_rating = _greenwashing_to_institutional_rating(gw_risk_score)
    cred_score = credibility["climate_credibility_score"]
    cred_rating = credibility["climate_credibility_rating"]

    explainability = generate_explainability(
        gw_risk_score,
        institutional_rating["level"],
        cred_score,
        cred_rating,
        contradiction_result,
        detection_result,
        flags,
        data,
    )

    # Stage 11: ESG Framework Intelligence Layer
    try:
        intel = run_intelligence_analysis(text, data, flags, company_name)
    except Exception:
        intel = {}

    # Greenwashing risk level label (0–25 Credible, 26–50 Moderate, 51–75 High, 76–100 Severe)
    if gw_risk_score <= 25:
        gw_level, gw_color = "Credible", "#00CC44"
    elif gw_risk_score <= 50:
        gw_level, gw_color = "Moderate", "#FFAA00"
    elif gw_risk_score <= 75:
        gw_level, gw_color = "High", "#FF6600"
    else:
        gw_level, gw_color = "Severe", "#FF3333"

    return {
        # Identity
        "company_name": company_name,
        "scan_id": scan_id,
        "scan_timestamp": scan_timestamp,

        # Core Scores
        "greenwashing_risk_score": gw_risk_score,
        "greenwashing_risk_level": gw_level,
        "greenwashing_risk_color": gw_color,
        "climate_credibility_score": cred_score,
        "climate_credibility_rating": cred_rating,
        "climate_credibility_label": credibility["climate_credibility_label"],
        "institutional_rating": institutional_rating,

        # Score Breakdown (base)
        "score_breakdown": score_result["breakdown"],

        # Claims
        "claims_detected": claims,
        "claims_count": len(claims),
        "high_risk_claims": sum(
            1 for c in claims
            if c.get("type") in ("net_zero", "carbon_neutral", "science_based")
            and not c.get("third_party_verified")
        ),

        # Data Extracted
        "data_extracted": data,

        # Risk Flags
        "risk_flags": flags,

        # Contradictions
        "contradictions": contradiction_result,

        # Detection Modules
        "detection_modules": detection_result,

        # 7-Dimension Credibility
        "credibility_breakdown": credibility["dimensions"],

        # Framework Compliance
        "framework_results": {
            "breakdown": framework_results.get("breakdown", {}),
            "missing": framework_results.get("missing", []),
            "met_count": framework_results.get("met_count", 0),
            "total_count": framework_results.get("total_count", 0),
            "coverage_pct": framework_results.get("coverage_pct", 0),
        },

        # Recommendations
        "recommendations": recommendations,

        # Explainability
        "explainability": explainability,

        # Intelligence Layer
        "intelligence": intel,
    }
