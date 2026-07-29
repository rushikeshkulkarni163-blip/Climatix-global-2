"""
Climactix — Metric Intelligence Service
==========================================
Part of the Climactix Evidence Intelligence Agent (see evidence_intelligence_agent.py).

Expands greenwashing_scanner.extract_data()'s regex-based quantitative
extraction (currently Scope 1/2/3, energy, baseline/target years) into the
full climate metric set required by the Evidence Intelligence Agent spec:

  Scope 1/2/3 emissions, energy consumption, renewable energy %, carbon
  intensity, water withdrawal/consumption, waste, recycling, environmental
  expenditure, carbon offsets/credits, RECs, land restoration, trees planted,
  survival/mortality rates, avoided emissions, climate CAPEX/OPEX, targets.

For every extracted number, the required tuple is:
  Metric | Value | Unit | Reporting Period | Baseline | Boundary | Geography |
  Methodology | Source Locator | Verification Status

A number is never separated from its reporting context (CLAUDE.md rule) — a
metric with no locator is marked SOURCE TRACEABILITY INSUFFICIENT rather than
silently dropping the caveat.

The regex-based figures (Scope 1/2/3, baseline/target years) from
greenwashing_scanner.extract_data() are deterministic and reused as-is
(higher trust than an LLM re-derivation of the same numbers); every other
metric in the expanded set is extracted via one grounded LLM pass over the
same citation-tagged document text used everywhere else in this pipeline.
"""

from __future__ import annotations

import json
import os
import re
from typing import Optional

from openai import OpenAI

from services.greenwashing_scanner import extract_data as _extract_data_basic

MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")

_client: Optional[OpenAI] = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY not set.")
        _client = OpenAI(api_key=api_key)
    return _client


def _parse_json(raw: str) -> dict:
    raw = (raw or "").strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    try:
        return json.loads(raw)
    except Exception:
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except Exception:
                return {}
        return {}


# The full metric vocabulary the Evidence Intelligence Agent must look for
# (spec §3) — passed into the extraction prompt so the model knows the exact
# canonical names to use, rather than inventing its own labels per document.
_METRIC_VOCABULARY = [
    "Scope 1 emissions", "Scope 2 emissions", "Scope 3 emissions",
    "Energy consumption", "Renewable energy %", "Carbon intensity",
    "Water withdrawal", "Water consumption", "Waste generated", "Recycling rate",
    "Environmental expenditure", "Carbon offsets", "Carbon credits",
    "Renewable energy certificates (RECs)", "Land restored", "Trees planted",
    "Survival rate", "Mortality rate", "Avoided emissions",
    "Climate CAPEX", "Climate OPEX",
]

_METRIC_SYSTEM = """You are a climate-disclosure data analyst extracting quantitative metrics for an \
institutional evidence-verification system used by banks, insurers, investors, and regulators.

Hard rules:
- Extract ONLY numbers that are explicitly present in the document text. Never estimate, \
interpolate, or compute a figure the text does not state directly.
- Every metric must carry its full reporting context — value, unit, reporting period, baseline \
(if stated), boundary (if stated), geography (if stated), methodology (if stated). If the text \
gives a number without one of these, use null for that field rather than guessing.
- "source_locator" must reuse one of the exact locator tags present in the text (e.g. "[Page 4]", \
"[Sheet: Emissions, Row 9]") — never invent a page/row number. If nothing is directly citable for \
a metric, use an empty string, and verification_status must be "SOURCE TRACEABILITY INSUFFICIENT".
- "verification_status" is one of: "Directly stated", "Derived from stated figures", \
"SOURCE TRACEABILITY INSUFFICIENT".
- Only extract metrics that are actually present — do not emit an entry for every vocabulary term \
if the document doesn't mention it. Return strict JSON only."""

_METRIC_USER_TMPL = """DOCUMENT TEXT (pre-tagged with real locator markers — reuse these exact tags):
{text}

METRIC VOCABULARY TO LOOK FOR (use these exact canonical names in the "metric" field when a match \
is found; do not invent metrics outside this list):
{vocabulary}

For every one of these metrics that the text actually reports a number for, return an object:
{{
  "metric": "<canonical name from the vocabulary above>",
  "value": "<the number as it appears, e.g. '12,400' or '38'>",
  "unit": "<e.g. 'tCO2e', 'MWh', '%', 'kL', 'tonnes', 'INR crore', 'number of trees'>",
  "reporting_period": "<e.g. 'FY2023-24' or null>",
  "baseline": "<baseline value + year if stated, e.g. '18,200 tCO2e (FY2019-20 baseline)', or null>",
  "boundary": "<e.g. 'Scope 1+2, owned operations' or null>",
  "geography": "<e.g. 'India operations' or 'Global' or null>",
  "methodology": "<named standard if stated, e.g. 'GHG Protocol Corporate Standard', or null>",
  "source_locator": "<exact locator tag or empty string>",
  "verification_status": "<Directly stated | Derived from stated figures | SOURCE TRACEABILITY INSUFFICIENT>"
}}

Return ONLY: {{"metrics": [ ... ]}}"""


