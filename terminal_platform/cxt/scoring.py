"""
Climactix scoring engine.

`compute(config, evidence)` is a pure function: no database, no clock, no
randomness. The same methodology configuration and the same evidence
snapshot always produce the same result, which is what makes a stored score
reproducible (`Score.inputs` holds the snapshot; see `reproduce`).

Three outputs, never blended:

  overall score      performance, from the evidence that could be scored
  pillar scores      one per pillar, each with its indicators
  confidence score   how complete, verified, reliable and recent the
                     evidence is — independent of how good the performance is

What the engine refuses to do
  * score an indicator it has no usable evidence for. Such an indicator is
    excluded from its pillar (status missing_disclosure / insufficient_evidence
    / conflicting_data / unverified_claim) and lowers confidence instead.
    Absence of a disclosure is never converted into a poor performance score.
  * produce a pillar or overall score when too little of it is evidenced
    (thresholds in the methodology); the result is then None.
  * use company claims that a reviewer has not accepted.
"""

from __future__ import annotations

from typing import Any, Callable, Optional

from .util import content_hash

ENGINE_VERSION = "1.0.0"

SCORED = "scored"
MISSING = "missing_disclosure"
INSUFFICIENT = "insufficient_evidence"
CONFLICT = "conflicting_data"
UNVERIFIED = "unverified_claim"

STATUS_LABEL = {MISSING: "Missing disclosure", INSUFFICIENT: "Insufficient evidence",
                CONFLICT: "Conflicting data", UNVERIFIED: "Unverified company claim"}


# ── Helpers ──────────────────────────────────────────────────────────────────

def piecewise(bands: list[list[float]], x: float) -> float:
    pts = sorted((float(a), float(b)) for a, b in bands)
    if x <= pts[0][0]:
        return pts[0][1]
    if x >= pts[-1][0]:
        return pts[-1][1]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if x0 <= x <= x1:
            return y0 + (y1 - y0) * (x - x0) / (x1 - x0) if x1 != x0 else y1
    return pts[-1][1]  # pragma: no cover


def _r(x: Optional[float], n: int = 1) -> Optional[float]:
    return None if x is None else round(float(x) + 0.0, n)


def _ref(metric: str, fy: Any, p: dict) -> dict:
    return {"kind": "data_point", "id": p.get("id"), "metric": metric, "fy": int(fy) if fy is not None else None,
            "value": p.get("raw"), "unit": p.get("raw_unit"), "verified": bool(p.get("verified")),
            "conf": p.get("conf"), "src": p.get("src", "public")}


def _sig_ref(key: str, s: dict) -> dict:
    return {"kind": "data_point", "id": s.get("id"), "metric": key, "fy": s.get("fy"), "value": s.get("state"),
            "unit": None, "verified": bool(s.get("verified")), "conf": s.get("conf"), "src": s.get("src", "public")}


def _tgt_ref(t: dict) -> dict:
    return {"kind": "target", "id": t.get("id"), "metric": t.get("kind"), "fy": t.get("fy"),
            "value": t.get("target_year"), "unit": "target year", "verified": bool(t.get("verified")),
            "conf": t.get("conf"), "src": t.get("src", "public")}


