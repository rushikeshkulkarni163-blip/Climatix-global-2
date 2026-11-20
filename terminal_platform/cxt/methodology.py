"""
Climactix Score methodology — default configuration (version 1.0).

The six pillars and their weights are the approved starting reference:

    Environmental performance   25
    Climate-risk exposure       20
    Transition readiness        20
    Resource efficiency         15
    Governance and disclosure   10
    Evidence and credibility    10

Everything the engine needs is in this configuration: pillar weights,
indicators, the rule each indicator applies, its bands and its weight inside
the pillar, deductions, coverage thresholds and the Data Confidence formula.
The configuration is stored in `methodology_versions`; changing it means
creating a new version, which a Super Administrator must approve. A score
row records the version that produced it, so old scores stay reproducible
after the methodology changes.

Indicator rules are implemented in cxt.scoring (ENGINE_VERSION). A bands list
is piecewise-linear: [[x, score], ...] sorted by x, clamped at both ends.
"""

from __future__ import annotations

import uuid
from typing import Any, Optional

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import audit
from .models import MethodologyVersion, utcnow
from .util import content_hash

S2 = ["scope2_market", "scope2_location", "scope2_emissions"]
GHG_S12 = {"any": [{"sum": [["scope1_emissions"], S2]}, {"sum": [["scope1_2_emissions"]]}]}
# Annualised % change in a quantity where lower is better → indicator score.
TREND_LOWER = [[-10, 100], [-5, 85], [-2, 70], [0, 55], [3, 40], [8, 20], [15, 0]]

