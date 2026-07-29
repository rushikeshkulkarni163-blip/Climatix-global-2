"""
Climactix — Greenwashing Signal Engine
=========================================
Part of the Climactix Evidence Intelligence Agent (see evidence_intelligence_agent.py).

Spec §9: classify findings from every upstream engine (greenwashing_scanner's
F001-F009 rule flags, contradiction_detector's rule + LLM findings and
cross-document reconciliation, missing-evidence/gap findings, and a handful
of new deterministic checks this module adds directly) into ONE unified
taxonomy:

  Informational | Evidence Gap | Weak Evidence | Potential Contradiction |
  Material Contradiction | Potential Greenwashing Signal

This module does not run a second, independent LLM greenwashing pass — that
would risk a second pipeline silently disagreeing with the production
greenwashing_scanner. It classifies and relabels what the existing engines
already found, and adds a small set of new deterministic (non-LLM) checks
for patterns the existing engines don't cover: offset dependency without an
emissions inventory, renewable claims without procurement evidence, and
afforestation claims without survival monitoring (reusing
geospatial_validation.py's structural check).

Hard rule (spec §9): never accuse. Every "Potential Greenwashing Signal"
finding is phrased as a hedge — "requiring further verification" — never a
direct claim that the company is greenwashing.
"""

from __future__ import annotations

TAXONOMY = (
    "Informational", "Evidence Gap", "Weak Evidence", "Potential Contradiction",
    "Material Contradiction", "Potential Greenwashing Signal",
)

_HEDGE_SUFFIX = " Potential greenwashing signal requiring further verification."


def _signal(category: str, severity: str, title: str, description: str, source_engine: str) -> dict:
    if category not in TAXONOMY:
        category = "Informational"
    return {
        "category": category,
        "severity": severity,
        "title": title,
        "description": description if category != "Potential Greenwashing Signal" else description.rstrip(".") + "." + _HEDGE_SUFFIX,
        "source_engine": source_engine,
    }


# ── Mapping existing engines' output into the unified taxonomy ─────────────

_SCANNER_SEVERITY_TO_CATEGORY = {
    "High": "Potential Greenwashing Signal",
    "Medium": "Weak Evidence",
    "Low": "Informational",
}

_CONTRADICTION_SEVERITY_TO_CATEGORY = {
    "Critical": "Material Contradiction",
    "High": "Material Contradiction",
    "Medium": "Potential Contradiction",
    "Low": "Informational",
}

_CROSS_DOC_CLASS_TO_CATEGORY = {
    "legitimate_yoy_change": "Informational", "restatement": "Informational",
    "methodology_change": "Informational", "acquisition_divestment": "Informational",
    "boundary_change": "Informational", "reporting_error": "Potential Contradiction",
    "unexplained_contradiction": "Material Contradiction",
}


def from_scanner_flags(risk_flags: list) -> list:
    """Maps greenwashing_scanner.py's F001-F009 flags (severity High/Medium/Low)
    into the unified taxonomy."""
    out = []
    for f in risk_flags or []:
        category = _SCANNER_SEVERITY_TO_CATEGORY.get(f.get("severity", "Low"), "Informational")
        out.append(_signal(
            category, f.get("severity", "Low"), f.get("title", f.get("flag_id", "Flag")),
            f.get("description", ""), "greenwashing_scanner",
        ))
    return out


def from_contradictions(contradictions: list) -> list:
    """Maps contradiction_detector.py's rule + LLM findings (severity
    Critical/High/Medium/Low) into the unified taxonomy."""
    out = []
    for c in contradictions or []:
        severity = c.get("severity", "Medium")
        category = _CONTRADICTION_SEVERITY_TO_CATEGORY.get(severity, "Potential Contradiction")
        title = c.get("contradiction_type", "Contradiction").replace("_", " ").replace("LLM-", "")
        description = c.get("narrative_claim", "") and c.get("operational_reality", "") and (
            f"Claimed: \"{c['narrative_claim']}\" — evidence shows: \"{c['operational_reality']}\"."
        ) or c.get("operational_reality") or c.get("narrative_claim") or ""
        out.append(_signal(category, severity, title, description, "contradiction_detector"))
    return out


def from_cross_document_results(cross_doc_results: list) -> list:
    """Maps contradiction_detector.compare_claims_across_evidence() results
    into the unified taxonomy — legitimate explanations stay Informational;
    only unexplained gaps escalate."""
    out = []
    for r in cross_doc_results or []:
        category = _CROSS_DOC_CLASS_TO_CATEGORY.get(r.get("classification"), "Potential Contradiction")
        out.append(_signal(
            category, r.get("severity", "Medium"),
            f"Cross-document reconciliation: {r.get('classification', 'unclassified').replace('_', ' ')}",
            r.get("explanation", ""), "cross_document_verification",
        ))
    return out


