"""
Climactix — Climate Contradiction Detection Engine
===================================================
The core intelligence moat: detects contradictions between sustainability
narrative and operational reality across 10 contradiction archetypes.

This engine does not score — it identifies and surfaces specific instances
where corporate climate claims conflict with disclosed data, operational
signals, or structural omissions.

Pipeline:
  detect_contradictions(claims, data, text, company_name)
    → List[ContradictionFinding]

Each finding contains:
  - contradiction_type: str
  - severity: Critical | High | Medium | Low
  - narrative_claim: str      (what the company says)
  - operational_reality: str  (what the data shows)
  - evidence_excerpt: str     (extracted text evidence)
  - regulatory_implication: str
  - financial_materiality: str
  - confidence: float         (0.0 – 1.0)
"""

from __future__ import annotations

import json
import os
import re
from typing import Optional

from openai import OpenAI

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
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        if m:
            return json.loads(m.group())
        raise


# ── Regex signal patterns ──────────────────────────────────────────────────────

_RX_NET_ZERO = re.compile(r"net[\s\-]zero", re.IGNORECASE)
_RX_CARBON_NEUTRAL = re.compile(r"carbon[\s\-]neutral", re.IGNORECASE)
_RX_SCIENCE_BASED = re.compile(r"science[\s\-]based\s+target", re.IGNORECASE)
_RX_RENEWABLE_LEADER = re.compile(
    r"(?:renewable\s+energy\s+leader|100\s*%\s*renewable|clean\s+energy\s+transition"
    r"|leading\s+(?:on|in)\s+renewable)", re.IGNORECASE
)
_RX_SUSTAINABLE_SUPPLY = re.compile(
    r"sustainable\s+supply\s+chain|responsible\s+sourcing|supplier\s+sustainability"
    r"|ethical\s+supply\s+chain", re.IGNORECASE
)
_RX_EMISSIONS_RISING = re.compile(
    r"(?:emissions?\s+(?:increased|grew|rose|higher|up)\s+(?:by\s+)?[\d\.]+\s*%"
    r"|(?:[\d\.]+\s*%?\s+)?(?:increase|growth|rise)\s+in\s+(?:scope|emissions?|ghg))",
    re.IGNORECASE
)
_RX_FOSSIL_EXPANSION = re.compile(
    r"(?:new\s+coal|new\s+oil|new\s+gas|fossil\s+fuel\s+expansion|upstream\s+oil"
    r"|oil\s+field\s+development|lng\s+terminal|coal\s+mine|gas\s+extraction)",
    re.IGNORECASE
)
_RX_OFFSETS = re.compile(
    r"carbon\s+offset|offset\s+(?:purchase|credit|scheme)|carbon\s+credit"
    r"|voluntary\s+carbon\s+market|vcm|redd\+", re.IGNORECASE
)
_RX_2050_ONLY = re.compile(
    r"(?:net[\s\-]zero|carbon\s+neutral)\s+(?:by\s+)?20[45]\d", re.IGNORECASE
)
_RX_INTERIM_TARGETS = re.compile(
    r"(?:2025|2027|2030|2035)\s+(?:target|milestone|goal|reduction|commitment)",
    re.IGNORECASE
)
_RX_SBTI = re.compile(
    r"sbti|science\s+based\s+targets\s+initiative|1\.5[°℃\s]?c\s+aligned"
    r"|well[\s\-]below\s+2[°℃\s]?c", re.IGNORECASE
)
_RX_COAL_MENTIONS = re.compile(
    r"coal|thermal\s+power|lignite|anthracite|coal[\s\-]fired", re.IGNORECASE
)
_RX_NO_SUPPLIER_DATA = re.compile(
    r"supplier\s+(?:esg|sustainability|assessment|audit|data|reporting)",
    re.IGNORECASE
)
_RX_MATERIALITY = re.compile(
    r"material(?:ity)?\s+(?:assessment|analysis|topic|threshold)", re.IGNORECASE
)
_RX_CAPEX_GREEN = re.compile(
    r"(?:green|clean|sustainable|renewable|low[\s\-]carbon)\s+(?:capex|investment"
    r"|capital\s+expenditure)|capex\s+(?:allocation|invested)\s+(?:in\s+)?(?:green|clean"
    r"|renewable|sustainable)", re.IGNORECASE
)
_RX_CAPEX_FOSSIL = re.compile(
    r"(?:oil|gas|coal|fossil|upstream|lng|refinery)\s+(?:capex|investment"
    r"|capital\s+expenditure|project)|capex\s+(?:in\s+)?(?:oil|gas|coal|fossil)",
    re.IGNORECASE
)
_RX_OFFSET_DEPENDENCY = re.compile(
    r"(?:net[\s\-]zero|carbon[\s\-]neutral)\s+(?:through|via|using|with)"
    r"\s+(?:offsets?|credits?|removal|sequestration)", re.IGNORECASE
)


