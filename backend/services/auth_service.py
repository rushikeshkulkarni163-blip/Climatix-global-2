"""
Climactix — Auth service.
Handles: argon2id hashing, JWT issuance, token management, session lifecycle.
"""

import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from jose import JWTError, jwt

# ── Config ──────────────────────────────────────────────────────────────────

_ph = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=4)

JWT_SECRET: str = os.getenv(
    "JWT_SECRET",
    "cx-dev-secret-REPLACE-IN-PRODUCTION-min-64-chars-of-entropy-please!!"
)
JWT_ALGORITHM = "HS256"
ACCESS_TTL_MINUTES = 15
REFRESH_TTL_DAYS = 7
REFRESH_REMEMBER_TTL_DAYS = 30

DEV_MODE: bool = os.getenv("DEV_MODE", "true").lower() not in ("false", "0", "no")

MAX_FAILED_ATTEMPTS = 10
LOCKOUT_MINUTES = 30


# ── Password ─────────────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return _ph.hash(password)


def verify_password(stored_hash: str, password: str) -> bool:
    try:
        return _ph.verify(stored_hash, password)
    except VerifyMismatchError:
        return False
    except Exception:
        return False


def validate_password_policy(password: str) -> Optional[str]:
    """Returns an error message if the password fails policy, else None."""
    if len(password) < 8:
        return "Password must be at least 8 characters."
    if not any(c.isupper() for c in password):
        return "Password must contain at least one uppercase letter."
    if not any(c.isdigit() for c in password):
        return "Password must contain at least one number."
    return None


# ── Tokens ───────────────────────────────────────────────────────────────────

def sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def generate_opaque_token(nbytes: int = 48) -> str:
    """Generate a cryptographically secure URL-safe token."""
    return secrets.token_urlsafe(nbytes)


def create_access_token(
    user_id: str,
    email: str,
    role: str,
    tier: int,
    session_id: str,
) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "tier": tier,
        "sid": session_id,
        "iss": "climactix.global",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=ACCESS_TTL_MINUTES)).timestamp()),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError:
        return None


# ── Email normalization ───────────────────────────────────────────────────────

def normalize_email(email: str) -> str:
    """Lowercase and strip whitespace. Does not strip Gmail dots (intentional)."""
    return email.strip().lower()


# ── Session helpers ───────────────────────────────────────────────────────────

def session_expiry(remember: bool) -> datetime:
    days = REFRESH_REMEMBER_TTL_DAYS if remember else REFRESH_TTL_DAYS
    return datetime.now(timezone.utc) + timedelta(days=days)


def refresh_token_expiry(remember: bool) -> datetime:
    return session_expiry(remember)


def email_verify_expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(hours=24)


def reset_token_expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(minutes=15)


# ── DB helpers ────────────────────────────────────────────────────────────────

async def get_user_by_email(pool, email: str) -> Optional[dict]:
    row = await pool.fetchrow(
        "SELECT * FROM auth_users WHERE email_canonical = $1",
        normalize_email(email),
    )
    return dict(row) if row else None


async def get_user_by_id(pool, user_id: str) -> Optional[dict]:
    row = await pool.fetchrow(
        "SELECT * FROM auth_users WHERE id = $1",
        user_id,
    )
    return dict(row) if row else None


async def create_user(
    pool,
    *,
    full_name: str,
    email: str,
    company_name: str,
    password_hash: str,
) -> dict:
    canonical = normalize_email(email)
    row = await pool.fetchrow(
        """
        INSERT INTO auth_users
          (email, email_canonical, full_name, company_name, password_hash)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        """,
        canonical,
        canonical,
        full_name.strip(),
        company_name.strip(),
        password_hash,
    )
    return dict(row)


async def activate_user(pool, user_id: str) -> None:
    await pool.execute(
        "UPDATE auth_users SET status = 'active', updated_at = NOW() WHERE id = $1",
        user_id,
    )


async def record_failed_login(pool, user_id: str) -> int:
    row = await pool.fetchrow(
        """
        UPDATE auth_users
        SET failed_login_attempts = failed_login_attempts + 1,
            locked_until = CASE
              WHEN failed_login_attempts + 1 >= $2
              THEN NOW() + INTERVAL '30 minutes'
              ELSE locked_until
            END,
            updated_at = NOW()
        WHERE id = $1
        RETURNING failed_login_attempts
        """,
        user_id,
        MAX_FAILED_ATTEMPTS,
    )
    return row["failed_login_attempts"] if row else 0


async def clear_failed_logins(pool, user_id: str, ip: str) -> None:
    await pool.execute(
        """
        UPDATE auth_users
        SET failed_login_attempts = 0,
            locked_until = NULL,
            last_login_at = NOW(),
            last_login_ip = $2,
            updated_at = NOW()
        WHERE id = $1
        """,
        user_id,
        ip,
    )


async def update_password(pool, user_id: str, password_hash: str) -> None:
    await pool.execute(
        "UPDATE auth_users SET password_hash = $2, updated_at = NOW() WHERE id = $1",
        user_id,
        password_hash,
    )


# ── Email token helpers ───────────────────────────────────────────────────────

