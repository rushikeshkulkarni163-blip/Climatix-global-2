"""
Climactix — Greenwashing Typology & Measurement Layer
======================================================
Implements the 14-typology greenwashing classification framework and the
direct greenwashing-measurement formulas (DPM, TWM, Selective Disclosure /
Expressive Manipulation) from the systematic review of greenwashing
measurement in corporate finance research (Ali, Gupta & Elkhashen, 2026).

This module does not replace `climate_credibility_engine.py`'s 8 detection
modules or 7-dimension credibility score — it adds a classification layer on
top of their existing output, mapping each module/metric to the specific
greenwashing typology it evidences, plus three additional quantitative
measures (DPM, TWM, Selective Disclosure Index) computed directly from data
already produced by the existing pipeline.

14 typologies, 4 clusters:
  Disclosure Manipulation
    1. Deceptive / Opaque Communication
    2. Selective Disclosure
  ESG Decoupling
    3. Talk-Walk Mismatch (TWM)
    4. Disclosure-Performance Mismatch (DPM)
    5. Rating-Performance Mismatch / Masked Misconduct
    6. Phantom Initiatives
    7. Superficial Commitment / False Evolution
  Strategic Disclosure
    8. Event-Driven Disclosures
    9. Trend-Driven Disclosures
    10. Regulatory Arbitrage / Box-Ticking
    11. Green Cloning / Benchmark Gaming
  Strategic Alliances & Partnerships
    12. Reputation Borrowing
    13. Rating Divergence
    14. Assurance Complexity

Data-availability caveat (disclosed in every output): Climactix's ESG scan
pipeline works from a single company's submitted report text, not a
multi-firm, multi-year panel. Measures the source literature defines via
industry-year standardization (DPM, TWM) or peer/counterparty comparison
(Rating Divergence, Relational Greenwashing) are approximated here against
fixed institutional benchmark reference points rather than a live peer
dataset — each function documents its specific proxy and benchmark.
"""

from __future__ import annotations

import math

# ══════════════════════════════════════════════════════════════════════════════
# TAXONOMY DEFINITION
# ══════════════════════════════════════════════════════════════════════════════

TYPOLOGIES = {
    "deceptive_communication": {
        "cluster": "Disclosure Manipulation",
        "name": "Deceptive / Opaque Communication",
        "description": "Vague, aspirational language substituting for quantified, verifiable disclosure.",
    },
    "selective_disclosure": {
        "cluster": "Disclosure Manipulation",
        "name": "Selective Disclosure",
        "description": "Material topics omitted while favourable topics are emphasised.",
    },
    "talk_walk_mismatch": {
        "cluster": "ESG Decoupling",
        "name": "Talk-Walk Mismatch",
        "description": "Symbolic external signalling outpaces substantive internal policy/implementation.",
    },
    "disclosure_performance_mismatch": {
        "cluster": "ESG Decoupling",
        "name": "Disclosure-Performance Mismatch",
        "description": "Disclosure quality significantly exceeds underlying emissions/operational performance.",
    },
    "rating_performance_mismatch": {
        "cluster": "ESG Decoupling",
        "name": "Rating-Performance Mismatch / Masked Misconduct",
        "description": "Structural contradictions between stated claims and disclosed facts suggest masked misconduct.",
    },
    "phantom_initiatives": {
        "cluster": "ESG Decoupling",
        "name": "Phantom Initiatives",
        "description": "Offsets or nominal programmes substitute for genuine operational decarbonisation.",
    },
    "superficial_commitment": {
        "cluster": "ESG Decoupling",
        "name": "Superficial Commitment / False Evolution",
        "description": "Long-horizon targets asserted without credible interim milestones or transition pathway.",
    },
    "event_driven_disclosure": {
        "cluster": "Strategic Disclosure",
        "name": "Event-Driven Disclosures",
        "description": "Disclosure volume/tone shifts around specific reputational events rather than steady reporting.",
    },
    "trend_driven_disclosure": {
        "cluster": "Strategic Disclosure",
        "name": "Trend-Driven Disclosures",
        "description": "ESG language tracks market/media sustainability trends rather than firm-specific substance.",
    },
    "regulatory_arbitrage": {
        "cluster": "Strategic Disclosure",
        "name": "Regulatory Arbitrage / Box-Ticking",
        "description": "Minimum-compliance disclosure that satisfies a framework's letter without its intent.",
    },
    "green_cloning": {
        "cluster": "Strategic Disclosure",
        "name": "Green Cloning / Benchmark Gaming",
        "description": "Disclosure mirrors sector-leader templates/benchmarks rather than firm-specific substance.",
    },
    "reputation_borrowing": {
        "cluster": "Strategic Alliances & Partnerships",
        "name": "Reputation Borrowing",
        "description": "Credibility signalled via association (partners, certifications, alliances) rather than own performance.",
    },
    "rating_divergence": {
        "cluster": "Strategic Alliances & Partnerships",
        "name": "Rating Divergence",
        "description": "Own ESG standing diverges materially from counterparties' or peers' — relational greenwashing risk.",
    },
    "assurance_complexity": {
        "cluster": "Strategic Alliances & Partnerships",
        "name": "Assurance Complexity",
        "description": "Verification/assurance arrangements are complex or absent enough to obscure accountability.",
    },
}