def _c(
    ctype: str,
    severity: str,
    narrative: str,
    reality: str,
    excerpt: str,
    regulatory: str,
    financial: str,
    confidence: float,
) -> dict:
    return {
        "contradiction_type": ctype,
        "severity": severity,
        "narrative_claim": narrative,
        "operational_reality": reality,
        "evidence_excerpt": excerpt[:300] if excerpt else "",
        "regulatory_implication": regulatory,
        "financial_materiality": financial,
        "confidence": round(confidence, 2),
    }


# ── Rule-based contradiction detection ────────────────────────────────────────

def _detect_rule_based(claims: list, data: dict, text: str) -> list[dict]:
    """Identify contradictions using deterministic rule patterns."""
    findings: list[dict] = []
    seen: set[str] = set()

    def add(f: dict) -> None:
        key = f["contradiction_type"]
        if key not in seen:
            seen.add(key)
            findings.append(f)

    has_net_zero = _RX_NET_ZERO.search(text)
    has_carbon_neutral = _RX_CARBON_NEUTRAL.search(text)
    has_science_based = _RX_SCIENCE_BASED.search(text)
    has_renewable_leader = _RX_RENEWABLE_LEADER.search(text)
    has_sustainable_supply = _RX_SUSTAINABLE_SUPPLY.search(text)
    has_emissions_rising = _RX_EMISSIONS_RISING.search(text)
    has_fossil_expansion = _RX_FOSSIL_EXPANSION.search(text)
    has_offsets = _RX_OFFSETS.search(text)
    has_2050_only = _RX_2050_ONLY.search(text)
    has_interim_targets = _RX_INTERIM_TARGETS.search(text)
    has_sbti = _RX_SBTI.search(text)
    has_coal = _RX_COAL_MENTIONS.search(text)
    has_supplier_data = _RX_NO_SUPPLIER_DATA.search(text)
    has_capex_green = _RX_CAPEX_GREEN.search(text)
    has_capex_fossil = _RX_CAPEX_FOSSIL.search(text)
    has_offset_dependency = _RX_OFFSET_DEPENDENCY.search(text)

    scope3 = data.get("scope_3")
    scope1 = data.get("scope_1")
    scope2 = data.get("scope_2")
    has_assurance = data.get("third_party_assurance", False)
    has_transition_plan = data.get("transition_pathway_present", False)

    # C-001: Net Zero claim + emissions rising
    if (has_net_zero or has_carbon_neutral) and has_emissions_rising:
        add(_c(
            "C-001: EMISSIONS_TRAJECTORY_VS_NET_ZERO_CLAIM",
            "Critical",
            "Company claims net-zero or carbon neutrality commitment.",
            "Reported emissions increased year-over-year — trajectory contradicts stated target.",
            has_emissions_rising.group(0),
            "ISSB S2 para 29, TCFD Metrics & Targets: targets must be measurable against "
            "a declining baseline. Rising emissions alongside net-zero claims constitute "
            "material greenwashing risk under SEC Climate Rule and EU CSRD.",
            "Elevated risk of litigation, regulatory enforcement, and divestment by "
            "climate-focused funds tracking emissions trajectory vs stated targets.",
            0.91,
        ))

    # C-002: Net Zero but Scope 3 omitted
    if (has_net_zero or has_carbon_neutral) and not scope3:
        add(_c(
            "C-002: SCOPE3_OMISSION_UNDER_NET_ZERO_CLAIM",
            "High",
            "Company claims net-zero or carbon neutrality.",
            "Scope 3 (value chain) emissions are not reported — for most sectors >70% "
            "of total GHG footprint. A net-zero claim that excludes Scope 3 is "
            "structurally incomplete.",
            (has_net_zero or has_carbon_neutral).group(0),
            "ISSB S2 para 29 requires Scope 3 disclosure. GHG Protocol Scope 3 Standard "
            "is mandatory for credible net-zero frameworks. EU CSRD ESRS E1-6 mandates "
            "full value-chain coverage.",
            "Investors relying on this claim for portfolio decarbonization decisions are "
            "exposed to systematic underestimation of climate liability.",
            0.88,
        ))

    # C-003: Science-based targets but no SBTi methodology
    if has_science_based and not has_sbti:
        add(_c(
            "C-003: SCIENCE_BASED_CLAIM_WITHOUT_SBTI_METHODOLOGY",
            "High",
            "Company claims targets are 'science-based'.",
            "No reference to SBTi (Science Based Targets initiative), 1.5°C alignment "
            "criteria, or validated methodology found. Science-based claims require "
            "approved methodology under SBTi or equivalent.",
            has_science_based.group(0),
            "SBTi Corporate Standard: 'science-based target' is a defined term — "
            "claims require either SBTi validation or equivalent methodology disclosure "
            "to comply with EU Green Claims Directive.",
            "Regulatory exposure from EU Green Claims Directive enforcement. "
            "Reputational risk if SBTi status is investigated by activist investors or media.",
            0.85,
        ))

    # C-004: Renewable energy leadership + coal operations
    if has_renewable_leader and has_coal:
        add(_c(
            "C-004: RENEWABLE_LEADERSHIP_VS_COAL_OPERATIONS",
            "High",
            "Company claims renewable energy leadership or 100% renewable transition.",
            "References to coal operations, thermal power, or fossil fuel assets detected "
            "in the same report — inconsistent with renewable leadership positioning.",
            has_coal.group(0),
            "GRI 302-1, TCFD Strategy: energy mix disclosure must reconcile renewable "
            "claims with fossil fuel exposure. Selective disclosure of renewable progress "
            "without acknowledging fossil exposure is a greenwashing indicator.",
            "Stranded asset risk: coal assets face accelerating regulatory shutdown. "
            "Renewable leadership claim inflates valuation if coal exposure is material.",
            0.79,
        ))

    # C-005: Sustainable supply chain but no supplier ESG data
    if has_sustainable_supply and not has_supplier_data:
        add(_c(
            "C-005: SUSTAINABLE_SUPPLY_CHAIN_WITHOUT_SUPPLIER_DATA",
            "Medium",
            "Company claims a sustainable or responsible supply chain.",
            "No supplier ESG assessments, audit data, or supplier sustainability "
            "reporting referenced. Supply chain claims without data are unverifiable.",
            has_sustainable_supply.group(0) if has_sustainable_supply else "",
            "GRI 308 (Supplier Environmental Assessment) and GRI 414 (Supplier Social "
            "Assessment) require documented supplier evaluation processes. Claims without "
            "data violate GRI 3-3 management approach disclosure.",
            "Supply chain sustainability claims without data expose the company to NGO "
            "investigations, investor stewardship queries, and Scope 3 liability.",
            0.75,
        ))

    # C-006: Long-term target only (future-washing) without interim targets
    if has_2050_only and not has_interim_targets:
        add(_c(
            "C-006: FUTURE_WASHING_NO_INTERIM_MILESTONES",
            "High",
            "Company commits to net-zero or carbon neutrality by 2050 (or beyond).",
            "No interim targets (2025, 2030, 2035) or near-term milestones found. "
            "Long-term targets without near-term commitments cannot be verified "
            "and do not drive current accountability.",
            has_2050_only.group(0),
            "ISSB S2 para 29(c): near-term targets required to substantiate long-term "
            "commitments. TCFD: scenario analysis must include intermediate milestones. "
            "EU CSRD Article 19a: transition plan must include measurable 2025-2030 targets.",
            "Targets with no near-term milestones cannot attract institutional investors "
            "tracking science-aligned pathways (PRI, NZAM, GFANZ commitments).",
            0.83,
        ))

    # C-007: Net zero via offsets (offset dependency)
    if has_offset_dependency:
        add(_c(
            "C-007: NET_ZERO_OFFSET_DEPENDENCY",
            "High",
            "Company positions net-zero or carbon neutrality as achievable through "
            "carbon offsets, credits, or removals.",
            "Net-zero via offsets is not equivalent to operational decarbonization. "
            "Permanent removal capacity at scale does not currently exist. "
            "Offset markets face integrity, permanence, and additionality risks.",
            has_offset_dependency.group(0),
            "Oxford Principles for Net Zero Aligned Carbon Offsetting: offsets should "
            "supplement deep decarbonization, not substitute for it. SBTi Corporate "
            "Net-Zero Standard limits offset use to residual emissions only.",
            "Offset-dependent net-zero claims face SEC, FCA, and ASIC enforcement risk. "
            "Carbon credit price volatility creates financial exposure for offset-reliant strategies.",
            0.80,
        ))

    # C-008: CAPEX mismatch — green narrative + fossil CAPEX
    if has_capex_fossil and has_net_zero and not has_capex_green:
        add(_c(
            "C-008: CAPEX_MISALIGNMENT_FOSSIL_INVESTMENT_VS_GREEN_NARRATIVE",
            "Critical",
            "Company presents a climate leadership narrative and net-zero ambition.",
            "Capital expenditure in fossil fuel assets detected with no corresponding "
            "green or clean technology CAPEX allocation. Financial commitments "
            "contradict stated climate strategy.",
            has_capex_fossil.group(0),
            "TCFD Strategy: capital allocation must be consistent with climate transition "
            "plan. ISSB S2 para 14: financial planning must reflect climate-related risks. "
            "SEC Climate Rule: CAPEX inconsistencies with climate commitments are material.",
            "Stranded asset risk quantified under IEA Net Zero 2050 scenario. CAPEX "
            "allocated to fossil fuel assets inconsistent with <2°C pathway faces "
            "accelerated impairment and divestment pressure.",
            0.87,
        ))

    # C-009: Fossil fuel expansion + net zero claim
    if has_fossil_expansion and (has_net_zero or has_carbon_neutral):
        add(_c(
            "C-009: FOSSIL_FUEL_EXPANSION_UNDER_NET_ZERO_CLAIM",
            "Critical",
            "Company claims net-zero commitment while reporting fossil fuel expansion.",
            "New fossil fuel capacity (coal, oil, gas field development, LNG terminals) "
            "detected. Expansion of fossil fuel infrastructure is structurally "
            "incompatible with credible net-zero pathways.",
            has_fossil_expansion.group(0),
            "IEA Net Zero 2050: no new fossil fuel development beyond approved projects. "
            "TCFD: physical and transition risk disclosures must reflect stranded asset "
            "exposure from continued fossil expansion.",
            "IEA NZE 2050 scenario renders new fossil fuel assets stranded before "
            "end of economic life. Unburnable carbon risk creates material valuation exposure.",
            0.93,
        ))

    # C-010: No assurance on claims despite making high-stakes sustainability commitments
    net_zero_claims = [c for c in claims if c.get("type") in ("net_zero", "carbon_neutral", "science_based")]
    if net_zero_claims and not has_assurance:
        add(_c(
            "C-010: HIGH_STAKES_CLAIMS_WITHOUT_THIRD_PARTY_ASSURANCE",
            "High",
            f"Company makes {len(net_zero_claims)} high-stakes climate commitment(s) "
            f"(net-zero, carbon neutrality, or science-based targets).",
            "No third-party verification, external assurance, or independent audit "
            "referenced. Unverified high-stakes claims are the primary enforcement "
            "target for global greenwashing regulators.",
            net_zero_claims[0].get("claim", "") if net_zero_claims else "",
            "ISSB S2 para 21 and GRI 305 recommend external assurance for emissions "
            "data. EU CSRD Article 34: mandatory limited assurance from 2025, "
            "reasonable assurance from 2028. FCA ESG Sourcebook: unverified claims "
            "constitute greenwashing.",
            "Exposure to SEC enforcement (Climate Disclosure Rule), FCA ESG Sourcebook "
            "compliance, EU CSRD penalties, and ASIC greenwashing enforcement action.",
            0.82,
        ))

    return findings


