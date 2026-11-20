"""Scoring engine: pure-function tests (no database)."""

import copy

import pytest

from cxt import scoring
from cxt.methodology import DEFAULT_CONFIG, validate_config
from cxt.util import content_hash


def pt(v, unit="tCO2e", verified=False, conf=95, i="x"):
    return {"v": v, "u": unit, "raw": v, "raw_unit": unit, "verified": verified, "conf": conf, "id": i, "src": "public"}


def evidence(**over):
    ev = {"channel": "public", "as_of_fy": 2026, "sector": "capital_goods", "metrics": {}, "signals": {},
          "targets": [], "conflicts": [], "unverified_claims": [], "rejected_evidence": 0, "peers": {}}
    ev.update(over)
    return ev


def full_evidence(verified=False):
    m = {
        "scope1_emissions": {"2024": pt(196300, i="s1a", verified=verified), "2025": pt(182400, i="s1b", verified=verified)},
        "scope2_location": {"2024": pt(104800, i="s2a", verified=verified), "2025": pt(96200, i="s2b", verified=verified)},
        "scope3_emissions": {"2025": pt(1240000, i="s3", verified=verified)},
        "revenue": {"2024": pt(7.91e10, "INR", i="ra", verified=verified), "2025": pt(8.42e10, "INR", i="rb", verified=verified)},
        "total_energy": {"2024": pt(1197222, "MWh", i="ea", verified=verified), "2025": pt(1144444, "MWh", i="eb", verified=verified)},
        "water_withdrawal": {"2024": pt(3010000, "m3", i="wa", verified=verified), "2025": pt(2860000, "m3", i="wb", verified=verified)},
        "water_recycled": {"2025": pt(915000, "m3", i="wr", verified=verified)},
        "total_waste": {"2025": pt(48200, "t", i="tw", verified=verified)},
        "waste_diversion_rate": {"2025": pt(39500, "t", i="wd", verified=verified)},
        "hazardous_waste": {"2024": pt(3460, "t", i="ha", verified=verified), "2025": pt(3120, "t", i="hb", verified=verified)},
        "renewable_energy_share": {"2025": pt(31.5, "%", i="re", verified=verified)},
        "employees_total": {"2025": pt(12480, "employees", i="em", verified=verified)},
    }
    sig = {k: {"state": "stated", "fy": 2025, "id": k, "verified": verified, "conf": 80, "attrs": {}, "src": "public"}
           for k in ("governance.board_oversight", "governance.climate_committee", "transition_risk.scenario_analysis",
                     "transition_risk.transition_plan", "physical_risk.flood", "adaptation.adaptation_measures",
                     "governance.reporting_boundary")}
    sig["assurance.external_assurance"] = {"state": "stated", "fy": 2025, "id": "as", "verified": verified, "conf": 84,
                                           "attrs": {"level": "limited"}, "src": "public"}
    tg = [{"id": "t1", "kind": "net_zero", "target_year": 2045, "baseline_year": None, "reduction_pct": None,
           "scopes": ["Scope 1", "Scope 2"], "commitment_class": "FORMAL_TARGET", "validation_status": "declared",
           "fy": 2025, "conf": 88, "verified": verified, "src": "public"},
          {"id": "t2", "kind": "ghg_reduction", "target_year": 2030, "baseline_year": 2020, "reduction_pct": 42.0,
           "scopes": ["Scope 1", "Scope 2"], "commitment_class": "FORMAL_TARGET", "validation_status": "declared",
           "fy": 2025, "conf": 88, "verified": verified, "src": "public"}]
    return evidence(metrics=m, signals=sig, targets=tg)


def ind(result, iid):
    return next(i for p in result["pillars"] for i in p["indicators"] if i["id"] == iid)


def pillar(result, pid):
    return next(p for p in result["pillars"] if p["id"] == pid)


def test_default_methodology_is_the_approved_six_pillar_reference():
    validate_config(DEFAULT_CONFIG)
    w = {p["name"]: p["weight"] for p in DEFAULT_CONFIG["pillars"]}
    assert w == {"Environmental performance": 25, "Climate-risk exposure": 20, "Transition readiness": 20,
                 "Resource efficiency": 15, "Governance and disclosure": 10, "Evidence and credibility": 10}
    assert sum(w.values()) == 100


def test_score_is_in_range_and_weighted_from_pillars():
    r = scoring.compute(DEFAULT_CONFIG, full_evidence())
    assert 0 <= r["overall"] <= 100
    scored = [p for p in r["pillars"] if p["status"] == "scored"]
    expected = sum(p["weight"] * p["score"] for p in scored) / sum(p["weight"] for p in scored)
    assert r["overall"] == pytest.approx(expected, abs=0.06)
    assert len(scored) == 6


def test_trend_arithmetic_is_exact():
    r = scoring.compute(DEFAULT_CONFIG, full_evidence())
    ep1 = ind(r, "ep1")
    change = ((182400 + 96200) / (196300 + 104800) - 1) * 100         # -7.47 % in one year
    assert ep1["detail"]["annual_change_pct"] == pytest.approx(change, abs=0.01)
    assert ep1["score"] == pytest.approx(scoring.piecewise([[-10, 100], [-5, 85]], change), abs=0.06)
    assert len(ep1["evidence"]) == 4                                   # two metrics x two periods, each traceable


