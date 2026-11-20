"""
Institutional intelligence: screening, comparison, private portfolios and
sector aggregates for banks, insurers, investors and government users.

The same intelligence serves each institution type; what differs is the lens
(`/workspace` describes it) and the entitlements of the subscription. These
endpoints support due diligence. They return information about disclosures
and scores — never a credit, underwriting or investment decision.
"""

from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import assessment, audit, companies, reports, security, views
from ..db import get_db
from ..models import ClimateTarget, Company, DataPoint, Document, Portfolio, PortfolioCompany, Score, Sector
from ..security import Principal, current_principal, require
from ..util import fy_label

router = APIRouter(tags=["Institutional intelligence"])

MIN_AGGREGATE = 3      # smallest group for which a sector statistic is published

WORKSPACES = {
    "bank": {"title": "Bank Intelligence", "portfolio_label": "Borrower portfolio", "entity_label": "Borrower",
             "purpose": "Sustainability due diligence on borrowers and prospects. Supports credit teams; it does "
                        "not approve or reject credit.",
             "focus": ["public_score", "confidence", "net_zero", "environmental_indicators", "disclosure"]},
    "insurance": {"title": "Insurance Intelligence", "portfolio_label": "Insured portfolio", "entity_label": "Insured",
                  "purpose": "Corporate environmental profiles, incident history and climate disclosure for "
                             "underwriting research. It does not price or accept risk.",
                  "focus": ["environmental_indicators", "incidents", "climate_risk", "history", "benchmark"]},
    "investor": {"title": "Investor Intelligence", "portfolio_label": "Portfolio", "entity_label": "Holding",
                 "purpose": "Screening, comparison and monitoring of portfolio companies. It is not investment advice.",
                 "focus": ["screening", "comparison", "score_history", "net_zero", "disclosure"]},
    "government": {"title": "Government Intelligence", "portfolio_label": None, "entity_label": "Sector",
                   "purpose": "Aggregated sector-level sustainability indicators and disclosure coverage drawn from "
                              "public corporate disclosures. This is a Climactix analytical view, not an official "
                              "government portal or a government-approved database.",
                   "focus": ["sector_aggregates", "disclosure_coverage", "participation"]},
    "climactix": {"title": "Institutional Intelligence (internal view)", "portfolio_label": "Portfolio",
                  "entity_label": "Company", "purpose": "Internal view of the institutional workspaces.",
                  "focus": ["screening", "comparison", "sector_aggregates"]},
}


class PortfolioIn(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)


class PortfolioAdd(BaseModel):
    company_id: uuid.UUID
    note: Optional[str] = Field(default=None, max_length=2000)


class CompareIn(BaseModel):
    company_ids: list[uuid.UUID] = Field(min_length=2, max_length=6)


@router.get("/workspace")
def workspace(p: Principal = Depends(current_principal), db: Session = Depends(get_db)):
    ws = WORKSPACES.get(p.org_type)
    if not ws:
        raise HTTPException(403, "Institutional workspaces are for banks, insurers, investors and government users")
    return {**ws, "organisation_type": p.org_type, "entitlements": security.entitlements_for(db, p)}


def _current_scores(db: Session, ids: list[uuid.UUID]) -> dict[uuid.UUID, Score]:
    if not ids:
        return {}
    return {s.company_id: s for s in db.execute(select(Score).where(
        Score.company_id.in_(ids), Score.is_current, Score.score_type == "public")).scalars()}


def _nz_brief(db: Session, ids: list[uuid.UUID]) -> dict[uuid.UUID, dict]:
    out: dict[uuid.UUID, dict] = {}
    if not ids:
        return out
    rows = db.execute(select(ClimateTarget).join(Document, Document.id == ClimateTarget.document_id).where(
        ClimateTarget.company_id.in_(ids), ClimateTarget.channel == "public", Document.visibility == "public",
        ClimateTarget.verification_status.in_(("extracted", "verified")),
        ClimateTarget.target_kind.in_(("net_zero", "carbon_neutral")), ClimateTarget.target_year.is_not(None))).scalars()
    for t in rows:
        cur = out.get(t.company_id)
        if not cur or t.target_year < cur["target_year"]:
            out[t.company_id] = {"target_year": t.target_year, "validation_status": t.validation_status}
    return out


