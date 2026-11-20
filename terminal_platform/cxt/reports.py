"""
Net Zero intelligence view and the generated company intelligence report.

Both are built on request from the data stored for the company at that
moment. Four things are kept visibly apart in the Net Zero view:

  declared    what the company says its targets are
  validated   what the source says about third-party validation (a statement
              found in the company's documents, not a Climactix endorsement)
  actual      emissions the company has reported, by period
  modelled    the straight-line path implied by a quantified target — a
              reference line, labelled as modelled, never a forecast

Progress is only assessed where a baseline value, a later reported value and
a quantified target all exist. Otherwise the view says what is missing.
"""

from __future__ import annotations

import io
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import assessment, audit, storage, views
from .models import ClimateTarget, Company, Document, GeneratedReport, MethodologyVersion
from .pipeline import CATEGORY_LABELS
from .util import fy_label, sha256_hex

S2_ORDER = ("scope2_market", "scope2_location", "scope2_emissions")


def net_zero_view(db: Session, company: Company, include_company: bool = False) -> dict:
    stmt = select(ClimateTarget, Document).outerjoin(Document, Document.id == ClimateTarget.document_id).where(
        ClimateTarget.company_id == company.id,
        ClimateTarget.verification_status.in_(("extracted", "verified", "evidence_accepted")))
    if not include_company:
        stmt = stmt.where(ClimateTarget.channel == "public", Document.visibility == "public")
    seen, targets = set(), []
    for t, d in db.execute(stmt.order_by(ClimateTarget.fiscal_year.desc().nulls_last(),
                                         ClimateTarget.confidence.desc())).all():
        k = (t.target_kind, t.target_year, t.reduction_pct, t.channel)
        if k not in seen:
            seen.add(k)
            targets.append(views.target_out(t, d))

    series = views.metric_series(views.usable_points(db, company.id, include_company=include_company))

    def vals(key: str) -> dict[int, dict]:
        return {int(y): v for y, v in series.get(key, {}).get("values", {}).items()}

    s1, s3, rev = vals("scope1_emissions"), vals("scope3_emissions"), vals("revenue")
    s2_key = next((k for k in S2_ORDER if vals(k)), None)
    s2 = vals(s2_key) if s2_key else {}
    s12_direct = vals("scope1_2_emissions")
    years = sorted(set(s1) | set(s2) | set(s3) | set(s12_direct))
    actual = []
    for y in years:
        s12 = (s1[y]["value"] + s2[y]["value"]) if y in s1 and y in s2 else (s12_direct[y]["value"] if y in s12_direct else None)
        row = {"fiscal_year": y, "fy_label": fy_label(y),
               "scope1": s1.get(y, {}).get("value"), "scope2": s2.get(y, {}).get("value"),
               "scope3": s3.get(y, {}).get("value"), "scope1_2": s12, "unit": "tCO2e",
               "sources": [v["data_point_id"] for v in (s1.get(y), s2.get(y), s3.get(y)) if v]}
        if s12 is not None and y in rev and rev[y]["value"] > 0:
            row["intensity"] = s12 / (rev[y]["value"] / 1e7)
            row["intensity_unit"] = f"tCO2e per {rev[y]['unit']} crore"
        actual.append(row)
    s12_by_year = {r["fiscal_year"]: r["scope1_2"] for r in actual if r["scope1_2"] is not None}

    nz = next((t for t in targets if t["target_kind"] in ("net_zero", "carbon_neutral") and t["target_year"]), None)
    quantified = [t for t in targets if t["target_kind"] == "ghg_reduction" and t["reduction_pct"] and t["target_year"]]
    near = min(quantified, key=lambda t: t["target_year"]) if quantified else None
    long_term = max(quantified, key=lambda t: t["target_year"]) if len(quantified) > 1 else None
    base_year = next((t["baseline_year"] for t in [near, long_term, nz] if t and t["baseline_year"]), None)

    modelled, progress = [], {"assessable": False}
    missing = []
    if not targets:
        missing.append("No emissions target was found in the documents assessed")
    if targets and not near:
        missing.append("No quantified reduction target with a target year")
    if near and not base_year:
        missing.append("The target does not state a baseline year")
    if base_year and base_year not in s12_by_year:
        missing.append(f"Scope 1 and 2 emissions for the baseline year ({base_year}) are not in the documents assessed")
    if not s12_by_year:
        missing.append("No reported Scope 1 and 2 emissions")
    if near and base_year and base_year in s12_by_year:
        base = s12_by_year[base_year]
        end = base * (1 - near["reduction_pct"] / 100)
        modelled = [{"fiscal_year": y, "value": round(base + (end - base) * (y - base_year) / (near["target_year"] - base_year), 1)}
                    for y in range(base_year, near["target_year"] + 1)] if near["target_year"] > base_year else []
        later = [y for y in s12_by_year if y > base_year]
        if later and modelled:
            latest = max(later)
            achieved = 100 * (base - s12_by_year[latest]) / base
            required = near["reduction_pct"] * min(1.0, (latest - base_year) / (near["target_year"] - base_year))
            progress = {"assessable": True, "baseline_year": base_year, "baseline_value": base, "latest_year": latest,
                        "latest_value": s12_by_year[latest], "reported_reduction_pct": round(achieved, 1),
                        "reduction_required_by_now_pct": round(required, 1),
                        "target_reduction_pct": near["reduction_pct"], "target_year": near["target_year"],
                        "position": "ahead of" if achieved >= required else "behind",
                        "statement": f"Reported Scope 1 and 2 emissions are {abs(achieved):.1f}% "
                                     f"{'below' if achieved >= 0 else 'above'} the {base_year} baseline in FY{latest}; "
                                     f"the straight-line path to the stated target implies {required:.1f}% by then.",
                        "basis": "Company-reported emissions compared with a straight-line path to the declared "
                                 "target. This is arithmetic on reported figures, not a forecast or an assurance "
                                 "opinion."}
        else:
            missing.append("No reported emissions after the baseline year")
    if not progress["assessable"]:
        progress["reason"] = "Progress cannot be assessed: " + "; ".join(missing or ["insufficient evidence"]) + "."

    reported_change = None
    if len(s12_by_year) >= 2:
        a, b = min(s12_by_year), max(s12_by_year)
        reported_change = {"from_year": a, "to_year": b,
                           "change_pct": round(100 * (s12_by_year[b] - s12_by_year[a]) / s12_by_year[a], 1)}

    scopes = sorted({s for t in targets for s in (t["scope_coverage"] or [])})
    return {
        "company": views.company_brief(company),
        "summary": {
            "net_zero_target": bool(nz), "net_zero_year": nz["target_year"] if nz else None,
            "baseline_year": base_year,
            "near_term": None if not near else {"reduction_pct": near["reduction_pct"], "target_year": near["target_year"]},
            "long_term": None if not long_term else {"reduction_pct": long_term["reduction_pct"],
                                                     "target_year": long_term["target_year"]},
            "scope_coverage": {"scope1": any("1" in s for s in scopes), "scope2": any("2" in s for s in scopes),
                               "scope3": any("3" in s for s in scopes)},
            "validation_status": nz["validation_status"] if nz else (near["validation_status"] if near else None),
            "baseline_emissions": s12_by_year.get(base_year) if base_year else None,
            "latest_emissions": s12_by_year[max(s12_by_year)] if s12_by_year else None,
            "latest_emissions_year": max(s12_by_year) if s12_by_year else None,
            "latest_intensity": next((r.get("intensity") for r in reversed(actual) if r.get("intensity")), None),
            "reported_change": reported_change, "scope2_basis": s2_key,
        },
        "declared_targets": targets,
        "validated_targets": [t for t in targets if t["validation_status"] == "validated_third_party"],
        "actual_emissions": actual,
        "modelled_trajectory": {"points": modelled,
                                "label": "Straight-line path implied by the declared near-term target (modelled)"}
        if modelled else None,
        "progress": progress,
        "notes": ["Declared targets are statements made by the company.",
                  "'Validated' reflects what the company's documents state about third-party validation; "
                  "Climactix has not validated the target.",
                  "Actual emissions are as reported by the company for each period."],
    }


