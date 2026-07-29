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
from services.evidence_graph import build_evidence_graph
from services.assessment_agent import chat as run_assessment_agent_chat
from services.extractor import extract_text, extract_from_url
from services.evidence_intelligence_agent import run_evidence_intelligence

firebase_admin.initialize_app()

OPENAI_API_KEY = SecretParam("OPENAI_API_KEY")

VALID_REVIEW_TYPES = {
    "summarize", "extract_data", "find_gaps", "contradictions",
    "framework_mapping", "confidence_score", "exec_summary", "compare_previous",
    "draft_response",
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
        # Real locators only (see extractor.py / risk_os_ai_review.py) — empty
        # list when the model found nothing directly citable, never a guess.
        "citations": result.get("citations") or [],
        "evidenceGap": result.get("evidence_gap"),
        "suggestedStatus": result.get("suggested_status"),
        "relevantEvidenceExcerpt": result.get("relevant_evidence_excerpt"),
        "requestedBy": req.auth.uid,
        "createdAt": firestore.SERVER_TIMESTAMP,
    }
    _, review_ref = db.collection("ros_ai_reviews_v1").add(review_doc)

    return {"id": review_ref.id, **{k: v for k, v in review_doc.items() if k != "createdAt"}}


# ── Climactix Evidence Intelligence Agent ───────────────────────────────────
# Runs the full evidence-verification pipeline (services/evidence_intelligence_
# agent.py) against EVERY piece of evidence attached to one question — not
# just the most recent file, unlike request_evidence_ai_review above — plus
# any linked facility, and persists structured results a client could never
# write itself (ros_claims_v1, ros_evidence_confidence_v1 are both Cloud-
# Function-only writes; see firestore.rules).

# EVIDENCE_DOC_TYPES values (climate-risk-os.html) mapped onto verification_
# engine.py's evidence-type trust taxonomy (regulatory/third_party/audited/
# document/report/website/self_declared). A category the user didn't pick,
# or one outside this map, falls back to "self_declared" — the lowest trust
# tier — rather than assuming a document is more credible than it declared
# itself to be.
_DOC_CATEGORY_TO_EVIDENCE_TYPE = {
    "Sustainability Report": "report", "Financial Report": "audited",
    "Board Document": "document", "Policy Document": "document",
    "Risk Register": "document", "Audit Report": "audited",
    "Certificate": "third_party", "Climate Model Output": "document",
    "Asset Register": "document", "Insurance Documentation": "document",
    "Energy Bill": "document", "Emissions Inventory": "document",
    "Supplier Record": "document", "URL / External Reference": "website",
    "Other": "self_declared",
}


def _camelize_keys(d: dict) -> dict:
    """snake_case -> camelCase, one level deep (claim/metric dicts from
    claim_intelligence.py/metric_intelligence.py are flat, no nesting to
    recurse into)."""
    def _camel(key: str) -> str:
        parts = key.split("_")
        return parts[0] + "".join(p.capitalize() for p in parts[1:])
    return {_camel(k): v for k, v in d.items()}


def _infer_evidence_type(ev_data: dict) -> str:
    if ev_data.get("sourceType") == "url":
        return "website"
    category = ev_data.get("documentCategory")
    evidence_type = _DOC_CATEGORY_TO_EVIDENCE_TYPE.get(category, "self_declared")
    # A regulator/exchange named as the issuing authority outweighs the
    # document-category default (e.g. a "Certificate" issued directly by a
    # government regulator is regulatory-grade, not merely third-party).
    authority = (ev_data.get("issuingAuthority") or "").lower()
    if any(k in authority for k in ("regulator", "government", "ministry", "exchange", "sebi", "sec ")):
        return "regulatory"
    return evidence_type


def _is_climactix_staff(db, uid: str) -> bool:
    return db.collection("cx_staff_v1").document(uid).get().exists


