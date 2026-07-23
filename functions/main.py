"""
Climactix — Risk OS Firebase Cloud Functions (Python, 2nd gen)
==================================================================
The pieces of Risk OS collaboration that genuinely cannot live in the
client + Firestore security rules: AI evidence review needs a secret
OPENAI_API_KEY, and the materiality scan / entity ownership rollup must be
computed somewhere a client can't spoof (see firestore.rules — both
ros_ai_reviews_v1 and ros_materiality_scans_v1 deny client writes entirely,
and ros_entities_v1 denies client writes to its two derived fields).
Everything else (companies, assessments, answers, comments, tasks, risk
notes) is plain client SDK reads/writes against Firestore, governed by
../firestore.rules — see RISK_OS_COLLABORATION_ARCHITECTURE.md.

services/ here (extractor.py, greenwashing_scanner.py,
esg_framework_intelligence.py, risk_os_ai_review.py, industry_ontology.py)
are synced copies of backend/services/* — Cloud Functions deploys only
package files inside functions/, so they can't be imported from ../backend
directly. Keep the two copies in sync by hand until a shared-package build
step replaces this (noted as a known limitation in the architecture doc).
"""

from __future__ import annotations

import hashlib

import firebase_admin
from firebase_admin import credentials, firestore, storage
from firebase_functions import firestore_fn, https_fn, options
from firebase_functions.params import SecretParam

from services.risk_os_ai_review import run_ai_review
from services.industry_ontology import get_industry_config

firebase_admin.initialize_app()

OPENAI_API_KEY = SecretParam("OPENAI_API_KEY")

VALID_REVIEW_TYPES = {
    "summarize", "extract_data", "find_gaps", "contradictions",
    "framework_mapping", "confidence_score", "exec_summary", "compare_previous",
}


@https_fn.on_call(
    region="us-central1",
    memory=options.MemoryOption.MB_512,
    timeout_sec=120,
    secrets=[OPENAI_API_KEY],
)
def request_evidence_ai_review(req: https_fn.CallableRequest) -> dict:
    """
    Callable from the client as:
      httpsCallable(functions, 'request_evidence_ai_review')({ evidenceId, reviewType, questionText })

    Firebase callable functions verify the caller's ID token automatically
    before this code runs — req.auth.uid is already a verified Firebase uid,
    not a client-supplied claim.
    """
    if req.auth is None:
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.UNAUTHENTICATED, "Sign in required.")

    data = req.data or {}
    evidence_id = data.get("evidenceId")
    review_type = data.get("reviewType")
    question_text = data.get("questionText", "")

    if not evidence_id or not review_type:
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
                                   "evidenceId and reviewType are required.")
    if review_type not in VALID_REVIEW_TYPES:
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
                                   f"reviewType must be one of {sorted(VALID_REVIEW_TYPES)}.")

    db = firestore.client()

    evidence_ref = db.collection("ros_evidence_v1").document(evidence_id)
    evidence = evidence_ref.get()
    if not evidence.exists:
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.NOT_FOUND, "Evidence not found.")
    evidence_data = evidence.to_dict()
    company_id = evidence_data["companyId"]

    # RBAC: same membership check firestore.rules uses for reads — the
    # function runs with Admin privileges, so it must enforce this itself.
    member_ref = db.collection("ros_members_v1").document(f"{company_id}_{req.auth.uid}")
    if not member_ref.get().exists:
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.PERMISSION_DENIED,
                                   "Not a member of this company.")

    bucket = storage.bucket()
    blob = bucket.blob(evidence_data["storagePath"])
    if not blob.exists():
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
                                   "Stored file is no longer available.")
    content = blob.download_as_bytes()

    prior_summary = None
    if review_type == "compare_previous" and evidence_data.get("supersedesId"):
        prior_reviews = (
            db.collection("ros_ai_reviews_v1")
            .where("evidenceId", "==", evidence_data["supersedesId"])
            .where("reviewType", "in", ["summarize", "exec_summary"])
            .order_by("createdAt", direction=firestore.Query.DESCENDING)
            .limit(1)
            .get()
        )
        if prior_reviews:
            prior_summary = prior_reviews[0].to_dict().get("outputSummary")

    try:
        result = run_ai_review(
            review_type,
            content=content,
            filename=evidence_data.get("filename", "document"),
            content_type=evidence_data.get("fileType") or "",
            question_text=question_text,
            prior_summary=prior_summary,
        )
    except ValueError as e:
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.INVALID_ARGUMENT, str(e))
    except RuntimeError as e:
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
                                   f"AI review unavailable: {e}")

    review_doc = {
        "evidenceId": evidence_id,
        "assessmentId": evidence_data.get("assessmentId"),
        "questionId": evidence_data.get("questionId"),
        "companyId": company_id,
        "reviewType": review_type,
        "outputSummary": result["output_summary"],
        "extractedData": result["extracted_data"],
        "contradictions": result["contradictions"],
        "confidenceScore": result["confidence_score"],
        "modelUsed": result["model_used"],
        "requestedBy": req.auth.uid,
        "createdAt": firestore.SERVER_TIMESTAMP,
    }
    _, review_ref = db.collection("ros_ai_reviews_v1").add(review_doc)

    return {"id": review_ref.id, **{k: v for k, v in review_doc.items() if k != "createdAt"}}