# ── PDF report ───────────────────────────────────────────────────────────────

NAVY, BLUE, GREY, RULE = colors.HexColor("#0B1F3A"), colors.HexColor("#1D4FD8"), colors.HexColor("#4A5B73"), colors.HexColor("#DFE3EA")
H1 = ParagraphStyle("h1", fontName="Helvetica-Bold", fontSize=20, leading=24, textColor=NAVY, spaceAfter=4)
H2 = ParagraphStyle("h2", fontName="Helvetica-Bold", fontSize=12.5, leading=16, textColor=NAVY, spaceBefore=14, spaceAfter=6)
BODY = ParagraphStyle("body", fontName="Times-Roman", fontSize=10, leading=14, textColor=NAVY, alignment=TA_LEFT)
SMALL = ParagraphStyle("small", fontName="Helvetica", fontSize=8, leading=11, textColor=GREY)
CELL = ParagraphStyle("cell", fontName="Helvetica", fontSize=8.5, leading=11, textColor=NAVY)
CELLB = ParagraphStyle("cellb", parent=CELL, fontName="Helvetica-Bold")


def _esc(x: Any) -> str:
    return str(x).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _tbl(rows: list[list[Any]], widths: list[float], header: bool = True) -> Table:
    data = [[c if isinstance(c, Paragraph) else Paragraph(_esc(c), CELLB if header and i == 0 else CELL) for c in r]
            for i, r in enumerate(rows)]
    t = Table(data, colWidths=[w * mm for w in widths], repeatRows=1 if header else 0)
    style = [("VALIGN", (0, 0), (-1, -1), "TOP"), ("LINEBELOW", (0, 0), (-1, -1), 0.4, RULE),
             ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
             ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 4)]
    if header:
        style += [("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F3F5F8")), ("LINEBELOW", (0, 0), (-1, 0), 0.8, NAVY)]
    t.setStyle(TableStyle(style))
    return t


