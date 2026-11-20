"""
Authentication, sessions, role permissions, organisation isolation and
subscription entitlements.

Three independent gates apply to a request, in this order:

  1. Role permission   — may this role perform this kind of action at all?
  2. Organisation scope — is the object public, or owned by the caller's
                          organisation? (`can_see_private_company`, portfolio
                          ownership checks). Internal staff are scoped by role.
  3. Entitlement       — does the organisation hold an active subscription
                          that includes the feature?

Access tokens are JWTs that carry only a session id; the session row is
checked on every request, so revoking a session or disabling a user takes
effect immediately.
"""

from __future__ import annotations

import hashlib
import re
import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError
from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import get_settings
from .db import get_db
from .models import AuthSession, AuthToken, Organisation, Subscription, User, utcnow

_ph = PasswordHasher()

INTERNAL_ROLES = frozenset({"super_admin", "data_analyst", "assessment_reviewer"})
INSTITUTIONAL_ROLES = frozenset({"bank_user", "insurance_user", "investor_user"})
ROLE_ORG_TYPE = {
    "super_admin": "climactix", "data_analyst": "climactix", "assessment_reviewer": "climactix",
    "company_admin": "company", "bank_user": "bank", "insurance_user": "insurance",
    "investor_user": "investor", "government_user": "government",
}

_ALL = frozenset(ROLE_ORG_TYPE)
PERMISSIONS: dict[str, frozenset[str]] = {
    # company records
    "company.read": _ALL,
    "company.manage": frozenset({"super_admin", "data_analyst"}),
    "company.merge": frozenset({"super_admin"}),
    # documents and ingestion
    "document.read": _ALL,
    "document.ingest_public": frozenset({"super_admin", "data_analyst"}),
    "document.submit_company": frozenset({"company_admin"}),
    "ingestion.manage": frozenset({"super_admin", "data_analyst"}),
    # extraction review
    "review.read": INTERNAL_ROLES,
    "review.decide": INTERNAL_ROLES,
    # assessment
    "assessment.submit": frozenset({"company_admin"}),
    "assessment.review": frozenset({"super_admin", "assessment_reviewer"}),
    "correction.request": frozenset({"company_admin"}),
    "correction.decide": frozenset({"super_admin", "data_analyst", "assessment_reviewer"}),
    # scoring
    "score.compute": INTERNAL_ROLES,
    "methodology.read": _ALL,
    "methodology.manage": frozenset({"super_admin"}),
    # institutional workspace
    "portfolio.manage": INSTITUTIONAL_ROLES,
    "sector.aggregate": _ALL - {"company_admin"},
    "report.generate": _ALL - {"government_user"},
    # administration
    "admin.dashboard": INTERNAL_ROLES,
    "admin.users": frozenset({"super_admin"}),
    "admin.organisations": frozenset({"super_admin"}),
    "admin.subscriptions": frozenset({"super_admin"}),
    "admin.sectors": frozenset({"super_admin", "data_analyst"}),
    "audit.read": frozenset({"super_admin"}),
}

# Features a subscription can carry. Internal staff are not subscription-gated.
ENTITLEMENTS = ("company_profile", "report_hosting", "assessment_workflow", "enhanced_analytics",
                "company_intelligence", "comparison", "portfolio", "sector_benchmark", "net_zero_intelligence",
                "report_download", "sector_aggregates", "disclosure_coverage", "api_access", "bulk_export")

PLAN_ENTITLEMENTS: dict[tuple[str, str], list[str]] = {
    ("company_annual", "company"): ["company_profile", "report_hosting", "assessment_workflow",
                                    "enhanced_analytics", "report_download"],
    ("institutional_pilot", "bank"): ["company_intelligence", "comparison", "portfolio", "sector_benchmark",
                                      "net_zero_intelligence", "report_download"],
    ("institutional_pilot", "investor"): ["company_intelligence", "comparison", "portfolio", "sector_benchmark",
                                          "net_zero_intelligence", "report_download"],
    ("institutional_enterprise", "bank"): ["company_intelligence", "comparison", "portfolio", "sector_benchmark",
                                           "net_zero_intelligence", "report_download", "api_access", "bulk_export"],
    ("institutional_enterprise", "investor"): ["company_intelligence", "comparison", "portfolio", "sector_benchmark",
                                               "net_zero_intelligence", "report_download", "api_access", "bulk_export"],
    ("institutional_enterprise", "insurance"): ["company_intelligence", "comparison", "portfolio", "sector_benchmark",
                                                "net_zero_intelligence", "report_download", "api_access"],
    ("institutional_enterprise", "government"): ["sector_aggregates", "disclosure_coverage"],
    ("institutional_pilot", "government"): ["sector_aggregates", "disclosure_coverage"],
    ("institutional_pilot", "insurance"): ["company_intelligence", "comparison", "portfolio", "sector_benchmark",
                                           "net_zero_intelligence", "report_download"],
}
PILOT_MONTHS = 6


