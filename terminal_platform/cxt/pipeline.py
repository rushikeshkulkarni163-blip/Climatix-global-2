"""
Document pipeline.

    SOURCE DISCOVERY → INGESTION → EXTRACTION → CLASSIFICATION → VALIDATION
                     → COMPANY MAPPING → REPOSITORY

`ingest_bytes` covers ingestion (validation of the file itself, hashing,
duplicate detection, storage, queueing). `process_document` runs the
remaining stages inside a worker job and finishes by queueing the company's
public assessment, so a new report always leads to extraction and scoring —
never to a bare document entry.
"""

from __future__ import annotations

import io
import uuid
import zipfile
from typing import Any, Optional

from fastapi import HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from . import audit, companies
from .config import get_settings
from .extraction import catalogue as X
from .extraction.domain import CommitmentClass
from .models import (ClimateTarget, Company, DataPoint, Document, DocumentPage, Job, ProcessingLog, ReviewItem,
                     utcnow)
from .storage import document_key, get_store
from .util import current_fiscal_year, sha256_hex

# Detected document types (extraction.classify) → repository categories.
CATEGORY_MAP = {
    "BRSR": "BRSR", "BRSR_CORE": "BRSR", "ANNUAL_REPORT": "ANNUAL_REPORT", "REGULATORY_FILING": "ANNUAL_REPORT",
    "SUSTAINABILITY_REPORT": "SUSTAINABILITY_REPORT", "INTEGRATED_REPORT": "INTEGRATED_REPORT",
    "CLIMATE_REPORT": "CLIMATE_REPORT", "TCFD_REPORT": "CLIMATE_REPORT", "ISSB_DISCLOSURE": "CLIMATE_REPORT",
    "CDP_DISCLOSURE": "CLIMATE_REPORT", "NET_ZERO_PLAN": "NET_ZERO_REPORT", "GHG_INVENTORY": "ENVIRONMENTAL_DATA",
    "WATER_REPORT": "ENVIRONMENTAL_DATA", "ASSURANCE_STATEMENT": "ASSURANCE_STATEMENT", "POLICY": "POLICY",
    "HUMAN_RIGHTS_REPORT": "POLICY", "INVESTOR_PRESENTATION": "FINANCIAL_DISCLOSURE", "OTHER": "OTHER",
}
CATEGORY_LABELS = {
    "ANNUAL_REPORT": "Annual Report", "BRSR": "BRSR Report", "SUSTAINABILITY_REPORT": "Sustainability Report",
    "ESG_REPORT": "ESG Report", "CLIMATE_REPORT": "Climate Disclosure", "NET_ZERO_REPORT": "Net Zero Disclosure",
    "INTEGRATED_REPORT": "Integrated Report", "ENVIRONMENTAL_DATA": "Environmental Performance Data",
    "FINANCIAL_DISCLOSURE": "Financial Disclosure", "ASSURANCE_STATEMENT": "Assurance Statement",
    "POLICY": "Policy", "SUPPORTING_EVIDENCE": "Supporting Evidence", "OTHER": "Other",
}
CONTRADICTION_TOLERANCE = 0.02      # relative difference between values for the same metric and year
_ACTIVE_CONTENT = (b"/JavaScript", b"/JS ", b"/Launch", b"/EmbeddedFile", b"/OpenAction")
_MACRO_EXT = (".xlsm", ".docm", ".pptm", ".xlsb")
_MAX_UNZIPPED = 600 * 1024 * 1024
_MAX_ZIP_RATIO = 200


def log(db: Session, doc: Optional[Document], stage: str, message: str, level: str = "info",
        job_id: Optional[uuid.UUID] = None, **detail) -> None:
    db.add(ProcessingLog(document_id=doc.id if doc else None, job_id=job_id, stage=stage, level=level,
                         message=message, detail=detail))


# ── File validation ──────────────────────────────────────────────────────────