# ── LLM-powered deep contradiction analysis ───────────────────────────────────

_CONTRADICTION_SYSTEM = """You are a senior climate forensic analyst at an institutional
investment research firm. You specialise in identifying contradictions between corporate
sustainability narratives and operational reality. Your analysis is used for institutional
due diligence and regulatory investigations. Be precise, cite specific text evidence,
and never invent contradictions not supported by the provided text.

Always return valid JSON — no markdown, no code fences, no commentary."""

_CONTRADICTION_USER_TMPL = """Analyse this ESG/sustainability report text for contradictions between
climate narrative and operational reality. Focus on:

1. Carbon intensity vs stated decarbonization trajectory
2. CAPEX allocation vs climate ambition
3. Supply chain exposure vs sustainability claims
4. Regulatory compliance claims vs evidence gaps
5. Offset reliance vs genuine emissions reduction

For each contradiction found, provide:
- type: short identifier (e.g. "CAPEX_FOSSIL_VS_GREEN_NARRATIVE")
- severity: Critical | High | Medium | Low
- narrative: what the company claims (exact quote where possible)
- reality: what the data/text actually shows
- evidence: the specific text excerpt that reveals the contradiction
- regulatory_ref: relevant framework violation reference
- financial_impact: specific financial risk this creates

Return ONLY this JSON:
{{
  "contradictions": [
    {{
      "type": "string",
      "severity": "Critical|High|Medium|Low",
      "narrative": "string",
      "reality": "string",
      "evidence": "string (max 200 chars)",
      "regulatory_ref": "string",
      "financial_impact": "string"
    }}
  ],
  "overall_contradiction_severity": "None|Low|Medium|High|Critical",
  "integrity_summary": "2-3 sentence institutional-grade assessment"
}}

ESG REPORT TEXT (first 8000 chars):
---
{text}
---

ALREADY DETECTED RULE-BASED CONTRADICTIONS (do not repeat, only add NEW ones):
{existing}"""


