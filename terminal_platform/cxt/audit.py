"""
Audit trail.

Every state-changing action writes one row through `record`. The table is
append-only at the database level (trigger in the first migration) and rows
are hash-chained: row_hash = sha256(prev_hash + canonical row content), so a
deleted or edited row breaks the chain and `verify_chain` reports where.
"""

from __future__ import annotations

import uuid
from datetime import timezone
from typing import Any, Optional

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from .models import AuditLog, utcnow
from .util import canonical_json, sha256_hex

_CHAIN_LOCK = 0x43585441  # advisory-lock key: serialises chain appends


def _row_content(r: AuditLog) -> str:
    return canonical_json({
        "at": r.at.astimezone(timezone.utc).isoformat(), "actor_user_id": r.actor_user_id,
        "actor_org_id": r.actor_org_id,
        "actor_role": r.actor_role, "action": r.action, "entity_type": r.entity_type, "entity_id": r.entity_id,
        "company_id": r.company_id, "detail": r.detail, "ip": r.ip,
    })


def record(db: Session, actor: Any, action: str, *, entity_type: Optional[str] = None,
           entity_id: Any = None, company_id: Optional[uuid.UUID] = None,
           detail: Optional[dict] = None, ip: Optional[str] = None) -> AuditLog:
    """`actor` is a security.Principal, or None for system / worker actions."""
    db.execute(text("SELECT pg_advisory_xact_lock(:k)"), {"k": _CHAIN_LOCK})
    prev = db.execute(select(AuditLog.row_hash).order_by(AuditLog.id.desc()).limit(1)).scalar()
    row = AuditLog(
        at=utcnow(),
        actor_user_id=getattr(actor, "user_id", None), actor_org_id=getattr(actor, "org_id", None),
        actor_role=getattr(actor, "role", None) or "system",
        actor_label=getattr(actor, "email", None) or "system",
        action=action, entity_type=entity_type, entity_id=str(entity_id) if entity_id is not None else None,
        company_id=company_id, detail=detail or {}, ip=ip or getattr(actor, "ip", None), prev_hash=prev,
    )
    row.row_hash = sha256_hex((prev or "") + _row_content(row))
    db.add(row)
    db.flush()
    return row


def verify_chain(db: Session, limit: int = 100_000) -> dict:
    """Recompute the chain. Returns {'ok': bool, 'checked': n, 'broken_at': id|None}."""
    prev, n = None, 0
    for r in db.execute(select(AuditLog).order_by(AuditLog.id).limit(limit)).scalars():
        n += 1
        if r.prev_hash != prev or r.row_hash != sha256_hex((prev or "") + _row_content(r)):
            return {"ok": False, "checked": n, "broken_at": r.id}
        prev = r.row_hash
    return {"ok": True, "checked": n, "broken_at": None}
