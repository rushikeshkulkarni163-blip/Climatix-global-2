"""
Metric catalogue and the extraction entry point.

The parsing / KPI / target / signal modules in this package were carried over
from the Climactix Evidence Engine (backend/evidence_engine). This module
extends them for the Terminal:

  * financial metrics (revenue, EBITDA, capex, operating cost) with currency
    multipliers read from table headers ("₹ crore", "Rs. in lakhs");
  * count and rate metrics that carry no physical unit (employees, fatalities,
    LTIFR, training hours, environmental incidents);
  * air-emission, social and adaptation coverage;
  * image documents (PNG / JPEG / TIFF) through OCR.

The same honesty rules apply: a value is only recorded when the source states
it, a currency scale is never guessed, and OCR text is marked as OCR.
"""

from __future__ import annotations

import io
import re
import time
from dataclasses import dataclass, field

from . import classify, kpi, signals
from . import units as U
from .confidence import score_extraction
from .domain import EvidenceItem, KPIItem, ParsedDocument, ParsedPage, ParsedTable, TargetItem
from .kpi import MetricDef, extract_kpis
from .parsers import PARSERS, UnsupportedFormat, detect_format as _detect_format, parse as _parse
from .signals import Signal, extract_signals
from .targets import extract_targets
from .text import is_forward_looking, segments, stated_year

# ── Additional unit-bearing metrics (use the standard table / text paths) ────

_EXTRA_METRICS = [
    MetricDef("nox_emissions", "NOx emissions", "air", r"\bnox\b|nitrogen oxides?|oxides of nitrogen", ("mass",)),
    MetricDef("sox_emissions", "SOx emissions", "air", r"\bsox\b|\bso2\b|sulphur oxides?|sulfur oxides?|oxides of sulphur", ("mass",)),
    MetricDef("pm_emissions", "Particulate matter emissions", "air", r"particulate matter|\bpm ?(?:10|2\.5)\b|\bspm\b", ("mass",)),
    MetricDef("revenue", "Revenue", "financial",
              r"revenue from operations|total (?:revenue|income)|(?:consolidated |annual |net )?(?:revenue|turnover)\b",
              ("currency",), exclude=r"per\s|intensity|at risk|growth|% of|share of"),
    MetricDef("ebitda", "EBITDA", "financial", r"\bebitda\b", ("currency",), exclude=r"margin|%"),
    MetricDef("capex", "Capital expenditure", "financial", r"capital expenditure|\bcapex\b", ("currency",),
              exclude=r"low[- ]carbon|green|climate|decarboni|taxonomy"),
    MetricDef("operating_costs", "Operating costs", "financial",
              r"total expenses|operating (?:costs?|expenses|expenditure)|\bopex\b", ("currency",), exclude=r"per\s|%"),
    MetricDef("csr_spend", "CSR / community spend", "social",
              r"csr (?:spend|expenditure|spent)|community investment|spent on csr", ("currency",)),
    MetricDef("women_workforce_share", "Women in workforce", "social",
              r"women (?:in (?:the )?workforce|employees|representation)|female (?:employees|representation|workforce)|gender diversity",
              ("percent",), exclude=r"board|director"),
    MetricDef("women_board_share", "Women on the board", "governance",
              r"women (?:on|in) (?:the |our )?board|female directors|women directors", ("percent",)),
]
kpi.METRICS.extend(_EXTRA_METRICS)
for _m in _EXTRA_METRICS:
    kpi._METRIC_RX[_m.key] = (re.compile(_m.label, re.I), re.compile(_m.exclude, re.I) if _m.exclude else None)
    kpi.METRICS_BY_KEY[_m.key] = _m

# ── Additional qualitative signals ───────────────────────────────────────────

_EXTRA_SIGNALS = [
    Signal("adaptation", "adaptation_measures",
           r"adaptation (?:measures?|plan|strategy|actions?)|climate resilien\w+|flood (?:defen[cs]es?|protection|barriers?)|"
           r"heat action plan|business continuity plan\w*|water security (?:plan|measures)",
           r"climate|flood|heat|drought|cyclone|weather|water|resilien"),
    Signal("social", "safety_management", r"iso ?45001|occupational health and safety management|safety management system", None),
    Signal("social", "diversity_policy", r"diversity(?:,| and) (?:equity|inclusion)|equal opportunity policy|\bDEI\b", None),
    Signal("social", "community_programmes", r"community (?:development|initiatives?|programmes?|programs?)|csr (?:initiatives?|projects?|programmes?)", None),
    Signal("social", "labour_practices", r"child labou?r|forced labou?r|freedom of association|collective bargaining|minimum wages?|grievance (?:redressal|mechanism)", None),
    Signal("social", "training", r"training (?:hours|programmes?|programs?)|skill (?:development|upgradation)", r"employee|worker|workforce|staff"),
    Signal("governance", "disclosure_policy", r"disclosure policy|materiality assessment|double materiality|stakeholder engagement", None),
    Signal("governance", "environmental_management_system", r"iso ?14001|environmental management system", None),
]
signals.SIGNALS.extend(_EXTRA_SIGNALS)
signals._SIG_RX.extend((s, re.compile(s.pattern, re.I), re.compile(s.context, re.I) if s.context else None,
                        re.compile(s.exclude, re.I) if s.exclude else None) for s in _EXTRA_SIGNALS)