def _num(x: Optional[float], digits: int = 1) -> str:
    return "—" if x is None else f"{x:,.{digits}f}"


def _score_block(title: str, s: Optional[dict]) -> list:
    if not s:
        return [Paragraph(title, H2), Paragraph("No score has been generated.", BODY)]
    r = s["result"]
    out = [Paragraph(title, H2)]
    overall = "Withheld — insufficient evidence" if s["overall"] is None else f"{s['overall']:.1f} / 100"
    out.append(_tbl([["Measure", "Value", "Basis"],
                     ["Climactix Score", overall, _esc(r["summary"])],
                     ["Data Confidence Score", f"{s['confidence']:.1f} / 100 ({r['confidence']['band']})",
                      f"Coverage {r['confidence']['components']['coverage']:.0f}, verification "
                      f"{r['confidence']['components']['verification']:.0f}, extraction reliability "
                      f"{r['confidence']['components']['extraction']:.0f}, recency "
                      f"{r['confidence']['components']['recency']:.0f}"],
                     ["Methodology", f"Version {s['methodology_version']} · engine {s['engine_version']}",
                      f"Computed {s['computed_at']:%d %b %Y}; latest evidence {s['fy_label'] or 'n/a'}"]],
                    [38, 42, 95]))
    out.append(Spacer(1, 6))
    rows = [["Pillar", "Weight", "Score", "Evidenced", "Deductions"]]
    for p in r["pillars"]:
        rows.append([p["name"], f"{p['weight']:.0f}%", "Insufficient evidence" if p["score"] is None else f"{p['score']:.1f}",
                     f"{p['indicator_coverage']:.0f}%",
                     "; ".join(f"−{d['points']:.0f} {d['reason']}" for d in p["deductions"]) or "—"])
    out.append(_tbl(rows, [52, 16, 30, 20, 57]))
    return out