class _Ev:
    """Read access to an evidence snapshot."""

    def __init__(self, ev: dict):
        self.ev = ev
        self.metrics: dict[str, dict[str, dict]] = ev.get("metrics", {})
        self.signals: dict[str, dict] = ev.get("signals", {})
        self.targets: list[dict] = ev.get("targets", [])
        self.conflicts = {(c["metric"], c.get("fy")) for c in ev.get("conflicts", [])}
        self.claims = {c.get("metric") for c in ev.get("unverified_claims", [])}

    def point(self, metric: str, fy: int) -> Optional[dict]:
        return self.metrics.get(metric, {}).get(str(fy))

    def years(self, metric: str) -> list[int]:
        return sorted(int(y) for y in self.metrics.get(metric, {}))

    def all_years(self) -> list[int]:
        ys = {int(y) for m in self.metrics.values() for y in m}
        return sorted(ys)

    def has_conflict(self, metrics: list[str]) -> bool:
        return any(m in metrics for m, _ in self.conflicts)

    def claimed(self, keys: list[str]) -> bool:
        return any(k in self.claims for k in keys)

    # A series spec is {"sum": [[alt, ...], ...]} or {"any": [spec, ...]}.
    def spec_metrics(self, spec: dict) -> list[str]:
        if "any" in spec:
            return [m for s in spec["any"] for m in self.spec_metrics(s)]
        return [m for comp in spec["sum"] for m in comp]

    def series(self, spec: dict) -> dict[int, dict]:
        """{fy: {value, unit, refs, choice}} for every year the spec resolves.
        `choice` records which alternative supplied each component, so a trend
        is only ever taken between like-for-like figures."""
        if "any" in spec:
            for s in spec["any"]:
                got = self.series(s)
                if got:
                    return got
            return {}
        out: dict[int, dict] = {}
        years = sorted({y for comp in spec["sum"] for m in comp for y in self.years(m)})
        for fy in years:
            total, unit, refs, choice = 0.0, None, [], []
            for comp in spec["sum"]:
                pick = next(((m, self.point(m, fy)) for m in comp if self.point(m, fy)), None)
                if not pick:
                    break
                m, p = pick
                if unit is not None and p.get("u") != unit:
                    break
                unit = p.get("u")
                total += p["v"]
                refs.append(_ref(m, fy, p))
                choice.append(m)
            else:
                out[fy] = {"value": total, "unit": unit, "refs": refs, "choice": tuple(choice)}
        return out


def _result(status: str, explanation: str, *, score: Optional[float] = None, refs: Optional[list] = None,
            detail: Optional[dict] = None) -> dict:
    return {"status": status, "score": _r(score), "explanation": explanation, "evidence": refs or [],
            "detail": detail or {}}


def _no_data(e: _Ev, metrics: list[str], what: str) -> dict:
    if e.has_conflict(metrics):
        return _result(CONFLICT, f"Sources state conflicting values for {what}; the figure is withheld from "
                                 f"scoring until a reviewer confirms one value.")
    if e.claimed(metrics):
        return _result(UNVERIFIED, f"{what.capitalize()} was declared by the company but the supporting evidence "
                                   f"has not been accepted by a reviewer.")
    return _result(MISSING, f"No disclosure of {what} was found in the documents assessed.")


# ── Indicator rules ──────────────────────────────────────────────────────────

def _pair(series: dict[int, dict], max_gap: int = 3) -> Optional[tuple[int, int]]:
    """Latest year and the nearest earlier comparable year."""
    for latest in sorted(series, reverse=True):
        for prev in sorted((y for y in series if y < latest), reverse=True):
            if latest - prev <= max_gap and series[prev]["choice"] == series[latest]["choice"] \
                    and series[prev]["unit"] == series[latest]["unit"]:
                return latest, prev
    return None


def rule_trend(e: _Ev, p: dict) -> dict:
    spec = p["series"]
    metrics = e.spec_metrics(spec)
    what = p.get("label") or "the underlying figures"
    series = e.series(spec)
    if not series:
        return _no_data(e, metrics, what)
    if p.get("per"):
        den = e.series({"sum": [p["per"]]})
        joined = {}
        for fy, s in series.items():
            d = den.get(fy)
            if d and d["value"] > 0:
                joined[fy] = {"value": s["value"] / d["value"], "unit": f"{s['unit']}/{d['unit']}",
                              "refs": s["refs"] + d["refs"], "choice": s["choice"] + d["choice"]}
        if not joined:
            if e.has_conflict(p["per"]):
                return _result(CONFLICT, "Sources state conflicting values for the denominator; withheld from scoring.")
            return _result(INSUFFICIENT, "The quantity is disclosed but the denominator needed to compute "
                                         "intensity is not available for the same period.",
                           refs=[r for s in series.values() for r in s["refs"]][:4])
        series = joined
    pair = _pair(series)
    if not pair:
        latest = max(series)
        return _result(INSUFFICIENT, "Only one comparable reporting period is available; a trend needs two "
                                     "periods stated on the same basis and in the same unit.",
                       refs=series[latest]["refs"])
    latest, prev = pair
    v1, v0 = series[latest]["value"], series[prev]["value"]
    if v0 <= 0 or v1 < 0:
        return _result(INSUFFICIENT, "Reported values are not suitable for a trend calculation.",
                       refs=series[latest]["refs"] + series[prev]["refs"])
    change = ((v1 / v0) ** (1 / (latest - prev)) - 1) * 100
    score = piecewise(p["bands"], change)
    direction = "fell" if change < 0 else "rose"
    return _result(SCORED, f"{direction.capitalize()} by {abs(change):.1f}% a year between FY{prev} and FY{latest}.",
                   score=score, refs=series[latest]["refs"] + series[prev]["refs"],
                   detail={"annual_change_pct": _r(change, 2), "latest_fy": latest, "previous_fy": prev,
                           "latest_value": _r(v1, 6), "previous_value": _r(v0, 6), "unit": series[latest]["unit"]})


