"""
Relational schema for the Climactix Terminal.

Conventions
  * Primary keys are UUIDs generated in the application.
  * fiscal_year is the calendar year in which the reporting period ENDS
    (FY2024-25 -> 2025). Display formatting lives in cxt.util.fy_label.
  * Status vocabularies are plain strings guarded by CHECK constraints so
    they are enforced by the database, not only by the API.
  * Nothing in this schema stores a score without the methodology version
    and the exact inputs that produced it.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import (BigInteger, Boolean, CheckConstraint, DateTime, Float, ForeignKey, Index, Integer,
                        String, Text, UniqueConstraint, text)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _enum(col: str, values: tuple[str, ...], name: str) -> CheckConstraint:
    return CheckConstraint(f"{col} IN ({', '.join(repr(v) for v in values)})", name=name)


PK = lambda: mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)  # noqa: E731
TS = lambda: mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)  # noqa: E731


# ── Vocabularies ─────────────────────────────────────────────────────────────

ORG_TYPES = ("climactix", "company", "bank", "insurance", "investor", "government")
ROLES = ("super_admin", "data_analyst", "assessment_reviewer", "company_admin",
         "bank_user", "insurance_user", "investor_user", "government_user")
USER_STATUS = ("invited", "active", "disabled")
DOC_CATEGORIES = ("ANNUAL_REPORT", "BRSR", "SUSTAINABILITY_REPORT", "ESG_REPORT", "CLIMATE_REPORT",
                  "NET_ZERO_REPORT", "INTEGRATED_REPORT", "ENVIRONMENTAL_DATA", "FINANCIAL_DISCLOSURE",
                  "ASSURANCE_STATEMENT", "POLICY", "SUPPORTING_EVIDENCE", "OTHER")
DOC_STATUS = ("pending", "processing", "completed", "failed", "requires_review")
DOC_STAGES = ("source_discovery", "ingestion", "extraction", "classification", "validation",
              "company_mapping", "repository")
DOC_SOURCE = ("upload", "public_url", "connector", "company_submission")
JOB_STATUS = ("pending", "processing", "completed", "failed")
VERIFICATION = ("extracted", "needs_review", "verified", "rejected", "company_declared", "evidence_accepted")
CHANNELS = ("public", "company")
REVIEW_KINDS = ("low_confidence", "contradiction", "company_mapping", "classification", "ocr_unavailable",
                "duplicate_company", "extraction_failure")
ASSESSMENT_STATUS = ("draft", "submitted", "under_review", "returned", "validated", "scored")
EVIDENCE_STATUS = ("not_provided", "declared_source", "submitted", "accepted", "rejected")
METHODOLOGY_STATUS = ("draft", "approved", "retired")
PLANS = ("internal", "company_annual", "institutional_pilot", "institutional_enterprise")
SUB_STATUS = ("active", "expired", "cancelled", "pending")


# ── Organisations, users, sessions ───────────────────────────────────────────

class Organisation(Base):
    __tablename__ = "organisations"
    id: Mapped[uuid.UUID] = PK()
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    org_type: Mapped[str] = mapped_column(String(20), nullable=False)
    company_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("companies.id"))  # company orgs only
    country: Mapped[Optional[str]] = mapped_column(String(80))
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)
    created_at: Mapped[datetime] = TS()
    __table_args__ = (_enum("org_type", ORG_TYPES, "ck_org_type"),
                      _enum("status", ("active", "suspended"), "ck_org_status"),
                      Index("uq_org_company", "company_id", unique=True, postgresql_where=text("company_id IS NOT NULL")))


class User(Base):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = PK()
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    password_hash: Mapped[Optional[str]] = mapped_column(String(300))
    role: Mapped[str] = mapped_column(String(30), nullable=False)
    organisation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organisations.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="invited", nullable=False)
    failed_logins: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    locked_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = TS()
    organisation: Mapped[Organisation] = relationship(lazy="joined")
    __table_args__ = (Index("uq_users_email", text("lower(email)"), unique=True),
                      _enum("role", ROLES, "ck_user_role"), _enum("status", USER_STATUS, "ck_user_status"))


class AuthSession(Base):
    __tablename__ = "sessions"
    id: Mapped[uuid.UUID] = PK()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    created_at: Mapped[datetime] = TS()
    last_seen_at: Mapped[datetime] = TS()
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    ip: Mapped[Optional[str]] = mapped_column(String(64))
    user_agent: Mapped[Optional[str]] = mapped_column(String(400))


class AuthToken(Base):
    """Single-use, hashed tokens for invitations and password recovery."""
    __tablename__ = "auth_tokens"
    id: Mapped[uuid.UUID] = PK()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    purpose: Mapped[str] = mapped_column(String(20), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = TS()
    __table_args__ = (_enum("purpose", ("invite", "password_reset"), "ck_token_purpose"),)


class AuditLog(Base):
    """Append-only (enforced by a trigger). Rows are hash-chained so removal or
    alteration of a historical row is detectable by cxt.audit.verify_chain."""
    __tablename__ = "audit_log"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    at: Mapped[datetime] = TS()
    actor_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    actor_org_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    actor_role: Mapped[Optional[str]] = mapped_column(String(30))
    actor_label: Mapped[Optional[str]] = mapped_column(String(320))
    action: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    entity_type: Mapped[Optional[str]] = mapped_column(String(40))
    entity_id: Mapped[Optional[str]] = mapped_column(String(64))
    company_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), index=True)
    detail: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    ip: Mapped[Optional[str]] = mapped_column(String(64))
    prev_hash: Mapped[Optional[str]] = mapped_column(String(64))
    row_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    __table_args__ = (Index("ix_audit_entity", "entity_type", "entity_id"), Index("ix_audit_at", "at"))


# ── Companies ────────────────────────────────────────────────────────────────

class Sector(Base):
    __tablename__ = "sectors"
    id: Mapped[uuid.UUID] = PK()
    code: Mapped[str] = mapped_column(String(40), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class Company(Base):
    __tablename__ = "companies"
    id: Mapped[uuid.UUID] = PK()
    cx_id: Mapped[str] = mapped_column(String(16), nullable=False, unique=True)     # CX-000001
    legal_name: Mapped[str] = mapped_column(String(300), nullable=False)
    common_name: Mapped[Optional[str]] = mapped_column(String(300))
    name_norm: Mapped[str] = mapped_column(String(300), nullable=False)
    registration_id: Mapped[Optional[str]] = mapped_column(String(40))              # CIN, LEI, ...
    registration_type: Mapped[Optional[str]] = mapped_column(String(20))
    country: Mapped[str] = mapped_column(String(80), nullable=False)
    sector_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("sectors.id"))
    industry: Mapped[Optional[str]] = mapped_column(String(160))
    website: Mapped[Optional[str]] = mapped_column(String(400))
    headquarters: Mapped[Optional[str]] = mapped_column(String(200))
    description: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)
    merged_into_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("companies.id"))
    is_synthetic: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)  # demo / test entity
    # Set by the company itself: lets institutional users see its Company Assessment Score.
    share_company_score: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    record_source: Mapped[str] = mapped_column(String(40), default="manual", nullable=False)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    created_at: Mapped[datetime] = TS()
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    sector: Mapped[Optional[Sector]] = relationship(lazy="joined")
    __table_args__ = (
        _enum("status", ("active", "merged", "archived"), "ck_company_status"),
        Index("uq_company_registration", "registration_type", "registration_id", unique=True,
              postgresql_where=text("registration_id IS NOT NULL AND status = 'active'")),
        Index("ix_company_name_trgm", "name_norm", postgresql_using="gin",
              postgresql_ops={"name_norm": "gin_trgm_ops"}),
    )


class CompanyAlias(Base):
    __tablename__ = "company_aliases"
    id: Mapped[uuid.UUID] = PK()
    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id"), nullable=False, index=True)
    alias: Mapped[str] = mapped_column(String(300), nullable=False)
    alias_norm: Mapped[str] = mapped_column(String(300), nullable=False, index=True)
    __table_args__ = (UniqueConstraint("company_id", "alias_norm", name="uq_alias"),)


class CompanyMerge(Base):
    __tablename__ = "company_merges"
    id: Mapped[uuid.UUID] = PK()
    source_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id"), nullable=False)
    target_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id"), nullable=False)
    merged_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    moved: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    source_snapshot: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    at: Mapped[datetime] = TS()


# ── Ingestion, documents, processing ─────────────────────────────────────────

class IngestionSource(Base):
    """A registered public location for a company's disclosures."""
    __tablename__ = "ingestion_sources"
    id: Mapped[uuid.UUID] = PK()
    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id"), nullable=False, index=True)
    connector: Mapped[str] = mapped_column(String(40), nullable=False)
    url: Mapped[Optional[str]] = mapped_column(String(1000))
    label: Mapped[Optional[str]] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(30), default="registered", nullable=False)
    last_checked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    last_result: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    created_at: Mapped[datetime] = TS()


