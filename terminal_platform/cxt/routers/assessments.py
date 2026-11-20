"""Company assessment portal, reviewer workflow, extraction review and correction requests."""

from __future__ import annotations

import uuid
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import assessment, audit, companies, pipeline, questionnaire, security, views
from ..db import get_db
from ..extraction.catalogue import CATALOGUE, metric_name
from ..models import (Assessment, AssessmentAnswer, AssessmentEvent, ClimateTarget, Company, CorrectionRequest,
                      DataPoint, Document, MethodologyVersion, ReviewItem, Score, utcnow)
from ..security import Principal, current_principal, require

router = APIRouter(tags=["Assessment and review"])


class StartIn(BaseModel):
    fiscal_year: int = Field(ge=2015, le=2100)


class AnswerIn(BaseModel):
    value: Optional[dict[str, Any]] = None
    source_declaration: Optional[str] = Field(default=None, max_length=2000)
    evidence_document_id: Optional[uuid.UUID] = None


class AnswersIn(BaseModel):
    answers: dict[str, AnswerIn]


class ReviewAnswerIn(BaseModel):
    decision: str = Field(pattern="^(accept|reject)$")
    comment: Optional[str] = Field(default=None, max_length=2000)


class CommentIn(BaseModel):
    comment: str = Field(min_length=3, max_length=4000)
    section: Optional[str] = None


class DecideIn(BaseModel):
    comment: Optional[str] = Field(default=None, max_length=4000)


class DataPointDecision(BaseModel):
    decision: str = Field(pattern="^(verify|reject|correct)$")
    note: Optional[str] = Field(default=None, max_length=2000)
    corrected_value: Optional[float] = None
    corrected_unit: Optional[str] = Field(default=None, max_length=40)
    corrected_normalized_value: Optional[float] = None
    corrected_fiscal_year: Optional[int] = None


class ResolveIn(BaseModel):
    resolution: str = Field(min_length=3, max_length=2000)
    dismiss: bool = False
    company_id: Optional[uuid.UUID] = None          # company_mapping items
    category: Optional[str] = None                  # classification items
    fiscal_year: Optional[int] = None


class CorrectionIn(BaseModel):
    data_point_id: Optional[uuid.UUID] = None
    subject: str = Field(min_length=3, max_length=300)
    proposed_value: str = Field(min_length=1, max_length=300)
    justification: str = Field(min_length=10, max_length=4000)
    evidence_document_id: Optional[uuid.UUID] = None


class CorrectionDecision(BaseModel):
    decision: str = Field(pattern="^(accept|reject)$")
    note: str = Field(min_length=3, max_length=2000)
    corrected_normalized_value: Optional[float] = None


# ── Company portal ───────────────────────────────────────────────────────────

def _own_company(db: Session, p: Principal) -> Company:
    if p.role != "company_admin" or not p.company_id:
        raise HTTPException(403, "This area is for company administrators")
    security.require_entitlement(db, p, "assessment_workflow")
    return companies.resolve(db, p.company_id)


def _assessment(db: Session, p: Principal, assessment_id: uuid.UUID, for_write: bool = False) -> Assessment:
    a = db.get(Assessment, assessment_id)
    if not a or a.channel != "company":
        raise HTTPException(404, "Assessment not found")
    if p.role == "company_admin":
        if p.company_id != a.company_id:
            raise HTTPException(404, "Assessment not found")       # another company's submission does not exist for you
        security.require_entitlement(db, p, "assessment_workflow")
    elif not p.is_internal:
        raise HTTPException(404, "Assessment not found")
    elif for_write and not p.can("assessment.review"):
        raise HTTPException(403, "Your role cannot review assessments")
    return a


