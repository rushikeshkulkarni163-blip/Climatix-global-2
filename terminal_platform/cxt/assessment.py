"""
Assessment engine: turns stored evidence into scored, versioned assessments.

Two independent channels per company

  public   Built only from public documents the platform ingested. Runs
           automatically after a document is processed or a reviewer decision
           changes the evidence. A company has no way to edit it.
  company  The company's own submission through the questionnaire, with
           evidence. Reviewed by Climactix staff. Its score uses the public
           evidence PLUS company answers whose evidence a reviewer accepted;
           unaccepted claims are listed, not scored.

Every scoring run stores the evidence snapshot it used, so the score can be
reproduced and explained later, and a new run never overwrites an old one.
"""

from __future__ import annotations

import uuid
from typing import Any, Optional

from fastapi import HTTPException
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from . import audit, methodology, questionnaire, scoring
from .models import (Assessment, AssessmentAnswer, AssessmentEvent, ClimateTarget, Company, DataPoint, Document,
                     ReviewItem, Score, Sector, utcnow)
from .util import content_hash, current_fiscal_year

USABLE_PUBLIC = ("extracted", "verified")
ACCEPTED_COMPANY = ("evidence_accepted", "verified")


# ── Evidence snapshot ────────────────────────────────────────────────────────

def _rank(d: Any) -> tuple:
    return (d.verification_status in ("verified", "evidence_accepted"), d.confidence, d.extracted_at)


def _usable_points(db: Session, company_id: uuid.UUID, channel: str, statuses: tuple[str, ...],
                   assessment_id: Optional[uuid.UUID] = None) -> list[DataPoint]:
    superseded = select(Document.supersedes_id).where(Document.supersedes_id.is_not(None))
    stmt = select(DataPoint).where(DataPoint.company_id == company_id, DataPoint.channel == channel,
                                   DataPoint.verification_status.in_(statuses),
                                   DataPoint.superseded_by_id.is_(None))
    if channel == "public":
        public_docs = select(Document.id).where(Document.visibility == "public", Document.status == "completed",
                                                Document.id.not_in(superseded))
        stmt = stmt.where(DataPoint.document_id.in_(public_docs))
    else:
        stmt = stmt.where(DataPoint.assessment_id == assessment_id)
    return list(db.execute(stmt).scalars())


def _merge_points(ev: dict, points: list[DataPoint], src: str, conflicts: set[tuple[str, Optional[int]]],
                  override: bool = False) -> None:
    best: dict[tuple[str, Optional[int]], DataPoint] = {}
    sig: dict[str, DataPoint] = {}
    for d in points:
        if d.kind == "numeric":
            if d.normalized_value is None or d.fiscal_year is None:
                continue
            k = (d.metric_key, d.fiscal_year)
            if k not in best or _rank(d) > _rank(best[k]):
                best[k] = d
        else:
            cur = sig.get(d.metric_key)
            if not cur or ((d.fiscal_year or 0), *_rank(d)) > ((cur.fiscal_year or 0), *_rank(cur)):
                sig[d.metric_key] = d
    for (metric, fy), d in best.items():
        verified = d.verification_status in ("verified", "evidence_accepted")
        if (metric, fy) in conflicts and not verified:
            continue
        slot = ev["metrics"].setdefault(metric, {})
        if str(fy) in slot and not override:
            continue
        slot[str(fy)] = {"v": d.normalized_value, "u": d.normalized_unit, "raw": d.value, "raw_unit": d.unit,
                         "verified": verified, "conf": d.confidence, "id": str(d.id), "src": src}
    for key, d in sig.items():
        if key in ev["signals"] and not override:
            continue
        ev["signals"][key] = {"state": d.value_text or "stated", "fy": d.fiscal_year, "id": str(d.id), "src": src,
                              "verified": d.verification_status in ("verified", "evidence_accepted"),
                              "conf": d.confidence,
                              "attrs": {k: v for k, v in (d.attributes or {}).items() if k in ("level", "standard")}}
        # A positive statement and an explicit negative about the same topic cannot both stand.
        if override:
            other = key.replace("negative.", "", 1) if key.startswith("negative.") else None
            if other:
                for k in [k for k in ev["signals"] if k.endswith("." + other) and not k.startswith("negative.")]:
                    if ev["signals"][k]["src"] != src:
                        del ev["signals"][k]