# ── Initial Materiality Scan ─────────────────────────────────────────────
# Section 41 of the Risk OS institutional assessment spec: runs once per
# assessment, before the questionnaire, and gates which question pathways
# are emphasized. Deterministic and sector-driven — NOT an LLM call, and
# NOT a second materiality model invented from scratch: it reuses
# industry_ontology.py's existing pillar_weights (already the proprietary
# data driving C-LAYER score weighting) so the "why is this material"
# answer is always traceable to a real, disclosed number rather than a
# fabricated one.
#
# Rule: weight >= 0.25 -> CRITICAL, >= 0.18 -> HIGH, >= 0.12 -> MEDIUM, else
# LOW. c_capital (Carbon & Capital Allocation) inherits transition_risk's
# level — carbon exposure and capital-allocation pressure move together in
# this ontology, there's no separate weight for it. c_supply (Supply Chain
# Fragility) is HIGH if the sector's material_indicators mention supply
# chain, else MEDIUM — no sector in this ontology has immaterial supply
# chain risk, so LOW is never assigned here.
# climate-risk-os.html's entity form stores the sector <select>'s visible
# label as ros_companies_v1.sector (no separate value attribute — pre-
# existing behavior, not changed here to avoid breaking already-created
# company records). industry_ontology.py's IndustryConfig is keyed by short
# codes instead, so this scan would silently resolve every company to
# "default" without this explicit mapping. "Aviation & Shipping" and
# "Transport & Logistics" have no single clean match (the ontology scores
# aviation and shipping differently) — mapped to "default" rather than
# guessing one and silently misrepresenting the other; the scan doc's
# industryCode/industryLabel make that fallback visible instead of hiding it.
_SECTOR_LABEL_TO_CODE = {
    "Banking & Financial Services": "banking",
    "Insurance": "insurance",
    "Energy (Oil & Gas)": "oil_gas",
    "Renewable Energy": "renewables",
    "Mining & Metals": "mining",
    "Chemicals & Materials": "chemicals",
    "Manufacturing & Industrials": "manufacturing",
    "Real Estate & Infrastructure": "real_estate",
    "Agriculture & Food": "agriculture",
    "Technology & Data Centers": "it_technology",
    "Retail & Consumer": "retail_consumer",
    "Healthcare & Pharmaceuticals": "pharmaceuticals",
    "Construction & Engineering": "construction",
    "Utilities (Water, Waste, Grid)": "energy",
}

_PILLAR_TO_CLAYER = {
    "governance": "c_core",
    "physical_risk": "c_risk_p",
    "transition_risk": "c_risk_t",
    "disclosure": "c_truth",
    "resilience": "c_adapt",
    "financial_materiality": "c_fin",
}


def _materiality_level(weight: float) -> str:
    if weight >= 0.25:
        return "CRITICAL"
    if weight >= 0.18:
        return "HIGH"
    if weight >= 0.12:
        return "MEDIUM"
    return "LOW"