def _row(c: Company, s: Optional[Score], nz: Optional[dict]) -> dict:
    return {**views.company_brief(c),
            "score": None if not s else s.overall, "score_status": "not_assessed" if not s else
            ("scored" if s.overall is not None else "insufficient_evidence"),
            "confidence": s.confidence if s else None,
            "confidence_band": s.result["confidence"]["band"] if s else None,
            "pillars": s.pillars if s else None, "evidence_coverage": s.evidence_coverage if s else None,
            "latest_period": fy_label(s.fiscal_year) if s else None, "scored_at": s.computed_at if s else None,
            "net_zero": nz}


@router.get("/screen")
def screen(q: Optional[str] = Query(default=None, max_length=200), sector: Optional[str] = None,
           country: Optional[str] = None, min_score: Optional[float] = Query(default=None, ge=0, le=100),
           max_score: Optional[float] = Query(default=None, ge=0, le=100),
           min_confidence: Optional[float] = Query(default=None, ge=0, le=100),
           net_zero: Optional[bool] = None, sort: str = Query("score", pattern="^(score|confidence|name)$"),
           limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0),
           p: Principal = Depends(current_principal), db: Session = Depends(get_db)):
    """Company screening on the Public Data Score, confidence, sector and Net Zero commitment."""
    security.require_entitlement(db, p, "company_intelligence")
    rows, _ = companies.search(db, q, sector_code=sector, country=country, limit=2000, offset=0)
    ids = [c.id for c in rows]
    scores, nz = _current_scores(db, ids), _nz_brief(db, ids)
    items = []
    for c in rows:
        s = scores.get(c.id)
        if min_score is not None and (not s or s.overall is None or s.overall < min_score):
            continue
        if max_score is not None and (not s or s.overall is None or s.overall > max_score):
            continue
        if min_confidence is not None and (not s or s.confidence < min_confidence):
            continue
        if net_zero is not None and (c.id in nz) != net_zero:
            continue
        items.append(_row(c, s, nz.get(c.id)))
    key = {"score": lambda r: (r["score"] is None, -(r["score"] or 0), r["legal_name"]),
           "confidence": lambda r: (r["confidence"] is None, -(r["confidence"] or 0), r["legal_name"]),
           "name": lambda r: r["legal_name"]}[sort]
    items.sort(key=key)
    return {"total": len(items), "items": items[offset:offset + limit]}


@router.post("/compare")
def compare(body: CompareIn, p: Principal = Depends(current_principal), db: Session = Depends(get_db)):
    """Side-by-side comparison of up to six companies on scores, pillars, key indicators and targets."""
    security.require_entitlement(db, p, "comparison")
    out = []
    for cid in dict.fromkeys(body.company_ids):
        c = companies.resolve(db, cid)
        s = assessment.current_score(db, c.id, "public")
        series = views.metric_series(views.usable_points(db, c.id))
        latest = {}
        for key in ("scope1_emissions", "scope2_location", "scope2_market", "scope3_emissions", "total_energy",
                    "renewable_energy_share", "water_withdrawal", "total_waste", "revenue", "environmental_incidents"):
            vals = series.get(key, {}).get("values", {})
            if vals:
                y = max(vals, key=int)
                latest[key] = {"value": vals[y]["value"], "unit": vals[y]["unit"], "fy_label": fy_label(int(y)),
                               "verification_status": vals[y]["verification_status"]}
        nzv = reports.net_zero_view(db, c)
        out.append({**_row(c, s, None), "indicators": latest,
                    "net_zero": {k: nzv["summary"][k] for k in ("net_zero_target", "net_zero_year", "near_term",
                                                                "validation_status", "scope_coverage")},
                    "progress": nzv["progress"], "benchmark": assessment.sector_benchmark(db, c),
                    "strengths": s.result["strengths"][:3] if s else [],
                    "improvements": s.result["improvements"][:3] if s else [],
                    "gaps": len(s.result["gaps"]) if s else None})
    audit.record(db, p, "institutional.compare", detail={"companies": [str(i) for i in body.company_ids]})
    return {"companies": out, "note": "Scores from different sectors are not directly comparable on performance "
                                      "indicators; use the sector benchmark for context."}


