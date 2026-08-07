"""
Climactix Green Production — Certification Engine v1.0
Issues Bronze -> Diamond certificates once a production's latest score
snapshot clears a level's minimum score, carbon-intensity threshold, and
mandatory criteria (see green_score_engine.determine_certification_level).

Workflow: Assessment -> Scoring -> Certificate Issued (pending) ->
Reviewer Verifies -> Public Registry Lookup (QR + certificate number).

Certificates carry an HMAC-SHA256 signature over their canonical fields so
tampering (e.g. editing a stored score after issuance) is detectable —
the public verification endpoint recomputes and compares it. This is a
real, checkable integrity property, not a decorative "digital signature"
label.

Proprietary IP of Climactix Global. All rights reserved.
"""

from __future__ import annotations
import hashlib
import hmac
import io
import json
import os
import secrets
from datetime import datetime, timezone
from typing import Optional

import asyncpg
import qrcode

from services import green_score_engine as scoring

_SIGNING_KEY = os.getenv("GREEN_CERT_SIGNING_KEY", "")
if not _SIGNING_KEY:
    _SIGNING_KEY = secrets.token_hex(32)
    if os.getenv("DEV_MODE", "true").lower() not in ("false", "0", "no"):
        print(f"\n[DEV] Green certificate signing key (set GREEN_CERT_SIGNING_KEY in production):\n  {_SIGNING_KEY}\n")

PUBLIC_BASE_URL = os.getenv("GREEN_CERT_PUBLIC_BASE_URL", "http://localhost:8000")


# ── Certificate number & signature ───────────────────────────────────────────

def generate_certificate_number() -> str:
    year = datetime.now(timezone.utc).year
    token = secrets.token_hex(4).upper()
    return f"CXGP-{year}-{token}"


def _canonical_payload(
    certificate_number: str, production_id: str, level_id: str,
    score: float, snapshot_id: str, issued_at_iso: str,
) -> str:
    return "|".join([certificate_number, production_id, level_id, f"{score:.1f}", snapshot_id, issued_at_iso])


def sign_certificate(
    certificate_number: str, production_id: str, level_id: str,
    score: float, snapshot_id: str, issued_at_iso: str,
) -> str:
    payload = _canonical_payload(certificate_number, production_id, level_id, score, snapshot_id, issued_at_iso)
    return hmac.new(_SIGNING_KEY.encode(), payload.encode(), hashlib.sha256).hexdigest()


# ── Issuance ──────────────────────────────────────────────────────────────────

async def issue_certificate(
    pool: asyncpg.Pool, production_id: str, issued_by: str = "Climactix Global",
    actor_id: Optional[str] = None,
) -> dict:
    """Score the production fresh, then issue a certificate at whatever level
    it currently clears. Raises ValueError if no level is achieved yet."""
    score_result = await scoring.compute_score(pool, production_id, persist=True)
    level = score_result["certificationLevel"]
    if not level.get("achieved"):
        gap = level.get("scoreGap")
        unmet = level.get("unmetCriteria", [])
        detail = f"score {score_result['totalScore']} has not reached Bronze (needs {level['minScore']}"
        if gap:
            detail += f", {gap} points short"
        detail += ")"
        if unmet:
            detail += f"; unmet criteria: {', '.join(unmet)}"
        raise ValueError(f"production is not yet eligible for certification — {detail}")

    issued_at = datetime.now(timezone.utc)
    issued_at_iso = issued_at.isoformat()

    for _ in range(5):  # certificate_number collisions are astronomically unlikely; retry defensively
        certificate_number = generate_certificate_number()
        signature = sign_certificate(
            certificate_number, production_id, level["levelId"],
            score_result["totalScore"], score_result["snapshotId"], issued_at_iso,
        )
        try:
            row = await pool.fetchrow(
                """
                INSERT INTO green_certifications
                  (production_id, snapshot_id, level_id, score, certificate_number,
                   verification_status, issued_by, issued_at, metadata)
                VALUES ($1,$2,$3,$4,$5,'pending',$6,$7,$8)
                RETURNING id, issued_at, expires_at
                """,
                production_id, score_result["snapshotId"], level["levelId"], score_result["totalScore"],
                certificate_number, issued_by, issued_at,
                json.dumps({"signature": signature, "signatureAlgorithm": "HMAC-SHA256"}),
            )
        except asyncpg.UniqueViolationError:
            continue
        break
    else:
        raise RuntimeError("failed to generate a unique certificate number after 5 attempts")

    await pool.execute(
        """
        INSERT INTO green_audit_log (production_id, actor_id, action, entity_type, entity_id, after_state)
        VALUES ($1,$2,'certificate_issued','green_certifications',$3,$4)
        """,
        production_id, actor_id, row["id"],
        json.dumps({"certificateNumber": certificate_number, "levelId": level["levelId"], "score": score_result["totalScore"]}),
    )

    return {
        "id": row["id"],
        "productionId": production_id,
        "certificateNumber": certificate_number,
        "levelId": level["levelId"],
        "levelLabel": level["label"],
        "score": score_result["totalScore"],
        "verificationStatus": "pending",
        "issuedBy": issued_by,
        "issuedAt": row["issued_at"].isoformat(),
        "expiresAt": row["expires_at"].isoformat(),
        "verifyUrl": f"{PUBLIC_BASE_URL}/api/v1/green-production/verify/{certificate_number}",
    }