def _execute_evidence_intelligence(db, assessment_id: str, question_id: str, question_text: str,
                                    facility_id, requested_by: str):
    """
    Core pipeline shared by the staff-invoked manual callable below and the
    onEvidenceCreated auto-trigger: gather this question's evidence + declared
    answer + linked facility, run the orchestrator, persist claims/confidence/
    contradiction-flags. Callers own their own auth — this assumes it's
    already been authorized (the callable checks isClimactixStaff first; the
    trigger runs under Admin SDK privileges and needs no additional check,
    since it fires from Cloud Functions infrastructure regardless of who
    uploaded the evidence).

    Returns the orchestrator's result dict, or None if the assessment can't
    be resolved. Raises RuntimeError if the AI backend itself is unavailable
    (missing API key, etc.) — callers decide how to surface that.
    """
    assessment = db.collection("ros_assessments_v1").document(assessment_id).get()
    if not assessment.exists:
        return None
    company_id = assessment.to_dict().get("companyId")

    company_snap = db.collection("ros_companies_v1").document(company_id).get()
    company_name = (company_snap.to_dict() or {}).get("name") or "The Company" if company_snap.exists else "The Company"

    answer_snap = db.collection("ros_answers_v1").document(f"{assessment_id}_{question_id}").get()
    answer_data = answer_snap.to_dict() if answer_snap.exists else {}
    raw_answer = answer_data.get("rawAnswer")
    entity_response = {
        "status": raw_answer.get("status") if isinstance(raw_answer, dict) else raw_answer,
        "justification": raw_answer.get("justification") if isinstance(raw_answer, dict) else None,
    }
    # Fall back to the persisted facility link (ros_answers_v1.facilityId,
    # written by saveFacilityLink()) when the caller didn't pass one
    # explicitly — the auto-trigger below has no live client to source this
    # from, so it must read whatever was last linked.
    if not facility_id:
        facility_id = answer_data.get("facilityId")

    evidence_docs = list(
        db.collection("ros_evidence_v1")
        .where("assessmentId", "==", assessment_id).where("questionId", "==", question_id)
        .stream()
    )

    evidence_items = []
    if evidence_docs:
        bucket = storage.bucket()
        for ev in evidence_docs:
            ev_data = ev.to_dict()
            text = ""
            try:
                if ev_data.get("sourceType") == "url" and ev_data.get("sourceUrl"):
                    fetched = extract_from_url(ev_data["sourceUrl"])
                    text = fetched["text"]
                elif ev_data.get("storagePath"):
                    blob = bucket.blob(ev_data["storagePath"])
                    if blob.exists():
                        content = blob.download_as_bytes()
                        text = extract_text(content, ev_data.get("filename", "document"), ev_data.get("fileType") or "")
            except Exception:
                # A single unreadable/unreachable evidence item must not sink
                # the whole question's analysis — it's simply treated as
                # contributing no extractable text (visible via a low
                # evidence_relevance/completeness factor downstream, not a
                # crash).
                text = ""
            evidence_items.append({
                "id": ev.id,
                "filename": ev_data.get("originalName") or ev_data.get("filename"),
                "source_label": ev_data.get("originalName") or ev_data.get("filename") or ev_data.get("sourceUrl") or ev.id,
                "text": text,
                "evidence_type": _infer_evidence_type(ev_data),
                "reporting_period": ev_data.get("reportingPeriod"),
                "document_category": ev_data.get("documentCategory"),
            })

    facility = None
    if facility_id:
        facility_snap = db.collection("ros_facilities_v1").document(facility_id).get()
        if facility_snap.exists:
            facility = facility_snap.to_dict()

    result = run_evidence_intelligence(
        question_id=question_id,
        question_text=question_text or "",
        entity_response=entity_response,
        evidence_items=evidence_items,
        facility=facility,
        company_name=company_name,
    )

    now = firestore.SERVER_TIMESTAMP

    # Summary surfaced through the existing ros_ai_reviews_v1 stream so
    # _latestAIReview()/subscribeAIReviews() in climate-risk-os.html keep
    # working unmodified for this new reviewType. Note: ros_ai_reviews_v1
    # itself is still readable by isCompanyMember() (unchanged) — only the
    # NEW collections below (ros_claims_v1 etc.) are staff-only — so this
    # summary doc is technically company-visible. It carries no more detail
    # than outputSummary/confidenceScore already exposed by every other
    # reviewType on this same collection; the full analysis (claims,
    # signals, recommendation) lives only in the staff-only collections.
    review_doc = {
        "evidenceId": None, "assessmentId": assessment_id, "questionId": question_id, "companyId": company_id,
        "reviewType": "evidence_intelligence_full",
        "outputSummary": result["agent_recommendation"],
        "extractedData": {"metricsCount": len(result["extracted_metrics"]), "claimsCount": len(result["extracted_claims"])},
        "contradictions": result["durable_contradictions"],
        "confidenceScore": result["evidence_confidence"]["score"],
        "modelUsed": "evidence_intelligence_agent_v1",
        "citations": [],
        "evidenceGap": "; ".join(result["missing_evidence"][:5]) if result["missing_evidence"] else "",
        "suggestedStatus": None,
        "requestedBy": requested_by,
        "createdAt": now,
    }
    db.collection("ros_ai_reviews_v1").add(review_doc)

    # Claims + metrics — idempotent replace-on-rerun, same discipline as
    # compute_evidence_graph's delete-old/write-new batch below. The Python
    # services (claim_intelligence.py/metric_intelligence.py) return
    # snake_case keys; every other collection in this schema is camelCase
    # (see ros_evidence_v1/ros_answers_v1/etc.), so keys are converted here
    # rather than leaving ros_claims_v1 as the one mixed-case collection the
    # client (climate-risk-os.html) would otherwise have to special-case.
    batch = db.batch()
    existing_claims = (
        db.collection("ros_claims_v1")
        .where("assessmentId", "==", assessment_id).where("questionId", "==", question_id)
        .stream()
    )
    for doc in existing_claims:
        batch.delete(doc.reference)
    for c in result["extracted_claims"]:
        ref = db.collection("ros_claims_v1").document()
        batch.set(ref, {"assessmentId": assessment_id, "questionId": question_id, "companyId": company_id,
                         "kind": "claim", **_camelize_keys(c), "createdAt": now})
    for m in result["extracted_metrics"]:
        ref = db.collection("ros_claims_v1").document()
        batch.set(ref, {"assessmentId": assessment_id, "questionId": question_id, "companyId": company_id,
                         "kind": "metric", **_camelize_keys(m), "createdAt": now})
    batch.commit()

    # Evidence confidence — one doc per question, full breakdown; triggers
    # recompute_entity_intelligence below on every write.
    db.collection("ros_evidence_confidence_v1").document(f"{assessment_id}_{question_id}").set({
        "assessmentId": assessment_id, "questionId": question_id, "companyId": company_id,
        "score": result["evidence_confidence"]["score"], "label": result["evidence_confidence"]["label"],
        "explanation": result["evidence_confidence"]["explanation"], "factors": result["evidence_confidence"]["factors"],
        "methodologyVersion": result["evidence_confidence"]["methodology_version"],
        "externalCrossCheck": [_camelize_keys(x) for x in result["external_cross_check"]],
        "geospatialCrossCheck": (_camelize_keys(result["geospatial_cross_check"]) if result["geospatial_cross_check"] else None),
        "crossDocumentContradictions": [_camelize_keys(x) for x in result["cross_document_contradictions"]],
        "greenwashingSignals": [_camelize_keys(x) for x in result["greenwashing_signals"]],
        "missingEvidence": result["missing_evidence"],
        "agentRecommendation": result["agent_recommendation"],
        "recommendedScore": result["recommended_score"],
        "analystReviewRequired": result["analyst_review_required"],
        "analystReviewReason": result["analyst_review_reason"],
        "updatedAt": now,
    }, merge=True)

    # Durable cross-document contradiction flags — idempotent lifecycle
    # identical to compute_evidence_graph's GRAPH01 handling: appears while
    # material, disappears once resolved, keyed so re-running never duplicates.
    stale = (
        db.collection("ros_contradiction_flags_v1")
        .where("assessmentId", "==", assessment_id)
        .where("sourceType", "==", "evidence_intelligence")
        .where("sourceQuestionId", "==", question_id)
        .stream()
    )
    stale_ids = [d.id for d in stale]
    material = [c for c in result["cross_document_contradictions"] if c.get("severity") in ("High", "Critical")]
    if material:
        if not stale_ids:
            for c in material:
                db.collection("ros_contradiction_flags_v1").add({
                    "assessmentId": assessment_id, "ruleId": f"EI-{c.get('metric', 'metric')}",
                    "severity": c.get("severity"), "questionIds": [question_id],
                    "sourceQuestionId": question_id, "sourceType": "evidence_intelligence",
                    "summary": c.get("explanation", ""), "createdAt": now,
                })
    else:
        for doc_id in stale_ids:
            db.collection("ros_contradiction_flags_v1").document(doc_id).delete()

    return result