# ── Portfolios (private to the organisation) ─────────────────────────────────

def _portfolio(db: Session, p: Principal, portfolio_id: uuid.UUID) -> Portfolio:
    pf = db.get(Portfolio, portfolio_id)
    # Another organisation's portfolio is indistinguishable from one that does not exist.
    if not pf or pf.organisation_id != p.org_id:
        raise HTTPException(404, "Portfolio not found")
    return pf


@router.get("/portfolios")
def list_portfolios(p: Principal = Depends(require("portfolio.manage")), db: Session = Depends(get_db)):
    security.require_entitlement(db, p, "portfolio")
    rows = db.execute(select(Portfolio).where(Portfolio.organisation_id == p.org_id).order_by(Portfolio.name)).scalars().all()
    counts = dict(db.execute(select(PortfolioCompany.portfolio_id, func.count()).where(
        PortfolioCompany.portfolio_id.in_([r.id for r in rows])).group_by(PortfolioCompany.portfolio_id)).all()) if rows else {}
    return [{"id": str(r.id), "name": r.name, "description": r.description, "companies": counts.get(r.id, 0),
             "created_at": r.created_at} for r in rows]


@router.post("/portfolios", status_code=201)
def create_portfolio(body: PortfolioIn, p: Principal = Depends(require("portfolio.manage")), db: Session = Depends(get_db)):
    security.require_entitlement(db, p, "portfolio")
    if db.execute(select(Portfolio).where(Portfolio.organisation_id == p.org_id, Portfolio.name == body.name)).first():
        raise HTTPException(409, "A portfolio with this name already exists")
    pf = Portfolio(organisation_id=p.org_id, name=body.name, description=body.description, created_by=p.user_id)
    db.add(pf)
    db.flush()
    audit.record(db, p, "portfolio.create", entity_type="portfolio", entity_id=pf.id, detail={"name": pf.name})
    return {"id": str(pf.id), "name": pf.name}


@router.delete("/portfolios/{portfolio_id}", status_code=204)
def delete_portfolio(portfolio_id: uuid.UUID, p: Principal = Depends(require("portfolio.manage")),
                     db: Session = Depends(get_db)):
    pf = _portfolio(db, p, portfolio_id)
    audit.record(db, p, "portfolio.delete", entity_type="portfolio", entity_id=pf.id, detail={"name": pf.name})
    db.delete(pf)


@router.post("/portfolios/{portfolio_id}/companies", status_code=201)
def add_to_portfolio(portfolio_id: uuid.UUID, body: PortfolioAdd, p: Principal = Depends(require("portfolio.manage")),
                     db: Session = Depends(get_db)):
    security.require_entitlement(db, p, "portfolio")
    pf = _portfolio(db, p, portfolio_id)
    c = companies.resolve(db, body.company_id)
    if db.get(PortfolioCompany, (pf.id, c.id)):
        raise HTTPException(409, "This company is already in the portfolio")
    db.add(PortfolioCompany(portfolio_id=pf.id, company_id=c.id, note=body.note, added_by=p.user_id))
    audit.record(db, p, "portfolio.add_company", entity_type="portfolio", entity_id=pf.id, company_id=c.id)
    return {"portfolio_id": str(pf.id), "company_id": str(c.id)}


