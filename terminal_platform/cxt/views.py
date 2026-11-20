"""
Read models and access rules shared by the API routers.

`access_level` is the single place that decides how much of a company a
caller may see:

  private       everything, including company submissions and the Company
                Assessment Score — Climactix staff and the company itself
  intelligence  the public intelligence profile (public documents, public
                data, Public Data Score, Data Confidence) — institutional
                subscribers
  directory     name, sector, country and disclosure coverage only
"""

from __future__ import annotations

import uuid
from typing import Any, Optional

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from . import security
from .extraction.catalogue import CATALOGUE, metric_name
from .models import ClimateTarget, Company, DataPoint, Document, Score
from .pipeline import CATEGORY_LABELS
from .security import Principal
from .util import fy_label


def access_level(db: Session, p: Principal, company: Company) -> str:
    if p.is_internal:
        return "private"
    ents = security.entitlements_for(db, p)
    if p.role == "company_admin" and p.company_id == company.id:
        return "private" if "company_profile" in ents else "directory"
    if "company_intelligence" in ents:
        return "intelligence"
    return "directory"


def require_level(db: Session, p: Principal, company: Company, minimum: str) -> str:
    order = {"directory": 0, "intelligence": 1, "private": 2}
    lvl = access_level(db, p, company)
    if order[lvl] < order[minimum]:
        if minimum == "private":
            raise HTTPException(403, "This information is private to the company and Climactix reviewers")
        if p.role == "company_admin" and p.company_id == company.id:
            security.require_entitlement(db, p, "company_profile")
        security.require_entitlement(db, p, "company_intelligence")
        raise HTTPException(403, "Your organisation does not have access to company intelligence profiles")
    return lvl


def document_visible(p: Principal, doc: Document) -> bool:
    if doc.visibility == "public":
        return True
    return p.is_internal or doc.owner_org_id == p.org_id


def company_brief(c: Company) -> dict:
    return {"id": str(c.id), "cx_id": c.cx_id, "legal_name": c.legal_name, "common_name": c.common_name,
            "country": c.country, "sector": c.sector.name if c.sector else None,
            "sector_code": c.sector.code if c.sector else None, "industry": c.industry,
            "is_synthetic": c.is_synthetic}


def company_full(c: Company) -> dict:
    return {**company_brief(c), "registration_id": c.registration_id, "registration_type": c.registration_type,
            "website": c.website, "headquarters": c.headquarters, "description": c.description,
            "status": c.status, "record_source": c.record_source, "created_at": c.created_at,
            "share_company_score": c.share_company_score}


def document_out(d: Document, detail: bool = False) -> dict:
    out = {"id": str(d.id), "company_id": str(d.company_id) if d.company_id else None, "title": d.title,
           "filename": d.original_filename, "category": d.category, "category_label": CATEGORY_LABELS[d.category],
           "fiscal_year": d.fiscal_year, "fy_label": fy_label(d.fiscal_year), "file_format": d.file_format,
           "size_bytes": d.size_bytes, "version_no": d.version_no, "status": d.status, "stage": d.stage,
           "source_type": d.source_type, "source_url": d.source_url, "retrieved_at": d.retrieved_at,
           "visibility": d.visibility, "page_count": d.page_count, "ocr_pages": d.ocr_pages,
           "extraction_confidence": d.extraction_confidence, "created_at": d.created_at,
           "processed_at": d.processed_at, "error": d.error, "sha256": d.sha256,
           "supersedes_id": str(d.supersedes_id) if d.supersedes_id else None}
    if detail:
        out["classification"] = d.classification
        out["extraction_summary"] = {k: v for k, v in (d.extraction_summary or {}).items() if k != "stages"}
        out["declared"] = {"category": d.declared_category, "fiscal_year": d.declared_fiscal_year,
                           "company_id": str(d.declared_company_id) if d.declared_company_id else None}
    return out


def data_point_out(d: DataPoint, doc: Optional[Document] = None) -> dict:
    return {"id": str(d.id), "metric_key": d.metric_key, "metric": metric_name(d.metric_key),
            "category": d.category, "kind": d.kind, "fiscal_year": d.fiscal_year, "fy_label": fy_label(d.fiscal_year),
            "value": d.value, "value_text": d.value_text, "unit": d.unit,
            "normalized_value": d.normalized_value, "normalized_unit": d.normalized_unit, "boundary": d.boundary,
            "channel": d.channel, "confidence": d.confidence, "confidence_factors": d.confidence_factors,
            "verification_status": d.verification_status, "review_note": d.review_note,
            "reviewed_at": d.reviewed_at,
            "provenance": {"document_id": str(d.document_id) if d.document_id else None,
                           "document_title": doc.title if doc else None,
                           "source_type": doc.source_type if doc else ("questionnaire" if d.assessment_id else None),
                           "source_url": doc.source_url if doc else None,
                           "page_no": d.page_no, "source_location": d.source_location, "quote": d.quote,
                           "reporting_period": fy_label(d.fiscal_year), "extracted_at": d.extracted_at,
                           "extraction_method": d.extraction_method}}


