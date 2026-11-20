"""
Background processing: a PostgreSQL-backed queue.

Workers claim jobs with SELECT ... FOR UPDATE SKIP LOCKED, so any number of
worker processes can run safely and a job is enqueued in the same
transaction as the change that caused it (no lost or phantom jobs, no extra
broker to operate). Each job runs in its own transaction; failures retry with
back-off and finally surface in the admin review queue.
"""

from __future__ import annotations

import logging
import os
import socket
import time
import traceback
import uuid
from datetime import timedelta
from typing import Callable, Optional

from sqlalchemy import delete, select, text, update
from sqlalchemy.orm import Session

from . import audit, connectors, pipeline
from .config import get_settings
from .db import session_scope
from .models import AuthSession, AuthToken, Document, IngestionSource, Job, ProcessingLog, ReviewItem, utcnow

log = logging.getLogger("cxt.jobs")
WORKER_ID = f"{socket.gethostname()}:{os.getpid()}"
STALE_LOCK = timedelta(minutes=20)


# ── Handlers ─────────────────────────────────────────────────────────────────

def _process_document(db: Session, job: Job) -> None:
    pipeline.process_document(db, job.document_id, job.id)


def _assess_company(db: Session, job: Job) -> None:
    from . import assessment
    assessment.run_public_assessment(db, None, job.company_id, trigger=job.payload.get("trigger", "queued"))


def _fetch_source(db: Session, job: Job) -> None:
    """Retrieve a document from a registered public source and ingest it."""
    src = db.get(IngestionSource, uuid.UUID(job.payload["source_id"]))
    url = job.payload["url"]
    try:
        connectors.require_operational(src.connector)
        content, name, ct, final = connectors.fetch(url)
    except connectors.ConnectorError as e:
        src.status, src.last_checked_at = "error", utcnow()
        src.last_result = {**src.last_result, "error": str(e), "url": url}
        pipeline.log(db, None, "source_discovery", f"Retrieval failed for {url}: {e}", level="error", job_id=job.id)
        audit.record(db, None, "ingestion.fetch_failed", entity_type="ingestion_source", entity_id=src.id,
                     company_id=src.company_id, detail={"url": url, "error": str(e)})
        return
    try:
        doc, dup = pipeline.ingest_bytes(db, None, content, name, ct, company_id=src.company_id,
                                         category=job.payload.get("category"),
                                         fiscal_year=job.payload.get("fiscal_year"),
                                         source_type="public_url", source_url=final, source_id=src.id)
    except Exception as e:  # validation rejected the file (type, size, active content)
        detail = getattr(e, "detail", str(e))
        src.status, src.last_checked_at = "error", utcnow()
        src.last_result = {**src.last_result, "error": str(detail), "url": url}
        pipeline.log(db, None, "ingestion", f"Retrieved file from {url} was rejected: {detail}", level="error",
                     job_id=job.id)
        return
    src.status, src.last_checked_at = "retrieved", utcnow()
    src.last_result = {**src.last_result, "error": None, "last_document_id": str(doc.id), "duplicate": dup,
                       "url": final}


def _maintenance(db: Session, job: Job) -> None:
    """Housekeeping: subscription expiry and data-retention limits."""
    from . import security
    s = get_settings()
    now = utcnow()
    expired = security.expire_subscriptions(db)
    sess = db.execute(delete(AuthSession).where(
        AuthSession.expires_at < now - timedelta(days=s.session_retention_days))).rowcount
    toks = db.execute(delete(AuthToken).where(AuthToken.expires_at < now - timedelta(days=7))).rowcount
    old_jobs = db.execute(delete(Job).where(Job.status.in_(("completed", "failed")),
                                            Job.finished_at < now - timedelta(days=s.failed_job_retention_days))).rowcount
    old_logs = db.execute(delete(ProcessingLog).where(
        ProcessingLog.document_id.is_(None), ProcessingLog.at < now - timedelta(days=s.failed_job_retention_days))).rowcount
    audit.record(db, None, "system.maintenance", detail={"subscriptions_expired": expired, "sessions_purged": sess,
                                                         "tokens_purged": toks, "jobs_purged": old_jobs,
                                                         "logs_purged": old_logs})


