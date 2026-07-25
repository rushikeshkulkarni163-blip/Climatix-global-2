"""
Climactix — Risk OS Evidence Graph
====================================
A scoped cross-question consistency check, not a generic graph database.

Builds a small set of real nodes (Entity, Geography, Question, Evidence)
from data that already exists in Firestore for one assessment, and writes
edges between them. Every node/edge is derived from a field already
collected elsewhere (ros_companies_v1.hqCountry/jurisdictions,
ros_answers_v1, ros_evidence_v1) — this module does NOT invent an
asset-level register or geocoding data that was never actually captured
anywhere in the product (climate-risk-os.html's asset-register questions
are status-only; no lat/long field exists in the schema today).

The one concrete cross-question inconsistency this module can honestly
detect given what's actually collected: S05-Q02 ("has the entity
identified all assets exposed to high/extreme acute physical risk...")
answered NOT_ADDRESSED/NA, while S05-Q04 (a NUMERIC "% of revenue in
HIGH/EXTREME risk geographies") discloses a value > 0 — the entity has
quantified exposure in one answer while denying having assessed it in
another. This is the spec's worked example ("claims no material physical
exposure but discloses exposure elsewhere"), grounded in two real
status/numeric fields rather than a fabricated asset register.
"""

from __future__ import annotations

from typing import Optional

# Physical Climate Risk Exposure section (S05) questions this module reads —
# real question IDs from climate-risk-os.html's inline question bank.
_PHYSICAL_QUESTION_IDS = ["S05-Q01", "S05-Q02", "S05-Q03", "S05-Q04", "S05-Q05", "S05-Q06", "S05-Q10"]


def _status_of(raw_answer):
    """Mirrors climate-risk-os.html's _statusOf(): select5 answers are
    {status, ...} objects; every other question type stores the raw value
    itself (e.g. a plain numeric string for a 'number' question)."""
    if isinstance(raw_answer, dict):
        return raw_answer.get("status")
    return raw_answer


def build_evidence_graph(db, assessment_id: str) -> dict:
    """
    Reads real data for one assessment and returns
      { nodes: [...], contradiction: {...} | None }
    Caller (main.py's compute_evidence_graph trigger) persists nodes to
    ros_evidence_graph_v1 and, if present, the contradiction to
    ros_contradiction_flags_v1.
    """
    assessment_snap = db.collection("ros_assessments_v1").document(assessment_id).get()
    if not assessment_snap.exists:
        return {"nodes": [], "contradiction": None}
    company_id = assessment_snap.to_dict().get("companyId")

    company_snap = db.collection("ros_companies_v1").document(company_id).get()
    company = company_snap.to_dict() if company_snap.exists else {}

    def _answer(question_id: str):
        doc = db.collection("ros_answers_v1").document(f"{assessment_id}_{question_id}").get()
        return doc.to_dict().get("rawAnswer") if doc.exists else None

    evidence_docs = list(
        db.collection("ros_evidence_v1").where("assessmentId", "==", assessment_id).stream()
    )

    nodes = []

    entity_node_id = f"entity_{company_id}"
    entity_edges = []
    nodes.append({
        "nodeType": "entity", "nodeId": entity_node_id,
        "label": company.get("name") or "Entity",
        "edges": entity_edges,
    })

    geography_ids: list[str] = []
    hq = company.get("hqCountry")
    if hq:
        geo_id = f"geo_{hq}"
        geography_ids.append(geo_id)
        nodes.append({"nodeType": "geography", "nodeId": geo_id, "label": hq, "edges": []})
    for j in (company.get("jurisdictions") or []):
        geo_id = f"geo_{j}"
        if j and geo_id not in geography_ids:
            geography_ids.append(geo_id)
            nodes.append({"nodeType": "geography", "nodeId": geo_id, "label": j, "edges": []})
    for geo_id in geography_ids:
        entity_edges.append({"toType": "geography", "toId": geo_id, "relation": "operates_in"})

    question_answers = {qid: _answer(qid) for qid in _PHYSICAL_QUESTION_IDS}
    for qid, raw in question_answers.items():
        if raw is None:
            continue
        edges = [
            {"toType": "geography", "toId": geo_id, "relation": "assessed_for"}
            for geo_id in geography_ids
        ]
        nodes.append({"nodeType": "question", "nodeId": f"question_{qid}", "label": qid, "edges": edges})

    for ev in evidence_docs:
        ev_data = ev.to_dict()
        ev_qid = ev_data.get("questionId")
        edges = (
            [{"toType": "question", "toId": f"question_{ev_qid}", "relation": "supports"}]
            if ev_qid in _PHYSICAL_QUESTION_IDS else []
        )
        nodes.append({
            "nodeType": "evidence", "nodeId": f"evidence_{ev.id}",
            "label": ev_data.get("originalName") or ev_data.get("filename"),
            "edges": edges,
        })

    # ── The one concrete, real cross-question check this module makes ──
    contradiction: Optional[dict] = None
    denial_status = _status_of(question_answers.get("S05-Q02"))
    exposure_pct_raw = question_answers.get("S05-Q04")
    try:
        exposure_pct = float(exposure_pct_raw) if exposure_pct_raw not in (None, "") else None
    except (TypeError, ValueError):
        exposure_pct = None

    if denial_status in ("NOT_ADDRESSED", "NA") and exposure_pct is not None and exposure_pct > 0:
        contradiction = {
            "ruleId": "GRAPH01",
            "severity": "HIGH",
            "questionIds": ["S05-Q02", "S05-Q04"],
            "sourceType": "graph",
            "summary": (
                f"S05-Q02 (identification of assets exposed to acute physical risk) is marked "
                f"{denial_status}, but S05-Q04 discloses {exposure_pct:.0f}% of revenue is generated "
                f"in HIGH/EXTREME physical-risk geographies — the entity has quantified exposure in "
                f"one answer while denying having assessed it in another."
            ),
        }

    return {"nodes": nodes, "contradiction": contradiction}
