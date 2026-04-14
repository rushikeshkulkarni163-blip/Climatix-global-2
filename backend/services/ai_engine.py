"""
Climactix AI — NLP Intelligence Engine
Generates nine structured output types from raw ESG data:
  1. investor_brief      — financial-grade investor summary
  2. investor_output     — E/S/G breakdown, grade, positioning
  3. esg_structured      — classified E/S/G KPIs, gaps, inconsistencies
  4. insights            — what's improving vs needs attention
  5. risk_flags          — ESG risk flags with severity
  6. esg_summary         — board-ready regulatory summary
  7. marketing_narrative — brand storytelling
  8. social_media        — LinkedIn / X / Instagram content
  9. sdg_mapping         — UN SDG alignment with evidence
"""

import json
import os
import re
from typing import Optional

import anthropic

MODEL = os.getenv("CLAUDE_MODEL", "claude-opus-4-6")

_client: Optional[anthropic.Anthropic] = None


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY environment variable not set.")
        _client = anthropic.Anthropic(api_key=api_key)
    return _client


SYSTEM_PROMPT = """You are a senior ESG analyst and sustainability communications expert at a top-tier advisory firm.
Your role is to transform raw ESG data into clear, professional, investor-grade content.

Standards you apply:
- GRI (Global Reporting Initiative)
- TCFD (Task Force on Climate-related Financial Disclosures)
- ISSB / IFRS S1 & S2
- CSRD / ESRS
- UN Sustainable Development Goals (SDGs)

Output rules:
- Base content ONLY on the data provided — do not invent metrics
- Be specific and quantitative where data allows
- Write in clear, professional English (UK spelling preferred)
- Always return valid JSON — no markdown, no code fences, no extra text"""