def _assessment_out(db: Session, a: Assessment, p: Principal) -> dict:
    answers = db.execute(select(AssessmentAnswer).where(AssessmentAnswer.assessment_id == a.id)).scalars().all()
    docs = {d.id: d for d in db.execute(select(Document).where(
        Document.id.in_([x.evidence_document_id for x in answers if x.evidence_document_id]))).scalars()} if answers else {}
    events = db.execute(select(AssessmentEvent).where(AssessmentEvent.assessment_id == a.id)
                        .order_by(AssessmentEvent.at)).scalars()
    score = db.execute(select(Score).where(Score.assessment_id == a.id).order_by(Score.computed_at.desc()).limit(1)).scalar_one_or_none()
    version = db.get(MethodologyVersion, score.methodology_version_id).version if score else None
    c = db.get(Company, a.company_id)
    return {
        "id": str(a.id), "company": views.company_brief(c), "version_no": a.version_no, "status": a.status,
        "fiscal_year": a.fiscal_year, "questionnaire_version": a.questionnaire_version,
        "created_at": a.created_at, "submitted_at": a.submitted_at, "reviewed_at": a.reviewed_at,
        "editable": a.status in ("draft", "returned") and p.role == "company_admin",
        "progress": assessment.progress(db, a),
        "answers": {x.question_id: {
            "value": x.value, "source_declaration": x.source_declaration,
            "evidence_document": None if not x.evidence_document_id else {
                "id": str(x.evidence_document_id), "title": docs[x.evidence_document_id].title,
                "status": docs[x.evidence_document_id].status},
            "evidence_status": x.evidence_status, "reviewer_comment": x.reviewer_comment,
            "reviewed_at": x.reviewed_at, "updated_at": x.updated_at} for x in answers},
        "history": [{"at": e.at, "event": e.event, "section": e.section, "body": e.body, "by": e.actor_label}
                    for e in events],
        "score": views.score_out(score, version) if score else None,
    }


@router.get("/questionnaire")
def get_questionnaire(p: Principal = Depends(current_principal)):
    return questionnaire.public()


@router.get("/portal")
def portal(p: Principal = Depends(current_principal), db: Session = Depends(get_db)):
    """Company administrator home: own company, assessment versions, scores, open corrections."""
    c = _own_company(db, p)
    rows = db.execute(select(Assessment).where(Assessment.company_id == c.id, Assessment.channel == "company")
                      .order_by(Assessment.version_no.desc())).scalars().all()
    versions = {m.id: m.version for m in db.execute(select(MethodologyVersion)).scalars()}
    pub = assessment.current_score(db, c.id, "public")
    co = assessment.current_score(db, c.id, "company")
    docs = db.execute(select(Document).where(Document.owner_org_id == p.org_id)
                      .order_by(Document.created_at.desc()).limit(100)).scalars()
    return {"company": views.company_full(c),
            "assessments": [{"id": str(a.id), "version_no": a.version_no, "status": a.status,
                             "fiscal_year": a.fiscal_year, "created_at": a.created_at,
                             "submitted_at": a.submitted_at} for a in rows],
            "public_score": views.score_out(pub, versions.get(pub.methodology_version_id), full=False) if pub else None,
            "company_score": views.score_out(co, versions.get(co.methodology_version_id), full=False) if co else None,
            "evidence_documents": [views.document_out(d) for d in docs],
            "notice": "The Public Data Score is generated independently from public documents and cannot be edited "
                      "by the company. To correct a factual error in the public record, submit a correction request."}


@router.post("/assessments", status_code=201)
def start(body: StartIn, p: Principal = Depends(require("assessment.submit")), db: Session = Depends(get_db)):
    c = _own_company(db, p)
    a = assessment.start_company_assessment(db, p, c, body.fiscal_year)
    return _assessment_out(db, a, p)


@router.get("/assessments/{assessment_id}")
def get_assessment(assessment_id: uuid.UUID, p: Principal = Depends(current_principal), db: Session = Depends(get_db)):
    return _assessment_out(db, _assessment(db, p, assessment_id), p)


@router.put("/assessments/{assessment_id}/answers")
def save_answers(assessment_id: uuid.UUID, body: AnswersIn, p: Principal = Depends(require("assessment.submit")),
                 db: Session = Depends(get_db)):
    a = _assessment(db, p, assessment_id)
    for qid, ans in body.answers.items():
        assessment.save_answer(db, p, a, qid, ans.value, ans.source_declaration, ans.evidence_document_id)
    audit.record(db, p, "assessment.answers_saved", entity_type="assessment", entity_id=a.id, company_id=a.company_id,
                 detail={"version": a.version_no, "questions": sorted(body.answers)})
    return _assessment_out(db, a, p)


@router.post("/assessments/{assessment_id}/submit")
def submit(assessment_id: uuid.UUID, p: Principal = Depends(require("assessment.submit")), db: Session = Depends(get_db)):
    a = _assessment(db, p, assessment_id)
    assessment.submit(db, p, a)
    return _assessment_out(db, a, p)


# ── Reviewer workflow ────────────────────────────────────────────────────────