# Maps an existing detection-module key (from climate_credibility_engine.py's
# run_detection_modules) to the typology(ies) it is direct evidence for.
_MODULE_TO_TYPOLOGY = {
    "narrative_inflation": ["deceptive_communication"],
    "future_washing": ["superficial_commitment"],
    "carbon_reality_gap": ["disclosure_performance_mismatch"],
    "capex_misalignment": ["talk_walk_mismatch"],
    "supply_chain_contradictions": ["selective_disclosure"],
    "scope3_omission": ["selective_disclosure"],
    "offset_dependency_risk": ["phantom_initiatives"],
    "regulatory_misalignment": ["regulatory_arbitrage"],
}


# ══════════════════════════════════════════════════════════════════════════════
# DIRECT MEASUREMENT FORMULAS
# ══════════════════════════════════════════════════════════════════════════════

def _z(value: float, benchmark_mean: float, benchmark_sd: float) -> float:
    """Standardize against a fixed institutional benchmark (documented proxy
    for the industry-year z-scoring the source literature specifies, which
    requires a live multi-firm peer dataset Climactix's single-report scan
    does not have)."""
    if benchmark_sd <= 0:
        return 0.0
    return (value - benchmark_mean) / benchmark_sd


def compute_dpm(disclosure_transparency: int, emission_integrity: int) -> dict:
    """
    Disclosure-Performance Mismatch (DPM) — the most-used greenwashing
    measure in the corporate finance literature (30 studies in the source
    review): standardized difference between an ESG disclosure-quality score
    and an ESG performance score, both z-scored by industry-year.

    Proxy here: disclosure_transparency (7-dimension credibility breakdown)
    stands in for disclosure quality; emission_integrity stands in for
    performance. Both benchmarked against a fixed institutional reference
    (mean 60, sd 20 — the credibility engine's own scale) rather than a live
    industry-year panel.
    """
    z_disclosure = _z(disclosure_transparency, 60, 20)
    z_performance = _z(emission_integrity, 60, 20)
    dpm = round(z_disclosure - z_performance, 2)

    if dpm <= 0.25:
        level = "Low"
    elif dpm <= 0.75:
        level = "Moderate"
    else:
        level = "High"

    return {
        "metric": "Disclosure-Performance Mismatch (DPM)",
        "value": dpm,
        "level": level,
        "interpretation": (
            "Positive DPM means disclosure quality outpaces actual emissions performance — "
            "the classic greenwashing signature. Values near/below zero indicate performance "
            "keeps pace with (or exceeds) disclosure quality."
        ),
        "inputs": {"disclosure_transparency": disclosure_transparency, "emission_integrity": emission_integrity},
    }