def _targets(db: Session, company_id: uuid.UUID, channel: str, statuses: tuple[str, ...],
             assessment_id: Optional[uuid.UUID] = None) -> list[dict]:
    superseded = select(Document.supersedes_id).where(Document.supersedes_id.is_not(None))
    stmt = select(ClimateTarget).where(ClimateTarget.company_id == company_id, ClimateTarget.channel == channel,
                                       ClimateTarget.verification_status.in_(statuses))
    if channel == "public":
        stmt = stmt.where(ClimateTarget.document_id.in_(
            select(Document.id).where(Document.visibility == "public", Document.status == "completed",
                                      Document.id.not_in(superseded))))
    else:
        stmt = stmt.where(ClimateTarget.assessment_id == assessment_id)
    best: dict[tuple, ClimateTarget] = {}
    for t in db.execute(stmt).scalars():
        k = (t.target_kind, t.target_year, t.reduction_pct)
        if k not in best or ((t.fiscal_year or 0), t.confidence) > ((best[k].fiscal_year or 0), best[k].confidence):
            best[k] = t
    out = [{"id": str(t.id), "kind": t.target_kind, "target_year": t.target_year, "baseline_year": t.baseline_year,
            "reduction_pct": t.reduction_pct, "scopes": t.scope_coverage, "commitment_class": t.commitment_class,
            "validation_status": t.validation_status, "fy": t.fiscal_year, "conf": t.confidence,
            "verified": t.verification_status in ("verified", "evidence_accepted"), "src": channel}
           for t in best.values()]
    return sorted(out, key=lambda t: (t["kind"], t["target_year"] or 0, t["reduction_pct"] or 0, t["id"]))


def _conflicts(db: Session, company_id: uuid.UUID, channel: str) -> set[tuple[str, Optional[int]]]:
    return {(r.detail.get("metric_key"), r.detail.get("fiscal_year")) for r in db.execute(
        select(ReviewItem).where(ReviewItem.company_id == company_id, ReviewItem.kind == "contradiction",
                                 ReviewItem.status == "open")).scalars()
        if r.detail.get("channel", "public") == channel}


def _intensity(ev: dict, cfg_params: dict) -> Optional[float]:
    e = scoring._Ev(ev)
    series = e.series(cfg_params["series"])
    den = e.series({"sum": [cfg_params["per"]]}) if cfg_params.get("per") else None
    for fy in sorted(series, reverse=True):
        if den is None:
            return series[fy]["value"]
        if fy in den and den[fy]["value"] > 0:
            return series[fy]["value"] / den[fy]["value"]
    return None


