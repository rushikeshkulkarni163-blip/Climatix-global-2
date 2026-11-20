"""
Company records: creation with a unique corporate ID, duplicate detection,
identification of the company a document belongs to, and audited merging.
"""

from __future__ import annotations

import re
import uuid
from typing import Any, Optional

from fastapi import HTTPException
from sqlalchemy import func, or_, select, text, update
from sqlalchemy.orm import Session

from . import audit
from .models import (Assessment, ClimateTarget, Company, CompanyAlias, CompanyMerge, CorrectionRequest, DataPoint,
                     Document, GeneratedReport, IngestionSource, Organisation, PortfolioCompany, ReviewItem, Score,
                     Sector)
from .util import normalise_name

DUPLICATE_SIMILARITY = 0.55     # pg_trgm similarity above which a name is a suspected duplicate
_CIN = re.compile(r"^[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$")


def validate_registration(reg_type: Optional[str], reg_id: Optional[str]) -> tuple[Optional[str], Optional[str]]:
    if not reg_id:
        return None, None
    reg_id = reg_id.strip().upper()
    reg_type = (reg_type or ("CIN" if _CIN.match(reg_id) else "OTHER")).upper()
    if reg_type == "CIN" and not _CIN.match(reg_id):
        raise HTTPException(422, "CIN must be 21 characters in the MCA format, e.g. L28920MH1945PLC004520")
    if reg_type == "LEI" and not re.fullmatch(r"[A-Z0-9]{20}", reg_id):
        raise HTTPException(422, "LEI must be 20 alphanumeric characters")
    return reg_type, reg_id


def next_cx_id(db: Session) -> str:
    return f"CX-{db.execute(text('SELECT nextval(' + repr('company_cx_seq') + ')')).scalar():06d}"


def find_duplicates(db: Session, name: str, registration_id: Optional[str] = None,
                    exclude_id: Optional[uuid.UUID] = None, limit: int = 8) -> list[dict]:
    """Suspected duplicates of a company name / registration id among active
    companies: exact registration match, exact normalised name or alias, or
    trigram similarity."""
    norm = normalise_name(name)
    out: dict[uuid.UUID, dict] = {}

    def add(c: Company, reason: str, sim: float):
        if c.id == exclude_id or c.status != "active":
            return
        if c.id not in out or sim > out[c.id]["similarity"]:
            out[c.id] = {"id": str(c.id), "cx_id": c.cx_id, "legal_name": c.legal_name, "common_name": c.common_name,
                         "registration_id": c.registration_id, "reason": reason, "similarity": round(sim, 2)}

    if registration_id:
        for c in db.execute(select(Company).where(Company.registration_id == registration_id.strip().upper())).scalars():
            add(c, "same registration identifier", 1.0)
    if norm:
        for c in db.execute(select(Company).where(Company.name_norm == norm)).scalars():
            add(c, "same name after normalisation", 1.0)
        for c in db.execute(select(Company).join(CompanyAlias, CompanyAlias.company_id == Company.id)
                            .where(CompanyAlias.alias_norm == norm)).scalars():
            add(c, "matches a known alias", 0.98)
        sim = func.similarity(Company.name_norm, norm)
        for c, s in db.execute(select(Company, sim).where(sim >= DUPLICATE_SIMILARITY, Company.status == "active")
                               .order_by(sim.desc()).limit(limit)).all():
            add(c, "similar name", float(s))
    return sorted(out.values(), key=lambda d: -d["similarity"])[:limit]


def create_company(db: Session, actor: Any, *, legal_name: str, country: str, common_name: Optional[str] = None,
                   registration_id: Optional[str] = None, registration_type: Optional[str] = None,
                   sector_code: Optional[str] = None, industry: Optional[str] = None, website: Optional[str] = None,
                   headquarters: Optional[str] = None, description: Optional[str] = None,
                   aliases: Optional[list[str]] = None, is_synthetic: bool = False, record_source: str = "manual",
                   allow_duplicate: bool = False) -> Company:
    legal_name = legal_name.strip()
    reg_type, reg_id = validate_registration(registration_type, registration_id)
    dupes = find_duplicates(db, legal_name, reg_id)
    exact = [d for d in dupes if d["similarity"] >= 0.98]
    if exact and not (allow_duplicate and all(d["reason"] != "same registration identifier" for d in exact)):
        raise HTTPException(409, {"message": "A company with this name or registration identifier already exists",
                                  "duplicates": exact})
    sector = None
    if sector_code:
        sector = db.execute(select(Sector).where(Sector.code == sector_code, Sector.active)).scalar_one_or_none()
        if not sector:
            raise HTTPException(422, f"Unknown sector '{sector_code}'")
    c = Company(cx_id=next_cx_id(db), legal_name=legal_name, common_name=(common_name or "").strip() or None,
                name_norm=normalise_name(legal_name), registration_id=reg_id, registration_type=reg_type,
                country=country.strip(), sector_id=sector.id if sector else None, industry=industry,
                website=website, headquarters=headquarters, description=description, is_synthetic=is_synthetic,
                record_source=record_source, created_by=getattr(actor, "user_id", None))
    db.add(c)
    db.flush()
    for a in {x.strip() for x in ([common_name] if common_name else []) + (aliases or []) if x and x.strip()}:
        n = normalise_name(a)
        if n and n != c.name_norm:
            db.add(CompanyAlias(company_id=c.id, alias=a, alias_norm=n))
    db.flush()
    audit.record(db, actor, "company.create", entity_type="company", entity_id=c.id, company_id=c.id,
                 detail={"cx_id": c.cx_id, "legal_name": c.legal_name, "registration_id": reg_id,
                         "record_source": record_source, "is_synthetic": is_synthetic,
                         "similar_existing": [d["cx_id"] for d in dupes]})
    if dupes:
        db.add(ReviewItem(kind="duplicate_company", company_id=c.id,
                          summary=f"{c.legal_name} ({c.cx_id}) resembles {len(dupes)} existing record(s)",
                          detail={"candidates": dupes}))
    return c


