"""
Climactix — Climate Risk Intelligence Brief (OpenAI GPT-4o, streaming)
======================================================================
Accepts a portfolio snapshot from the simulation page and streams an
institutional-grade intelligence brief covering physical/transition risks,
portfolio exposure, and strategic recommendations.
"""

import os
from typing import Generator, Optional

from openai import OpenAI
from services.knowledge_base import retrieve, format_context

MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")

_client: Optional[OpenAI] = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY environment variable not set.")
        _client = OpenAI(api_key=api_key)
    return _client


SYSTEM_PROMPT = """You are a senior climate risk analyst at a top-tier institutional investor (tier: BlackRock, Brookfield, MSCI).
You produce concise, data-driven climate risk intelligence briefs for portfolio managers and boards.

Your briefs are:
- Grounded in the NGFS scenario framework and TCFD risk taxonomy
- Structured with clear section headers (## for sections, ### for sub-sections)
- Quantitative wherever the asset data allows
- Aligned to TCFD, ISSB S2, and NGFS scenario analysis
- Honest about tail risks — do not sugarcoat high-risk exposures

Report structure (follow this exact order):
## Scenario Intelligence
## Portfolio Risk Overview
## High-Risk Asset Analysis
## Physical Risk Exposure
## Transition Risk Exposure
## Supply Chain & Cascading Risk
## Strategic Recommendations
## Analyst Conclusion

Rules:
- Use exact risk scores and values provided — never invent numbers
- Bold key metrics for scannability
- Each section: 2–4 paragraphs (no bullet-point lists)
- Recommendations must be specific and portfolio-actionable"""


def build_prompt(payload: dict) -> str:
    scenario_name = payload.get("scenario_name", "Delayed Transition")
    scenario_temp = payload.get("scenario_temp", "2°C")
    scenario_desc = payload.get("scenario_desc", "")
    year = payload.get("year", 2035)

    pf = payload.get("portfolio_summary", {})
    total_assets = pf.get("total_assets", 0)
    total_exposure = pf.get("total_exposure_usd_m", 0)
    avg_risk = pf.get("avg_risk_score", 0)
    critical_count = pf.get("critical_count", 0)
    high_count = pf.get("high_count", 0)
    medium_count = pf.get("medium_count", 0)
    low_count = pf.get("low_count", 0)
    total_scope1_t = pf.get("total_scope1_tco2e", 0)
    sectors = pf.get("sectors", [])

    assets = payload.get("assets", [])
    asset_lines = []
    for a in assets[:12]:
        asset_lines.append(
            f"  - {a.get('name', 'Unknown')} ({a.get('sector', '')}, {a.get('country', '')}): "
            f"Risk Score {a.get('risk_score', 0)}/100 [{a.get('risk_level', '').upper()}] | "
            f"Physical {a.get('physical', 0)} | Transition {a.get('transition', 0)} | "
            f"Supply Chain {a.get('supply_chain', 0)} | Revenue ${a.get('revenue_usd_m', 0)}M | "
            f"Scope 1: {a.get('scope1_tco2e', 0):,} tCO₂e"
        )
    asset_block = "\n".join(asset_lines) if asset_lines else "  No assets in portfolio."

    return f"""Generate a full Climate Risk Intelligence Brief for the following portfolio.

NGFS SCENARIO
-------------
Scenario  : {scenario_name} ({scenario_temp})
Description: {scenario_desc}
Target Year: {year}

PORTFOLIO SUMMARY
-----------------
Total Assets         : {total_assets}
Total Exposure       : ${total_exposure:,.0f}M
Average Risk Score   : {avg_risk}/100
Critical-Risk Assets : {critical_count}
High-Risk Assets     : {high_count}
Medium-Risk Assets   : {medium_count}
Low-Risk Assets      : {low_count}
Total Scope 1 (tCO₂e): {total_scope1_t:,}
Sectors Represented  : {', '.join(sectors)}

ASSET RISK DATA
---------------
{asset_block}

---
Write the full intelligence brief now. Follow the exact section structure in your instructions.
Do not add any preamble before ## Scenario Intelligence."""


def stream_brief(payload: dict) -> Generator[str, None, None]:
    """
    Stream the GPT-4o intelligence brief as SSE-formatted text chunks.
    Each yielded string is a complete SSE line: 'data: <chunk>\\n\\n'
    """
    client = _get_client()
    prompt = build_prompt(payload)

    # Retrieve relevant proprietary rules
    try:
        scenario = payload.get("scenario_name", "")
        sectors = payload.get("portfolio_summary", {}).get("sectors", [])
        query = f"climate risk {scenario} physical transition supply chain {' '.join(sectors)}"
        kb_entries = retrieve(query, top_k=5)
        kb_context = format_context(kb_entries)
    except Exception:
        kb_context = ""

    system = SYSTEM_PROMPT + ("\n\n" + kb_context if kb_context else "")

    stream = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": system},
            {"role": "user",   "content": prompt},
        ],
        stream=True,
        temperature=0.35,
        max_tokens=3200,
    )

    for chunk in stream:
        delta = chunk.choices[0].delta
        if delta and delta.content:
            text = delta.content.replace("\n", "\\n")
            yield f"data: {text}\n\n"

    yield "data: [DONE]\n\n"