@router.delete("/portfolios/{portfolio_id}/companies/{company_id}", status_code=204)
def remove_from_portfolio(portfolio_id: uuid.UUID, company_id: uuid.UUID,
                          p: Principal = Depends(require("portfolio.manage")), db: Session = Depends(get_db)):
    pf = _portfolio(db, p, portfolio_id)
    row = db.get(PortfolioCompany, (pf.id, company_id))
    if not row:
        raise HTTPException(404, "Company is not in this portfolio")
    db.delete(row)
    audit.record(db, p, "portfolio.remove_company", entity_type="portfolio", entity_id=pf.id, company_id=company_id)


@router.get("/portfolios/{portfolio_id}")
def portfolio_overview(portfolio_id: uuid.UUID, p: Principal = Depends(require("portfolio.manage")),
                       db: Session = Depends(get_db)):
    """Portfolio sustainability overview: holdings, score distribution, confidence, Net Zero coverage and score movement."""
    security.require_entitlement(db, p, "portfolio")
    pf = _portfolio(db, p, portfolio_id)
    members = db.execute(select(PortfolioCompany, Company).join(Company, Company.id == PortfolioCompany.company_id)
                         .where(PortfolioCompany.portfolio_id == pf.id).order_by(Company.legal_name)).all()
    ids = [c.id for _, c in members]
    scores, nz = _current_scores(db, ids), _nz_brief(db, ids)
    holdings = []
    for m, c in members:
        row = _row(c, scores.get(c.id), nz.get(c.id))
        prev = db.execute(select(Score).where(Score.company_id == c.id, Score.score_type == "public",
                                              Score.is_current.is_(False), Score.overall.is_not(None))
                          .order_by(Score.computed_at.desc()).limit(1)).scalar_one_or_none()
        row["previous_score"] = prev.overall if prev else None
        row["score_change"] = (round(row["score"] - prev.overall, 1)
                               if prev and row["score"] is not None else None)
        row["note"], row["added_at"] = m.note, m.added_at
        holdings.append(row)
    scored = [h["score"] for h in holdings if h["score"] is not None]
    confs = [h["confidence"] for h in holdings if h["confidence"] is not None]
    by_sector: dict[str, dict] = {}
    for h in holdings:
        s = by_sector.setdefault(h["sector"] or "Unclassified", {"sector": h["sector"] or "Unclassified",
                                                                 "companies": 0, "scores": []})
        s["companies"] += 1
        if h["score"] is not None:
            s["scores"].append(h["score"])
    for s in by_sector.values():
        sc = s.pop("scores")
        s["average_score"] = round(sum(sc) / len(sc), 1) if sc else None
    bands = {"70 and above": sum(1 for x in scored if x >= 70), "40 to 69": sum(1 for x in scored if 40 <= x < 70),
             "below 40": sum(1 for x in scored if x < 40)}
    return {"id": str(pf.id), "name": pf.name, "description": pf.description, "holdings": holdings,
            "summary": {"companies": len(holdings), "scored": len(scored),
                        "insufficient_evidence": sum(1 for h in holdings if h["score_status"] == "insufficient_evidence"),
                        "not_assessed": sum(1 for h in holdings if h["score_status"] == "not_assessed"),
                        "average_score": round(sum(scored) / len(scored), 1) if scored else None,
                        "average_confidence": round(sum(confs) / len(confs), 1) if confs else None,
                        "with_net_zero_target": sum(1 for h in holdings if h["net_zero"]),
                        "score_bands": bands},
            "by_sector": sorted(by_sector.values(), key=lambda s: s["sector"]),
            "note": "Averages are unweighted across the companies listed; exposure weights are not held."}


# ── Sector aggregates (government and benchmarking) ──────────────────────────