def build_evidence(db: Session, company: Company, channel: str, config: dict,
                   company_assessment: Optional[Assessment] = None, with_peers: bool = True) -> dict:
    """The exact evidence the engine will consume, as plain JSON."""
    ev: dict[str, Any] = {"channel": channel, "as_of_fy": current_fiscal_year(),
                          "sector": company.sector.code if company.sector else None,
                          "metrics": {}, "signals": {}, "targets": [], "conflicts": [], "unverified_claims": [],
                          "rejected_evidence": 0, "peers": {}}
    conflicts = _conflicts(db, company.id, "public")
    _merge_points(ev, _usable_points(db, company.id, "public", USABLE_PUBLIC), "public", conflicts)
    ev["targets"] = _targets(db, company.id, "public", USABLE_PUBLIC)

    if channel == "company" and company_assessment is not None:
        aid = company_assessment.id
        accepted = _usable_points(db, company.id, "company", ACCEPTED_COMPANY, aid)
        _merge_points(ev, accepted, "company", set(), override=True)
        # A reviewer-accepted company figure settles a conflict between public sources.
        settled = {(d.metric_key, d.fiscal_year) for d in accepted if d.kind == "numeric"}
        conflicts = conflicts - settled
        co_targets = _targets(db, company.id, "company", ACCEPTED_COMPANY, aid)
        kinds = {t["kind"] for t in co_targets}
        ev["targets"] = sorted([t for t in ev["targets"] if t["kind"] not in kinds] + co_targets,
                               key=lambda t: (t["kind"], t["target_year"] or 0, t["reduction_pct"] or 0, t["id"]))
        claims = {}
        for d in _usable_points(db, company.id, "company", ("company_declared",), aid):
            claims[d.metric_key] = {"metric": d.metric_key, "label": d.attributes.get("question") or d.metric_key,
                                    "reason": "no evidence accepted"}
        for t in db.execute(select(ClimateTarget).where(ClimateTarget.assessment_id == aid,
                                                        ClimateTarget.verification_status == "company_declared")).scalars():
            claims[t.target_kind] = {"metric": t.target_kind, "label": t.description[:120],
                                     "reason": "no evidence accepted"}
        # A claim already supported by usable evidence is not an open claim.
        have = set(ev["metrics"]) | {k for k, s in ev["signals"].items()} | {t["kind"] for t in ev["targets"]}
        ev["unverified_claims"] = sorted([c for k, c in claims.items() if k not in have], key=lambda c: c["metric"])
        ev["rejected_evidence"] = db.execute(select(func.count()).select_from(AssessmentAnswer).where(
            AssessmentAnswer.assessment_id == aid, AssessmentAnswer.evidence_status == "rejected")).scalar() or 0

    ev["conflicts"] = sorted([{"metric": m, "fy": fy} for m, fy in conflicts], key=lambda c: (c["metric"], c["fy"] or 0))

    if with_peers and company.sector_id:
        for p in config["pillars"]:
            for i in p["indicators"]:
                if i["rule"] != "peer_percentile":
                    continue
                vals = []
                peers = db.execute(select(Company).where(Company.sector_id == company.sector_id,
                                                         Company.status == "active", Company.id != company.id)
                                   .order_by(Company.cx_id)).scalars().all()
                for peer in peers:
                    pev = build_evidence(db, peer, "public", config, with_peers=False)
                    x = _intensity(pev, i["params"])
                    if x is not None:
                        vals.append(round(x, 12))
                ev["peers"][i["id"]] = sorted(vals)
    return ev


# ── Scoring runs ─────────────────────────────────────────────────────────────

def _store_score(db: Session, actor: Any, company: Company, assessment: Assessment, score_type: str,
                 m: Any, ev: dict, result: dict, trigger: str) -> Score:
    db.execute(update(Score).where(Score.company_id == company.id, Score.score_type == score_type,
                                   Score.is_current).values(is_current=False))
    db.flush()
    years = [int(y) for mm in ev["metrics"].values() for y in mm]
    sc = Score(company_id=company.id, assessment_id=assessment.id, score_type=score_type,
               methodology_version_id=m.id, engine_version=scoring.ENGINE_VERSION,
               fiscal_year=max(years) if years else None, overall=result["overall"],
               confidence=result["confidence"]["score"], evidence_coverage=result["evidence_coverage_pct"],
               pillars={p["id"]: p["score"] for p in result["pillars"]}, result=result, inputs=ev,
               inputs_hash=content_hash(ev), result_hash=content_hash(result), is_current=True,
               computed_by=getattr(actor, "user_id", None), trigger=trigger[:200])
    db.add(sc)
    db.flush()
    audit.record(db, actor, "score.compute", entity_type="score", entity_id=sc.id, company_id=company.id,
                 detail={"score_type": score_type, "overall": sc.overall, "confidence": sc.confidence,
                         "methodology_version": m.version, "engine_version": scoring.ENGINE_VERSION,
                         "assessment_version": assessment.version_no, "inputs_hash": sc.inputs_hash,
                         "result_hash": sc.result_hash, "trigger": trigger})
    return sc


def current_score(db: Session, company_id: uuid.UUID, score_type: str) -> Optional[Score]:
    return db.execute(select(Score).where(Score.company_id == company_id, Score.score_type == score_type,
                                          Score.is_current)).scalar_one_or_none()