HANDLERS: dict[str, Callable[[Session, Job], None]] = {
    "process_document": _process_document, "assess_company": _assess_company,
    "fetch_source": _fetch_source, "maintenance": _maintenance,
}


# ── Queue mechanics ──────────────────────────────────────────────────────────

def _claim(db: Session) -> Optional[uuid.UUID]:
    now = utcnow()
    db.execute(update(Job).where(Job.status == "processing", Job.locked_at < now - STALE_LOCK)
               .values(status="pending", locked_at=None, locked_by=None))
    job = db.execute(select(Job).where(Job.status == "pending", Job.run_after <= now)
                     .order_by(Job.created_at).limit(1).with_for_update(skip_locked=True)).scalar_one_or_none()
    if not job:
        return None
    job.status, job.locked_at, job.locked_by = "processing", now, WORKER_ID
    job.attempts += 1
    return job.id


def run_one() -> bool:
    """Claim and execute one job. Returns False when the queue is empty."""
    with session_scope() as db:
        job_id = _claim(db)
    if not job_id:
        return False
    try:
        with session_scope() as db:
            job = db.get(Job, job_id)
            handler = HANDLERS.get(job.kind)
            if not handler:
                raise RuntimeError(f"No handler for job kind '{job.kind}'")
            handler(db, job)
            job.status, job.finished_at, job.error = "completed", utcnow(), None
    except Exception as e:
        log.exception("job %s failed", job_id)
        _fail(job_id, e)
    return True


def _fail(job_id: uuid.UUID, exc: Exception) -> None:
    msg = f"{type(exc).__name__}: {exc}"[:2000]
    with session_scope() as db:
        job = db.get(Job, job_id)
        job.error, job.locked_at, job.locked_by = msg, None, None
        final = job.attempts >= job.max_attempts
        if final:
            job.status, job.finished_at = "failed", utcnow()
        else:
            job.status, job.run_after = "pending", utcnow() + timedelta(seconds=30 * 2 ** job.attempts)
        doc = db.get(Document, job.document_id) if job.document_id else None
        db.add(ProcessingLog(document_id=doc.id if doc else None, job_id=job.id, stage=doc.stage if doc else job.kind,
                             level="error", message=f"Attempt {job.attempts}/{job.max_attempts} failed: {msg}",
                             detail={"traceback": traceback.format_exc()[-3000:]}))
        if doc:
            doc.error = msg
            doc.status = "failed" if final else "pending"
            if final:
                db.add(ReviewItem(kind="extraction_failure", document_id=doc.id,
                                  company_id=doc.company_id or doc.declared_company_id,
                                  summary=f"{doc.title}: processing failed at {doc.stage} — {msg[:300]}",
                                  detail={"stage": doc.stage, "error": msg}))


def drain(max_jobs: int = 1000) -> int:
    """Run jobs until the queue is empty (tests, CLI, small deployments)."""
    n = 0
    while n < max_jobs and run_one():
        n += 1
    return n


def schedule_maintenance() -> None:
    with session_scope() as db:
        recent = db.execute(text("SELECT count(*) FROM jobs WHERE kind = 'maintenance' AND "
                                 "(status IN ('pending','processing') OR created_at > now() - interval '6 hours')")).scalar()
        if not recent:
            db.add(Job(kind="maintenance", payload={}))


def work_forever(poll_seconds: float = 2.0) -> None:  # pragma: no cover - long-running process
    log.info("worker %s started", WORKER_ID)
    last_maintenance = 0.0
    while True:
        if time.time() - last_maintenance > 3600:
            schedule_maintenance()
            last_maintenance = time.time()
        if not run_one():
            time.sleep(poll_seconds)