def test_missing_disclosure_is_not_scored_as_poor_performance():
    ev = full_evidence()
    del ev["metrics"]["water_withdrawal"]
    r = scoring.compute(DEFAULT_CONFIG, ev)
    ep3 = ind(r, "ep3")
    assert ep3["status"] == "missing_disclosure" and ep3["score"] is None
    assert ep3["classification"] == "Missing disclosure"
    base = scoring.compute(DEFAULT_CONFIG, full_evidence())
    # The pillar is re-normalised over what could be scored: removing a disclosure does not drag it to zero.
    env, env0 = pillar(r, "environmental_performance"), pillar(base, "environmental_performance")
    assert env["status"] == "scored" and abs(env["score"] - env0["score"]) < 15
    assert r["confidence"]["components"]["coverage"] < base["confidence"]["components"]["coverage"]
    assert any(g["indicator"] == ep3["name"] for g in r["gaps"])


def test_one_period_is_insufficient_evidence_not_a_score():
    ev = full_evidence()
    for m in ev["metrics"].values():
        m.pop("2024", None)
    r = scoring.compute(DEFAULT_CONFIG, ev)
    assert ind(r, "ep1")["status"] == "insufficient_evidence"
    assert pillar(r, "environmental_performance")["status"] == "insufficient_evidence"
    assert pillar(r, "environmental_performance")["score"] is None


def test_no_evidence_withholds_the_overall_score():
    r = scoring.compute(DEFAULT_CONFIG, evidence())
    assert r["overall"] is None and r["overall_status"] == "insufficient_evidence"
    assert r["confidence"]["score"] == 0
    assert "not poor performance" in r["summary"]
    assert all(i["status"] != "scored" for p in r["pillars"] for i in p["indicators"])


def test_explicit_negative_statement_scores_low_but_absence_does_not():
    ev = full_evidence()
    del ev["signals"]["transition_risk.scenario_analysis"]
    assert ind(scoring.compute(DEFAULT_CONFIG, ev), "cr3")["status"] == "missing_disclosure"
    ev["signals"]["negative.scenario_analysis"] = {"state": "explicit_no", "fy": 2025, "id": "n", "verified": False,
                                                   "conf": 86, "attrs": {}, "src": "public"}
    cr3 = ind(scoring.compute(DEFAULT_CONFIG, ev), "cr3")
    assert cr3["status"] == "scored" and cr3["score"] == 15 and cr3["classification"] == "Poor performance"


def test_confidence_is_independent_of_performance():
    good, bad = full_evidence(), full_evidence()
    for k in ("scope1_emissions", "scope2_location", "water_withdrawal", "hazardous_waste", "total_energy"):
        bad["metrics"][k]["2025"]["v"] = bad["metrics"][k]["2024"]["v"] * 1.25      # everything got worse
    rg, rb = scoring.compute(DEFAULT_CONFIG, good), scoring.compute(DEFAULT_CONFIG, bad)
    assert rb["overall"] < rg["overall"] - 5
    assert rb["confidence"]["score"] == rg["confidence"]["score"]


def test_verification_raises_confidence_not_the_score():
    a, b = scoring.compute(DEFAULT_CONFIG, full_evidence(False)), scoring.compute(DEFAULT_CONFIG, full_evidence(True))
    assert a["overall"] == b["overall"]
    assert b["confidence"]["score"] > a["confidence"]["score"]
    assert a["confidence"]["components"]["verification"] == 0 and b["confidence"]["components"]["verification"] == 100
    assert ind(b, "tr4")["classification"] == "Positive evidence, not yet verified" or ind(b, "tr4")["band"] != "strong"
    assert ind(b, "gd1")["classification"] == "Positive verified evidence"
    assert ind(a, "gd1")["classification"] == "Positive evidence, not yet verified"


def test_recency_lowers_confidence_only():
    fresh, stale = full_evidence(), full_evidence()
    stale["as_of_fy"] = 2030
    a, b = scoring.compute(DEFAULT_CONFIG, fresh), scoring.compute(DEFAULT_CONFIG, stale)
    assert b["confidence"]["components"]["recency"] < a["confidence"]["components"]["recency"]
    assert ind(a, "ep1")["score"] == ind(b, "ep1")["score"]


def test_conflicting_data_is_withheld_and_deducted():
    ev = full_evidence()
    del ev["metrics"]["scope1_emissions"]["2025"]
    ev["conflicts"] = [{"metric": "scope1_emissions", "fy": 2025}]
    r = scoring.compute(DEFAULT_CONFIG, ev)
    assert ind(r, "ec2")["score"] == 75
    cred = pillar(r, "evidence_credibility")
    assert [d["id"] for d in cred["deductions"]] == ["open_contradictions"]
    assert cred["score"] == pytest.approx(cred["score_before_deductions"] - 5, abs=0.11)
    assert r["deductions"][0]["reason"].startswith("Sources state conflicting values")