@https_fn.on_call(
    region="us-central1",
    memory=options.MemoryOption.MB_512,
    timeout_sec=180,
    secrets=[OPENAI_API_KEY],
)
def run_evidence_intelligence_analysis(req: https_fn.CallableRequest) -> dict:
    """
    Manual re-run, restricted to the Climactix internal/backend team (see
    firestore.rules' isClimactixStaff() — the entity being assessed cannot
    call this even though it can freely upload evidence, since that upload
    is what the onEvidenceCreated trigger below already runs automatically).

    Callable from the client as:
      httpsCallable(functions, 'run_evidence_intelligence_analysis')
        ({ assessmentId, questionId, questionText, facilityId })
    """
    if req.auth is None:
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.UNAUTHENTICATED, "Sign in required.")

    data = req.data or {}
    assessment_id = data.get("assessmentId")
    question_id = data.get("questionId")
    if not assessment_id or not question_id:
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
                                   "assessmentId and questionId are required.")

    db = firestore.client()

    if not _is_climactix_staff(db, req.auth.uid):
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.PERMISSION_DENIED,
                                   "This tool is restricted to the Climactix internal review team.")

    try:
        result = _execute_evidence_intelligence(
            db, assessment_id, question_id, data.get("questionText", ""),
            data.get("facilityId"), requested_by=req.auth.uid,
        )
    except RuntimeError as e:
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
                                   f"Evidence Intelligence Agent unavailable: {e}")

    if result is None:
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.NOT_FOUND, "Assessment not found.")

    return result


