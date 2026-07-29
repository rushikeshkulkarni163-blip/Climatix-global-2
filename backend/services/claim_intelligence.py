"""
Climactix — Claim Intelligence Service
=========================================
Part of the Climactix Evidence Intelligence Agent (see evidence_intelligence_agent.py).

Expands greenwashing_scanner.extract_claims() — which already does the LLM
claim-detection pass in production — into the full structured claim object
required by the Evidence Intelligence Agent spec:

  Claim | Claim Type | Reporting Year | Baseline Year | Target Year |
  Quantitative Commitment | Operational Boundary | Geographical Boundary |
  Supporting Evidence (locator) | Methodology | External Assurance |
  Confidence | Potential Greenwashing Risk

This does NOT re-run claim detection from scratch (that would be a second,
divergent LLM pipeline) — it reuses the existing extraction, then makes one
additional grounded enrichment pass to fill in the institutional fields.
Every field must come from the source text or be null — never invented
(CLAUDE.md AI System Rules: never fabricate metrics, targets, or commitments).
"""

from __future__ import annotations

import json
import os
import re
from typing import Optional

from openai import OpenAI

from services.greenwashing_scanner import extract_claims as _extract_claims_basic

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


_CLAIM_TYPE_LABELS = {
    "net_zero": "Net Zero Commitment",
    "carbon_neutral": "Carbon Neutrality Claim",
    "science_based": "Science-Based Target Claim",
    "renewables": "Renewable Energy Claim",
    "supply_chain": "Supply Chain Sustainability Claim",
    "social": "Social / ESG Claim",
    "biodiversity": "Biodiversity / Land Restoration Claim",
    "circular": "Circular Economy / Zero-Waste Claim",
    "water": "Water Stewardship Claim",
    "other": "Other Environmental Claim",
}

_ENRICH_SYSTEM = """You are a climate-disclosure analyst structuring sustainability claims for an \
institutional evidence-verification system used by banks, insurers, investors, and regulators.

Hard rules:
- Populate every field ONLY from the document text provided. Use null for anything the text does \
not explicitly state — never guess, infer beyond what's written, or fill a plausible-sounding value.
- "confidence" (0.0-1.0) reflects how directly and unambiguously the text supports the claim as \
extracted, not how good the claim sounds.
- "potential_greenwashing_risk" must use hedged, evidence-based language (e.g. "Potential \
greenwashing signal — no baseline year disclosed") — never a direct accusation, and null/empty if \
no risk signal is present.
- "supporting_evidence" must reuse one of the exact locator tags present in the text (e.g. "[Page 3]", \
"[¶12]") — never invent a page or paragraph number. Empty string if nothing is directly citable.
- Return strict JSON only."""

_ENRICH_USER_TMPL = """DOCUMENT TEXT (pre-tagged with real locator markers like "[Page 3]", "[¶12]", \
"[Table 1.Row 4]" — reuse these exact tags when citing, never invent your own):
{text}

CLAIMS ALREADY DETECTED IN THIS DOCUMENT (enrich each one; do not add or remove claims):
{claims_json}

For each claim above, return the enriched object with these exact keys:
{{
  "claim": "<the original claim text>",
  "claim_type": "<human-readable type, e.g. 'Net Zero Commitment'>",
  "reporting_year": <int or null — the year this disclosure was published/reported>,
  "baseline_year": <int or null>,
  "target_year": <int or null>,
  "quantitative_commitment": "<e.g. '100% renewable electricity' or null>",
  "operational_boundary": "<e.g. 'Scope 1+2, owned operations only' or null if not stated>",
  "geographical_boundary": "<e.g. 'Global operations' or 'India operations only' or null>",
  "supporting_evidence": "<exact locator tag from the text, or empty string>",
  "methodology": "<named standard/methodology if stated, e.g. 'GHG Protocol', or null>",
  "external_assurance": "<name of assurer/standard if stated, e.g. 'ISAE 3000 assured by DNV', or null>",
  "confidence": <0.0-1.0>,
  "potential_greenwashing_risk": "<hedged one-sentence signal, or empty string if none>"
}}

Return ONLY: {{"claims": [ ... one object per input claim, same order ... ]}}"""


