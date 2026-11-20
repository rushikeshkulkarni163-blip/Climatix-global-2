"""Company records, report repository, documents, extracted data, scores, Net Zero."""

from __future__ import annotations

import csv
import io
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import assessment, audit, companies, connectors, pipeline, reports, security, storage, views
from ..config import get_settings
from ..db import get_db
from ..models import (Assessment, ClimateTarget, Company, CompanyAlias, CompanyMerge, DataPoint, Document,
                      DocumentPage, GeneratedReport, IngestionSource, Job, MethodologyVersion, ProcessingLog,
                      Score, Sector)
from ..security import Principal, current_principal, require
from ..util import fy_label, parse_fy

router = APIRouter(tags=["Companies and repository"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class CompanyIn(BaseModel):
    legal_name: str = Field(min_length=2, max_length=300)
    common_name: Optional[str] = Field(default=None, max_length=300)
    registration_id: Optional[str] = Field(default=None, max_length=40)
    registration_type: Optional[str] = Field(default=None, max_length=20)
    country: str = Field(min_length=2, max_length=80)
    sector_code: Optional[str] = None
    industry: Optional[str] = Field(default=None, max_length=160)
    website: Optional[str] = Field(default=None, max_length=400)
    headquarters: Optional[str] = Field(default=None, max_length=200)
    description: Optional[str] = Field(default=None, max_length=4000)
    aliases: list[str] = []
    is_synthetic: bool = False
    allow_duplicate: bool = False


class CompanyPatch(BaseModel):
    common_name: Optional[str] = Field(default=None, max_length=300)
    sector_code: Optional[str] = None
    industry: Optional[str] = Field(default=None, max_length=160)
    website: Optional[str] = Field(default=None, max_length=400)
    headquarters: Optional[str] = Field(default=None, max_length=200)
    description: Optional[str] = Field(default=None, max_length=4000)
    country: Optional[str] = Field(default=None, max_length=80)


class MergeIn(BaseModel):
    source_id: uuid.UUID
    target_id: uuid.UUID
    reason: str = Field(min_length=10, max_length=2000)


class SourceIn(BaseModel):
    connector: str
    url: Optional[str] = Field(default=None, max_length=1000)
    label: Optional[str] = Field(default=None, max_length=200)


class IngestUrlsIn(BaseModel):
    urls: list[str] = Field(min_length=1, max_length=25)
    category: Optional[str] = None
    fiscal_year: Optional[str] = None


def _company(db: Session, company_id: uuid.UUID) -> Company:
    return companies.resolve(db, company_id)


# ── Reference data ───────────────────────────────────────────────────────────

@router.get("/reference")
def reference(p: Principal = Depends(current_principal), db: Session = Depends(get_db)):
    sectors = db.execute(select(Sector).where(Sector.active).order_by(Sector.name)).scalars()
    return {"sectors": [{"code": s.code, "name": s.name} for s in sectors],
            "document_categories": [{"code": k, "label": v} for k, v in pipeline.CATEGORY_LABELS.items()],
            "connectors": connectors.describe(),
            "upload": {"max_mb": get_settings().max_upload_mb,
                       "formats": ["PDF", "DOCX", "XLSX", "CSV", "PNG", "JPEG", "TIFF"]}}


# ── Companies ────────────────────────────────────────────────────────────────

@router.get("/companies")
def list_companies(q: Optional[str] = Query(default=None, max_length=200), sector: Optional[str] = None,
                   country: Optional[str] = None, limit: int = Query(25, ge=1, le=100),
                   offset: int = Query(0, ge=0), p: Principal = Depends(require("company.read")),
                   db: Session = Depends(get_db)):
    rows, total = companies.search(db, q, sector_code=sector, country=country, limit=limit, offset=offset)
    ents = security.entitlements_for(db, p)
    show_scores = p.is_internal or "company_intelligence" in ents
    scores = {}
    if show_scores and rows:
        for s in db.execute(select(Score).where(Score.company_id.in_([c.id for c in rows]), Score.is_current,
                                                Score.score_type == "public")).scalars():
            scores[s.company_id] = s
    docs = dict(db.execute(select(Document.company_id, func.count()).where(
        Document.company_id.in_([c.id for c in rows]), Document.visibility == "public",
        Document.status == "completed").group_by(Document.company_id)).all()) if rows else {}
    items = []
    for c in rows:
        item = {**views.company_brief(c), "public_documents": docs.get(c.id, 0)}
        if show_scores:
            s = scores.get(c.id)
            item["public_score"] = None if not s else {"overall": s.overall, "confidence": s.confidence,
                                                       "confidence_band": s.result["confidence"]["band"],
                                                       "fy_label": fy_label(s.fiscal_year)}
        items.append(item)
    return {"total": total, "items": items, "scores_included": show_scores}


@router.post("/companies", status_code=201)
def create_company(body: CompanyIn, p: Principal = Depends(require("company.manage")), db: Session = Depends(get_db)):
    c = companies.create_company(db, p, **body.model_dump())
    return views.company_full(c)


@router.post("/companies/duplicates")
def check_duplicates(body: CompanyIn, p: Principal = Depends(require("company.manage")), db: Session = Depends(get_db)):
    return {"duplicates": companies.find_duplicates(db, body.legal_name, body.registration_id)}


@router.post("/companies/import")
async def import_companies(file: UploadFile = File(...), p: Principal = Depends(require("company.manage")),
                           db: Session = Depends(get_db)):
    """Bulk import from CSV. Columns: legal_name, country (required); common_name,
    registration_id, registration_type, sector_code, industry, website, headquarters."""
    raw = await file.read()
    if len(raw) > 5 * 1024 * 1024:
        raise HTTPException(413, "Import file exceeds 5 MB")
    try:
        rows = list(csv.DictReader(io.StringIO(raw.decode("utf-8-sig"))))
    except UnicodeDecodeError:
        raise HTTPException(422, "The import file must be UTF-8 CSV")
    if not rows or "legal_name" not in rows[0] or "country" not in rows[0]:
        raise HTTPException(422, "CSV must include the columns legal_name and country")
    if len(rows) > 2000:
        raise HTTPException(422, "At most 2,000 companies can be imported at once")
    created, skipped = [], []
    for n, r in enumerate(rows, start=2):
        name = (r.get("legal_name") or "").strip()
        if not name or not (r.get("country") or "").strip():
            skipped.append({"row": n, "legal_name": name, "reason": "legal_name and country are required"})
            continue
        try:
            with db.begin_nested():
                c = companies.create_company(
                    db, p, legal_name=name, country=r["country"],
                    **{k: (r.get(k) or "").strip() or None for k in
                       ("common_name", "registration_id", "registration_type", "sector_code", "industry",
                        "website", "headquarters")}, record_source=f"csv_import:{file.filename}"[:40])
            created.append({"row": n, "cx_id": c.cx_id, "legal_name": c.legal_name})
        except HTTPException as e:
            detail = e.detail if isinstance(e.detail, str) else e.detail.get("message", "rejected")
            skipped.append({"row": n, "legal_name": name, "reason": detail})
    audit.record(db, p, "company.import", detail={"file": file.filename, "created": len(created),
                                                  "skipped": len(skipped)})
    return {"created": created, "skipped": skipped}


@router.post("/companies/merge")
def merge_companies(body: MergeIn, p: Principal = Depends(require("company.merge")), db: Session = Depends(get_db)):
    rec = companies.merge(db, p, body.source_id, body.target_id, body.reason)
    pipeline.enqueue_assessment(db, body.target_id, f"merge of company {body.source_id}")
    return {"merge_id": str(rec.id), "target_id": str(rec.target_id), "moved": rec.moved}


@router.get("/companies/{company_id}")
def get_company(company_id: uuid.UUID, p: Principal = Depends(require("company.read")), db: Session = Depends(get_db)):
    """The consolidated company intelligence profile. Sections the caller is
    not entitled to are omitted and listed in `withheld`."""
    c = _company(db, company_id)
    level = views.access_level(db, p, c)
    aliases = [a for a, in db.execute(select(CompanyAlias.alias).where(CompanyAlias.company_id == c.id))]
    out = {"company": {**views.company_full(c), "aliases": aliases}, "access_level": level, "withheld": []}
    private = level == "private"
    docs = db.execute(select(Document).where(Document.company_id == c.id, Document.status == "completed")
                      .order_by(Document.fiscal_year.desc().nulls_last(), Document.category)).scalars().all()
    docs = [d for d in docs if views.document_visible(p, d)]
    out["reporting_periods"] = sorted({d.fiscal_year for d in docs if d.fiscal_year}, reverse=True)
    out["document_count"] = len(docs)
    out["documents_by_category"] = {}
    for d in docs:
        if d.visibility == "public":
            out["documents_by_category"][d.category] = out["documents_by_category"].get(d.category, 0) + 1
    if level == "directory":
        out["withheld"] = ["scores", "emissions_profile", "net_zero", "evidence", "assessment_history"]
        return out

    versions = {m.id: m.version for m in db.execute(select(MethodologyVersion)).scalars()}
    pub = assessment.current_score(db, c.id, "public")
    out["public_score"] = views.score_out(pub, versions.get(pub.methodology_version_id)) if pub else None
    co = assessment.current_score(db, c.id, "company")
    if co and (private or c.share_company_score):
        out["company_score"] = views.score_out(co, versions.get(co.methodology_version_id))
    else:
        out["company_score"] = None
        if co:
            out["withheld"].append("company_score")
    out["benchmark"] = assessment.sector_benchmark(db, c)
    history = db.execute(select(Score).where(Score.company_id == c.id).order_by(Score.computed_at)).scalars().all()
    out["score_history"] = [views.score_out(s, versions.get(s.methodology_version_id), full=False) for s in history
                            if s.score_type == "public" or private or c.share_company_score]
    pts = views.usable_points(db, c.id, include_company=private)
    series = views.metric_series(pts)
    out["metrics"] = sorted(series.values(), key=lambda m: (m["category"], m["name"]))
    out["signals"] = [views.data_point_out(d, doc) for d, doc in pts if d.kind == "signal"]
    assessments = db.execute(select(Assessment).where(Assessment.company_id == c.id)
                             .order_by(Assessment.created_at.desc())).scalars().all()
    out["assessment_history"] = [{"id": str(a.id), "channel": a.channel, "version_no": a.version_no,
                                  "status": a.status, "fiscal_year": a.fiscal_year, "created_at": a.created_at,
                                  "submitted_at": a.submitted_at, "trigger": a.trigger}
                                 for a in assessments if a.channel == "public" or private]
    return out


@router.patch("/companies/{company_id}")
def update_company(company_id: uuid.UUID, body: CompanyPatch, p: Principal = Depends(current_principal),
                   db: Session = Depends(get_db)):
    c = _company(db, company_id)
    own = p.role == "company_admin" and p.company_id == c.id
    if not (p.can("company.manage") or own):
        raise HTTPException(403, "You cannot edit this company record")
    data = body.model_dump(exclude_unset=True)
    if own:                                     # a company may maintain descriptive fields only
        data = {k: v for k, v in data.items() if k in ("common_name", "website", "headquarters", "description")}
    before = {}
    for k, v in data.items():
        if k == "sector_code":
            sector = db.execute(select(Sector).where(Sector.code == v, Sector.active)).scalar_one_or_none() if v else None
            if v and not sector:
                raise HTTPException(422, f"Unknown sector '{v}'")
            before["sector_id"], c.sector_id = str(c.sector_id), sector.id if sector else None
        else:
            before[k] = getattr(c, k)
            setattr(c, k, v)
    audit.record(db, p, "company.update", entity_type="company", entity_id=c.id, company_id=c.id,
                 detail={"before": before, "after": data})
    if "sector_code" in data:
        pipeline.enqueue_assessment(db, c.id, "sector classification changed")
    db.flush()
    db.refresh(c)
    return views.company_full(c)


@router.put("/companies/{company_id}/sharing")
def set_sharing(company_id: uuid.UUID, share: bool, p: Principal = Depends(current_principal),
                db: Session = Depends(get_db)):
    """The company decides whether institutional users may see its Company Assessment Score."""
    c = _company(db, company_id)
    if not (p.role == "company_admin" and p.company_id == c.id):
        raise HTTPException(403, "Only the company itself can change this setting")
    c.share_company_score = share
    audit.record(db, p, "company.sharing", entity_type="company", entity_id=c.id, company_id=c.id,
                 detail={"share_company_score": share})
    return {"share_company_score": share}


@router.get("/companies/{company_id}/merges")
def merge_history(company_id: uuid.UUID, p: Principal = Depends(require("company.manage")),
                  db: Session = Depends(get_db)):
    rows = db.execute(select(CompanyMerge).where((CompanyMerge.target_id == company_id)
                                                 | (CompanyMerge.source_id == company_id))
                      .order_by(CompanyMerge.at.desc())).scalars()
    return [{"id": str(m.id), "source": m.source_snapshot, "target_id": str(m.target_id), "reason": m.reason,
             "moved": m.moved, "at": m.at} for m in rows]


# ── Report repository ────────────────────────────────────────────────────────

@router.get("/companies/{company_id}/repository")
def repository(company_id: uuid.UUID, year: Optional[str] = None, category: Optional[str] = None,
               q: Optional[str] = Query(default=None, max_length=200), include_history: bool = False,
               p: Principal = Depends(require("document.read")), db: Session = Depends(get_db)):
    """Company-wise repository, grouped by financial year."""
    c = _company(db, company_id)
    stmt = select(Document).where((Document.company_id == c.id)
                                  | ((Document.company_id.is_(None)) & (Document.declared_company_id == c.id)))
    if year:
        stmt = stmt.where(Document.fiscal_year == parse_fy(year))
    if category:
        stmt = stmt.where(Document.category == category)
    if q:
        stmt = stmt.where(Document.title.ilike(f"%{q}%") | Document.original_filename.ilike(f"%{q}%"))
    docs = [d for d in db.execute(stmt.order_by(Document.fiscal_year.desc().nulls_last(), Document.category,
                                                Document.version_no.desc())).scalars() if views.document_visible(p, d)]
    if not p.is_internal:                        # work in progress is internal, except a company's own uploads
        docs = [d for d in docs if d.status == "completed" or d.owner_org_id == p.org_id]
    superseded = {d.supersedes_id for d in docs if d.supersedes_id}
    years: dict = {}
    for d in docs:
        if d.id in superseded and not include_history:
            continue
        y = years.setdefault(d.fiscal_year, {"fiscal_year": d.fiscal_year,
                                             "fy_label": fy_label(d.fiscal_year) or "Period not determined",
                                             "documents": []})
        y["documents"].append({**views.document_out(d), "superseded": d.id in superseded})
    ordered = sorted(years.values(), key=lambda y: -(y["fiscal_year"] or 0))
    return {"company": views.company_brief(c), "years": ordered, "total": sum(len(y["documents"]) for y in ordered),
            "categories": sorted({d.category for d in docs})}


def _upload(db, p, c, content, filename, content_type, category, fiscal_year, title, company_submission):
    try:
        fy = parse_fy(fiscal_year)
    except ValueError as e:
        raise HTTPException(422, str(e))
    if company_submission:
        security.require_entitlement(db, p, "report_hosting")
        doc, dup = pipeline.ingest_bytes(db, p, content, filename, content_type, company_id=c.id, category=category,
                                         fiscal_year=fy, source_type="company_submission", visibility="private",
                                         owner_org_id=p.org_id, title=title)
    else:
        doc, dup = pipeline.ingest_bytes(db, p, content, filename, content_type, company_id=c.id if c else None,
                                         category=category, fiscal_year=fy, source_type="upload",
                                         visibility="public", title=title)
    return {**views.document_out(doc), "duplicate": dup,
            "message": "This file is already in the repository" if dup else
            "Document accepted and queued for extraction and assessment"}


@router.post("/companies/{company_id}/documents", status_code=202)
async def upload_document(company_id: uuid.UUID, file: UploadFile = File(...),
                          category: Optional[str] = Form(default=None), fiscal_year: Optional[str] = Form(default=None),
                          title: Optional[str] = Form(default=None, max_length=400),
                          p: Principal = Depends(current_principal), db: Session = Depends(get_db)):
    """Upload a report. Climactix analysts add public disclosures; a company
    administrator adds private supporting documents for its own company.
    Either way the upload starts the extraction workflow."""
    c = _company(db, company_id)
    own = p.role == "company_admin" and p.company_id == c.id
    if not (p.can("document.ingest_public") or (own and p.can("document.submit_company"))):
        raise HTTPException(403, "You cannot add documents for this company")
    limit = get_settings().max_upload_mb * 1024 * 1024
    content = await file.read(limit + 1)
    return _upload(db, p, c, content, file.filename or "", file.content_type or "", category, fiscal_year, title,
                   company_submission=own)


@router.post("/documents", status_code=202)
async def upload_unassigned(file: UploadFile = File(...), category: Optional[str] = Form(default=None),
                            fiscal_year: Optional[str] = Form(default=None),
                            p: Principal = Depends(require("document.ingest_public")), db: Session = Depends(get_db)):
    """Upload without naming a company: the pipeline identifies it from the document."""
    content = await file.read(get_settings().max_upload_mb * 1024 * 1024 + 1)
    return _upload(db, p, None, content, file.filename or "", file.content_type or "", category, fiscal_year, None,
                   company_submission=False)


def _doc(db: Session, p: Principal, document_id: uuid.UUID) -> Document:
    d = db.get(Document, document_id)
    if not d or not views.document_visible(p, d):
        raise HTTPException(404, "Document not found")
    if not p.is_internal and d.status != "completed" and d.owner_org_id != p.org_id:
        raise HTTPException(404, "Document not found")
    return d


@router.get("/documents/{document_id}")
def get_document(document_id: uuid.UUID, p: Principal = Depends(require("document.read")),
                 db: Session = Depends(get_db)):
    d = _doc(db, p, document_id)
    out = views.document_out(d, detail=True)
    out["company"] = views.company_brief(d.company) if d.company else None
    logs = db.execute(select(ProcessingLog).where(ProcessingLog.document_id == d.id).order_by(ProcessingLog.id)).scalars()
    out["processing_log"] = [{"at": l.at, "stage": l.stage, "level": l.level, "message": l.message} for l in logs]
    out["data_points"] = db.execute(select(func.count()).select_from(DataPoint).where(DataPoint.document_id == d.id)).scalar()
    out["download_token"] = storage.sign_download(str(d.id), str(p.user_id))
    return out


@router.get("/documents/{document_id}/pages")
def document_pages(document_id: uuid.UUID, page: int = Query(1, ge=1), count: int = Query(1, ge=1, le=10),
                   p: Principal = Depends(require("document.read")), db: Session = Depends(get_db)):
    """Extracted text and tables per page — the document preview and the target of every provenance link."""
    d = _doc(db, p, document_id)
    rows = db.execute(select(DocumentPage).where(DocumentPage.document_id == d.id, DocumentPage.page_no >= page,
                                                 DocumentPage.page_no < page + count).order_by(DocumentPage.page_no)).scalars()
    pts = db.execute(select(DataPoint).where(DataPoint.document_id == d.id, DataPoint.page_no >= page,
                                             DataPoint.page_no < page + count)).scalars().all()
    return {"document_id": str(d.id), "page_count": d.page_count,
            "pages": [{"page_no": r.page_no, "label": r.label, "text": r.text, "tables": r.tables, "is_ocr": r.is_ocr,
                       "data_points": [views.data_point_out(x, d) for x in pts if x.page_no == r.page_no]}
                      for r in rows]}


@router.get("/documents/{document_id}/download")
def download_document(document_id: uuid.UUID, p: Principal = Depends(require("document.read")),
                      db: Session = Depends(get_db)):
    d = _doc(db, p, document_id)
    if d.visibility == "public" and not p.is_internal and p.role != "company_admin":
        security.require_entitlement(db, p, "report_download")
    data = storage.get_store().get(d.storage_key)
    audit.record(db, p, "document.download", entity_type="document", entity_id=d.id, company_id=d.company_id)
    media = {"pdf": "application/pdf", "csv": "text/csv",
             "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
             "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}.get(d.file_format,
                                                                                               "application/octet-stream")
    safe = "".join(ch if ch.isalnum() or ch in "._- " else "_" for ch in d.original_filename)[:150]
    return Response(data, media_type=media, headers={"Content-Disposition": f'attachment; filename="{safe}"',
                                                     "X-Content-Type-Options": "nosniff",
                                                     "Cache-Control": "private, no-store"})


@router.post("/documents/{document_id}/reprocess", status_code=202)
def reprocess(document_id: uuid.UUID, p: Principal = Depends(require("document.ingest_public")),
              db: Session = Depends(get_db)):
    d = _doc(db, p, document_id)
    if d.status in ("pending", "processing"):
        raise HTTPException(409, "This document is already queued for processing")
    d.status, d.error = "pending", None
    db.add(Job(kind="process_document", document_id=d.id, company_id=d.company_id, payload={"reprocess": True}))
    audit.record(db, p, "document.reprocess", entity_type="document", entity_id=d.id, company_id=d.company_id)
    return views.document_out(d)


@router.get("/documents/compare/periods")
def compare_periods(company_id: uuid.UUID, year_a: str, year_b: str,
                    p: Principal = Depends(require("document.read")), db: Session = Depends(get_db)):
    """Side-by-side comparison of two reporting periods: documents available and reported values."""
    c = _company(db, company_id)
    lvl = views.require_level(db, p, c, "intelligence")
    try:
        a, b = parse_fy(year_a), parse_fy(year_b)
    except ValueError as e:
        raise HTTPException(422, str(e))
    series = views.metric_series(views.usable_points(db, c.id, include_company=lvl == "private"))
    rows = []
    for m in series.values():
        va, vb = m["values"].get(str(a)), m["values"].get(str(b))
        if not va and not vb:
            continue
        change = None
        if va and vb and va["value"] and va["unit"] == vb["unit"]:
            change = round(100 * (vb["value"] - va["value"]) / abs(va["value"]), 1)
        rows.append({"metric_key": m["metric_key"], "name": m["name"], "category": m["category"], "unit": m["unit"],
                     "a": va, "b": vb, "change_pct": change})
    docs = db.execute(select(Document).where(Document.company_id == c.id, Document.status == "completed",
                                             Document.fiscal_year.in_([a, b]))).scalars()
    by = {a: [], b: []}
    for d in docs:
        if views.document_visible(p, d):
            by[d.fiscal_year].append({"id": str(d.id), "category_label": pipeline.CATEGORY_LABELS[d.category],
                                      "title": d.title})
    return {"company": views.company_brief(c), "a": {"fiscal_year": a, "fy_label": fy_label(a), "documents": by[a]},
            "b": {"fiscal_year": b, "fy_label": fy_label(b), "documents": by[b]},
            "metrics": sorted(rows, key=lambda r: (r["category"], r["name"]))}


# ── Public-source ingestion ──────────────────────────────────────────────────

@router.get("/companies/{company_id}/sources")
def list_sources(company_id: uuid.UUID, p: Principal = Depends(require("ingestion.manage")),
                 db: Session = Depends(get_db)):
    rows = db.execute(select(IngestionSource).where(IngestionSource.company_id == company_id)
                      .order_by(IngestionSource.created_at.desc())).scalars()
    return [{"id": str(s.id), "connector": s.connector, "url": s.url, "label": s.label, "status": s.status,
             "last_checked_at": s.last_checked_at, "last_result": s.last_result} for s in rows]


@router.post("/companies/{company_id}/sources", status_code=201)
def add_source(company_id: uuid.UUID, body: SourceIn, p: Principal = Depends(require("ingestion.manage")),
               db: Session = Depends(get_db)):
    """Register a public source. A connector that is not configured is recorded
    as pending and performs no retrieval."""
    c = _company(db, company_id)
    info = connectors.CONNECTORS.get(body.connector)
    if not info:
        raise HTTPException(422, f"Unknown connector '{body.connector}'")
    if info.status == "operational" and not body.url:
        raise HTTPException(422, "A URL is required for this connector")
    src = IngestionSource(company_id=c.id, connector=body.connector, url=body.url, label=body.label,
                          status="registered" if info.status == "operational" else "pending_configuration",
                          last_result={} if info.status == "operational" else {"requires": info.requires},
                          created_by=p.user_id)
    db.add(src)
    db.flush()
    audit.record(db, p, "ingestion.source_registered", entity_type="ingestion_source", entity_id=src.id,
                 company_id=c.id, detail={"connector": body.connector, "url": body.url, "status": src.status})
    return {"id": str(src.id), "connector": src.connector, "status": src.status, "url": src.url,
            "requires": info.requires if info.status != "operational" else None}


@router.post("/sources/{source_id}/discover")
def discover(source_id: uuid.UUID, p: Principal = Depends(require("ingestion.manage")), db: Session = Depends(get_db)):
    """Read the registered page now and list the report documents it links to."""
    src = db.get(IngestionSource, source_id)
    if not src:
        raise HTTPException(404, "Source not found")
    try:
        connectors.require_operational(src.connector)
        if src.connector != "web_discovery":
            raise connectors.ConnectorError("Discovery applies to web page sources; direct URLs are ingested as they are")
        found = connectors.discover(src.url)
    except connectors.ConnectorError as e:
        from ..models import utcnow
        src.status, src.last_checked_at = "error", utcnow()
        src.last_result = {"error": str(e)}
        audit.record(db, p, "ingestion.discovery_failed", entity_type="ingestion_source", entity_id=src.id,
                     company_id=src.company_id, detail={"error": str(e)})
        db.commit()
        raise HTTPException(502, str(e))
    from ..models import utcnow
    known = {u for u, in db.execute(select(Document.source_url).where(Document.source_id == src.id))}
    for f in found:
        f["already_ingested"] = f["url"] in known
    src.status, src.last_checked_at = "discovered", utcnow()
    src.last_result = {"candidates": found, "error": None}
    audit.record(db, p, "ingestion.discovery", entity_type="ingestion_source", entity_id=src.id,
                 company_id=src.company_id, detail={"url": src.url, "candidates": len(found)})
    return {"source_id": str(src.id), "candidates": found}


@router.post("/sources/{source_id}/ingest", status_code=202)
def ingest_from_source(source_id: uuid.UUID, body: IngestUrlsIn, p: Principal = Depends(require("ingestion.manage")),
                       db: Session = Depends(get_db)):
    """Queue retrieval of documents from a source: the registered URL itself
    (public_url) or URLs chosen from a discovery result (web_discovery)."""
    src = db.get(IngestionSource, source_id)
    if not src:
        raise HTTPException(404, "Source not found")
    try:
        connectors.require_operational(src.connector)
        fy = parse_fy(body.fiscal_year)
    except (connectors.ConnectorError, ValueError) as e:
        raise HTTPException(409, str(e))
    allowed = {src.url} | {c["url"] for c in src.last_result.get("candidates", [])}
    bad = [u for u in body.urls if u not in allowed]
    if bad:
        raise HTTPException(422, {"message": "URLs must be the registered URL or come from this source's discovery result",
                                  "rejected": bad})
    for u in body.urls:
        db.add(Job(kind="fetch_source", company_id=src.company_id,
                   payload={"source_id": str(src.id), "url": u, "category": body.category, "fiscal_year": fy}))
    src.status = "retrieval_queued"
    audit.record(db, p, "ingestion.fetch_queued", entity_type="ingestion_source", entity_id=src.id,
                 company_id=src.company_id, detail={"urls": body.urls})
    return {"queued": len(body.urls)}


# ── Extracted data with provenance ───────────────────────────────────────────

@router.get("/companies/{company_id}/data-points")
def data_points(company_id: uuid.UUID, metric: Optional[str] = None, year: Optional[str] = None,
                category: Optional[str] = None, status: Optional[str] = None, channel: Optional[str] = None,
                limit: int = Query(200, ge=1, le=1000), p: Principal = Depends(require("company.read")),
                db: Session = Depends(get_db)):
    """Every data point with its source document, page, quote, period, method, status and confidence."""
    c = _company(db, company_id)
    lvl = views.require_level(db, p, c, "intelligence")
    rows = views.usable_points(db, c.id, include_company=lvl == "private", include_unusable=p.is_internal)
    out = []
    for d, doc in rows:
        if metric and d.metric_key != metric or category and d.category != category \
                or status and d.verification_status != status or channel and d.channel != channel:
            continue
        if year and d.fiscal_year != parse_fy(year):
            continue
        out.append(views.data_point_out(d, doc))
    return {"total": len(out), "items": out[:limit]}


@router.get("/data-points/{data_point_id}")
def data_point(data_point_id: uuid.UUID, p: Principal = Depends(require("company.read")), db: Session = Depends(get_db)):
    d = db.get(DataPoint, data_point_id)
    if not d:
        raise HTTPException(404, "Data point not found")
    c = _company(db, d.company_id)
    views.require_level(db, p, c, "private" if d.channel == "company" else "intelligence")
    doc = db.get(Document, d.document_id) if d.document_id else None
    if doc and not views.document_visible(p, doc):
        raise HTTPException(404, "Data point not found")
    return {**views.data_point_out(d, doc), "company": views.company_brief(c)}


# ── Scores ───────────────────────────────────────────────────────────────────

def _score(db: Session, p: Principal, score_id: uuid.UUID) -> tuple[Score, Company]:
    s = db.get(Score, score_id)
    if not s:
        raise HTTPException(404, "Score not found")
    c = _company(db, s.company_id)
    lvl = views.require_level(db, p, c, "intelligence")
    if s.score_type == "company" and lvl != "private" and not c.share_company_score:
        raise HTTPException(403, "The Company Assessment Score is private to the company")
    return s, c


@router.get("/scores/{score_id}")
def get_score(score_id: uuid.UUID, p: Principal = Depends(require("company.read")), db: Session = Depends(get_db)):
    s, c = _score(db, p, score_id)
    m = db.get(MethodologyVersion, s.methodology_version_id)
    out = views.score_out(s, m.version)
    out["company"] = views.company_brief(c)
    if p.is_internal:
        out["inputs"] = s.inputs
    return out


@router.get("/scores/{score_id}/reproduce")
def reproduce_score(score_id: uuid.UUID, p: Principal = Depends(require("company.read")), db: Session = Depends(get_db)):
    """Recompute this score from its stored methodology version and evidence snapshot."""
    from .. import scoring
    s, _ = _score(db, p, score_id)
    m = db.get(MethodologyVersion, s.methodology_version_id)
    return {**scoring.reproduce(m.config, s.inputs, s.result_hash), "methodology_version": m.version,
            "engine_version_stored": s.engine_version, "engine_version_running": scoring.ENGINE_VERSION}


@router.post("/companies/{company_id}/assess", status_code=202)
def assess_now(company_id: uuid.UUID, p: Principal = Depends(require("score.compute")), db: Session = Depends(get_db)):
    """Run the public-data assessment now (it also runs automatically after ingestion)."""
    c = _company(db, company_id)
    s = assessment.run_public_assessment(db, p, c.id, f"requested by {p.email}", force=True)
    if not s:
        raise HTTPException(409, "No public evidence is available to assess for this company")
    m = db.get(MethodologyVersion, s.methodology_version_id)
    return views.score_out(s, m.version)


# ── Net Zero intelligence ────────────────────────────────────────────────────

@router.get("/companies/{company_id}/net-zero")
def net_zero(company_id: uuid.UUID, p: Principal = Depends(require("company.read")), db: Session = Depends(get_db)):
    c = _company(db, company_id)
    lvl = views.require_level(db, p, c, "intelligence")
    if lvl != "private":
        security.require_entitlement(db, p, "net_zero_intelligence")
    return reports.net_zero_view(db, c, include_company=lvl == "private")


# ── Intelligence report ──────────────────────────────────────────────────────

@router.post("/companies/{company_id}/report", status_code=201)
def generate_report(company_id: uuid.UUID, include_company_assessment: bool = False,
                    p: Principal = Depends(require("report.generate")), db: Session = Depends(get_db)):
    """Generate the corporate sustainability intelligence report (PDF) from the data currently stored."""
    c = _company(db, company_id)
    lvl = views.require_level(db, p, c, "intelligence")
    security.require_entitlement(db, p, "report_download")
    private = include_company_assessment and (lvl == "private" or c.share_company_score)
    if include_company_assessment and not private:
        raise HTTPException(403, "The company assessment is private to the company")
    rec = reports.generate(db, p, c, include_private=private)
    return {"id": str(rec.id), "size_bytes": rec.size_bytes, "sha256": rec.sha256, "created_at": rec.created_at,
            "includes_company_assessment": rec.includes_private}


@router.get("/reports/{report_id}/download")
def download_report(report_id: uuid.UUID, p: Principal = Depends(require("report.generate")),
                    db: Session = Depends(get_db)):
    rec = db.get(GeneratedReport, report_id)
    if not rec or not (p.is_internal or rec.organisation_id == p.org_id):
        raise HTTPException(404, "Report not found")
    c = db.get(Company, rec.company_id)
    data = storage.get_store().get(rec.storage_key)
    audit.record(db, p, "report.download", entity_type="report", entity_id=rec.id, company_id=rec.company_id)
    return Response(data, media_type="application/pdf", headers={
        "Content-Disposition": f'attachment; filename="{c.cx_id}_sustainability_intelligence_report.pdf"',
        "Cache-Control": "private, no-store"})


@router.get("/companies/{company_id}/reports")
def list_reports(company_id: uuid.UUID, p: Principal = Depends(require("report.generate")),
                 db: Session = Depends(get_db)):
    stmt = select(GeneratedReport).where(GeneratedReport.company_id == company_id)
    if not p.is_internal:
        stmt = stmt.where(GeneratedReport.organisation_id == p.org_id)
    return [{"id": str(r.id), "created_at": r.created_at, "size_bytes": r.size_bytes,
             "includes_company_assessment": r.includes_private}
            for r in db.execute(stmt.order_by(GeneratedReport.created_at.desc()).limit(50)).scalars()]


@router.get("/companies/{company_id}/targets")
def targets(company_id: uuid.UUID, p: Principal = Depends(require("company.read")), db: Session = Depends(get_db)):
    c = _company(db, company_id)
    lvl = views.require_level(db, p, c, "intelligence")
    stmt = select(ClimateTarget, Document).outerjoin(Document, Document.id == ClimateTarget.document_id).where(
        ClimateTarget.company_id == c.id)
    if lvl != "private":
        stmt = stmt.where(ClimateTarget.channel == "public", Document.visibility == "public")
    return [views.target_out(t, d) for t, d in db.execute(stmt.order_by(ClimateTarget.target_year)).all()]