def search(db: Session, q: Optional[str], *, sector_code: Optional[str] = None, country: Optional[str] = None,
           limit: int = 25, offset: int = 0) -> tuple[list[Company], int]:
    stmt = select(Company).where(Company.status == "active")
    if sector_code:
        stmt = stmt.join(Sector, Sector.id == Company.sector_id).where(Sector.code == sector_code)
    if country:
        stmt = stmt.where(func.lower(Company.country) == country.lower())
    order = [Company.legal_name]
    if q and q.strip():
        qs = q.strip()
        norm = normalise_name(qs) or qs.lower()
        alias_match = select(CompanyAlias.company_id).where(CompanyAlias.alias_norm.ilike(f"%{norm}%"))
        sim = func.similarity(Company.name_norm, norm)
        stmt = stmt.where(or_(Company.name_norm.ilike(f"%{norm}%"), Company.cx_id.ilike(f"{qs}%"),
                              Company.registration_id.ilike(f"{qs}%"), Company.id.in_(alias_match), sim >= 0.3))
        order = [sim.desc(), Company.legal_name]
    total = db.execute(select(func.count()).select_from(stmt.subquery())).scalar() or 0
    rows = db.execute(stmt.order_by(*order).limit(limit).offset(offset)).scalars().all()
    return list(rows), total


def resolve(db: Session, company_id: uuid.UUID) -> Company:
    """Load a company, following merge redirects."""
    c = db.get(Company, company_id)
    hops = 0
    while c and c.status == "merged" and c.merged_into_id and hops < 5:
        c = db.get(Company, c.merged_into_id)
        hops += 1
    if not c:
        raise HTTPException(404, "Company not found")
    return c


# ── Document → company identification ────────────────────────────────────────

def identify_company(db: Session, probe_text: str) -> list[dict]:
    """Rank active companies by how prominently their names appear in the
    document's title area. Returns candidates with a 0-100 confidence."""
    probe = " " + normalise_name(probe_text) + " "
    if len(probe) < 6:
        return []
    names: dict[uuid.UUID, list[str]] = {}
    for cid, norm in db.execute(select(Company.id, Company.name_norm).where(Company.status == "active")):
        names.setdefault(cid, []).append(norm)
    for cid, norm in db.execute(select(CompanyAlias.company_id, CompanyAlias.alias_norm)
                                .join(Company, Company.id == CompanyAlias.company_id)
                                .where(Company.status == "active")):
        names.setdefault(cid, []).append(norm)
    scored = []
    for cid, variants in names.items():
        best = 0.0
        for v in variants:
            if len(v) < 3:
                continue
            n = probe.count(f" {v} ")
            if n:
                # longer names are more specific; repeated mentions corroborate
                best = max(best, min(100.0, 55 + 6 * min(len(v.split()), 4) + 6 * min(n, 4)))
        if best:
            scored.append((best, cid))
    scored.sort(key=lambda x: -x[0])
    out = []
    for conf, cid in scored[:5]:
        c = db.get(Company, cid)
        out.append({"company_id": str(cid), "cx_id": c.cx_id, "legal_name": c.legal_name, "confidence": conf})
    # Two different companies named with similar prominence: ambiguous.
    if len(out) > 1 and out[0]["confidence"] - out[1]["confidence"] < 8:
        out[0]["ambiguous"] = True
    return out


# ── Merge ────────────────────────────────────────────────────────────────────