@https_fn.on_call(region="us-central1", memory=options.MemoryOption.MB_256, timeout_sec=30)
def run_materiality_scan(req: https_fn.CallableRequest) -> dict:
    """
    Callable from the client as:
      httpsCallable(functions, 'run_materiality_scan')({ companyId, assessmentId })
    """
    if req.auth is None:
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.UNAUTHENTICATED, "Sign in required.")

    data = req.data or {}
    company_id = data.get("companyId")
    assessment_id = data.get("assessmentId")
    if not company_id or not assessment_id:
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
                                   "companyId and assessmentId are required.")

    db = firestore.client()

    member_ref = db.collection("ros_members_v1").document(f"{company_id}_{req.auth.uid}")
    if not member_ref.get().exists:
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.PERMISSION_DENIED,
                                   "Not a member of this company.")

    assessment = db.collection("ros_assessments_v1").document(assessment_id).get()
    if not assessment.exists or assessment.to_dict().get("companyId") != company_id:
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.NOT_FOUND,
                                   "Assessment not found for this company.")

    company = db.collection("ros_companies_v1").document(company_id).get()
    if not company.exists:
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.NOT_FOUND, "Company not found.")
    sector_label = company.to_dict().get("sector")
    sector_code = _SECTOR_LABEL_TO_CODE.get(sector_label, "default")
    config = get_industry_config(sector_code)

    topics = []
    for pillar, clayer in _PILLAR_TO_CLAYER.items():
        weight = config.pillar_weights.get(pillar, 0.0)
        level = _materiality_level(weight)
        topics.append({
            "clayerId": clayer,
            "level": level,
            "weight": weight,
            "why": (
                f"{pillar.replace('_', ' ').title()} is weighted {weight * 100:.0f}% of "
                f"{config.label}'s materiality profile (sector: {config.sector_group}), "
                f"reflecting indicators: {', '.join(config.material_indicators[:3])}."
            ),
        })

    transition = next(t for t in topics if t["clayerId"] == "c_risk_t")
    topics.append({
        "clayerId": "c_capital",
        "level": transition["level"],
        "weight": transition["weight"],
        "why": (
            f"Carbon & capital allocation exposure is derived from transition risk "
            f"({transition['level'].lower()} for {config.label}) — capital-allocation "
            f"pressure and carbon cost exposure move together in this sector."
        ),
    })

    supply_flagged = any("supply_chain" in ind for ind in config.material_indicators)
    topics.append({
        "clayerId": "c_supply",
        "level": "HIGH" if supply_flagged else "MEDIUM",
        "weight": None,
        "why": (
            f"Supply chain risk is explicitly named in {config.label}'s material indicators."
            if supply_flagged else
            f"Supply chain risk is not among {config.label}'s named material indicators, "
            f"but is never scored below MEDIUM in this methodology."
        ),
    })

    scan_doc = {
        "assessmentId": assessment_id,
        "companyId": company_id,
        "industryCode": config.code,
        "industryLabel": config.label,
        "sectorGroup": config.sector_group,
        "topics": topics,
        "methodology": "pillar_weights_v1",
        "computedAt": firestore.SERVER_TIMESTAMP,
    }
    db.collection("ros_materiality_scans_v1").document(assessment_id).set(scan_doc)

    return {k: v for k, v in scan_doc.items() if k != "computedAt"}


# ── Entity & Organizational Boundary — ancestry / ownership rollup ──────
# ancestryPath and effectiveOwnershipFromRoot are derived facts (see
# firestore.rules — clients may never set them), recomputed here whenever
# any ros_entities_v1 document changes. Idempotent and change-guarded:
# writing the same values back does not trigger another write, so this
# naturally terminates instead of looping on its own Firestore writes.
@firestore_fn.on_document_written(document="ros_entities_v1/{entityId}")
def on_ros_entity_written(event: firestore_fn.Event) -> None:
    if event.data.after is None:
        return  # hard delete (rare — normal path is a soft status:'inactive' update)
    db = firestore.client()
    _recompute_entity_and_descendants(db, event.params["entityId"])


def _recompute_entity_and_descendants(db, entity_id: str, _seen: set | None = None) -> None:
    _seen = _seen if _seen is not None else set()
    if entity_id in _seen:
        return  # cycle guard — a corrupted parentEntityId loop must not recurse forever
    _seen.add(entity_id)

    ref = db.collection("ros_entities_v1").document(entity_id)
    snap = ref.get()
    if not snap.exists:
        return
    data = snap.to_dict()
    parent_id = data.get("parentEntityId")

    if not parent_id:
        # Direct subsidiary of the root company itself (which is
        # ros_companies_v1, not a ros_entities_v1 doc — the root is never
        # duplicated as its own node). This node's effective ownership from
        # root IS its own ownershipPct, not 100% — only the company itself
        # is 100% by definition, and it isn't represented here at all.
        ancestry_path: list[str] = []
        own_pct = data.get("ownershipPct")
        effective_ownership: float | None = None if own_pct is None else round(own_pct / 100.0, 4)
    else:
        parent_snap = db.collection("ros_entities_v1").document(parent_id).get()
        if not parent_snap.exists:
            return  # dangling parent reference — leave unresolved rather than fabricate a chain
        parent_data = parent_snap.to_dict()
        ancestry_path = (parent_data.get("ancestryPath") or []) + [parent_id]
        parent_effective = parent_data.get("effectiveOwnershipFromRoot")
        own_pct = data.get("ownershipPct")
        effective_ownership = (
            None if parent_effective is None or own_pct is None
            else round(parent_effective * (own_pct / 100.0), 4)
        )

    if data.get("ancestryPath") != ancestry_path or data.get("effectiveOwnershipFromRoot") != effective_ownership:
        ref.set({"ancestryPath": ancestry_path, "effectiveOwnershipFromRoot": effective_ownership}, merge=True)

    # Cascade to children — their ancestry/effective-ownership depend on this
    # node's, so any real change here must propagate down the tree.
    for child in db.collection("ros_entities_v1").where("parentEntityId", "==", entity_id).stream():
        _recompute_entity_and_descendants(db, child.id, _seen)
