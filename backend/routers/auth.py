"""
Climactix — Auth router.

Endpoints:
  POST /auth/register         Create account (202 + verify_token in DEV_MODE)
  POST /auth/verify-email     Verify email, issue tokens, set cookies
  POST /auth/login            Authenticate, issue tokens, set cookies (or MFA challenge)
  POST /auth/logout           Revoke session, clear cookies
  GET  /auth/me               Return current user (auto-refreshes access token)
  POST /auth/refresh          Explicit token refresh
  POST /auth/forgot-password  Request password reset (reset_token in DEV_MODE)
  POST /auth/reset-password   Execute reset, revoke all sessions, issue tokens
  GET  /auth/sessions         List active sessions for current user
  DELETE /auth/sessions/{sid} Revoke a specific session
"""

import json
import os
from datetime import datetime, timezone
from typing import Optional

import httpx
import redis.asyncio as aioredis
from fastapi import APIRouter, Cookie, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr

import database as db
import services.auth_service as auth

MFA_CHALLENGE_TTL = 300  # 5 minutes — shared with mfa router

# ── Config ────────────────────────────────────────────────────────────────────

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
IS_PRODUCTION = os.getenv("ENVIRONMENT", "development") == "production"
COOKIE_SECURE = IS_PRODUCTION
COOKIE_SAMESITE = "lax"

_redis: Optional[aioredis.Redis] = None


async def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = await aioredis.from_url(REDIS_URL, decode_responses=True)
    return _redis


# ── Rate limiting ─────────────────────────────────────────────────────────────

async def check_rate_limit(key: str, limit: int, window: int) -> bool:
    """Returns True if the request is within the allowed limit."""
    try:
        r = await get_redis()
        pipe = r.pipeline()
        pipe.incr(key)
        pipe.expire(key, window)
        count, _ = await pipe.execute()
        return int(count) <= limit
    except Exception:
        return True  # Fail open: never block due to Redis being unavailable


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# ── Cookie helpers ────────────────────────────────────────────────────────────

def set_auth_cookies(
    response: Response,
    access_token: str,
    refresh_token: str,
    remember: bool,
) -> None:
    max_age_rt = (
        auth.REFRESH_REMEMBER_TTL_DAYS if remember else auth.REFRESH_TTL_DAYS
    ) * 86400

    response.set_cookie(
        key="cx_access",
        value=access_token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        max_age=auth.ACCESS_TTL_MINUTES * 60,
        path="/",
    )
    response.set_cookie(
        key="cx_refresh",
        value=refresh_token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        max_age=max_age_rt,
        path="/auth/refresh",
    )


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie("cx_access", path="/")
    response.delete_cookie("cx_refresh", path="/auth/refresh")
    response.delete_cookie("cx_csrf", path="/")


def set_csrf_cookie(response: Response) -> str:
    """Set a readable (non-HttpOnly) CSRF token cookie. Returns the token value."""
    token = auth.generate_opaque_token(32)
    response.set_cookie(
        key="cx_csrf",
        value=token,
        httponly=False,  # Must be readable by JavaScript for double-submit pattern
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        max_age=3600,
        path="/",
    )
    return token


# ── IP geolocation (best-effort, non-blocking) ────────────────────────────────

async def get_ip_geo(ip: str) -> dict:
    if ip in ("localhost", "127.0.0.1", "::1", "unknown"):
        return {"country": "LOCAL", "countryCode": "XX", "city": "localhost"}
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            r = await client.get(
                f"http://ip-api.com/json/{ip}?fields=status,country,countryCode,city,isp"
            )
            if r.status_code == 200:
                data = r.json()
                if data.get("status") == "success":
                    return data
    except Exception:
        pass
    return {}


# ── Device fingerprint recording ──────────────────────────────────────────────

async def record_device(pool, user_id: str, fingerprint: str, ip: str) -> None:
    if not fingerprint or fingerprint == "unknown":
        return
    try:
        await pool.execute(
            """
            INSERT INTO auth_devices (user_id, fingerprint, last_seen_ip, last_seen_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (user_id, fingerprint)
            DO UPDATE SET last_seen_ip = $3, last_seen_at = NOW()
            """,
            user_id,
            fingerprint,
            ip,
        )
    except Exception:
        pass


