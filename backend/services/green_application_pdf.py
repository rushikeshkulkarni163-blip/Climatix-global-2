"""
Climactix Green Production — Certification Review PDF Generator v1.0

Three institutional-grade PDF documents for the certification review
Download Center: submission summary, review report, and the final
certificate. Styled to DESIGN.md v4.0 (white surfaces, NASA Blue accent,
Helvetica) rather than the retired dark v1-v3 palette used by the
existing reportlab builders in backend/main.py, whose SimpleDocTemplate/
Paragraph/Table pattern this module otherwise follows exactly.

Proprietary IP of Climactix Global. All rights reserved.
"""

from __future__ import annotations
import io
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, HRFlowable, Table, TableStyle, Image,
)
from reportlab.lib.enums import TA_CENTER

from services import green_certification_engine as certification
from services.green_application_engine import STAGE_LABELS

NASA_BLUE = colors.HexColor("#0B3D91")
INK = colors.HexColor("#111111")
MUTED = colors.HexColor("#6B7280")
BORDER = colors.HexColor("#D9D9D9")
SUCCESS = colors.HexColor("#1E8E3E")
WARNING = colors.HexColor("#B45309")
CRITICAL = colors.HexColor("#DC2626")
SURFACE = colors.HexColor("#FAFAFA")

_STATUS_COLOR = {
    "certified": SUCCESS, "approved": SUCCESS, "approved_with_conditions": WARNING,
    "rejected": CRITICAL, "more_info_required": WARNING,
}


def _styles():
    styles = getSampleStyleSheet()
    return {
        "h1": ParagraphStyle("H1", fontName="Helvetica-Bold", fontSize=20, textColor=NASA_BLUE, spaceAfter=4),
        "h2": ParagraphStyle("H2", fontName="Helvetica-Bold", fontSize=13, textColor=NASA_BLUE, spaceBefore=14, spaceAfter=6),
        "body": ParagraphStyle("Body", fontName="Helvetica", fontSize=9.5, textColor=INK, leading=13),
        "muted": ParagraphStyle("Muted", fontName="Helvetica", fontSize=9, textColor=MUTED),
        "center": ParagraphStyle("Center", fontName="Helvetica", fontSize=10, textColor=INK, alignment=TA_CENTER),
    }


def _doc(buf: io.BytesIO) -> SimpleDocTemplate:
    return SimpleDocTemplate(buf, pagesize=A4, topMargin=20 * mm, bottomMargin=18 * mm, leftMargin=22 * mm, rightMargin=22 * mm)


def _header(flow: list, s: dict, title: str, app: dict) -> None:
    flow.append(Paragraph("CLIMACTIX GLOBAL — Green Production Certification", s["muted"]))
    flow.append(Paragraph(title, s["h1"]))
    flow.append(HRFlowable(width="100%", color=BORDER, thickness=1, spaceAfter=10))
    meta = [
        ["Application ID", app["application_number"]],
        ["Production", f"{app['production_name']} — {app['production_company']}"],
        ["Status", app["status"].replace("_", " ").title()],
        ["Current Stage", STAGE_LABELS.get(app["current_stage"], app["current_stage"])],
    ]
    t = Table(meta, colWidths=[42 * mm, 118 * mm])
    t.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9.5),
        ("TEXTCOLOR", (0, 0), (0, -1), MUTED),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    flow.append(t)
    flow.append(Spacer(1, 10))


# ── 1. Submission summary ────────────────────────────────────────────────────