def _next_version(db: Session, company_id: uuid.UUID, channel: str) -> int:
    return (db.execute(select(func.coalesce(func.max(Assessment.version_no), 0)).where(
        Assessment.company_id == company_id, Assessment.channel == channel)).scalar() or 0) + 1


def run_public_assessment(db: Session, actor: Any, company_id: uuid.UUID, trigger: str,
                          force: bool = False) -> Optional[Score]:
    """Assess a company from public evidence and store a new score version.
    Returns the existing current score if nothing it depends on has changed."""
    company = db.execute(select(Company).where(Company.id == company_id).with_for_update(of=Company)).scalar_one_or_none()
    if not company or company.status != "active":
        return None
    m = methodology.approved(db)
    ev = build_evidence(db, company, "public", m.config)
    cur = current_score(db, company.id, "public")
    if cur and not force and cur.inputs_hash == content_hash(ev) and cur.methodology_version_id == m.id \
            and cur.engine_version == scoring.ENGINE_VERSION:
        return cur
    if not ev["metrics"] and not ev["signals"] and not ev["targets"] and not cur:
        return None                      # nothing to assess yet
    result = scoring.compute(m.config, ev)
    years = [int(y) for mm in ev["metrics"].values() for y in mm]
    a = Assessment(company_id=company.id, channel="public", version_no=_next_version(db, company.id, "public"),
                   fiscal_year=max(years) if years else None, status="scored",
                   created_by=getattr(actor, "user_id", None), trigger=trigger[:200])
    db.add(a)
    db.flush()
    db.add(AssessmentEvent(assessment_id=a.id, event="generated", body=trigger,
                           actor_user_id=getattr(actor, "user_id", None),
                           actor_label=getattr(actor, "email", None) or "system"))
    sc = _store_score(db, actor, company, a, "public", m, ev, result, trigger)
    # The Company Assessment Score includes public evidence, so it follows a change in it.
    latest = _latest_company_assessment(db, company.id, ("scored",))
    if latest:
        score_company_assessment(db, actor, latest, f"public evidence changed ({trigger})")
    return sc


def _latest_company_assessment(db: Session, company_id: uuid.UUID, statuses: tuple[str, ...]) -> Optional[Assessment]:
    return db.execute(select(Assessment).where(Assessment.company_id == company_id, Assessment.channel == "company",
                                               Assessment.status.in_(statuses))
                      .order_by(Assessment.version_no.desc()).limit(1)).scalar_one_or_none()


def score_company_assessment(db: Session, actor: Any, a: Assessment, trigger: str) -> Score:
    company = db.get(Company, a.company_id)
    m = methodology.approved(db)
    ev = build_evidence(db, company, "company", m.config, company_assessment=a)
    result = scoring.compute(m.config, ev)
    return _store_score(db, actor, company, a, "company", m, ev, result, trigger)


def sector_benchmark(db: Session, company: Company, score_type: str = "public", min_peers: int = 3) -> dict:
    """Where a company's current score sits among its sector. Computed on read
    from current scores; it is context for a score, never an input to it."""
    if not company.sector_id:
        return {"available": False, "reason": "The company has no sector classification"}
    rows = db.execute(select(Score.company_id, Score.overall, Score.pillars).join(
        Company, Company.id == Score.company_id).where(
        Company.sector_id == company.sector_id, Company.status == "active", Score.is_current,
        Score.score_type == score_type, Score.overall.is_not(None))).all()
    vals = sorted(r.overall for r in rows)
    sector = db.get(Sector, company.sector_id)
    if len(vals) < min_peers:
        return {"available": False, "sector": sector.name, "companies_scored": len(vals),
                "reason": f"Fewer than {min_peers} scored companies in this sector"}

    def q(xs: list[float], f: float) -> float:
        i = f * (len(xs) - 1)
        lo, hi = int(i), min(int(i) + 1, len(xs) - 1)
        return round(xs[lo] + (xs[hi] - xs[lo]) * (i - lo), 1)

    mine = next((r.overall for r in rows if r.company_id == company.id), None)
    pillars = {}
    for pid in (rows[0].pillars or {}):
        pv = sorted(r.pillars[pid] for r in rows if r.pillars.get(pid) is not None)
        if len(pv) >= min_peers:
            pillars[pid] = {"median": q(pv, 0.5), "n": len(pv)}
    return {"available": True, "sector": sector.name, "companies_scored": len(vals), "median": q(vals, 0.5),
            "p25": q(vals, 0.25), "p75": q(vals, 0.75), "min": vals[0], "max": vals[-1],
            "percentile": round(100 * sum(1 for v in vals if v < mine) / len(vals)) if mine is not None else None,
            "pillars": pillars}