def _latest_point(e: _Ev, alts: list[str]) -> Optional[tuple[str, int, dict]]:
    best = None
    for m in alts:
        ys = e.years(m)
        if ys and (best is None or ys[-1] > best[1]):
            best = (m, ys[-1], e.point(m, ys[-1]))
    return best


def rule_level(e: _Ev, p: dict) -> dict:
    got = _latest_point(e, p["metric"])
    if not got:
        return _no_data(e, p["metric"], p.get("label") or "this measure")
    m, fy, pt = got
    score = piecewise(p["bands"], pt["v"])
    return _result(SCORED, f"{pt['v']:.1f}{pt.get('u') or ''} in FY{fy}.", score=score, refs=[_ref(m, fy, pt)],
                   detail={"value": _r(pt["v"], 4), "unit": pt.get("u"), "fy": fy})


def rule_ratio_level(e: _Ev, p: dict) -> dict:
    num = _latest_point(e, p["numerator"])
    if not num:
        return _no_data(e, p["numerator"], p.get("label") or "this measure")
    m, fy, pt = num
    if pt.get("u") == "%":
        ratio, refs = pt["v"], [_ref(m, fy, pt)]
    else:
        den = next(((d, e.point(d, fy)) for d in p["denominator"] if e.point(d, fy)), None)
        if not den:
            if e.has_conflict(p["denominator"]):
                return _result(CONFLICT, "Sources state conflicting values for the base quantity; withheld from scoring.")
            return _result(INSUFFICIENT, "The quantity is disclosed but the total it should be compared with "
                                         "is not available for the same period.", refs=[_ref(m, fy, pt)])
        dm, dp = den
        if dp.get("u") != pt.get("u") or dp["v"] <= 0:
            return _result(INSUFFICIENT, "Numerator and denominator are not stated in comparable units.",
                           refs=[_ref(m, fy, pt), _ref(dm, fy, dp)])
        ratio, refs = 100 * pt["v"] / dp["v"], [_ref(m, fy, pt), _ref(dm, fy, dp)]
    if ratio > 100.5:
        return _result(INSUFFICIENT, f"The reported figures imply a rate of {ratio:.0f}%, which is not plausible; "
                                     f"the boundaries of the two figures probably differ.", refs=refs)
    return _result(SCORED, f"{ratio:.1f}% in FY{fy}.", score=piecewise(p["bands"], ratio), refs=refs,
                   detail={"rate_pct": _r(ratio, 2), "fy": fy})


