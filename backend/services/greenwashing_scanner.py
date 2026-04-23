"""
Climactix AI — Greenwashing Risk Scanner Service
================================================
Detects greenwashing risk in ESG reports through a 5-stage pipeline:
  1. Claim Extraction   — LLM-powered sustainability claim detection
  2. Data Extraction    — Regex/rule-based quantitative data mining
  3. Validation Engine  — Rule-based narrative vs data mismatch flagging
  4. Framework Mapping  — GRI / ISSB S2 / TCFD alignment assessment
  5. Scoring Engine     — 0–100 risk score (mismatch 40% + missing 30% + framework 30%)
"""

import json
import os
import re
from typing import Optional

import anthropic

MODEL = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-6")

_client: Optional[anthropic.Anthropic] = None


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY environment variable not set.")
        _client = anthropic.Anthropic(api_key=api_key)
    return _client


def _parse_json_response(raw: str) -> dict:
    """Robustly parse JSON from LLM response, stripping markdown if present."""
    raw = raw.strip()
    # Strip markdown code fences
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if match:
            return json.loads(match.group())
        raise


# ── Stage 1: Claim Extraction (LLM) ───────────────────────────────────────────

_CLAIM_SYSTEM = (
    "You are a senior ESG auditor specialising in greenwashing detection. "
    "Extract all sustainability claims from the report text with precision. "
    "Always return valid JSON — no markdown, no code fences, no commentary."
)

_CLAIM_USER_TMPL = """Analyse the following ESG report text and extract all sustainability claims.

For each claim identify:
1. claim       — exact quote or close paraphrase (max 200 chars)
2. type        — one of: net_zero | carbon_neutral | science_based | renewables |
                  supply_chain | social | biodiversity | circular | water | other
3. has_supporting_data — true if quantitative data supporting the claim appears nearby
4. baseline_year       — integer year or null
5. target_year         — integer year or null
6. third_party_verified — true if external assurance or verification is cited

Return ONLY this JSON structure:
{{
  "claims": [
    {{
      "claim": "string",
      "type": "string",
      "has_supporting_data": true,
      "baseline_year": null,
      "target_year": null,
      "third_party_verified": false
    }}
  ]
}}

ESG REPORT TEXT:
---
{text}
---"""


def extract_claims(text: str) -> list:
    """Use Claude to extract and classify all sustainability claims."""
    client = _get_client()
    truncated = text[:9000]

    msg = client.messages.create(
        model=MODEL,
        max_tokens=2500,
        system=_CLAIM_SYSTEM,
        messages=[{"role": "user", "content": _CLAIM_USER_TMPL.format(text=truncated)}],
    )

    raw = msg.content[0].text
    try:
        return _parse_json_response(raw).get("claims", [])
    except Exception:
        return []


# ── Stage 2: Data Extraction (regex) ──────────────────────────────────────────