def test_environmental_incident_deduction_is_capped_and_explained():
    ev = full_evidence()
    ev["metrics"]["environmental_incidents"] = {"2025": pt(9, "cases", i="inc")}
    r = scoring.compute(DEFAULT_CONFIG, ev)
    d = pillar(r, "environmental_performance")["deductions"][0]
    assert d["points"] == 10 and d["count"] == 9 and d["evidence"][0]["id"] == "inc"


def test_unverified_company_claim_is_listed_not_scored():
    ev = evidence(channel="company", unverified_claims=[{"metric": "renewable_energy_share", "label": "Renewable share",
                                                         "reason": "no evidence accepted"}])
    r = scoring.compute(DEFAULT_CONFIG, ev)
    tr4 = ind(r, "tr4")
    assert tr4["status"] == "unverified_claim" and tr4["score"] is None
    assert r["unverified_claims"][0]["metric"] == "renewable_energy_share"


def test_rejected_evidence_deduction_applies_to_company_channel_only():
    ev = full_evidence()
    ev["rejected_evidence"] = 2
    assert not pillar(scoring.compute(DEFAULT_CONFIG, ev), "evidence_credibility")["deductions"]
    ev["channel"] = "company"
    d = pillar(scoring.compute(DEFAULT_CONFIG, ev), "evidence_credibility")["deductions"]
    assert d[0]["id"] == "rejected_evidence" and d[0]["points"] == 6


def test_peer_comparison_needs_enough_peers():
    ev = full_evidence()
    assert ind(scoring.compute(DEFAULT_CONFIG, ev), "cr1")["status"] == "insufficient_evidence"
    mine = (182400 + 96200) / 8.42e10
    ev["peers"] = {"cr1": [mine * f for f in (0.5, 0.8, 1.2, 1.5, 2.0, 3.0)]}
    cr1 = ind(scoring.compute(DEFAULT_CONFIG, ev), "cr1")
    assert cr1["status"] == "scored" and cr1["score"] == pytest.approx(100 * 4 / 6, abs=0.06)


def test_unit_mismatch_between_periods_is_not_trended():
    ev = full_evidence()
    ev["metrics"]["hazardous_waste"]["2024"]["u"] = "kg"
    assert ind(scoring.compute(DEFAULT_CONFIG, ev), "ep4")["status"] == "insufficient_evidence"


def test_scope2_method_is_never_mixed_across_periods():
    ev = full_evidence()
    ev["metrics"]["scope2_market"] = {"2025": pt(60000, i="mk")}     # market-based only for the latest year
    r = scoring.compute(DEFAULT_CONFIG, ev)
    assert ind(r, "ep1")["status"] == "insufficient_evidence"        # market 2025 vs location 2024 is not like-for-like


def test_implausible_ratio_is_rejected():
    ev = full_evidence()
    ev["metrics"]["water_recycled"]["2025"]["v"] = 9_000_000
    assert ind(scoring.compute(DEFAULT_CONFIG, ev), "re2")["status"] == "insufficient_evidence"


def test_deterministic_and_reproducible():
    ev = full_evidence()
    a = scoring.compute(DEFAULT_CONFIG, copy.deepcopy(ev))
    b = scoring.compute(copy.deepcopy(DEFAULT_CONFIG), copy.deepcopy(ev))
    assert content_hash(a) == content_hash(b)
    assert scoring.reproduce(DEFAULT_CONFIG, ev, content_hash(a))["reproduced"] is True
    ev["metrics"]["scope1_emissions"]["2025"]["v"] += 1
    assert scoring.reproduce(DEFAULT_CONFIG, ev, content_hash(a))["reproduced"] is False


def test_changing_weights_changes_the_score_predictably():
    cfg = copy.deepcopy(DEFAULT_CONFIG)
    r0 = scoring.compute(cfg, full_evidence())
    best = max(r0["pillars"], key=lambda p: p["score"])
    worst = min(r0["pillars"], key=lambda p: p["score"])
    for p in cfg["pillars"]:
        if p["id"] == best["id"]:
            p["weight"] += 5
        if p["id"] == worst["id"]:
            p["weight"] -= 5
    validate_config(cfg)
    assert scoring.compute(cfg, full_evidence())["overall"] > r0["overall"]


def test_invalid_methodology_is_rejected():
    from fastapi import HTTPException
    cfg = copy.deepcopy(DEFAULT_CONFIG)
    cfg["pillars"][0]["weight"] = 30
    with pytest.raises(HTTPException) as e:
        validate_config(cfg)
    assert "sum to 105" in e.value.detail
    cfg = copy.deepcopy(DEFAULT_CONFIG)
    cfg["pillars"][0]["indicators"][0]["rule"] = "pay_to_win"
    with pytest.raises(HTTPException):
        validate_config(cfg)


def test_strengths_improvements_and_explanations_are_present():
    r = scoring.compute(DEFAULT_CONFIG, full_evidence())
    assert r["strengths"] and all(s["score"] >= 70 for s in r["strengths"])
    assert all(i["explanation"] for p in r["pillars"] for i in p["indicators"])
    assert r["evidence_coverage_pct"] > 80
