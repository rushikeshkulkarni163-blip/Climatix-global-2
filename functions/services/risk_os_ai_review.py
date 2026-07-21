"""
Climactix — Risk OS Evidence AI Review
========================================
Real AI analysis of uploaded Risk OS evidence documents. Every output is
grounded in the evidence document's own extracted text — nothing here
invents metrics, targets, or commitments (CLAUDE.md AI System Rules).

This module is intentionally a thin orchestrator over engines that already
exist and are already in production for the Greenwashing Scanner and ESG
Framework Intelligence modules (services/greenwashing_scanner.py,
services/esg_framework_intelligence.py, services/extractor.py). Risk OS gets
real evidence analysis for free by reusing them, instead of standing up a
second, parallel, unvalidated AI pipeline.

Supported review_type values (matches risk_os_ai_reviews.review_type CHECK):
  summarize            LLM summary grounded in the document text only
  extract_data         Rule-based quantitative extraction (emissions, targets, %s)
  find_gaps            Missing disclosures against the unified framework model
  contradictions       Narrative-vs-data contradiction detection
  framework_mapping    Per-framework coverage (TCFD, IFRS S2, CSRD, ...)
  confidence_score     Composite confidence derived from the above
  exec_summary         Board-ready summary grounded in the document text
  compare_previous     Diff against the prior version of the same evidence slot
"""

from __future__ import annotations

import json
import os
from typing import Optional

from openai import OpenAI

from services.extractor import extract_text
from services.greenwashing_scanner import scan_for_greenwashing
from services.esg_framework_intelligence import run_intelligence_analysis

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
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    try:
        return json.loads(raw)
    except Exception:
        return {}


_GROUNDED_SYSTEM = """You are a climate risk analyst reviewing a single piece of evidence \
uploaded against one Risk OS assessment question for an institutional climate intelligence \
platform (banks, insurers, investors, regulators).

Hard rules:
- Base every statement ONLY on the document text you are given. Never invent a number, \
target, date, or commitment that is not present in the text.
- If the document does not contain something the analysis needs (e.g. no Scope 3 figure), \
say so explicitly as a gap — do not estimate or assume one.
- Write in the same institutional register as Moody's or MSCI analyst notes — no marketing \
language, no hedging filler.
- Return strict JSON only, matching the requested schema."""


def _extract_document_text(content: bytes, filename: str, content_type: str = "") -> str:
    text = extract_text(content, filename, content_type)
    if not text.strip():
        raise ValueError("Could not extract readable text from the file.")
    return text


def _llm_grounded(review_type: str, text: str, question_text: str, prior_summary: Optional[str]) -> dict:
    """summarize / exec_summary / find_gaps(narrative) / compare_previous — single grounded LLM call."""
    client = _get_client()

    task_instructions = {
        "summarize": (
            "Summarize what this document establishes, in 3-5 sentences. State only what is "
            "explicitly in the text."
        ),
        "exec_summary": (
            "Write a 2-3 sentence board-ready executive summary of this document's relevance "
            "to the assessment question below, written for a risk committee audience."
        ),
        "find_gaps": (
            "List what climate-relevant information the assessment question is asking for that "
            "this document does NOT provide. Be specific about what's missing, not what's present."
        ),
        "compare_previous": (
            "Compare this document's content against the summary of the PREVIOUS version of this "
            "evidence slot provided below. State concretely what changed, what improved, what got "
            "weaker, or 'No prior version to compare' if none was provided."
        ),
    }
    instruction = task_instructions.get(review_type)
    if instruction is None:
        raise ValueError(f"_llm_grounded does not handle review_type={review_type!r}")

    prior_block = f"\nPREVIOUS VERSION SUMMARY:\n{prior_summary}\n" if prior_summary else ""

    user_prompt = f"""ASSESSMENT QUESTION THIS EVIDENCE SUPPORTS:
{question_text or "(not specified)"}
{prior_block}
DOCUMENT TEXT (truncated to first 12000 characters):
{text[:12000]}

TASK:
{instruction}

Return JSON: {{"result": "<your answer>", "confidence": <0.0-1.0 based on how directly the text supports your answer>}}"""

    resp = client.chat.completions.create(
        model=MODEL,
        max_tokens=700,
        temperature=0.1,
        messages=[
            {"role": "system", "content": _GROUNDED_SYSTEM},
            {"role": "user", "content": user_prompt},
        ],
    )
    parsed = _parse_json(resp.choices[0].message.content or "")
    return {
        "output_summary": parsed.get("result", "").strip(),
        "confidence_score": round(float(parsed.get("confidence", 0.5)) * 100, 1),
        "model_used": MODEL,
    }


