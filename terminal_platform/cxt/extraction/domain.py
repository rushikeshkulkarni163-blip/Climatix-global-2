"""
Domain vocabulary for the Evidence Engine.

The most important rule in this file: the states below live on SEPARATE
axes and are never collapsed into one field.

  disclosure_state   What the documents say            (DISCLOSED / NOT_DISCLOSED /
                                                        INSUFFICIENT_EVIDENCE /
                                                        CONFLICTING_DATA / NOT_APPLICABLE)
  verification_state Whether third-party assurance     (VERIFIED / UNVERIFIED)
                     covers the evidence
  review_state       Where the human workflow stands   (AI_EXTRACTED / ANALYST_VALIDATED /
                                                        ANALYST_EDITED / REJECTED /
                                                        EVIDENCE_REQUESTED)

An answer value of "NO" is only ever produced from an explicit negative
statement in a source document. Absence of evidence is NOT_DISCLOSED.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class StrEnum(str, Enum):
    def __str__(self) -> str:  # pragma: no cover - cosmetic
        return self.value


class Role(StrEnum):
    ADMIN = "ADMIN"
    ANALYST = "ANALYST"
    REVIEWER = "REVIEWER"
    AUDITOR = "AUDITOR"
    VIEWER = "VIEWER"


class DisclosureState(StrEnum):
    DISCLOSED = "DISCLOSED"
    NOT_DISCLOSED = "NOT_DISCLOSED"
    INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"
    CONFLICTING_DATA = "CONFLICTING_DATA"
    NOT_APPLICABLE = "NOT_APPLICABLE"


class VerificationState(StrEnum):
    VERIFIED = "VERIFIED"
    UNVERIFIED = "UNVERIFIED"


class ReviewState(StrEnum):
    AI_EXTRACTED = "AI_EXTRACTED"
    ANALYST_VALIDATED = "ANALYST_VALIDATED"
    ANALYST_EDITED = "ANALYST_EDITED"
    REJECTED = "REJECTED"
    EVIDENCE_REQUESTED = "EVIDENCE_REQUESTED"


class AnswerType(StrEnum):
    YES_NO = "YES_NO"
    YES_PARTIAL_NO = "YES_PARTIAL_NO"
    NUMERIC = "NUMERIC"
    PERCENTAGE = "PERCENTAGE"
    CURRENCY = "CURRENCY"
    DATE = "DATE"
    YEAR = "YEAR"
    MULTIPLE_CHOICE = "MULTIPLE_CHOICE"
    TEXT = "TEXT"
    EVIDENCE_REQUIRED = "EVIDENCE_REQUIRED"


# Categorical answer values. NOT_DISCLOSED / INSUFFICIENT_EVIDENCE are
# disclosure states, never answer values — keeping them out of this set is
# what stops "No" and "Not disclosed" from ever being stored identically.
class Categorical(StrEnum):
    YES = "YES"
    PARTIAL = "PARTIAL"
    NO = "NO"


class CommitmentClass(StrEnum):
    """Strength of a climate commitment. Ordered weakest → strongest."""
    ASPIRATIONAL = "ASPIRATIONAL"        # "we aspire / aim / ambition"
    ANNOUNCED = "ANNOUNCED"              # "we will / we plan / committed to" without a quantified target
    FORMAL_TARGET = "FORMAL_TARGET"      # quantified + time-bound
    SCIENCE_BASED = "SCIENCE_BASED"      # stated as science-based / 1.5°C aligned, not validated
    VALIDATED = "VALIDATED"              # validated / approved by SBTi
    LEGALLY_MANDATED = "LEGALLY_MANDATED"


class TargetProgress(StrEnum):
    ACHIEVED = "ACHIEVED"
    IN_PROGRESS = "IN_PROGRESS"
    MISSED = "MISSED"
    CANCELLED = "CANCELLED"
    NOT_STATED = "NOT_STATED"


class ConfidenceBand(StrEnum):
    VERY_HIGH = "VERY_HIGH"   # 95–100
    HIGH = "HIGH"             # 85–94
    MODERATE = "MODERATE"     # 70–84
    LOW = "LOW"               # 50–69
    VERY_LOW = "VERY_LOW"     # <50


def confidence_band(score: float) -> ConfidenceBand:
    if score >= 95:
        return ConfidenceBand.VERY_HIGH
    if score >= 85:
        return ConfidenceBand.HIGH
    if score >= 70:
        return ConfidenceBand.MODERATE
    if score >= 50:
        return ConfidenceBand.LOW
    return ConfidenceBand.VERY_LOW


# ── Parsed document representation (format-agnostic) ────────────────────────

@dataclass
class ParsedTable:
    index: int
    header: list[str]
    rows: list[list[str]]

    def as_text_lines(self) -> list[str]:
        lines = [" | ".join(self.header)] if self.header else []
        lines.extend(" | ".join(r) for r in self.rows)
        return lines


@dataclass
class ParsedPage:
    page_no: int                 # 1-based; for non-paginated formats a logical unit
    label: str                   # human locator: "Page 87", "Slide 4", "Sheet: GHG", "Section 3"
    text: str
    headings: list[tuple[int, str]] = field(default_factory=list)   # (level, heading)
    tables: list[ParsedTable] = field(default_factory=list)
    is_ocr: bool = False
    has_visuals: bool = False    # charts / figures / images detected on the unit


@dataclass
class ParsedDocument:
    file_format: str
    pages: list[ParsedPage]
    title: str | None = None
    warnings: list[str] = field(default_factory=list)


# ── Extraction outputs (pre-persistence) ─────────────────────────────────────

@dataclass
class EvidenceItem:
    evidence_type: str           # kpi | target | commitment | framework | physical_risk |
                                 # transition_risk | governance | assurance | policy | visual | negative
    topic: str                   # e.g. scope1_emissions, net_zero, tcfd, flood, board_oversight
    page_no: int
    quote: str
    section: str | None = None
    table_ref: str | None = None
    method: str = "pattern"      # pattern | table | llm
    confidence: float = 80.0
    attributes: dict[str, Any] = field(default_factory=dict)


@dataclass
class KPIItem:
    evidence: EvidenceItem
    metric_key: str
    metric_name: str
    metric_category: str
    value: float
    unit: str
    normalized_value: float | None
    normalized_unit: str | None
    reporting_year: int | None
    baseline_year: int | None = None
    scope: str | None = None
    geography: str | None = None
    facility: str | None = None
    methodology: str | None = None


@dataclass
class TargetItem:
    evidence: EvidenceItem
    target_kind: str             # net_zero | carbon_neutral | ghg_reduction | renewable_energy | water | waste | other
    description: str
    scope_coverage: list[str]
    commitment_class: CommitmentClass
    reduction_pct: float | None = None
    baseline_year: int | None = None
    target_year: int | None = None
    target_type: str | None = None   # absolute | intensity
    progress_status: TargetProgress = TargetProgress.NOT_STATED
    current_progress_pct: float | None = None
    framework: str | None = None
