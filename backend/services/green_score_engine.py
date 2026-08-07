"""
Climactix Green Production — Sustainability Score Engine v1.0
Computes the Climactix Green Production Score (0-100) from a weighted blend
of measured activity data (carbon, water, waste, transportation) and the
sustainability questionnaire (energy, procurement, biodiversity, social —
dimensions with no direct volumetric activity feed in this phase), then
maps the score to a Bronze -> Diamond certification level.

Architecture:
  Activity Logs + Water/Waste Records -> Quantitative Sub-Scores
  Questionnaire Responses              -> Qualitative Sub-Scores
  Quantitative + Qualitative (blended per dimension) -> 8 Dimension Scores
  Dimension Scores x Composite Weights -> Total Score -> Certification Level

Every sub-score is returned with its component breakdown so results are
explainable, not a black box.

Proprietary IP of Climactix Global. All rights reserved.
"""

from __future__ import annotations
import json
from typing import Optional

import asyncpg

from services.green_carbon_engine import get_production_footprint
from services.green_water_waste_engine import get_water_summary, get_waste_summary


# ── Composite weights (sum to 100) ────────────────────────────────────────────

DIMENSION_WEIGHTS = {
    "carbon": 30, "energy": 15, "water": 10, "waste": 15,
    "procurement": 10, "transportation": 10, "biodiversity": 5, "social": 5,
}

# ── Carbon intensity bands (kgCO2e per crew-day) — anchored to certification
# thresholds in green_certification_levels so score and certification agree.
_CARBON_INTENSITY_BANDS = [
    (40,  100), (80, 85), (120, 70), (180, 55), (300, 40), (float("inf"), 15),
]

_BOOL_QUESTION_SCORE = {True: 100.0, False: 25.0}

_SINGLE_SELECT_SCORES = {
    "q_generator_fuel_type": {
        "Electric/Battery": 100, "No generators used": 100, "Hybrid": 85,
        "Biofuel": 70, "Petrol": 40, "Diesel": 25,
    },
    "q_emissions_review_cadence": {
        "Daily": 100, "Weekly": 85, "Monthly": 60, "Only at wrap": 35, "Not reviewed": 10,
    },
}

# question_id -> scoring_dimension is authoritative in the DB, but the blend
# ratio (quantitative vs qualitative weight) is a modeling decision that
# lives here, one entry per dimension.
_BLEND_RATIO = {
    # dimension: (quantitative_weight, qualitative_weight)
    "carbon": (0.70, 0.30),
    "energy": (0.0, 1.0),
    "water": (0.60, 0.40),
    "waste": (0.60, 0.40),
    "procurement": (0.0, 1.0),
    "transportation": (0.50, 0.50),
    "biodiversity": (0.0, 1.0),
    "social": (0.0, 1.0),
}


def _score_question_response(question: dict, response) -> float:
    qtype = question["question_type"]
    qid = question["id"]
    if qtype == "boolean":
        return _BOOL_QUESTION_SCORE.get(bool(response), 50.0)
    if qtype == "numeric":
        try:
            return max(0.0, min(100.0, float(response)))
        except (TypeError, ValueError):
            return 50.0
    if qtype == "single_select":
        table = _SINGLE_SELECT_SCORES.get(qid)
        if table and response in table:
            return float(table[response])
        return 50.0
    return 50.0


async def _qualitative_dimension_scores(pool: asyncpg.Pool, production_id: str) -> dict[str, dict]:
    """Weighted-average score per scoring_dimension from questionnaire responses.
    Dimensions with no answered questions default to a neutral 50 (provisional)."""
    rows = await pool.fetch(
        """
        SELECT q.id, q.scoring_dimension, q.weight, q.question_type, r.response
        FROM green_questionnaire_questions q
        LEFT JOIN green_questionnaire_responses r
          ON r.question_id = q.id AND r.production_id = $1
        """,
        production_id,
    )

    accum: dict[str, list[tuple[float, float]]] = {}
    answered: dict[str, int] = {}
    for r in rows:
        dim = r["scoring_dimension"]
        accum.setdefault(dim, [])
        if r["response"] is None:
            continue
        response_val = json.loads(r["response"]) if isinstance(r["response"], str) else r["response"]
        question = {"id": r["id"], "question_type": r["question_type"]}
        score = _score_question_response(question, response_val)
        weight = float(r["weight"])
        accum[dim].append((score, weight))
        answered[dim] = answered.get(dim, 0) + 1

    result = {}
    for dim, pairs in accum.items():
        if not pairs:
            result[dim] = {"score": 50.0, "answeredCount": 0, "provisional": True}
            continue
        total_weight = sum(w for _, w in pairs)
        weighted = sum(s * w for s, w in pairs) / total_weight if total_weight else 50.0
        result[dim] = {"score": round(weighted, 1), "answeredCount": answered.get(dim, 0), "provisional": False}
    return result