def rule_peer_percentile(e: _Ev, p: dict, indicator_id: str = "") -> dict:
    metrics = e.spec_metrics(p["series"])
    series = e.series(p["series"])
    den = e.series({"sum": [p["per"]]}) if p.get("per") else None
    fy = next((y for y in sorted(series, reverse=True) if den is None or (y in den and den[y]["value"] > 0)), None)
    if fy is None:
        if not series:
            return _no_data(e, metrics, "emissions")
        return _result(INSUFFICIENT, "Emissions are disclosed but revenue for the same period is not available, "
                                     "so intensity cannot be compared with peers.", refs=series[max(series)]["refs"])
    value = series[fy]["value"] / (den[fy]["value"] if den else 1)
    refs = series[fy]["refs"] + (den[fy]["refs"] if den else [])
    peers = [float(x) for x in e.ev.get("peers", {}).get(indicator_id, [])]
    if len(peers) < int(p.get("min_peers", 5)):
        return _result(INSUFFICIENT, f"Only {len(peers)} sector peer(s) have comparable data; at least "
                                     f"{p.get('min_peers', 5)} are needed for a peer comparison.", refs=refs,
                       detail={"value": _r(value, 8), "fy": fy, "peers": len(peers)})
    worse = sum(1 for x in peers if (x > value if p.get("direction", "lower") == "lower" else x < value))
    equal = sum(1 for x in peers if x == value)
    score = 100 * (worse + 0.5 * equal) / len(peers)
    return _result(SCORED, f"Better than {100 * worse / len(peers):.0f}% of {len(peers)} sector peers in FY{fy}.",
                   score=score, refs=refs, detail={"value": _r(value, 8), "fy": fy, "peers": len(peers)})


def rule_practice(e: _Ev, p: dict) -> dict:
    stated = [(k, e.signals[k]) for k in p["signals"] if e.signals.get(k, {}).get("state") == "stated"]
    negs = [(k, e.signals[k]) for k in list(p.get("negative", [])) + list(p["signals"])
            if e.signals.get(k, {}).get("state") == "explicit_no"]
    if stated:
        score = float(p["stated"])
        note = ""
        attr = p.get("attribute")
        if attr:
            for _, s in stated:
                lvl = (s.get("attrs") or {}).get(attr)
                if lvl in p.get("attribute_scores", {}):
                    score = max(score, float(p["attribute_scores"][lvl]))
                    note = f" ({lvl} {attr})"
        refs = [_sig_ref(k, s) for k, s in stated][:4]
        return _result(SCORED, f"Stated in the documents assessed{note}.", score=score, refs=refs,
                       detail={"signals": [k for k, _ in stated]})
    if negs:
        return _result(SCORED, "The company states that this is not in place.", score=float(p["explicit_no"]),
                       refs=[_sig_ref(k, s) for k, s in negs][:2], detail={"explicit_no": True})
    if e.claimed(p["signals"]):
        return _result(UNVERIFIED, "Declared by the company; supporting evidence has not been accepted by a reviewer.")
    return _result(MISSING, "No statement on this was found in the documents assessed.")


def _ghg_targets(e: _Ev) -> list[dict]:
    return [t for t in e.targets if t.get("kind") in ("net_zero", "carbon_neutral", "ghg_reduction")]


def rule_net_zero_target(e: _Ev, p: dict) -> dict:
    nz = [t for t in e.targets if t.get("kind") in ("net_zero", "carbon_neutral") and t.get("target_year")]
    if not nz:
        neg = e.signals.get("negative.ghg_target")
        if neg and neg.get("state") == "explicit_no":
            return _result(SCORED, "The company states that it has not set an emissions target.",
                           score=float(p["explicit_no"]), refs=[_sig_ref("negative.ghg_target", neg)],
                           detail={"explicit_no": True})
        if e.claimed(["net_zero"]):
            return _result(UNVERIFIED, "A net zero target was declared by the company; supporting evidence has "
                                       "not been accepted by a reviewer.")
        return _result(MISSING, "No net zero or carbon neutrality target with a target year was found.")
    cs = p["class_scores"]
    best = max(nz, key=lambda t: (cs.get(t.get("commitment_class"), 0), -(t.get("target_year") or 9999)))
    score = float(cs.get(best.get("commitment_class"), 30))
    if best["target_year"] <= 2050:
        score += float(p.get("by_2050_bonus", 0))
    label = {"VALIDATED": "validated by a third party according to the source",
             "SCIENCE_BASED": "described as science-based (not stated as validated)",
             "FORMAL_TARGET": "a formal, time-bound target", "ANNOUNCED": "announced without a quantified pathway",
             "ASPIRATIONAL": "expressed as an aspiration",
             "LEGALLY_MANDATED": "required by regulation"}.get(best.get("commitment_class"), "stated")
    return _result(SCORED, f"Net zero target for {best['target_year']}, {label}.", score=min(score, 100),
                   refs=[_tgt_ref(best)], detail={"target_year": best["target_year"],
                                                  "commitment_class": best.get("commitment_class"),
                                                  "validation_status": best.get("validation_status")})


