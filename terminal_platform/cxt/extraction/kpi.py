"""
KPI extraction engine.

Two paths, both provenance-preserving:

  table path  A parsed table row whose label matches a metric definition and
              whose columns are reporting years → one KPI per year cell. The
              unit must come from the row label, a unit column or the header.
  text path   A sentence containing a metric label and a number with a unit
              of the metric's family (e.g. tCO2e for Scope 1).

Guards that keep the register honest:
  * forward-looking sentences ("reduce Scope 1 by 50% by 2030") are left to
    the target extractor, never read as reported values;
  * a number without a recognised unit is never assigned one;
  * a metric whose page shows a chart but whose value is not in the text
    layer is recorded as VISUAL_ONLY ("Visual evidence detected — numerical
    extraction unavailable"), never estimated.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from .domain import EvidenceItem, KPIItem, ParsedPage
from . import units as U
from .text import Segment, baseline_year, is_forward_looking, segments, stated_year


@dataclass(frozen=True)
class MetricDef:
    key: str
    name: str
    category: str
    label: str                  # regex matched against sentence / row label
    families: tuple[str, ...]   # accepted unit families
    scope: str | None = None
    exclude: str | None = None  # regex that disqualifies a match (e.g. "location" for market-based)
    sectors: tuple[str, ...] = ()


S = r"(?:scope|scopes)\s?"
METRICS: list[MetricDef] = [
    # ── Carbon ──────────────────────────────────────────────────────────────
    MetricDef("scope1_emissions", "Scope 1 emissions", "carbon", rf"{S}1\b(?!\s?(?:and|\+|&|,)\s?2)(?:\s+(?:ghg\s+)?emissions)?|direct (?:ghg )?emissions",
              ("ghg",), "Scope 1", exclude=r"intensity|per\s|/|target"),
    MetricDef("scope2_market", "Scope 2 emissions (market-based)", "carbon", rf"{S}2\b.{{0,40}}market[- ]based|market[- ]based.{{0,40}}{S}2\b",
              ("ghg",), "Scope 2 (market-based)", exclude=r"intensity|target"),
    MetricDef("scope2_location", "Scope 2 emissions (location-based)", "carbon", rf"{S}2\b.{{0,40}}location[- ]based|location[- ]based.{{0,40}}{S}2\b",
              ("ghg",), "Scope 2 (location-based)", exclude=r"intensity|target"),
    MetricDef("scope2_emissions", "Scope 2 emissions (method not stated)", "carbon", rf"{S}2\b(?!\s?(?:and|\+|&|,)\s?3)|indirect (?:ghg )?emissions from (?:purchased )?(?:electricity|energy)",
              ("ghg",), "Scope 2", exclude=rf"market[- ]based|location[- ]based|intensity|target|{S}1\s?(?:and|\+|&|,)"),
    MetricDef("scope1_2_emissions", "Scope 1+2 emissions", "carbon", rf"{S}1\s?(?:and|\+|&|,)\s?2\b(?!\s?(?:and|\+|&|,)\s?3)",
              ("ghg",), "Scope 1+2", exclude=r"intensity|target|reduc"),
    MetricDef("scope3_emissions", "Scope 3 emissions", "carbon", rf"{S}3\b|value chain emissions",
              ("ghg",), "Scope 3", exclude=rf"intensity|categor(?:y|ies)\s?\d|target|{S}1\s?(?:and|\+|&|,)"),
    MetricDef("total_ghg_emissions", "Total GHG emissions", "carbon", r"total (?:ghg|greenhouse gas|carbon) emissions|total emissions|gross (?:ghg )?emissions",
              ("ghg",), "Total", exclude=r"intensity|target"),
    MetricDef("emissions_intensity", "GHG emissions intensity", "carbon", r"(?:emissions?|ghg|carbon) intensity",
              ("intensity",)),
    MetricDef("base_year_emissions", "Base-year emissions", "carbon", r"base[- ]year emissions|baseline emissions",
              ("ghg",)),
    MetricDef("carbon_credits_retired", "Carbon credits / offsets retired", "carbon", r"(?:carbon credits|offsets?)\b.{0,40}(?:retired|purchased|used|cancelled)|(?:retired|purchased)\b.{0,30}(?:carbon credits|offsets)",
              ("ghg",)),
    MetricDef("methane_emissions", "Methane emissions", "carbon", r"methane|\bch4\b|\bch₄\b", ("ghg", "mass")),
    MetricDef("financed_emissions", "Financed emissions", "carbon", r"financed emissions", ("ghg",), sectors=("banking",)),
    # ── Energy ──────────────────────────────────────────────────────────────
    MetricDef("total_energy", "Total energy consumption", "energy", r"total energy (?:consumption|consumed|use)|energy consumption within the organi[sz]ation",
              ("energy",), exclude=r"intensity|per\s|renewable share"),
    MetricDef("electricity_consumption", "Electricity consumption", "energy", r"(?:total )?electricity (?:consumption|consumed|use|purchased)|purchased electricity",
              ("energy",), exclude=r"renewable|intensity|%"),
    MetricDef("renewable_electricity_share", "Renewable electricity share", "energy", r"renewable electricity|electricity (?:from|sourced from) renewable",
              ("percent",)),
    MetricDef("renewable_energy_share", "Renewable energy share", "energy", r"renewable energy (?:share|mix|consumption|use)|share of renewable energy|renewables? (?:accounted|made up|represented)",
              ("percent",), exclude=r"electricity"),
    MetricDef("renewable_electricity", "Renewable electricity consumed", "energy", r"renewable (?:electricity|energy) (?:consumed|consumption|procured|purchased)",
              ("energy",)),
    MetricDef("onsite_renewable_generation", "On-site renewable generation", "energy", r"on[- ]site (?:solar|renewable|generation)|rooftop solar", ("energy",)),
    MetricDef("fossil_fuel_consumption", "Fossil fuel consumption", "energy", r"fossil fuel (?:consumption|use)|(?:diesel|natural gas|coal|fuel oil) consumption", ("energy",)),
    MetricDef("energy_intensity", "Energy intensity", "energy", r"energy intensity", ("intensity",)),
    MetricDef("recs_purchased", "Renewable energy certificates", "energy", r"renewable energy certificates|\brecs\b|i-recs|guarantees of origin", ("energy",)),
    # ── Water ───────────────────────────────────────────────────────────────
    MetricDef("water_withdrawal", "Water withdrawal", "water", r"(?:total )?water withdrawal|water withdrawn", ("volume",), exclude=r"intensity"),
    MetricDef("water_consumption", "Water consumption", "water", r"(?:total )?water consumption|water consumed", ("volume",), exclude=r"intensity"),
    MetricDef("water_discharge", "Water discharge", "water", r"water discharge|water discharged|effluent discharge", ("volume",)),
    MetricDef("water_recycled", "Water recycled / reused", "water", r"water (?:recycled|reused|recycling)|recycled water", ("volume", "percent")),
    MetricDef("water_intensity", "Water intensity", "water", r"water intensity", ("intensity",)),
    # ── Waste ───────────────────────────────────────────────────────────────
    MetricDef("total_waste", "Total waste generated", "waste", r"total waste(?: generated)?|waste generated", ("mass",), exclude=r"hazardous"),
    MetricDef("hazardous_waste", "Hazardous waste", "waste", r"(?<!non-)(?<!non )hazardous waste", ("mass",)),
    MetricDef("non_hazardous_waste", "Non-hazardous waste", "waste", r"non[- ]hazardous waste", ("mass",)),
    MetricDef("waste_diversion_rate", "Waste diverted from disposal", "waste", r"waste (?:diverted|diversion)|diverted from landfill|waste recycled", ("percent", "mass")),
    # ── Capital / finance ───────────────────────────────────────────────────
    MetricDef("low_carbon_capex", "Low-carbon / green capex", "transition", r"(?:low[- ]carbon|green|climate|decarboni[sz]ation|taxonomy[- ]aligned) (?:capex|capital expenditure|investment)",
              ("currency", "percent")),
    MetricDef("internal_carbon_price", "Internal carbon price", "transition", r"internal carbon pric(?:e|ing)|shadow carbon price", ("currency",)),
    MetricDef("green_finance", "Green / sustainable finance", "transition", r"green (?:loans?|bonds?|finance)|sustainable finance|sustainability[- ]linked", ("currency",), sectors=("banking",)),
    # ── Sector-specific ─────────────────────────────────────────────────────
    MetricDef("fleet_fuel_consumption", "Fleet fuel consumption", "energy", r"(?:fleet|bunker|marine) fuel (?:consumption|consumed)", ("mass", "energy"), sectors=("shipping",)),
    MetricDef("building_energy_intensity", "Building energy intensity", "energy", r"(?:building|portfolio) energy intensity", ("intensity",), sectors=("real_estate",)),
]

_METRIC_RX = {m.key: (re.compile(m.label, re.I), re.compile(m.exclude, re.I) if m.exclude else None) for m in METRICS}
METRICS_BY_KEY = {m.key: m for m in METRICS}

_CHART_WORDS = re.compile(r"\b(?:figure|fig\.|chart|graph|exhibit)\b", re.I)


def _label_matches(defn: MetricDef, label: str) -> bool:
    rx, ex = _METRIC_RX[defn.key]
    return bool(rx.search(label)) and not (ex and ex.search(label))


def _best_metric(label: str) -> MetricDef | None:
    """Most specific metric for a label (longest regex match wins)."""
    best, best_len = None, 0
    for d in METRICS:
        if not _label_matches(d, label):
            continue
        n = len(_METRIC_RX[d.key][0].search(label).group(0))
        if n > best_len:
            best, best_len = d, n
    return best


# ── Table path ───────────────────────────────────────────────────────────────

def _table_kpis(page: ParsedPage, section: str | None, doc_year: int | None) -> list[KPIItem]:
    out: list[KPIItem] = []
    for t in page.tables:
        header = [h or "" for h in t.header]
        year_cols = {i: y for i, h in enumerate(header) if (y := U.year_from_header(h))}
        unit_col = next((i for i, h in enumerate(header) if re.fullmatch(r"\s*(?:unit|units|uom)s?\s*", h, re.I)), None)
        value_cols = year_cols or {i: None for i, h in enumerate(header)
                                   if re.search(r"value|amount|total|current year", h, re.I)}
        if not value_cols:
            continue
        header_unit = next((u for h in header if (u := U.unit_from_label(h))), None)
        for r_idx, row in enumerate(t.rows):
            if not row:
                continue
            label = row[0]
            defn = _best_metric(label)
            if not defn:
                continue
            unit = U.unit_from_label(label)
            if not unit and unit_col is not None and unit_col < len(row):
                u = U.match_unit(row[unit_col], 0)
                if u:
                    unit = (u[0], u[1], u[2])
                elif re.search(r"(?:₹|inr|usd|\$|eur|€)", row[unit_col], re.I):
                    unit = (row[unit_col].strip(), "currency", 1.0)
            unit = unit or header_unit
            if not unit:
                continue           # never assign a unit that the document does not state
            canon, fam, factor = unit
            if fam not in defn.families:
                continue
            for c_idx, year in value_cols.items():
                if c_idx >= len(row):
                    continue
                v = U.parse_cell_number(row[c_idx])
                if v is None:
                    continue
                yr = year or doc_year
                quote = f"{label} | " + " | ".join(f"{header[i]}: {row[i]}" for i in value_cols if i < len(row))
                ev = EvidenceItem(
                    evidence_type="kpi", topic=defn.key, page_no=page.page_no, quote=quote[:600],
                    section=section, table_ref=f"Table {t.index}, row {r_idx + 1}", method="table",
                    confidence=0,  # set by confidence.score_extraction
                    attributes={"year_basis": "column_header" if year else "document_default",
                                "unit_basis": "row_or_header_label", "is_ocr": page.is_ocr,
                                "column": header[c_idx]})
                base = v * factor if fam in ("ghg", "energy", "volume", "mass", "percent") else None
                out.append(KPIItem(evidence=ev, metric_key=defn.key, metric_name=defn.name,
                                   metric_category=defn.category, value=v, unit=canon,
                                   normalized_value=base, normalized_unit=_base(fam),
                                   reporting_year=yr, scope=defn.scope,
                                   baseline_year=yr if re.search(r"base", header[c_idx], re.I) else None))
    return out


def _base(fam: str) -> str | None:
    return {"ghg": "tCO2e", "energy": "MWh", "volume": "m3", "mass": "t", "percent": "%"}.get(fam)


# ── Text path ────────────────────────────────────────────────────────────────

def _text_kpis(page: ParsedPage, segs: list[Segment], section: str | None, doc_year: int | None) -> list[KPIItem]:
    out: list[KPIItem] = []
    for seg in segs:
        s = seg.text
        if len(s) < 12 or is_forward_looking(s, doc_year):
            continue
        quantities = U.find_quantities(s)
        if not quantities:
            continue
        # Run-on table text (many bare numbers, no structure) is handled by the
        # table path; reading it here would mis-assign years.
        bare_numbers = len(re.findall(r"(?<![\w.])\d{1,3}(?:,\d{3})+(?![\w%])", s))
        if page.tables and bare_numbers >= 3:
            continue
        for defn in METRICS:
            rx, ex = _METRIC_RX[defn.key]
            m = rx.search(s)
            if not m:
                continue
            if ex and ex.search(s[max(0, m.start() - 20):m.end() + 60]):
                continue
            # nearest quantity of an accepted family, preferring ones after the label
            cands = [q for q in quantities if q.family in defn.families]
            if not cands:
                continue
            q = min(cands, key=lambda q: (q.start < m.start(), abs(q.start - m.end())))
            if abs(q.start - m.end()) > 140 and abs(m.start() - q.end) > 80:
                continue
            # Another metric label sitting between label and value means the value belongs to it.
            between = s[min(m.end(), q.end):max(m.start(), q.start)]
            if re.search(r"\bscope\s?[123]\b", between, re.I) and defn.key.startswith("scope"):
                continue
            yr = stated_year(s)
            ev = EvidenceItem(
                evidence_type="kpi", topic=defn.key, page_no=page.page_no, quote=s[:600], section=section,
                method="pattern", confidence=0,
                attributes={"year_basis": "stated" if yr else "document_default", "unit_basis": "inline",
                            "is_ocr": page.is_ocr, "matched_label": m.group(0), "matched_value": q.raw,
                            "competing_values": len(cands) - 1})
            out.append(KPIItem(evidence=ev, metric_key=defn.key, metric_name=defn.name,
                               metric_category=defn.category, value=q.value, unit=q.unit,
                               normalized_value=q.base_value, normalized_unit=q.base_unit,
                               reporting_year=yr or doc_year, baseline_year=baseline_year(s),
                               scope=defn.scope))
    return out


def _visual_only(page: ParsedPage, segs: list[Segment], found: set[str], section: str | None) -> list[EvidenceItem]:
    """Charts that depict a metric whose value is not in the text layer."""
    if not page.has_visuals:
        return []
    out = []
    for seg in segs:
        if not _CHART_WORDS.search(seg.text):
            continue
        for defn in METRICS:
            if defn.key in found:
                continue
            if _label_matches(defn, seg.text) and not U.find_quantities(seg.text):
                out.append(EvidenceItem(
                    evidence_type="visual", topic=defn.key, page_no=page.page_no, quote=seg.text[:400],
                    section=section, method="pattern", confidence=0,
                    attributes={"status": "Visual evidence detected — numerical extraction unavailable",
                                "metric_name": defn.name}))
                found.add(defn.key)
    return out


def extract_kpis(page: ParsedPage, section: str | None, doc_year: int | None,
                 segs: list[Segment] | None = None) -> tuple[list[KPIItem], list[EvidenceItem]]:
    segs = segs if segs is not None else segments(page.text)
    kpis = _table_kpis(page, section, doc_year)
    seen = {(k.metric_key, k.reporting_year, round(k.value, 4)) for k in kpis}
    for k in _text_kpis(page, segs, section, doc_year):
        key = (k.metric_key, k.reporting_year, round(k.value, 4))
        if key not in seen:
            seen.add(key)
            kpis.append(k)
    visuals = _visual_only(page, segs, {k.metric_key for k in kpis}, section)
    return kpis, visuals
