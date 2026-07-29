"""
Climactix Evidence Intelligence Agent — Orchestrator
=======================================================
The top-level pipeline behind the "Climactix Evidence Intelligence Agent"
shown in the product UI. Composes every engine in this package into one
structured, auditable result for a single assessment question's evidence
bundle (spec §17, ten-stage pipeline; spec §18, the CLAIM ≠ EVIDENCE ≠
VERIFIED FACT discipline that must survive every stage):

  1. Ingestion         — caller already extracted text per evidence item
                          (extractor.py, incl. OCR/URL) before calling this.
  2. Extraction        — claim_intelligence.py + metric_intelligence.py
  3. Evidence Mapping   — does each item directly/partially/contextually
                          answer the question, or is it a gap/irrelevant
  4. Verification       — greenwashing_scanner + contradiction_detector
                          (within-document) + verification_engine
  5. External Research  — external_verification.py (stubbed, honest)
  6. Environmental Intel — geospatial_validation.py (structural real,
                          dataset cross-check stubbed)
  7. Contradiction       — contradiction_detector.py (within-doc rules/LLM
                          + compare_claims_across_evidence cross-document)
  8. Greenwashing Risk   — greenwashing_signals.py (unified taxonomy)
  9. Scoring             — verification_engine.compute_evidence_confidence
  10. Analyst Review      — this module's own recommendation composer; NEVER
                          overwrites the entity's own response (spec §10/§18).

Every field in the result is traceable to one of these calls — nothing is
invented at the orchestration layer itself.
"""

from __future__ import annotations

from typing import Optional

from services import claim_intelligence
from services import metric_intelligence
from services import contradiction_detector
from services import external_verification
from services import geospatial_validation
from services import greenwashing_signals as gw_signals
from services import verification_engine
from services.greenwashing_scanner import scan_for_greenwashing

_SEVERITY_RANK = {"Critical": 4, "High": 3, "Medium": 2, "Low": 1, "None": 0}
_SIGNAL_CATEGORY_RANK = {
    "Potential Greenwashing Signal": 5, "Material Contradiction": 4,
    "Potential Contradiction": 3, "Weak Evidence": 2, "Evidence Gap": 1, "Informational": 0,
}

# Metrics whose presence in an evidence bundle is a strong afforestation
# signal — used to assemble the structural check input for
# geospatial_validation.validate_afforestation_claim without requiring a
# separate, bespoke afforestation-extraction LLM call.
_AFFORESTATION_METRIC_MAP = {
    "trees planted": "number_planted", "land restored": "area",
    "survival rate": "survival_rate", "mortality rate": "mortality_rate",
}


def _safe(stage_name: str, fn, default):
    """Runs one pipeline stage; on failure, returns `default` plus a note —
    one failing stage (e.g. LLM timeout) must not take down the whole
    Evidence Intelligence result, but the failure must still be visible to
    the analyst rather than silently hidden."""
    try:
        return fn(), None
    except Exception as e:
        return default, f"{stage_name} unavailable: {e}"


def _combined_text(evidence_items: list, limit: int = 12000) -> str:
    parts = []
    for item in evidence_items:
        label = item.get("source_label") or item.get("filename") or item.get("id", "evidence")
        parts.append(f"=== SOURCE: {label} ===\n{item.get('text', '')}")
    return "\n\n".join(parts)[:limit]


def _per_document_metrics(evidence_items: list) -> dict:
    """Returns {evidence_item_id: metrics_list} — kept separate from the
    combined-text metrics so cross-document reconciliation can compare the
    SAME metric across DIFFERENT sources (spec §5), not just see one merged
    number."""
    out = {}
    for item in evidence_items:
        text = item.get("text", "")
        if not text.strip():
            out[item["id"]] = []
            continue
        result, _ = _safe(f"metric extraction ({item.get('id')})",
                           lambda t=text: metric_intelligence.extract_structured_metrics(t), {"metrics": []})
        out[item["id"]] = result.get("metrics", [])
    return out