# ── User payload ──────────────────────────────────────────────────────────────

def user_payload(user: dict) -> dict:
    return {
        "id": user["id"],
        "email": user["email"],
        "full_name": user["full_name"],
        "company_name": user["company_name"],
        "role": user["role"],
        "tier": user["tier"],
        "status": user["status"],
    }


# ── Issue tokens helper ───────────────────────────────────────────────────────

async def issue_tokens(
    response: Response,
    pool,
    user: dict,
    ip: str,
    user_agent: str,
    remember: bool,
) -> None:
    session_id = await auth.create_session(pool, user["id"], ip, user_agent, remember)
    access_token = auth.create_access_token(
        user["id"], user["email"], user["role"], user["tier"], session_id
    )
    refresh_token = await auth.create_refresh_token(pool, user["id"], session_id, remember)
    set_auth_cookies(response, access_token, refresh_token, remember)
    set_csrf_cookie(response)


# ── Router ────────────────────────────────────────────────────────────────────

router = APIRouter(prefix="/auth", tags=["auth"])


# ── Models ────────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    full_name: str
    email: EmailStr
    company_name: str = ""
    password: str


class VerifyEmailRequest(BaseModel):
    email: str
    token: str


class LoginRequest(BaseModel):
    email: str
    password: str
    remember: bool = False
    device_fingerprint: str = "unknown"


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    email: str
    token: str
    new_password: str


# ── POST /auth/register ───────────────────────────────────────────────────────

@router.post("/register", status_code=status.HTTP_202_ACCEPTED)
async def register(req: RegisterRequest, request: Request):
    ip = client_ip(request)

    # Rate limit: 5 registrations per IP per hour
    if not await check_rate_limit(f"rl:register:{ip}", 5, 3600):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many requests. Try again later.")

    # Password policy
    policy_err = auth.validate_password_policy(req.password)
    if policy_err:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, policy_err)

    pool = await db.get_pool()

    # Duplicate check
    existing = await auth.get_user_by_email(pool, req.email)
    if existing:
        # Don't reveal which emails are registered — same 202 response
        # But in dev mode, we return the existing user's verify token if pending
        if auth.DEV_MODE and existing["status"] == "pending":
            verify_token = await auth.create_email_token(
                pool, existing["id"], "verify_email", auth.email_verify_expiry()
            )
            return {
                "message": "Verification email sent.",
                **({"verify_token": verify_token, "user_id": existing["id"]} if auth.DEV_MODE else {}),
            }
        return {"message": "If that email is available, a verification link has been sent."}

    # Create user
    password_hash = auth.hash_password(req.password)
    user = await auth.create_user(
        pool,
        full_name=req.full_name,
        email=req.email,
        company_name=req.company_name,
        password_hash=password_hash,
    )

    # Generate verification token
    verify_token = await auth.create_email_token(
        pool, user["id"], "verify_email", auth.email_verify_expiry()
    )

    # Audit
    await auth.audit(
        pool,
        "auth.register",
        "success",
        actor_id=user["id"],
        actor_email=user["email"],
        ip=ip,
        user_agent=request.headers.get("user-agent"),
    )

    # In dev mode: return the raw token so the frontend "Verify Now" button works.
    # In production: send email here (add SMTP integration).
    response_body: dict = {"message": "Account created. Check your email to verify."}
    if auth.DEV_MODE:
        response_body["verify_token"] = verify_token
        response_body["user_id"] = user["id"]
        print(
            f"\n[DEV] Verification link: /verify-email.html?email={user['email']}&token={verify_token}\n"
        )

    return response_body


# ── POST /auth/verify-email ───────────────────────────────────────────────────

@router.post("/verify-email")
async def verify_email(req: VerifyEmailRequest, request: Request, response: Response):
    pool = await db.get_pool()
    ip = client_ip(request)

    user = await auth.get_user_by_email(pool, req.email)
    if not user:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail={
            "code": "invalid-token",
            "message": "Invalid or expired verification link.",
        })

    if user["status"] == "active":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail={
            "code": "already-verified",
            "message": "Email already verified. Please sign in.",
        })

    token_row = await auth.consume_email_token(pool, user["id"], req.token, "verify_email")
    if not token_row:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail={
            "code": "invalid-token",
            "message": "Invalid or expired verification link.",
        })

    await auth.activate_user(pool, user["id"])
    user["status"] = "active"

    await issue_tokens(
        response, pool, user, ip,
        request.headers.get("user-agent", ""),
        remember=False,
    )

    await auth.audit(
        pool, "auth.verify_email", "success",
        actor_id=user["id"], actor_email=user["email"], ip=ip,
    )

    return {"user": user_payload(user)}