_RX_SCOPE1 = re.compile(
    r"scope\s*[1i]\s*(?:emissions?|ghg)?\s*(?:were|is|are|:|\=|of)?\s*"
    r"([\d,]+\.?\d*)\s*(kt?co2e?|mt?co2e?|t\s*co2e?|tonnes?\s*co2)",
    re.IGNORECASE,
)
_RX_SCOPE2 = re.compile(
    r"scope\s*2\s*(?:emissions?|ghg)?\s*(?:were|is|are|:|\=|of)?\s*"
    r"([\d,]+\.?\d*)\s*(kt?co2e?|mt?co2e?|t\s*co2e?|tonnes?\s*co2)",
    re.IGNORECASE,
)
_RX_SCOPE3 = re.compile(
    r"scope\s*3\s*(?:emissions?|ghg)?\s*(?:were|is|are|:|\=|of)?\s*"
    r"([\d,]+\.?\d*)\s*(kt?co2e?|mt?co2e?|t\s*co2e?|tonnes?\s*co2)",
    re.IGNORECASE,
)
_RX_ENERGY = re.compile(
    r"(?:total\s+)?energy\s+(?:consumption|use|usage)?\s*(?:was|is|are|:|\=|of)?\s*"
    r"([\d,]+\.?\d*)\s*(g?wh|mwh|tj|pj|kwh|terajoules?)",
    re.IGNORECASE,
)
_RX_BASELINE = re.compile(
    r"base(?:line)?\s+year\s*(?:is|:|\=|of)?\s*(20\d{2})\b", re.IGNORECASE
)
_RX_NET_ZERO = re.compile(r"net[\s\-]zero\s+by\s+(20[2-5]\d)\b", re.IGNORECASE)
_RX_CARBON_NEUTRAL = re.compile(
    r"carbon[\s\-]neutral(?:ity)?\s+(?:by|in|target|goal)\s*(20[2-5]\d)\b",
    re.IGNORECASE,
)
_RX_BOUNDARY = re.compile(
    r"(?:reporting\s+boundary|consolidation\s+approach|operational\s+control|"
    r"financial\s+control|equity\s+share)",
    re.IGNORECASE,
)
_RX_ASSURANCE = re.compile(
    r"(?:third[\s\-]party|external|independent)\s+(?:assurance|verification|audit|review)",
    re.IGNORECASE,
)
_RX_INTENSITY = re.compile(
    r"(?:emission|carbon|ghg)\s+intensit", re.IGNORECASE
)
_RX_REDUCTION = re.compile(
    r"reduc(?:ed|tion|ing|e)\s+(?:emission|carbon|ghg|scope)", re.IGNORECASE
)
_RX_PATHWAY = re.compile(
    r"(?:transition\s+plan|decarboni(?:s|z)ation\s+(?:plan|pathway|roadmap)|"
    r"interim\s+target|2030\s+target|net[\s\-]zero\s+pathway)",
    re.IGNORECASE,
)
_RX_LARGE_ORG = re.compile(
    r"\b(?:10,000|20,000|50,000|100,000)\s+employees|"
    r"(?:global\s+operations|multinational|international\s+operations)",
    re.IGNORECASE,
)
_RX_TARGET_YEAR = re.compile(r"\b(20[2-5]\d)\b")


def extract_data(text: str) -> dict:
    """Extract quantitative ESG data from text using regex patterns."""

    def _first(pattern):
        m = pattern.search(text)
        if m:
            return {"value": m.group(1).replace(",", ""), "unit": m.group(2).strip()}
        return None

    target_years = sorted(
        {int(y) for y in _RX_TARGET_YEAR.findall(text) if 2025 <= int(y) <= 2060}
    )

    net_zero_m = _RX_NET_ZERO.search(text)
    carbon_neutral_m = _RX_CARBON_NEUTRAL.search(text)
    baseline_m = _RX_BASELINE.search(text)

    return {
        "scope_1": _first(_RX_SCOPE1),
        "scope_2": _first(_RX_SCOPE2),
        "scope_3": _first(_RX_SCOPE3),
        "energy_consumption": _first(_RX_ENERGY),
        "target_years": target_years[:6],
        "baseline_year": int(baseline_m.group(1)) if baseline_m else None,
        "net_zero_target_year": int(net_zero_m.group(1)) if net_zero_m else None,
        "carbon_neutral_target_year": (
            int(carbon_neutral_m.group(1)) if carbon_neutral_m else None
        ),
        "reporting_boundary_defined": bool(_RX_BOUNDARY.search(text)),
        "third_party_assurance": bool(_RX_ASSURANCE.search(text)),
        "emission_intensity_reported": bool(_RX_INTENSITY.search(text)),
        "emission_reduction_stated": bool(_RX_REDUCTION.search(text)),
        "transition_pathway_present": bool(_RX_PATHWAY.search(text)),
        "is_large_org_signals": bool(_RX_LARGE_ORG.search(text)),
    }


# ── Stage 3: Validation Engine ─────────────────────────────────────────────────