def validate_file(content: bytes, filename: str, content_type: str = "") -> str:
    """Returns the detected format or raises HTTP 4xx. The format is decided
    by content (magic bytes), not by the client-supplied name or MIME type."""
    s = get_settings()
    if not content:
        raise HTTPException(422, "The file is empty")
    if len(content) > s.max_upload_mb * 1024 * 1024:
        raise HTTPException(413, f"File exceeds the {s.max_upload_mb} MB limit")
    name = (filename or "").strip()
    if not name or len(name) > 300 or "/" in name or "\\" in name or "\x00" in name:
        raise HTTPException(422, "Invalid file name")
    if name.lower().endswith(_MACRO_EXT):
        raise HTTPException(415, "Macro-enabled Office files are not accepted")
    try:
        fmt = X.detect_format(name, content, content_type)
    except X.UnsupportedFormat as e:
        raise HTTPException(415, str(e))
    if fmt in ("pptx", "html", "txt"):
        raise HTTPException(415, "Supported formats: PDF, DOCX, XLSX, CSV and images (PNG, JPEG, TIFF)")
    if fmt == "pdf" and any(marker in content for marker in _ACTIVE_CONTENT):
        raise HTTPException(415, "PDF contains active content (scripts, launch actions or embedded files) "
                                 "and was rejected")
    if fmt in ("docx", "xlsx"):
        try:
            with zipfile.ZipFile(io.BytesIO(content)) as z:
                infos = z.infolist()
                total = sum(i.file_size for i in infos)
                if total > _MAX_UNZIPPED or (len(content) and total / len(content) > _MAX_ZIP_RATIO):
                    raise HTTPException(415, "Archive expands beyond the permitted size and was rejected")
                if any(i.filename.lower().endswith("vbaproject.bin") for i in infos):
                    raise HTTPException(415, "Office file contains macros and was rejected")
        except zipfile.BadZipFile:
            raise HTTPException(415, "File is not a valid Office document")
    return fmt


# ── Ingestion ────────────────────────────────────────────────────────────────

def ingest_bytes(db: Session, actor: Any, content: bytes, filename: str, content_type: str = "", *,
                 company_id: Optional[uuid.UUID] = None, category: Optional[str] = None,
                 fiscal_year: Optional[int] = None, source_type: str = "upload", source_url: Optional[str] = None,
                 source_id: Optional[uuid.UUID] = None, visibility: str = "public",
                 owner_org_id: Optional[uuid.UUID] = None, title: Optional[str] = None) -> tuple[Document, bool]:
    """Store a document and queue it for processing. Returns (document, is_duplicate)."""
    fmt = validate_file(content, filename, content_type)
    if category and category not in CATEGORY_LABELS:
        raise HTTPException(422, f"Unknown document category '{category}'")
    if fiscal_year is not None and not (2000 <= fiscal_year <= current_fiscal_year() + 1):
        raise HTTPException(422, "Financial year is out of range")
    digest = sha256_hex(content)

    # Duplicate detection: identical bytes already held for this company (or not yet mapped).
    dupes = db.execute(select(Document).where(Document.sha256 == digest)).scalars().all()
    for d in dupes:
        same_scope = d.visibility == visibility and (d.owner_org_id == owner_org_id or visibility == "public")
        same_company = company_id is None or d.company_id in (None, company_id) or d.declared_company_id == company_id
        if same_scope and same_company:
            log(db, d, "ingestion", "Duplicate upload detected; existing document returned",
                filename=filename, source_type=source_type)
            audit.record(db, actor, "document.duplicate", entity_type="document", entity_id=d.id,
                         company_id=d.company_id or d.declared_company_id, detail={"filename": filename, "sha256": digest})
            return d, True

    key = document_key(digest, fmt)
    store = get_store()
    if not store.exists(key):
        store.put(key, content)
    doc = Document(company_id=None, declared_company_id=company_id, title=(title or filename)[:400],
                   original_filename=filename[:400], declared_category=category, declared_fiscal_year=fiscal_year,
                   sha256=digest, size_bytes=len(content), mime_type=(content_type or None), file_format=fmt,
                   storage_key=key, source_type=source_type, source_url=source_url, source_id=source_id,
                   retrieved_at=utcnow() if source_type in ("public_url", "connector") else None,
                   uploaded_by=getattr(actor, "user_id", None), owner_org_id=owner_org_id, visibility=visibility,
                   status="pending", stage="ingestion")
    db.add(doc)
    db.flush()
    log(db, doc, "ingestion", f"Received {filename} ({len(content):,} bytes, {fmt})", sha256=digest,
        source_type=source_type, source_url=source_url)
    db.add(Job(kind="process_document", document_id=doc.id, company_id=company_id, payload={}))
    audit.record(db, actor, "document.ingest", entity_type="document", entity_id=doc.id, company_id=company_id,
                 detail={"filename": filename, "sha256": digest, "size": len(content), "format": fmt,
                         "source_type": source_type, "source_url": source_url, "visibility": visibility})
    return doc, False


# ── Processing ───────────────────────────────────────────────────────────────

