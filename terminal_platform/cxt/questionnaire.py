"""
Company assessment questionnaire (version 1.0).

Six sections. Every question maps to something the scoring engine can read —
a metric, a qualitative signal or a field of a climate target — so an answer
is never decorative. Quantities are asked in one fixed unit to avoid unit
ambiguity; `factor` converts the entered value to the normalised unit.

An answered question must carry either an uploaded evidence document or a
written declaration of its source. Only answers whose evidence a Climactix
reviewer accepts are used in the Company Assessment Score.
"""

from __future__ import annotations

VERSION = "1.0"

SECTIONS = [
    {"id": "environmental_performance", "name": "Environmental performance"},
    {"id": "climate_strategy", "name": "Climate strategy"},
    {"id": "resource_efficiency", "name": "Resource efficiency"},
    {"id": "social_responsibility", "name": "Social responsibility"},
    {"id": "governance_disclosure", "name": "Governance and disclosure"},
    {"id": "evidence_credibility", "name": "Evidence and credibility"},
]


def _num(qid, section, text, metric, unit, norm_unit, factor=1.0, prior=True, required=False, help=None):
    return {"id": qid, "section": section, "text": text, "type": "number", "unit": unit, "prior": prior,
            "required": required, "help": help,
            "maps": {"metric": metric, "normalized_unit": norm_unit, "factor": factor}}


def _yn(qid, section, text, signal, negative=None, required=False, help=None):
    return {"id": qid, "section": section, "text": text, "type": "yesno", "required": required, "help": help,
            "maps": {"signal": signal, "negative": negative or signal}}


EP, CS, RE, SR, GD, EC = (s["id"] for s in SECTIONS)

QUESTIONS = [
    # ── Environmental performance ───────────────────────────────────────────
    _num("ep_scope1", EP, "Scope 1 (direct) greenhouse gas emissions", "scope1_emissions", "tCO2e", "tCO2e", required=True),
    _num("ep_scope2", EP, "Scope 2 emissions, location-based", "scope2_location", "tCO2e", "tCO2e", required=True),
    _num("ep_scope2m", EP, "Scope 2 emissions, market-based", "scope2_market", "tCO2e", "tCO2e"),
    _num("ep_scope3", EP, "Scope 3 (value chain) emissions", "scope3_emissions", "tCO2e", "tCO2e"),
    _num("ep_water", EP, "Total water withdrawal", "water_withdrawal", "kilolitres", "m3", required=True),
    _num("ep_hazwaste", EP, "Hazardous waste generated", "hazardous_waste", "tonnes", "t"),
    _num("ep_nox", EP, "NOx emissions", "nox_emissions", "tonnes", "t"),
    _num("ep_sox", EP, "SOx emissions", "sox_emissions", "tonnes", "t"),
    _num("ep_incidents", EP, "Environmental incidents or regulatory non-compliances in the period",
         "environmental_incidents", "cases", "cases", prior=False,
         help="Include show-cause notices, fines and significant spills. Enter 0 if there were none."),
    _num("ep_revenue", EP, "Revenue from operations", "revenue", "INR crore", "INR", factor=1e7, required=True,
         help="Used only to compute intensity measures."),
    # ── Climate strategy ────────────────────────────────────────────────────
    {"id": "cs_netzero", "section": CS, "text": "Has the company set a net zero target?", "type": "yesno",
     "required": True, "maps": {"target": "net_zero.exists"}},
    {"id": "cs_netzero_year", "section": CS, "text": "Net zero target year", "type": "year",
     "maps": {"target": "net_zero.target_year"}},
    {"id": "cs_baseline_year", "section": CS, "text": "Baseline year for emissions targets", "type": "year",
     "maps": {"target": "ghg_reduction.baseline_year"}},
    {"id": "cs_near_pct", "section": CS, "text": "Near-term emissions reduction target (% reduction)",
     "type": "percent", "maps": {"target": "ghg_reduction.reduction_pct"}},
    {"id": "cs_near_year", "section": CS, "text": "Near-term target year", "type": "year",
     "maps": {"target": "ghg_reduction.target_year"}},
    {"id": "cs_scopes", "section": CS, "text": "Emission scopes covered by the targets", "type": "multichoice",
     "options": ["Scope 1", "Scope 2", "Scope 3"], "maps": {"target": "scopes"}},
    {"id": "cs_validation", "section": CS, "text": "Third-party validation of the targets", "type": "choice",
     "options": ["Validated by SBTi", "Submitted for validation", "Not validated"],
     "maps": {"target": "validation"}},
    _yn("cs_transition_plan", CS, "Is there a published transition or decarbonisation plan?",
        "transition_risk.transition_plan", "negative.transition_plan"),
    _yn("cs_scenario", CS, "Has climate scenario analysis been carried out?",
        "transition_risk.scenario_analysis", "negative.scenario_analysis"),
    _yn("cs_physical", CS, "Has physical climate risk been assessed for the company's sites?",
        "physical_risk.asset_exposure", "negative.physical_risk_assessment"),
    _yn("cs_adaptation", CS, "Are climate adaptation measures in place?", "adaptation.adaptation_measures"),
    # ── Resource efficiency ─────────────────────────────────────────────────
    _num("re_energy", RE, "Total energy consumption", "total_energy", "GJ", "MWh", factor=0.2777778, required=True),
    {"id": "re_renewable", "section": RE, "text": "Renewable share of total energy consumption", "type": "percent",
     "prior": False, "maps": {"metric": "renewable_energy_share", "normalized_unit": "%", "factor": 1.0}},
    _num("re_water_recycled", RE, "Water recycled and reused", "water_recycled", "kilolitres", "m3"),
    _num("re_waste", RE, "Total waste generated", "total_waste", "tonnes", "t"),
    _num("re_waste_recycled", RE, "Waste recycled or diverted from disposal", "waste_diversion_rate", "tonnes", "t"),
    # ── Social responsibility ───────────────────────────────────────────────
    _num("sr_employees", SR, "Total employees", "employees_total", "employees", "employees"),
    {"id": "sr_women", "section": SR, "text": "Women as a share of the workforce", "type": "percent", "prior": False,
     "maps": {"metric": "women_workforce_share", "normalized_unit": "%", "factor": 1.0}},
    _num("sr_ltifr", SR, "Lost-time injury frequency rate", "ltifr", "rate", "rate"),
    _num("sr_fatalities", SR, "Work-related fatalities", "fatalities", "cases", "cases"),
    _yn("sr_safety", SR, "Is an occupational health and safety management system in place?", "social.safety_management"),
    _yn("sr_community", SR, "Does the company run community programmes?", "social.community_programmes"),
    _yn("sr_labour", SR, "Are labour-practice policies and a grievance mechanism in place?", "social.labour_practices"),
    # ── Governance and disclosure ───────────────────────────────────────────
    _yn("gd_board", GD, "Does the board oversee sustainability and climate matters?", "governance.board_oversight",
        required=True),
    _yn("gd_committee", GD, "Is there a board or management sustainability committee?",
        "governance.climate_committee", "negative.climate_committee"),
    _yn("gd_risk", GD, "Are sustainability risks part of enterprise risk management?", "governance.risk_management"),
    {"id": "gd_assurance", "section": GD, "text": "External assurance of sustainability data", "type": "choice",
     "options": ["Reasonable assurance", "Limited assurance", "No external assurance"], "required": True,
     "maps": {"signal": "assurance.external_assurance", "negative": "negative.external_assurance",
              "levels": {"Reasonable assurance": "reasonable", "Limited assurance": "limited"},
              "no": "No external assurance"}},
    _yn("gd_disclosure_policy", GD, "Is there a disclosure policy or materiality assessment?",
        "governance.disclosure_policy"),
    # ── Evidence and credibility ────────────────────────────────────────────
    _yn("ec_boundary", EC, "Is the emissions reporting boundary (operational or financial control) stated?",
        "governance.reporting_boundary"),
    {"id": "ec_methodology", "section": EC, "text": "Standard used to calculate emissions", "type": "text",
     "maps": None, "help": "For example: GHG Protocol Corporate Standard, ISO 14064-1."},
    {"id": "ec_restatements", "section": EC, "text": "Have previously reported figures been restated? Explain.",
     "type": "text", "maps": None},
]

