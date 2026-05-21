"""
Climactix — API Key management router.

Endpoints:
  GET    /api-keys          List all active API keys for current user
  POST   /api-keys          Create a new API key (returns raw key once)
  DELETE /api-keys/{key_id} Revoke an API key
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Cookie, HTTPException, Request, Response, status
from pydantic import BaseModel

import database as db
import services.auth_service as auth
from routers.auth import client_ip, issue_tokens, user_payload

router = APIRouter(prefix="/api-keys", tags=["api-keys"])

AVAILABLE_PERMISSIONS = [
    "terminal.read",
    "assessment.read",
    "assessment.write",
    "reports.read",
    "reports.export",
    "regulatory.read",
    "simulation.read",
    "community.read",
]


# ── Auth dependency ───────────────────────────────────────────────────────────

async def _require_user(cx_access, cx_refresh, request, response):
    pool = await db.get_pool()
    if cx_access:
        payload = auth.decode_access_token(cx_access)
        if payload:
            user = await auth.get_user_by_id(pool, payload["sub"])
            if user and user["status"] == "active":
                return user, pool
    if cx_refresh:
        rt = await auth.consume_refresh_token(pool, cx_refresh)
        if rt:
            user = await auth.get_user_by_id(pool, rt["user_id"])
            if user and user["status"] == "active":
                await auth.revoke_session(pool, rt["session_id"], "refresh")
                await issue_tokens(
                    response, pool, user,
                    client_ip(request),
                    request.headers.get("user-agent", ""),
                    remember=rt.get("remember_me", False),
                )
                return user, pool
    raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated.")


# ── Models ────────────────────────────────────────────────────────────────────

class CreateApiKeyRequest(BaseModel):
    name: str
    permissions: list[str] = []


# ── GET /api-keys ─────────────────────────────────────────────────────────────

@router.get("")
async def list_api_keys(
    request: Request,
    response: Response,
    cx_access: Optional[str] = Cookie(default=None),
    cx_refresh: Optional[str] = Cookie(default=None),
):
    user, pool = await _require_user(cx_access, cx_refresh, request, response)

    rows = await pool.fetch(
        """
        SELECT id, key_prefix, name, permissions, last_used_at, created_at, expires_at
        FROM auth_api_keys
        WHERE user_id = $1 AND revoked_at IS NULL
        ORDER BY created_at DESC
        """,
        user["id"],
    )

    return {
        "keys": [
            {
                "id": r["id"],
                "prefix": r["key_prefix"],
                "name": r["name"],
                "permissions": list(r["permissions"] or []),
                "last_used_at": r["last_used_at"].isoformat() if r["last_used_at"] else None,
                "created_at": r["created_at"].isoformat(),
                "expires_at": r["expires_at"].isoformat() if r["expires_at"] else None,
            }
            for r in rows
        ]
    }


# ── POST /api-keys ────────────────────────────────────────────────────────────

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_api_key(
    req: CreateApiKeyRequest,
    request: Request,
    response: Response,
    cx_access: Optional[str] = Cookie(default=None),
    cx_refresh: Optional[str] = Cookie(default=None),
):
    user, pool = await _require_user(cx_access, cx_refresh, request, response)

    # Validate name
    if not req.name.strip():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Key name is required.")
    if len(req.name) > 64:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Key name must be 64 characters or fewer.")

    # Validate permissions
    invalid = [p for p in req.permissions if p not in AVAILABLE_PERMISSIONS]
    if invalid:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Unknown permissions: {', '.join(invalid)}",
        )

    # Generate key: cx_live_{24 random bytes base64url} = ~44 char suffix
    raw_token = auth.generate_opaque_token(24)
    full_key = f"cx_live_{raw_token}"
    key_hash = auth.sha256_hex(full_key)
    key_prefix = full_key[:16]  # "cx_live_XXXXXXXX"

    # Enforce per-user limit: max 10 active keys
    count = await pool.fetchval(
        "SELECT COUNT(*) FROM auth_api_keys WHERE user_id = $1 AND revoked_at IS NULL",
        user["id"],
    )
    if int(count) >= 10:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Maximum of 10 active API keys reached. Revoke an existing key first.",
        )

    await pool.execute(
        """
        INSERT INTO auth_api_keys
          (key_hash, key_prefix, user_id, name, permissions)
        VALUES ($1, $2, $3, $4, $5)
        """,
        key_hash,
        key_prefix,
        user["id"],
        req.name.strip(),
        req.permissions or [],
    )

    await auth.audit(
        pool, "api_key.created", "success",
        actor_id=user["id"], actor_email=user["email"],
        ip=client_ip(request),
        metadata={"key_prefix": key_prefix, "name": req.name},
    )

    return {
        "key": full_key,  # Shown ONCE — never retrievable again
        "prefix": key_prefix,
        "name": req.name.strip(),
        "permissions": req.permissions,
        "warning": "Store this key securely. It will not be shown again.",
    }


# ── DELETE /api-keys/{key_id} ─────────────────────────────────────────────────

@router.delete("/{key_id}", status_code=status.HTTP_200_OK)
async def revoke_api_key(
    key_id: str,
    request: Request,
    response: Response,
    cx_access: Optional[str] = Cookie(default=None),
    cx_refresh: Optional[str] = Cookie(default=None),
):
    user, pool = await _require_user(cx_access, cx_refresh, request, response)

    result = await pool.execute(
        """
        UPDATE auth_api_keys
        SET revoked_at = NOW()
        WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
        """,
        key_id,
        user["id"],
    )

    if result == "UPDATE 0":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "API key not found.")

    await auth.audit(
        pool, "api_key.revoked", "success",
        actor_id=user["id"], actor_email=user["email"],
        ip=client_ip(request),
        metadata={"key_id": key_id},
    )

    return {"message": "API key revoked."}


# ── GET /api-keys/permissions ─────────────────────────────────────────────────

@router.get("/permissions")
async def list_permissions():
    return {"permissions": AVAILABLE_PERMISSIONS}