class NeedsReview(Exception):
    """Processing cannot complete automatically; the document goes to the review queue."""
    def __init__(self, kind: str, summary: str, **detail):
        super().__init__(summary)
        self.kind, self.summary, self.detail = kind, summary, detail


def _set_stage(db: Session, doc: Document, stage: str) -> None:
    doc.stage = stage
    db.flush()


def process_document(db: Session, doc_id: uuid.UUID, job_id: Optional[uuid.UUID] = None) -> Document:
    doc = db.execute(select(Document).where(Document.id == doc_id).with_for_update(of=Document)).scalar_one()
    doc.status, doc.error = "processing", None
    try:
        _run_stages(db, doc, job_id)
    except NeedsReview as r:
        doc.status = "requires_review"
        log(db, doc, doc.stage, r.summary, level="warning", job_id=job_id, **r.detail)
        open_item = db.execute(select(ReviewItem).where(ReviewItem.document_id == doc.id, ReviewItem.kind == r.kind,
                                                        ReviewItem.status == "open")).scalar_one_or_none()
        if not open_item:
            db.add(ReviewItem(kind=r.kind, document_id=doc.id, company_id=doc.company_id or doc.declared_company_id,
                              summary=r.summary, detail=r.detail))
    doc.processed_at = utcnow()
    db.flush()
    return doc