def compute_twm(narrative_inflation_score: int, future_washing_score: int,
                capex_alignment: int, transition_credibility: int, supply_chain_integrity: int) -> dict:
    """
    Talk-Walk Mismatch (TWM) — gap between symbolic ESG signalling ("talk":
    marketing language, future-dated commitments) and substantive ESG
    implementation ("walk": capital allocation, transition planning, supply
    chain integrity). Symmetric geometric-mean construction mirrors the
    source literature's own Selective Disclosure → Greenwashing Index
    pattern (see compute_selective_disclosure_index below).
    """
    talk_score = (narrative_inflation_score + future_washing_score) / 2
    walk_score = (capex_alignment + transition_credibility + supply_chain_integrity) / 3
    walk_gap = 100 - walk_score

    twm = round(math.sqrt(max(0.0, talk_score) * max(0.0, walk_gap)), 1)

    if twm <= 30:
        level = "Low"
    elif twm <= 60:
        level = "Moderate"
    else:
        level = "High"

    return {
        "metric": "Talk-Walk Mismatch (TWM)",
        "value": twm,
        "level": level,
        "interpretation": (
            "High TWM means external messaging (talk_score) is elevated while capital "
            "allocation, transition planning, and supply chain integration (walk_score) lag — "
            "symbolic ESG signalling without substantive implementation."
        ),
        "inputs": {"talk_score": round(talk_score, 1), "walk_score": round(walk_score, 1)},
    }


def compute_selective_disclosure_index(coverage_pct: int, narrative_inflation_score: int) -> dict:
    """
    Selective Disclosure (SD), Expressive Manipulation (EM), and composite
    Greenwashing Index (GW), computed with the source literature's exact
    formulas:
        SD = 100 × (1 − disclosed / should-be-disclosed)
        EM = 100 × (symbolic disclosures / disclosed)
        GW = √(SD × EM)

    Proxies: framework coverage_pct (met/total disclosure requirements)
    stands in for "disclosed / should-be-disclosed"; narrative_inflation's
    vague-vs-quantified ratio score stands in for the fraction of disclosed
    content that is symbolic rather than substantive (no per-item
    symbolic/substantive tagging is available from a single-report scan).
    """
    sd = round(100 - coverage_pct, 1)
    em = round(narrative_inflation_score, 1)
    gw = round(math.sqrt(max(0.0, sd) * max(0.0, em)), 1)

    if gw <= 30:
        level = "Low"
    elif gw <= 60:
        level = "Moderate"
    else:
        level = "High"

    return {
        "metric": "Selective Disclosure Index (SD / EM / GW)",
        "selective_disclosure": sd,
        "expressive_manipulation": em,
        "greenwashing_index": gw,
        "level": level,
        "interpretation": (
            "SD measures the share of expected disclosures that are missing; EM approximates how "
            "symbolic (vs. substantive) the disclosed content is; GW is their geometric mean — high "
            "only when both gaps co-occur."
        ),
    }


# ══════════════════════════════════════════════════════════════════════════════
# TYPOLOGY CLASSIFICATION
# ══════════════════════════════════════════════════════════════════════════════