def build_pdf(data: dict) -> bytes:
    c = data["company"]
    buf = io.BytesIO()
    generated = data["generated_at"]

    def footer(canvas, doc):
        canvas.saveState()
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(GREY)
        canvas.drawString(18 * mm, 10 * mm, f"Climactix Terminal · {c['legal_name']} ({c['cx_id']}) · generated "
                                            f"{generated:%d %b %Y %H:%M} UTC · report {data['report_id'][:8]}")
        canvas.drawRightString(192 * mm, 10 * mm, f"Page {doc.page}")
        canvas.restoreState()

    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=18 * mm,
                            bottomMargin=18 * mm, title=f"{c['legal_name']} — Sustainability Intelligence Report",
                            author="Climactix Terminal")
    s: list = [Paragraph("Corporate Sustainability Intelligence Report", SMALL),
               Paragraph(_esc(c["legal_name"]), H1),
               Paragraph(_esc(" · ".join(x for x in [c["cx_id"], c.get("sector"), c.get("country"),
                                                     c.get("registration_id")] if x)), SMALL), Spacer(1, 8)]
    if c.get("is_synthetic"):
        s.append(Paragraph("<b>SYNTHETIC ENTITY.</b> This company record and its documents were created for "
                           "demonstration and testing. Nothing in this report describes a real organisation.", BODY))
        s.append(Spacer(1, 6))
    s.append(Paragraph("This report is generated from the documents and data held in the Climactix Terminal for "
                       "this company at the time shown. The Climactix Score is an independent, methodology-based "
                       "assessment of disclosed information. It is not a certification, a credit rating, an "
                       "assurance opinion or investment advice.", BODY))

    s += _score_block("1. Public Data Score", data["public_score"])
    if data.get("company_score"):
        s += _score_block("2. Company Assessment Score (includes reviewed company submissions)", data["company_score"])
    b = data["benchmark"]
    s.append(Paragraph("Sector benchmark", H2))
    if b.get("available"):
        s.append(Paragraph(_esc(f"{b['sector']}: {b['companies_scored']} companies scored. Median {b['median']}, "
                                f"interquartile range {b['p25']}–{b['p75']}."
                                + (f" This company scores above {b['percentile']}% of them." if b.get("percentile") is not None else "")), BODY))
    else:
        s.append(Paragraph(_esc(f"Not available: {b.get('reason')}."), BODY))

    ps = data["public_score"]
    if ps:
        r = ps["result"]
        s.append(Paragraph("Key strengths", H2))
        s.append(_tbl([["Indicator", "Score", "Finding"]] + [[x["indicator"], f"{x['score']:.0f}", x["explanation"]]
                                                           for x in r["strengths"]], [62, 16, 97])
                 if r["strengths"] else Paragraph("None identified from the evidence available.", BODY))
        s.append(Paragraph("Improvement areas", H2))
        s.append(_tbl([["Indicator", "Score", "Finding"]] + [[x["indicator"], f"{x['score']:.0f}", x["explanation"]]
                                                           for x in r["improvements"]], [62, 16, 97])
                 if r["improvements"] else Paragraph("None identified from the evidence available.", BODY))
        s.append(Paragraph("Reasons for score deductions", H2))
        s.append(_tbl([["Pillar", "Points", "Reason"]] + [[d["pillar"], f"−{d['points']:.0f}", d["reason"]]
                                                        for d in r["deductions"]], [52, 16, 107])
                 if r["deductions"] else Paragraph("No deductions were applied.", BODY))
        s.append(Paragraph("Indicators that could not be scored", H2))
        s.append(Paragraph("These are excluded from the score and reduce Data Confidence. They are not treated as "
                           "poor performance.", SMALL))
        s.append(_tbl([["Indicator", "Status", "Reason"]] + [[g["indicator"], g["classification"], g["explanation"]]
                                                           for g in r["gaps"]], [56, 34, 85])
                 if r["gaps"] else Paragraph("Every indicator was scored.", BODY))
        s.append(PageBreak())
        s.append(Paragraph("Indicator detail", H2))
        rows = [["Pillar / indicator", "Score", "Classification", "Finding"]]
        for p in r["pillars"]:
            rows.append([Paragraph(f"<b>{_esc(p['name'])}</b>", CELL), "" if p["score"] is None else f"{p['score']:.1f}", "", ""])
            for i in p["indicators"]:
                rows.append([i["name"], "—" if i["score"] is None else f"{i['score']:.0f}", i["classification"],
                             i["explanation"]])
        s.append(_tbl(rows, [54, 14, 36, 71]))

    nz = data["net_zero"]
    s.append(Paragraph("Net Zero and climate targets", H2))
    if nz["declared_targets"]:
        s.append(_tbl([["Target", "Year", "Baseline", "Scopes", "Status per source", "Source"]] + [
            [t["description"][:140], t["target_year"] or "—", t["baseline_year"] or "—",
             ", ".join(t["scope_coverage"]) or "not stated", t["validation_status"].replace("_", " "),
             f"{(t['provenance']['document_title'] or 'Company submission')[:40]}"
             + (f", p.{t['provenance']['page_no']}" if t["provenance"]["page_no"] else "")]
            for t in nz["declared_targets"][:10]], [62, 14, 18, 24, 27, 30]))
    else:
        s.append(Paragraph("No emissions target was found in the documents assessed.", BODY))
    s.append(Spacer(1, 4))
    pr = nz["progress"]
    s.append(Paragraph(_esc(pr["statement"] + " " + pr["basis"] if pr["assessable"] else pr["reason"]), BODY))

    s.append(Paragraph("Reported emissions", H2))
    if nz["actual_emissions"]:
        s.append(_tbl([["Period", "Scope 1 (tCO2e)", "Scope 2 (tCO2e)", "Scope 3 (tCO2e)", "Intensity"]] + [
            [r["fy_label"], _num(r["scope1"], 0), _num(r["scope2"], 0), _num(r["scope3"], 0),
             f"{r['intensity']:.2f} {r['intensity_unit']}" if r.get("intensity") else "—"]
            for r in nz["actual_emissions"]], [28, 34, 34, 34, 45]))
    else:
        s.append(Paragraph("No emissions figures were found in the documents assessed.", BODY))

    s.append(Paragraph("Environmental, social, governance and financial data", H2))
    yrs = data["years"][:3]
    if data["metrics"] and yrs:
        rows = [["Metric", "Unit"] + [fy_label(y) for y in yrs]]
        for m in data["metrics"]:
            if any(str(y) in m["values"] for y in yrs):
                rows.append([m["name"], m["unit"] or ""] + [_num(m["values"][str(y)]["value"], 1) if str(y) in m["values"]
                                                            else "—" for y in yrs])
        s.append(_tbl(rows, [70, 24] + [27] * len(yrs)))
    else:
        s.append(Paragraph("No quantitative disclosures are held for this company.", BODY))

    s.append(Paragraph("Evidence repository", H2))
    if data["documents"]:
        s.append(_tbl([["Period", "Document", "Type", "Source", "Extraction"]] + [
            [d["fy_label"] or "—", d["title"][:70], d["category_label"],
             (d["source_url"] or d["source_type"].replace("_", " "))[:60],
             f"{d['extraction_confidence']:.0f}" if d["extraction_confidence"] is not None else "—"]
            for d in data["documents"][:40]], [22, 60, 34, 42, 17]))
    else:
        s.append(Paragraph("No documents are held for this company.", BODY))
    s.append(Spacer(1, 10))
    s.append(Paragraph("Method. Scores are computed by the Climactix scoring engine from the evidence listed, using "
                       "the methodology version shown. Each score is stored with the evidence snapshot it used and "
                       "can be reproduced. Figures are as reported by the company; where a figure was read "
                       "automatically from a document and not yet confirmed by a reviewer, it lowers the Data "
                       "Confidence Score. Payment by any party does not influence a score.", SMALL))
    doc.build(s, onFirstPage=footer, onLaterPages=footer)
    return buf.getvalue()