def _run_stages(db: Session, doc: Document, job_id: Optional[uuid.UUID]) -> None:
    s = get_settings()

    # INGESTION — integrity of the stored object
    _set_stage(db, doc, "ingestion")
    content = get_store().get(doc.storage_key)
    if sha256_hex(content) != doc.sha256:
        raise RuntimeError("Stored object does not match the recorded SHA-256")

    # EXTRACTION — text, tables, OCR
    _set_stage(db, doc, "extraction")
    parsed = X.parse(content, doc.file_format)
    doc.page_count = len(parsed.pages)
    doc.ocr_pages = sum(1 for p in parsed.pages if p.is_ocr and p.text.strip())
    db.execute(delete(DocumentPage).where(DocumentPage.document_id == doc.id))
    for p in parsed.pages:
        db.add(DocumentPage(document_id=doc.id, page_no=p.page_no, label=p.label, text=p.text.replace("\x00", ""),
                            tables=[{"index": t.index, "header": t.header, "rows": t.rows} for t in p.tables],
                            is_ocr=p.is_ocr))
    text_pages = sum(1 for p in parsed.pages if p.text.strip())
    log(db, doc, "extraction", f"Parsed {len(parsed.pages)} page(s); {text_pages} with text, "
        f"{doc.ocr_pages} read by OCR, {sum(len(p.tables) for p in parsed.pages)} table(s)", job_id=job_id,
        warnings=parsed.warnings[:20])
    if text_pages == 0:
        if not X.ocr_available():
            raise NeedsReview("ocr_unavailable",
                              "Document has no text layer and OCR is not available on this server. "
                              "Install Tesseract and re-process, or enter the data manually.",
                              pages=len(parsed.pages))
        raise RuntimeError("No text could be extracted from the document")
    image_only = [w for w in parsed.warnings if "OCR unavailable" in w]

    # CLASSIFICATION — document type and reporting period
    _set_stage(db, doc, "classification")
    ex = X.run_extraction(parsed, doc.original_filename, doc.declared_fiscal_year)
    detected = CATEGORY_MAP.get(ex.detected_type, "OTHER")
    scores = ex.type_basis.get("scores", {})
    ranked = sorted(scores.values(), reverse=True)
    margin = (ranked[0] - ranked[1]) / ranked[0] if len(ranked) > 1 and ranked[0] else (1.0 if ranked else 0.0)
    cls_conf = round(40 + 55 * margin, 1) if ranked else 0.0
    doc.category = doc.declared_category or detected
    doc.fiscal_year = ex.reporting_year
    doc.classification = {"detected_type": ex.detected_type, "detected_category": detected,
                          "declared_category": doc.declared_category, "confidence": cls_conf,
                          "basis": ex.type_basis.get("basis", [])[:12], "scores": scores,
                          "fiscal_year_basis": ex.year_basis}
    log(db, doc, "classification", f"Classified as {CATEGORY_LABELS[doc.category]} "
        f"(detected {ex.detected_type}, confidence {cls_conf}); reporting period {ex.reporting_year or 'unknown'} "
        f"({ex.year_basis})", job_id=job_id)

    # VALIDATION
    _set_stage(db, doc, "validation")
    problems = []
    if doc.declared_category and detected not in ("OTHER", doc.declared_category) and cls_conf >= 70:
        problems.append(f"declared as {CATEGORY_LABELS[doc.declared_category]} but content reads as "
                        f"{CATEGORY_LABELS[detected]}")
    if not doc.fiscal_year:
        problems.append("reporting period could not be determined")
    elif doc.fiscal_year > current_fiscal_year() + 1:
        problems.append(f"reporting period {doc.fiscal_year} is in the future")
    if not doc.declared_category and (detected == "OTHER" or cls_conf < 50):
        problems.append("document type is uncertain")
    if image_only:
        problems.append(f"{len(image_only)} image-only page(s) could not be read (OCR unavailable)")
    if problems:
        log(db, doc, "validation", "; ".join(problems), level="warning", job_id=job_id)
        db.add(ReviewItem(kind="classification", document_id=doc.id,
                          company_id=doc.declared_company_id, summary=f"{doc.title}: " + "; ".join(problems),
                          detail={"problems": problems, "classification": doc.classification}))
    else:
        log(db, doc, "validation", "Document passed validation checks", job_id=job_id)

    # COMPANY MAPPING
    _set_stage(db, doc, "company_mapping")
    probe = " ".join([doc.title, doc.original_filename.rsplit(".", 1)[0], parsed.title or ""]
                     + [p.text[:3000] for p in parsed.pages[:3]])
    candidates = companies.identify_company(db, probe)
    declared = companies.resolve(db, doc.declared_company_id) if doc.declared_company_id else None
    if declared:
        named = next((c for c in candidates if c["company_id"] == str(declared.id)), None)
        other = next((c for c in candidates if c["company_id"] != str(declared.id) and c["confidence"] >= 75), None)
        if not named and other:
            raise NeedsReview("company_mapping",
                              f"Document was submitted for {declared.legal_name} but names {other['legal_name']}",
                              declared=str(declared.id), candidates=candidates)
        doc.company_id = declared.id
        basis = "declared at ingestion" + ("; company name found in document" if named
                                           else "; company name NOT found in document text")
        log(db, doc, "company_mapping", f"Mapped to {declared.legal_name} ({declared.cx_id}) — {basis}",
            level="info" if named else "warning", job_id=job_id)
    else:
        if not candidates:
            raise NeedsReview("company_mapping", "No known company could be identified in this document",
                              candidates=[])
        top = candidates[0]
        if top.get("ambiguous") or top["confidence"] < 70:
            raise NeedsReview("company_mapping", "Company identification is ambiguous", candidates=candidates)
        doc.company_id = uuid.UUID(top["company_id"])
        log(db, doc, "company_mapping", f"Mapped to {top['legal_name']} ({top['cx_id']}) from document text "
            f"(confidence {top['confidence']})", job_id=job_id)
    doc.classification = {**doc.classification, "company_candidates": candidates[:5]}

    # REPOSITORY — versioning, structured data, hand-off to assessment
    _set_stage(db, doc, "repository")
    _assign_version(db, doc)
    channel = "company" if doc.source_type == "company_submission" else "public"
    counts = persist_extraction(db, doc, ex, channel, s.review_confidence_threshold)
    conf = [k.evidence.confidence for k in ex.kpis] + [t.evidence.confidence for t in ex.targets]
    doc.extraction_confidence = round(sum(conf) / len(conf), 1) if conf else None
    doc.extraction_summary = {**counts, "stages": ex.stages, "pages": doc.page_count, "ocr_pages": doc.ocr_pages}
    doc.status = "completed"
    log(db, doc, "repository", f"Stored {counts['data_points']} data point(s), {counts['targets']} target(s), "
        f"{counts['signals']} qualitative signal(s); {counts['needs_review']} sent to review, "
        f"{counts['contradictions']} contradiction(s)", job_id=job_id)
    if channel == "public" and doc.visibility == "public":
        enqueue_assessment(db, doc.company_id, f"document {doc.id} processed")


def _assign_version(db: Session, doc: Document) -> None:
    """A later document for the same company, category and period supersedes the earlier one."""
    if not doc.fiscal_year:
        return
    prev = db.execute(select(Document).where(
        Document.company_id == doc.company_id, Document.category == doc.category,
        Document.fiscal_year == doc.fiscal_year, Document.id != doc.id, Document.status == "completed",
        Document.visibility == doc.visibility, Document.owner_org_id.is_not_distinct_from(doc.owner_org_id))
        .order_by(Document.version_no.desc()).limit(1)).scalar_one_or_none()
    if prev:
        doc.version_no, doc.supersedes_id = prev.version_no + 1, prev.id