# ── Company submission workflow ──────────────────────────────────────────────

def _event(db: Session, a: Assessment, actor: Any, event: str, body: Optional[str] = None,
           section: Optional[str] = None) -> None:
    db.add(AssessmentEvent(assessment_id=a.id, event=event, body=body, section=section,
                           actor_user_id=getattr(actor, "user_id", None),
                           actor_label=getattr(actor, "email", None) or "system"))


def start_company_assessment(db: Session, actor: Any, company: Company, fiscal_year: int) -> Assessment:
    open_one = _latest_company_assessment(db, company.id, ("draft", "submitted", "under_review", "returned"))
    if open_one:
        raise HTTPException(409, f"Assessment version {open_one.version_no} is still {open_one.status.replace('_', ' ')}; "
                                 f"complete it before starting a new version")
    a = Assessment(company_id=company.id, channel="company", version_no=_next_version(db, company.id, "company"),
                   fiscal_year=fiscal_year, status="draft", questionnaire_version=questionnaire.VERSION,
                   organisation_id=actor.org_id, created_by=actor.user_id)
    db.add(a)
    db.flush()
    prev = _latest_company_assessment(db, company.id, ("scored", "validated"))
    carried = 0
    if prev and prev.fiscal_year == fiscal_year:
        for ans in db.execute(select(AssessmentAnswer).where(AssessmentAnswer.assessment_id == prev.id)).scalars():
            db.add(AssessmentAnswer(assessment_id=a.id, question_id=ans.question_id, value=ans.value,
                                    source_declaration=ans.source_declaration,
                                    evidence_document_id=ans.evidence_document_id,
                                    evidence_status="submitted" if ans.evidence_document_id else
                                    ("declared_source" if ans.source_declaration else "not_provided")))
            carried += 1
    _event(db, a, actor, "created", f"Version {a.version_no} started for FY{fiscal_year}"
           + (f"; {carried} answer(s) carried forward from version {prev.version_no}" if carried else ""))
    audit.record(db, actor, "assessment.create", entity_type="assessment", entity_id=a.id, company_id=company.id,
                 detail={"version": a.version_no, "fiscal_year": fiscal_year, "carried_forward": carried})
    return a


def save_answer(db: Session, actor: Any, a: Assessment, question_id: str, value: Optional[dict],
                source_declaration: Optional[str], evidence_document_id: Optional[uuid.UUID]) -> AssessmentAnswer:
    if a.status not in ("draft", "returned"):
        raise HTTPException(409, f"This assessment is {a.status.replace('_', ' ')} and can no longer be edited")
    q = questionnaire.BY_ID.get(question_id)
    if not q:
        raise HTTPException(404, f"Unknown question '{question_id}'")
    try:
        clean = questionnaire.validate_value(q, value)
    except ValueError as e:
        raise HTTPException(422, str(e))
    if evidence_document_id:
        doc = db.get(Document, evidence_document_id)
        if not doc or doc.owner_org_id != actor.org_id or doc.source_type != "company_submission":
            raise HTTPException(422, "Evidence must be a document uploaded by your organisation")
    ans = db.execute(select(AssessmentAnswer).where(AssessmentAnswer.assessment_id == a.id,
                                                    AssessmentAnswer.question_id == question_id)).scalar_one_or_none()
    if not ans:
        ans = AssessmentAnswer(assessment_id=a.id, question_id=question_id)
        db.add(ans)
    changed = (ans.value != clean or ans.evidence_document_id != evidence_document_id
               or (ans.source_declaration or "") != (source_declaration or ""))
    ans.value = clean
    ans.source_declaration = (source_declaration or "").strip()[:2000] or None
    ans.evidence_document_id = evidence_document_id
    if changed or ans.evidence_status in ("not_provided", "declared_source"):
        ans.evidence_status = ("submitted" if evidence_document_id else
                               "declared_source" if ans.source_declaration else "not_provided")
        if changed:
            ans.reviewed_by = ans.reviewed_at = None
    db.flush()
    return ans