def _flag(fid, title, description, severity, category, framework_ref, excerpt=""):
    return {
        "flag_id": fid,
        "title": title,
        "description": description,
        "severity": severity,
        "category": category,
        "framework_ref": framework_ref,
        "claim_excerpt": excerpt[:200] if excerpt else "",
    }


def validate_claims(claims: list, data: dict, text: str) -> list:
    """Apply rule-based greenwashing detection logic and return risk flags."""
    flags = []
    seen_ids = set()

    def add(f):
        if f["flag_id"] not in seen_ids:
            seen_ids.add(f["flag_id"])
            flags.append(f)

    net_zero_claims = [c for c in claims if c.get("type") in ("net_zero", "carbon_neutral")]

    # F001 — Net-zero/carbon-neutral without baseline year
    for claim in net_zero_claims:
        if not claim.get("baseline_year") and not data.get("baseline_year"):
            add(_flag(
                "F001",
                "Net-Zero Claim Without Baseline Year",
                "The report asserts net-zero or carbon neutrality but no baseline year is defined. "
                "Without a baseline, the claim is unmeasurable and fails TCFD Metrics & Targets "
                "and GRI 305-5 requirements.",
                "High",
                "Narrative vs Data Mismatch",
                "TCFD — Metrics & Targets; GRI 305-5",
                claim.get("claim", ""),
            ))
            break

    # F002 — Net-zero/carbon-neutral claim without third-party verification
    for claim in net_zero_claims:
        if not claim.get("third_party_verified") and not data.get("third_party_assurance"):
            add(_flag(
                "F002",
                "Unverified Net-Zero / Carbon Neutrality Claim",
                "Net-zero or carbon neutrality claims are present but no third-party verification "
                "or external assurance is cited. Unverified claims are the primary driver of "
                "greenwashing enforcement actions under ISSB S2 and GRI standards.",
                "High",
                "Verification Gap",
                "ISSB S2 para 21; GRI 305",
                claim.get("claim", ""),
            ))
            break

    # F003 — Sustainability claims without supporting quantitative data
    unsupported = [
        c for c in claims
        if not c.get("has_supporting_data") and c.get("type") not in ("other",)
    ]
    for i, claim in enumerate(unsupported[:3]):
        add(_flag(
            f"F003{'abcde'[i]}",
            f"Unsupported {claim.get('type','Sustainability').replace('_',' ').title()} Claim",
            f"A {claim.get('type','sustainability').replace('_',' ')} claim was identified "
            "but no quantitative data was found to substantiate it. "
            "Qualitative-only disclosures are a key greenwashing indicator under GRI 3-3 "
            "and TCFD Strategy pillar.",
            "Medium",
            "Narrative vs Data Mismatch",
            "GRI 3-3; TCFD Strategy",
            claim.get("claim", ""),
        ))

    # F004 — Scope 3 absent
    if not data.get("scope_3"):
        severity = "High" if (data.get("scope_1") or data.get("is_large_org_signals")) else "Medium"
        add(_flag(
            "F004",
            "Scope 3 Emissions Not Reported",
            "Scope 3 (value chain) emissions are absent. For most organisations, Scope 3 "
            "represents over 70% of total GHG footprint. Omitting Scope 3 while claiming "
            "climate leadership is a material greenwashing risk flagged by ISSB S2 and GRI 305-3.",
            severity,
            "Missing Disclosure",
            "ISSB S2; GHG Protocol Scope 3; GRI 305-3",
        ))

    # F005 — Targets without transition pathway
    has_targets = bool(
        data.get("target_years") or data.get("net_zero_target_year") or data.get("carbon_neutral_target_year")
    )
    if has_targets and not data.get("transition_pathway_present"):
        add(_flag(
            "F005",
            "Long-Term Targets Without Transition Pathway",
            "Long-term emission targets (e.g. net-zero 2050) are stated but no interim milestones, "
            "transition plan, or decarbonisation roadmap is disclosed. This is identified as a "
            "primary greenwashing indicator by ISSB S2 para 29 and TCFD Strategy.",
            "High",
            "Narrative vs Data Mismatch",
            "ISSB S2 para 29; TCFD Strategy; GRI 3-3",
        ))

    # F006 — Reporting boundary undefined
    if not data.get("reporting_boundary_defined") and (data.get("scope_1") or data.get("scope_2")):
        add(_flag(
            "F006",
            "Reporting Boundary Not Defined",
            "Emissions data is presented but the reporting boundary or consolidation approach "
            "(operational control, financial control, equity share) is not specified. "
            "Undefined boundaries make emissions data unverifiable and non-compliant with "
            "GHG Protocol Corporate Standard.",
            "Medium",
            "Framework Misalignment",
            "GHG Protocol Corporate Standard; GRI 305; TCFD",
        ))

    # F007 — No quantitative emissions data despite narrative claims
    has_any_emissions = data.get("scope_1") or data.get("scope_2")
    if not has_any_emissions and len(claims) > 0:
        add(_flag(
            "F007",
            "No Quantitative Emissions Data Despite ESG Narrative",
            "Sustainability narratives and commitments are present but no quantitative GHG emissions "
            "data (Scope 1 or 2) was extracted. This represents a critical disconnect between "
            "corporate narrative and disclosed data.",
            "High",
            "Narrative vs Data Mismatch",
            "GRI 305-1; GRI 305-2; ISSB S2 para 29",
        ))

    # F008 — Science-based claims without SBTi reference
    sbti_claims = [c for c in claims if c.get("type") == "science_based"]
    if sbti_claims:
        sbti_keywords = ["sbti", "science based targets initiative", "1.5°c", "1.5 degrees", "well-below 2"]
        if not any(kw in text.lower() for kw in sbti_keywords):
            add(_flag(
                "F008",
                "Science-Based Target Claim Without SBTi Framework Reference",
                "The report references 'science-based' targets but does not cite the SBTi "
                "(Science Based Targets initiative), 1.5°C alignment criteria, or equivalent "
                "methodology. This risks being perceived as a vague, unsubstantiated claim.",
                "Medium",
                "Framework Misalignment",
                "SBTi; ISSB S2; GRI 305",
                sbti_claims[0].get("claim", ""),
            ))

    # F009 — No emission reduction data despite reduction claims
    if data.get("emission_reduction_stated") and not data.get("scope_1") and not data.get("scope_2"):
        add(_flag(
            "F009",
            "Emission Reduction Claimed Without Quantitative Evidence",
            "The report claims emission reductions but no baseline Scope 1 or Scope 2 "
            "figures were found. Reduction claims require a quantified baseline and current "
            "year figures to be verifiable under GRI 305-5.",
            "High",
            "Narrative vs Data Mismatch",
            "GRI 305-5; TCFD Metrics & Targets",
        ))

    return flags