def rule_interim_target(e: _Ev, p: dict) -> dict:
    as_of = int(e.ev.get("as_of_fy") or 0)
    cands = [t for t in e.targets if t.get("kind") == "ghg_reduction" and t.get("reduction_pct")
             and t.get("target_year") and t["target_year"] <= as_of + int(p["horizon_years"])]
    if not cands:
        if e.claimed(["ghg_reduction"]):
            return _result(UNVERIFIED, "A near-term target was declared by the company; supporting evidence has "
                                       "not been accepted by a reviewer.")
        return _result(MISSING, "No quantified near-term emissions reduction target was found.")
    best, best_score, best_rate = None, -1.0, None
    for t in cands:
        if t.get("baseline_year") and t["target_year"] > t["baseline_year"]:
            rate = t["reduction_pct"] / (t["target_year"] - t["baseline_year"])
            sc = piecewise(p["bands"], rate)
        else:
            rate, sc = None, float(p["no_baseline_score"])
        if sc > best_score:
            best, best_score, best_rate = t, sc, rate
    if best_rate is None:
        text = (f"{best['reduction_pct']:.0f}% reduction by {best['target_year']}; no baseline year is stated, "
                f"so the pace of reduction cannot be assessed.")
    else:
        text = (f"{best['reduction_pct']:.0f}% reduction by {best['target_year']} from {best['baseline_year']} "
                f"({best_rate:.1f}% a year, linear).")
    return _result(SCORED, text, score=best_score, refs=[_tgt_ref(best)],
                   detail={"annual_rate_pct": _r(best_rate, 2), "target_year": best["target_year"],
                           "baseline_year": best.get("baseline_year"), "reduction_pct": best["reduction_pct"]})


def rule_target_scope(e: _Ev, p: dict) -> dict:
    tg = _ghg_targets(e)
    if not tg:
        if e.claimed(["net_zero", "ghg_reduction"]):
            return _result(UNVERIFIED, "Targets were declared by the company; supporting evidence has not been "
                                       "accepted by a reviewer.")
        return _result(MISSING, "No emissions target was found, so scope coverage cannot be assessed.")
    scopes = {s.replace(" ", "").lower()[:6] for t in tg for s in (t.get("scopes") or [])}
    has = {n for n in ("1", "2", "3") if any(s.endswith(n) for s in scopes)}
    sc = p["scores"]
    if has >= {"1", "2", "3"}:
        key, text = "s123", "Targets cover Scope 1, 2 and 3."
    elif has >= {"1", "2"}:
        key, text = "s12", "Targets cover Scope 1 and 2; Scope 3 is not covered."
    elif has:
        key, text = "single", f"Targets cover Scope {', '.join(sorted(has))} only."
    else:
        key, text = "unspecified", "Targets do not state which emission scopes they cover."
    return _result(SCORED, text, score=float(sc[key]), refs=[_tgt_ref(t) for t in tg][:4],
                   detail={"scopes": sorted(has)})


def rule_disclosure_coverage(e: _Ev, p: dict) -> dict:
    if not e.all_years() and not e.signals and not e.targets:
        return _result(INSUFFICIENT, "No disclosures have been assessed for this company yet.")
    latest = max(e.all_years()) if e.all_years() else None
    found, missing, refs = [], [], []
    for group in p["core"]:
        hit = None
        for m in group:
            for fy in ([latest, latest - 1] if latest else []):
                if e.point(m, fy):
                    hit = (m, fy, e.point(m, fy))
                    break
            if hit:
                break
        if hit:
            found.append(group[0])
            refs.append(_ref(*hit))
        else:
            missing.append(group[0])
    pct = 100 * len(found) / len(p["core"])
    return _result(SCORED, f"{len(found)} of {len(p['core'])} core disclosures are available for the latest "
                           f"reporting period.", score=piecewise(p["bands"], pct), refs=refs[:8],
                   detail={"found": found, "not_found": missing, "coverage_pct": _r(pct)})