class Document(Base):
    __tablename__ = "documents"
    id: Mapped[uuid.UUID] = PK()
    company_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("companies.id"), index=True)
    declared_company_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("companies.id"))
    title: Mapped[str] = mapped_column(String(400), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(400), nullable=False)
    category: Mapped[str] = mapped_column(String(30), default="OTHER", nullable=False)
    declared_category: Mapped[Optional[str]] = mapped_column(String(30))
    fiscal_year: Mapped[Optional[int]] = mapped_column(Integer, index=True)
    declared_fiscal_year: Mapped[Optional[int]] = mapped_column(Integer)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    mime_type: Mapped[Optional[str]] = mapped_column(String(120))
    file_format: Mapped[str] = mapped_column(String(12), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(300), nullable=False)
    version_no: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    supersedes_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("documents.id"))
    source_type: Mapped[str] = mapped_column(String(24), nullable=False)
    source_url: Mapped[Optional[str]] = mapped_column(String(1000))
    source_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("ingestion_sources.id"))
    retrieved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    uploaded_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    owner_org_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("organisations.id"))
    visibility: Mapped[str] = mapped_column(String(12), default="public", nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False, index=True)
    stage: Mapped[str] = mapped_column(String(24), default="ingestion", nullable=False)
    page_count: Mapped[Optional[int]] = mapped_column(Integer)
    ocr_pages: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    classification: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    extraction_summary: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    extraction_confidence: Mapped[Optional[float]] = mapped_column(Float)
    error: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = TS()
    processed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    company: Mapped[Optional[Company]] = relationship(foreign_keys=[company_id], lazy="joined")
    __table_args__ = (
        _enum("category", DOC_CATEGORIES, "ck_doc_category"), _enum("status", DOC_STATUS, "ck_doc_status"),
        _enum("stage", DOC_STAGES, "ck_doc_stage"), _enum("source_type", DOC_SOURCE, "ck_doc_source"),
        _enum("visibility", ("public", "private"), "ck_doc_visibility"),
        Index("ix_doc_company_year", "company_id", "fiscal_year", "category"),
    )


