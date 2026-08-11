"""
Shared provenance-carrying result type for every Earth Observation connector.

Spec rule (§16/§38): every satellite-derived or climate-derived value must
travel with its source, method, resolution, confidence and observation
category — never a bare number. Encoding that structurally here means the
API router can't accidentally drop provenance, rather than relying on every
endpoint remembering to attach it.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional


class ObservationType(str, Enum):
    """Spec §38 — these categories must never be mixed or presented as each other."""

    DIRECT_OBSERVATION = "DIRECT_OBSERVATION"
    DERIVED_INDICATOR = "DERIVED_INDICATOR"
    MODELLED = "MODELLED"
    REANALYSIS = "REANALYSIS"
    SCENARIO_PROJECTION = "SCENARIO_PROJECTION"
    PROXY = "PROXY"
    COMPANY_REPORTED = "COMPANY_REPORTED"


class Confidence(str, Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


@dataclass
class Provenance:
    source: str
    method: str
    observation_type: ObservationType
    resolution: str
    confidence: Confidence
    date: str
    demo: bool
    coverage: str = "Global"
    attribution: Optional[str] = None
    limitations: Optional[str] = None

    def as_dict(self) -> dict:
        return {
            "source": self.source,
            "method": self.method,
            "observation_type": self.observation_type.value,
            "resolution": self.resolution,
            "confidence": self.confidence.value,
            "date": self.date,
            "demo": self.demo,
            "coverage": self.coverage,
            "attribution": self.attribution,
            "limitations": self.limitations,
        }


@dataclass
class ConnectorResult:
    """What every connector function returns — data plus mandatory provenance."""

    data: Any
    provenance: Provenance
    error: Optional[str] = None

    @property
    def ok(self) -> bool:
        return self.error is None

    def as_dict(self) -> dict:
        return {
            "data": self.data,
            "provenance": self.provenance.as_dict(),
            "error": self.error,
        }


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def unavailable(source: str, reason: str) -> ConnectorResult:
    """
    Spec §28: an external provider failing must never break Climactix or
    leak provider internals. Callers surface this as the exact spec copy —
    'Earth observation data temporarily unavailable.' — not `reason` itself.
    """
    return ConnectorResult(
        data=None,
        provenance=Provenance(
            source=source,
            method="unavailable",
            observation_type=ObservationType.DIRECT_OBSERVATION,
            resolution="n/a",
            confidence=Confidence.LOW,
            date=now_iso(),
            demo=False,
        ),
        error=reason,
    )