def _build_cross_document_observations(per_doc_metrics: dict, evidence_items: list, entity_response: Optional[dict]) -> dict:
    """Groups every per-document metric by canonical metric name, adding the
    assessment's own declared answer as one more observation when it's a
    numeric response — this is the spec §5 worked example (2024 report vs
    2025 report vs assessment response, all for the same metric)."""
    by_metric: dict[str, list] = {}
    id_to_label = {i["id"]: (i.get("source_label") or i.get("filename") or i["id"]) for i in evidence_items}
    for doc_id, metrics in per_doc_metrics.items():
        for m in metrics:
            entry = dict(m)
            entry["source"] = id_to_label.get(doc_id, doc_id)
            by_metric.setdefault(m["metric"], []).append(entry)

    if entity_response and entity_response.get("numeric_value") is not None:
        # Attach the assessment's own declared value to every metric bucket
        # whose name plausibly matches the question's own metric label, if
        # the caller told us which one (entity_response["metric_name"]).
        metric_name = entity_response.get("metric_name")
        if metric_name and metric_name in by_metric:
            by_metric[metric_name].append({
                "value": str(entity_response["numeric_value"]), "unit": entity_response.get("unit", ""),
                "reporting_period": entity_response.get("reporting_period"), "boundary": None,
                "methodology": None, "source": "Assessment Response",
            })
    return by_metric


