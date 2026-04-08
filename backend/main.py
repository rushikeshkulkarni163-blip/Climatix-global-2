"""
Climactix AI — FastAPI Backend
===============================
Endpoints:
  GET  /health              Health check
  POST /api/upload          Upload PDF / DOCX / XLSX → extracted text
  POST /api/generate        ESG text → full narratives + scores
  POST /api/export/pdf      Narratives → PDF bytes (server-side)
  POST /api/export/docx     Narratives → DOCX bytes

Start:
  uvicorn main:app --reload --port 8000
"""

import io
import json
import os
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

load_dotenv()

from services.extractor import extract_text
from services.ai_engine import generate_all_narratives
from services.scorer import calculate_scores

# ── App init ──────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Climactix AI API",
    description="ESG Narrative Engine — powered by Claude",
    version="1.0.0",
)

cors_origins = os.getenv("CORS_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / Response models ─────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    text: str
    company_name: Optional[str] = "The Company"
    report_year: Optional[str] = "2024"


class ExportRequest(BaseModel):
    narratives: dict
    scores: dict
    company_name: Optional[str] = "The Company"
    report_year: Optional[str] = "2024"


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "Climactix AI API", "version": "1.0.0"}


@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    """Accept a PDF / DOCX / XLSX file and return extracted plain text."""
    MAX_SIZE = 10 * 1024 * 1024  # 10 MB

    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="File exceeds 10 MB limit.")

    try:
        text = extract_text(content, file.filename or "", file.content_type or "")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    word_count = len(text.split())
    return {
        "success": True,
        "filename": file.filename,
        "word_count": word_count,
        "char_count": len(text),
        "text": text,
    }


@app.post("/api/generate")
def generate(req: GenerateRequest):
    """Generate all ESG narratives + scores from raw text."""
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="No ESG text provided.")

    try:
        narratives = generate_all_narratives(req.text, req.company_name or "The Company")
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")

    scores = calculate_scores(req.text, narratives)

    return {
        "success": True,
        "company_name": req.company_name,
        "report_year": req.report_year,
        "narratives": narratives,
        "scores": scores,
    }


@app.post("/api/export/pdf")
def export_pdf(req: ExportRequest):
    """Generate a styled PDF report from the narratives dict."""
    try:
        pdf_bytes = _build_pdf(req)
    except ImportError:
        raise HTTPException(status_code=500, detail="reportlab not installed. Run: pip install reportlab")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")

    filename = f"climactix-esg-report-{req.company_name.replace(' ', '-').lower()}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.post("/api/export/docx")