def rule_years_reported(e: _Ev, p: dict) -> dict:
    best_m, years = None, []
    for m in p["metric"]:
        if len(e.years(m)) > len(years):
            best_m, years = m, e.years(m)
    if not years:
        return _no_data(e, p["metric"], "emissions")
    n = len(years)
    score = float(p["scores"].get(str(min(n, 3)), 0))
    return _result(SCORED, f"Emissions are reported for {n} period(s): {', '.join('FY' + str(y) for y in years)}.",
                   score=score, refs=[_ref(best_m, y, e.point(best_m, y)) for y in years][:5],
                   detail={"periods": years})


def rule_consistency(e: _Ev, p: dict) -> dict:
    n_metrics = sum(1 for m in e.metrics.values() if m)
    conflicts = len(e.conflicts)
    if n_metrics + conflicts < int(p["min_metrics"]):
        return _result(INSUFFICIENT, "Too few quantitative disclosures are available to assess consistency.")
    score = max(0.0, 100 - float(p["per_conflict"]) * conflicts)
    text = ("No conflicting values were found across the documents assessed." if not conflicts else
            f"{conflicts} metric(s) are stated with conflicting values across sources.")
    return _result(SCORED, text, score=score, detail={"conflicts": sorted(f"{m}:{fy}" for m, fy in e.conflicts)})


def rule_target_traceability(e: _Ev, p: dict) -> dict:
    tg = [t for t in e.targets if t.get("kind") == "ghg_reduction"]
    if not tg:
        nz = [t for t in e.targets if t.get("kind") in ("net_zero", "carbon_neutral")]
        if not nz:
            return _result(MISSING, "No emissions target was found.")
        return _result(SCORED, "A long-term target is stated, but no quantified reduction with a baseline year.",
                       score=25.0, refs=[_tgt_ref(t) for t in nz][:2])
    full = [t for t in tg if t.get("baseline_year") and t.get("reduction_pct") and t.get("target_year")]
    pct = 100 * len(full) / len(tg)
    return _result(SCORED, f"{len(full)} of {len(tg)} reduction target(s) state a baseline year, a target year "
                           f"and a quantified reduction.", score=pct, refs=[_tgt_ref(t) for t in tg][:4])


def rule_boundary_stated(e: _Ev, p: dict) -> dict:
    method = next(((m, e.years(m)[-1]) for m in p["method_metrics"] if e.years(m)), None)
    sig = next(((k, e.signals[k]) for k in p["signals"] if e.signals.get(k, {}).get("state") == "stated"), None)
    any_s2 = any(e.years(m) for m in list(p["method_metrics"]) + ["scope2_emissions"])
    if not method and not sig and not any_s2:
        return _result(MISSING, "No statement of the emissions boundary or calculation method was found.")
    refs, parts, score = [], [], 0.0
    if method:
        refs.append(_ref(method[0], method[1], e.point(*method)))
        parts.append("Scope 2 method (market- or location-based) is stated")
        score += 50
    else:
        parts.append("Scope 2 method is not stated")
    if sig:
        refs.append(_sig_ref(*sig))
        parts.append("the reporting boundary is described")
        score += 50
    else:
        parts.append("the reporting boundary is not described")
    return _result(SCORED, "; ".join(parts).capitalize() + ".", score=score, refs=refs)


RULES: dict[str, Callable[..., dict]] = {
    "trend": rule_trend, "level": rule_level, "ratio_level": rule_ratio_level,
    "peer_percentile": rule_peer_percentile, "practice": rule_practice, "net_zero_target": rule_net_zero_target,
    "interim_target": rule_interim_target, "target_scope": rule_target_scope,
    "disclosure_coverage": rule_disclosure_coverage, "years_reported": rule_years_reported,
    "consistency": rule_consistency, "target_traceability": rule_target_traceability,
    "boundary_stated": rule_boundary_stated,
}