def classify_typologies(detection_modules: dict, contradiction_result: dict,
                         dpm: dict, twm: dict, sd_index: dict) -> dict:
    """
    Map triggered detection modules + the three direct measures onto the
    14-typology taxonomy. A typology is "triggered" when its evidencing
    module/metric is at Medium risk or above.
    """
    modules = detection_modules.get("modules", {})
    triggered: list[dict] = []

    for module_key, typology_ids in _MODULE_TO_TYPOLOGY.items():
        module = modules.get(module_key)
        if not module or module.get("risk_level") not in ("Medium", "High", "Critical"):
            continue
        for tid in typology_ids:
            typ = TYPOLOGIES[tid]
            triggered.append({
                "typology_id": tid,
                "cluster": typ["cluster"],
                "name": typ["name"],
                "severity": module["risk_level"],
                "evidence": f"{module['module'].replace('_', ' ').title()} module scored {module['score']}/100",
            })

    # Contradiction detector → Rating-Performance Mismatch / Masked Misconduct
    if contradiction_result.get("contradiction_count", 0) > 0 and contradiction_result.get("overall_severity") in (
        "High", "Critical"
    ):
        typ = TYPOLOGIES["rating_performance_mismatch"]
        triggered.append({
            "typology_id": "rating_performance_mismatch",
            "cluster": typ["cluster"],
            "name": typ["name"],
            "severity": contradiction_result.get("overall_severity", "High"),
            "evidence": f"{contradiction_result.get('contradiction_count', 0)} structural contradiction(s) detected between claims and disclosed data",
        })

    # DPM → Disclosure-Performance Mismatch (direct measure confirmation)
    if dpm["level"] in ("Moderate", "High"):
        typ = TYPOLOGIES["disclosure_performance_mismatch"]
        triggered.append({
            "typology_id": "disclosure_performance_mismatch",
            "cluster": typ["cluster"],
            "name": typ["name"],
            "severity": dpm["level"],
            "evidence": f"DPM index = {dpm['value']} ({dpm['level']})",
        })

    # TWM → Talk-Walk Mismatch (direct measure confirmation)
    if twm["level"] in ("Moderate", "High"):
        typ = TYPOLOGIES["talk_walk_mismatch"]
        triggered.append({
            "typology_id": "talk_walk_mismatch",
            "cluster": typ["cluster"],
            "name": typ["name"],
            "severity": twm["level"],
            "evidence": f"TWM index = {twm['value']} ({twm['level']})",
        })

    # SD/EM/GW → Selective Disclosure (direct measure confirmation)
    if sd_index["level"] in ("Moderate", "High"):
        typ = TYPOLOGIES["selective_disclosure"]
        triggered.append({
            "typology_id": "selective_disclosure",
            "cluster": typ["cluster"],
            "name": typ["name"],
            "severity": sd_index["level"],
            "evidence": f"Greenwashing Index (GW) = {sd_index['greenwashing_index']} (SD={sd_index['selective_disclosure']}, EM={sd_index['expressive_manipulation']})",
        })

    # De-duplicate by typology_id, keeping the highest-severity instance
    _rank = {"Critical": 3, "High": 2, "Moderate": 1, "Medium": 1, "Low": 0}
    by_id: dict[str, dict] = {}
    for t in triggered:
        existing = by_id.get(t["typology_id"])
        if not existing or _rank.get(t["severity"], 0) > _rank.get(existing["severity"], 0):
            by_id[t["typology_id"]] = t

    triggered_unique = sorted(by_id.values(), key=lambda t: -_rank.get(t["severity"], 0))

    # Typologies with no signal available from a single-report scan (require
    # multi-period / multi-firm / counterparty data Climactix does not hold
    # from one ESG report) — surfaced as "not assessable", not "clean".
    not_assessable = [
        TYPOLOGIES[tid]["name"] for tid in (
            "event_driven_disclosure", "trend_driven_disclosure", "green_cloning",
            "reputation_borrowing", "rating_divergence", "assurance_complexity",
        )
    ]

    return {
        "triggered_typologies": triggered_unique,
        "triggered_count": len(triggered_unique),
        "clusters_flagged": sorted({t["cluster"] for t in triggered_unique}),
        "not_assessable_from_single_report": not_assessable,
        "taxonomy_reference": "14-typology framework, 4 clusters (Ali, Gupta & Elkhashen systematic review, 2026)",
    }


def run_typology_analysis(detection_modules: dict, contradiction_result: dict,
                           credibility_dimensions: dict, framework_results: dict) -> dict:
    """Full typology + direct-measurement layer — the entry point
    `climate_credibility_engine.py` calls after its own scoring stages."""
    modules = detection_modules.get("modules", {})

    dpm = compute_dpm(
        disclosure_transparency=credibility_dimensions["disclosure_transparency"]["score"],
        emission_integrity=credibility_dimensions["emission_integrity"]["score"],
    )
    twm = compute_twm(
        narrative_inflation_score=modules.get("narrative_inflation", {}).get("score", 50),
        future_washing_score=modules.get("future_washing", {}).get("score", 50),
        capex_alignment=credibility_dimensions["capex_alignment"]["score"],
        transition_credibility=credibility_dimensions["transition_credibility"]["score"],
        supply_chain_integrity=credibility_dimensions["supply_chain_integrity"]["score"],
    )
    sd_index = compute_selective_disclosure_index(
        coverage_pct=framework_results.get("coverage_pct", 50),
        narrative_inflation_score=modules.get("narrative_inflation", {}).get("score", 50),
    )

    classification = classify_typologies(detection_modules, contradiction_result, dpm, twm, sd_index)

    return {
        "measures": {
            "disclosure_performance_mismatch": dpm,
            "talk_walk_mismatch": twm,
            "selective_disclosure_index": sd_index,
        },
        **classification,
    }
