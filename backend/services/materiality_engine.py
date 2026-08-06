"""
Dynamic Materiality & Aspect Impact Engine.

Determines, per industry: which environmental sub-aspects are applicable,
how significant each aspect category is, and the resulting weight matrix
used by the Environmental Impact Index on the enterprise assessment.

All reference data (applicability, materiality parameter scores, framework
crosswalk, adaptive question tiers) lives in Postgres — see
backend/migrations/003_materiality_schema.sql — so the methodology can be
revised without a code change. This module only implements the computation
that turns that data into a per-industry profile.
"""

from typing import Optional

import asyncpg

CLIMATE_WATER_CATEGORIES = ("climate", "water")

BASELINE_TIER_MIDPOINT = {
    "insignificant": 10,
    "low": 30,
    "moderate": 50,
    "high": 70,
    "critical": 90,
}


def classify_significance_band(score: float) -> str:
    """0-20/21-40/41-60/61-80/81-100 -> Insignificant..Critical."""
    if score <= 20:
        return "Insignificant"
    if score <= 40:
        return "Low"
    if score <= 60:
        return "Moderate"
    if score <= 80:
        return "High"
    return "Critical"


async def _fetch_categories(pool: asyncpg.Pool) -> list[asyncpg.Record]:
    return await pool.fetch(
        "SELECT id, label, description, sort_order FROM materiality_categories ORDER BY sort_order"
    )


async def _fetch_sub_aspects(pool: asyncpg.Pool) -> list[asyncpg.Record]:
    return await pool.fetch(
        "SELECT id, category_id, label, description, sort_order "
        "FROM materiality_sub_aspects ORDER BY category_id, sort_order"
    )


async def get_applicable_sub_aspects(pool: asyncpg.Pool, industry_key: str) -> dict[str, list[str]]:
    """Return {category_id: [applicable sub_aspect_id, ...]} for the given industry."""
    sub_aspects = await _fetch_sub_aspects(pool)
    excluded_rows = await pool.fetch(
        "SELECT sub_aspect_id FROM materiality_industry_exclusions WHERE industry_key = $1",
        industry_key,
    )
    excluded = {r["sub_aspect_id"] for r in excluded_rows}

    result: dict[str, list[str]] = {}
    for row in sub_aspects:
        if row["id"] in excluded:
            continue
        result.setdefault(row["category_id"], []).append(row["id"])
    return result


async def get_category_significance(
    pool: asyncpg.Pool, industry_key: str, category_id: str
) -> dict:
    """
    Compute a category's 0-100 significance score for an industry.

    Climate/Water: weighted sum of the 12 materiality parameters (1-5 each,
    weights sum to 100) -> max possible = 5 * 100 = 500 -> /5 normalizes to 0-100.
    Other categories: a direct baseline-tier classification mapped to its
    tier midpoint (documented modeling simplification pending full
    parameter-level authoring for those categories).
    """
    if category_id in CLIMATE_WATER_CATEGORIES:
        rows = await pool.fetch(
            """
            SELECT s.parameter_id, s.score, p.label, p.global_weight
            FROM materiality_category_parameter_scores s
            JOIN materiality_parameters p ON p.id = s.parameter_id
            WHERE s.industry_key = $1 AND s.category_id = $2
            ORDER BY p.sort_order
            """,
            industry_key,
            category_id,
        )
        if not rows:
            return {"score": None, "band": None, "source": "parameter", "parameters": []}
        weighted_sum = sum(r["score"] * float(r["global_weight"]) for r in rows)
        score = round(weighted_sum / 5)
        parameters = [
            {
                "id": r["parameter_id"],
                "label": r["label"],
                "score": r["score"],
                "globalWeight": float(r["global_weight"]),
            }
            for r in rows
        ]
        return {
            "score": score,
            "band": classify_significance_band(score),
            "source": "parameter",
            "parameters": parameters,
        }

    row = await pool.fetchrow(
        "SELECT tier, rationale FROM materiality_baseline_tiers "
        "WHERE industry_key = $1 AND category_id = $2",
        industry_key,
        category_id,
    )
    if not row:
        return {"score": None, "band": None, "source": "baseline", "tier": None, "rationale": None}
    score = BASELINE_TIER_MIDPOINT[row["tier"]]
    return {
        "score": score,
        "band": classify_significance_band(score),
        "source": "baseline",
        "tier": row["tier"],
        "rationale": row["rationale"],
    }


def normalize_weights(significance_by_category: dict[str, Optional[float]]) -> dict[str, float]:
    """
    Normalize significance scores of applicable categories (score is not
    None) so they sum to 100. Categories with no applicable sub-aspects
    should already be excluded from the input map by the caller.
    """
    applicable = {k: v for k, v in significance_by_category.items() if v is not None}
    total = sum(applicable.values())
    if total <= 0:
        if not applicable:
            return {}
        equal = round(100 / len(applicable), 2)
        return {k: equal for k in applicable}
    return {k: round(v / total * 100, 2) for k, v in applicable.items()}


async def get_adaptive_tier(pool: asyncpg.Pool, sub_aspect_id: str, band: Optional[str]) -> tuple[str, str]:
    """Return (tier, content_status) for a sub-aspect given its category's significance band."""
    has_expanded = await pool.fetchval(
        "SELECT EXISTS(SELECT 1 FROM materiality_question_tiers WHERE sub_aspect_id = $1 AND tier = 'expanded')",
        sub_aspect_id,
    )
    has_base = await pool.fetchval(
        "SELECT EXISTS(SELECT 1 FROM materiality_question_tiers WHERE sub_aspect_id = $1 AND tier = 'base')",
        sub_aspect_id,
    )
    if not has_base:
        return "base", "pending_authoring"
    if has_expanded and band in ("High", "Critical"):
        return "expanded", "authored"
    return "base", "authored"


