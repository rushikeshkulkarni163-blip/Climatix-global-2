"""Authentication: login, logout, sessions, password recovery, invitations."""

from __future__ import annotations

import uuid
from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import audit, mailer, security
from ..config import get_settings
from ..db import get_db
from ..models import AuthSession, User, utcnow
from ..security import Principal, current_principal

router = APIRouter(prefix="/auth", tags=["Authentication"])


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=200)


class ForgotIn(BaseModel):
    email: EmailStr


class ResetIn(BaseModel):
    token: str = Field(min_length=20, max_length=200)
    password: str = Field(min_length=1, max_length=200)


class AcceptInviteIn(ResetIn):
    full_name: Optional[str] = Field(default=None, max_length=200)


class ChangePasswordIn(BaseModel):
    current_password: str = Field(max_length=200)
    new_password: str = Field(max_length=200)


def _set_cookie(resp: Response, token: str) -> None:
    s = get_settings()
    resp.set_cookie(s.cookie_name, token, httponly=True, secure=s.cookie_secure, samesite="lax",
                    max_age=s.session_hours * 3600, path="/")


def me_payload(db: Session, p: Principal) -> dict:
    sub = security.active_subscription(db, p.org_id)
    return {
        "user": {"id": str(p.user_id), "email": p.email, "full_name": p.full_name, "role": p.role},
        "organisation": {"id": str(p.org_id), "name": p.org_name, "type": p.org_type,
                         "company_id": str(p.company_id) if p.company_id else None},
        "permissions": sorted(k for k, roles in security.PERMISSIONS.items() if p.role in roles),
        "entitlements": security.entitlements_for(db, p),
        "subscription": None if not sub else {
            "plan": sub.plan, "status": sub.status, "starts_at": sub.starts_at, "ends_at": sub.ends_at,
            "days_remaining": max(0, (sub.ends_at - utcnow()).days) if sub.ends_at else None},
    }


@router.post("/login")
def login(body: LoginIn, request: Request, response: Response, db: Session = Depends(get_db)):
    s = get_settings()
    ip = security.client_ip(request)
    user = db.execute(select(User).where(func.lower(User.email) == body.email.lower()).with_for_update(of=User)).scalar_one_or_none()
    generic = HTTPException(401, "Incorrect email or password")
    if not user:
        security.hash_password("timing-equalisation")        # same work whether or not the account exists
        audit.record(db, None, "auth.login_failed", detail={"email": body.email.lower(), "reason": "unknown"}, ip=ip)
        db.commit()
        raise generic
    now = utcnow()
    if user.locked_until and user.locked_until > now:
        audit.record(db, None, "auth.login_blocked", entity_type="user", entity_id=user.id,
                     detail={"reason": "locked"}, ip=ip)
        db.commit()
        raise HTTPException(429, "Too many failed attempts. Try again later or reset your password.")
    if user.status != "active" or not security.verify_password(body.password, user.password_hash):
        user.failed_logins += 1
        if user.failed_logins >= s.max_failed_logins:
            user.locked_until, user.failed_logins = now + timedelta(minutes=s.lockout_minutes), 0
        audit.record(db, None, "auth.login_failed", entity_type="user", entity_id=user.id,
                     detail={"reason": "status" if user.status != "active" else "password"}, ip=ip)
        db.commit()
        raise generic
    if user.organisation.status != "active":
        raise HTTPException(403, "Organisation account is suspended")
    user.failed_logins, user.locked_until, user.last_login_at = 0, None, now
    sess, token = security.create_session(db, user, ip, request.headers.get("user-agent"))
    _set_cookie(response, token)
    p = Principal(user.id, user.email, user.full_name, user.role, user.organisation_id, user.organisation.org_type,
                  user.organisation.name, user.organisation.company_id, sess.id, ip)
    audit.record(db, p, "auth.login", entity_type="user", entity_id=user.id)
    return {"access_token": token, "token_type": "bearer", "expires_in": s.access_token_minutes * 60,
            **me_payload(db, p)}


@router.post("/logout", status_code=204)
def logout(response: Response, p: Principal = Depends(current_principal), db: Session = Depends(get_db)):
    sess = db.get(AuthSession, p.session_id)
    if sess:
        sess.revoked_at = utcnow()
    audit.record(db, p, "auth.logout", entity_type="user", entity_id=p.user_id)
    response.delete_cookie(get_settings().cookie_name, path="/")


@router.get("/me")
def me(p: Principal = Depends(current_principal), db: Session = Depends(get_db)):
    return me_payload(db, p)


@router.post("/token/refresh")
def refresh(response: Response, p: Principal = Depends(current_principal), db: Session = Depends(get_db)):
    """Exchange a valid session for a fresh short-lived access token."""
    token = security.encode_access_token(db.get(AuthSession, p.session_id))
    _set_cookie(response, token)
    return {"access_token": token, "token_type": "bearer", "expires_in": get_settings().access_token_minutes * 60}


@router.get("/sessions")
def sessions(p: Principal = Depends(current_principal), db: Session = Depends(get_db)):
    rows = db.execute(select(AuthSession).where(AuthSession.user_id == p.user_id, AuthSession.revoked_at.is_(None),
                                                AuthSession.expires_at > utcnow())
                      .order_by(AuthSession.last_seen_at.desc())).scalars()
    return [{"id": str(s.id), "created_at": s.created_at, "last_seen_at": s.last_seen_at, "expires_at": s.expires_at,
             "ip": s.ip, "user_agent": s.user_agent, "current": s.id == p.session_id} for s in rows]