class DocumentPage(Base):
    """Extracted text per page / logical unit: the basis of preview and source tracing."""
    __tablename__ = "document_pages"
    document_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), primary_key=True)
    page_no: Mapped[int] = mapped_column(Integer, primary_key=True)
    label: Mapped[str] = mapped_column(String(80), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    tables: Mapped[list[Any]] = mapped_column(JSONB, default=list, nullable=False)
    is_ocr: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class Job(Base):
    """Postgres-backed work queue (SELECT ... FOR UPDATE SKIP LOCKED)."""
    __tablename__ = "jobs"
    id: Mapped[uuid.UUID] = PK()
    kind: Mapped[str] = mapped_column(String(40), nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_attempts: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    run_after: Mapped[datetime] = TS()
    locked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    locked_by: Mapped[Optional[str]] = mapped_column(String(80))
    document_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), index=True)
    company_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("companies.id"))
    error: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = TS()
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    __table_args__ = (_enum("status", JOB_STATUS, "ck_job_status"),
                      Index("ix_jobs_queue", "status", "run_after"))


class ProcessingLog(Base):
    __tablename__ = "processing_logs"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    document_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), index=True)
    job_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    stage: Mapped[str] = mapped_column(String(40), nullable=False)
    level: Mapped[str] = mapped_column(String(10), default="info", nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    detail: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    at: Mapped[datetime] = TS()


# ── Extracted intelligence ───────────────────────────────────────────────────

class DataPoint(Base):
    """One extracted or declared fact, with its full provenance. The value as
    written in the source (value, unit, quote) is kept beside the normalised
    value and is never overwritten; a reviewer correction creates a new row
    that supersedes the old one."""
    __tablename__ = "data_points"
    id: Mapped[uuid.UUID] = PK()
    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id"), nullable=False)
    document_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("documents.id"), index=True)
    assessment_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("assessments.id"))
    channel: Mapped[str] = mapped_column(String(10), default="public", nullable=False)
    metric_key: Mapped[str] = mapped_column(String(60), nullable=False)
    category: Mapped[str] = mapped_column(String(30), nullable=False)
    kind: Mapped[str] = mapped_column(String(12), default="numeric", nullable=False)   # numeric | signal
    fiscal_year: Mapped[Optional[int]] = mapped_column(Integer)
    value: Mapped[Optional[float]] = mapped_column(Float)
    value_text: Mapped[Optional[str]] = mapped_column(String(200))
    unit: Mapped[Optional[str]] = mapped_column(String(40))
    normalized_value: Mapped[Optional[float]] = mapped_column(Float)
    normalized_unit: Mapped[Optional[str]] = mapped_column(String(40))
    boundary: Mapped[Optional[str]] = mapped_column(String(200))        # scope / method / consolidation basis
    quote: Mapped[Optional[str]] = mapped_column(Text)
    page_no: Mapped[Optional[int]] = mapped_column(Integer)
    source_location: Mapped[Optional[str]] = mapped_column(String(200))
    extraction_method: Mapped[str] = mapped_column(String(20), nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    confidence_factors: Mapped[list[Any]] = mapped_column(JSONB, default=list, nullable=False)
    verification_status: Mapped[str] = mapped_column(String(20), default="extracted", nullable=False)
    reviewed_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    review_note: Mapped[Optional[str]] = mapped_column(Text)
    superseded_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("data_points.id"))
    attributes: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    extracted_at: Mapped[datetime] = TS()
    __table_args__ = (
        _enum("channel", CHANNELS, "ck_dp_channel"), _enum("verification_status", VERIFICATION, "ck_dp_verification"),
        _enum("kind", ("numeric", "signal"), "ck_dp_kind"),
        CheckConstraint("confidence >= 0 AND confidence <= 100", name="ck_dp_confidence"),
        CheckConstraint("document_id IS NOT NULL OR assessment_id IS NOT NULL OR extraction_method = 'manual'",
                        name="ck_dp_has_source"),
        Index("ix_dp_company_metric", "company_id", "metric_key", "fiscal_year"),
    )