@router.get("/review/assessments")
def review_queue(status: Optional[str] = None, p: Principal = Depends(require("review.read")),
                 db: Session = Depends(get_db)):
    stmt = select(Assessment, Company).join(Company, Company.id == Assessment.company_id).where(
        Assessment.channel == "company")
    stmt = stmt.where(Assessment.status == status) if status else stmt.where(
        Assessment.status.in_(("submitted", "under_review", "returned")))
    return [{"id": str(a.id), "company": views.company_brief(c), "version_no": a.version_no, "status": a.status,
             "fiscal_year": a.fiscal_year, "submitted_at": a.submitted_at}
            for a, c in db.execute(stmt.order_by(Assessment.submitted_at.desc().nulls_last())).all()]


@router.post("/assessments/{assessment_id}/answers/{question_id}/review")
def review_answer(assessment_id: uuid.UUID, question_id: str, body: ReviewAnswerIn,
                  p: Principal = Depends(require("assessment.review")), db: Session = Depends(get_db)):
    a = _assessment(db, p, assessment_id, for_write=True)
    assessment.review_answer(db, p, a, question_id, body.decision, body.comment)
    return _assessment_out(db, a, p)


@router.post("/assessments/{assessment_id}/comments")
def comment(assessment_id: uuid.UUID, body: CommentIn, p: Principal = Depends(current_principal),
            db: Session = Depends(get_db)):
    a = _assessment(db, p, assessment_id)
    db.add(AssessmentEvent(assessment_id=a.id, event="reviewer_comment" if p.is_internal else "company_comment",
                           section=body.section, body=body.comment, actor_user_id=p.user_id, actor_label=p.email))
    audit.record(db, p, "assessment.comment", entity_type="assessment", entity_id=a.id, company_id=a.company_id,
                 detail={"section": body.section})
    db.flush()
    return _assessment_out(db, a, p)


@router.post("/assessments/{assessment_id}/return")
def return_assessment(assessment_id: uuid.UUID, body: CommentIn, p: Principal = Depends(require("assessment.review")),
                      db: Session = Depends(get_db)):
    a = _assessment(db, p, assessment_id, for_write=True)
    assessment.return_to_company(db, p, a, body.comment)
    return _assessment_out(db, a, p)


@router.post("/assessments/{assessment_id}/validate")
def validate(assessment_id: uuid.UUID, body: DecideIn, p: Principal = Depends(require("assessment.review")),
             db: Session = Depends(get_db)):
    """Close the review and generate the Company Assessment Score."""
    a = _assessment(db, p, assessment_id, for_write=True)
    assessment.validate_and_score(db, p, a, body.comment)
    return _assessment_out(db, a, p)


# ── Extraction review queue ──────────────────────────────────────────────────

@router.get("/review/items")
def review_items(kind: Optional[str] = None, status: str = "open", company_id: Optional[uuid.UUID] = None,
                 limit: int = Query(100, ge=1, le=500), p: Principal = Depends(require("review.read")),
                 db: Session = Depends(get_db)):
    stmt = select(ReviewItem).where(ReviewItem.status == status)
    if kind:
        stmt = stmt.where(ReviewItem.kind == kind)
    if company_id:
        stmt = stmt.where(ReviewItem.company_id == company_id)
    rows = db.execute(stmt.order_by(ReviewItem.created_at.desc()).limit(limit)).scalars().all()
    cos = {c.id: c for c in db.execute(select(Company).where(Company.id.in_({r.company_id for r in rows if r.company_id}))).scalars()}
    dps = {d.id: d for d in db.execute(select(DataPoint).where(DataPoint.id.in_({r.data_point_id for r in rows if r.data_point_id}))).scalars()}
    docs = {d.id: d for d in db.execute(select(Document).where(Document.id.in_({r.document_id for r in rows if r.document_id}))).scalars()}
    return [{"id": str(r.id), "kind": r.kind, "status": r.status, "summary": r.summary, "detail": r.detail,
             "created_at": r.created_at, "resolution": r.resolution,
             "company": views.company_brief(cos[r.company_id]) if r.company_id in cos else None,
             "document": {"id": str(r.document_id), "title": docs[r.document_id].title,
                          "status": docs[r.document_id].status} if r.document_id in docs else None,
             "data_point": views.data_point_out(dps[r.data_point_id], docs.get(dps[r.data_point_id].document_id))
             if r.data_point_id in dps else None} for r in rows]