async def set_verification_status(
    pool: asyncpg.Pool, certificate_id: str, status: str,
    reviewer_notes: Optional[str] = None, actor_id: Optional[str] = None,
) -> dict:
    if status not in ("verified", "revoked", "pending"):
        raise ValueError(f"invalid status '{status}'")

    before = await pool.fetchrow("SELECT * FROM green_certifications WHERE id = $1", certificate_id)
    if before is None:
        raise ValueError(f"unknown certificate '{certificate_id}'")

    metadata = before["metadata"]
    meta_dict = json.loads(metadata) if isinstance(metadata, str) else dict(metadata)
    if reviewer_notes:
        meta_dict["reviewerNotes"] = reviewer_notes

    row = await pool.fetchrow(
        "UPDATE green_certifications SET verification_status = $1, metadata = $2 WHERE id = $3 "
        "RETURNING id, certificate_number, verification_status",
        status, json.dumps(meta_dict), certificate_id,
    )
    await pool.execute(
        """
        INSERT INTO green_audit_log (production_id, actor_id, action, entity_type, entity_id, before_state, after_state)
        VALUES ($1,$2,'certificate_status_changed','green_certifications',$3,$4,$5)
        """,
        before["production_id"], actor_id, certificate_id,
        json.dumps({"verificationStatus": before["verification_status"]}),
        json.dumps({"verificationStatus": status, "reviewerNotes": reviewer_notes}),
    )
    return {"id": row["id"], "certificateNumber": row["certificate_number"], "verificationStatus": row["verification_status"]}


# ── Public verification ──────────────────────────────────────────────────────

async def get_certificate_by_number(pool: asyncpg.Pool, certificate_number: str) -> Optional[dict]:
    row = await pool.fetchrow(
        """
        SELECT c.id, c.production_id, c.snapshot_id, c.level_id, c.score, c.certificate_number,
               c.verification_status, c.issued_by, c.issued_at, c.expires_at, c.metadata,
               p.production_name, p.production_company, p.studio, p.country, p.film_type,
               l.label AS level_label
        FROM green_certifications c
        JOIN green_productions p ON p.id = c.production_id
        JOIN green_certification_levels l ON l.id = c.level_id
        WHERE c.certificate_number = $1
        """,
        certificate_number,
    )
    if row is None:
        return None

    metadata = json.loads(row["metadata"]) if isinstance(row["metadata"], str) else dict(row["metadata"])
    stored_signature = metadata.get("signature")
    recomputed_signature = sign_certificate(
        row["certificate_number"], row["production_id"], row["level_id"],
        float(row["score"]), row["snapshot_id"], row["issued_at"].isoformat(),
    )
    signature_valid = bool(stored_signature) and hmac.compare_digest(stored_signature, recomputed_signature)

    now = datetime.now(timezone.utc)
    expired = row["expires_at"] is not None and row["expires_at"] < now
    is_valid = row["verification_status"] == "verified" and not expired and signature_valid

    return {
        "certificateNumber": row["certificate_number"],
        "productionName": row["production_name"],
        "productionCompany": row["production_company"],
        "studio": row["studio"],
        "country": row["country"],
        "filmType": row["film_type"],
        "certificationLevel": row["level_id"],
        "certificationLevelLabel": row["level_label"],
        "score": float(row["score"]),
        "verificationStatus": row["verification_status"],
        "issuedBy": row["issued_by"],
        "issuedAt": row["issued_at"].isoformat(),
        "expiresAt": row["expires_at"].isoformat() if row["expires_at"] else None,
        "expired": expired,
        "signatureValid": signature_valid,
        "isValid": is_valid,
    }


# ── QR code ───────────────────────────────────────────────────────────────────

def qr_png_bytes(data: str) -> bytes:
    qr = qrcode.QRCode(
        version=1, error_correction=qrcode.constants.ERROR_CORRECT_L, box_size=8, border=2,
    )
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def verify_url(certificate_number: str) -> str:
    return f"{PUBLIC_BASE_URL}/api/v1/green-production/verify/{certificate_number}"
