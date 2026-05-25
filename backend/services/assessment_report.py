"""
Climactix — OpenAI GPT-4o Assessment Report Generator
=======================================================
Accepts structured ESG assessment data and streams a full
institutional-grade ESG/ERI report using GPT-4o.

Streaming: yields Server-Sent Events (text/event-stream) chunks
so the frontend can display the report as it is generated.
"""

import os
from typing import Generator, Optional

from openai import OpenAI

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


SYSTEM_PROMPT = """You are a senior ESG analyst at a global institutional advisory firm (tier: BlackRock, MSCI, S&P Global).
You produce institutional-grade ESG assessment reports for companies, investors, and regulators.

Your reports are:
- Data-driven and grounded in the company's actual assessment answers
- Written in professional, concise English — no fluff, no marketing language
- Structured with clear section headers using markdown (## for sections, ### for sub-sections)
- Quantitative wherever the data allows (use the exact scores provided)
- Aligned to TCFD, ISSB S2, CSRD/ESRS, GRI, and ERI 2.0 frameworks
- Honest about gaps and risks — do not sugarcoat poor scores

Report structure (always follow this exact order):
## Executive Summary
## ESG Performance Overview
## Environmental Performance Analysis
## Social & Governance Performance
## Framework Alignment & Regulatory Readiness
## Material Risks & Disclosure Gaps
## Strategic Recommendations
## Implementation Roadmap (12-Month)

Rules:
- Use the exact ERI score, tier, and category percentages provided — never invent numbers
- Bold key metrics and scores for scannability
- Each section should be 2–4 paragraphs (not bullet-point lists)
- Recommendations must be specific and actionable, not generic
- Close with a one-paragraph Analyst Conclusion"""


def build_prompt(payload: dict) -> str:
    co = payload.get("company_name", "The Company")
    industry = payload.get("industry", "Unknown Industry")
    year = payload.get("report_year", "FY 2025")
    eri_score = payload.get("eri_score", 0)
    tier = payload.get("tier_name", "Unknown")
    tier_desc = payload.get("tier_desc", "")

    env_score = payload.get("environmental_score", 0)
    soc_score = payload.get("social_score", 0)
    gov_score = payload.get("governance_score", 0)

    cat_lines = "\n".join(
        f"  - {c['title']}: {c['score']}%"
        for c in payload.get("category_scores", [])
    )

    fw_lines = "\n".join(
        f"  - {f['name']}: {f['score']}% ({f['status']})"
        for f in payload.get("framework_scores", [])
    )

    key_disclosures = payload.get("key_disclosures", "")

    return f"""Generate a full institutional ESG assessment report for the following company.

COMPANY PROFILE
---------------
Company Name : {co}
Industry     : {industry}
Reporting Year: {year}

ERI 2.0 OVERALL SCORE
----------------------
Score : {eri_score}/100
Tier  : {tier} — {tier_desc}

PILLAR SCORES
-------------
Environmental : {env_score}%
Social        : {soc_score}%
Governance    : {gov_score}%

CATEGORY BREAKDOWN
------------------
{cat_lines}

FRAMEWORK READINESS
-------------------
{fw_lines}

KEY DISCLOSURES (from self-assessment)
---------------------------------------
{key_disclosures if key_disclosures.strip() else "No written disclosures provided."}

---
Write the full report now. Follow the exact section structure specified in your instructions.
Do not add any preamble before ## Executive Summary."""


def stream_report(payload: dict) -> Generator[str, None, None]:
    """
    Stream the GPT-4o report as SSE-formatted text chunks.
    Each yielded string is a complete SSE line: 'data: <chunk>\\n\\n'
    """
    client = _get_client()
    prompt = build_prompt(payload)

    stream = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": prompt},
        ],
        stream=True,
        temperature=0.4,
        max_tokens=3000,
    )

    for chunk in stream:
        delta = chunk.choices[0].delta
        if delta and delta.content:
            # Escape newlines so SSE stays on one data: line per chunk
            text = delta.content.replace("\n", "\\n")
            yield f"data: {text}\n\n"

    yield "data: [DONE]\n\n"