def _close_items(db: Session, p: Principal, items: list[ReviewItem], resolution: str) -> None:
    for it in items:
        if it.status == "open":
            it.status, it.resolution, it.resolved_by, it.resolved_at = "resolved", resolution, p.user_id, utcnow()


@router.post("/data-points/{data_point_id}/review")
def review_data_point(data_point_id: uuid.UUID, body: DataPointDecision,
                      p: Principal = Depends(require("review.decide")), db: Session = Depends(get_db)):
    """Verify, reject or correct an extracted value. A correction never
    overwrites: it adds a verified row that supersedes the extracted one, so
    the value as originally read from the source remains on record."""
    d = db.execute(select(DataPoint).where(DataPoint.id == data_point_id).with_for_update()).scalar_one_or_none()
    if not d:
        raise HTTPException(404, "Data point not found")
    if d.channel != "public":
        raise HTTPException(409, "Company submissions are reviewed through the assessment workflow")
    if d.superseded_by_id:
        raise HTTPException(409, "This value has already been superseded by a correction")
    before = {"status": d.verification_status, "value": d.value, "unit": d.unit}
    result = d
    if body.decision == "verify":
        d.verification_status = "verified"
    elif body.decision == "reject":
        if not (body.note or "").strip():
            raise HTTPException(422, "A reason is required when rejecting a value")
        d.verification_status = "rejected"
    else:
        if body.corrected_value is None or not (body.note or "").strip():
            raise HTTPException(422, "A corrected value and a note explaining it are required")
        factor = (d.normalized_value / d.value) if d.value and d.normalized_value is not None else 1.0
        same_unit = body.corrected_unit in (None, d.unit)
        if not same_unit and body.corrected_normalized_value is None:
            raise HTTPException(422, "When the unit changes, also give the value in the normalised unit "
                                     f"({d.normalized_unit})")
        new = DataPoint(company_id=d.company_id, document_id=d.document_id, channel=d.channel,
                        metric_key=d.metric_key, category=d.category, kind=d.kind,
                        fiscal_year=body.corrected_fiscal_year or d.fiscal_year, value=body.corrected_value,
                        unit=body.corrected_unit or d.unit,
                        normalized_value=body.corrected_normalized_value if body.corrected_normalized_value is not None
                        else body.corrected_value * factor,
                        normalized_unit=d.normalized_unit, boundary=d.boundary, quote=d.quote, page_no=d.page_no,
                        source_location=d.source_location, extraction_method="manual", confidence=100.0,
                        confidence_factors=[{"factor": "reviewer", "effect": 100,
                                             "detail": "value entered by a reviewer against the source"}],
                        verification_status="verified", reviewed_by=p.user_id, reviewed_at=utcnow(),
                        review_note=body.note, attributes={**(d.attributes or {}), "corrects": str(d.id)})
        db.add(new)
        db.flush()
        d.superseded_by_id, d.verification_status = new.id, "rejected"
        result = new
    d.reviewed_by, d.reviewed_at, d.review_note = p.user_id, utcnow(), body.note
    db.flush()
    _close_items(db, p, db.execute(select(ReviewItem).where(ReviewItem.data_point_id == d.id)).scalars().all(),
                 f"{body.decision}: {body.note or ''}".strip())
    # Verifying one value settles a contradiction for that metric and period; rivals are rejected.
    if body.decision in ("verify", "correct"):
        for it in db.execute(select(ReviewItem).where(ReviewItem.company_id == d.company_id,
                                                      ReviewItem.kind == "contradiction",
                                                      ReviewItem.status == "open")).scalars().all():
            if it.detail.get("metric_key") == d.metric_key and it.detail.get("fiscal_year") == result.fiscal_year:
                for v in it.detail.get("values", []):
                    other = db.get(DataPoint, uuid.UUID(v["data_point_id"]))
                    if other and other.id not in (d.id, result.id) and other.verification_status != "verified":
                        other.verification_status = "rejected"
                        other.review_note = f"Superseded by reviewer-verified value {result.id}"
                _close_items(db, p, [it], f"Reviewer verified {result.value:g} {result.unit}")
    audit.record(db, p, f"data_point.{body.decision}", entity_type="data_point", entity_id=d.id,
                 company_id=d.company_id, detail={"metric_key": d.metric_key, "fiscal_year": d.fiscal_year,
                                                  "before": before, "note": body.note,
                                                  "corrected_to": {"id": str(result.id), "value": result.value,
                                                                   "unit": result.unit} if result is not d else None})
    pipeline.enqueue_assessment(db, d.company_id, f"reviewer {body.decision} on {d.metric_key}")
    return views.data_point_out(result, db.get(Document, result.document_id) if result.document_id else None)