class ClimateTarget(Base):
    """A climate commitment as stated by the company. `validation_status`
    records what the SOURCE says about third-party validation; it is never a
    Climactix endorsement of the target."""
    __tablename__ = "climate_targets"
    id: Mapped[uuid.UUID] = PK()
    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id"), nullable=False, index=True)
    document_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("documents.id"), index=True)
    assessment_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("assessments.id"))
    channel: Mapped[str] = mapped_column(String(10), default="public", nullable=False)
    target_kind: Mapped[str] = mapped_column(String(30), nullable=False)
    horizon: Mapped[Optional[str]] = mapped_column(String(12))            # near_term | long_term
    description: Mapped[str] = mapped_column(Text, nullable=False)
    scope_coverage: Mapped[list[Any]] = mapped_column(JSONB, default=list, nullable=False)
    commitment_class: Mapped[str] = mapped_column(String(24), nullable=False)
    validation_status: Mapped[str] = mapped_column(String(24), default="declared", nullable=False)
    reduction_pct: Mapped[Optional[float]] = mapped_column(Float)
    baseline_year: Mapped[Optional[int]] = mapped_column(Integer)
    target_year: Mapped[Optional[int]] = mapped_column(Integer)
    target_type: Mapped[Optional[str]] = mapped_column(String(12))
    progress_status: Mapped[str] = mapped_column(String(16), default="NOT_STATED", nullable=False)
    reported_progress_pct: Mapped[Optional[float]] = mapped_column(Float)
    fiscal_year: Mapped[Optional[int]] = mapped_column(Integer)
    quote: Mapped[Optional[str]] = mapped_column(Text)
    page_no: Mapped[Optional[int]] = mapped_column(Integer)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    verification_status: Mapped[str] = mapped_column(String(20), default="extracted", nullable=False)
    reviewed_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    extracted_at: Mapped[datetime] = TS()
    __table_args__ = (_enum("verification_status", VERIFICATION, "ck_ct_verification"),
                      _enum("channel", CHANNELS, "ck_ct_channel"))


