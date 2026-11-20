"""
Extraction confidence.

Every score here answers ONE question: "how sure are we that the documents
say this?" It never measures whether what they say is good climate
performance. Each score carries its factor breakdown so an analyst can see
exactly why it is 96 and not 70.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .domain import EvidenceItem, confidence_band

# Source quality by document type — how authoritative a disclosure channel is
# for a factual claim. Assured / regulated filings rank above marketing decks.
SOURCE_QUALITY: dict[str, int] = {
    "ASSURANCE_STATEMENT": 8, "ANNUAL_REPORT": 6, "REGULATORY_FILING": 6, "BRSR": 6, "BRSR_CORE": 7,
    "INTEGRATED_REPORT": 5, "CDP_DISCLOSURE": 5, "ISSB_DISCLOSURE": 5, "TCFD_REPORT": 4,
    "GHG_INVENTORY": 6, "SUSTAINABILITY_REPORT": 4, "CLIMATE_REPORT": 4, "NET_ZERO_PLAN": 3,
    "POLICY": 2, "WATER_REPORT": 3, "HUMAN_RIGHTS_REPORT": 3,
    "INVESTOR_PRESENTATION": -4, "OTHER": -3,
}

_BASE_BY_TYPE = {"kpi": 82, "target": 84, "commitment": 78, "framework": 80, "negative": 86,
                 "assurance": 84, "visual": 30}


@dataclass
class Factor:
    factor: str
    effect: float
    detail: str

    def as_dict(self) -> dict:
        return {"factor": self.factor, "effect": round(self.effect, 1), "detail": self.detail}


@dataclass
class Score:
    value: float
    factors: list[Factor] = field(default_factory=list)

    @property
    def band(self) -> str:
        return confidence_band(self.value).value

    def as_dict(self) -> dict:
        return {"value": round(self.value, 1), "band": self.band, "factors": [f.as_dict() for f in self.factors]}


def _clamp(v: float) -> float:
    return max(5.0, min(99.0, v))


def score_extraction(item: EvidenceItem) -> Score:
    base = _BASE_BY_TYPE.get(item.evidence_type, 78)
    factors = [Factor("extraction_certainty", base, f"{item.evidence_type} via {item.method}")]
    a = item.attributes
    if item.method == "table":
        factors.append(Factor("extraction_certainty", +8, "value read from a structured table cell"))
    if a.get("year_basis") in ("stated", "column_header"):
        factors.append(Factor("exactness", +5, "reporting year stated next to the value"))
    elif a.get("year_basis") == "document_default":
        factors.append(Factor("exactness", -8, "reporting year inferred from the document, not stated with the value"))
    if a.get("competing_values"):
        n = min(int(a["competing_values"]), 3)
        factors.append(Factor("evidence_clarity", -4 * n, f"{n} other value(s) of the same unit family in the sentence"))
    if a.get("is_ocr"):
        factors.append(Factor("extraction_certainty", -15, "page text obtained by OCR"))
    if item.evidence_type == "framework":
        rel = a.get("relation")
        eff = {"in_accordance": +8, "aligned": +4, "responded": +4, "with_reference": 0, "mention": -12}.get(rel, 0)
        factors.append(Factor("exactness", eff, f"framework relation: {rel}"))
    if item.evidence_type in ("target", "commitment"):
        if a.get("time_bound"):
            factors.append(Factor("exactness", +4, "time-bound"))
        if a.get("class_basis") == "adjacent sentence":
            factors.append(Factor("evidence_clarity", -4, "commitment class read from the adjacent sentence"))
    if len(item.quote) > 450:
        factors.append(Factor("evidence_clarity", -4, "long passage — fact is less isolated"))
    return Score(_clamp(sum(f.effect for f in factors)), factors)


@dataclass
class SupportRow:
    evidence_id: str
    document_id: str
    document_type: str
    document_year: int | None
    extraction_confidence: float


def score_answer(*, supporting: list[SupportRow], exactness: float, exactness_detail: str,
                 assessment_year: int | None, contradicting: int = 0, numeric_conflict: bool = False,
                 framework_consistent: bool | None = None) -> Score:
    """Aggregate confidence that an AI-suggested answer reflects what the documents disclose."""
    if not supporting:
        return Score(0.0, [Factor("evidence", 0, "no supporting evidence")])
    best = max(supporting, key=lambda r: r.extraction_confidence)
    factors = [Factor("extraction_certainty", best.extraction_confidence * 0.85,
                      f"strongest evidence item extracted at {best.extraction_confidence:.0f}")]

    sq = SOURCE_QUALITY.get(best.document_type, 0)
    factors.append(Factor("source_quality", sq, f"strongest source is {best.document_type.replace('_', ' ').lower()}"))

    factors.append(Factor("exactness", (exactness - 0.5) * 20, exactness_detail))

    docs = {r.document_id for r in supporting}
    if len(docs) > 1:
        factors.append(Factor("multi_source_confirmation", min(4 * (len(docs) - 1), 10),
                              f"confirmed in {len(docs)} documents"))

    if assessment_year and best.document_year:
        lag = assessment_year - best.document_year
        if lag >= 3:
            factors.append(Factor("document_recency", -min(4 * (lag - 1), 15), f"source is {lag} years older than the assessment year"))
        elif lag <= 1:
            factors.append(Factor("document_recency", +2, "source is current"))

    if numeric_conflict:
        factors.append(Factor("numerical_consistency", -25, "documents report different values"))
    if contradicting:
        factors.append(Factor("contradictory_evidence", -12 * min(contradicting, 2), f"{contradicting} contradicting passage(s)"))
    if framework_consistent is False:
        factors.append(Factor("framework_consistency", -6, "framework references disagree across documents"))

    return Score(_clamp(sum(f.effect for f in factors)), factors)