def _carbon_intensity_to_score(co2e_per_crew_day: Optional[float]) -> float:
    if co2e_per_crew_day is None:
        return 50.0  # no measured intensity yet — neutral, not penalized
    for threshold, score in _CARBON_INTENSITY_BANDS:
        if co2e_per_crew_day <= threshold:
            return float(score)
    return 15.0


def _water_recycling_to_score(recycling_rate_pct: float) -> float:
    # 0% -> 40 floor (some usage is unavoidable), 50% -> ~75, 100% -> 100
    return round(min(100.0, 40 + recycling_rate_pct * 0.6), 1)


def _waste_diversion_to_score(diversion_rate_pct: float) -> float:
    # 0% -> 20 floor, 50% -> 60, 100% -> 100
    return round(min(100.0, 20 + diversion_rate_pct * 0.8), 1)


async def _transportation_quantitative_score(pool: asyncpg.Pool, production_id: str) -> Optional[float]:
    rows = await pool.fetch(
        """
        SELECT l.category_id, SUM(l.co2e_kg) AS co2e_kg
        FROM green_activity_logs l
        JOIN green_activity_categories c ON c.id = l.category_id
        WHERE l.production_id = $1 AND c.department IN
          ('crew_transport','air_travel','rail_metro_boat')
        GROUP BY l.category_id
        """,
        production_id,
    )
    if not rows:
        return None
    total = sum(float(r["co2e_kg"] or 0) for r in rows)
    if total <= 0:
        return None
    low_carbon_ids = {"crew_transport_ev", "crew_transport_hybrid", "rail_travel", "metro_travel"}
    low_carbon = sum(float(r["co2e_kg"] or 0) for r in rows if r["category_id"] in low_carbon_ids)
    # Low-carbon share of transport CO2e, inverted against the fact that EV/rail
    # legitimately produce *less* CO2e per km — so this reads count/activity mix,
    # weighted toward the floor to avoid rewarding simply not tracking transport.
    clean_share_by_volume = 1 - (low_carbon / total) if total else 0
    # A high clean_share_by_volume here actually means high-carbon modes dominate
    # remaining CO2e, so score is the complement.
    return round(max(0.0, min(100.0, (1 - clean_share_by_volume) * 60 + 30)), 1)


async def _biodiversity_location_adjustment(pool: asyncpg.Pool, production_id: str, protocol_confirmed: bool) -> Optional[float]:
    row = await pool.fetchrow(
        "SELECT COUNT(*) AS n FROM green_production_locations "
        "WHERE production_id = $1 AND protected_area_flag = TRUE",
        production_id,
    )
    if row["n"] and not protocol_confirmed:
        return 60.0  # cap — filming in a protected area without a confirmed mitigation protocol
    return None


