"""
Climactix AI — NLP Narrative Engine
Generates investor briefs, marketing narratives, social media content,
ESG summaries, and SDG mapping using the Anthropic Claude API.
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
    Single-call generation of all five content types.
    Returns a dict with: investor_brief, marketing_narrative, social_media,
    esg_summary, sdg_mapping.
    """
    # Truncate to avoid token limits while preserving key data
    truncated = esg_text[:9000]

    prompt = f"""Analyse the following ESG data for {company_name} and produce a comprehensive JSON response.

────────────────────────────
ESG SOURCE DATA
────────────────────────────
{truncated}
────────────────────────────

Return ONLY a single JSON object with exactly these five top-level keys.
Do NOT wrap in markdown. Do NOT add any text before or after the JSON.

{{
  "investor_brief": {{
    "headline": "One powerful, specific headline summarising ESG performance (max 20 words)",
    "executive_summary": "Four substantial paragraphs covering: (1) overall ESG performance and trajectory, (2) environmental highlights and risks, (3) social and governance highlights, (4) financial materiality and strategic outlook. Use specific metrics from the data.",
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

  "marketing_narrative": {{
    "headline": "Human, inspiring, brand-friendly ESG headline (max 15 words)",
    "story": "Three paragraphs of authentic brand storytelling — warm, human tone. Show the journey, the people, the impact. Avoid corporate jargon. Ground in specific data from the report.",
    "impact_statement": "One powerful, memorable sentence about the company's real-world climate impact",
    "tagline": "Short, memorable brand tagline (max 10 words)",
    "brand_pillars": [
      "Pillar 1: one sentence proof point",
      "Pillar 2: one sentence proof point",
      "Pillar 3: one sentence proof point"
    ]
  }},

  "social_media": {{
    "linkedin": "Professional LinkedIn post (250–320 words). Include: opening hook, key ESG achievement with specific metric, broader context/impact, call to action. Use line breaks for readability. End with 5–7 relevant hashtags on a new line.",
    "twitter_thread": [
      "Tweet 1/5: Attention-grabbing opening with key stat (max 270 chars, include 🧵)",
      "Tweet 2/5: Environmental highlight with specific metric (max 270 chars)",
      "Tweet 3/5: Social or governance achievement (max 270 chars)",
      "Tweet 4/5: Forward-looking commitment or target (max 270 chars)",
      "Tweet 5/5: Closing call to action (max 270 chars, include relevant hashtags)"
    ],
    "instagram": "Instagram caption (120–160 words). Conversational, upbeat tone. Start with emoji. Include 2–3 specific metrics woven into the story. End with a question or call to action. Add 10–12 relevant hashtags on the final line."
  }},

  "esg_summary": {{
    "report_title": "Official-sounding report title including company name and reporting period",
    "executive_summary": "Five well-structured paragraphs suitable for a regulatory filing or board report. Cover: (1) overview and governance of ESG strategy, (2) environmental performance, (3) social performance, (4) governance structures and accountability, (5) forward targets and commitments. Use formal, disclosure-standard language.",
    "environmental": "Two to three sentences summarising the most important environmental metrics and progress.",
    "social": "Two to three sentences summarising the most important social metrics and progress.",
    "governance": "Two to three sentences summarising governance structures, board oversight, and accountability.",
    "forward_guidance": "Two to three sentences on stated targets, timelines, and strategic commitments.",
    "frameworks_applied": ["GRI", "TCFD", "ISSB IFRS S1/S2"]
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
        "evidence": "Specific metric or initiative from the data that demonstrates this alignment."
      }},
      {{
        "number": 7,
        "name": "Affordable and Clean Energy",
        "icon": "⚡",
        "relevance_score": 85,
        "relevance_label": "High",
        "explanation": "Two to three sentences on alignment.",
        "evidence": "Specific metric from the data."
      }},
      {{
        "number": 12,
        "name": "Responsible Consumption and Production",
        "icon": "♻️",
        "relevance_score": 78,
        "relevance_label": "Medium",
        "explanation": "Two to three sentences on alignment.",
        "evidence": "Specific metric from the data."
      }},
      {{
        "number": 8,
        "name": "Decent Work and Economic Growth",
        "icon": "💼",
        "relevance_score": 70,
        "relevance_label": "Medium",
        "explanation": "Two to three sentences on alignment.",
        "evidence": "Specific metric or initiative from the data."
      }},
      {{
        "number": 17,
        "name": "Partnerships for the Goals",
        "icon": "🤝",
        "relevance_score": 62,
        "relevance_label": "Moderate",
        "explanation": "Two to three sentences on alignment.",
        "evidence": "Specific collaboration, certification, or framework alignment from the data."
      }}
    ],
    "alignment_summary": "Three sentences summarising the company's overall UN SDG alignment story and strategic fit.",
    "total_sdgs_addressed": 5
  }}
}}

IMPORTANT: Select SDGs based on the ACTUAL data provided. Adjust SDG numbers, names, icons, and scores to reflect what the data genuinely supports. The structure above is the template — fill it with accurate, data-driven content."""

    client = _get_client()
    response = client.messages.create(
        model=MODEL,
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = response.content[0].text.strip()
    return _parse_json(raw)


def _parse_json(raw: str) -> dict:
    """Strip markdown fences if present and parse JSON."""
    # Remove ```json ... ``` or ``` ... ``` wrappers
    raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.IGNORECASE)
    raw = re.sub(r"\s*```$", "", raw)
    raw = raw.strip()
    return json.loads(raw)