def enqueue_assessment(db: Session, company_id: uuid.UUID, trigger: str) -> None:
    pending = db.execute(select(func.count()).select_from(Job).where(
        Job.kind == "assess_company", Job.company_id == company_id, Job.status == "pending")).scalar()
    if not pending:
        db.add(Job(kind="assess_company", company_id=company_id, payload={"trigger": trigger}))


# ── Persisting extraction with provenance ────────────────────────────────────

def persist_extraction(db: Session, doc: Document, ex: X.Extraction, channel: str, threshold: float) -> dict:
    """Write data points, targets and signals for a document. Rows a reviewer
    has already decided (verified / rejected) are kept across re-processing."""
    decided = ("verified", "rejected")
    kept = {(d.metric_key, d.fiscal_year, round(d.value or 0, 4)) for d in db.execute(
        select(DataPoint).where(DataPoint.document_id == doc.id, DataPoint.verification_status.in_(decided))).scalars()}
    stale = db.execute(select(DataPoint.id).where(DataPoint.document_id == doc.id,
                                                  DataPoint.verification_status.not_in(decided))).scalars().all()
    if stale:
        db.execute(delete(ReviewItem).where(ReviewItem.data_point_id.in_(stale)))
        db.execute(delete(DataPoint).where(DataPoint.id.in_(stale)))
    db.execute(delete(ClimateTarget).where(ClimateTarget.document_id == doc.id,
                                           ClimateTarget.verification_status.not_in(decided)))
    counts = {"data_points": 0, "targets": 0, "signals": 0, "needs_review": 0, "contradictions": 0}
    method = "ocr" if doc.file_format == "image" else None

    def location(ev) -> str:
        parts = [f"Page {ev.page_no}" if doc.file_format == "pdf" else f"Part {ev.page_no}"]
        if ev.table_ref:
            parts.append(ev.table_ref)
        if ev.section:
            parts.append(ev.section[:120])
        return " · ".join(parts)

    touched: set[tuple[str, Optional[int]]] = set()
    for k in ex.kpis:
        if (k.metric_key, k.reporting_year, round(k.value, 4)) in kept:
            continue
        ev = k.evidence
        low = ev.confidence < threshold
        dp = DataPoint(company_id=doc.company_id, document_id=doc.id, channel=channel, metric_key=k.metric_key,
                       category=X.CATALOGUE.get(k.metric_key, {}).get("category", "environmental"), kind="numeric",
                       fiscal_year=k.reporting_year, value=k.value, unit=k.unit,
                       normalized_value=k.normalized_value, normalized_unit=k.normalized_unit, boundary=k.scope,
                       quote=ev.quote, page_no=ev.page_no, source_location=location(ev),
                       extraction_method=method or ev.method, confidence=ev.confidence,
                       confidence_factors=ev.attributes.get("confidence_factors", []),
                       verification_status="needs_review" if low else "extracted",
                       attributes={a: v for a, v in ev.attributes.items() if a != "confidence_factors"})
        db.add(dp)
        db.flush()
        counts["data_points"] += 1
        touched.add((k.metric_key, k.reporting_year))
        if low:
            counts["needs_review"] += 1
            db.add(ReviewItem(kind="low_confidence", company_id=doc.company_id, document_id=doc.id,
                              data_point_id=dp.id,
                              summary=f"{X.metric_name(k.metric_key)} {k.value:,.6g} {k.unit} "
                                      f"(confidence {ev.confidence:.0f})",
                              detail={"confidence_factors": dp.confidence_factors}))

    for t in ex.targets:
        ev = t.evidence
        validation = {CommitmentClass.VALIDATED: "validated_third_party"}.get(t.commitment_class)
        if not validation:
            validation = "validation_pending" if ev.attributes.get("validation_pending") else "declared"
        horizon = None
        if t.target_year:
            horizon = "near_term" if t.target_year <= (doc.fiscal_year or current_fiscal_year()) + 10 else "long_term"
        db.add(ClimateTarget(company_id=doc.company_id, document_id=doc.id, channel=channel,
                             target_kind=t.target_kind, horizon=horizon, description=t.description[:2000],
                             scope_coverage=t.scope_coverage, commitment_class=t.commitment_class.value,
                             validation_status=validation, reduction_pct=t.reduction_pct,
                             baseline_year=t.baseline_year, target_year=t.target_year, target_type=t.target_type,
                             progress_status=t.progress_status.value, reported_progress_pct=t.current_progress_pct,
                             fiscal_year=doc.fiscal_year, quote=ev.quote, page_no=ev.page_no,
                             confidence=ev.confidence,
                             verification_status="needs_review" if ev.confidence < threshold else "extracted"))
        counts["targets"] += 1

    # Qualitative signals: one row per signal per document, carrying the clearest passage.
    best: dict[str, Any] = {}
    n_by_key: dict[str, int] = {}
    for e in ex.evidence:
        if e.evidence_type in ("visual", "commitment"):
            continue
        key = X.signal_key(e)
        n_by_key[key] = n_by_key.get(key, 0) + 1
        if key not in best or e.confidence > best[key].confidence:
            best[key] = e
    have = {d.metric_key for d in db.execute(select(DataPoint).where(
        DataPoint.document_id == doc.id, DataPoint.kind == "signal")).scalars()}
    for key, e in best.items():
        if key in have:
            continue
        negative = e.evidence_type == "negative"
        attrs = {a: v for a, v in e.attributes.items() if a != "confidence_factors"}
        attrs["mentions"] = n_by_key[key]
        db.add(DataPoint(company_id=doc.company_id, document_id=doc.id, channel=channel, metric_key=key,
                         category=X.SIGNAL_CATEGORY.get(e.evidence_type, "governance"), kind="signal",
                         fiscal_year=doc.fiscal_year, value_text="explicit_no" if negative else "stated",
                         quote=e.quote, page_no=e.page_no, source_location=location(e),
                         extraction_method=method or e.method, confidence=e.confidence,
                         confidence_factors=e.attributes.get("confidence_factors", []),
                         verification_status="needs_review" if e.confidence < threshold else "extracted",
                         attributes=attrs))
        counts["signals"] += 1
    db.flush()
    counts["contradictions"] = detect_contradictions(db, doc.company_id, channel, touched)
    return counts