# ── Stage 4: Framework Mapping ─────────────────────────────────────────────────

_FRAMEWORK_CHECKS = [
    # GRI
    {
        "id": "GRI-305-1", "standard": "GRI",
        "requirement": "GRI 305-1 — Scope 1 Direct Emissions",
        "description": "Direct (Scope 1) GHG emissions disclosed with value and unit",
        "check": lambda d, t: d.get("scope_1") is not None,
    },
    {
        "id": "GRI-305-2", "standard": "GRI",
        "requirement": "GRI 305-2 — Scope 2 Indirect Emissions",
        "description": "Energy indirect (Scope 2) GHG emissions disclosed",
        "check": lambda d, t: d.get("scope_2") is not None,
    },
    {
        "id": "GRI-305-3", "standard": "GRI",
        "requirement": "GRI 305-3 — Scope 3 Value Chain Emissions",
        "description": "Other indirect (Scope 3) GHG emissions disclosed",
        "check": lambda d, t: d.get("scope_3") is not None,
    },
    {
        "id": "GRI-305-4", "standard": "GRI",
        "requirement": "GRI 305-4 — Emission Intensity",
        "description": "GHG emissions intensity ratio (per unit of output/revenue)",
        "check": lambda d, t: d.get("emission_intensity_reported"),
    },
    {
        "id": "GRI-305-5", "standard": "GRI",
        "requirement": "GRI 305-5 — Emission Reductions vs Baseline",
        "description": "GHG emission reductions quantified against a defined baseline",
        "check": lambda d, t: d.get("emission_reduction_stated") and d.get("baseline_year"),
    },
    {
        "id": "GRI-BOUNDARY", "standard": "GRI",
        "requirement": "GRI — Reporting Boundary Definition",
        "description": "Consolidation approach or reporting boundary clearly stated",
        "check": lambda d, t: d.get("reporting_boundary_defined"),
    },
    # TCFD
    {
        "id": "TCFD-GOV", "standard": "TCFD",
        "requirement": "TCFD — Governance Pillar",
        "description": "Board oversight of climate-related risks and opportunities",
        "check": lambda d, t: bool(re.search(
            r"board\s+(?:oversight|climate|esg|sustainability|committee)", t, re.IGNORECASE
        )),
    },
    {
        "id": "TCFD-STRAT", "standard": "TCFD",
        "requirement": "TCFD — Strategy Pillar",
        "description": "Climate-related risks and opportunities integrated into strategy",
        "check": lambda d, t: bool(re.search(
            r"climate[\s\-]related\s+(?:risk|opportunit|scenario)", t, re.IGNORECASE
        )),
    },
    {
        "id": "TCFD-RISK", "standard": "TCFD",
        "requirement": "TCFD — Risk Management Pillar",
        "description": "Process for identifying, assessing and managing climate risks",
        "check": lambda d, t: bool(re.search(
            r"climate\s+risk\s+(?:management|assessment|process|framework)", t, re.IGNORECASE
        )),
    },
    {
        "id": "TCFD-METRICS", "standard": "TCFD",
        "requirement": "TCFD — Metrics & Targets Pillar",
        "description": "Quantitative climate metrics and targets disclosed",
        "check": lambda d, t: bool(d.get("scope_1") or d.get("scope_2")),
    },
    {
        "id": "TCFD-SCENARIO", "standard": "TCFD",
        "requirement": "TCFD — Scenario Analysis",
        "description": "Climate scenario analysis (e.g. 1.5°C, 2°C, 4°C pathways) performed",
        "check": lambda d, t: bool(re.search(
            r"scenario\s+analysis|climate\s+scenario|1\.5[°\s]?c|2[°\s]?c\s+scenario",
            t, re.IGNORECASE
        )),
    },
    # ISSB
    {
        "id": "ISSB-S2-PHYS", "standard": "ISSB",
        "requirement": "ISSB S2 — Physical Climate Risks",
        "description": "Acute and chronic physical climate risk disclosure",
        "check": lambda d, t: bool(re.search(
            r"physical\s+(?:risk|climate\s+risk|climate\s+impact|hazard)", t, re.IGNORECASE
        )),
    },
    {
        "id": "ISSB-S2-TRANS", "standard": "ISSB",
        "requirement": "ISSB S2 — Transition Risks & Plan",
        "description": "Transition risks and decarbonisation transition plan disclosed",
        "check": lambda d, t: d.get("transition_pathway_present"),
    },
    {
        "id": "ISSB-S2-SCOPE3", "standard": "ISSB",
        "requirement": "ISSB S2 — Scope 3 Value Chain",
        "description": "Value chain (Scope 3) GHG emissions disclosed per ISSB S2 para 29",
        "check": lambda d, t: d.get("scope_3") is not None,
    },
    {
        "id": "ISSB-S1-MAT", "standard": "ISSB",
        "requirement": "ISSB S1 — Materiality Assessment",
        "description": "Sustainability materiality assessment process disclosed",
        "check": lambda d, t: bool(re.search(
            r"material(?:ity)?\s+(?:risk|assessment|topic|threshold)", t, re.IGNORECASE
        )),
    },
]


