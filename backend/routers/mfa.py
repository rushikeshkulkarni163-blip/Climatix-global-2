"""
Climactix — MFA router.

Endpoints:
  POST /mfa/setup    Generate TOTP secret + QR code (requires auth, MFA not yet enabled)
  POST /mfa/enable   Verify first TOTP code → save encrypted secret → enable MFA
  POST /mfa/disable  Verify TOTP code + password → disable MFA
  POST /mfa/verify   Complete login for MFA-challenged users (consumes mfa_challenge token)
  GET  /mfa/status   Return whether MFA is enabled for the current user
"""

import json
import os
from typing import Optional

import redis.asyncio as aioredis
from fastapi import APIRouter, Cookie, HTTPException, Request, Response, status
from pydantic import BaseModel

import database as db
import services.auth_service as auth
import services.mfa_service as mfa
from routers.auth import (
    client_ip,
    get_redis,
    issue_tokens,
    set_csrf_cookie,
    user_payload,
)

router = APIRouter(prefix="/mfa", tags=["mfa"])

MFA_CHALLENGE_TTL = 300  # 5 minutes


# ── Require authenticated user from cookie ────────────────────────────────────

async def _current_user(cx_access: Optional[str], cx_refresh: Optional[str], request: Request, response: Response):
    pool = await db.get_pool()
    if cx_access:
        payload = auth.decode_access_token(cx_access)
        if payload:
            user = await auth.get_user_by_id(pool, payload["sub"])
            if user and user["status"] == "active":
                return user, payload.get("sid", ""), pool
    if cx_refresh:
        rt_row = await auth.consume_refresh_token(pool, cx_refresh)
        if rt_row:
            user = await auth.get_user_by_id(pool, rt_row["user_id"])
            if user and user["status"] == "active":
                await auth.revoke_session(pool, rt_row["session_id"], "refresh")
                await issue_tokens(
                    response, pool, user,
                    client_ip(request),
                    request.headers.get("user-agent", ""),
                    remember=rt_row.get("remember_me", False),
                )
                return user, None, pool
    raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated.")


# ── Models ────────────────────────────────────────────────────────────────────

class EnableMfaRequest(BaseModel):
    code: str
    secret: str  # The pending secret returned by /mfa/setup


class DisableMfaRequest(BaseModel):
    code: str
    password: str


class MfaVerifyRequest(BaseModel):
    mfa_token: str
    code: str


# ── GET /mfa/status ───────────────────────────────────────────────────────────

@router.get("/status")
async def mfa_status(
    request: Request,
    response: Response,
    cx_access: Optional[str] = Cookie(default=None),
    cx_refresh: Optional[str] = Cookie(default=None),
):
    user, _, _ = await _current_user(cx_access, cx_refresh, request, response)
    return {"mfa_enabled": bool(user.get("mfa_enabled"))}


# ── POST /mfa/setup ───────────────────────────────────────────────────────────

@router.post("/setup")
async def mfa_setup(
    request: Request,
    response: Response,
    cx_access: Optional[str] = Cookie(default=None),
    cx_refresh: Optional[str] = Cookie(default=None),
):
    user, _, _ = await _current_user(cx_access, cx_refresh, request, response)

    if user.get("mfa_enabled"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "MFA is already enabled.")

    secret = mfa.generate_totp_secret()
    uri = mfa.get_totp_provisioning_uri(secret, user["email"])
    qr_data_url = mfa.generate_qr_data_url(uri)

    # Return the plain secret for the frontend to send back during /mfa/enable.
    # The secret is NOT stored in DB yet — only committed on successful first verify.
    return {
        "secret": secret,
        "qr_code": qr_data_url,
        "manual_entry_key": secret,
        "issuer": mfa.ISSUER,
    }


# ── POST /mfa/enable ──────────────────────────────────────────────────────────

