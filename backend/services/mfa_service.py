"""
Climactix — MFA service.
TOTP (RFC 6238) via pyotp + Fernet-encrypted storage of TOTP secrets.
"""

import base64
import io
import os
from typing import Optional

import pyotp
import qrcode
from cryptography.fernet import Fernet, InvalidToken

# ── Encryption key for TOTP secrets stored in DB ──────────────────────────────
# Generate a key once and set TOTP_ENCRYPTION_KEY in production.
# In dev mode a random key is used per process (secrets are ephemeral — fine for dev).

_raw_key: str = os.getenv("TOTP_ENCRYPTION_KEY", "")
if not _raw_key:
    _raw_key = Fernet.generate_key().decode()
    if os.getenv("DEV_MODE", "true").lower() not in ("false", "0", "no"):
        print(
            f"\n[DEV] TOTP key (set TOTP_ENCRYPTION_KEY in production):\n  {_raw_key}\n"
        )

_fernet = Fernet(_raw_key.encode() if isinstance(_raw_key, str) else _raw_key)

ISSUER = "Climactix Global"
TOTP_VALID_WINDOW = 1  # ±1 time step (90 seconds total)


# ── TOTP helpers ──────────────────────────────────────────────────────────────

def generate_totp_secret() -> str:
    """Generate a random TOTP secret (base32, 32 chars = 160-bit entropy)."""
    return pyotp.random_base32()


def get_totp_provisioning_uri(secret: str, email: str) -> str:
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(name=email, issuer_name=ISSUER)


def verify_totp_code(secret: str, code: str) -> bool:
    """Validate a 6-digit TOTP code. Allows ±1 window to handle clock skew."""
    try:
        totp = pyotp.TOTP(secret)
        return totp.verify(code.strip(), valid_window=TOTP_VALID_WINDOW)
    except Exception:
        return False


def generate_qr_data_url(provisioning_uri: str) -> str:
    """Return a base64-encoded PNG data URL of the QR code."""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=6,
        border=2,
    )
    qr.add_data(provisioning_uri)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode()
    return f"data:image/png;base64,{b64}"


# ── Secret encryption ─────────────────────────────────────────────────────────

def encrypt_secret(secret: str) -> str:
    return _fernet.encrypt(secret.encode()).decode()


def decrypt_secret(encrypted: str) -> Optional[str]:
    try:
        return _fernet.decrypt(encrypted.encode()).decode()
    except (InvalidToken, Exception):
        return None


# ── Backup codes (Phase 3 — stub for now) ─────────────────────────────────────

def generate_backup_codes(count: int = 8) -> list[str]:
    """Generate one-time backup codes. Stored hashed in DB (Phase 3)."""
    import secrets as _s
    return [_s.token_hex(4).upper() for _ in range(count)]