def progress(db: Session, a: Assessment) -> dict:
    """Completion, missing required information and evidence status by section."""
    answers = {x.question_id: x for x in db.execute(
        select(AssessmentAnswer).where(AssessmentAnswer.assessment_id == a.id)).scalars()}
    sections, missing, unsupported = [], [], []
    ev_counts = {k: 0 for k in ("not_provided", "declared_source", "submitted", "accepted", "rejected")}
    for s in questionnaire.SECTIONS:
        qs = [q for q in questionnaire.QUESTIONS if q["section"] == s["id"]]
        done = 0
        for q in qs:
            ans = answers.get(q["id"])
            answered = bool(ans and ans.value)
            if answered:
                done += 1
                ev_counts[ans.evidence_status] += 1
                if ans.evidence_status == "not_provided":
                    unsupported.append({"question_id": q["id"], "text": q["text"], "section": s["name"]})
            elif q.get("required"):
                missing.append({"question_id": q["id"], "text": q["text"], "section": s["name"]})
        sections.append({"id": s["id"], "name": s["name"], "answered": done, "total": len(qs),
                         "percent": round(100 * done / len(qs)) if qs else 0})
    total = sum(s["total"] for s in sections)
    answered = sum(s["answered"] for s in sections)
    return {"answered": answered, "total": total, "percent": round(100 * answered / total) if total else 0,
            "sections": sections, "missing_required": missing, "answers_without_source": unsupported,
            "evidence": ev_counts, "can_submit": not missing and not unsupported and answered > 0}


def submit(db: Session, actor: Any, a: Assessment) -> Assessment:
    if a.status not in ("draft", "returned"):
        raise HTTPException(409, f"This assessment is already {a.status.replace('_', ' ')}")
    pr = progress(db, a)
    if pr["missing_required"]:
        raise HTTPException(422, {"message": "Required questions are unanswered",
                                  "missing_required": pr["missing_required"]})
    if pr["answers_without_source"]:
        raise HTTPException(422, {"message": "Every answer needs an evidence document or a declaration of its source",
                                  "answers_without_source": pr["answers_without_source"]})
    resubmission = a.status == "returned"
    a.status, a.submitted_at = "submitted", utcnow()
    _event(db, a, actor, "resubmitted" if resubmission else "submitted",
           f"{pr['answered']} of {pr['total']} questions answered")
    audit.record(db, actor, "assessment.submit", entity_type="assessment", entity_id=a.id, company_id=a.company_id,
                 detail={"version": a.version_no, "answered": pr["answered"], "resubmission": resubmission})
    return a


def review_answer(db: Session, actor: Any, a: Assessment, question_id: str, decision: str,
                  comment: Optional[str]) -> AssessmentAnswer:
    if a.status not in ("submitted", "under_review"):
        raise HTTPException(409, "Only a submitted assessment can be reviewed")
    ans = db.execute(select(AssessmentAnswer).where(AssessmentAnswer.assessment_id == a.id,
                                                    AssessmentAnswer.question_id == question_id)).scalar_one_or_none()
    if not ans or not ans.value:
        raise HTTPException(404, "No answer to review for this question")
    if decision == "accept" and not ans.evidence_document_id:
        raise HTTPException(422, "An answer without an evidence document cannot be accepted as evidenced; "
                                 "it remains a company declaration")
    if decision == "reject" and not (comment or "").strip():
        raise HTTPException(422, "A reason is required when rejecting evidence")
    if a.status == "submitted":
        a.status = "under_review"
        _event(db, a, actor, "review_started")
    ans.evidence_status = "accepted" if decision == "accept" else "rejected"
    ans.reviewer_comment = (comment or "").strip() or None
    ans.reviewed_by, ans.reviewed_at = actor.user_id, utcnow()
    audit.record(db, actor, f"assessment.evidence_{ans.evidence_status}", entity_type="assessment_answer",
                 entity_id=ans.id, company_id=a.company_id,
                 detail={"assessment_version": a.version_no, "question_id": question_id, "comment": comment})
    return ans


