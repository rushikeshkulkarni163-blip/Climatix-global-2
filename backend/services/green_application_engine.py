"""
Climactix Green Production — Certification Review Application Engine v1.0

A governed application/review pipeline that sits in front of the existing
certificate engine (green_certification_engine.py). A production can never
self-issue a certificate: submission only creates an *application*, and a
real certificate is produced solely by issue_certificate_for_application(),
which is reachable only after a reviewer records an approval decision.

Pipeline (7 stages): submitted -> initial_review -> documentation_review ->
technical_assessment -> quality_assurance -> final_decision -> certificate_issued.

green_application_events is an append-only log that doubles as the audit
trail, the reviewer-feedback panel, and the activity timeline — one table,
three views. There is no reviewer authentication in this codebase yet (the
same is true of the pre-existing certificate "Approve (reviewer)" action) —
reviewer actions here are plain actor-tagged endpoints, not an RBAC gate.

Proprietary IP of Climactix Global. All rights reserved.
"""

from __future__ import annotations
import json
import secrets
from datetime import date, datetime, timedelta, timezone
from typing import Optional

import asyncpg

from services import green_score_engine as scoring
from services import green_certification_engine as certification

STAGE_ORDER = [
    "submitted", "initial_review", "documentation_review", "technical_assessment",
    "quality_assurance", "final_decision", "certificate_issued",
]
STAGE_LABELS = {
    "submitted": "Submitted",
    "initial_review": "Initial Review",
    "documentation_review": "Documentation Review",
    "technical_assessment": "Technical Assessment",
    "quality_assurance": "Quality Assurance",
    "final_decision": "Final Decision",
    "certificate_issued": "Certificate Issued",
}
_ACTIVE_STATUSES = ("submitted", "under_review", "more_info_required", "approved", "approved_with_conditions")


def _stage_progress(current_stage: str) -> dict:
    idx = STAGE_ORDER.index(current_stage)
    return {"stageIndex": idx + 1, "totalStages": len(STAGE_ORDER), "progressPct": round((idx + 1) / len(STAGE_ORDER) * 100)}


async def _generate_application_number(pool: asyncpg.Pool) -> str:
    year = datetime.now(timezone.utc).year
    for _ in range(5):
        n = await pool.fetchval(
            "SELECT COUNT(*) FROM green_certification_applications WHERE application_number LIKE $1",
            f"CG-GP-{year}-%",
        )
        candidate = f"CG-GP-{year}-{(n + 1 + secrets.randbelow(3)):05d}"
        exists = await pool.fetchval(
            "SELECT 1 FROM green_certification_applications WHERE application_number = $1", candidate)
        if not exists:
            return candidate
    raise RuntimeError("failed to generate a unique application number after 5 attempts")


async def _log_event(pool: asyncpg.Pool, application_id: str, event_type: str, actor: Optional[str] = None,
                      from_value: Optional[str] = None, to_value: Optional[str] = None,
                      comment: Optional[str] = None) -> None:
    await pool.execute(
        """
        INSERT INTO green_application_events (application_id, event_type, actor, from_value, to_value, comment)
        VALUES ($1,$2,$3,$4,$5,$6)
        """,
        application_id, event_type, actor, from_value, to_value, comment,
    )


# ── Submission ────────────────────────────────────────────────────────────────