# Auto-runs the Evidence Intelligence Agent the moment new evidence (a file
# upload or a web source) is added to a question — the backend team should
# never need to manually trigger analysis; it starts working as soon as the
# assessment starts receiving evidence. on_document_created (not _written)
# so this fires exactly once per evidence item, never re-fires when its
# reviewStatus is later updated by setEvidenceReviewStatus(). Admin SDK
# execution context — no RBAC check needed, unlike the callable above; this
# runs from Cloud Functions infrastructure regardless of who uploaded it.
@firestore_fn.on_document_created(
    document="ros_evidence_v1/{evidenceId}",
    region="us-central1",
    memory=options.MemoryOption.MB_512,
    timeout_sec=180,
    secrets=[OPENAI_API_KEY],
)
def on_evidence_created(event: firestore_fn.Event) -> None:
    ev_data = event.data.to_dict()
    assessment_id = ev_data.get("assessmentId")
    question_id = ev_data.get("questionId")
    if not assessment_id or not question_id:
        return

    db = firestore.client()

    # Question text isn't currently used inside the orchestrator itself (see
    # evidence_intelligence_agent.py), but is looked up here on a best-effort
    # basis from the seeded question-bank mirror in case a future pass starts
    # using it — never fabricated if the mirror doesn't have this question.
    question_text = ""
    question_snap = db.collection("ros_questions_v1").document(question_id).get()
    if question_snap.exists:
        question_text = question_snap.to_dict().get("text") or ""

    try:
        _execute_evidence_intelligence(
            db, assessment_id, question_id, question_text,
            facility_id=None, requested_by=f"system:auto_trigger:{ev_data.get('uploadedBy', 'unknown')}",
        )
    except RuntimeError:
        # AI backend unavailable (e.g. no API key configured) — skip
        # silently. The backend team can still manually re-run once
        # configured, via run_evidence_intelligence_analysis above.
        pass