# ── Count / rate metrics (no physical unit) ──────────────────────────────────


@dataclass(frozen=True)
class CountDef:
    key: str
    name: str
    category: str
    label: str           # row label / phrase
    unit: str            # stored as the unit: "employees", "cases", "rate", "hours"
    text: str | None     # regex with one capture group for the number, or None (table only)
    maximum: float = 1e9


_NUM = r"(\d{1,3}(?:,\d{2,3})+(?:\.\d+)?|\d+(?:\.\d+)?)"
COUNTS: list[CountDef] = [
    CountDef("employees_total", "Total employees", "social",
             r"total (?:number of )?(?:permanent )?employees|total workforce|employees \(permanent\)|number of employees",
             "employees", rf"(?:total (?:number of )?employees|total workforce|workforce of|employs)\D{{0,25}}{_NUM}"),
    CountDef("fatalities", "Work-related fatalities", "social", r"fatalit(?:y|ies)", "cases",
             rf"{_NUM}\s+(?:work[- ]related\s+)?fatalit(?:y|ies)", 1e4),
    CountDef("ltifr", "Lost-time injury frequency rate", "social",
             r"\bltifr\b|lost[- ]time injury frequency rate", "rate",
             rf"(?:\bltifr\b|lost[- ]time injury frequency rate)\D{{0,40}}{_NUM}", 500),
    CountDef("training_hours_per_employee", "Training hours per employee", "social",
             r"(?:average )?training hours per employee|hours of training per employee", "hours",
             rf"{_NUM}\s+(?:average\s+)?(?:hours of training|training hours) per employee", 2000),
    CountDef("environmental_incidents", "Environmental incidents / non-compliances", "environmental",
             r"environmental (?:incidents?|non[- ]compliances?|violations?)|significant spills|show[- ]cause notices?",
             "cases", rf"{_NUM}\s+(?:significant\s+)?(?:environmental (?:incidents?|non[- ]compliances?|violations?)|spills)", 1e5),
]
_COUNT_RX = {c.key: (re.compile(c.label, re.I), re.compile(c.text, re.I) if c.text else None) for c in COUNTS}

# ── Catalogue: every metric the Terminal stores ──────────────────────────────

_CATEGORY_MAP = {"carbon": "climate", "energy": "environmental", "water": "environmental", "waste": "environmental",
                 "air": "environmental", "transition": "climate"}

CATALOGUE: dict[str, dict] = {}
for _m in kpi.METRICS:
    CATALOGUE[_m.key] = {"name": _m.name, "category": _CATEGORY_MAP.get(_m.category, _m.category),
                         "group": _m.category, "families": list(_m.families), "kind": "numeric"}
for _c in COUNTS:
    CATALOGUE[_c.key] = {"name": _c.name, "category": _c.category, "group": _c.category,
                         "families": ["count"], "kind": "numeric"}

SIGNAL_CATEGORY = {"physical_risk": "climate", "transition_risk": "climate", "governance": "governance",
                   "assurance": "governance", "policy": "governance", "nature": "environmental",
                   "waste": "environmental", "offsets": "climate", "claim": "climate", "framework": "governance",
                   "adaptation": "climate", "social": "social", "negative": "governance", "commitment": "climate"}


def signal_key(item: EvidenceItem) -> str:
    return f"negative.{item.topic}" if item.evidence_type == "negative" else f"{item.evidence_type}.{item.topic}"


def metric_name(key: str) -> str:
    if key in CATALOGUE:
        return CATALOGUE[key]["name"]
    return key.split(".", 1)[-1].replace("_", " ").capitalize()


# ── Currency scale from table labels ─────────────────────────────────────────

_CUR = r"(₹|us\$|\$|€|£|(?<![A-Za-z])(?:rs\.?|inr|usd|eur|gbp)(?![A-Za-z]))"
_SCALE = r"(crores?|cr\.?|lakhs?|lacs?|millions?|mn|billions?|bn|thousands?|'?000s?)"
_CUR_LABEL = re.compile(rf"{_CUR}\s*\.?\s*(?:in\s+)?{_SCALE}?|(?:in|amount in)\s+{_CUR}?\s*{_SCALE}", re.I)
_SCALE_FACTOR = {"crore": 1e7, "crores": 1e7, "cr": 1e7, "lakh": 1e5, "lakhs": 1e5, "lac": 1e5, "lacs": 1e5,
                 "million": 1e6, "millions": 1e6, "mn": 1e6, "billion": 1e9, "billions": 1e9, "bn": 1e9,
                 "thousand": 1e3, "thousands": 1e3, "000": 1e3, "000s": 1e3}