# ── POST /auth/login ──────────────────────────────────────────────────────────

@router.post("/login")
async def login(req: LoginRequest, request: Request, response: Response):
    ip = client_ip(request)

    # Rate limit: 10 attempts per email per 15 minutes
    if not await check_rate_limit(f"rl:login:{req.email.lower()}", 10, 900):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, detail={
            "code": "rate-limited",
            "message": "Too many sign-in attempts. Please wait 15 minutes.",
        })

    # Rate limit: 20 attempts per IP per 15 minutes
    if not await check_rate_limit(f"rl:login_ip:{ip}", 20, 900):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, detail={
            "code": "rate-limited",
            "message": "Too many requests from this network.",
        })

    pool = await db.get_pool()
    user = await auth.get_user_by_email(pool, req.email)

    # Constant-time-equivalent: always verify even if user not found
    _dummy_hash = "$argon2id$v=19$m=65536,t=3,p=4$placeholder"
    if not user:
        # Prevent timing attack — hash the password anyway
        auth.verify_password(_dummy_hash, req.password)
        await auth.audit(
            pool, "auth.login", "failure",
            actor_email=req.email, ip=ip,
            metadata={"reason": "user_not_found"},
        )
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail={
            "code": "invalid-credentials",
            "message": "Incorrect email or password.",
        })

    # Check account lock
    if user["locked_until"] and user["locked_until"] > datetime.now(timezone.utc):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail={
            "code": "account-locked",
            "message": "Account temporarily locked due to failed attempts. Try again later.",
        })

    # Verify password
    if not auth.verify_password(user["password_hash"] or "", req.password):
        attempts = await auth.record_failed_login(pool, user["id"])
        await auth.audit(
            pool, "auth.login", "failure",
            actor_id=user["id"], actor_email=user["email"], ip=ip,
            metadata={"reason": "wrong_password", "attempts": attempts},
        )
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail={
            "code": "invalid-credentials",
            "message": "Incorrect email or password.",
        })

    # Check email verified
    if user["status"] == "pending":
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail={
            "code": "not-verified",
            "message": "Please verify your email before signing in.",
            "email": user["email"],
        })

    if user["status"] != "active":
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail={
            "code": "account-suspended",
            "message": "Account suspended. Contact support.",
        })

    await auth.clear_failed_logins(pool, user["id"], ip)

    # Record device fingerprint
    await record_device(pool, user["id"], req.device_fingerprint, ip)

    # IP geolocation (background — don't let it slow login)
    geo = await get_ip_geo(ip)

    # If MFA is enabled, issue a short-lived challenge token instead of full session
    if user.get("mfa_enabled"):
        r = await get_redis()
        mfa_token = auth.generate_opaque_token(32)
        await r.setex(
            f"mfa_challenge:{mfa_token}",
            MFA_CHALLENGE_TTL,
            json.dumps({
                "user_id": user["id"],
                "remember": req.remember,
            }),
        )
        await auth.audit(
            pool, "auth.login", "success",
            actor_id=user["id"], actor_email=user["email"], ip=ip,
            metadata={"mfa_required": True, "country": geo.get("countryCode", "")},
        )
        return {
            "mfa_required": True,
            "mfa_token": mfa_token,
            "email": user["email"],
        }

    await issue_tokens(
        response, pool, user, ip,
        request.headers.get("user-agent", ""),
        remember=req.remember,
    )

    await auth.audit(
        pool, "auth.login", "success",
        actor_id=user["id"], actor_email=user["email"], ip=ip,
        metadata={"country": geo.get("countryCode", "")},
    )

    return {"user": user_payload(user)}


# ── POST /auth/logout ─────────────────────────────────────────────────────────