def generate(db: Session, actor: Any, company: Company, include_private: bool = False) -> GeneratedReport:
    versions = {m.id: m.version for m in db.execute(select(MethodologyVersion)).scalars()}
    pub = assessment.current_score(db, company.id, "public")
    co = assessment.current_score(db, company.id, "company") if include_private else None
    series = views.metric_series(views.usable_points(db, company.id, include_company=include_private))
    docs = db.execute(select(Document).where(Document.company_id == company.id, Document.status == "completed")
                      .order_by(Document.fiscal_year.desc().nulls_last(), Document.category)).scalars().all()
    docs = [d for d in docs if d.visibility == "public" or include_private]
    years = sorted({int(y) for m in series.values() for y in m["values"]}, reverse=True)
    report_id = uuid.uuid4()
    data = {"report_id": str(report_id), "generated_at": datetime.now(timezone.utc),
            "company": views.company_full(company),
            "public_score": views.score_out(pub, versions.get(pub.methodology_version_id)) if pub else None,
            "company_score": views.score_out(co, versions.get(co.methodology_version_id)) if co else None,
            "benchmark": assessment.sector_benchmark(db, company),
            "net_zero": net_zero_view(db, company, include_company=include_private),
            "metrics": sorted(series.values(), key=lambda m: (m["category"], m["name"])), "years": years,
            "documents": [views.document_out(d) for d in docs]}
    pdf = build_pdf(data)
    key = storage.report_key(str(company.id), str(report_id))
    storage.get_store().put(key, pdf)
    rec = GeneratedReport(id=report_id, company_id=company.id, generated_by=actor.user_id,
                          organisation_id=actor.org_id, score_id=pub.id if pub else None, storage_key=key,
                          sha256=sha256_hex(pdf), size_bytes=len(pdf), includes_private=include_private)
    db.add(rec)
    db.flush()
    audit.record(db, actor, "report.generate", entity_type="report", entity_id=rec.id, company_id=company.id,
                 detail={"sha256": rec.sha256, "includes_company_assessment": include_private,
                         "public_score_id": str(pub.id) if pub else None})
    return rec