# ── Passwords and tokens ─────────────────────────────────────────────────────

def validate_password(pw: str) -> None:
    problems = []
    if len(pw) < 12:
        problems.append("at least 12 characters")
    if not re.search(r"[A-Za-z]", pw) or not re.search(r"\d", pw):
        problems.append("letters and digits")
    if len(pw) > 200:
        problems.append("at most 200 characters")
    if problems:
        raise HTTPException(422, "Password must contain " + " and ".join(problems))


def hash_password(pw: str) -> str:
    return _ph.hash(pw)


def verify_password(pw: str, hashed: Optional[str]) -> bool:
    if not hashed:
        return False
    try:
        return _ph.verify(hashed, pw)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def issue_token(db: Session, user: User, purpose: str, hours: int) -> str:
    """Create a single-use token; only its hash is stored. Earlier unused
    tokens of the same purpose are invalidated."""
    now = utcnow()
    for t in db.execute(select(AuthToken).where(AuthToken.user_id == user.id, AuthToken.purpose == purpose,
                                                AuthToken.used_at.is_(None))).scalars():
        t.used_at = now
    raw = secrets.token_urlsafe(32)
    db.add(AuthToken(user_id=user.id, purpose=purpose, token_hash=_hash_token(raw),
                     expires_at=now + timedelta(hours=hours)))
    db.flush()
    return raw


def consume_token(db: Session, raw: str, purpose: str) -> User:
    t = db.execute(select(AuthToken).where(AuthToken.token_hash == _hash_token(raw),
                                           AuthToken.purpose == purpose).with_for_update()).scalar_one_or_none()
    if not t or t.used_at is not None or t.expires_at < utcnow():
        raise HTTPException(400, "This link is invalid or has expired")
    t.used_at = utcnow()
    user = db.get(User, t.user_id)
    if not user or user.status == "disabled":
        raise HTTPException(400, "This link is invalid or has expired")
    return user


# ── Sessions ─────────────────────────────────────────────────────────────────

def create_session(db: Session, user: User, ip: Optional[str], user_agent: Optional[str]) -> tuple[AuthSession, str]:
    s = get_settings()
    sess = AuthSession(user_id=user.id, expires_at=utcnow() + timedelta(hours=s.session_hours),
                       ip=ip, user_agent=(user_agent or "")[:400])
    db.add(sess)
    db.flush()
    return sess, encode_access_token(sess)


def encode_access_token(sess: AuthSession) -> str:
    s = get_settings()
    now = datetime.now(timezone.utc)
    exp = min(now + timedelta(minutes=s.access_token_minutes), sess.expires_at)
    return jwt.encode({"iss": s.jwt_issuer, "sub": str(sess.user_id), "sid": str(sess.id),
                       "iat": int(now.timestamp()), "exp": int(exp.timestamp())}, s.jwt_secret, algorithm="HS256")


def revoke_user_sessions(db: Session, user_id: uuid.UUID, except_session: Optional[uuid.UUID] = None) -> int:
    n = 0
    for sess in db.execute(select(AuthSession).where(AuthSession.user_id == user_id,
                                                     AuthSession.revoked_at.is_(None))).scalars():
        if sess.id != except_session:
            sess.revoked_at = utcnow()
            n += 1
    return n


# ── Principal ────────────────────────────────────────────────────────────────

@dataclass
class Principal:
    user_id: uuid.UUID
    email: str
    full_name: str
    role: str
    org_id: uuid.UUID
    org_type: str
    org_name: str
    company_id: Optional[uuid.UUID]      # for company organisations
    session_id: uuid.UUID
    ip: Optional[str] = None
    refreshed_token: Optional[str] = None

    @property
    def is_internal(self) -> bool:
        return self.role in INTERNAL_ROLES

    def can(self, permission: str) -> bool:
        return self.role in PERMISSIONS[permission]

    def can_see_private_company(self, company_id: uuid.UUID) -> bool:
        """Private company material (submissions, private documents, the
        Company Assessment Score before sharing): the company itself and
        Climactix staff only."""
        return self.is_internal or (self.role == "company_admin" and self.company_id == company_id)


def client_ip(request: Request) -> Optional[str]:
    fwd = request.headers.get("x-forwarded-for")
    if fwd and get_settings().env == "production":
        return fwd.split(",")[0].strip()[:64]
    return request.client.host if request.client else None