# ── Entity-level Evidence Intelligence aggregation ──────────────────────────
# Rolls every question's ros_evidence_confidence_v1 + ros_claims_v1 up into
# one ros_entity_intelligence_v1 doc per assessment (spec §15). Scoped to one
# assessment rather than one company across every historical assessment, for
# the same reason ros_clayer_scores_v1/ros_materiality_scans_v1 are — every
# other intelligence layer in this schema is assessment-scoped, so "entity-
# level" here means "this entity's current assessment," not a cross-year
# rollup this schema doesn't otherwise support.
@firestore_fn.on_document_written(document="ros_evidence_confidence_v1/{docId}")
def recompute_entity_intelligence(event: firestore_fn.Event) -> None:
    if event.data.after is None:
        return
    written = event.data.after.to_dict()
    assessment_id = written.get("assessmentId")
    if not assessment_id:
        return

    db = firestore.client()
    confidence_docs = [
        d.to_dict() for d in
        db.collection("ros_evidence_confidence_v1").where("assessmentId", "==", assessment_id).stream()
    ]
    if not confidence_docs:
        return
    claim_docs = [
        d.to_dict() for d in
        db.collection("ros_claims_v1").where("assessmentId", "==", assessment_id).stream()
    ]

    scores = [c.get("score") for c in confidence_docs if c.get("score") is not None]
    evidence_integrity_score = round(sum(scores) / len(scores)) if scores else 0

    consistency_penalties = 0
    total_cross_doc_checks = 0
    for c in confidence_docs:
        for x in (c.get("crossDocumentContradictions") or []):
            total_cross_doc_checks += 1
            if x.get("severity") in ("High", "Critical"):
                consistency_penalties += 1
    disclosure_consistency_score = (
        round(100 * (1 - (consistency_penalties / total_cross_doc_checks))) if total_cross_doc_checks else 100
    )

    conf_by_question = {c.get("questionId"): c for c in confidence_docs if c.get("questionId")}
    verified = partial = unsupported = contradictory = 0
    for claim in claim_docs:
        conf = conf_by_question.get(claim.get("questionId"), {})
        label = conf.get("label", "INSUFFICIENT")
        has_material_signal = any(
            s.get("category") in ("Material Contradiction", "Potential Greenwashing Signal")
            for s in (conf.get("greenwashingSignals") or [])
        )
        if has_material_signal:
            contradictory += 1
        elif label == "HIGH":
            verified += 1
        elif label == "MODERATE":
            partial += 1
        else:
            unsupported += 1

    total_claims = len(claim_docs) or 1
    verification_coverage_pct = round(100 * verified / total_claims)

    signal_categories = [
        s.get("category") for c in confidence_docs for s in (c.get("greenwashingSignals") or [])
    ]
    material_signal_count = sum(
        1 for cat in signal_categories if cat in ("Potential Greenwashing Signal", "Material Contradiction")
    )
    if material_signal_count == 0:
        greenwashing_risk = "LOW"
    elif material_signal_count <= 2:
        greenwashing_risk = "MODERATE"
    elif material_signal_count <= 5:
        greenwashing_risk = "ELEVATED"
    else:
        greenwashing_risk = "HIGH"

    db.collection("ros_entity_intelligence_v1").document(assessment_id).set({
        "assessmentId": assessment_id,
        "companyId": written.get("companyId"),
        "evidenceIntegrityScore": evidence_integrity_score,
        "disclosureConsistencyScore": disclosure_consistency_score,
        "verificationCoveragePct": verification_coverage_pct,
        "greenwashingRisk": greenwashing_risk,
        "verifiedClaims": verified, "partiallyVerifiedClaims": partial,
        "unsupportedClaims": unsupported, "contradictoryClaims": contradictory,
        "questionsAnalyzed": len(confidence_docs),
        "updatedAt": firestore.SERVER_TIMESTAMP,
    }, merge=True)


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