DEFAULT_CONFIG: dict[str, Any] = {
    "name": "Climactix Score",
    "scale": {"min": 0, "max": 100},
    "min_indicator_coverage": 0.40,   # share of a pillar's indicator weight that must be scorable
    "min_pillar_coverage": 0.50,      # share of total pillar weight that must be scorable for an overall score
    "bands": {"strong": 70, "moderate": 40},
    "pillars": [
        {
            "id": "environmental_performance", "name": "Environmental performance", "weight": 25,
            "description": "Measured environmental outcomes over time: emissions, water, waste and air.",
            "indicators": [
                {"id": "ep1", "name": "Scope 1 and 2 emissions trend", "weight": 35, "rule": "trend",
                 "params": {"series": GHG_S12, "bands": TREND_LOWER}},
                {"id": "ep2", "name": "Emissions intensity trend (per unit revenue)", "weight": 25, "rule": "trend",
                 "params": {"series": GHG_S12, "per": ["revenue"], "bands": TREND_LOWER}},
                {"id": "ep3", "name": "Water withdrawal trend", "weight": 20, "rule": "trend",
                 "params": {"series": {"sum": [["water_withdrawal", "water_consumption"]]}, "bands": TREND_LOWER}},
                {"id": "ep4", "name": "Hazardous waste trend", "weight": 10, "rule": "trend",
                 "params": {"series": {"sum": [["hazardous_waste"]]}, "bands": TREND_LOWER}},
                {"id": "ep5", "name": "Air emissions trend (NOx, SOx)", "weight": 10, "rule": "trend",
                 "params": {"series": {"sum": [["nox_emissions"], ["sox_emissions"]]}, "bands": TREND_LOWER}},
            ],
        },
        {
            "id": "climate_risk_exposure", "name": "Climate-risk exposure", "weight": 20,
            "description": "Carbon exposure relative to sector peers and whether climate risks have been "
                           "identified, analysed and prepared for. A higher score means lower, better-managed exposure.",
            "indicators": [
                {"id": "cr1", "name": "Emissions intensity relative to sector peers", "weight": 40,
                 "rule": "peer_percentile",
                 "params": {"series": GHG_S12, "per": ["revenue"], "direction": "lower", "min_peers": 5}},
                {"id": "cr2", "name": "Physical climate risk assessment", "weight": 25, "rule": "practice",
                 "params": {"signals": ["physical_risk.asset_exposure", "physical_risk.flood", "physical_risk.heat",
                                        "physical_risk.water_stress", "physical_risk.cyclone_storm",
                                        "physical_risk.drought", "physical_risk.sea_level_rise"],
                            "negative": ["negative.physical_risk_assessment"], "stated": 75, "explicit_no": 15}},
                {"id": "cr3", "name": "Climate scenario analysis", "weight": 20, "rule": "practice",
                 "params": {"signals": ["transition_risk.scenario_analysis"],
                            "negative": ["negative.scenario_analysis"], "stated": 80, "explicit_no": 15}},
                {"id": "cr4", "name": "Adaptation measures", "weight": 15, "rule": "practice",
                 "params": {"signals": ["adaptation.adaptation_measures"], "negative": [], "stated": 75,
                            "explicit_no": 15}},
            ],
        },
        {
            "id": "transition_readiness", "name": "Transition readiness", "weight": 20,
            "description": "Targets, their coverage and the means to reach them.",
            "indicators": [
                {"id": "tr1", "name": "Net zero commitment", "weight": 30, "rule": "net_zero_target",
                 "params": {"class_scores": {"ASPIRATIONAL": 30, "ANNOUNCED": 40, "FORMAL_TARGET": 60,
                                             "LEGALLY_MANDATED": 60, "SCIENCE_BASED": 75, "VALIDATED": 90},
                            "by_2050_bonus": 10, "explicit_no": 10}},
                {"id": "tr2", "name": "Near-term emissions reduction target", "weight": 20, "rule": "interim_target",
                 "params": {"horizon_years": 10, "no_baseline_score": 50,
                            "bands": [[0.5, 20], [1.0, 40], [2.5, 70], [4.2, 100]]}},
                {"id": "tr3", "name": "Scope coverage of emissions targets", "weight": 15, "rule": "target_scope",
                 "params": {"scores": {"s123": 100, "s12": 60, "single": 35, "unspecified": 30}}},
                {"id": "tr4", "name": "Renewable energy share", "weight": 20, "rule": "level",
                 "params": {"metric": ["renewable_energy_share", "renewable_electricity_share"],
                            "bands": [[0, 10], [10, 35], [25, 55], [50, 80], [75, 95], [100, 100]]}},
                {"id": "tr5", "name": "Transition plan", "weight": 15, "rule": "practice",
                 "params": {"signals": ["transition_risk.transition_plan", "transition_risk.low_carbon_investment"],
                            "negative": ["negative.transition_plan"], "stated": 75, "explicit_no": 15}},
            ],
        },
        {
            "id": "resource_efficiency", "name": "Resource efficiency", "weight": 15,
            "description": "How efficiently energy, water and materials are used.",
            "indicators": [
                {"id": "re1", "name": "Energy intensity trend (per unit revenue)", "weight": 30, "rule": "trend",
                 "params": {"series": {"sum": [["total_energy"]]}, "per": ["revenue"], "bands": TREND_LOWER}},
                {"id": "re2", "name": "Water recycling rate", "weight": 25, "rule": "ratio_level",
                 "params": {"numerator": ["water_recycled"], "denominator": ["water_withdrawal", "water_consumption"],
                            "bands": [[0, 10], [10, 40], [25, 65], [50, 85], [75, 100]]}},
                {"id": "re3", "name": "Waste recycled or diverted from disposal", "weight": 25, "rule": "ratio_level",
                 "params": {"numerator": ["waste_diversion_rate"], "denominator": ["total_waste"],
                            "bands": [[0, 5], [30, 35], [60, 65], [80, 85], [95, 100]]}},
                {"id": "re4", "name": "Water intensity trend (per unit revenue)", "weight": 20, "rule": "trend",
                 "params": {"series": {"sum": [["water_withdrawal", "water_consumption"]]}, "per": ["revenue"],
                            "bands": TREND_LOWER}},
            ],
        },
        {
            "id": "governance_disclosure", "name": "Governance and disclosure", "weight": 10,
            "description": "Oversight of sustainability and the completeness of what is disclosed.",
            "indicators": [
                {"id": "gd1", "name": "Board oversight of sustainability", "weight": 25, "rule": "practice",
                 "params": {"signals": ["governance.board_oversight"], "negative": [], "stated": 80, "explicit_no": 15}},
                {"id": "gd2", "name": "Sustainability committee", "weight": 15, "rule": "practice",
                 "params": {"signals": ["governance.climate_committee"], "negative": ["negative.climate_committee"],
                            "stated": 80, "explicit_no": 20}},
                {"id": "gd3", "name": "External assurance of sustainability data", "weight": 25, "rule": "practice",
                 "params": {"signals": ["assurance.external_assurance"], "negative": ["negative.external_assurance"],
                            "stated": 60, "explicit_no": 20,
                            "attribute": "level", "attribute_scores": {"reasonable": 100, "limited": 75}}},
                {"id": "gd4", "name": "Coverage of core sustainability disclosures", "weight": 35,
                 "rule": "disclosure_coverage",
                 "params": {"core": [["scope1_emissions", "scope1_2_emissions"], S2 + ["scope1_2_emissions"],
                                     ["scope3_emissions"], ["total_energy"],
                                     ["renewable_energy_share", "renewable_electricity_share"],
                                     ["water_withdrawal", "water_consumption"], ["total_waste"],
                                     ["employees_total"]],
                            "bands": [[0, 0], [100, 100]]}},
            ],
        },
        {
            "id": "evidence_credibility", "name": "Evidence and credibility", "weight": 10,
            "description": "Whether the company's disclosures are consistent, traceable and stated with their basis.",
            "indicators": [
                {"id": "ec1", "name": "Multi-year reporting of emissions", "weight": 30, "rule": "years_reported",
                 "params": {"metric": ["scope1_emissions", "scope1_2_emissions", "total_ghg_emissions"],
                            "scores": {"1": 30, "2": 60, "3": 100}}},
                {"id": "ec2", "name": "Consistency of reported figures", "weight": 30, "rule": "consistency",
                 "params": {"min_metrics": 3, "per_conflict": 25}},
                {"id": "ec3", "name": "Targets stated with baseline and quantified reduction", "weight": 20,
                 "rule": "target_traceability", "params": {}},
                {"id": "ec4", "name": "Emissions boundary and method stated", "weight": 20, "rule": "boundary_stated",
                 "params": {"method_metrics": ["scope2_market", "scope2_location"],
                            "signals": ["governance.reporting_boundary"]}},
            ],
        },
    ],
    "deductions": [
        {"id": "env_incidents", "pillar": "environmental_performance", "rule": "count_metric",
         "metric": "environmental_incidents", "points_each": 2, "max": 10,
         "reason": "Environmental incidents or non-compliances reported for the period"},
        {"id": "open_contradictions", "pillar": "evidence_credibility", "rule": "conflicts",
         "points_each": 5, "max": 20, "reason": "Sources state conflicting values for the same metric and period"},
        {"id": "rejected_evidence", "pillar": "evidence_credibility", "rule": "rejected_evidence",
         "points_each": 3, "max": 15, "channels": ["company"],
         "reason": "Evidence submitted by the company was rejected on review"},
    ],
    "confidence": {
        "weights": {"coverage": 0.40, "verification": 0.25, "extraction": 0.20, "recency": 0.15},
        "recency": {"0": 100, "1": 100, "2": 70, "3": 40, "older": 15},
        "bands": {"high": 75, "moderate": 50},
    },
}