async def submit_application(pool: asyncpg.Pool, production_id: str, actor: str = "Applicant") -> dict:
    existing = await pool.fetchrow(
        "SELECT id, status FROM green_certification_applications "
        "WHERE production_id = $1 ORDER BY created_at DESC LIMIT 1",
        production_id,
    )
    if existing and existing["status"] in _ACTIVE_STATUSES + ("certified",):
        raise ValueError(
            f"an application already exists for this production (status '{existing['status']}') — "
            f"cannot submit a duplicate application while one is active or certified"
        )

    score_result = await scoring.compute_score(pool, production_id, persist=True)
    level = score_result["certificationLevel"]
    if not level.get("achieved"):
        gap = level.get("scoreGap")
        detail = f"score {score_result['totalScore']} has not reached Bronze (needs {level['minScore']}"
        if gap:
            detail += f", {gap} points short"
        detail += ")"
        if level.get("unmetCriteria"):
            detail += f"; unmet criteria: {', '.join(level['unmetCriteria'])}"
        raise ValueError(f"production is not yet eligible to submit for certification review — {detail}")

    level_row = await pool.fetchrow(
        "SELECT mandatory_criteria FROM green_certification_levels WHERE id = $1", level["levelId"])
    criteria = json.loads(level_row["mandatory_criteria"]) if isinstance(level_row["mandatory_criteria"], str) else level_row["mandatory_criteria"]
    mandatory_snapshot = [{"criterion": c, "passed": True} for c in criteria]

    resp_rows = await pool.fetch(
        """
        SELECT q.id, q.question_text, q.scoring_dimension, r.response, r.answered_at
        FROM green_questionnaire_questions q
        LEFT JOIN green_questionnaire_responses r ON r.question_id = q.id AND r.production_id = $1
        """,
        production_id,
    )
    questionnaire_snapshot = {
        r["id"]: {
            "questionText": r["question_text"], "dimension": r["scoring_dimension"],
            "response": json.loads(r["response"]) if isinstance(r["response"], str) else r["response"],
            "answeredAt": r["answered_at"].isoformat() if r["answered_at"] else None,
        }
        for r in resp_rows
    }

    application_number = await _generate_application_number(pool)
    submitted_at = datetime.now(timezone.utc)
    sla_due_at = submitted_at + timedelta(days=14)  # ~10 business days

    row = await pool.fetchrow(
        """
        INSERT INTO green_certification_applications
          (application_number, production_id, current_stage, status, score, expected_level_id,
           snapshot_id, mandatory_criteria_snapshot, questionnaire_snapshot, submitted_at, sla_due_at)
        VALUES ($1,$2,'submitted','submitted',$3,$4,$5,$6,$7,$8,$9)
        RETURNING id, created_at
        """,
        application_number, production_id, score_result["totalScore"], level["levelId"],
        score_result.get("snapshotId"), json.dumps(mandatory_snapshot), json.dumps(questionnaire_snapshot),
        submitted_at, sla_due_at,
    )
    await _log_event(pool, row["id"], "submitted", actor=actor, to_value="submitted",
                      comment=f"Application submitted at score {score_result['totalScore']} (expected {level['label']}).")

    return await get_application(pool, row["id"])


# ── Detail / listing ────────────────────────────────────────────────────────

async def get_application(pool: asyncpg.Pool, application_id: str) -> dict:
    row = await pool.fetchrow(
        """
        SELECT a.*, p.production_name, p.production_company, l.label AS expected_level_label,
               c.certificate_number, c.verification_status AS certificate_status,
               c.issued_at AS certificate_issued_at, c.expires_at AS certificate_expires_at,
               cl.label AS certificate_level_label
        FROM green_certification_applications a
        JOIN green_productions p ON p.id = a.production_id
        LEFT JOIN green_certification_levels l ON l.id = a.expected_level_id
        LEFT JOIN green_certifications c ON c.id = a.certificate_id
        LEFT JOIN green_certification_levels cl ON cl.id = c.level_id
        WHERE a.id = $1
        """,
        application_id,
    )
    if row is None:
        raise ValueError(f"unknown application '{application_id}'")

    events = await pool.fetch(
        "SELECT * FROM green_application_events WHERE application_id = $1 ORDER BY created_at ASC", application_id)
    docs = await pool.fetch(
        "SELECT * FROM green_application_required_documents WHERE application_id = $1 ORDER BY requested_at DESC",
        application_id)

    d = dict(row)
    for f in ("mandatory_criteria_snapshot", "questionnaire_snapshot"):
        if isinstance(d.get(f), str):
            d[f] = json.loads(d[f])
    d.update(_stage_progress(d["current_stage"]))
    d["events"] = [dict(e) for e in events]
    d["requiredDocuments"] = [dict(doc) for doc in docs]
    d["pendingDocumentCount"] = sum(1 for doc in docs if doc["status"] == "pending")
    return d


async def list_applications(pool: asyncpg.Pool, production_id: str) -> list[dict]:
    rows = await pool.fetch(
        "SELECT id FROM green_certification_applications WHERE production_id = $1 ORDER BY created_at DESC",
        production_id,
    )
    return [await get_application(pool, r["id"]) for r in rows]


# ── Reviewer actions ────────────────────────────────────────────────────────