# ── Evidence Graph — scoped cross-question consistency check ─────────────
# ros_evidence_graph_v1 / ros_contradiction_flags_v1 are both Cloud-Function-
# only writes (firestore.rules) so a flag's existence can never be spoofed
# client-side. Re-runs on every ros_answers_v1 write; see evidence_graph.py
# for exactly what real data this reads and the one contradiction it can
# honestly detect today.
@firestore_fn.on_document_written(document="ros_answers_v1/{answerId}")
def compute_evidence_graph(event: firestore_fn.Event) -> None:
    if event.data.after is None:
        return
    assessment_id = event.data.after.to_dict().get("assessmentId")
    if not assessment_id:
        return
    db = firestore.client()
    result = build_evidence_graph(db, assessment_id)

    batch = db.batch()
    existing_nodes = db.collection("ros_evidence_graph_v1").where("assessmentId", "==", assessment_id).stream()
    for doc in existing_nodes:
        batch.delete(doc.reference)
    for node in result["nodes"]:
        ref = db.collection("ros_evidence_graph_v1").document(f"{assessment_id}_{node['nodeId']}")
        batch.set(ref, {**node, "assessmentId": assessment_id, "updatedAt": firestore.SERVER_TIMESTAMP})
    batch.commit()

    # Idempotent flag lifecycle: appears while the condition holds, is
    # removed once resolved, never duplicated across repeated answer writes.
    stale = (
        db.collection("ros_contradiction_flags_v1")
        .where("assessmentId", "==", assessment_id).where("ruleId", "==", "GRAPH01")
        .stream()
    )
    stale_ids = [d.id for d in stale]
    contradiction = result["contradiction"]
    if contradiction:
        if not stale_ids:
            db.collection("ros_contradiction_flags_v1").add({
                "assessmentId": assessment_id, "ruleId": contradiction["ruleId"],
                "severity": contradiction["severity"], "questionIds": contradiction["questionIds"],
                "sourceType": contradiction["sourceType"], "summary": contradiction["summary"],
                "createdAt": firestore.SERVER_TIMESTAMP,
            })
    else:
        for doc_id in stale_ids:
            db.collection("ros_contradiction_flags_v1").document(doc_id).delete()


# ── Persistent Climactix Assessment Agent ─────────────────────────────────
# Callable from the client as:
#   httpsCallable(functions, 'assessment_agent_chat')({ assessmentId, message })
# Scoped strictly to one assessment's real Firestore data via a fixed
# toolset (services/assessment_agent.py) — never a generic open LLM chat,
# and never trusts an assessmentId the model itself might try to invent,
# since the tool implementations only ever read the assessmentId this
# callable already RBAC-checked below.
@https_fn.on_call(
    region="us-central1",
    memory=options.MemoryOption.MB_512,
    timeout_sec=120,
    secrets=[OPENAI_API_KEY],
)
def assessment_agent_chat(req: https_fn.CallableRequest) -> dict:
    if req.auth is None:
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.UNAUTHENTICATED, "Sign in required.")

    data = req.data or {}
    assessment_id = data.get("assessmentId")
    message = (data.get("message") or "").strip()
    if not assessment_id or not message:
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
                                   "assessmentId and message are required.")

    db = firestore.client()
    assessment = db.collection("ros_assessments_v1").document(assessment_id).get()
    if not assessment.exists:
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.NOT_FOUND, "Assessment not found.")
    company_id = assessment.to_dict().get("companyId")

    member_ref = db.collection("ros_members_v1").document(f"{company_id}_{req.auth.uid}")
    if not member_ref.get().exists:
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.PERMISSION_DENIED,
                                   "Not a member of this company.")

    conversation_id = f"{assessment_id}_{req.auth.uid}"
    conv_ref = db.collection("ros_agent_conversations_v1").document(conversation_id)
    conv_snap = conv_ref.get()
    history = conv_snap.to_dict().get("messages", []) if conv_snap.exists else []

    try:
        result = run_assessment_agent_chat(db, assessment_id, message, history)
    except RuntimeError as e:
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
                                   f"Assessment agent unavailable: {e}")

    now = firestore.SERVER_TIMESTAMP
    new_messages = history + [
        {"role": "user", "text": message, "createdAt": now},
        {"role": "assistant", "text": result["reply"], "createdAt": now,
         "toolCalls": [{"name": tc["name"], "args": tc["args"]} for tc in result["toolCalls"]]},
    ]
    conv_ref.set({
        "assessmentId": assessment_id, "userId": req.auth.uid,
        "messages": new_messages, "updatedAt": now,
        **({} if conv_snap.exists else {"createdAt": now}),
    }, merge=True)

    return {"reply": result["reply"], "toolCalls": result["toolCalls"]}