@router.get("/sectors/aggregates")
def sector_aggregates(p: Principal = Depends(require("sector.aggregate")), db: Session = Depends(get_db)):
    """Sector-level indicators from public disclosures. Company-level values
    are never returned here, and a statistic is suppressed when fewer than
    three companies contribute to it."""
    ents = security.entitlements_for(db, p)
    if not (p.is_internal or "sector_aggregates" in ents or "sector_benchmark" in ents):
        security.require_entitlement(db, p, "sector_aggregates")
    out = []
    sectors = db.execute(select(Sector).where(Sector.active).order_by(Sector.name)).scalars().all()
    for s in sectors:
        cos = db.execute(select(Company.id).where(Company.sector_id == s.id, Company.status == "active")).scalars().all()
        if not cos:
            continue
        with_docs = db.execute(select(func.count(func.distinct(Document.company_id))).where(
            Document.company_id.in_(cos), Document.visibility == "public", Document.status == "completed")).scalar() or 0
        scores = list(_current_scores(db, cos).values())
        overall = sorted(x.overall for x in scores if x.overall is not None)
        with_nz = len(_nz_brief(db, cos))

        def disclosed(metric: str) -> int:
            return db.execute(select(func.count(func.distinct(DataPoint.company_id))).join(
                Document, Document.id == DataPoint.document_id).where(
                DataPoint.company_id.in_(cos), DataPoint.metric_key == metric, DataPoint.channel == "public",
                Document.visibility == "public",
                DataPoint.verification_status.in_(("extracted", "verified")))).scalar() or 0

        row = {"sector_code": s.code, "sector": s.name, "companies": len(cos),
               "companies_reporting": with_docs,
               "reporting_participation_pct": round(100 * with_docs / len(cos), 1),
               "companies_scored": len(overall),
               "disclosure_coverage": {k: disclosed(m) for k, m in (("scope1", "scope1_emissions"),
                                                                   ("scope3", "scope3_emissions"),
                                                                   ("energy", "total_energy"),
                                                                   ("water", "water_withdrawal"),
                                                                   ("waste", "total_waste"))},
               "companies_with_net_zero_target": with_nz}
        if len(overall) >= MIN_AGGREGATE:
            mid = len(overall) // 2
            median = overall[mid] if len(overall) % 2 else (overall[mid - 1] + overall[mid]) / 2
            row["score"] = {"median": round(median, 1), "min": overall[0], "max": overall[-1],
                            "average_confidence": round(sum(x.confidence for x in scores) / len(scores), 1)}
            pillars: dict[str, list[float]] = {}
            for x in scores:
                for pid, v in (x.pillars or {}).items():
                    if v is not None:
                        pillars.setdefault(pid, []).append(v)
            row["pillar_averages"] = {pid: round(sum(v) / len(v), 1) for pid, v in pillars.items()
                                      if len(v) >= MIN_AGGREGATE}
        else:
            row["score"] = None
            row["suppressed"] = f"Fewer than {MIN_AGGREGATE} scored companies; statistics withheld"
        out.append(row)
    audit.record(db, p, "institutional.sector_aggregates")
    return {"sectors": out, "basis": "Aggregated from public corporate disclosures held in the Climactix Terminal. "
                                     "Not an official statistic.",
            "minimum_group_size": MIN_AGGREGATE}


@router.get("/coverage")
def disclosure_coverage(sector: Optional[str] = None, p: Principal = Depends(require("sector.aggregate")),
                        db: Session = Depends(get_db)):
    """Which companies have public disclosures on file, by document type and period. Directory-level information only."""
    ents = security.entitlements_for(db, p)
    if not (p.is_internal or "disclosure_coverage" in ents or "company_intelligence" in ents):
        security.require_entitlement(db, p, "disclosure_coverage")
    rows, total = companies.search(db, None, sector_code=sector, limit=500)
    ids = [c.id for c in rows]
    docs: dict[uuid.UUID, dict] = {}
    if ids:
        for cid, cat, fy, n in db.execute(select(Document.company_id, Document.category, func.max(Document.fiscal_year),
                                                 func.count()).where(Document.company_id.in_(ids),
                                                                     Document.visibility == "public",
                                                                     Document.status == "completed")
                                          .group_by(Document.company_id, Document.category)).all():
            docs.setdefault(cid, {})[cat] = {"documents": n, "latest_period": fy_label(fy)}
    return {"total": total, "items": [{**views.company_brief(c), "disclosures": docs.get(c.id, {}),
                                       "reporting": c.id in docs} for c in rows]}
