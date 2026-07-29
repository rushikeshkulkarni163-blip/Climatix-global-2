"""
Climactix Global — Verification & Evidence Engine v1.0
Assesses evidence quality for every claim in an assessment.
Every answer must be traceable to a source — no black-box scoring.
Proprietary IP of Climactix Global. All rights reserved.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import List, Dict, Optional
from enum import Enum


class EvidenceStatus(str, Enum):
    VERIFIED           = "Verified"
    PARTIALLY_VERIFIED = "Partially Verified"
    UNVERIFIED         = "Unverified"
    CONTRADICTORY      = "Contradictory"


# Trust weights per evidence source type (0.0 – 1.0)
_SOURCE_WEIGHTS: Dict[str, float] = {
    "regulatory":    1.00,   # Regulatory filing, exchange submission
    "third_party":   0.95,   # Third-party assurance report
    "audited":       0.90,   # Audited financial / sustainability statement
    "document":      0.75,   # Internal document, sustainability report
    "report":        0.70,   # Published report without assurance
    "website":       0.50,   # Company website
    "self_declared": 0.30,   # Self-declaration, no supporting document
}

# High-materiality claim categories — penalties doubled on unverified
_HIGH_MATERIALITY_CLAIMS = {
    "net_zero_target", "scope1_emissions", "scope2_emissions", "scope3_emissions",
    "carbon_intensity", "sbti_aligned", "renewable_target", "stranded_asset_risk",
    "revenue_at_risk", "climate_capex", "third_party_assurance",
}


@dataclass
class EvidenceResult:
    verification_score: float
    verified_count: int
    partially_verified_count: int
    unverified_count: int
    contradictory_count: int
    score_penalty: float
    score_uplift: float
    claim_breakdown: List[Dict]
    high_risk_unverified: List[str]
    evidence_integrity_label: str     # Strong / Adequate / Weak / Insufficient / Conflicted


def assess_evidence(evidence_items: list) -> EvidenceResult:
    """
    Main entry point. Takes a list of EvidenceItem objects (from cis_engine)
    and returns a structured EvidenceResult.
    """
    if not evidence_items:
        return EvidenceResult(
            verification_score=40.0,
            verified_count=0, partially_verified_count=0,
            unverified_count=0, contradictory_count=0,
            score_penalty=10.0, score_uplift=0.0,
            claim_breakdown=[], high_risk_unverified=[],
            evidence_integrity_label="Insufficient",
        )

    verified = partial = unverified = contradictory = 0
    total_quality = 0.0
    high_materiality_unverified_count = 0
    claim_breakdown: List[Dict] = []
    high_risk_unverified: List[str] = []

    for item in evidence_items:
        is_high_mat = item.claim_id in _HIGH_MATERIALITY_CLAIMS

        if item.contradictory:
            status = EvidenceStatus.CONTRADICTORY
            contradictory += 1
            quality = 0.0
        elif item.verified:
            status = EvidenceStatus.VERIFIED
            verified += 1
            quality = _SOURCE_WEIGHTS.get(item.evidence_type, 0.65)
        elif getattr(item, "evidence_source", "") and item.evidence_type != "self_declared":
            status = EvidenceStatus.PARTIALLY_VERIFIED
            partial += 1
            quality = _SOURCE_WEIGHTS.get(item.evidence_type, 0.50) * 0.55
        else:
            status = EvidenceStatus.UNVERIFIED
            unverified += 1
            quality = 0.0
            high_risk_unverified.append(item.claim_id)
            if is_high_mat:
                high_materiality_unverified_count += 1

        total_quality += quality
        claim_breakdown.append({
            "claim_id":      item.claim_id,
            "claim_text":    item.claim_text[:120],
            "status":        status.value,
            "quality":       round(quality, 3),
            "evidence_type": item.evidence_type,
            "high_materiality": is_high_mat,
        })

    n = len(evidence_items)
    avg_quality     = total_quality / n
    verified_rate   = verified / n
    partial_rate    = partial / n
    contradict_rate = contradictory / n

    # Verification score: quality (60) + coverage (30) + consistency (10)
    quality_component  = avg_quality * 60
    coverage_component = (verified_rate + partial_rate * 0.5) * 30
    consist_component  = (1.0 - contradict_rate) * 10
    raw = quality_component + coverage_component + consist_component
    verification_score = _clamp(raw, 0.0, 100.0)

    # Score penalty
    penalty = 0.0
    if contradictory > 0:
        penalty += 6.0
    if unverified / n > 0.5:
        penalty += 8.0
    elif unverified / n > 0.3:
        penalty += 4.0
    penalty += high_materiality_unverified_count * 2.0
    penalty = min(penalty, 20.0)

    # Score uplift for institutional-quality evidence
    uplift = 0.0
    if verified_rate > 0.80 and avg_quality > 0.82:
        uplift = 3.5
    elif verified_rate > 0.60 and avg_quality > 0.70:
        uplift = 1.5

    # Integrity label
    if contradictory > 0:
        label = "Conflicted"
    elif verification_score >= 85:
        label = "Strong"
    elif verification_score >= 65:
        label = "Adequate"
    elif verification_score >= 45:
        label = "Weak"
    else:
        label = "Insufficient"

    return EvidenceResult(
        verification_score=round(verification_score, 1),
        verified_count=verified,
        partially_verified_count=partial,
        unverified_count=unverified,
        contradictory_count=contradictory,
        score_penalty=round(penalty, 1),
        score_uplift=round(uplift, 1),
        claim_breakdown=claim_breakdown,
        high_risk_unverified=high_risk_unverified,
        evidence_integrity_label=label,
    )


# ── Evidence Confidence Score (Evidence Intelligence Agent spec §8) ────────────
# Distinct from assess_evidence() above: that function scores a whole
# assessment's claim breakdown; this scores ONE question's evidence bundle
# with the exact configurable factor list the spec requires, and is what
# evidence_intelligence_agent.py actually calls per question. Weights are
# versioned so a future re-weighting is a traceable methodology change, not a
# silent score drift.

CONFIDENCE_METHODOLOGY_VERSION = "evidence_confidence_v1"

_CONFIDENCE_WEIGHTS: Dict[str, float] = {
    "source_credibility":          0.20,
    "evidence_relevance":          0.15,
    "completeness":                0.12,
    "recency":                     0.08,
    "methodological_transparency": 0.10,
    "external_assurance":          0.10,
    "cross_source_consistency":    0.10,
    "traceability":                0.10,
    "independent_verification":   0.05,
}

_CROSS_DOC_CONSISTENCY_SCORE = {
    "legitimate_yoy_change": 0.95, "restatement": 0.85, "methodology_change": 0.80,
    "acquisition_divestment": 0.80, "boundary_change": 0.75, "reporting_error": 0.35,
    "unexplained_contradiction": 0.10,
}

_FACTOR_LABELS = {
    "source_credibility": "source credibility", "evidence_relevance": "evidence relevance",
    "completeness": "completeness", "recency": "recency",
    "methodological_transparency": "methodological transparency",
    "external_assurance": "external assurance", "cross_source_consistency": "cross-source consistency",
    "traceability": "traceability", "independent_verification": "independent verification",
}


def _factor_source_credibility(evidence_items: list) -> float:
    if not evidence_items:
        return 0.0
    weights = [_SOURCE_WEIGHTS.get(e.get("evidence_type", "self_declared"), 0.30) for e in evidence_items]
    return sum(weights) / len(weights)


def _factor_recency(evidence_items: list, current_year: Optional[int] = None) -> float:
    import datetime
    current_year = current_year or datetime.date.today().year
    years = []
    for e in evidence_items:
        period = e.get("reporting_period") or ""
        match = None
        for token in str(period).replace("-", " ").replace("/", " ").split():
            if token.isdigit() and 1990 < int(token) < 2100:
                match = int(token)
        if match:
            years.append(match)
    if not years:
        return 0.5  # unknown recency — neutral, not penalized as if stale
    age = current_year - max(years)
    if age <= 1:
        return 1.0
    if age == 2:
        return 0.7
    if age == 3:
        return 0.4
    return 0.2


def _factor_completeness(metrics: list, claims: list) -> float:
    items = (metrics or []) + (claims or [])
    if not items:
        return 0.3  # no structured data extracted at all — low, not zero (evidence may still be a doc)
    context_fields = ["reporting_period", "boundary", "geography", "methodology",
                       "baseline", "operational_boundary", "geographical_boundary"]
    ratios = []
    for item in items:
        present = sum(1 for f in context_fields if item.get(f))
        applicable = sum(1 for f in context_fields if f in item)
        ratios.append(present / applicable if applicable else 0.3)
    return sum(ratios) / len(ratios)


def _factor_methodological_transparency(metrics: list, claims: list) -> float:
    items = (metrics or []) + (claims or [])
    if not items:
        return 0.3
    with_methodology = sum(1 for i in items if i.get("methodology"))
    return with_methodology / len(items)


def _factor_external_assurance(claims: list, evidence_items: list) -> float:
    assured_claims = sum(1 for c in (claims or []) if c.get("external_assurance"))
    assured_docs = sum(1 for e in evidence_items if e.get("evidence_type") in ("third_party", "audited"))
    total = len(claims or []) + len(evidence_items)
    if not total:
        return 0.0
    return (assured_claims + assured_docs) / total


def _factor_cross_source_consistency(cross_doc_results: list) -> float:
    if not cross_doc_results:
        return 0.6  # no cross-document comparison run yet — neutral, not proof of consistency
    scores = [_CROSS_DOC_CONSISTENCY_SCORE.get(r.get("classification"), 0.5) for r in cross_doc_results]
    return sum(scores) / len(scores)


def _factor_traceability(metrics: list, claims: list) -> float:
    items = (metrics or []) + (claims or [])
    if not items:
        return 0.0
    traceable = sum(
        1 for i in items
        if i.get("source_locator") or i.get("supporting_evidence")
    )
    return traceable / len(items)


def _factor_independent_verification(external_checks: list) -> float:
    if not external_checks:
        return 0.3  # never attempted — an evidence gap, not disproof
    scores = []
    for c in external_checks:
        status = c.get("status")
        if status == "MATCH":
            scores.append(1.0)
        elif status == "PARTIAL_MATCH":
            scores.append(0.6)
        elif status == "MISMATCH":
            scores.append(0.0)
        else:  # EXTERNAL_SOURCE_UNAVAILABLE / GEOSPATIAL_DATA_UNAVAILABLE
            scores.append(0.3)
    return sum(scores) / len(scores)


def compute_evidence_confidence(
    evidence_items: list,
    metrics: Optional[list] = None,
    claims: Optional[list] = None,
    external_checks: Optional[list] = None,
    cross_doc_results: Optional[list] = None,
) -> dict:
    """
    Evidence Confidence Score for ONE assessment question (spec §8).

    `evidence_items`: list of dicts, each with at least `evidence_type`
      (regulatory/third_party/audited/document/report/website/self_declared)
      and optionally `reporting_period`.
    `metrics`, `claims`: structured objects from metric_intelligence.py /
      claim_intelligence.py for this question.
    `external_checks`: list of external_verification.ExternalCheckResult-
      shaped dicts (or geospatial_validation.GeospatialCheckResult-shaped).
    `cross_doc_results`: list of contradiction_detector.compare_claims_
      across_evidence()-shaped dicts.

    Returns {score (0-100 int), label (HIGH/MODERATE/LOW/INSUFFICIENT),
    explanation (one sentence), factors {name: 0-1 float},
    methodology_version}. Never false precision — score is rounded to a
    whole number and the label is the only thing shown at a glance.
    """
    factors = {
        "source_credibility": _factor_source_credibility(evidence_items),
        "evidence_relevance": (
            sum(e.get("relevance", 0.6) for e in evidence_items) / len(evidence_items)
            if evidence_items else 0.0
        ),
        "completeness": _factor_completeness(metrics, claims),
        "recency": _factor_recency(evidence_items),
        "methodological_transparency": _factor_methodological_transparency(metrics, claims),
        "external_assurance": _factor_external_assurance(claims, evidence_items),
        "cross_source_consistency": _factor_cross_source_consistency(cross_doc_results),
        "traceability": _factor_traceability(metrics, claims),
        "independent_verification": _factor_independent_verification(external_checks),
    }

    raw_score = sum(factors[k] * _CONFIDENCE_WEIGHTS[k] for k in _CONFIDENCE_WEIGHTS) * 100
    score = round(_clamp(raw_score, 0.0, 100.0))

    if not evidence_items:
        label = "INSUFFICIENT"
    elif score >= 75:
        label = "HIGH"
    elif score >= 50:
        label = "MODERATE"
    elif score >= 25:
        label = "LOW"
    else:
        label = "INSUFFICIENT"

    if not evidence_items:
        explanation = "Insufficient confidence — no evidence has been submitted for this question yet."
    else:
        strongest = max(factors, key=lambda k: factors[k])
        weakest = min(factors, key=lambda k: factors[k])
        explanation = (
            f"{label.title()} confidence — strongest on {_FACTOR_LABELS[strongest]} "
            f"({factors[strongest]:.0%}), weakest on {_FACTOR_LABELS[weakest]} ({factors[weakest]:.0%})."
        )

    return {
        "score": score,
        "label": label,
        "explanation": explanation,
        "factors": {k: round(v, 3) for k, v in factors.items()},
        "methodology_version": CONFIDENCE_METHODOLOGY_VERSION,
    }


def classify_evidence_status(item) -> EvidenceStatus:
    if item.contradictory:
        return EvidenceStatus.CONTRADICTORY
    if item.verified:
        return EvidenceStatus.VERIFIED
    if getattr(item, "evidence_source", "") and item.evidence_type != "self_declared":
        return EvidenceStatus.PARTIALLY_VERIFIED
    return EvidenceStatus.UNVERIFIED


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))