def merge(db: Session, actor: Any, source_id: uuid.UUID, target_id: uuid.UUID, reason: str) -> CompanyMerge:
    """Fold `source` into `target`. Every dependent record moves to the target;
    the source row is kept (status 'merged') so historical references and the
    audit trail still resolve. Scores are recomputed by the caller."""
    if source_id == target_id:
        raise HTTPException(422, "A company cannot be merged into itself")
    src = db.execute(select(Company).where(Company.id == source_id).with_for_update(of=Company)).scalar_one_or_none()
    tgt = db.execute(select(Company).where(Company.id == target_id).with_for_update(of=Company)).scalar_one_or_none()
    if not src or not tgt:
        raise HTTPException(404, "Company not found")
    if src.status != "active" or tgt.status != "active":
        raise HTTPException(409, "Both companies must be active to merge")
    src_org = db.execute(select(Organisation).where(Organisation.company_id == src.id)).scalar_one_or_none()
    tgt_org = db.execute(select(Organisation).where(Organisation.company_id == tgt.id)).scalar_one_or_none()
    if src_org and tgt_org:
        raise HTTPException(409, "Both companies have registered organisation accounts; "
                                 "close one account before merging")

    snapshot = {k: (str(v) if v is not None else None) for k, v in {
        "id": src.id, "cx_id": src.cx_id, "legal_name": src.legal_name, "common_name": src.common_name,
        "registration_type": src.registration_type, "registration_id": src.registration_id, "country": src.country,
        "sector_id": src.sector_id, "industry": src.industry, "website": src.website,
        "headquarters": src.headquarters}.items()}
    moved: dict[str, int] = {}

    def move(model, col="company_id"):
        r = db.execute(update(model).where(getattr(model, col) == src.id).values({col: tgt.id}))
        moved[model.__tablename__] = moved.get(model.__tablename__, 0) + (r.rowcount or 0)

    # Assessment versions are unique per (company, channel): renumber the source's after the target's.
    for channel in ("public", "company"):
        top = db.execute(select(func.coalesce(func.max(Assessment.version_no), 0))
                         .where(Assessment.company_id == tgt.id, Assessment.channel == channel)).scalar()
        rows = db.execute(select(Assessment).where(Assessment.company_id == src.id, Assessment.channel == channel)
                          .order_by(Assessment.version_no)).scalars().all()
        for i, a in enumerate(rows, start=1):
            a.version_no = top + i
            a.company_id = tgt.id
        moved["assessments"] = moved.get("assessments", 0) + len(rows)
    # Only one current score per (company, type): the source's become history.
    db.execute(update(Score).where(Score.company_id == src.id).values(is_current=False))
    db.flush()
    for model in (Score, Document, DataPoint, ClimateTarget, IngestionSource, ReviewItem, CorrectionRequest,
                  GeneratedReport):
        move(model)
    db.execute(update(Document).where(Document.declared_company_id == src.id).values(declared_company_id=tgt.id))
    # Portfolio membership: skip rows that would duplicate an existing membership.
    existing = select(PortfolioCompany.portfolio_id).where(PortfolioCompany.company_id == tgt.id)
    db.execute(text("DELETE FROM portfolio_companies WHERE company_id = :s AND portfolio_id IN "
                    "(SELECT portfolio_id FROM portfolio_companies WHERE company_id = :t)"),
               {"s": src.id, "t": tgt.id})
    del existing
    move(PortfolioCompany)
    if src_org:
        src_org.company_id = tgt.id
        moved["organisations"] = 1

    # Names of the source become aliases of the target.
    have = {a for a, in db.execute(select(CompanyAlias.alias_norm).where(CompanyAlias.company_id == tgt.id))}
    have.add(tgt.name_norm)
    for alias in db.execute(select(CompanyAlias).where(CompanyAlias.company_id == src.id)).scalars().all():
        if alias.alias_norm in have:
            db.delete(alias)
        else:
            alias.company_id = tgt.id
            have.add(alias.alias_norm)
    for name in (src.legal_name, src.common_name):
        n = normalise_name(name or "")
        if n and n not in have:
            db.add(CompanyAlias(company_id=tgt.id, alias=name, alias_norm=n))
            have.add(n)
    # Fill gaps on the target from the source; never overwrite.
    for f in ("common_name", "sector_id", "industry", "website", "headquarters", "description"):
        if getattr(tgt, f) in (None, "") and getattr(src, f):
            setattr(tgt, f, getattr(src, f))
    src_reg = (src.registration_type, src.registration_id)
    src.status, src.merged_into_id, src.registration_id, src.registration_type = "merged", tgt.id, None, None
    db.flush()
    if not tgt.registration_id and src_reg[1]:
        tgt.registration_type, tgt.registration_id = src_reg

    rec = CompanyMerge(source_id=src.id, target_id=tgt.id, merged_by=actor.user_id, reason=reason, moved=moved,
                       source_snapshot=snapshot)
    db.add(rec)
    db.flush()
    audit.record(db, actor, "company.merge", entity_type="company", entity_id=tgt.id, company_id=tgt.id,
                 detail={"source": snapshot, "target_cx_id": tgt.cx_id, "reason": reason, "moved": moved})
    return rec