def map_frameworks(data: dict, text: str) -> dict:
    """Map extracted data against GRI, TCFD, and ISSB S2 framework requirements."""
    breakdown = {"GRI": [], "TCFD": [], "ISSB": []}
    missing = []

    for check in _FRAMEWORK_CHECKS:
        met = check["check"](data, text)
        item = {
            "requirement": check["requirement"],
            "description": check["description"],
            "status": "met" if met else "missing",
        }
        breakdown[check["standard"]].append(item)
        if not met:
            missing.append({
                "framework": check["standard"],
                "requirement": check["requirement"],
                "description": check["description"],
            })

    met_count = sum(
        1 for std in breakdown.values() for r in std if r["status"] == "met"
    )
    total_count = sum(len(v) for v in breakdown.values())

    return {
        "breakdown": breakdown,
        "missing": missing,
        "met_count": met_count,
        "total_count": total_count,
        "coverage_pct": round((met_count / total_count) * 100) if total_count else 0,
    }


# ── Stage 5: AI Recommendations (LLM) ─────────────────────────────────────────

_RECO_SYSTEM = (
    "You are a senior ESG compliance advisor and greenwashing risk specialist. "
    "Generate specific, actionable remediation recommendations. "
    "Always return valid JSON — no markdown, no code fences."
)

