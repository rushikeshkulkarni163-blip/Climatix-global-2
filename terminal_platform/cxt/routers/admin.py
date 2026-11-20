"""Climactix administration: processing dashboard, organisations, users, subscriptions,
methodology, sectors, jobs and the audit trail."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import audit, companies, connectors, mailer, methodology, pipeline, security, views
from ..config import get_settings
from ..db import get_db
from ..extraction.catalogue import ocr_available
from ..models import (ORG_TYPES, PLANS, ROLES, Assessment, AuditLog, Company, CorrectionRequest, Document, Job,
                      MethodologyVersion, Organisation, ReviewItem, Score, Sector, Subscription, User, utcnow)
from ..security import Principal, current_principal, require

router = APIRouter(prefix="/admin", tags=["Administration"])


class OrgIn(BaseModel):
    name: str = Field(min_length=2, max_length=300)
    org_type: str
    country: Optional[str] = Field(default=None, max_length=80)
    company_id: Optional[uuid.UUID] = None


class InviteIn(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=200)
    role: str
    organisation_id: uuid.UUID


class SubscriptionIn(BaseModel):
    organisation_id: uuid.UUID
    plan: str
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    entitlements: Optional[list[str]] = None
    notes: Optional[str] = Field(default=None, max_length=2000)


class MethodologyIn(BaseModel):
    version: str = Field(pattern=r"^\d+\.\d+(\.\d+)?$")
    config: dict[str, Any]
    change_note: str = Field(min_length=10, max_length=4000)


class SectorIn(BaseModel):
    code: str = Field(pattern=r"^[a-z0-9_]{2,40}$")
    name: str = Field(min_length=2, max_length=160)


# ── Processing dashboard ─────────────────────────────────────────────────────

STAGES = ["no_reports", "reports_ingested", "awaiting_extraction", "assessment_pending", "score_generated"]
STAGE_LABEL = {"no_reports": "No reports", "reports_ingested": "Reports ingested, not yet usable",
               "awaiting_extraction": "Awaiting extraction", "assessment_pending": "Extraction completed, assessment pending",
               "score_generated": "Score generated"}


@router.get("/dashboard")
def dashboard(p: Principal = Depends(require("admin.dashboard")), db: Session = Depends(get_db)):
    cos = db.execute(select(Company).where(Company.status == "active").order_by(Company.legal_name)).scalars().all()
    by_stage: dict[str, list] = {s: [] for s in STAGES}
    for c in cos:
        st = views.coverage_status(db, c.id)
        by_stage[st["stage"]].append({**views.company_brief(c), "documents": st["documents"],
                                      "by_status": st["by_status"]})
    company_assess = dict(db.execute(select(Assessment.status, func.count()).where(Assessment.channel == "company")
                                     .group_by(Assessment.status)).all())
    return {
        "companies": {"total": len(cos),
                      "by_stage": [{"stage": s, "label": STAGE_LABEL[s], "count": len(by_stage[s]),
                                    "companies": by_stage[s][:200]} for s in STAGES]},
        "documents": dict(db.execute(select(Document.status, func.count()).group_by(Document.status)).all()),
        "jobs": dict(db.execute(select(Job.status, func.count()).group_by(Job.status)).all()),
        "review_queue": dict(db.execute(select(ReviewItem.kind, func.count()).where(ReviewItem.status == "open")
                                        .group_by(ReviewItem.kind)).all()),
        "company_assessments": company_assess,
        "correction_requests_open": db.execute(select(func.count()).select_from(CorrectionRequest).where(
            CorrectionRequest.status == "open")).scalar(),
        "scores": {"public_current": db.execute(select(func.count()).select_from(Score).where(
            Score.is_current, Score.score_type == "public")).scalar(),
                   "company_current": db.execute(select(func.count()).select_from(Score).where(
                       Score.is_current, Score.score_type == "company")).scalar()},
        "system": system_status(db),
    }


def system_status(db: Session) -> dict:
    s = get_settings()
    oldest = db.execute(select(func.min(Job.created_at)).where(Job.status == "pending")).scalar()
    return {
        "environment": s.env,
        "ocr": {"available": ocr_available(),
                "detail": "Tesseract OCR is available" if ocr_available() else
                "Tesseract is not installed on this server: scanned documents are routed to manual review"},
        "llm_extraction": {"configured": s.llm_configured,
                           "detail": "Rule-based extraction is active. LLM-assisted extraction is not configured."
                           if not s.llm_configured else f"LLM-assisted extraction via {s.llm_provider}"},
        "email": {"configured": s.email_configured,
                  "detail": "SMTP is configured" if s.email_configured else
                  "SMTP is not configured: invitation and reset links must be passed to users by an administrator"},
        "storage": {"backend": s.storage_backend},
        "payments": {"configured": False, "detail": "No payment provider is configured; subscriptions are "
                                                    "managed by administrators"},
        "connectors": connectors.describe(),
        "queue": {"oldest_pending_job": oldest,
                  "worker_note": "Jobs are processed by the worker process (python -m cxt.cli worker)"},
    }


@router.get("/jobs")
def jobs(status: Optional[str] = None, limit: int = Query(100, ge=1, le=500),
         p: Principal = Depends(require("admin.dashboard")), db: Session = Depends(get_db)):
    stmt = select(Job)
    if status:
        stmt = stmt.where(Job.status == status)
    return [{"id": str(j.id), "kind": j.kind, "status": j.status, "attempts": j.attempts, "error": j.error,
             "document_id": str(j.document_id) if j.document_id else None,
             "company_id": str(j.company_id) if j.company_id else None, "created_at": j.created_at,
             "finished_at": j.finished_at}
            for j in db.execute(stmt.order_by(Job.created_at.desc()).limit(limit)).scalars()]


@router.post("/jobs/{job_id}/retry", status_code=202)
def retry_job(job_id: uuid.UUID, p: Principal = Depends(require("admin.dashboard")), db: Session = Depends(get_db)):
    j = db.get(Job, job_id)
    if not j or j.status != "failed":
        raise HTTPException(404, "No failed job with this id")
    j.status, j.attempts, j.run_after, j.error, j.finished_at = "pending", 0, utcnow(), None, None
    if j.document_id:
        db.get(Document, j.document_id).status = "pending"
    audit.record(db, p, "job.retry", entity_type="job", entity_id=j.id, detail={"kind": j.kind})
    return {"id": str(j.id), "status": j.status}


@router.get("/documents")
def all_documents(status: Optional[str] = None, limit: int = Query(100, ge=1, le=500),
                  p: Principal = Depends(require("admin.dashboard")), db: Session = Depends(get_db)):
    stmt = select(Document)
    if status:
        stmt = stmt.where(Document.status == status)
    return [{**views.document_out(d), "company": views.company_brief(d.company) if d.company else None}
            for d in db.execute(stmt.order_by(Document.created_at.desc()).limit(limit)).scalars()]


# ── Organisations ────────────────────────────────────────────────────────────

def _org_out(db: Session, o: Organisation) -> dict:
    sub = security.active_subscription(db, o.id)
    return {"id": str(o.id), "name": o.name, "org_type": o.org_type, "country": o.country, "status": o.status,
            "company_id": str(o.company_id) if o.company_id else None, "created_at": o.created_at,
            "users": db.execute(select(func.count()).select_from(User).where(User.organisation_id == o.id)).scalar(),
            "subscription": None if not sub else {"id": str(sub.id), "plan": sub.plan, "ends_at": sub.ends_at,
                                                  "entitlements": sub.entitlements}}


@router.get("/organisations")
def organisations(p: Principal = Depends(require("admin.organisations")), db: Session = Depends(get_db)):
    return [_org_out(db, o) for o in db.execute(select(Organisation).order_by(Organisation.name)).scalars()]


@router.post("/organisations", status_code=201)
def create_organisation(body: OrgIn, p: Principal = Depends(require("admin.organisations")), db: Session = Depends(get_db)):
    if body.org_type not in ORG_TYPES:
        raise HTTPException(422, f"org_type must be one of {', '.join(ORG_TYPES)}")
    if body.org_type == "company":
        if not body.company_id:
            raise HTTPException(422, "A company organisation must be linked to a company record")
        c = companies.resolve(db, body.company_id)
        if db.execute(select(Organisation).where(Organisation.company_id == c.id)).first():
            raise HTTPException(409, "This company already has an organisation account")
    elif body.company_id:
        raise HTTPException(422, "Only company organisations are linked to a company record")
    o = Organisation(name=body.name, org_type=body.org_type, country=body.country, company_id=body.company_id)
    db.add(o)
    db.flush()
    audit.record(db, p, "organisation.create", entity_type="organisation", entity_id=o.id,
                 company_id=body.company_id, detail={"name": o.name, "org_type": o.org_type})
    return _org_out(db, o)


@router.post("/organisations/{org_id}/status")
def set_org_status(org_id: uuid.UUID, status: str = Query(pattern="^(active|suspended)$"),
                   p: Principal = Depends(require("admin.organisations")), db: Session = Depends(get_db)):
    o = db.get(Organisation, org_id)
    if not o:
        raise HTTPException(404, "Organisation not found")
    if o.id == p.org_id and status == "suspended":
        raise HTTPException(409, "You cannot suspend your own organisation")
    o.status = status
    revoked = 0
    if status == "suspended":
        for u in db.execute(select(User).where(User.organisation_id == o.id)).scalars():
            revoked += security.revoke_user_sessions(db, u.id)
    audit.record(db, p, f"organisation.{status}", entity_type="organisation", entity_id=o.id,
                 detail={"sessions_revoked": revoked})
    return _org_out(db, o)


# ── Users ────────────────────────────────────────────────────────────────────

def _user_out(u: User) -> dict:
    return {"id": str(u.id), "email": u.email, "full_name": u.full_name, "role": u.role, "status": u.status,
            "organisation_id": str(u.organisation_id), "organisation": u.organisation.name,
            "organisation_type": u.organisation.org_type, "last_login_at": u.last_login_at,
            "created_at": u.created_at, "locked": bool(u.locked_until and u.locked_until > utcnow())}


@router.get("/users")
def users(organisation_id: Optional[uuid.UUID] = None, p: Principal = Depends(require("admin.users")),
          db: Session = Depends(get_db)):
    stmt = select(User)
    if organisation_id:
        stmt = stmt.where(User.organisation_id == organisation_id)
    return [_user_out(u) for u in db.execute(stmt.order_by(User.email)).scalars()]


def _link(kind: str, raw: str) -> str:
    return f"{get_settings().public_app_url}/{'accept-invite' if kind == 'invite' else 'reset-password'}?token={raw}"


@router.post("/users/invite", status_code=201)
def invite(body: InviteIn, p: Principal = Depends(require("admin.users")), db: Session = Depends(get_db)):
    """Invite a user. The one-time link is emailed when SMTP is configured and
    is returned once to the administrator in either case."""
    if body.role not in ROLES:
        raise HTTPException(422, f"role must be one of {', '.join(ROLES)}")
    org = db.get(Organisation, body.organisation_id)
    if not org:
        raise HTTPException(404, "Organisation not found")
    if security.ROLE_ORG_TYPE[body.role] != org.org_type:
        raise HTTPException(422, f"Role {body.role} can only belong to a {security.ROLE_ORG_TYPE[body.role]} "
                                 f"organisation; {org.name} is a {org.org_type} organisation")
    if db.execute(select(User).where(func.lower(User.email) == body.email.lower())).first():
        raise HTTPException(409, "A user with this email already exists")
    u = User(email=body.email.lower(), full_name=body.full_name.strip(), role=body.role, organisation_id=org.id,
             status="invited")
    db.add(u)
    db.flush()
    raw = security.issue_token(db, u, "invite", hours=72)
    link = _link("invite", raw)
    sent = mailer.send(u.email, "You have been invited to Climactix Terminal",
                       f"{p.full_name} invited you to join {org.name} on Climactix Terminal.\n\n"
                       f"Set your password within 72 hours:\n\n{link}\n")
    audit.record(db, p, "user.invite", entity_type="user", entity_id=u.id,
                 detail={"email": u.email, "role": u.role, "organisation": org.name, "email_delivered": sent})
    return {**_user_out(u), "invite_link": link, "email_delivered": sent, "expires_in_hours": 72}


@router.post("/users/{user_id}/reset-link")
def reset_link(user_id: uuid.UUID, p: Principal = Depends(require("admin.users")), db: Session = Depends(get_db)):
    """Issue a fresh one-time link (invitation for a pending user, password reset for an active one)."""
    u = db.get(User, user_id)
    if not u or u.status == "disabled":
        raise HTTPException(404, "No active or invited user with this id")
    kind = "invite" if u.status == "invited" else "password_reset"
    raw = security.issue_token(db, u, kind, hours=72 if kind == "invite" else 1)
    audit.record(db, p, "user.link_issued", entity_type="user", entity_id=u.id, detail={"kind": kind})
    return {"link": _link(kind, raw), "kind": kind}


@router.post("/users/{user_id}/status")
def set_user_status(user_id: uuid.UUID, status: str = Query(pattern="^(active|disabled)$"),
                    p: Principal = Depends(require("admin.users")), db: Session = Depends(get_db)):
    """Disable (access revocation) or re-enable a user. Disabling ends every session immediately."""
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(404, "User not found")
    if u.id == p.user_id:
        raise HTTPException(409, "You cannot change your own status")
    if status == "active" and not u.password_hash:
        raise HTTPException(409, "This user has not accepted their invitation yet")
    if status == "disabled" and u.role == "super_admin":
        others = db.execute(select(func.count()).select_from(User).where(
            User.role == "super_admin", User.status == "active", User.id != u.id)).scalar()
        if not others:
            raise HTTPException(409, "The last active Super Administrator cannot be disabled")
    u.status = status
    revoked = security.revoke_user_sessions(db, u.id) if status == "disabled" else 0
    audit.record(db, p, f"user.{status}", entity_type="user", entity_id=u.id,
                 detail={"email": u.email, "sessions_revoked": revoked})
    return _user_out(u)


@router.post("/users/{user_id}/role")
def set_role(user_id: uuid.UUID, role: str, p: Principal = Depends(require("admin.users")),
             db: Session = Depends(get_db)):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(404, "User not found")
    if role not in ROLES or security.ROLE_ORG_TYPE[role] != u.organisation.org_type:
        raise HTTPException(422, "This role is not valid for the user's organisation type")
    if u.id == p.user_id:
        raise HTTPException(409, "You cannot change your own role")
    before, u.role = u.role, role
    revoked = security.revoke_user_sessions(db, u.id)
    audit.record(db, p, "user.role_changed", entity_type="user", entity_id=u.id,
                 detail={"before": before, "after": role, "sessions_revoked": revoked})
    return _user_out(u)


# ── Subscriptions ────────────────────────────────────────────────────────────

def _sub_out(db: Session, s: Subscription) -> dict:
    o = db.get(Organisation, s.organisation_id)
    now = utcnow()
    live = s.status == "active" and (s.ends_at is None or s.ends_at > now)
    return {"id": str(s.id), "organisation_id": str(s.organisation_id), "organisation": o.name,
            "organisation_type": o.org_type, "plan": s.plan,
            "status": s.status if s.status != "active" or live else "expired",
            "starts_at": s.starts_at, "ends_at": s.ends_at,
            "days_remaining": max(0, (s.ends_at - now).days) if s.ends_at and live else None,
            "entitlements": s.entitlements, "notes": s.notes}


@router.get("/subscriptions")
def subscriptions(p: Principal = Depends(require("admin.subscriptions")), db: Session = Depends(get_db)):
    return [_sub_out(db, s) for s in db.execute(select(Subscription).order_by(Subscription.starts_at.desc())).scalars()]


@router.post("/subscriptions", status_code=201)
def create_subscription(body: SubscriptionIn, p: Principal = Depends(require("admin.subscriptions")),
                        db: Session = Depends(get_db)):
    """Grant access. A pilot runs six months from its start unless an end date
    is given; annual plans run twelve months. No payment is taken here."""
    if body.plan not in PLANS:
        raise HTTPException(422, f"plan must be one of {', '.join(PLANS)}")
    org = db.get(Organisation, body.organisation_id)
    if not org:
        raise HTTPException(404, "Organisation not found")
    if (body.plan == "internal") != (org.org_type == "climactix"):
        raise HTTPException(422, "The internal plan is for the Climactix organisation only")
    if body.plan == "institutional_pilot" and org.org_type not in ("bank", "investor", "insurance", "government"):
        raise HTTPException(422, "Pilot access is for institutional organisations")
    ents = body.entitlements if body.entitlements is not None else security.default_entitlements(body.plan, org)
    unknown = [e for e in ents if e not in security.ENTITLEMENTS]
    if unknown:
        raise HTTPException(422, f"Unknown entitlement(s): {', '.join(unknown)}")
    starts = body.starts_at or utcnow()
    ends = body.ends_at
    if ends is None and body.plan != "internal":
        ends = starts + timedelta(days=183 if body.plan == "institutional_pilot" else 365)
    if ends and ends <= starts:
        raise HTTPException(422, "The end date must be after the start date")
    for old in db.execute(select(Subscription).where(Subscription.organisation_id == org.id,
                                                     Subscription.status == "active")).scalars():
        old.status = "cancelled"
    sub = Subscription(organisation_id=org.id, plan=body.plan, status="active", starts_at=starts, ends_at=ends,
                       entitlements=ents, notes=body.notes, created_by=p.user_id)
    db.add(sub)
    db.flush()
    audit.record(db, p, "subscription.create", entity_type="subscription", entity_id=sub.id,
                 detail={"organisation": org.name, "plan": sub.plan, "starts_at": starts.isoformat(),
                         "ends_at": ends.isoformat() if ends else None, "entitlements": ents})
    return _sub_out(db, sub)


@router.post("/subscriptions/{subscription_id}/cancel")
def cancel_subscription(subscription_id: uuid.UUID, p: Principal = Depends(require("admin.subscriptions")),
                        db: Session = Depends(get_db)):
    s = db.get(Subscription, subscription_id)
    if not s:
        raise HTTPException(404, "Subscription not found")
    s.status = "cancelled"
    audit.record(db, p, "subscription.cancel", entity_type="subscription", entity_id=s.id)
    return _sub_out(db, s)


# ── Methodology ──────────────────────────────────────────────────────────────

def _methodology_out(m: MethodologyVersion, full: bool = False) -> dict:
    out = {"id": str(m.id), "version": m.version, "status": m.status, "config_hash": m.config_hash,
           "change_note": m.change_note, "created_at": m.created_at, "approved_at": m.approved_at,
           "weights": [{"id": x["id"], "name": x["name"], "weight": x["weight"]} for x in m.config["pillars"]]}
    if full:
        out["config"] = m.config
    return out


@router.get("/methodology")
def list_methodology(p: Principal = Depends(current_principal), db: Session = Depends(get_db)):
    """Every methodology version. Readable by all signed-in users: the method is not a secret."""
    rows = db.execute(select(MethodologyVersion).order_by(MethodologyVersion.created_at.desc())).scalars().all()
    if not p.can("methodology.manage"):
        rows = [m for m in rows if m.status != "draft"]
    return [_methodology_out(m, full=m.status == "approved") for m in rows]


@router.get("/methodology/{methodology_id}")
def get_methodology(methodology_id: uuid.UUID, p: Principal = Depends(current_principal), db: Session = Depends(get_db)):
    m = db.get(MethodologyVersion, methodology_id)
    if not m or (m.status == "draft" and not p.can("methodology.manage")):
        raise HTTPException(404, "Methodology version not found")
    return _methodology_out(m, full=True)


@router.post("/methodology", status_code=201)
def draft_methodology(body: MethodologyIn, p: Principal = Depends(require("methodology.manage")),
                      db: Session = Depends(get_db)):
    """Create a draft methodology version. It has no effect on scores until approved."""
    return _methodology_out(methodology.create_draft(db, p, body.version, body.config, body.change_note), full=True)


@router.post("/methodology/{methodology_id}/approve")
def approve_methodology(methodology_id: uuid.UUID, rescore: bool = True,
                        p: Principal = Depends(require("methodology.manage")), db: Session = Depends(get_db)):
    """Approve a draft. With rescore=true every assessed company is queued for
    a new score version under the new methodology; earlier scores are kept."""
    m = methodology.approve(db, p, methodology_id)
    queued = 0
    if rescore:
        for cid in db.execute(select(Score.company_id).where(Score.is_current, Score.score_type == "public")).scalars():
            pipeline.enqueue_assessment(db, cid, f"methodology {m.version} approved")
            queued += 1
    return {**_methodology_out(m, full=True), "companies_queued_for_rescoring": queued}


# ── Sectors ──────────────────────────────────────────────────────────────────

@router.get("/sectors")
def sectors(p: Principal = Depends(require("admin.sectors")), db: Session = Depends(get_db)):
    counts = dict(db.execute(select(Company.sector_id, func.count()).where(Company.status == "active")
                             .group_by(Company.sector_id)).all())
    return [{"id": str(s.id), "code": s.code, "name": s.name, "active": s.active, "companies": counts.get(s.id, 0)}
            for s in db.execute(select(Sector).order_by(Sector.name)).scalars()]


@router.post("/sectors", status_code=201)
def add_sector(body: SectorIn, p: Principal = Depends(require("admin.sectors")), db: Session = Depends(get_db)):
    if db.execute(select(Sector).where(Sector.code == body.code)).first():
        raise HTTPException(409, "A sector with this code already exists")
    s = Sector(code=body.code, name=body.name)
    db.add(s)
    db.flush()
    audit.record(db, p, "sector.create", entity_type="sector", entity_id=s.id, detail=body.model_dump())
    return {"id": str(s.id), "code": s.code, "name": s.name, "active": True}


@router.post("/sectors/{sector_id}/active")
def set_sector_active(sector_id: uuid.UUID, active: bool, p: Principal = Depends(require("admin.sectors")),
                      db: Session = Depends(get_db)):
    s = db.get(Sector, sector_id)
    if not s:
        raise HTTPException(404, "Sector not found")
    s.active = active
    audit.record(db, p, "sector.update", entity_type="sector", entity_id=s.id, detail={"active": active})
    return {"id": str(s.id), "code": s.code, "name": s.name, "active": s.active}


# ── Audit trail ──────────────────────────────────────────────────────────────

@router.get("/audit")
def audit_log(action: Optional[str] = None, entity_type: Optional[str] = None, entity_id: Optional[str] = None,
              company_id: Optional[uuid.UUID] = None, actor: Optional[str] = None,
              since: Optional[datetime] = None, limit: int = Query(100, ge=1, le=500), offset: int = Query(0, ge=0),
              p: Principal = Depends(require("audit.read")), db: Session = Depends(get_db)):
    stmt = select(AuditLog)
    if action:
        stmt = stmt.where(AuditLog.action.ilike(f"{action}%"))
    if entity_type:
        stmt = stmt.where(AuditLog.entity_type == entity_type)
    if entity_id:
        stmt = stmt.where(AuditLog.entity_id == entity_id)
    if company_id:
        stmt = stmt.where(AuditLog.company_id == company_id)
    if actor:
        stmt = stmt.where(AuditLog.actor_label.ilike(f"%{actor}%"))
    if since:
        stmt = stmt.where(AuditLog.at >= since)
    total = db.execute(select(func.count()).select_from(stmt.subquery())).scalar()
    rows = db.execute(stmt.order_by(AuditLog.id.desc()).limit(limit).offset(offset)).scalars()
    return {"total": total, "items": [{"id": r.id, "at": r.at, "actor": r.actor_label, "role": r.actor_role,
                                       "action": r.action, "entity_type": r.entity_type, "entity_id": r.entity_id,
                                       "company_id": str(r.company_id) if r.company_id else None,
                                       "detail": r.detail, "ip": r.ip} for r in rows]}


@router.get("/audit/verify")
def verify_audit(p: Principal = Depends(require("audit.read")), db: Session = Depends(get_db)):
    """Recompute the audit hash chain to detect altered or removed entries."""
    return audit.verify_chain(db)