def currency_from_label(label: str) -> tuple[str, float, str] | None:
    """('INR', 1e7, 'INR crore') from 'Revenue (₹ crore)' / 'Rs. in lakhs'. None when
    no currency is stated — a scale is never assumed."""
    m = _CUR_LABEL.search(label)
    if not m:
        return None
    cur = next((g for g in (m.group(1), m.group(3)) if g), None)
    scale = next((g for g in (m.group(2), m.group(4)) if g), None)
    if not cur:
        return None
    code = U._CURRENCY_CANON.get(cur.lower().rstrip("."), cur.upper())
    s = (scale or "").lower().strip("'.")
    factor = _SCALE_FACTOR.get(s, 1.0)
    return code, factor, f"{code} {s}".strip()


def _year_columns(header: list[str]) -> dict[int, int | None]:
    cols = {i: y for i, h in enumerate(header) if (y := U.year_from_header(h))}
    if cols:
        return cols
    return {i: None for i, h in enumerate(header) if re.search(r"value|amount|total|current year|number", h, re.I)}


def _table_extras(page: ParsedPage, section: str | None, doc_year: int | None) -> list[KPIItem]:
    """Currency and count metrics from tables (the standard table path only
    accepts physical units)."""
    out: list[KPIItem] = []
    for t in page.tables:
        header = [h or "" for h in t.header]
        cols = _year_columns(header)
        if not cols:
            continue
        header_cur = next((c for h in header if (c := currency_from_label(h))), None)
        for r_idx, row in enumerate(t.rows):
            if not row or not row[0]:
                continue
            label = row[0]
            quote = f"{label} | " + " | ".join(f"{header[i]}: {row[i]}" for i in cols if i < len(row))
            ref = f"Table {t.index}, row {r_idx + 1}"

            defn = kpi._best_metric(label)
            if defn and "currency" in defn.families:
                cur = currency_from_label(label) or header_cur
                if cur:
                    code, factor, unit = cur
                    for c_idx, year in cols.items():
                        v = U.parse_cell_number(row[c_idx]) if c_idx < len(row) else None
                        if v is None:
                            continue
                        ev = EvidenceItem("kpi", defn.key, page.page_no, quote[:600], section, ref, "table", 0,
                                          {"year_basis": "column_header" if year else "document_default",
                                           "unit_basis": "row_or_header_label", "is_ocr": page.is_ocr,
                                           "column": header[c_idx]})
                        out.append(KPIItem(ev, defn.key, defn.name, defn.category, v, unit, v * factor, code,
                                           year or doc_year))
                continue

            for c in COUNTS:
                if not _COUNT_RX[c.key][0].search(label):
                    continue
                for c_idx, year in cols.items():
                    v = U.parse_cell_number(row[c_idx]) if c_idx < len(row) else None
                    if v is None or v < 0 or v > c.maximum:
                        continue
                    ev = EvidenceItem("kpi", c.key, page.page_no, quote[:600], section, ref, "table", 0,
                                      {"year_basis": "column_header" if year else "document_default",
                                       "unit_basis": "count", "is_ocr": page.is_ocr, "column": header[c_idx]})
                    out.append(KPIItem(ev, c.key, c.name, c.category, v, c.unit, v, c.unit, year or doc_year))
                break
    return out


def _text_counts(page: ParsedPage, segs, section: str | None, doc_year: int | None) -> list[KPIItem]:
    out: list[KPIItem] = []
    for seg in segs:
        s = seg.text
        if len(s) < 12 or is_forward_looking(s, doc_year):
            continue
        for c in COUNTS:
            rx = _COUNT_RX[c.key][1]
            m = rx.search(s) if rx else None
            if not m:
                continue
            v = float(m.group(1).replace(",", ""))
            if v > c.maximum or re.fullmatch(r"(19|20)\d\d", m.group(1)):
                continue
            yr = stated_year(s)
            ev = EvidenceItem("kpi", c.key, page.page_no, s[:600], section, None, "pattern", 0,
                              {"year_basis": "stated" if yr else "document_default", "unit_basis": "count",
                               "is_ocr": page.is_ocr, "matched_value": m.group(1)})
            out.append(KPIItem(ev, c.key, c.name, c.category, v, c.unit, v, c.unit, yr or doc_year))
    return out


# ── Parsing (adds image documents) ───────────────────────────────────────────

IMAGE_EXT = (".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp", ".webp")
_IMAGE_MAGIC = (b"\x89PNG", b"\xff\xd8\xff", b"II*\x00", b"MM\x00*", b"BM", b"RIFF")