def return_to_company(db: Session, actor: Any, a: Assessment, comment: str) -> Assessment:
    if a.status not in ("submitted", "under_review"):
        raise HTTPException(409, "Only a submitted assessment can be returned")
    a.status, a.reviewed_by, a.reviewed_at = "returned", actor.user_id, utcnow()
    _event(db, a, actor, "returned", comment)
    audit.record(db, actor, "assessment.return", entity_type="assessment", entity_id=a.id, company_id=a.company_id,
                 detail={"version": a.version_no, "comment": comment})
    return a


def validate_and_score(db: Session, actor: Any, a: Assessment, comment: Optional[str]) -> Score:
    """Close the review: record every answer as evidence (accepted, declared
    or rejected), then compute the Company Assessment Score."""
    if a.status not in ("submitted", "under_review"):
        raise HTTPException(409, "Only a submitted assessment can be validated")
    answers = db.execute(select(AssessmentAnswer).where(AssessmentAnswer.assessment_id == a.id)).scalars().all()
    undecided = [x.question_id for x in answers if x.value and x.evidence_status == "submitted"]
    if undecided:
        raise HTTPException(422, {"message": "Accept or reject the evidence for every answer before validating",
                                  "undecided": undecided})
    n = materialise(db, a, answers)
    a.status, a.reviewed_by, a.reviewed_at = "validated", actor.user_id, utcnow()
    _event(db, a, actor, "validated", comment)
    audit.record(db, actor, "assessment.validate", entity_type="assessment", entity_id=a.id, company_id=a.company_id,
                 detail={"version": a.version_no, **n, "comment": comment})
    sc = score_company_assessment(db, actor, a, f"company assessment v{a.version_no} validated")
    a.status = "scored"
    _event(db, a, actor, "scored", f"Company Assessment Score "
           f"{'withheld (insufficient evidence)' if sc.overall is None else format(sc.overall, '.1f')}; "
           f"Data Confidence {sc.confidence:.1f}")
    return sc


_STATUS_FOR = {"accepted": "evidence_accepted", "rejected": "rejected"}