_RECO_USER_TMPL = """Based on the following greenwashing risk analysis, generate 5–7 prioritised,
actionable recommendations to reduce ESG disclosure greenwashing risk.

Each recommendation must:
- Address a specific identified gap
- Reference the applicable framework (GRI, TCFD, ISSB S2)
- Be achievable within 6–12 months
- Be concise (2–3 sentences)

RISK CONTEXT:
{context}

Return ONLY this JSON structure:
{{
  "recommendations": [
    {{
      "priority": "Critical|High|Medium",
      "title": "short action title (max 10 words)",
      "action": "specific action description (2–3 sentences)",
      "framework": "e.g. GRI 305-3 / ISSB S2",
      "impact": "brief investor/regulatory impact if addressed (1 sentence)"
    }}
  ]
}}"""


def generate_recommendations(flags: list, claims: list, data: dict) -> list:
    """Use Claude to generate prioritised remediation recommendations."""
    client = _get_client()

    context = {
        "flags": [
            {"title": f["title"], "severity": f["severity"], "category": f["category"]}
            for f in flags
        ],
        "data_gaps": {
            "scope_1_missing": data.get("scope_1") is None,
            "scope_2_missing": data.get("scope_2") is None,
            "scope_3_missing": data.get("scope_3") is None,
            "baseline_year_missing": data.get("baseline_year") is None,
            "reporting_boundary_missing": not data.get("reporting_boundary_defined"),
            "no_third_party_assurance": not data.get("third_party_assurance"),
            "no_transition_pathway": not data.get("transition_pathway_present"),
        },
        "claim_summary": {
            "total_claims": len(claims),
            "unsupported_claims": sum(1 for c in claims if not c.get("has_supporting_data")),
            "unverified_climate_claims": sum(
                1 for c in claims
                if c.get("type") in ("net_zero", "carbon_neutral", "science_based")
                and not c.get("third_party_verified")
            ),
        },
    }

    msg = client.messages.create(
        model=MODEL,
        max_tokens=1800,
        system=_RECO_SYSTEM,
        messages=[{
            "role": "user",
            "content": _RECO_USER_TMPL.format(context=json.dumps(context, indent=2)),
        }],
    )

    raw = msg.content[0].text
    try:
        return _parse_json_response(raw).get("recommendations", [])
    except Exception:
        return []


# ── Scoring Engine ─────────────────────────────────────────────────────────────