@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    cx_access: Optional[str] = Cookie(default=None),
):
    clear_auth_cookies(response)

    if not cx_access:
        return {"message": "Signed out."}

    payload = auth.decode_access_token(cx_access)
    if not payload:
        return {"message": "Signed out."}

    pool = await db.get_pool()
    session_id = payload.get("sid")
    user_id = payload.get("sub")

    if session_id:
        await auth.revoke_session_refresh_tokens(pool, session_id)
        await auth.revoke_session(pool, session_id, "logout")

    await auth.audit(
        pool, "auth.logout", "success",
        actor_id=user_id,
        ip=client_ip(request),
    )

    return {"message": "Signed out."}


# ── GET /auth/me ──────────────────────────────────────────────────────────────

@router.get("/me")
async def get_me(
    request: Request,
    response: Response,
    cx_access: Optional[str] = Cookie(default=None),
    cx_refresh: Optional[str] = Cookie(default=None),
):
    pool = await db.get_pool()

    # Try access token first
    if cx_access:
        payload = auth.decode_access_token(cx_access)
        if payload:
            user = await auth.get_user_by_id(pool, payload["sub"])
            if user and user["status"] == "active":
                await auth.touch_session(pool, payload.get("sid", ""))
                return user_payload(user)

    # Access token missing or expired — try refresh token
    if cx_refresh:
        rt_row = await auth.consume_refresh_token(pool, cx_refresh)
        if rt_row:
            user = await auth.get_user_by_id(pool, rt_row["user_id"])
            if user and user["status"] == "active":
                # Revoke old session, create new one
                old_session = rt_row["session_id"]
                await auth.revoke_session(pool, old_session, "refresh")
                remember = rt_row.get("remember_me", False)
                await issue_tokens(
                    response, pool, user,
                    client_ip(request),
                    request.headers.get("user-agent", ""),
                    remember=remember,
                )
                return user_payload(user)

    raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail={
        "code": "unauthenticated",
        "message": "Not authenticated.",
    })


# ── POST /auth/refresh ────────────────────────────────────────────────────────

@router.post("/refresh")
async def refresh(
    request: Request,
    response: Response,
    cx_refresh: Optional[str] = Cookie(default=None),
):
    if not cx_refresh:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail={
            "code": "no-refresh-token",
            "message": "No refresh token.",
        })

    pool = await db.get_pool()
    rt_row = await auth.consume_refresh_token(pool, cx_refresh)
    if not rt_row:
        # Possible token reuse attack — clear cookies
        clear_auth_cookies(response)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail={
            "code": "invalid-refresh-token",
            "message": "Refresh token invalid or expired. Please sign in again.",
        })

    user = await auth.get_user_by_id(pool, rt_row["user_id"])
    if not user or user["status"] != "active":
        clear_auth_cookies(response)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail={
            "code": "unauthenticated",
            "message": "Session expired. Please sign in again.",
        })

    old_session = rt_row["session_id"]
    await auth.revoke_session(pool, old_session, "refresh")
    remember = rt_row.get("remember_me", False)

    await issue_tokens(
        response, pool, user,
        client_ip(request),
        request.headers.get("user-agent", ""),
        remember=remember,
    )

    return {"user": user_payload(user)}


# ── POST /auth/forgot-password ────────────────────────────────────────────────

@router.post("/forgot-password", status_code=status.HTTP_202_ACCEPTED)
async def forgot_password(req: ForgotPasswordRequest, request: Request):
    ip = client_ip(request)

    # Rate limit: 3 per email per hour, 10 per IP per hour
    if not await check_rate_limit(f"rl:forgot:{req.email.lower()}", 3, 3600):
        return {"message": "If that email is registered, a reset link has been sent."}
    if not await check_rate_limit(f"rl:forgot_ip:{ip}", 10, 3600):
        return {"message": "If that email is registered, a reset link has been sent."}

    pool = await db.get_pool()
    user = await auth.get_user_by_email(pool, req.email)

    if not user or user["status"] not in ("active", "pending"):
        # Always return 202 — never reveal if email exists
        return {"message": "If that email is registered, a reset link has been sent."}

    reset_token = await auth.create_email_token(
        pool, user["id"], "reset_password", auth.reset_token_expiry()
    )

    await auth.audit(
        pool, "auth.forgot_password", "success",
        actor_id=user["id"], actor_email=user["email"], ip=ip,
    )

    response_body: dict = {
        "message": "If that email is registered, a reset link has been sent."
    }
    if auth.DEV_MODE:
        response_body["reset_token"] = reset_token
        response_body["email"] = user["email"]
        print(
            f"\n[DEV] Reset link: /reset-password.html?email={user['email']}&token={reset_token}\n"
        )

    return response_body