class ReviewItem(Base):
    """Human-review queue: low-confidence or contradictory extraction, unmapped
    documents, unavailable OCR, suspected duplicate companies."""
    __tablename__ = "review_items"
    id: Mapped[uuid.UUID] = PK()
    kind: Mapped[str] = mapped_column(String(24), nullable=False)
    company_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("companies.id"), index=True)
    document_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"))
    data_point_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("data_points.id"))
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    detail: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    status: Mapped[str] = mapped_column(String(12), default="open", nullable=False, index=True)
    resolution: Mapped[Optional[str]] = mapped_column(Text)
    resolved_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = TS()
    __table_args__ = (_enum("kind", REVIEW_KINDS, "ck_review_kind"),
                      _enum("status", ("open", "resolved", "dismissed"), "ck_review_status"))


# ── Methodology, assessments, scores ─────────────────────────────────────────

class MethodologyVersion(Base):
    __tablename__ = "methodology_versions"
    id: Mapped[uuid.UUID] = PK()
    version: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)
    status: Mapped[str] = mapped_column(String(12), default="draft", nullable=False)
    config: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    config_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    change_note: Mapped[str] = mapped_column(Text, nullable=False)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    created_at: Mapped[datetime] = TS()
    approved_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    __table_args__ = (_enum("status", METHODOLOGY_STATUS, "ck_methodology_status"),
                      Index("uq_methodology_approved", "status", unique=True,
                            postgresql_where=text("status = 'approved'")))


class Assessment(Base):
    """channel='public': generated by the platform from public evidence.
    channel='company': a company's own submission; each submission is a new
    version and never alters a public assessment or its score."""
    __tablename__ = "assessments"
    id: Mapped[uuid.UUID] = PK()
    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id"), nullable=False, index=True)
    channel: Mapped[str] = mapped_column(String(10), nullable=False)
    version_no: Mapped[int] = mapped_column(Integer, nullable=False)
    fiscal_year: Mapped[Optional[int]] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(16), default="draft", nullable=False)
    questionnaire_version: Mapped[Optional[str]] = mapped_column(String(20))
    organisation_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("organisations.id"))
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    created_at: Mapped[datetime] = TS()
    submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    reviewed_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    trigger: Mapped[Optional[str]] = mapped_column(String(200))
    __table_args__ = (_enum("channel", CHANNELS, "ck_assessment_channel"),
                      _enum("status", ASSESSMENT_STATUS, "ck_assessment_status"),
                      UniqueConstraint("company_id", "channel", "version_no", name="uq_assessment_version"))


class AssessmentAnswer(Base):
    __tablename__ = "assessment_answers"
    id: Mapped[uuid.UUID] = PK()
    assessment_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False)
    question_id: Mapped[str] = mapped_column(String(40), nullable=False)
    value: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB)
    source_declaration: Mapped[Optional[str]] = mapped_column(Text)
    evidence_document_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("documents.id"))
    evidence_status: Mapped[str] = mapped_column(String(16), default="not_provided", nullable=False)
    reviewer_comment: Mapped[Optional[str]] = mapped_column(Text)
    reviewed_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    __table_args__ = (UniqueConstraint("assessment_id", "question_id", name="uq_answer"),
                      _enum("evidence_status", EVIDENCE_STATUS, "ck_answer_evidence"))


class AssessmentEvent(Base):
    """Submission history and reviewer comments for an assessment."""
    __tablename__ = "assessment_events"
    id: Mapped[uuid.UUID] = PK()
    assessment_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False, index=True)
    event: Mapped[str] = mapped_column(String(30), nullable=False)
    section: Mapped[Optional[str]] = mapped_column(String(40))
    body: Mapped[Optional[str]] = mapped_column(Text)
    actor_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    actor_label: Mapped[Optional[str]] = mapped_column(String(320))
    at: Mapped[datetime] = TS()