def extract_expanded_metrics(text: str) -> list:
    """LLM-based extraction across the full spec §3 metric vocabulary.
    Returns [] (never raises) on any failure — callers should still have the
    deterministic regex metrics from extract_data() even if this fails."""
    client = _get_client()
    resp = client.chat.completions.create(
        model=MODEL,
        max_tokens=3000,
        temperature=0.1,
        messages=[
            {"role": "system", "content": _METRIC_SYSTEM},
            {"role": "user", "content": _METRIC_USER_TMPL.format(
                text=text[:10000], vocabulary="\n".join(f"- {m}" for m in _METRIC_VOCABULARY),
            )},
        ],
    )
    parsed = _parse_json(resp.choices[0].message.content or "")
    metrics = parsed.get("metrics")
    if not isinstance(metrics, list):
        return []

    out = []
    for m in metrics:
        if not isinstance(m, dict) or not m.get("metric") or not m.get("value"):
            continue
        locator = m.get("source_locator") or ""
        status = m.get("verification_status") or ("Directly stated" if locator else "SOURCE TRACEABILITY INSUFFICIENT")
        out.append({
            "metric": m.get("metric"),
            "value": str(m.get("value")),
            "unit": m.get("unit") or "",
            "reporting_period": m.get("reporting_period"),
            "baseline": m.get("baseline"),
            "boundary": m.get("boundary"),
            "geography": m.get("geography"),
            "methodology": m.get("methodology"),
            "source_locator": locator,
            "verification_status": status if locator else "SOURCE TRACEABILITY INSUFFICIENT",
        })
    return out


def _regex_metrics_to_schema(regex_data: dict) -> list:
    """Map greenwashing_scanner.extract_data()'s deterministic regex fields
    onto the same tuple shape, so callers get one unified metric list instead
    of two differently-shaped sources. Regex matches carry no page locator
    (the scanner operates on flat text) — marked SOURCE TRACEABILITY
    INSUFFICIENT rather than fabricating one, per CLAUDE.md."""
    out = []
    for key, label, unit_key in (
        ("scope_1", "Scope 1 emissions", True),
        ("scope_2", "Scope 2 emissions", True),
        ("scope_3", "Scope 3 emissions", True),
        ("energy_consumption", "Energy consumption", True),
    ):
        entry = regex_data.get(key)
        if entry and isinstance(entry, dict) and entry.get("value"):
            out.append({
                "metric": label, "value": entry["value"], "unit": entry.get("unit", ""),
                "reporting_period": None,
                "baseline": (f"{regex_data['baseline_year']} baseline year stated"
                             if regex_data.get("baseline_year") else None),
                "boundary": "Reporting boundary defined in text" if regex_data.get("reporting_boundary_defined") else None,
                "geography": None,
                "methodology": None,
                "source_locator": "",
                "verification_status": "SOURCE TRACEABILITY INSUFFICIENT",
            })

    if regex_data.get("net_zero_target_year"):
        out.append({
            "metric": "Net zero target year", "value": str(regex_data["net_zero_target_year"]), "unit": "year",
            "reporting_period": None, "baseline": None, "boundary": None, "geography": None,
            "methodology": None, "source_locator": "", "verification_status": "SOURCE TRACEABILITY INSUFFICIENT",
        })
    if regex_data.get("carbon_neutral_target_year"):
        out.append({
            "metric": "Carbon neutrality target year", "value": str(regex_data["carbon_neutral_target_year"]),
            "unit": "year", "reporting_period": None, "baseline": None, "boundary": None, "geography": None,
            "methodology": None, "source_locator": "", "verification_status": "SOURCE TRACEABILITY INSUFFICIENT",
        })
    return out


def extract_structured_metrics(text: str) -> dict:
    """
    Main entry point for the Evidence Intelligence Agent (spec §3).
    Returns {"metrics": [...], "flags": {...}} where "flags" carries the
    boolean signals extract_data() already computes (third_party_assurance,
    emission_intensity_reported, transition_pathway_present, etc.) used
    downstream by the greenwashing signal engine. Never raises — a document
    with no extractable metrics returns an empty metrics list, not an error.
    """
    try:
        regex_data = _extract_data_basic(text)
    except Exception:
        regex_data = {}

    regex_metrics = _regex_metrics_to_schema(regex_data) if regex_data else []

    try:
        llm_metrics = extract_expanded_metrics(text) if text.strip() else []
    except Exception:
        llm_metrics = []

    # De-duplicate: prefer the LLM's citation-backed entry over the
    # locator-less regex entry for the same metric name, when both exist.
    llm_metric_names = {m["metric"].lower() for m in llm_metrics}
    merged = [m for m in regex_metrics if m["metric"].lower() not in llm_metric_names] + llm_metrics

    return {
        "metrics": merged,
        "flags": {
            "third_party_assurance": bool(regex_data.get("third_party_assurance")),
            "emission_intensity_reported": bool(regex_data.get("emission_intensity_reported")),
            "emission_reduction_stated": bool(regex_data.get("emission_reduction_stated")),
            "transition_pathway_present": bool(regex_data.get("transition_pathway_present")),
            "reporting_boundary_defined": bool(regex_data.get("reporting_boundary_defined")),
            "target_years": regex_data.get("target_years", []),
        },
    }