def run_evidence_intelligence(
    question_id: str,
    question_text: str,
    entity_response: dict,
    evidence_items: list,
    facility: Optional[dict] = None,
    company_name: str = "The Company",
) -> dict:
    """
    Main entry point — the "Climactix Evidence Intelligence Agent" pipeline.

    `entity_response`: {"status": ..., "justification": ..., "numeric_value":
      optional float, "metric_name": optional str, "unit": optional str,
      "reporting_period": optional str} — the company's own declared answer,
      always shown separately in the result and never overwritten.
    `evidence_items`: [{"id", "filename"/"source_label", "text" (already
      extracted), "evidence_type" (regulatory/third_party/audited/document/
      report/website/self_declared), "reporting_period", "document_category"}]
    `facility`: optional dict from ros_facilities_v1 (name, country,
      latitude, longitude, area, asset_identifier).

    Returns the full structured result described in the module docstring.
    """
    notes = []

    if not evidence_items:
        # Spec §18 hard rule: no evidence submitted is an evidence gap, not
        # proof of anything — return a minimal, honest result rather than
        # running (and mis-scoring) an empty pipeline.
        confidence = verification_engine.compute_evidence_confidence([])
        return {
            "question_id": question_id,
            "entity_response": entity_response,
            "evidence_reviewed": [],
            "extracted_claims": [],
            "extracted_metrics": [],
            "evidence_confidence": confidence,
            "external_cross_check": [],
            "cross_document_contradictions": [],
            "durable_contradictions": [],
            "greenwashing_signals": [],
            "missing_evidence": ["No evidence has been uploaded, linked, or sourced for this question yet."],
            "agent_recommendation": "No evidence available — the entity's declared response cannot be independently assessed at this time.",
            "recommended_score": None,
            "analyst_review_required": True,
            "analyst_review_reason": "No evidence submitted.",
            "pipeline_notes": notes,
        }

    combined_text = _combined_text(evidence_items)

    # Stage 2 — Extraction
    claims, note = _safe("Claim extraction", lambda: claim_intelligence.extract_structured_claims(combined_text, company_name), [])
    if note: notes.append(note)

    per_doc_metrics = _per_document_metrics(evidence_items)
    all_metrics = [m for doc_metrics in per_doc_metrics.values() for m in doc_metrics]

    # Stage 4 (part 1) — within-document greenwashing scan (reused production pipeline)
    scan, note = _safe("Greenwashing scan", lambda: scan_for_greenwashing(combined_text, company_name), {
        "claims_detected": [], "data_extracted": {}, "risk_flags": [], "missing_disclosures": [],
    })
    if note: notes.append(note)

    # Stage 7 (part 1) — within-document contradictions
    contradiction_result, note = _safe(
        "Contradiction detection",
        lambda: contradiction_detector.detect_contradictions(
            scan.get("claims_detected", []), scan.get("data_extracted", {}), combined_text, company_name,
        ),
        {"contradictions": [], "overall_severity": "None"},
    )
    if note: notes.append(note)

    # Stage 7 (part 2) — cross-document reconciliation (spec §5)
    observations_by_metric = _build_cross_document_observations(per_doc_metrics, evidence_items, entity_response)
    cross_doc_results = []
    for metric_name, observations in observations_by_metric.items():
        if len(observations) < 2:
            continue
        result, note = _safe(
            f"Cross-document reconciliation ({metric_name})",
            lambda mn=metric_name, obs=observations: contradiction_detector.compare_claims_across_evidence(mn, obs),
            None,
        )
        if note:
            notes.append(note)
        elif result:
            cross_doc_results.append({"metric": metric_name, **result})

    # Stage 5 — External research (stubbed, honest — spec §6)
    external_checks = []
    for item in (claims[:3] + all_metrics[:3]):
        result, note = _safe("External cross-check", lambda i=item: external_verification.cross_check_external(i), None)
        if note:
            notes.append(note)
        elif result:
            external_checks.append({
                "item": item.get("claim") or item.get("metric"),
                "status": result.status, "source_category": result.source_category,
                "reason": result.reason,
            })

    # Stage 6 — Environmental / geospatial intelligence (spec §7)
    geospatial_result = None
    structural_gaps = []
    if facility:
        geospatial_result, note = _safe("Geospatial cross-check", lambda: geospatial_validation.cross_check_geospatial(facility), None)
        if note:
            notes.append(note)

    afforestation_fields = {}
    for m in all_metrics:
        key = _AFFORESTATION_METRIC_MAP.get((m.get("metric") or "").lower())
        if key:
            afforestation_fields[key] = m.get("value")
    if facility:
        afforestation_fields.setdefault("location", facility.get("name") or facility.get("country"))
    if afforestation_fields:
        gap_result = geospatial_validation.validate_afforestation_claim(afforestation_fields)
        if gap_result.missing_fields:
            structural_gaps.append({
                "missing_fields": gap_result.missing_fields,
                "present_fields": gap_result.present_fields,
                "caveat": gap_result.caveat,
            })

    # Stage 9 — Evidence Confidence Score (spec §8)
    verif_evidence_items = [
        {"evidence_type": item.get("evidence_type", "self_declared"), "reporting_period": item.get("reporting_period")}
        for item in evidence_items
    ]
    confidence, note = _safe(
        "Confidence scoring",
        lambda: verification_engine.compute_evidence_confidence(
            verif_evidence_items, metrics=all_metrics, claims=claims,
            external_checks=external_checks, cross_doc_results=cross_doc_results,
        ),
        {"score": 0, "label": "INSUFFICIENT", "explanation": "Confidence scoring unavailable.", "factors": {}},
    )
    if note: notes.append(note)

    # Stage 8 — Greenwashing Signal Engine (spec §9)
    # map_frameworks() (inside scan_for_greenwashing) returns each gap as
    # {framework, requirement, description} — not a plain string.
    missing_disclosures = scan.get("missing_disclosures", [])
    missing_disclosure_labels = [
        f"{d.get('framework', '')}: {d.get('requirement', '')}".strip(": ")
        for d in missing_disclosures if isinstance(d, dict)
    ] or [str(d) for d in missing_disclosures]
    evidence_gap_text = "; ".join(missing_disclosure_labels[:5]) if missing_disclosure_labels else ""
    signals = gw_signals.build_greenwashing_signals(
        risk_flags=scan.get("risk_flags", []),
        contradictions=contradiction_result.get("contradictions", []),
        cross_doc_results=cross_doc_results,
        evidence_gap_text=evidence_gap_text,
        claims=claims, metrics=all_metrics, structural_gaps=structural_gaps,
    )
    signals.sort(key=lambda s: _SIGNAL_CATEGORY_RANK.get(s["category"], 0), reverse=True)

    # Missing evidence — union of framework gaps + untraceable metrics + structural gaps
    missing_evidence = list(missing_disclosure_labels[:5])
    for m in all_metrics:
        if m.get("verification_status") == "SOURCE TRACEABILITY INSUFFICIENT":
            missing_evidence.append(f"{m['metric']}: SOURCE TRACEABILITY INSUFFICIENT — no locator found.")
    for gap in structural_gaps:
        missing_evidence.extend(f"Afforestation claim missing: {f}" for f in gap["missing_fields"])

    # Stage 10 — Analyst recommendation (never overwrites entity_response)
    overall_contradiction_severity = contradiction_result.get("overall_severity", "None")
    material_signal_present = any(s["category"] in ("Material Contradiction", "Potential Greenwashing Signal") for s in signals)
    analyst_review_required = (
        material_signal_present
        or _SEVERITY_RANK.get(overall_contradiction_severity, 0) >= _SEVERITY_RANK["High"]
        or confidence["label"] in ("LOW", "INSUFFICIENT")
    )
    reasons = []
    if material_signal_present:
        reasons.append("material contradiction or greenwashing signal identified")
    if _SEVERITY_RANK.get(overall_contradiction_severity, 0) >= _SEVERITY_RANK["High"]:
        reasons.append(f"overall contradiction severity is {overall_contradiction_severity}")
    if confidence["label"] in ("LOW", "INSUFFICIENT"):
        reasons.append(f"evidence confidence is {confidence['label']}")
    analyst_review_reason = "; ".join(reasons) if reasons else "Routine review — no material flags identified."

    recommendation_parts = [
        f"Evidence Confidence: {confidence['score']}/100 – {confidence['label']}. {confidence['explanation']}"
    ]
    if signals:
        top_signal = signals[0]
        recommendation_parts.append(f"Most material finding: {top_signal['title']} ({top_signal['category']}).")
    if missing_evidence:
        recommendation_parts.append(f"{len(missing_evidence)} evidence gap(s) identified.")
    agent_recommendation = " ".join(recommendation_parts)

    # Recommended score: Evidence Confidence bounded by the greenwashing
    # signal profile — never higher than confidence allows, and never a
    # silent substitute for the (separate) Performance Score computed
    # elsewhere in the assessment (spec §16 — kept distinct on purpose).
    recommended_score = confidence["score"]
    if any(s["category"] == "Material Contradiction" for s in signals):
        recommended_score = min(recommended_score, 40)
    elif any(s["category"] == "Potential Greenwashing Signal" for s in signals):
        recommended_score = min(recommended_score, 55)

    return {
        "question_id": question_id,
        "entity_response": entity_response,
        "evidence_reviewed": [
            {"id": i.get("id"), "label": i.get("source_label") or i.get("filename"), "evidence_type": i.get("evidence_type")}
            for i in evidence_items
        ],
        "extracted_claims": claims,
        "extracted_metrics": all_metrics,
        "evidence_confidence": confidence,
        "external_cross_check": external_checks,
        "geospatial_cross_check": (
            {"status": geospatial_result.status, "reason": geospatial_result.reason} if geospatial_result else None
        ),
        "cross_document_contradictions": cross_doc_results,
        "durable_contradictions": contradiction_result.get("contradictions", []),
        "greenwashing_signals": signals,
        "missing_evidence": missing_evidence,
        "agent_recommendation": agent_recommendation,
        "recommended_score": recommended_score,
        "analyst_review_required": analyst_review_required,
        "analyst_review_reason": analyst_review_reason,
        "pipeline_notes": notes,
    }