def detect_contradictions(db: Session, company_id: uuid.UUID, channel: str,
                          keys: Optional[set[tuple[str, Optional[int]]]] = None) -> int:
    """Flag metric-years for which usable sources state materially different
    values. Such a metric-year is withheld from scoring until a reviewer
    verifies one value."""
    superseded = select(Document.supersedes_id).where(Document.supersedes_id.is_not(None))
    rows = db.execute(select(DataPoint).where(
        DataPoint.company_id == company_id, DataPoint.channel == channel, DataPoint.kind == "numeric",
        DataPoint.verification_status.in_(("extracted", "needs_review", "verified")),
        DataPoint.superseded_by_id.is_(None), DataPoint.normalized_value.is_not(None),
        DataPoint.document_id.not_in(superseded))).scalars().all()
    groups: dict[tuple[str, Optional[int]], list[DataPoint]] = {}
    for d in rows:
        if keys is None or (d.metric_key, d.fiscal_year) in keys:
            groups.setdefault((d.metric_key, d.fiscal_year), []).append(d)
    n = 0
    for (metric, fy), pts in groups.items():
        if any(p.verification_status == "verified" for p in pts):
            continue                                   # a reviewer has already settled this value
        units = {p.normalized_unit for p in pts}
        vals = sorted({round(p.normalized_value, 6) for p in pts})
        conflict = len(units) > 1 or (len(vals) > 1 and (vals[-1] - vals[0]) > CONTRADICTION_TOLERANCE * max(abs(vals[-1]), 1e-9))
        if not conflict:
            continue
        existing = db.execute(select(ReviewItem).where(
            ReviewItem.company_id == company_id, ReviewItem.kind == "contradiction", ReviewItem.status == "open",
            ReviewItem.detail["metric_key"].astext == metric,
            ReviewItem.detail["channel"].astext == channel)).scalars().all()
        if any(r.detail.get("fiscal_year") == fy for r in existing):
            continue
        db.add(ReviewItem(kind="contradiction", company_id=company_id, data_point_id=pts[0].id,
                          document_id=pts[0].document_id,
                          summary=f"{X.metric_name(metric)} for {fy or 'unknown period'}: "
                                  f"{len(vals)} different values across sources",
                          detail={"metric_key": metric, "fiscal_year": fy, "channel": channel,
                                  "values": [{"data_point_id": str(p.id), "document_id": str(p.document_id),
                                              "value": p.value, "unit": p.unit, "normalized": p.normalized_value,
                                              "normalized_unit": p.normalized_unit, "page_no": p.page_no}
                                             for p in pts]}))
        n += 1
    db.flush()
    return n