@router.delete("/sessions/{session_id}", status_code=204)
def revoke_session(session_id: uuid.UUID, p: Principal = Depends(current_principal), db: Session = Depends(get_db)):
    sess = db.get(AuthSession, session_id)
    if not sess or sess.user_id != p.user_id:
        raise HTTPException(404, "Session not found")
    sess.revoked_at = utcnow()
    audit.record(db, p, "auth.session_revoked", entity_type="session", entity_id=sess.id)


@router.post("/password/forgot", status_code=202)
def forgot(body: ForgotIn, request: Request, db: Session = Depends(get_db)):
    """Always answers 202 so the endpoint cannot be used to discover accounts."""
    user = db.execute(select(User).where(func.lower(User.email) == body.email.lower())).scalar_one_or_none()
    delivered = False
    if user and user.status == "active":
        raw = security.issue_token(db, user, "password_reset", hours=1)
        link = f"{get_settings().public_app_url}/reset-password?token={raw}"
        delivered = mailer.send(user.email, "Reset your Climactix Terminal password",
                                f"Use this link within one hour to choose a new password:\n\n{link}\n\n"
                                f"If you did not request this, you can ignore this message.")
        audit.record(db, None, "auth.password_reset_requested", entity_type="user", entity_id=user.id,
                     detail={"email_delivered": delivered}, ip=security.client_ip(request))
    return {"message": "If an account exists for this address, password reset instructions have been issued.",
            "email_delivery_configured": get_settings().email_configured}


@router.post("/password/reset")
def reset(body: ResetIn, request: Request, db: Session = Depends(get_db)):
    security.validate_password(body.password)
    user = security.consume_token(db, body.token, "password_reset")
    user.password_hash = security.hash_password(body.password)
    user.failed_logins, user.locked_until = 0, None
    n = security.revoke_user_sessions(db, user.id)
    audit.record(db, None, "auth.password_reset", entity_type="user", entity_id=user.id,
                 detail={"sessions_revoked": n}, ip=security.client_ip(request))
    return {"message": "Password updated. Sign in with your new password."}


@router.post("/invite/accept")
def accept_invite(body: AcceptInviteIn, request: Request, db: Session = Depends(get_db)):
    security.validate_password(body.password)
    user = security.consume_token(db, body.token, "invite")
    if user.status != "invited":
        raise HTTPException(400, "This invitation has already been used")
    user.password_hash = security.hash_password(body.password)
    user.status = "active"
    if body.full_name and body.full_name.strip():
        user.full_name = body.full_name.strip()
    audit.record(db, None, "auth.invite_accepted", entity_type="user", entity_id=user.id,
                 detail={"email": user.email}, ip=security.client_ip(request))
    return {"message": "Account activated. You can now sign in.", "email": user.email}


@router.post("/password/change")
def change_password(body: ChangePasswordIn, p: Principal = Depends(current_principal), db: Session = Depends(get_db)):
    user = db.get(User, p.user_id)
    if not security.verify_password(body.current_password, user.password_hash):
        raise HTTPException(403, "Current password is incorrect")
    security.validate_password(body.new_password)
    user.password_hash = security.hash_password(body.new_password)
    n = security.revoke_user_sessions(db, user.id, except_session=p.session_id)
    audit.record(db, p, "auth.password_changed", entity_type="user", entity_id=user.id,
                 detail={"other_sessions_revoked": n})
    return {"message": "Password changed", "other_sessions_revoked": n}


# ── Local development sign-in ────────────────────────────────────────────────

class DevLoginIn(BaseModel):
    email: EmailStr


def _dev_allowed(request: Request) -> None:
    """Exists only with TERMINAL_DEV_LOGIN=true outside production, and only for
    requests from this machine. Otherwise the route is indistinguishable from
    one that does not exist."""
    s = get_settings()
    ip = request.client.host if request.client else ""
    if not s.dev_login or s.env == "production" or ip not in ("127.0.0.1", "::1", "localhost", "testclient"):
        raise HTTPException(404, "Not Found")


@router.get("/dev-login", include_in_schema=False)
def dev_login_options(request: Request, db: Session = Depends(get_db)):
    _dev_allowed(request)
    rows = db.execute(select(User).where(User.status == "active").order_by(User.role, User.email)).scalars()
    return {"enabled": True, "users": [{"email": u.email, "full_name": u.full_name, "role": u.role,
                                        "organisation": u.organisation.name} for u in rows]}


@router.post("/dev-login", include_in_schema=False)
def dev_login(body: DevLoginIn, request: Request, response: Response, db: Session = Depends(get_db)):
    _dev_allowed(request)
    user = db.execute(select(User).where(func.lower(User.email) == body.email.lower())).scalar_one_or_none()
    if not user or user.status != "active":
        raise HTTPException(404, "No active user with this email")
    sess, token = security.create_session(db, user, security.client_ip(request), request.headers.get("user-agent"))
    _set_cookie(response, token)
    p = Principal(user.id, user.email, user.full_name, user.role, user.organisation_id, user.organisation.org_type,
                  user.organisation.name, user.organisation.company_id, sess.id, security.client_ip(request))
    audit.record(db, p, "auth.dev_login", entity_type="user", entity_id=user.id,
                 detail={"note": "development one-click sign-in"})
    return {"access_token": token, "token_type": "bearer", **me_payload(db, p)}