# ── POST /auth/reset-password ─────────────────────────────────────────────────

@router.post("/reset-password")
async def reset_password(req: ResetPasswordRequest, request: Request, response: Response):
    ip = client_ip(request)

    # Rate limit: 5 attempts per IP per 15 minutes
    if not await check_rate_limit(f"rl:reset:{ip}", 5, 900):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, detail={
            "code": "rate-limited",
            "message": "Too many requests. Please wait.",
        })

    # Password policy
    policy_err = auth.validate_password_policy(req.new_password)
    if policy_err:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail={
            "code": "weak-password",
            "message": policy_err,
        })

    pool = await db.get_pool()
    user = await auth.get_user_by_email(pool, req.email)
    if not user:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail={
            "code": "invalid-token",
            "message": "Invalid or expired reset link.",
        })

    token_row = await auth.consume_email_token(pool, user["id"], req.token, "reset_password")
    if not token_row:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail={
            "code": "invalid-token",
            "message": "Invalid or expired reset link.",
        })

    new_hash = auth.hash_password(req.new_password)
    await auth.update_password(pool, user["id"], new_hash)

    # Revoke all active sessions and refresh tokens (security: force re-login everywhere)
    await auth.revoke_all_user_sessions(pool, user["id"], "password_reset")
    await auth.revoke_all_user_refresh_tokens(pool, user["id"])

    # Ensure user is active (covers case where reset used before email verify)
    if user["status"] == "pending":
        await auth.activate_user(pool, user["id"])
        user["status"] = "active"

    # Issue new tokens (auto-login after reset)
    await issue_tokens(
        response, pool, user, ip,
        request.headers.get("user-agent", ""),
        remember=False,
    )

    await auth.audit(
        pool, "auth.reset_password", "success",
        actor_id=user["id"], actor_email=user["email"], ip=ip,
    )

    return {"user": user_payload(user)}


# ── GET /auth/sessions ────────────────────────────────────────────────────────

@router.get("/sessions")
async def list_sessions(
    request: Request,
    cx_access: Optional[str] = Cookie(default=None),
):
    pool = await db.get_pool()
    if not cx_access:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated.")

    payload = auth.decode_access_token(cx_access)
    if not payload:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated.")

    user_id = payload.get("sub")
    current_sid = payload.get("sid")

    rows = await pool.fetch(
        """
        SELECT id, ip_address, user_agent, remember_me, created_at, last_active
        FROM auth_sessions
        WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
        ORDER BY last_active DESC
        """,
        user_id,
    )

    return {
        "sessions": [
            {
                "id": r["id"],
                "is_current": r["id"] == current_sid,
                "ip_address": r["ip_address"],
                "user_agent": r["user_agent"],
                "remember_me": r["remember_me"],
                "created_at": r["created_at"].isoformat(),
                "last_active": r["last_active"].isoformat(),
            }
            for r in rows
        ]
    }


# ── DELETE /auth/sessions/{session_id} ───────────────────────────────────────

@router.delete("/sessions/{session_id}")
async def revoke_session_endpoint(
    session_id: str,
    request: Request,
    cx_access: Optional[str] = Cookie(default=None),
):
    pool = await db.get_pool()
    if not cx_access:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated.")

    payload = auth.decode_access_token(cx_access)
    if not payload:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated.")

    user_id = payload.get("sub")
    result = await pool.execute(
        """
        UPDATE auth_sessions
        SET revoked_at = NOW(), revoke_reason = 'user_revoked'
        WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
        """,
        session_id,
        user_id,
    )
    if result == "UPDATE 0":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found.")

    await auth.revoke_session_refresh_tokens(pool, session_id)
    await auth.audit(
        pool, "auth.session_revoked", "success",
        actor_id=user_id, ip=client_ip(request),
        metadata={"revoked_session_id": session_id},
    )

    return {"message": "Session revoked."}