def export_docx(req: ExportRequest):
    """Generate a DOCX report from the narratives dict."""
    try:
        docx_bytes = _build_docx(req)
    except ImportError:
        raise HTTPException(status_code=500, detail="python-docx not installed. Run: pip install python-docx")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DOCX generation failed: {str(e)}")

    filename = f"climactix-esg-report-{req.company_name.replace(' ', '-').lower()}.docx"
    return Response(
        content=docx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── PDF builder ───────────────────────────────────────────────────────────────

def _build_pdf(req: ExportRequest) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, HRFlowable, Table, TableStyle
    )

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        topMargin=20 * mm, bottomMargin=20 * mm,
        leftMargin=22 * mm, rightMargin=22 * mm,
    )

    # Colours
    forest = colors.HexColor("#2d5a3d")
    ink    = colors.HexColor("#1a1a14")
    muted  = colors.HexColor("#7a7a68")
    cream  = colors.HexColor("#f5f2eb")

    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("H1", parent=styles["Heading1"],
                         fontName="Helvetica-Bold", fontSize=22,
                         textColor=forest, spaceAfter=6)
    h2 = ParagraphStyle("H2", parent=styles["Heading2"],
                         fontName="Helvetica-Bold", fontSize=14,
                         textColor=forest, spaceBefore=14, spaceAfter=4)
    h3 = ParagraphStyle("H3", parent=styles["Heading3"],
                         fontName="Helvetica-Bold", fontSize=11,
                         textColor=ink, spaceBefore=10, spaceAfter=3)
    body = ParagraphStyle("Body", parent=styles["Normal"],
                           fontName="Helvetica", fontSize=10,
                           textColor=ink, leading=15, spaceAfter=8)
    meta = ParagraphStyle("Meta", parent=styles["Normal"],
                           fontName="Helvetica", fontSize=9,
                           textColor=muted, spaceAfter=4)

    story = []

    # ── Cover header ──
    story.append(Paragraph("CLIMACTIX AI", ParagraphStyle(
        "Brand", fontName="Helvetica-Bold", fontSize=11,
        textColor=forest, spaceAfter=2,
    )))
    story.append(Paragraph("ESG Narrative Intelligence Report", meta))
    story.append(Spacer(1, 4 * mm))
    story.append(HRFlowable(width="100%", thickness=2, color=forest))
    story.append(Spacer(1, 4 * mm))

    n = req.narratives
    co = req.company_name
    yr = req.report_year

    # ── Title ──
    title = (n.get("esg_summary", {}).get("report_title")
             or f"{co} ESG Report {yr}")
    story.append(Paragraph(title, h1))
    story.append(Paragraph(f"Prepared by Climactix AI · {co} · {yr}", meta))
    story.append(Spacer(1, 6 * mm))

    # ── Scores table ──
    sc = req.scores
    score_data = [
        ["ESG Score", "SDG Alignment", "Readability", "Content Quality"],
        [
            f"{sc.get('esg_score', '--')}/100",
            f"{sc.get('sdg_alignment', '--')}/100",
            f"{sc.get('readability', '--')}/100",
            f"{sc.get('content_quality', '--')}/100",
        ],
    ]
    t = Table(score_data, colWidths=[40 * mm, 45 * mm, 40 * mm, 45 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), forest),
        ("TEXTCOLOR",  (0, 0), (-1, 0), colors.white),
        ("FONTNAME",   (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE",   (0, 0), (-1, 0), 9),
        ("FONTNAME",   (0, 1), (-1, 1), "Helvetica-Bold"),
        ("FONTSIZE",   (0, 1), (-1, 1), 16),
        ("ALIGN",      (0, 0), (-1, -1), "CENTER"),
        ("VALIGN",     (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [cream]),
        ("GRID",       (0, 0), (-1, -1), 0.5, colors.white),
        ("TOPPADDING",    (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("ROUNDEDCORNERS", [4]),
    ]))
    story.append(t)
    story.append(Spacer(1, 8 * mm))

    def _section(title_text: str, content: str):
        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#d0d0c0")))
        story.append(Spacer(1, 2 * mm))
        story.append(Paragraph(title_text, h2))
        for para in content.split("\n\n"):
            para = para.strip()
            if para:
                story.append(Paragraph(para, body))
        story.append(Spacer(1, 4 * mm))

    # ── Investor Brief ──
    ib = n.get("investor_brief", {})
    story.append(Paragraph("1. Investor Brief", h2))
    if ib.get("headline"):
        story.append(Paragraph(f'"{ib["headline"]}"', ParagraphStyle(
            "Quote", fontName="Helvetica-Oblique", fontSize=12,
            textColor=forest, spaceAfter=8, leftIndent=10,
        )))
    if ib.get("executive_summary"):
        story.append(Paragraph(ib["executive_summary"], body))
    if ib.get("key_metrics"):
        story.append(Paragraph("Key Metrics", h3))
        for m in ib["key_metrics"]:
            story.append(Paragraph(f"• {m}", body))
    if ib.get("recommendation"):
        story.append(Spacer(1, 3 * mm))
        story.append(Paragraph(f"Recommendation: {ib['recommendation']}", ParagraphStyle(
            "Rec", fontName="Helvetica-Bold", fontSize=10,
            textColor=forest, spaceAfter=4,
        )))
    story.append(Spacer(1, 6 * mm))

    # ── ESG Summary ──
    es = n.get("esg_summary", {})
    if es.get("executive_summary"):
        _section("2. ESG Executive Summary", es["executive_summary"])

    # ── Marketing Narrative ──
    mn = n.get("marketing_narrative", {})
    if mn.get("story"):
        _section("3. Marketing Narrative", mn["story"])
        if mn.get("tagline"):
            story.append(Paragraph(f'Tagline: "{mn["tagline"]}"', ParagraphStyle(
                "Tag", fontName="Helvetica-Bold", fontSize=11,
                textColor=forest, spaceAfter=4,
            )))
        story.append(Spacer(1, 4 * mm))

    # ── Social Media ──
    sm = n.get("social_media", {})
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#d0d0c0")))
    story.append(Spacer(1, 2 * mm))
    story.append(Paragraph("4. Social Media Content", h2))
    if sm.get("linkedin"):
        story.append(Paragraph("LinkedIn Post", h3))
        story.append(Paragraph(sm["linkedin"], body))
    if sm.get("instagram"):
        story.append(Paragraph("Instagram Caption", h3))
        story.append(Paragraph(sm["instagram"], body))
    story.append(Spacer(1, 6 * mm))

    # ── SDG Mapping ──
    sdg = n.get("sdg_mapping", {})
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#d0d0c0")))
    story.append(Spacer(1, 2 * mm))
    story.append(Paragraph("5. UN SDG Alignment", h2))
    if sdg.get("alignment_summary"):
        story.append(Paragraph(sdg["alignment_summary"], body))
    for sdg_item in sdg.get("top_sdgs", []):
        story.append(Paragraph(
            f'{sdg_item.get("icon", "")} SDG {sdg_item.get("number")} — {sdg_item.get("name")} '
            f'({sdg_item.get("relevance_label", "")})',
            h3,
        ))
        story.append(Paragraph(sdg_item.get("explanation", ""), body))

    # ── Footer ──
    story.append(Spacer(1, 10 * mm))
    story.append(HRFlowable(width="100%", thickness=1, color=forest))
    story.append(Spacer(1, 2 * mm))
    story.append(Paragraph(
        "Generated by Climactix AI · climactixglobal.com · Powered by Claude",
        ParagraphStyle("Footer", fontName="Helvetica", fontSize=8,
                       textColor=muted, alignment=1),
    ))

    doc.build(story)
    return buf.getvalue()


# ── DOCX builder ──────────────────────────────────────────────────────────────

def _build_docx(req: ExportRequest) -> bytes:
    from docx import Document
    from docx.shared import Pt, RGBColor, Inches
    from docx.enum.text import WD_ALIGN_PARAGRAPH

    doc = Document()

    forest_rgb = RGBColor(0x2D, 0x5A, 0x3D)
    ink_rgb    = RGBColor(0x1A, 0x1A, 0x14)

    def heading(text, level=1, color=None):
        p = doc.add_heading(text, level=level)
        if color:
            for run in p.runs:
                run.font.color.rgb = color
        return p

    def body_para(text: str):
        if not text:
            return
        for block in text.split("\n\n"):
            block = block.strip()
            if block:
                p = doc.add_paragraph(block)
                p.paragraph_format.space_after = Pt(8)

    n  = req.narratives
    co = req.company_name
    yr = req.report_year
    sc = req.scores

    # ── Title ──
    title = (n.get("esg_summary", {}).get("report_title")
             or f"{co} ESG Report {yr}")
    heading(title, level=1, color=forest_rgb)
    doc.add_paragraph(f"Climactix AI · {co} · {yr}")
    doc.add_paragraph()

    # ── Scores ──
    heading("ESG Scores", level=2, color=forest_rgb)
    tbl = doc.add_table(rows=2, cols=4)
    tbl.style = "Table Grid"
    headers = ["ESG Score", "SDG Alignment", "Readability", "Content Quality"]
    vals    = [
        f"{sc.get('esg_score', '--')}/100",
        f"{sc.get('sdg_alignment', '--')}/100",
        f"{sc.get('readability', '--')}/100",
        f"{sc.get('content_quality', '--')}/100",
    ]
    for i, h in enumerate(headers):
        tbl.rows[0].cells[i].text = h
    for i, v in enumerate(vals):
        tbl.rows[1].cells[i].text = v
    doc.add_paragraph()

    # ── Investor Brief ──
    ib = n.get("investor_brief", {})
    heading("1. Investor Brief", level=2, color=forest_rgb)
    if ib.get("headline"):
        p = doc.add_paragraph(f'"{ib["headline"]}"')
        p.runs[0].bold = True
    body_para(ib.get("executive_summary", ""))
    if ib.get("key_metrics"):
        heading("Key Metrics", level=3, color=forest_rgb)
        for m in ib["key_metrics"]:
            doc.add_paragraph(m, style="List Bullet")
    if ib.get("risks"):
        heading("Risks", level=3, color=forest_rgb)
        for r in ib["risks"]:
            doc.add_paragraph(r, style="List Bullet")
    if ib.get("opportunities"):
        heading("Opportunities", level=3, color=forest_rgb)
        for o in ib["opportunities"]:
            doc.add_paragraph(o, style="List Bullet")
    if ib.get("recommendation"):
        p = doc.add_paragraph(f"Recommendation: {ib['recommendation']}")
        p.runs[0].bold = True
    doc.add_paragraph()

    # ── ESG Summary ──
    es = n.get("esg_summary", {})
    heading("2. ESG Executive Summary", level=2, color=forest_rgb)
    body_para(es.get("executive_summary", ""))
    doc.add_paragraph()

    # ── Marketing Narrative ──
    mn = n.get("marketing_narrative", {})
    heading("3. Marketing Narrative", level=2, color=forest_rgb)
    if mn.get("headline"):
        p = doc.add_paragraph(mn["headline"])
        p.runs[0].bold = True
    body_para(mn.get("story", ""))
    if mn.get("tagline"):
        p = doc.add_paragraph(f'Tagline: "{mn["tagline"]}"')
        p.runs[0].italic = True
    doc.add_paragraph()

    # ── Social Media ──
    sm = n.get("social_media", {})
    heading("4. Social Media Content", level=2, color=forest_rgb)
    if sm.get("linkedin"):
        heading("LinkedIn Post", level=3, color=forest_rgb)
        body_para(sm["linkedin"])
    if sm.get("twitter_thread"):
        heading("X / Twitter Thread", level=3, color=forest_rgb)
        for tweet in sm["twitter_thread"]:
            doc.add_paragraph(tweet, style="List Bullet")
    if sm.get("instagram"):
        heading("Instagram Caption", level=3, color=forest_rgb)
        body_para(sm["instagram"])
    doc.add_paragraph()

    # ── SDG Mapping ──
    sdg = n.get("sdg_mapping", {})
    heading("5. UN SDG Alignment", level=2, color=forest_rgb)
    body_para(sdg.get("alignment_summary", ""))
    for sdg_item in sdg.get("top_sdgs", []):
        heading(
            f'{sdg_item.get("icon", "")} SDG {sdg_item.get("number")} — {sdg_item.get("name")}',
            level=3, color=forest_rgb,
        )
        body_para(sdg_item.get("explanation", ""))
        if sdg_item.get("evidence"):
            doc.add_paragraph(f"Evidence: {sdg_item['evidence']}", style="List Bullet")
    doc.add_paragraph()

    # ── Footer ──
    doc.add_paragraph("─" * 60)
    footer_p = doc.add_paragraph("Generated by Climactix AI · climactixglobal.com · Powered by Claude")
    footer_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    footer_p.runs[0].font.size = Pt(8)

    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()