async def compute_score(pool: asyncpg.Pool, production_id: str, persist: bool = True) -> dict:
    footprint = await get_production_footprint(pool, production_id)
    water = await get_water_summary(pool, production_id)
    waste = await get_waste_summary(pool, production_id)
    qualitative = await _qualitative_dimension_scores(pool, production_id)

    def qual(dim: str) -> float:
        return qualitative.get(dim, {"score": 50.0})["score"]

    quant_scores: dict[str, Optional[float]] = {
        "carbon": _carbon_intensity_to_score(footprint["co2ePerCrewDay"]),
        "energy": None,
        "water": _water_recycling_to_score(water["recyclingRatePct"]),
        "waste": _waste_diversion_to_score(waste["diversionRatePct"]),
        "procurement": None,
        "transportation": await _transportation_quantitative_score(pool, production_id),
        "biodiversity": None,
        "social": None,
    }

    dimension_scores: dict[str, float] = {}
    breakdown: dict[str, dict] = {}
    for dim, weight in DIMENSION_WEIGHTS.items():
        q_weight, ql_weight = _BLEND_RATIO[dim]
        quant = quant_scores.get(dim)
        qualv = qual(dim)
        if quant is None:
            score = qualv
            q_weight_effective, ql_weight_effective = 0.0, 1.0
        else:
            score = quant * q_weight + qualv * ql_weight
            q_weight_effective, ql_weight_effective = q_weight, ql_weight
        score = round(max(0.0, min(100.0, score)), 1)
        dimension_scores[dim] = score
        breakdown[dim] = {
            "score": score,
            "compositeWeightPct": weight,
            "quantitativeScore": quant,
            "qualitativeScore": qualv,
            "quantitativeWeight": q_weight_effective,
            "qualitativeWeight": ql_weight_effective,
            "questionnaireAnswered": qualitative.get(dim, {}).get("answeredCount", 0),
        }

    # Biodiversity location override (protected-area filming without a confirmed protocol)
    protocol_confirmed = False
    proto_row = await pool.fetchrow(
        "SELECT response FROM green_questionnaire_responses "
        "WHERE production_id = $1 AND question_id = 'q_wildlife_disturbance_protocol'",
        production_id,
    )
    if proto_row and proto_row["response"] is not None:
        protocol_confirmed = bool(json.loads(proto_row["response"]) if isinstance(proto_row["response"], str) else proto_row["response"])
    bio_cap = await _biodiversity_location_adjustment(pool, production_id, protocol_confirmed)
    if bio_cap is not None and dimension_scores["biodiversity"] > bio_cap:
        dimension_scores["biodiversity"] = bio_cap
        breakdown["biodiversity"]["locationCap"] = bio_cap
        breakdown["biodiversity"]["locationCapReason"] = "Filming in a protected area without a confirmed wildlife-disturbance protocol."

    total_score = round(sum(dimension_scores[d] * DIMENSION_WEIGHTS[d] / 100 for d in DIMENSION_WEIGHTS), 1)

    level = await determine_certification_level(pool, production_id, total_score, footprint["co2ePerCrewDay"])

    result = {
        "productionId": production_id,
        "totalScore": total_score,
        "dimensionScores": dimension_scores,
        "breakdown": breakdown,
        "totalCo2eKg": footprint["totalCo2eKg"],
        "co2ePerCrewDay": footprint["co2ePerCrewDay"],
        "certificationLevel": level,
    }

    if persist:
        row = await pool.fetchrow(
            """
            INSERT INTO green_score_snapshots
              (production_id, total_score, carbon_score, energy_score, water_score, waste_score,
               procurement_score, transportation_score, biodiversity_score, social_score,
               total_co2e_kg, co2e_per_crew_day, certification_level_id, breakdown)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
            RETURNING id, computed_at
            """,
            production_id, total_score,
            dimension_scores["carbon"], dimension_scores["energy"], dimension_scores["water"],
            dimension_scores["waste"], dimension_scores["procurement"], dimension_scores["transportation"],
            dimension_scores["biodiversity"], dimension_scores["social"],
            footprint["totalCo2eKg"], footprint["co2ePerCrewDay"],
            level["levelId"], json.dumps(breakdown),
        )
        result["snapshotId"] = row["id"]
        result["computedAt"] = row["computed_at"].isoformat()

    return result


# ── Certification ─────────────────────────────────────────────────────────────