def validate_config(cfg: dict) -> None:
    """Structural checks on a methodology configuration. Raises HTTP 422."""
    from .scoring import RULES
    try:
        pillars = cfg["pillars"]
        total = sum(float(p["weight"]) for p in pillars)
        if abs(total - 100) > 1e-6:
            raise ValueError(f"pillar weights sum to {total:g}, not 100")
        ids: set[str] = set()
        for p in pillars:
            if float(p["weight"]) <= 0:
                raise ValueError(f"pillar {p['id']}: weight must be positive")
            if not p["indicators"]:
                raise ValueError(f"pillar {p['id']}: at least one indicator is required")
            for i in p["indicators"]:
                if i["id"] in ids:
                    raise ValueError(f"duplicate indicator id {i['id']}")
                ids.add(i["id"])
                if i["rule"] not in RULES:
                    raise ValueError(f"indicator {i['id']}: unknown rule '{i['rule']}'")
                if float(i["weight"]) <= 0:
                    raise ValueError(f"indicator {i['id']}: weight must be positive")
                for b in (i.get("params", {}).get("bands") or []):
                    if not (0 <= float(b[1]) <= 100):
                        raise ValueError(f"indicator {i['id']}: band scores must be within 0-100")
        pids = {p["id"] for p in pillars}
        for d in cfg.get("deductions", []):
            if d["pillar"] not in pids:
                raise ValueError(f"deduction {d['id']}: unknown pillar")
        for k in ("min_indicator_coverage", "min_pillar_coverage"):
            if not (0 < float(cfg[k]) <= 1):
                raise ValueError(f"{k} must be in (0, 1]")
        w = cfg["confidence"]["weights"]
        if abs(sum(float(v) for v in w.values()) - 1) > 1e-6:
            raise ValueError("confidence weights must sum to 1")
    except (KeyError, TypeError) as e:
        raise HTTPException(422, f"Methodology configuration is incomplete: {e}")
    except ValueError as e:
        raise HTTPException(422, f"Methodology configuration is invalid: {e}")