def ocr_available() -> bool:
    try:
        import pytesseract
        pytesseract.get_tesseract_version()
        return True
    except Exception:
        return False


def parse_image(content: bytes) -> ParsedDocument:
    """One-page document from an image. If OCR is unavailable the page is
    returned empty with a warning; the pipeline routes it to manual review."""
    text, warnings = "", []
    try:
        import pytesseract
        from PIL import Image
        img = Image.open(io.BytesIO(content))
        img.load()
        text = pytesseract.image_to_string(img) or ""
    except ImportError:
        warnings.append("OCR libraries are not installed")
    except Exception as e:  # tesseract binary missing, corrupt image, ...
        warnings.append(f"OCR unavailable: {type(e).__name__}")
    return ParsedDocument("image", [ParsedPage(1, "Image", text, is_ocr=True, has_visuals=True)], warnings=warnings)


def detect_format(filename: str, content: bytes, content_type: str = "") -> str:
    if filename.lower().endswith(IMAGE_EXT):
        if not content.startswith(_IMAGE_MAGIC):
            raise UnsupportedFormat(f"{filename}: content is not a recognised image")
        return "image"
    if filename.lower().endswith(".xls") or filename.lower().endswith(".doc"):
        raise UnsupportedFormat("Legacy .doc / .xls files are not supported; convert to .docx / .xlsx")
    return _detect_format(filename, content, content_type)


def parse(content: bytes, file_format: str) -> ParsedDocument:
    return parse_image(content) if file_format == "image" else _parse(content, file_format)


# ── Extraction entry point ───────────────────────────────────────────────────

@dataclass
class Extraction:
    parsed: ParsedDocument
    detected_type: str
    type_basis: dict
    reporting_year: int | None
    year_basis: str
    page_section: dict[int, str]
    evidence: list[EvidenceItem] = field(default_factory=list)
    kpis: list[KPIItem] = field(default_factory=list)
    targets: list[TargetItem] = field(default_factory=list)
    stages: list[dict] = field(default_factory=list)


def run_extraction(parsed: ParsedDocument, filename: str, declared_year: int | None) -> Extraction:
    """Classify and extract from an already-parsed document. Pure function of
    its inputs: the same document always yields the same extraction."""
    stages: list[dict] = []
    t0 = time.perf_counter()

    def stage(name: str, **detail):
        nonlocal t0
        stages.append({"stage": name, "ms": round((time.perf_counter() - t0) * 1000), **detail})
        t0 = time.perf_counter()

    dtype, basis = classify.classify_document(parsed, filename)
    inferred = classify.infer_reporting_year(parsed)
    year = declared_year or inferred
    year_basis = "declared" if declared_year else ("inferred from document" if inferred else "unknown")
    stage("classification", detected_type=dtype, reporting_year=year, year_basis=year_basis)

    page_section, spans = classify.build_section_map(parsed)
    stage("section_detection", sections=len(spans), tables=sum(len(p.tables) for p in parsed.pages))

    ex = Extraction(parsed, dtype, basis, year, year_basis, page_section)
    for page in parsed.pages:
        sec = page_section.get(page.page_no)
        segs = segments(page.text)
        k, visuals = extract_kpis(page, sec, year, segs)
        for item in k:   # currency read from prose: keep the stated currency as the normalised unit
            if item.normalized_value is None and item.unit in U._CURRENCY_CANON.values():
                item.normalized_value, item.normalized_unit = item.value, item.unit
        seen = {(x.metric_key, x.reporting_year, round(x.value, 4)) for x in k}
        for item in _table_extras(page, sec, year) + _text_counts(page, segs, sec, year):
            key = (item.metric_key, item.reporting_year, round(item.value, 4))
            if key not in seen:
                seen.add(key)
                k.append(item)
        tg, commitments = extract_targets(page, sec, year, segs)
        ex.kpis.extend(k)
        ex.targets.extend(tg)
        ex.evidence.extend(visuals)
        ex.evidence.extend(commitments)
        ex.evidence.extend(extract_signals(page, sec, segs))
    stage("structured_extraction", kpis=len(ex.kpis), targets=len(ex.targets), signals=len(ex.evidence))

    for item in [*ex.evidence, *(k.evidence for k in ex.kpis), *(x.evidence for x in ex.targets)]:
        sc = score_extraction(item)
        item.confidence = sc.value
        item.attributes["confidence_factors"] = [f.as_dict() for f in sc.factors]
    stage("extraction_confidence")
    ex.stages = stages
    return ex


__all__ = ["CATALOGUE", "COUNTS", "Extraction", "PARSERS", "UnsupportedFormat", "ParsedTable", "detect_format",
           "metric_name", "ocr_available", "parse", "run_extraction", "signal_key", "SIGNAL_CATEGORY"]