async def assign_reviewer(pool: asyncpg.Pool, application_id: str, reviewer_name: str, actor: str) -> dict:
    app = await pool.fetchrow("SELECT status, current_stage FROM green_certification_applications WHERE id = $1", application_id)
    if app is None:
        raise ValueError(f"unknown application '{application_id}'")
    new_status = "under_review" if app["status"] == "submitted" else app["status"]
    new_stage = "initial_review" if app["current_stage"] == "submitted" else app["current_stage"]
    await pool.execute(
        "UPDATE green_certification_applications SET reviewer_name = $1, status = $2, current_stage = $3, updated_at = NOW() WHERE id = $4",
        reviewer_name, new_status, new_stage, application_id,
    )
    await _log_event(pool, application_id, "reviewer_assigned", actor=actor, to_value=reviewer_name)
    return await get_application(pool, application_id)


async def advance_stage(pool: asyncpg.Pool, application_id: str, to_stage: str, actor: str, comment: Optional[str] = None) -> dict:
    if to_stage not in STAGE_ORDER:
        raise ValueError(f"invalid stage '{to_stage}'")
    if to_stage == "certificate_issued":
        raise ValueError("certificate_issued can only be reached via a recorded approval decision, not advance_stage")
    app = await pool.fetchrow("SELECT current_stage, status FROM green_certification_applications WHERE id = $1", application_id)
    if app is None:
        raise ValueError(f"unknown application '{application_id}'")
    if STAGE_ORDER.index(to_stage) <= STAGE_ORDER.index(app["current_stage"]):
        raise ValueError(f"'{to_stage}' is not forward of the current stage '{app['current_stage']}'")

    new_status = "under_review" if app["status"] in ("submitted", "under_review") else app["status"]
    await pool.execute(
        "UPDATE green_certification_applications SET current_stage = $1, status = $2, updated_at = NOW() WHERE id = $3",
        to_stage, new_status, application_id,
    )
    await _log_event(pool, application_id, "stage_changed", actor=actor,
                      from_value=app["current_stage"], to_value=to_stage, comment=comment)
    return await get_application(pool, application_id)


async def request_documents(pool: asyncpg.Pool, application_id: str, items: list[str], actor: str,
                             deadline: Optional[date] = None, comment: Optional[str] = None) -> dict:
    if not items:
        raise ValueError("items must be a non-empty list of requested document descriptions")
    await pool.execute(
        "UPDATE green_certification_applications SET status = 'more_info_required', updated_at = NOW() WHERE id = $1",
        application_id,
    )
    for item in items:
        await pool.execute(
            "INSERT INTO green_application_required_documents (application_id, description, deadline) VALUES ($1,$2,$3)",
            application_id, item, deadline,
        )
    await _log_event(pool, application_id, "documents_requested", actor=actor,
                      to_value="more_info_required", comment=comment or "; ".join(items))
    return await get_application(pool, application_id)


async def fulfill_document(pool: asyncpg.Pool, application_id: str, document_id: str, actor: str) -> dict:
    row = await pool.fetchrow(
        "UPDATE green_application_required_documents SET status = 'fulfilled', fulfilled_at = NOW() "
        "WHERE id = $1 AND application_id = $2 RETURNING description",
        document_id, application_id,
    )
    if row is None:
        raise ValueError(f"unknown required document '{document_id}' for application '{application_id}'")
    await _log_event(pool, application_id, "document_fulfilled", actor=actor, comment=row["description"])
    return await get_application(pool, application_id)


async def add_comment(pool: asyncpg.Pool, application_id: str, actor: str, comment: str) -> dict:
    exists = await pool.fetchval("SELECT 1 FROM green_certification_applications WHERE id = $1", application_id)
    if not exists:
        raise ValueError(f"unknown application '{application_id}'")
    await _log_event(pool, application_id, "comment_added", actor=actor, comment=comment)
    return await get_application(pool, application_id)


_DECISION_TO_STATUS = {
    "approved": "approved",
    "approved_with_conditions": "approved_with_conditions",
    "rejected": "rejected",
    "more_info_required": "more_info_required",
}