def approved(db: Session) -> MethodologyVersion:
    m = db.execute(select(MethodologyVersion).where(MethodologyVersion.status == "approved")).scalar_one_or_none()
    if not m:
        raise HTTPException(503, "No approved scoring methodology is configured")
    return m


def ensure_default(db: Session) -> MethodologyVersion:
    """Install version 1.0 as the approved methodology if none exists."""
    existing = db.execute(select(MethodologyVersion).where(MethodologyVersion.status == "approved")).scalar_one_or_none()
    if existing:
        return existing
    validate_config(DEFAULT_CONFIG)
    m = MethodologyVersion(version="1.0", status="approved", config=DEFAULT_CONFIG,
                           config_hash=content_hash(DEFAULT_CONFIG),
                           change_note="Initial six-pillar methodology (reference weights 25/20/20/15/10/10).",
                           approved_at=utcnow())
    db.add(m)
    db.flush()
    audit.record(db, None, "methodology.install_default", entity_type="methodology", entity_id=m.id,
                 detail={"version": "1.0", "config_hash": m.config_hash})
    return m


def create_draft(db: Session, actor: Any, version: str, config: dict, change_note: str) -> MethodologyVersion:
    validate_config(config)
    if db.execute(select(MethodologyVersion).where(MethodologyVersion.version == version)).scalar_one_or_none():
        raise HTTPException(409, f"Methodology version {version} already exists")
    m = MethodologyVersion(version=version, status="draft", config=config, config_hash=content_hash(config),
                           change_note=change_note, created_by=actor.user_id)
    db.add(m)
    db.flush()
    cur = db.execute(select(MethodologyVersion).where(MethodologyVersion.status == "approved")).scalar_one_or_none()
    audit.record(db, actor, "methodology.draft", entity_type="methodology", entity_id=m.id,
                 detail={"version": version, "config_hash": m.config_hash, "change_note": change_note,
                         "weights": {p["id"]: p["weight"] for p in config["pillars"]},
                         "previous_weights": {p["id"]: p["weight"] for p in cur.config["pillars"]} if cur else None})
    return m


def approve(db: Session, actor: Any, methodology_id: uuid.UUID) -> MethodologyVersion:
    """Make a draft the approved methodology. The previous version is retired,
    never edited or deleted; existing scores keep pointing at it."""
    m = db.execute(select(MethodologyVersion).where(MethodologyVersion.id == methodology_id).with_for_update()).scalar_one_or_none()
    if not m:
        raise HTTPException(404, "Methodology version not found")
    if m.status != "draft":
        raise HTTPException(409, f"Only a draft can be approved (this version is {m.status})")
    if m.created_by == actor.user_id and _other_super_admins(db, actor.user_id):
        raise HTTPException(409, "A methodology change must be approved by a different Super Administrator "
                                 "from the one who drafted it")
    validate_config(m.config)
    prev: Optional[MethodologyVersion] = db.execute(
        select(MethodologyVersion).where(MethodologyVersion.status == "approved").with_for_update()).scalar_one_or_none()
    if prev:
        prev.status = "retired"
        db.flush()
    m.status, m.approved_by, m.approved_at = "approved", actor.user_id, utcnow()
    db.flush()
    audit.record(db, actor, "methodology.approve", entity_type="methodology", entity_id=m.id,
                 detail={"version": m.version, "config_hash": m.config_hash,
                         "retired_version": prev.version if prev else None})
    return m


def _other_super_admins(db: Session, user_id: uuid.UUID) -> bool:
    from .models import User
    return bool(db.execute(select(User.id).where(User.role == "super_admin", User.status == "active",
                                                 User.id != user_id).limit(1)).first())