def enrich_claims(text: str, claims_basic: list) -> list:
    """Enrich already-detected claims (from greenwashing_scanner.extract_claims)
    into the full institutional claim schema. Returns [] if there are no
    claims to enrich or if enrichment fails — callers should fall back to the
    basic claim list rather than blocking the whole pipeline on this step."""
    if not claims_basic:
        return []

    client = _get_client()
    claims_input = [
        {
            "claim": c.get("claim", ""),
            "type": c.get("type", "other"),
            "has_supporting_data": c.get("has_supporting_data", False),
            "baseline_year": c.get("baseline_year"),
            "target_year": c.get("target_year"),
            "third_party_verified": c.get("third_party_verified", False),
        }
        for c in claims_basic
    ]

    resp = client.chat.completions.create(
        model=MODEL,
        max_tokens=3000,
        temperature=0.1,
        messages=[
            {"role": "system", "content": _ENRICH_SYSTEM},
            {"role": "user", "content": _ENRICH_USER_TMPL.format(
                text=text[:10000], claims_json=json.dumps(claims_input, indent=2),
            )},
        ],
    )
    parsed = _parse_json(resp.choices[0].message.content or "")
    enriched = parsed.get("claims")
    if not isinstance(enriched, list):
        return []

    out = []
    for i, e in enumerate(enriched):
        if not isinstance(e, dict):
            continue
        basic = claims_input[i] if i < len(claims_input) else {}
        claim_type_key = basic.get("type", "other")
        out.append({
            "claim": e.get("claim") or basic.get("claim", ""),
            "claim_type": e.get("claim_type") or _CLAIM_TYPE_LABELS.get(claim_type_key, "Other Environmental Claim"),
            "reporting_year": e.get("reporting_year"),
            "baseline_year": e.get("baseline_year") if e.get("baseline_year") is not None else basic.get("baseline_year"),
            "target_year": e.get("target_year") if e.get("target_year") is not None else basic.get("target_year"),
            "quantitative_commitment": e.get("quantitative_commitment"),
            "operational_boundary": e.get("operational_boundary"),
            "geographical_boundary": e.get("geographical_boundary"),
            "supporting_evidence": e.get("supporting_evidence") or "",
            "methodology": e.get("methodology"),
            "external_assurance": e.get("external_assurance"),
            "confidence": round(float(e.get("confidence", 0.5)), 2) if _is_number(e.get("confidence")) else 0.5,
            "potential_greenwashing_risk": e.get("potential_greenwashing_risk") or "",
        })
    return out


def _is_number(v) -> bool:
    try:
        float(v)
        return True
    except (TypeError, ValueError):
        return False


def extract_structured_claims(text: str, company_name: str = "The Company") -> list:
    """
    Main entry point for the Evidence Intelligence Agent (spec §4).
    Runs the existing production claim-detection pass, then enriches the
    result into the full institutional schema. Returns [] (never raises) on
    any failure in either stage — a document with no detectable claims, or a
    transient LLM failure, must not block the rest of the evidence pipeline.
    """
    try:
        claims_basic = _extract_claims_basic(text)
    except Exception:
        return []
    if not claims_basic:
        return []
    try:
        return enrich_claims(text, claims_basic)
    except Exception:
        # Enrichment failed — fall back to the basic schema mapped onto the
        # same field names (with nulls for the institutional-only fields)
        # rather than losing the claims entirely.
        return [
            {
                "claim": c.get("claim", ""),
                "claim_type": _CLAIM_TYPE_LABELS.get(c.get("type", "other"), "Other Environmental Claim"),
                "reporting_year": None,
                "baseline_year": c.get("baseline_year"),
                "target_year": c.get("target_year"),
                "quantitative_commitment": None,
                "operational_boundary": None,
                "geographical_boundary": None,
                "supporting_evidence": "",
                "methodology": None,
                "external_assurance": "Stated" if c.get("third_party_verified") else None,
                "confidence": 0.4,
                "potential_greenwashing_risk": "",
            }
            for c in claims_basic
        ]