def _unauthorised(msg: str = "Authentication required") -> HTTPException:
    return HTTPException(401, msg, headers={"WWW-Authenticate": "Bearer"})


def current_principal(request: Request, db: Session = Depends(get_db)) -> Principal:
    s = get_settings()
    token, via_cookie = None, False
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        token = auth[7:].strip()
    elif request.cookies.get(s.cookie_name):
        token, via_cookie = request.cookies[s.cookie_name], True
    if not token:
        raise _unauthorised()
    # Cookie-authenticated state changes must carry a header a cross-site form cannot set.
    if via_cookie and request.method not in ("GET", "HEAD", "OPTIONS") \
            and request.headers.get("x-requested-with") != "cxt":
        raise HTTPException(403, "Missing X-Requested-With header")

    refreshed = None
    try:
        claims = jwt.decode(token, s.jwt_secret, algorithms=["HS256"], issuer=s.jwt_issuer)
    except jwt.ExpiredSignatureError:
        # The access token is short-lived; the session behind a cookie may still be valid.
        if not via_cookie:
            raise _unauthorised("Access token expired")
        try:
            claims = jwt.decode(token, s.jwt_secret, algorithms=["HS256"], issuer=s.jwt_issuer,
                                options={"verify_exp": False})
        except jwt.PyJWTError:
            raise _unauthorised()
        refreshed = True
    except jwt.PyJWTError:
        raise _unauthorised()

    try:
        sid = uuid.UUID(claims["sid"])
    except (KeyError, ValueError):
        raise _unauthorised()
    sess = db.get(AuthSession, sid)
    now = utcnow()
    if not sess or sess.revoked_at is not None or sess.expires_at < now:
        raise _unauthorised("Session expired")
    user = db.get(User, sess.user_id)
    if not user or user.status != "active":
        raise _unauthorised("Account is not active")
    org = user.organisation
    if org.status != "active":
        raise HTTPException(403, "Organisation account is suspended")
    if (now - sess.last_seen_at).total_seconds() > 60:
        sess.last_seen_at = now
    p = Principal(user_id=user.id, email=user.email, full_name=user.full_name, role=user.role, org_id=org.id,
                  org_type=org.org_type, org_name=org.name, company_id=org.company_id, session_id=sess.id,
                  ip=client_ip(request))
    if refreshed:
        p.refreshed_token = encode_access_token(sess)
    request.state.principal = p
    return p


def require(permission: str):
    """Dependency factory: authenticated AND role holds `permission`."""
    def dep(p: Principal = Depends(current_principal)) -> Principal:
        if not p.can(permission):
            raise HTTPException(403, f"Your role does not permit this action ({permission})")
        return p
    return dep


# ── Subscriptions and entitlements ───────────────────────────────────────────

def active_subscription(db: Session, org_id: uuid.UUID) -> Optional[Subscription]:
    now = utcnow()
    rows = db.execute(select(Subscription).where(Subscription.organisation_id == org_id,
                                                 Subscription.status == "active",
                                                 Subscription.starts_at <= now)
                      .order_by(Subscription.starts_at.desc())).scalars().all()
    for sub in rows:
        if sub.ends_at is None or sub.ends_at > now:
            return sub
    return None


def entitlements_for(db: Session, p: Principal) -> list[str]:
    if p.is_internal:
        return list(ENTITLEMENTS)
    sub = active_subscription(db, p.org_id)
    return list(sub.entitlements) if sub else []


def require_entitlement(db: Session, p: Principal, feature: str) -> None:
    if p.is_internal:
        return
    if feature not in entitlements_for(db, p):
        sub = active_subscription(db, p.org_id)
        reason = ("Your organisation has no active subscription" if not sub
                  else f"Your organisation's {sub.plan.replace('_', ' ')} plan does not include this feature")
        raise HTTPException(402, f"{reason} ({feature}). Contact Climactix to arrange access.")


def expire_subscriptions(db: Session) -> int:
    """Mark lapsed subscriptions as expired. Run by the worker's maintenance job."""
    now, n = utcnow(), 0
    for sub in db.execute(select(Subscription).where(Subscription.status == "active",
                                                     Subscription.ends_at.is_not(None),
                                                     Subscription.ends_at <= now)).scalars():
        sub.status = "expired"
        n += 1
    return n


def default_entitlements(plan: str, org: Organisation) -> list[str]:
    if plan == "internal":
        return list(ENTITLEMENTS)
    try:
        return list(PLAN_ENTITLEMENTS[(plan, org.org_type)])
    except KeyError:
        raise HTTPException(422, f"Plan '{plan}' is not available to {org.org_type} organisations")