async def record_decision(pool: asyncpg.Pool, application_id: str, decision: str, actor: str,
                           comment: Optional[str] = None, items: Optional[list[str]] = None,
                           deadline: Optional[date] = None) -> dict:
    if decision not in _DECISION_TO_STATUS:
        raise ValueError(f"invalid decision '{decision}' (expected one of {list(_DECISION_TO_STATUS)})")
    app = await pool.fetchrow("SELECT status FROM green_certification_applications WHERE id = $1", application_id)
    if app is None:
        raise ValueError(f"unknown application '{application_id}'")

    new_status = _DECISION_TO_STATUS[decision]
    new_stage = "final_decision"
    await pool.execute(
        "UPDATE green_certification_applications SET status = $1, current_stage = $2, decided_at = NOW(), updated_at = NOW() WHERE id = $3",
        new_status, new_stage, application_id,
    )
    await _log_event(pool, application_id, "decision_recorded", actor=actor,
                      from_value=app["status"], to_value=decision, comment=comment)

    if decision == "more_info_required" and items:
        await request_documents(pool, application_id, items, actor, deadline=deadline, comment=comment)

    return await get_application(pool, application_id)


async def issue_certificate_for_application(pool: asyncpg.Pool, application_id: str, actor: str) -> dict:
    """Stage 7 — the only path that produces a real certificate. Only reachable
    after a reviewer has recorded an approval decision; reuses the existing,
    unmodified certificate engine (HMAC signing, QR, public verification)."""
    app = await pool.fetchrow(
        "SELECT production_id, status FROM green_certification_applications WHERE id = $1", application_id)
    if app is None:
        raise ValueError(f"unknown application '{application_id}'")
    if app["status"] not in ("approved", "approved_with_conditions"):
        raise ValueError(
            f"cannot issue a certificate — application status is '{app['status']}', "
            f"expected 'approved' or 'approved_with_conditions'"
        )

    # actor_id here would need to be a real auth_users.id (green_audit_log has a
    # hard FK on it) — this codebase has no reviewer auth yet, so we pass None
    # and record the free-text reviewer name in our own unconstrained
    # green_application_events.actor column instead (logged just below).
    cert = await certification.issue_certificate(
        pool, app["production_id"], issued_by="Climactix Global Review Board", actor_id=None)
    await certification.set_verification_status(pool, cert["id"], "verified", actor_id=None)

    await pool.execute(
        "UPDATE green_certification_applications "
        "SET status = 'certified', current_stage = 'certificate_issued', certified_at = NOW(), "
        "certificate_id = $1, updated_at = NOW() WHERE id = $2",
        cert["id"], application_id,
    )
    await _log_event(pool, application_id, "certificate_issued", actor=actor,
                      to_value=cert["certificateNumber"], comment=f"Certificate {cert['certificateNumber']} issued.")
    return await get_application(pool, application_id)


# ── Resubmission ────────────────────────────────────────────────────────────

async def resubmit_application(pool: asyncpg.Pool, application_id: str, actor: str = "Applicant") -> dict:
    app = await pool.fetchrow(
        "SELECT production_id, status, version FROM green_certification_applications WHERE id = $1", application_id)
    if app is None:
        raise ValueError(f"unknown application '{application_id}'")
    if app["status"] != "more_info_required":
        raise ValueError(f"can only resubmit an application in 'more_info_required' status (current: '{app['status']}')")

    score_result = await scoring.compute_score(pool, app["production_id"], persist=True)
    resp_rows = await pool.fetch(
        """
        SELECT q.id, q.question_text, q.scoring_dimension, r.response, r.answered_at
        FROM green_questionnaire_questions q
        LEFT JOIN green_questionnaire_responses r ON r.question_id = q.id AND r.production_id = $1
        """,
        app["production_id"],
    )
    questionnaire_snapshot = {
        r["id"]: {
            "questionText": r["question_text"], "dimension": r["scoring_dimension"],
            "response": json.loads(r["response"]) if isinstance(r["response"], str) else r["response"],
            "answeredAt": r["answered_at"].isoformat() if r["answered_at"] else None,
        }
        for r in resp_rows
    }
    new_version = app["version"] + 1

    await pool.execute(
        """
        UPDATE green_certification_applications
        SET version = $1, status = 'under_review', current_stage = 'documentation_review',
            score = $2, snapshot_id = $3, questionnaire_snapshot = $4, updated_at = NOW()
        WHERE id = $5
        """,
        new_version, score_result["totalScore"], score_result.get("snapshotId"),
        json.dumps(questionnaire_snapshot), application_id,
    )
    await _log_event(pool, application_id, "resubmitted", actor=actor,
                      from_value=str(app["version"]), to_value=str(new_version),
                      comment=f"Resubmitted at refreshed score {score_result['totalScore']}.")
    return await get_application(pool, application_id)