async def create_email_token(
    pool,
    user_id: str,
    purpose: str,
    expires_at: datetime,
) -> str:
    raw_token = generate_opaque_token()
    token_hash = sha256_hex(raw_token)
    # Invalidate any existing unused tokens for this user + purpose
    await pool.execute(
        """
        UPDATE auth_email_tokens
        SET used_at = NOW()
        WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL
        """,
        user_id,
        purpose,
    )
    await pool.execute(
        """
        INSERT INTO auth_email_tokens (user_id, token_hash, purpose, expires_at)
        VALUES ($1, $2, $3, $4)
        """,
        user_id,
        token_hash,
        purpose,
        expires_at,
    )
    return raw_token


async def consume_email_token(
    pool,
    user_id: str,
    raw_token: str,
    purpose: str,
) -> Optional[dict]:
    """Validates and marks the token as used. Returns the token row or None."""
    token_hash = sha256_hex(raw_token)
    row = await pool.fetchrow(
        """
        SELECT * FROM auth_email_tokens
        WHERE user_id = $1
          AND token_hash = $2
          AND purpose = $3
          AND used_at IS NULL
          AND expires_at > NOW()
        """,
        user_id,
        token_hash,
        purpose,
    )
    if not row:
        return None
    await pool.execute(
        "UPDATE auth_email_tokens SET used_at = NOW() WHERE id = $1",
        row["id"],
    )
    return dict(row)


# ── Session helpers ───────────────────────────────────────────────────────────

async def create_session(
    pool,
    user_id: str,
    ip: str,
    user_agent: str,
    remember: bool,
) -> str:
    session_id = generate_opaque_token(24)
    expires_at = session_expiry(remember)
    await pool.execute(
        """
        INSERT INTO auth_sessions
          (id, user_id, ip_address, user_agent, remember_me, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        """,
        session_id,
        user_id,
        ip,
        user_agent,
        remember,
        expires_at,
    )
    return session_id


async def revoke_session(pool, session_id: str, reason: str = "logout") -> None:
    await pool.execute(
        """
        UPDATE auth_sessions
        SET revoked_at = NOW(), revoke_reason = $2
        WHERE id = $1
        """,
        session_id,
        reason,
    )


async def revoke_all_user_sessions(pool, user_id: str, reason: str) -> None:
    await pool.execute(
        """
        UPDATE auth_sessions
        SET revoked_at = NOW(), revoke_reason = $2
        WHERE user_id = $1 AND revoked_at IS NULL
        """,
        user_id,
        reason,
    )


async def touch_session(pool, session_id: str) -> None:
    await pool.execute(
        "UPDATE auth_sessions SET last_active = NOW() WHERE id = $1",
        session_id,
    )


# ── Refresh token helpers ─────────────────────────────────────────────────────

async def create_refresh_token(
    pool,
    user_id: str,
    session_id: str,
    remember: bool,
) -> str:
    raw_token = generate_opaque_token()
    token_hash = sha256_hex(raw_token)
    expires_at = refresh_token_expiry(remember)
    await pool.execute(
        """
        INSERT INTO auth_refresh_tokens
          (token_hash, user_id, session_id, expires_at)
        VALUES ($1, $2, $3, $4)
        """,
        token_hash,
        user_id,
        session_id,
        expires_at,
    )
    return raw_token


async def consume_refresh_token(pool, raw_token: str) -> Optional[dict]:
    """Validates and marks refresh token used. Returns row or None."""
    token_hash = sha256_hex(raw_token)
    row = await pool.fetchrow(
        """
        SELECT rt.*, s.remember_me, s.revoked_at as session_revoked
        FROM auth_refresh_tokens rt
        JOIN auth_sessions s ON s.id = rt.session_id
        WHERE rt.token_hash = $1
          AND rt.used_at IS NULL
          AND rt.revoked_at IS NULL
          AND rt.expires_at > NOW()
        """,
        token_hash,
    )
    if not row:
        return None
    if row["session_revoked"] is not None:
        return None
    await pool.execute(
        "UPDATE auth_refresh_tokens SET used_at = NOW() WHERE token_hash = $1",
        token_hash,
    )
    return dict(row)


async def revoke_session_refresh_tokens(pool, session_id: str) -> None:
    await pool.execute(
        """
        UPDATE auth_refresh_tokens
        SET revoked_at = NOW()
        WHERE session_id = $1 AND revoked_at IS NULL
        """,
        session_id,
    )


async def revoke_all_user_refresh_tokens(pool, user_id: str) -> None:
    await pool.execute(
        """
        UPDATE auth_refresh_tokens
        SET revoked_at = NOW()
        WHERE user_id = $1 AND revoked_at IS NULL
        """,
        user_id,
    )


# ── Audit ─────────────────────────────────────────────────────────────────────

async def audit(
    pool,
    event_type: str,
    outcome: str,
    *,
    actor_id: Optional[str] = None,
    actor_email: Optional[str] = None,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> None:
    try:
        import json
        await pool.execute(
            """
            INSERT INTO auth_audit_events
              (event_type, event_outcome, actor_id, actor_email,
               ip_address, user_agent, metadata)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            """,
            event_type,
            outcome,
            actor_id,
            actor_email,
            ip,
            user_agent,
            json.dumps(metadata) if metadata else None,
        )
    except Exception:
        pass  # Audit must never break primary flows