async def _check_mandatory_criterion(
    pool: asyncpg.Pool, production_id: str, criterion: str,
    responses: dict[str, object], total_co2e_kg: float,
) -> bool:
    if criterion == "carbon_footprint_measured":
        n = await pool.fetchval(
            "SELECT COUNT(*) FROM green_activity_logs WHERE production_id = $1", production_id)
        return n > 0
    if criterion == "waste_segregation_practiced":
        return bool(responses.get("q_waste_segregation"))
    if criterion == "water_recycling_program":
        return bool(responses.get("q_water_recycling_program"))
    if criterion == "local_hiring_priority":
        v = responses.get("q_local_hiring_share")
        return isinstance(v, (int, float)) and v >= 50
    if criterion == "renewable_energy_partial":
        led = responses.get("q_led_lighting_share")
        return bool(responses.get("q_renewable_electricity")) or (isinstance(led, (int, float)) and led >= 50)
    if criterion == "single_use_plastic_ban":
        return bool(responses.get("q_single_use_plastic_ban"))
    if criterion == "renewable_energy_majority":
        led = responses.get("q_led_lighting_share")
        return bool(responses.get("q_renewable_electricity")) and isinstance(led, (int, float)) and led >= 75
    if criterion == "biodiversity_assessment_completed":
        n = await pool.fetchval(
            "SELECT COUNT(*) FROM green_production_locations WHERE production_id = $1", production_id)
        protected = await pool.fetchval(
            "SELECT COUNT(*) FROM green_production_locations "
            "WHERE production_id = $1 AND protected_area_flag = TRUE", production_id)
        if not n:
            return False
        if protected:
            return bool(responses.get("q_wildlife_disturbance_protocol"))
        return True
    if criterion == "residual_emissions_offset":
        offset_total = await pool.fetchval(
            "SELECT COALESCE(SUM(co2e_offset_kg), 0) FROM green_offsets WHERE production_id = $1",
            production_id,
        )
        return total_co2e_kg > 0 and float(offset_total) >= total_co2e_kg * 0.8
    if criterion == "community_impact_program":
        return bool(responses.get("q_community_engagement"))
    return False


async def determine_certification_level(
    pool: asyncpg.Pool, production_id: str, total_score: float, co2e_per_crew_day: Optional[float]
) -> dict:
    levels = await pool.fetch(
        "SELECT id, label, min_score, max_co2e_per_crew_day, mandatory_criteria, improvement_note "
        "FROM green_certification_levels ORDER BY sort_order DESC"
    )

    resp_rows = await pool.fetch(
        "SELECT question_id, response FROM green_questionnaire_responses WHERE production_id = $1",
        production_id,
    )
    responses = {
        r["question_id"]: json.loads(r["response"]) if isinstance(r["response"], str) else r["response"]
        for r in resp_rows
    }
    total_co2e_kg = await pool.fetchval(
        "SELECT COALESCE(SUM(co2e_kg), 0) FROM green_activity_logs WHERE production_id = $1",
        production_id,
    )

    for lvl in levels:
        if total_score < float(lvl["min_score"]):
            continue
        if lvl["max_co2e_per_crew_day"] is not None:
            if co2e_per_crew_day is None or co2e_per_crew_day > float(lvl["max_co2e_per_crew_day"]):
                continue
        criteria = json.loads(lvl["mandatory_criteria"]) if isinstance(lvl["mandatory_criteria"], str) else lvl["mandatory_criteria"]
        unmet = []
        for criterion in criteria:
            ok = await _check_mandatory_criterion(pool, production_id, criterion, responses, float(total_co2e_kg))
            if not ok:
                unmet.append(criterion)
        if unmet:
            continue
        return {
            "levelId": lvl["id"], "label": lvl["label"], "achieved": True,
            "minScore": float(lvl["min_score"]), "improvementNote": lvl["improvement_note"],
        }

    # No level achieved yet — report the lowest tier's gap
    bronze = levels[-1]
    criteria = json.loads(bronze["mandatory_criteria"]) if isinstance(bronze["mandatory_criteria"], str) else bronze["mandatory_criteria"]
    unmet = [c for c in criteria if not await _check_mandatory_criterion(pool, production_id, c, responses, float(total_co2e_kg))]
    return {
        "levelId": None, "label": "Not Yet Certified", "achieved": False,
        "minScore": float(bronze["min_score"]),
        "scoreGap": round(max(0.0, float(bronze["min_score"]) - total_score), 1),
        "unmetCriteria": unmet,
        "improvementNote": "Meet Bronze's minimum score and mandatory criteria to achieve initial certification.",
    }