def build_submission_summary_pdf(app: dict) -> bytes:
    buf = io.BytesIO()
    doc = _doc(buf)
    s = _styles()
    flow: list = []
    _header(flow, s, "Submission Summary", app)

    flow.append(Paragraph("Score & Expected Rating", s["h2"]))
    score_tbl = Table([
        ["Green Production Score", str(app.get("score") or "—")],
        ["Expected Certification Level", app.get("expected_level_label") or "—"],
        ["Submitted", app["submitted_at"].strftime("%d %b %Y, %H:%M UTC") if app.get("submitted_at") else "—"],
        ["Estimated Review Time", "5–10 business days"],
    ], colWidths=[70 * mm, 90 * mm])
    score_tbl.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"), ("FONTSIZE", (0, 0), (-1, -1), 9.5),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER), ("BACKGROUND", (0, 0), (0, -1), SURFACE),
        ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    flow.append(score_tbl)

    flow.append(Paragraph("Mandatory Criteria (at submission)", s["h2"]))
    criteria = app.get("mandatory_criteria_snapshot") or []
    if criteria:
        rows = [["Criterion", "Status"]] + [
            [c["criterion"].replace("_", " ").title(), "Passed" if c.get("passed") else "Not met"] for c in criteria
        ]
        ct = Table(rows, colWidths=[120 * mm, 40 * mm])
        ct.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.5, BORDER), ("BACKGROUND", (0, 0), (-1, 0), SURFACE),
            ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        flow.append(ct)
    else:
        flow.append(Paragraph("No mandatory-criteria snapshot recorded.", s["muted"]))

    flow.append(Paragraph("Sustainability Questionnaire (locked at submission)", s["h2"]))
    q_snapshot = app.get("questionnaire_snapshot") or {}
    if q_snapshot:
        rows = [["Dimension", "Question", "Response"]]
        for q in sorted(q_snapshot.values(), key=lambda x: x.get("dimension") or ""):
            resp = q.get("response")
            rows.append([q.get("dimension", "—").title(), Paragraph(q.get("questionText", ""), s["body"]),
                         Paragraph(str(resp) if resp is not None else "—", s["body"])])
        qt = Table(rows, colWidths=[26 * mm, 90 * mm, 44 * mm], repeatRows=1)
        qt.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("FONTSIZE", (0, 0), (-1, 0), 9),
            ("GRID", (0, 0), (-1, -1), 0.5, BORDER), ("BACKGROUND", (0, 0), (-1, 0), SURFACE),
            ("VALIGN", (0, 0), (-1, -1), "TOP"), ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        flow.append(qt)
    else:
        flow.append(Paragraph("No questionnaire responses recorded at submission.", s["muted"]))

    doc.build(flow)
    return buf.getvalue()


# ── 2. Review report ────────────────────────────────────────────────────────