async def get_questions_for_tier(pool: asyncpg.Pool, sub_aspect_id: str, tier: str) -> list[dict]:
    """Base tier returns just base questions; expanded returns base + expanded."""
    tiers = ["base"] if tier == "base" else ["base", "expanded"]
    rows = await pool.fetch(
        """
        SELECT question_id, tier, label, sublabel, type, unit, min_words, weight, sort_order
        FROM materiality_question_tiers
        WHERE sub_aspect_id = $1 AND tier = ANY($2::text[])
        ORDER BY tier, sort_order
        """,
        sub_aspect_id,
        tiers,
    )
    questions = []
    for r in rows:
        q = {
            "questionId": r["question_id"],
            "tier": r["tier"],
            "label": r["label"],
            "sublabel": r["sublabel"],
            "type": r["type"],
            "unit": r["unit"],
            "minWords": r["min_words"],
            "weight": float(r["weight"]),
        }
        if r["type"] == "dropdown":
            opt_rows = await pool.fetch(
                "SELECT label, score FROM materiality_question_options "
                "WHERE question_id = $1 ORDER BY sort_order",
                r["question_id"],
            )
            q["opts"] = [{"label": o["label"], "score": o["score"]} for o in opt_rows]
        questions.append(q)
    return questions


async def get_framework_crosswalk(pool: asyncpg.Pool) -> dict[str, list[dict]]:
    rows = await pool.fetch(
        "SELECT category_id, framework, clause, requirement, evidence_required, "
        "min_evidence_for_compliance, sort_order FROM materiality_framework_crosswalk "
        "ORDER BY category_id, sort_order"
    )
    crosswalk: dict[str, list[dict]] = {}
    for r in rows:
        crosswalk.setdefault(r["category_id"], []).append(
            {
                "framework": r["framework"],
                "clause": r["clause"],
                "requirement": r["requirement"],
                "evidenceRequired": r["evidence_required"],
                "minEvidenceForCompliance": r["min_evidence_for_compliance"],
            }
        )
    return crosswalk


async def build_materiality_profile(pool: asyncpg.Pool, industry_key: str) -> dict:
    """Assemble the full per-industry materiality profile in one call."""
    categories = await _fetch_categories(pool)
    if not categories:
        raise RuntimeError("materiality_categories table is empty — has migration 003 run?")

    valid_industries = await pool.fetch(
        "SELECT DISTINCT industry_key FROM materiality_industry_exclusions "
        "UNION SELECT DISTINCT industry_key FROM materiality_baseline_tiers "
        "UNION SELECT DISTINCT industry_key FROM materiality_category_parameter_scores"
    )
    known_industries = {r["industry_key"] for r in valid_industries}
    if industry_key not in known_industries:
        raise ValueError(f"unknown industry_key '{industry_key}'")

    applicable_map = await get_applicable_sub_aspects(pool, industry_key)
    sub_aspects = await _fetch_sub_aspects(pool)
    sub_aspects_by_category: dict[str, list[asyncpg.Record]] = {}
    for row in sub_aspects:
        sub_aspects_by_category.setdefault(row["category_id"], []).append(row)

    significance_by_category: dict[str, Optional[float]] = {}
    significance_detail: dict[str, dict] = {}
    for cat in categories:
        cid = cat["id"]
        applicable_subs = applicable_map.get(cid, [])
        if not applicable_subs:
            significance_by_category[cid] = None
            significance_detail[cid] = {"score": None, "band": None, "source": None}
            continue
        sig = await get_category_significance(pool, industry_key, cid)
        significance_by_category[cid] = sig["score"]
        significance_detail[cid] = sig

    weights = normalize_weights(significance_by_category)
    framework_crosswalk = await get_framework_crosswalk(pool)

    content_authoring = {cat["id"]: cat["id"] in CLIMATE_WATER_CATEGORIES for cat in categories}

    category_payloads = []
    for cat in categories:
        cid = cat["id"]
        applicable_subs = set(applicable_map.get(cid, []))
        sub_payloads = []
        for sub in sub_aspects_by_category.get(cid, []):
            sid = sub["id"]
            is_applicable = sid in applicable_subs
            if not is_applicable:
                sub_payloads.append(
                    {"id": sid, "label": sub["label"], "applicable": False, "tier": None,
                     "contentStatus": None, "questions": []}
                )
                continue
            band = significance_detail[cid]["band"]
            tier, content_status = await get_adaptive_tier(pool, sid, band)
            questions = (
                await get_questions_for_tier(pool, sid, tier)
                if content_status == "authored"
                else []
            )
            sub_payloads.append(
                {
                    "id": sid,
                    "label": sub["label"],
                    "applicable": True,
                    "tier": tier,
                    "contentStatus": content_status,
                    "questions": questions,
                }
            )

        category_payloads.append(
            {
                "categoryId": cid,
                "label": cat["label"],
                "applicable": cid in weights,
                "significance": significance_detail[cid],
                "weightPct": weights.get(cid, 0),
                "subAspects": sub_payloads,
            }
        )

    return {
        "industryKey": industry_key,
        "categories": category_payloads,
        "frameworkCrosswalk": framework_crosswalk,
        "contentAuthoring": content_authoring,
    }


async def get_parameter_definitions(pool: asyncpg.Pool) -> list[dict]:
    rows = await pool.fetch(
        "SELECT id, label, global_weight FROM materiality_parameters ORDER BY sort_order"
    )
    return [{"id": r["id"], "label": r["label"], "globalWeight": float(r["global_weight"])} for r in rows]
