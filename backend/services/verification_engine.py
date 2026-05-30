"""
Climactix Global — Verification & Evidence Engine v1.0
Assesses evidence quality for every claim in an assessment.
Every answer must be traceable to a source — no black-box scoring.
Proprietary IP of Climactix Global. All rights reserved.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import List, Dict
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