# ── Aggregation ──────────────────────────────────────────────────────────────

def _classify(ind: dict, bands: dict) -> None:
    if ind["status"] != SCORED:
        ind["band"], ind["evidence_basis"], ind["classification"] = None, None, STATUS_LABEL[ind["status"]]
        return
    s = ind["score"]
    ind["band"] = "strong" if s >= bands["strong"] else "moderate" if s >= bands["moderate"] else "poor"
    flags = [r["verified"] for r in ind["evidence"]]
    ind["evidence_basis"] = ("derived" if not flags else "verified" if all(flags)
                             else "partly_verified" if any(flags) else "unverified")
    if ind["band"] == "poor":
        ind["classification"] = "Poor performance"
    elif ind["band"] == "strong":
        ind["classification"] = ("Positive verified evidence" if ind["evidence_basis"] == "verified"
                                 else "Positive evidence, not yet verified")
    else:
        ind["classification"] = "Moderate performance"


def _deductions(config: dict, e: _Ev, channel: str) -> dict[str, list[dict]]:
    out: dict[str, list[dict]] = {}
    for d in config.get("deductions", []):
        if d.get("channels") and channel not in d["channels"]:
            continue
        n, refs = 0, []
        if d["rule"] == "count_metric":
            ys = e.years(d["metric"])
            if ys:
                pt = e.point(d["metric"], ys[-1])
                n, refs = int(pt["v"]), [_ref(d["metric"], ys[-1], pt)]
        elif d["rule"] == "conflicts":
            n = len(e.conflicts)
        elif d["rule"] == "rejected_evidence":
            n = int(e.ev.get("rejected_evidence", 0))
        if n > 0:
            pts = min(float(d["max"]), float(d["points_each"]) * n)
            out.setdefault(d["pillar"], []).append({"id": d["id"], "points": _r(pts), "count": n,
                                                    "reason": d["reason"], "evidence": refs})
    return out