def compute_risk_score(flags: list, framework_results: dict, claims: list) -> dict:
    """
    Greenwashing Risk Score (0 = safest, 100 = highest risk).

    Weights:
      40% — Narrative vs Data Mismatch  (flag severity)
      30% — Missing Disclosures         (framework gaps)
      30% — Framework Misalignment      (coverage ratio)
    """
    # Component 1 — Mismatch score (40%)
    mismatch_flags = [
        f for f in flags
        if f["category"] in ("Narrative vs Data Mismatch", "Verification Gap")
    ]
    high_count = sum(1 for f in mismatch_flags if f["severity"] == "High")
    med_count = sum(1 for f in mismatch_flags if f["severity"] == "Medium")
    mismatch_raw = min(high_count * 28 + med_count * 14, 100)

    # Component 2 — Missing disclosures score (30%)
    missing_count = len(framework_results.get("missing", []))
    total_reqs = framework_results.get("total_count", 1) or 1
    missing_raw = int((missing_count / total_reqs) * 100)

    # Component 3 — Framework alignment score (30%)
    # Higher unmet ratio → higher risk
    coverage_pct = framework_results.get("coverage_pct", 50)
    alignment_raw = 100 - coverage_pct  # invert: low coverage = high risk

    composite = int(mismatch_raw * 0.40 + missing_raw * 0.30 + alignment_raw * 0.30)
    risk_score = max(0, min(100, composite))

    if risk_score <= 30:
        risk_level = "Low"
        risk_label = "Low Risk"
        risk_color = "#10B981"
    elif risk_score <= 70:
        risk_level = "Medium"
        risk_label = "Medium Risk"
        risk_color = "#F59E0B"
    else:
        risk_level = "High"
        risk_label = "High Risk"
        risk_color = "#EF4444"

    return {
        "risk_score": risk_score,
        "risk_level": risk_level,
        "risk_label": risk_label,
        "risk_color": risk_color,
        "breakdown": {
            "narrative_data_mismatch": {
                "score": mismatch_raw,
                "weight": "40%",
                "high_flags": high_count,
                "medium_flags": med_count,
            },
            "missing_disclosures": {
                "score": missing_raw,
                "weight": "30%",
                "items_missing": missing_count,
                "items_total": total_reqs,
            },
            "framework_alignment": {
                "score": alignment_raw,
                "weight": "30%",
                "coverage_pct": coverage_pct,
            },
        },
    }


# ── Main Pipeline ──────────────────────────────────────────────────────────────

def scan_for_greenwashing(text: str, company_name: str = "The Company") -> dict:
    """
    Full greenwashing detection pipeline.
    Runs claim extraction and recommendation generation in sequence (both use Claude).
    Data extraction and framework mapping are synchronous rule-based.
    """
    # Stage 1: LLM claim extraction
    claims = extract_claims(text)

    # Stage 2: Rule-based quantitative data extraction
    data = extract_data(text)

    # Stage 3: Rule-based validation flags
    flags = validate_claims(claims, data, text)

    # Stage 4: Framework mapping
    framework_results = map_frameworks(data, text)

    # Stage 5: Risk scoring
    score_result = compute_risk_score(flags, framework_results, claims)

    # Stage 6: LLM recommendations (after we know all flags)
    recommendations = generate_recommendations(flags, claims, data)

    return {
        "company_name": company_name,
        "risk_score": score_result["risk_score"],
        "risk_level": score_result["risk_level"],
        "risk_label": score_result["risk_label"],
        "risk_color": score_result["risk_color"],
        "score_breakdown": score_result["breakdown"],
        "claims_detected": claims,
        "data_extracted": data,
        "risk_flags": flags,
        "missing_disclosures": framework_results.get("missing", []),
        "framework_breakdown": framework_results.get("breakdown", {}),
        "framework_coverage_pct": framework_results.get("coverage_pct", 0),
        "recommendations": recommendations,
    }