@router.post("/targets/{target_id}/review")
def review_target(target_id: uuid.UUID, body: DataPointDecision, p: Principal = Depends(require("review.decide")),
                  db: Session = Depends(get_db)):
    t = db.get(ClimateTarget, target_id)
    if not t or t.channel != "public":
        raise HTTPException(404, "Target not found")
    if body.decision == "correct":
        raise HTTPException(422, "Targets are verified or rejected; re-process the document to re-read them")
    if body.decision == "reject" and not (body.note or "").strip():
        raise HTTPException(422, "A reason is required when rejecting a target")
    t.verification_status = "verified" if body.decision == "verify" else "rejected"
    t.reviewed_by, t.reviewed_at = p.user_id, utcnow()
    audit.record(db, p, f"target.{body.decision}", entity_type="climate_target", entity_id=t.id,
                 company_id=t.company_id, detail={"note": body.note, "target_kind": t.target_kind})
    pipeline.enqueue_assessment(db, t.company_id, f"reviewer {body.decision} on target")
    return views.target_out(t, db.get(Document, t.document_id) if t.document_id else None)


@router.post("/review/items/{item_id}/resolve")
def resolve_item(item_id: uuid.UUID, body: ResolveIn, p: Principal = Depends(require("review.decide")),
                 db: Session = Depends(get_db)):
    """Resolve a queue item. For a company-mapping item, supply the company;
    for a classification item, supply the category and/or financial year. The
    document is then re-processed with the reviewer's decision."""
    it = db.execute(select(ReviewItem).where(ReviewItem.id == item_id).with_for_update()).scalar_one_or_none()
    if not it:
        raise HTTPException(404, "Review item not found")
    if it.status != "open":
        raise HTTPException(409, "This item is already closed")
    doc = db.get(Document, it.document_id) if it.document_id else None
    requeue = False
    if not body.dismiss and doc:
        if it.kind == "company_mapping":
            if not body.company_id:
                raise HTTPException(422, "Select the company this document belongs to")
            c = companies.resolve(db, body.company_id)
            doc.declared_company_id, requeue = c.id, True
            it.company_id = c.id
        elif it.kind == "classification":
            if body.category:
                if body.category not in pipeline.CATEGORY_LABELS:
                    raise HTTPException(422, "Unknown document category")
                doc.declared_category, requeue = body.category, True
            if body.fiscal_year:
                doc.declared_fiscal_year, requeue = body.fiscal_year, True
        elif it.kind in ("ocr_unavailable", "extraction_failure"):
            requeue = True
    it.status = "dismissed" if body.dismiss else "resolved"
    it.resolution, it.resolved_by, it.resolved_at = body.resolution, p.user_id, utcnow()
    if requeue and doc.status not in ("pending", "processing"):
        from ..models import Job
        doc.status, doc.error = "pending", None
        db.add(Job(kind="process_document", document_id=doc.id, company_id=doc.declared_company_id,
                   payload={"after_review": str(it.id)}))
    audit.record(db, p, "review.resolve", entity_type="review_item", entity_id=it.id, company_id=it.company_id,
                 detail={"kind": it.kind, "resolution": body.resolution, "dismissed": body.dismiss,
                         "reprocess": requeue})
    return {"id": str(it.id), "status": it.status, "reprocess_queued": requeue}


# ── Correction requests ──────────────────────────────────────────────────────

def _correction_out(r: CorrectionRequest) -> dict:
    return {"id": str(r.id), "company_id": str(r.company_id), "subject": r.subject,
            "data_point_id": str(r.data_point_id) if r.data_point_id else None, "current_value": r.current_value,
            "proposed_value": r.proposed_value, "justification": r.justification, "status": r.status,
            "decision_note": r.decision_note, "created_at": r.created_at, "decided_at": r.decided_at,
            "evidence_document_id": str(r.evidence_document_id) if r.evidence_document_id else None}