def run_ai_review(
    review_type: str,
    *,
    content: bytes,
    filename: str,
    content_type: str = "",
    company_name: str = "The Company",
    question_text: str = "",
    prior_summary: Optional[str] = None,
) -> dict:
    """
    Run one AI review pass against an uploaded evidence file.
    Returns a dict shaped to insert directly into risk_os_ai_reviews:
      { output_summary, extracted_data, contradictions, confidence_score, model_used }
    Raises ValueError for bad input (caller should return 400), RuntimeError for
    missing API key (caller should return 503 — AI not configured, not silently fake).
    """
    text = _extract_document_text(content, filename, content_type)

    if review_type in ("summarize", "exec_summary", "find_gaps", "compare_previous"):
        result = _llm_grounded(review_type, text, question_text, prior_summary)
        return {
            "output_summary": result["output_summary"],
            "extracted_data": None,
            "contradictions": None,
            "confidence_score": result["confidence_score"],
            "model_used": result["model_used"],
        }

    if review_type == "extract_data":
        scan = scan_for_greenwashing(text, company_name)
        return {
            "output_summary": f"Extracted {len(scan['data_extracted'])} quantitative data point(s) from {filename}.",
            "extracted_data": scan["data_extracted"],
            "contradictions": None,
            "confidence_score": None,
            "model_used": "greenwashing_scanner+rules",
        }

    if review_type == "contradictions":
        scan = scan_for_greenwashing(text, company_name)
        return {
            "output_summary": f"{len(scan['risk_flags'])} flag(s) detected. Overall risk: {scan['risk_level']}.",
            "extracted_data": None,
            "contradictions": scan["risk_flags"],
            "confidence_score": None,
            "model_used": "greenwashing_scanner+gpt",
        }

    if review_type == "framework_mapping":
        scan = scan_for_greenwashing(text, company_name)
        intel = run_intelligence_analysis(text, scan["data_extracted"], scan["risk_flags"], company_name)
        return {
            "output_summary": intel["coverage_summary"],
            "extracted_data": {
                "framework_coverage": intel["framework_coverage"],
                "gaps": intel["gaps"],
                "jurisdiction": intel["jurisdiction"],
            },
            "contradictions": None,
            "confidence_score": intel["integrity_score"],
            "model_used": "esg_framework_intelligence",
        }

    if review_type == "confidence_score":
        scan = scan_for_greenwashing(text, company_name)
        intel = run_intelligence_analysis(text, scan["data_extracted"], scan["risk_flags"], company_name)
        # Composite confidence: framework integrity, penalized by contradiction severity.
        severity_penalty = {"Critical": 40, "High": 25, "Medium": 12, "Low": 5, "None": 0}
        penalty = severity_penalty.get(
            max((f.get("severity", "Low") for f in scan["risk_flags"]), default="None",
                key=lambda s: severity_penalty.get(s, 0)),
            0,
        )
        composite = max(0, min(100, intel["integrity_score"] - penalty))
        label = "high" if composite >= 75 else "medium" if composite >= 50 else "low" if composite >= 25 else "review_required"
        return {
            "output_summary": (
                f"Composite confidence {composite}/100 ({label}) — framework integrity "
                f"{intel['integrity_score']}/100, {len(scan['risk_flags'])} contradiction flag(s)."
            ),
            "extracted_data": {"integrity_score": intel["integrity_score"], "flag_count": len(scan["risk_flags"])},
            "contradictions": None,
            "confidence_score": composite,
            "model_used": "risk_os_composite_v1",
        }

    raise ValueError(f"Unknown review_type: {review_type!r}")