def compute(config: dict, evidence: dict) -> dict:
    e = _Ev(evidence)
    channel = evidence.get("channel", "public")
    bands = config["bands"]
    deductions = _deductions(config, e, channel)
    pillars, used = [], {}
    total_w = sum(float(p["weight"]) for p in config["pillars"])
    scored_w = weighted = cov_weighted = 0.0

    for p in config["pillars"]:
        inds = []
        iw_total = sum(float(i["weight"]) for i in p["indicators"])
        iw_scored = acc = 0.0
        for i in p["indicators"]:
            fn = RULES[i["rule"]]
            params = {"label": i["name"][0].lower() + i["name"][1:], **i.get("params", {})}
            res = fn(e, params, i["id"]) if i["rule"] == "peer_percentile" else fn(e, params)
            ind = {"id": i["id"], "name": i["name"], "weight": float(i["weight"]), "rule": i["rule"], **res}
            _classify(ind, bands)
            if ind["status"] == SCORED:
                iw_scored += ind["weight"]
                acc += ind["weight"] * ind["score"]
                for r in ind["evidence"]:
                    if r.get("id"):
                        used[r["id"]] = r
            inds.append(ind)
        coverage = iw_scored / iw_total if iw_total else 0.0
        ded = deductions.get(p["id"], [])
        if coverage >= float(config["min_indicator_coverage"]) and iw_scored > 0:
            raw = acc / iw_scored
            score = max(0.0, raw - sum(d["points"] for d in ded))
            status = SCORED
            scored_w += float(p["weight"])
            weighted += float(p["weight"]) * score
        else:
            raw = score = None
            status = INSUFFICIENT
        cov_weighted += float(p["weight"]) * coverage
        pillars.append({"id": p["id"], "name": p["name"], "weight": float(p["weight"]),
                        "description": p.get("description"), "status": status, "score": _r(score),
                        "score_before_deductions": _r(raw), "indicator_coverage": _r(100 * coverage),
                        "deductions": ded if status == SCORED else [], "indicators": inds})

    pillar_cov = scored_w / total_w if total_w else 0.0
    overall = _r(weighted / scored_w) if scored_w and pillar_cov >= float(config["min_pillar_coverage"]) else None

    # Data Confidence — computed from the evidence, never from the performance values.
    cc = config["confidence"]
    refs = list(used.values())
    coverage_c = 100 * cov_weighted / total_w if total_w else 0.0
    verification_c = 100 * sum(1 for r in refs if r["verified"]) / len(refs) if refs else 0.0
    confs = [float(r["conf"]) for r in refs if r.get("conf") is not None]
    extraction_c = sum(confs) / len(confs) if confs else 0.0
    years = [r["fy"] for r in refs if r.get("fy")]
    if years and evidence.get("as_of_fy"):
        gap = max(0, int(evidence["as_of_fy"]) - max(years))
        recency_c = float(cc["recency"].get(str(gap), cc["recency"]["older"]))
    else:
        recency_c = 0.0
    w = cc["weights"]
    conf = (w["coverage"] * coverage_c + w["verification"] * verification_c
            + w["extraction"] * extraction_c + w["recency"] * recency_c)
    conf_band = ("high" if conf >= cc["bands"]["high"] else "moderate" if conf >= cc["bands"]["moderate"] else "low")

    flat = [(p, i) for p in pillars for i in p["indicators"]]
    strengths = sorted([{"pillar": p["name"], "indicator": i["name"], "score": i["score"],
                         "explanation": i["explanation"], "evidence_basis": i["evidence_basis"]}
                        for p, i in flat if i["status"] == SCORED and i["score"] >= bands["strong"]],
                       key=lambda x: (-x["score"], x["indicator"]))[:6]
    improvements = sorted([{"pillar": p["name"], "indicator": i["name"], "score": i["score"],
                            "explanation": i["explanation"]}
                           for p, i in flat if i["status"] == SCORED and i["score"] < bands["moderate"] + 15],
                          key=lambda x: (x["score"], x["indicator"]))[:6]
    gaps = [{"pillar": p["name"], "indicator": i["name"], "status": i["status"],
             "classification": i["classification"], "explanation": i["explanation"]}
            for p, i in flat if i["status"] != SCORED]
    all_ded = [{"pillar": p["name"], **d} for p in pillars for d in p["deductions"]]

    if overall is None:
        summary = (f"An overall score is withheld: only {100 * pillar_cov:.0f}% of the methodology (by pillar "
                   f"weight) could be evidenced, below the {100 * float(config['min_pillar_coverage']):.0f}% "
                   f"required. This reflects missing or unusable evidence, not poor performance.")
    else:
        summary = (f"Overall score {overall:.1f} from {sum(1 for p in pillars if p['status'] == SCORED)} of "
                   f"{len(pillars)} pillars ({100 * pillar_cov:.0f}% of methodology weight). "
                   f"{len(gaps)} indicator(s) could not be scored and are excluded rather than scored as zero.")

    return {
        "overall": overall,
        "overall_status": SCORED if overall is not None else INSUFFICIENT,
        "pillar_coverage_pct": _r(100 * pillar_cov),
        "pillars": pillars,
        "confidence": {"score": _r(conf), "band": conf_band,
                       "components": {"coverage": _r(coverage_c), "verification": _r(verification_c),
                                      "extraction": _r(extraction_c), "recency": _r(recency_c)},
                       "weights": w, "evidence_items": len(refs),
                       "latest_evidence_fy": max(years) if years else None},
        "evidence_coverage_pct": _r(coverage_c),
        "strengths": strengths, "improvements": improvements, "gaps": gaps, "deductions": all_ded,
        "unverified_claims": evidence.get("unverified_claims", []),
        "summary": summary,
        "engine_version": ENGINE_VERSION,
    }


def reproduce(config: dict, inputs: dict, expected_result_hash: str) -> dict:
    """Recompute a stored score from its methodology and evidence snapshot."""
    result = compute(config, inputs)
    h = content_hash(result)
    return {"reproduced": h == expected_result_hash, "result_hash": h, "expected_hash": expected_result_hash,
            "overall": result["overall"], "confidence": result["confidence"]["score"]}