@router.post("/corrections", status_code=201)
def request_correction(body: CorrectionIn, p: Principal = Depends(require("correction.request")),
                       db: Session = Depends(get_db)):
    """A company asks for a factual correction to its public record. It is a
    request: only a Climactix reviewer can change the record."""
    c = _own_company(db, p)
    current = None
    if body.data_point_id:
        d = db.get(DataPoint, body.data_point_id)
        if not d or d.company_id != c.id or d.channel != "public":
            raise HTTPException(404, "Data point not found")
        current = f"{d.value:g} {d.unit}" if d.value is not None else d.value_text
    if body.evidence_document_id:
        doc = db.get(Document, body.evidence_document_id)
        if not doc or doc.owner_org_id != p.org_id:
            raise HTTPException(422, "Evidence must be a document uploaded by your organisation")
    r = CorrectionRequest(company_id=c.id, data_point_id=body.data_point_id, requested_by=p.user_id,
                          organisation_id=p.org_id, subject=body.subject, current_value=current,
                          proposed_value=body.proposed_value, justification=body.justification,
                          evidence_document_id=body.evidence_document_id)
    db.add(r)
    db.flush()
    audit.record(db, p, "correction.request", entity_type="correction_request", entity_id=r.id, company_id=c.id,
                 detail={"subject": body.subject, "proposed_value": body.proposed_value,
                         "data_point_id": str(body.data_point_id) if body.data_point_id else None})
    return _correction_out(r)


@router.get("/corrections")
def list_corrections(status: Optional[str] = None, p: Principal = Depends(current_principal),
                     db: Session = Depends(get_db)):
    stmt = select(CorrectionRequest)
    if p.role == "company_admin":
        stmt = stmt.where(CorrectionRequest.organisation_id == p.org_id)
    elif not p.can("correction.decide"):
        raise HTTPException(403, "Your role cannot view correction requests")
    if status:
        stmt = stmt.where(CorrectionRequest.status == status)
    rows = db.execute(stmt.order_by(CorrectionRequest.created_at.desc()).limit(200)).scalars().all()
    cos = {c.id: c for c in db.execute(select(Company).where(Company.id.in_({r.company_id for r in rows}))).scalars()}
    return [{**_correction_out(r), "company": views.company_brief(cos[r.company_id])} for r in rows]


@router.post("/corrections/{correction_id}/decide")
def decide_correction(correction_id: uuid.UUID, body: CorrectionDecision,
                      p: Principal = Depends(require("correction.decide")), db: Session = Depends(get_db)):
    r = db.execute(select(CorrectionRequest).where(CorrectionRequest.id == correction_id).with_for_update()).scalar_one_or_none()
    if not r:
        raise HTTPException(404, "Correction request not found")
    if r.status != "open":
        raise HTTPException(409, "This request has already been decided")
    r.status = "accepted" if body.decision == "accept" else "rejected"
    r.decision_note, r.decided_by, r.decided_at = body.note, p.user_id, utcnow()
    applied = None
    if body.decision == "accept" and r.data_point_id and body.corrected_normalized_value is not None:
        d = db.get(DataPoint, r.data_point_id)
        if d and not d.superseded_by_id and d.kind == "numeric":
            factor = (d.normalized_value / d.value) if d.value and d.normalized_value else 1.0
            new = DataPoint(company_id=d.company_id, document_id=d.document_id,
                            channel="public", metric_key=d.metric_key, category=d.category, kind="numeric",
                            fiscal_year=d.fiscal_year, value=body.corrected_normalized_value / factor, unit=d.unit,
                            normalized_value=body.corrected_normalized_value, normalized_unit=d.normalized_unit,
                            boundary=d.boundary, quote=d.quote, page_no=d.page_no, source_location=d.source_location,
                            extraction_method="manual", confidence=100.0, verification_status="verified",
                            reviewed_by=p.user_id, reviewed_at=utcnow(),
                            review_note=f"Correction request {r.id} accepted: {body.note}",
                            attributes={"corrects": str(d.id), "correction_request": str(r.id)})
            db.add(new)
            db.flush()
            d.superseded_by_id, d.verification_status = new.id, "rejected"
            applied = str(new.id)
            pipeline.enqueue_assessment(db, d.company_id, f"correction request {r.id} accepted")
    audit.record(db, p, f"correction.{r.status}", entity_type="correction_request", entity_id=r.id,
                 company_id=r.company_id, detail={"note": body.note, "applied_data_point": applied})
    return {**_correction_out(r), "applied_data_point_id": applied}


@router.get("/metrics/catalogue")
def catalogue(p: Principal = Depends(current_principal)):
    return [{"key": k, "name": metric_name(k), **{a: v[a] for a in ("category", "group", "families")}}
            for k, v in sorted(CATALOGUE.items())]