def materialise(db: Session, a: Assessment, answers: list[AssessmentAnswer]) -> dict:
    """Write a reviewed submission as company-channel evidence rows."""
    by_q = {x.question_id: x for x in answers if x.value}
    counts = {"accepted": 0, "declared": 0, "rejected": 0}

    def status(ans: AssessmentAnswer) -> str:
        s = _STATUS_FOR.get(ans.evidence_status, "company_declared")
        counts["accepted" if s == "evidence_accepted" else "rejected" if s == "rejected" else "declared"] += 1
        return s

    def point(ans, q, **kw) -> DataPoint:
        st = kw.pop("status")
        return DataPoint(company_id=a.company_id, assessment_id=a.id, document_id=ans.evidence_document_id,
                         channel="company", extraction_method="company_declared",
                         confidence=90.0 if st == "evidence_accepted" else 50.0, verification_status=st,
                         reviewed_by=ans.reviewed_by, reviewed_at=ans.reviewed_at, review_note=ans.reviewer_comment,
                         quote=ans.source_declaration, source_location=f"Questionnaire {q['id']}",
                         attributes={"question": q["text"], "question_id": q["id"],
                                     "assessment_version": a.version_no}, **kw)

    for qid, ans in by_q.items():
        q = questionnaire.BY_ID.get(qid)
        maps = q.get("maps") if q else None
        if not maps or "target" in maps:
            continue
        st = status(ans)
        v = ans.value
        if "metric" in maps:
            from .extraction.catalogue import CATALOGUE
            cat = CATALOGUE.get(maps["metric"], {}).get("category", "environmental")
            for fy, raw in ((a.fiscal_year, v.get("value")), (a.fiscal_year - 1, v.get("prior_value"))):
                if raw is None:
                    continue
                db.add(point(ans, q, status=st, metric_key=maps["metric"], category=cat, kind="numeric",
                             fiscal_year=fy, value=raw, unit=q.get("unit") or "%",
                             normalized_value=raw * maps.get("factor", 1.0), normalized_unit=maps["normalized_unit"]))
        elif "signal" in maps:
            yes = v["value"] not in ("no", maps.get("no"))
            key = maps["signal"] if yes else maps.get("negative", maps["signal"])
            p = point(ans, q, status=st, metric_key=key, category="governance", kind="signal",
                      fiscal_year=a.fiscal_year, value_text="stated" if yes else "explicit_no")
            lvl = (maps.get("levels") or {}).get(v["value"])
            if lvl:
                p.attributes = {**p.attributes, "level": lvl}
            db.add(p)

    # Climate targets are assembled from several answers.
    def val(qid):
        return by_q[qid].value.get("value") if qid in by_q else None

    def tstatus(*qids) -> str:
        sts = [by_q[q].evidence_status for q in qids if q in by_q]
        if any(s == "rejected" for s in sts):
            return "rejected"
        return "evidence_accepted" if sts and all(s == "accepted" for s in sts) else "company_declared"

    scopes = val("cs_scopes") or []
    validation = {"Validated by SBTi": "validated_third_party",
                  "Submitted for validation": "validation_pending"}.get(val("cs_validation"), "declared")
    if val("cs_netzero") == "yes" and val("cs_netzero_year"):
        st = tstatus("cs_netzero", "cs_netzero_year")
        counts["accepted" if st == "evidence_accepted" else "rejected" if st == "rejected" else "declared"] += 0
        ans = by_q["cs_netzero_year"]
        db.add(ClimateTarget(company_id=a.company_id, assessment_id=a.id, document_id=ans.evidence_document_id,
                             channel="company", target_kind="net_zero", horizon="long_term",
                             description=f"Net zero by {val('cs_netzero_year')} (company submission)",
                             scope_coverage=scopes,
                             commitment_class="VALIDATED" if validation == "validated_third_party" and
                             tstatus("cs_validation") == "evidence_accepted" else "FORMAL_TARGET",
                             validation_status=validation, target_year=val("cs_netzero_year"),
                             baseline_year=val("cs_baseline_year"), fiscal_year=a.fiscal_year,
                             quote=ans.source_declaration, confidence=90.0 if st == "evidence_accepted" else 50.0,
                             verification_status=st, reviewed_by=ans.reviewed_by, reviewed_at=ans.reviewed_at))
    elif val("cs_netzero") == "no":
        ans = by_q["cs_netzero"]
        q = questionnaire.BY_ID["cs_netzero"]
        db.add(point(ans, q, status=_STATUS_FOR.get(ans.evidence_status, "company_declared"),
                     metric_key="negative.ghg_target", category="climate", kind="signal",
                     fiscal_year=a.fiscal_year, value_text="explicit_no"))
    if val("cs_near_pct") and val("cs_near_year"):
        st = tstatus("cs_near_pct", "cs_near_year")
        ans = by_q["cs_near_pct"]
        db.add(ClimateTarget(company_id=a.company_id, assessment_id=a.id, document_id=ans.evidence_document_id,
                             channel="company", target_kind="ghg_reduction", horizon="near_term",
                             description=f"{val('cs_near_pct'):g}% reduction by {val('cs_near_year')} "
                                         f"(company submission)",
                             scope_coverage=scopes, commitment_class="FORMAL_TARGET", validation_status=validation,
                             reduction_pct=val("cs_near_pct"), target_year=val("cs_near_year"),
                             baseline_year=val("cs_baseline_year"), fiscal_year=a.fiscal_year,
                             quote=ans.source_declaration, confidence=90.0 if st == "evidence_accepted" else 50.0,
                             verification_status=st, reviewed_by=ans.reviewed_by, reviewed_at=ans.reviewed_at))
    db.flush()
    return counts