def from_missing_evidence(evidence_gap_text: str) -> list:
    if not evidence_gap_text or not evidence_gap_text.strip():
        return []
    return [_signal("Evidence Gap", "Medium", "Missing disclosure", evidence_gap_text.strip(), "find_gaps")]


# ── New deterministic checks (no additional LLM call) ───────────────────────

def _offset_dependency_check(claims: list, metrics: list) -> list:
    """Spec §9: 'carbon neutrality claims without emissions inventory' /
    'heavy reliance on offsets'. Deterministic: a net-zero/carbon-neutral
    claim is present, offset/credit metrics are present, but no Scope 1/2/3
    metric with an actual value is present alongside it."""
    claim_types = {(c.get("claim_type") or "").lower() for c in (claims or [])}
    has_neutrality_claim = any("net zero" in t or "carbon neutral" in t for t in claim_types)
    if not has_neutrality_claim:
        return []
    metric_names = {(m.get("metric") or "").lower() for m in (metrics or [])}
    has_offsets = any("offset" in n or "credit" in n for n in metric_names)
    has_scope_inventory = any(n.startswith("scope") for n in metric_names)
    if has_offsets and not has_scope_inventory:
        return [_signal(
            "Potential Greenwashing Signal", "High",
            "Offset dependency without disclosed emissions inventory",
            "A net-zero/carbon-neutrality claim is supported by offset/credit references, but no "
            "Scope 1/2/3 emissions inventory with an actual reported value was found in the evidence "
            "reviewed — the underlying emissions baseline this claim would be measured against is not established.",
            "greenwashing_signals",
        )]
    return []


def _renewable_procurement_check(claims: list, metrics: list) -> list:
    """Spec §9: 'renewable claims without procurement evidence'."""
    claim_types = {(c.get("claim_type") or "").lower() for c in (claims or [])}
    has_renewable_claim = any("renewable" in t for t in claim_types)
    if not has_renewable_claim:
        return []
    metric_names = {(m.get("metric") or "").lower() for m in (metrics or [])}
    has_procurement_evidence = any("renewable energy %" in n or "certificate" in n or "rec" in n for n in metric_names)
    if not has_procurement_evidence:
        return [_signal(
            "Weak Evidence", "Medium",
            "Renewable energy claim without procurement evidence",
            "A renewable energy claim was identified, but no supporting renewable energy percentage, "
            "REC, or procurement figure was found in the evidence reviewed.",
            "greenwashing_signals",
        )]
    return []


def _afforestation_monitoring_check(structural_gaps: list) -> list:
    """Spec §9: 'tree-planting claims without survival monitoring'. Reuses
    geospatial_validation.validate_afforestation_claim()'s missing_fields."""
    out = []
    for gap in structural_gaps or []:
        missing = gap.get("missing_fields", [])
        relevant_missing = [m for m in missing if "survival" in m.lower() or "monitoring" in m.lower() or "mortality" in m.lower()]
        if relevant_missing:
            out.append(_signal(
                "Evidence Gap", "Medium",
                "Afforestation claim missing survival/monitoring data",
                f"Missing: {', '.join(relevant_missing)}. {gap.get('caveat', '')}",
                "geospatial_validation",
            ))
    return out


def build_greenwashing_signals(
    risk_flags: list = None,
    contradictions: list = None,
    cross_doc_results: list = None,
    evidence_gap_text: str = None,
    claims: list = None,
    metrics: list = None,
    structural_gaps: list = None,
) -> list:
    """
    Main entry point for the Evidence Intelligence Agent (spec §9).
    Composes signals from every upstream engine plus the deterministic
    checks above into one unified, taxonomy-classified list. Order is
    most-severe-relevant first is NOT guaranteed here — the orchestrator
    (evidence_intelligence_agent.py) sorts by severity for display.
    """
    signals = []
    signals.extend(from_scanner_flags(risk_flags))
    signals.extend(from_contradictions(contradictions))
    signals.extend(from_cross_document_results(cross_doc_results))
    signals.extend(from_missing_evidence(evidence_gap_text))
    signals.extend(_offset_dependency_check(claims, metrics))
    signals.extend(_renewable_procurement_check(claims, metrics))
    signals.extend(_afforestation_monitoring_check(structural_gaps))
    return signals