def target_out(t: ClimateTarget, doc: Optional[Document] = None) -> dict:
    return {"id": str(t.id), "target_kind": t.target_kind, "horizon": t.horizon, "description": t.description,
            "scope_coverage": t.scope_coverage, "commitment_class": t.commitment_class,
            "validation_status": t.validation_status, "reduction_pct": t.reduction_pct,
            "baseline_year": t.baseline_year, "target_year": t.target_year, "target_type": t.target_type,
            "progress_status": t.progress_status, "reported_progress_pct": t.reported_progress_pct,
            "fiscal_year": t.fiscal_year, "channel": t.channel, "confidence": t.confidence,
            "verification_status": t.verification_status,
            "provenance": {"document_id": str(t.document_id) if t.document_id else None,
                           "document_title": doc.title if doc else None, "page_no": t.page_no, "quote": t.quote,
                           "extracted_at": t.extracted_at}}


def score_out(s: Score, methodology_version: Optional[str] = None, full: bool = True) -> dict:
    out = {"id": str(s.id), "score_type": s.score_type, "overall": s.overall, "confidence": s.confidence,
           "confidence_band": s.result["confidence"]["band"], "evidence_coverage": s.evidence_coverage,
           "pillars": s.pillars, "fiscal_year": s.fiscal_year, "fy_label": fy_label(s.fiscal_year),
           "computed_at": s.computed_at, "is_current": s.is_current, "methodology_version": methodology_version,
           "engine_version": s.engine_version, "trigger": s.trigger, "inputs_hash": s.inputs_hash,
           "result_hash": s.result_hash, "assessment_id": str(s.assessment_id)}
    if full:
        out["result"] = s.result
    return out


def usable_points(db: Session, company_id: uuid.UUID, include_company: bool = False,
                  include_unusable: bool = False) -> list[tuple[DataPoint, Optional[Document]]]:
    """Data points for display, joined to their source document."""
    stmt = (select(DataPoint, Document).outerjoin(Document, Document.id == DataPoint.document_id)
            .where(DataPoint.company_id == company_id, DataPoint.superseded_by_id.is_(None)))
    superseded = select(Document.supersedes_id).where(Document.supersedes_id.is_not(None))
    stmt = stmt.where((DataPoint.document_id.is_(None)) | (DataPoint.document_id.not_in(superseded)))
    if not include_company:
        stmt = stmt.where(DataPoint.channel == "public", Document.visibility == "public")
    if not include_unusable:
        stmt = stmt.where(DataPoint.verification_status.in_(("extracted", "verified", "evidence_accepted")))
    return [(d, doc) for d, doc in db.execute(stmt.order_by(DataPoint.metric_key, DataPoint.fiscal_year.desc())).all()]


def metric_series(points: list[tuple[DataPoint, Any]]) -> dict[str, dict]:
    """{metric_key: {name, unit, category, values: {fy: {...best point}}}} for numeric points."""
    out: dict[str, dict] = {}
    for d, doc in points:
        if d.kind != "numeric" or d.fiscal_year is None or d.normalized_value is None:
            continue
        m = out.setdefault(d.metric_key, {"metric_key": d.metric_key, "name": metric_name(d.metric_key),
                                          "category": d.category, "group": CATALOGUE.get(d.metric_key, {}).get("group"),
                                          "unit": d.normalized_unit, "values": {}})
        cur = m["values"].get(d.fiscal_year)
        rank = (d.verification_status in ("verified", "evidence_accepted"), d.confidence)
        if not cur or rank > cur["_rank"]:
            m["values"][d.fiscal_year] = {"value": d.normalized_value, "unit": d.normalized_unit,
                                          "as_reported": d.value, "as_reported_unit": d.unit,
                                          "verification_status": d.verification_status, "confidence": d.confidence,
                                          "data_point_id": str(d.id), "channel": d.channel,
                                          "document_id": str(d.document_id) if d.document_id else None,
                                          "page_no": d.page_no, "_rank": rank}
    for m in out.values():
        for v in m["values"].values():
            v.pop("_rank")
        m["values"] = {str(k): v for k, v in sorted(m["values"].items())}
    return out


def coverage_status(db: Session, company_id: uuid.UUID) -> dict:
    """Where a company stands in the processing lifecycle (admin dashboard)."""
    by_status = dict(db.execute(select(Document.status, func.count()).where(
        (Document.company_id == company_id) | (Document.declared_company_id == company_id))
        .group_by(Document.status)).all())
    total = sum(by_status.values())
    score = db.execute(select(Score.id).where(Score.company_id == company_id, Score.is_current,
                                              Score.score_type == "public")).first()
    if total == 0:
        stage = "no_reports"
    elif by_status.get("pending", 0) or by_status.get("processing", 0):
        stage = "awaiting_extraction"
    elif not by_status.get("completed", 0):
        stage = "reports_ingested"
    elif score:
        stage = "score_generated"
    else:
        stage = "assessment_pending"
    return {"stage": stage, "documents": total, "by_status": by_status}