def _detect_llm_contradictions(text: str, existing_types: set[str]) -> tuple[list[dict], str, str]:
    """Run LLM-based deep contradiction analysis beyond rule patterns."""
    client = _get_client()

    existing_summary = "\n".join(f"- {t}" for t in existing_types) if existing_types else "None yet."

    try:
        resp = client.chat.completions.create(
            model=MODEL,
            max_tokens=2000,
            temperature=0.15,
            messages=[
                {"role": "system", "content": _CONTRADICTION_SYSTEM},
                {"role": "user", "content": _CONTRADICTION_USER_TMPL.format(
                    text=text[:8000],
                    existing=existing_summary,
                )},
            ],
        )
        raw = resp.choices[0].message.content
        parsed = _parse_json(raw)
        llm_contradictions = []
        for c in parsed.get("contradictions", []):
            llm_contradictions.append({
                "contradiction_type": f"LLM-{c.get('type', 'UNNAMED')}",
                "severity": c.get("severity", "Medium"),
                "narrative_claim": c.get("narrative", ""),
                "operational_reality": c.get("reality", ""),
                "evidence_excerpt": c.get("evidence", "")[:300],
                "regulatory_implication": c.get("regulatory_ref", ""),
                "financial_materiality": c.get("financial_impact", ""),
                "confidence": 0.72,
            })
        severity = parsed.get("overall_contradiction_severity", "Medium")
        summary = parsed.get("integrity_summary", "")
        return llm_contradictions, severity, summary
    except Exception:
        return [], "Medium", ""