def build_review_report_pdf(app: dict) -> bytes:
    buf = io.BytesIO()
    doc = _doc(buf)
    s = _styles()
    flow: list = []
    _header(flow, s, "Review Report", app)

    flow.append(Paragraph("Reviewer", s["h2"]))
    flow.append(Paragraph(app.get("reviewer_name") or "Pending Assignment", s["body"]))

    flow.append(Paragraph("Required Documents", s["h2"]))
    docs = app.get("requiredDocuments") or []
    if docs:
        rows = [["Description", "Status", "Deadline"]] + [
            [d["description"], d["status"].title(), str(d["deadline"] or "—")] for d in docs
        ]
        dt = Table(rows, colWidths=[100 * mm, 30 * mm, 30 * mm])
        dt.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.5, BORDER), ("BACKGROUND", (0, 0), (-1, 0), SURFACE),
            ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        flow.append(dt)
    else:
        flow.append(Paragraph("No documents were requested during this review.", s["muted"]))

    flow.append(Paragraph("Activity & Decision Timeline", s["h2"]))
    events = app.get("events") or []
    rows = [["Date", "Event", "Actor", "Detail"]]
    for e in events:
        rows.append([
            e["created_at"].strftime("%d %b %Y %H:%M") if hasattr(e["created_at"], "strftime") else str(e["created_at"]),
            e["event_type"].replace("_", " ").title(), e.get("actor") or "—",
            Paragraph((e.get("comment") or (e.get("to_value") or "")), s["body"]),
        ])
    et = Table(rows, colWidths=[28 * mm, 34 * mm, 26 * mm, 72 * mm], repeatRows=1)
    et.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("FONTSIZE", (0, 1), (-1, -1), 8.5),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER), ("BACKGROUND", (0, 0), (-1, 0), SURFACE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"), ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    flow.append(et)

    if app.get("decided_at"):
        flow.append(Paragraph("Final Decision", s["h2"]))
        color = _STATUS_COLOR.get(app["status"], INK)
        decision_style = ParagraphStyle("Decision", fontName="Helvetica-Bold", fontSize=12, textColor=color)
        flow.append(Paragraph(app["status"].replace("_", " ").title(), decision_style))
        flow.append(Paragraph(f"Decided {app['decided_at'].strftime('%d %b %Y')}", s["muted"]))

    doc.build(flow)
    return buf.getvalue()


# ── 3. Certificate ───────────────────────────────────────────────────────────

def build_certificate_pdf(app: dict, certificate_number: str, level_label: str, score: float,
                           issued_at, expires_at) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=30 * mm, bottomMargin=30 * mm, leftMargin=26 * mm, rightMargin=26 * mm)
    s = _styles()
    flow: list = []

    title_style = ParagraphStyle("CertTitle", fontName="Helvetica-Bold", fontSize=24, textColor=NASA_BLUE, alignment=TA_CENTER, spaceAfter=6)
    sub_style = ParagraphStyle("CertSub", fontName="Helvetica", fontSize=11, textColor=MUTED, alignment=TA_CENTER, spaceAfter=18)
    name_style = ParagraphStyle("CertName", fontName="Helvetica-Bold", fontSize=18, textColor=INK, alignment=TA_CENTER, spaceAfter=4)
    level_style = ParagraphStyle("CertLevel", fontName="Helvetica-Bold", fontSize=16, textColor=SUCCESS, alignment=TA_CENTER, spaceAfter=18)

    flow.append(Paragraph("CLIMACTIX GLOBAL", sub_style))
    flow.append(Paragraph("Certificate of Green Production Certification", title_style))
    flow.append(HRFlowable(width="60%", color=NASA_BLUE, thickness=1.5, hAlign="CENTER", spaceAfter=18))
    flow.append(Paragraph("This certifies that", s["center"]))
    flow.append(Spacer(1, 6))
    flow.append(Paragraph(app["production_name"], name_style))
    flow.append(Paragraph(app["production_company"], s["center"]))
    flow.append(Spacer(1, 14))
    flow.append(Paragraph(f"has achieved {level_label} Certification", s["center"]))
    flow.append(Paragraph(f"Green Production Score: {score}", level_style))

    qr_bytes = certification.qr_png_bytes(certification.verify_url(certificate_number))
    qr_img = Image(io.BytesIO(qr_bytes), width=32 * mm, height=32 * mm)
    qr_img.hAlign = "CENTER"
    flow.append(qr_img)
    flow.append(Spacer(1, 10))

    meta = [
        ["Certificate Number", certificate_number],
        ["Issued", issued_at.strftime("%d %b %Y") if hasattr(issued_at, "strftime") else str(issued_at)],
        ["Expires", expires_at.strftime("%d %b %Y") if hasattr(expires_at, "strftime") else str(expires_at)],
        ["Issued By", "Climactix Global Review Board"],
        ["Verify", certification.verify_url(certificate_number)],
    ]
    mt = Table(meta, colWidths=[44 * mm, 106 * mm])
    mt.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"), ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9), ("TEXTCOLOR", (0, 0), (0, -1), MUTED),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    flow.append(mt)
    flow.append(Spacer(1, 16))
    flow.append(Paragraph(
        "This certificate is cryptographically signed (HMAC-SHA256) and independently verifiable "
        "at the URL above. Approved by internal Climactix Global review — not self-issued.",
        s["muted"],
    ))

    doc.build(flow)
    return buf.getvalue()