class Score(Base):
    """An immutable scoring run. `inputs` is the exact evidence snapshot the
    engine consumed; recomputing with `methodology_version_id` over `inputs`
    must reproduce `result` (see cxt.scoring.reproduce)."""
    __tablename__ = "scores"
    id: Mapped[uuid.UUID] = PK()
    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id"), nullable=False)
    assessment_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("assessments.id"), nullable=False)
    score_type: Mapped[str] = mapped_column(String(10), nullable=False)            # public | company
    methodology_version_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("methodology_versions.id"), nullable=False)
    engine_version: Mapped[str] = mapped_column(String(12), nullable=False)
    fiscal_year: Mapped[Optional[int]] = mapped_column(Integer)
    overall: Mapped[Optional[float]] = mapped_column(Float)                        # NULL = insufficient evidence
    confidence: Mapped[float] = mapped_column(Float, nullable=False)               # Data Confidence Score
    evidence_coverage: Mapped[float] = mapped_column(Float, nullable=False)
    pillars: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    result: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    inputs: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    inputs_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    result_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    is_current: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    computed_at: Mapped[datetime] = TS()
    computed_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    trigger: Mapped[Optional[str]] = mapped_column(String(200))
    __table_args__ = (_enum("score_type", CHANNELS, "ck_score_type"),
                      CheckConstraint("overall IS NULL OR (overall >= 0 AND overall <= 100)", name="ck_score_range"),
                      Index("ix_score_company", "company_id", "score_type", "computed_at"),
                      Index("uq_score_current", "company_id", "score_type", unique=True,
                            postgresql_where=text("is_current")))


class CorrectionRequest(Base):
    """A company's request to correct a factual data point. Decided by
    Climactix staff; the company cannot change the record itself."""
    __tablename__ = "correction_requests"
    id: Mapped[uuid.UUID] = PK()
    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id"), nullable=False, index=True)
    data_point_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("data_points.id"))
    requested_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    organisation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organisations.id"), nullable=False)
    subject: Mapped[str] = mapped_column(String(300), nullable=False)
    current_value: Mapped[Optional[str]] = mapped_column(String(300))
    proposed_value: Mapped[str] = mapped_column(String(300), nullable=False)
    justification: Mapped[str] = mapped_column(Text, nullable=False)
    evidence_document_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("documents.id"))
    status: Mapped[str] = mapped_column(String(12), default="open", nullable=False)
    decision_note: Mapped[Optional[str]] = mapped_column(Text)
    decided_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    decided_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = TS()
    __table_args__ = (_enum("status", ("open", "accepted", "rejected"), "ck_correction_status"),)


# ── Institutional workspace and commercial model ─────────────────────────────

class Portfolio(Base):
    """Private to the owning organisation."""
    __tablename__ = "portfolios"
    id: Mapped[uuid.UUID] = PK()
    organisation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organisations.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    created_at: Mapped[datetime] = TS()
    __table_args__ = (UniqueConstraint("organisation_id", "name", name="uq_portfolio_name"),)


class PortfolioCompany(Base):
    __tablename__ = "portfolio_companies"
    portfolio_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("portfolios.id", ondelete="CASCADE"), primary_key=True)
    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id"), primary_key=True)
    note: Mapped[Optional[str]] = mapped_column(Text)
    added_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    added_at: Mapped[datetime] = TS()


class Subscription(Base):
    __tablename__ = "subscriptions"
    id: Mapped[uuid.UUID] = PK()
    organisation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organisations.id"), nullable=False, index=True)
    plan: Mapped[str] = mapped_column(String(30), nullable=False)
    status: Mapped[str] = mapped_column(String(12), default="active", nullable=False)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ends_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    entitlements: Mapped[list[Any]] = mapped_column(JSONB, default=list, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    created_at: Mapped[datetime] = TS()
    __table_args__ = (_enum("plan", PLANS, "ck_sub_plan"), _enum("status", SUB_STATUS, "ck_sub_status"))


class GeneratedReport(Base):
    __tablename__ = "generated_reports"
    id: Mapped[uuid.UUID] = PK()
    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id"), nullable=False, index=True)
    generated_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    organisation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organisations.id"), nullable=False)
    score_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("scores.id"))
    storage_key: Mapped[str] = mapped_column(String(300), nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    includes_private: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = TS()