BY_ID = {q["id"]: q for q in QUESTIONS}


def public() -> dict:
    return {"version": VERSION, "sections": SECTIONS, "questions": QUESTIONS}


def validate_value(q: dict, value: dict | None) -> dict | None:
    """Normalise and validate one answer payload. Returns None for a blank answer."""
    if value is None or value.get("value") in (None, ""):
        return None
    v = value["value"]
    t = q["type"]
    out: dict = {}
    if t in ("number", "percent"):
        try:
            out["value"] = float(v)
        except (TypeError, ValueError):
            raise ValueError(f"{q['text']}: a number is required")
        if out["value"] < 0:
            raise ValueError(f"{q['text']}: the value cannot be negative")
        if t == "percent" and out["value"] > 100:
            raise ValueError(f"{q['text']}: a percentage cannot exceed 100")
        if q.get("prior") and value.get("prior_value") not in (None, ""):
            try:
                out["prior_value"] = float(value["prior_value"])
            except (TypeError, ValueError):
                raise ValueError(f"{q['text']}: the previous-year value must be a number")
            if out["prior_value"] < 0:
                raise ValueError(f"{q['text']}: the previous-year value cannot be negative")
    elif t == "year":
        try:
            out["value"] = int(v)
        except (TypeError, ValueError):
            raise ValueError(f"{q['text']}: a year is required")
        if not 1990 <= out["value"] <= 2100:
            raise ValueError(f"{q['text']}: the year is out of range")
    elif t == "yesno":
        if str(v).lower() not in ("yes", "no"):
            raise ValueError(f"{q['text']}: answer yes or no")
        out["value"] = str(v).lower()
    elif t == "choice":
        if v not in q["options"]:
            raise ValueError(f"{q['text']}: choose one of the listed options")
        out["value"] = v
    elif t == "multichoice":
        if not isinstance(v, list) or any(x not in q["options"] for x in v):
            raise ValueError(f"{q['text']}: choose from the listed options")
        out["value"] = [o for o in q["options"] if o in v]
        if not out["value"]:
            return None
    else:
        out["value"] = str(v).strip()[:4000]
        if not out["value"]:
            return None
    return out
