"""
Climactix — Risk OS Firebase Cloud Functions (Python, 2nd gen)
==================================================================
The one piece of Risk OS collaboration that genuinely cannot live in the
client + Firestore security rules: AI evidence review needs a secret
OPENAI_API_KEY, so it has to run server-side. Everything else (companies,
assessments, answers, comments, tasks, risk notes) is plain client SDK
reads/writes against Firestore, governed by ../firestore.rules — see
RISK_OS_COLLABORATION_ARCHITECTURE.md.

services/ here (extractor.py, greenwashing_scanner.py,
esg_framework_intelligence.py, risk_os_ai_review.py) are synced copies of
backend/services/* — Cloud Functions deploys only package files inside
functions/, so they can't be imported from ../backend directly. Keep the
two copies in sync by hand until a shared-package build step replaces this
(noted as a known limitation in the architecture doc).
"""

from __future__ import annotations

import hashlib

import firebase_admin
from firebase_admin import credentials, firestore, storage
from firebase_functions import https_fn, options
from firebase_functions.params import SecretParam

from services.risk_os_ai_review import run_ai_review

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