def generate_all_narratives(esg_text: str, company_name: str = "The Company") -> dict:
    """
    Single-call generation of all nine content types.
    Returns a dict with all structured outputs.
    """
    truncated = esg_text[:10000]

    prompt = f"""Analyse the following ESG data for {company_name} and produce a comprehensive JSON response.

────────────────────────────
ESG SOURCE DATA
────────────────────────────
{truncated}
────────────────────────────

Return ONLY a single JSON object with exactly these nine top-level keys.
Do NOT wrap in markdown. Do NOT add any text before or after the JSON.

{{
  "investor_brief": {{
    "headline": "One powerful, specific headline summarising ESG performance (max 20 words)",
    "executive_summary": "Four substantial paragraphs covering: (1) overall ESG performance and trajectory, (2) environmental highlights and risks, (3) social and governance highlights, (4) financial materiality and strategic outlook. Use specific metrics.",
    "key_metrics": [
      "Metric label: value and unit (change vs prior year)",
      "Metric label: value and unit (change vs prior year)",
      "Metric label: value and unit (change vs prior year)",
      "Metric label: value and unit (change vs prior year)",
      "Metric label: value and unit (change vs prior year)"
    ],
    "risks": [
      "Specific risk 1 with context",
      "Specific risk 2 with context",
      "Specific risk 3 with context"
    ],
    "opportunities": [
      "Specific opportunity 1 with rationale",
      "Specific opportunity 2 with rationale",
      "Specific opportunity 3 with rationale"
    ],
    "recommendation": "One sentence investor-grade recommendation or engagement prompt"
  }},

  "investor_output": {{
    "esg_grade": "One of: A+, A, A-, B+, B, B-, C+, C, D — based on data quality and ESG ambition",
    "sustainability_positioning": "Two sentences positioning the company within its peer group and sector context.",
    "investment_thesis": "Two to three sentences articulating why this company's ESG profile is material to its investment case.",
    "e_score_rationale": "One sentence justifying the Environmental pillar strength.",
    "s_score_rationale": "One sentence justifying the Social pillar strength.",
    "g_score_rationale": "One sentence justifying the Governance pillar strength.",
    "growth_opportunities": [
      "Specific, quantifiable opportunity 1",
      "Specific, quantifiable opportunity 2",
      "Specific, quantifiable opportunity 3"
    ],
    "key_risks": [
      "Financially material risk 1",
      "Financially material risk 2",
      "Financially material risk 3"
    ],
    "peer_comparison": "One sentence on how this company's ESG performance compares to sector peers."
  }},

  "esg_structured": {{
    "environmental": {{
      "kpis": [
        {{"label": "KPI name", "value": "numeric value or N/A", "unit": "tCO2e / % / kWh etc.", "trend": "improving"}},
        {{"label": "KPI name", "value": "numeric value or N/A", "unit": "unit", "trend": "stable"}},
        {{"label": "KPI name", "value": "numeric value or N/A", "unit": "unit", "trend": "declining"}}
      ],
      "missing_fields": ["Field name 1", "Field name 2"],
      "inconsistencies": []
    }},
    "social": {{
      "kpis": [
        {{"label": "KPI name", "value": "value", "unit": "unit", "trend": "improving"}},
        {{"label": "KPI name", "value": "value", "unit": "unit", "trend": "stable"}}
      ],
      "missing_fields": ["Field name 1"],
      "inconsistencies": []
    }},
    "governance": {{
      "kpis": [
        {{"label": "KPI name", "value": "value", "unit": "unit", "trend": "stable"}},
        {{"label": "KPI name", "value": "value", "unit": "unit", "trend": "improving"}}
      ],
      "missing_fields": ["Field name 1"],
      "inconsistencies": []
    }},
    "data_completeness": 72,
    "total_kpis_found": 8
  }},

  "insights": {{
    "improving": [
      {{"title": "Short title", "detail": "One to two sentences of explanation with data.", "metric": "Specific metric or % change", "category": "Environmental"}},
      {{"title": "Short title", "detail": "Explanation.", "metric": "Metric", "category": "Social"}},
      {{"title": "Short title", "detail": "Explanation.", "metric": "Metric", "category": "Governance"}}
    ],
    "needs_attention": [
      {{"title": "Short title", "detail": "One to two sentences explaining the gap or risk.", "urgency": "High", "category": "Environmental"}},
      {{"title": "Short title", "detail": "Explanation.", "urgency": "Medium", "category": "Social"}},
      {{"title": "Short title", "detail": "Explanation.", "urgency": "Low", "category": "Governance"}}
    ],
    "strategic_narrative": "Two to three sentences summarising the overall ESG momentum and priority actions."
  }},

  "risk_flags": [
    {{
      "title": "Risk title (max 8 words)",
      "description": "Two sentences describing the risk, its source, and potential impact.",
      "severity": "High",
      "category": "Environmental",
      "mitigation": "One sentence on the recommended or stated mitigation action."
    }},
    {{
      "title": "Risk title",
      "description": "Description.",
      "severity": "Medium",
      "category": "Social",
      "mitigation": "Mitigation."
    }},
    {{
      "title": "Risk title",
      "description": "Description.",
      "severity": "Low",
      "category": "Governance",
      "mitigation": "Mitigation."
    }}
  ],

  "esg_summary": {{
    "report_title": "Official-sounding report title including company name and reporting period",
    "executive_summary": "Five well-structured paragraphs suitable for a regulatory filing or board report. Cover: (1) overview and governance of ESG strategy, (2) environmental performance, (3) social performance, (4) governance structures and accountability, (5) forward targets and commitments.",
    "environmental": "Two to three sentences summarising the most important environmental metrics and progress.",
    "social": "Two to three sentences summarising the most important social metrics and progress.",
    "governance": "Two to three sentences summarising governance structures, board oversight, and accountability.",
    "forward_guidance": "Two to three sentences on stated targets, timelines, and strategic commitments.",
    "frameworks_applied": ["GRI", "TCFD", "ISSB IFRS S1/S2"]
  }},

  "marketing_narrative": {{
    "headline": "Human, inspiring, brand-friendly ESG headline (max 15 words)",
    "story": "Three paragraphs of authentic brand storytelling — warm, human tone. Show the journey, the people, the impact. Ground in specific data.",
    "impact_statement": "One powerful, memorable sentence about the company's real-world climate impact",
    "tagline": "Short, memorable brand tagline (max 10 words)",
    "brand_pillars": [
      "Pillar 1: one sentence proof point",
      "Pillar 2: one sentence proof point",
      "Pillar 3: one sentence proof point"
    ]
  }},

  "social_media": {{
    "linkedin": "Professional LinkedIn post (250–320 words). Opening hook, key ESG achievement with metric, broader impact, call to action. End with 5–7 hashtags.",
    "twitter_thread": [
      "Tweet 1/5: Attention-grabbing opening with key stat (max 270 chars, include 🧵)",
      "Tweet 2/5: Environmental highlight with metric (max 270 chars)",
      "Tweet 3/5: Social or governance achievement (max 270 chars)",
      "Tweet 4/5: Forward-looking commitment or target (max 270 chars)",
      "Tweet 5/5: Closing call to action (max 270 chars, hashtags)"
    ],
    "instagram": "Instagram caption (120–160 words). Conversational, upbeat. Start with emoji. 2–3 metrics woven in. End with question + 10–12 hashtags."
  }},

  "sdg_mapping": {{
    "top_sdgs": [
      {{
        "number": 13,
        "name": "Climate Action",
        "icon": "🌡️",
        "relevance_score": 92,
        "relevance_label": "High",
        "explanation": "Two to three sentences explaining how the company's data aligns with this SDG.",
        "evidence": "Specific metric or initiative from the data."
      }},
      {{
        "number": 7,
        "name": "Affordable and Clean Energy",
        "icon": "⚡",
        "relevance_score": 85,
        "relevance_label": "High",
        "explanation": "Two to three sentences on alignment.",
        "evidence": "Specific metric."
      }},
      {{
        "number": 12,
        "name": "Responsible Consumption and Production",
        "icon": "♻️",
        "relevance_score": 78,
        "relevance_label": "Medium",
        "explanation": "Two to three sentences on alignment.",
        "evidence": "Specific metric."
      }},
      {{
        "number": 8,
        "name": "Decent Work and Economic Growth",
        "icon": "💼",
        "relevance_score": 70,
        "relevance_label": "Medium",
        "explanation": "Two to three sentences on alignment.",
        "evidence": "Specific metric or initiative."
      }},
      {{
        "number": 17,
        "name": "Partnerships for the Goals",
        "icon": "🤝",
        "relevance_score": 62,
        "relevance_label": "Moderate",
        "explanation": "Two to three sentences on alignment.",
        "evidence": "Collaboration, certification, or framework alignment."
      }}
    ],
    "alignment_summary": "Three sentences summarising the company's overall UN SDG alignment story.",
    "total_sdgs_addressed": 5
  }}
}}

IMPORTANT: Select SDGs based on the ACTUAL data. Adjust SDG numbers, names, icons, and scores to reflect genuine alignment. Fill esg_structured KPIs from the actual metrics found in the data. Risk flags must be grounded in real gaps or exposures in the data, not generic statements."""

    client = _get_client()
    response = client.messages.create(
        model=MODEL,
        max_tokens=7000,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = response.content[0].text.strip()
    return _parse_json(raw)


def _parse_json(raw: str) -> dict:
    """Strip markdown fences if present and parse JSON."""
    raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.IGNORECASE)
    raw = re.sub(r"\s*```$", "", raw)
    raw = raw.strip()
    return json.loads(raw)