@router.post("/enable")
async def mfa_enable(
    req: EnableMfaRequest,
    request: Request,
    response: Response,
    cx_access: Optional[str] = Cookie(default=None),
    cx_refresh: Optional[str] = Cookie(default=None),
):
    user, _, pool = await _current_user(cx_access, cx_refresh, request, response)

    if user.get("mfa_enabled"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "MFA is already enabled.")

    # Validate the TOTP code against the provided secret before saving
    if not mfa.verify_totp_code(req.secret, req.code):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail={
            "code": "invalid-totp",
            "message": "Invalid verification code. Check your authenticator app and try again.",
        })

    encrypted = mfa.encrypt_secret(req.secret)
    await pool.execute(
        """
        UPDATE auth_users
        SET mfa_enabled = TRUE, totp_secret_enc = $2, updated_at = NOW()
        WHERE id = $1
        """,
        user["id"],
        encrypted,
    )

    await auth.audit(
        pool, "mfa.enabled", "success",
        actor_id=user["id"], actor_email=user["email"],
        ip=client_ip(request),
    )

    return {"message": "MFA enabled successfully."}


# ── POST /mfa/disable ─────────────────────────────────────────────────────────

@router.post("/disable")
async def mfa_disable(
    req: DisableMfaRequest,
    request: Request,
    response: Response,
    cx_access: Optional[str] = Cookie(default=None),
    cx_refresh: Optional[str] = Cookie(default=None),
):
    user, _, pool = await _current_user(cx_access, cx_refresh, request, response)

    if not user.get("mfa_enabled"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "MFA is not enabled.")

    # Require password re-verification
    if not auth.verify_password(user.get("password_hash") or "", req.password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail={
            "code": "invalid-credentials",
            "message": "Incorrect password.",
        })

    # Require valid TOTP code
    secret = mfa.decrypt_secret(user.get("totp_secret_enc") or "")
    if not secret or not mfa.verify_totp_code(secret, req.code):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail={
            "code": "invalid-totp",
            "message": "Invalid authenticator code.",
        })

    await pool.execute(
        """
        UPDATE auth_users
        SET mfa_enabled = FALSE, totp_secret_enc = NULL, updated_at = NOW()
        WHERE id = $1
        """,
        user["id"],
    )

    await auth.audit(
        pool, "mfa.disabled", "success",
        actor_id=user["id"], actor_email=user["email"],
        ip=client_ip(request),
    )

    return {"message": "MFA disabled."}


# ── POST /mfa/verify ──────────────────────────────────────────────────────────
# Called from mfa-challenge.html after the login MFA challenge.

@router.post("/verify")
async def mfa_verify(req: MfaVerifyRequest, request: Request, response: Response):
    r = await get_redis()
    redis_key = f"mfa_challenge:{req.mfa_token}"
    raw = await r.get(redis_key)

    if not raw:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail={
            "code": "mfa-token-expired",
            "message": "MFA session expired. Please sign in again.",
        })

    try:
        challenge = json.loads(raw)
    except Exception:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid MFA session.")

    pool = await db.get_pool()
    user = await auth.get_user_by_id(pool, challenge["user_id"])
    if not user or user["status"] != "active":
        await r.delete(redis_key)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account not found.")

    secret = mfa.decrypt_secret(user.get("totp_secret_enc") or "")
    if not secret or not mfa.verify_totp_code(secret, req.code):
        # Increment failure counter in Redis (prevent brute force on MFA)
        fail_key = f"mfa_fail:{req.mfa_token}"
        fails = await r.incr(fail_key)
        await r.expire(fail_key, MFA_CHALLENGE_TTL)
        if int(fails) >= 5:
            await r.delete(redis_key)
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail={
                "code": "mfa-locked",
                "message": "Too many incorrect codes. Please sign in again.",
            })
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail={
            "code": "invalid-totp",
            "message": "Incorrect verification code.",
        })

    # MFA passed — consume the challenge token and issue full session
    await r.delete(redis_key)
    remember = challenge.get("remember", False)
    ip = client_ip(request)

    await issue_tokens(
        response, pool, user, ip,
        request.headers.get("user-agent", ""),
        remember=remember,
    )
    set_csrf_cookie(response)

    await auth.audit(
        pool, "mfa.verified", "success",
        actor_id=user["id"], actor_email=user["email"], ip=ip,
    )

    return {"user": user_payload(user)}