def _severity_rank(s: str) -> int:
    return {"Critical": 4, "High": 3, "Medium": 2, "Low": 1}.get(s, 0)


# ── Public API ─────────────────────────────────────────────────────────────────

def detect_contradictions(
    claims: list,
    data: dict,
    text: str,
    company_name: str = "The Company",
) -> dict:
    """
    Full contradiction detection pipeline.

    Returns:
      {
        "contradictions": [...],
        "contradiction_count": int,
        "overall_severity": str,
        "integrity_summary": str,
        "critical_count": int,
        "high_count": int,
        "medium_count": int,
        "low_count": int,
      }
    """
    # Stage 1 — deterministic rule-based detection
    rule_findings = _detect_rule_based(claims, data, text)
    existing_types = {f["contradiction_type"] for f in rule_findings}

    # Stage 2 — LLM deep analysis
    try:
        llm_findings, llm_severity, integrity_summary = _detect_llm_contradictions(
            text, existing_types
        )
    except Exception:
        llm_findings, llm_severity, integrity_summary = [], "Medium", ""

    all_findings = rule_findings + llm_findings

    # Compute overall severity
    if all_findings:
        top = max(all_findings, key=lambda f: _severity_rank(f["severity"]))
        overall_severity = top["severity"]
    else:
        overall_severity = "None"

    # Use LLM severity only if it's higher
    if _severity_rank(llm_severity) > _severity_rank(overall_severity):
        overall_severity = llm_severity

    counts = {"Critical": 0, "High": 0, "Medium": 0, "Low": 0}
    for f in all_findings:
        s = f.get("severity", "Low")
        counts[s] = counts.get(s, 0) + 1

    if not integrity_summary and all_findings:
        high_plus = counts["Critical"] + counts["High"]
        integrity_summary = (
            f"{company_name} presents {len(all_findings)} identified contradiction(s) "
            f"between climate narrative and operational evidence, of which {high_plus} are "
            f"rated High or Critical severity. "
            f"The overall contradiction profile is assessed as {overall_severity} severity, "
            f"indicating {'material greenwashing risk requiring immediate disclosure remediation' if high_plus > 1 else 'elevated scrutiny recommended'}."
        )
    elif not integrity_summary:
        integrity_summary = (
            f"No material contradictions detected between {company_name}'s climate "
            f"narrative and operational evidence. Disclosure appears internally consistent "
            f"with stated commitments."
        )

    return {
        "contradictions": all_findings,
        "contradiction_count": len(all_findings),
        "overall_severity": overall_severity,
        "integrity_summary": integrity_summary,
        "critical_count": counts["Critical"],
        "high_count": counts["High"],
        "medium_count": counts["Medium"],
        "low_count": counts["Low"],
    }
