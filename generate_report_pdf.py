"""
Climactix Global — Institutional PDF Report Generator
Generates BSAL_ANALYSIS_REPORT.pdf using ReportLab
Design: Bloomberg Terminal aesthetic — black backgrounds, amber accents, IBM Plex Mono data
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, KeepTogether, Flowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.pdfgen import canvas
from reportlab.platypus import BaseDocTemplate, Frame, PageTemplate
from reportlab.graphics.shapes import Drawing, Rect, String, Line
from reportlab.graphics import renderPDF
import os

# ─────────────────────────────────────────────────────────────────────────────
# COLOR PALETTE — Climactix Design System
# ─────────────────────────────────────────────────────────────────────────────
BLACK       = colors.HexColor('#000000')
SURFACE     = colors.HexColor('#0F0F0F')
SURFACE_2   = colors.HexColor('#1A1A1A')
SURFACE_3   = colors.HexColor('#242424')
SURFACE_4   = colors.HexColor('#2E2E2E')
BORDER      = colors.HexColor('#2C2C2C')
BORDER_STR  = colors.HexColor('#333333')
AMBER       = colors.HexColor('#FF6600')
AMBER_DIM   = colors.HexColor('#CC5200')
CYAN        = colors.HexColor('#0099CC')
WHITE       = colors.HexColor('#FFFFFF')
WHITE_80    = colors.HexColor('#CCCCCC')
WHITE_60    = colors.HexColor('#999999')
WHITE_40    = colors.HexColor('#666666')
RED         = colors.HexColor('#FF3B3B')
RED_DIM     = colors.HexColor('#CC2222')
GREEN       = colors.HexColor('#22C55E')
YELLOW      = colors.HexColor('#F59E0B')

# Rating colors
RATING_COLORS = {
    'AAA': GREEN, 'AA': GREEN, 'A': colors.HexColor('#4ADE80'),
    'BBB': CYAN,
    'BB': YELLOW, 'B': colors.HexColor('#F97316'),
    'CCC': RED, 'D': RED_DIM,
}

PAGE_W, PAGE_H = A4
MARGIN_L = 18*mm
MARGIN_R = 18*mm
MARGIN_T = 15*mm
MARGIN_B = 15*mm
CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R

OUTPUT_PATH = "/Users/rushikeshkulkarni/Desktop/Climatix-global/BSAL_ANALYSIS_REPORT.pdf"


# ─────────────────────────────────────────────────────────────────────────────
# CUSTOM FLOWABLES
# ─────────────────────────────────────────────────────────────────────────────

class ScoreBar(Flowable):
    """Horizontal score bar like a Bloomberg terminal metric bar"""
    def __init__(self, score, max_score=100, width=None, height=6, color=AMBER, label=None):
        Flowable.__init__(self)
        self.score = score
        self.max_score = max_score
        self.bar_width = width or (CONTENT_W * 0.4)
        self.bar_height = height
        self.color = color
        self.label = label
        self.width = self.bar_width
        self.height = height + 2

    def draw(self):
        c = self.canv
        # Background track
        c.setFillColor(SURFACE_3)
        c.setStrokeColor(BORDER)
        c.rect(0, 1, self.bar_width, self.bar_height, fill=1, stroke=0)
        # Filled portion
        fill_w = (self.score / self.max_score) * self.bar_width
        if fill_w > 0:
            c.setFillColor(self.color)
            c.rect(0, 1, fill_w, self.bar_height, fill=1, stroke=0)


class ColorRect(Flowable):
    """Solid color rectangle for section headers"""
    def __init__(self, w, h, fill_color, stroke_color=None):
        Flowable.__init__(self)
        self.rect_w = w
        self.rect_h = h
        self.fill_color = fill_color
        self.stroke_color = stroke_color
        self.width = w
        self.height = h

    def draw(self):
        c = self.canv
        c.setFillColor(self.fill_color)
        if self.stroke_color:
            c.setStrokeColor(self.stroke_color)
            c.rect(0, 0, self.rect_w, self.rect_h, fill=1, stroke=1)
        else:
            c.rect(0, 0, self.rect_w, self.rect_h, fill=1, stroke=0)


class RatingBadge(Flowable):
    """Rating badge like a terminal chip"""
    def __init__(self, rating, score, conf_band=None):
        Flowable.__init__(self)
        self.rating = rating
        self.score = score
        self.conf_band = conf_band
        self.width = CONTENT_W
        self.height = 28*mm

    def draw(self):
        c = self.canv
        # Main CIS box
        box_w = 80*mm
        box_h = 24*mm
        c.setFillColor(SURFACE_3)
        c.setStrokeColor(AMBER)
        c.setLineWidth(1.5)
        c.rect(0, 0, box_w, box_h, fill=1, stroke=1)

        # Rating letter
        r_color = RATING_COLORS.get(self.rating, AMBER)
        c.setFillColor(r_color)
        c.setFont("Helvetica-Bold", 28)
        c.drawString(5*mm, 12*mm, self.rating)

        # Score
        c.setFillColor(WHITE)
        c.setFont("Helvetica-Bold", 14)
        score_str = f"{self.score:.1f} / 100"
        c.drawString(5*mm, 5*mm, score_str)

        # CIS label
        c.setFillColor(WHITE_60)
        c.setFont("Helvetica", 7)
        c.drawString(5*mm, box_h - 5*mm, "CLIMATE INTELLIGENCE SCORE")

        # Confidence box
        if self.conf_band:
            conf_x = box_w + 8*mm
            c.setFillColor(SURFACE_3)
            c.setStrokeColor(BORDER_STR)
            c.setLineWidth(0.5)
            c.rect(conf_x, 0, 55*mm, box_h, fill=1, stroke=1)
            c.setFillColor(WHITE_60)
            c.setFont("Helvetica", 7)
            c.drawString(conf_x + 3*mm, box_h - 5*mm, "CONFIDENCE")
            c.setFillColor(CYAN)
            c.setFont("Helvetica-Bold", 14)
            c.drawString(conf_x + 3*mm, 12*mm, self.conf_band)
            c.setFillColor(WHITE)
            c.setFont("Helvetica", 10)
            c.drawString(conf_x + 3*mm, 5*mm, "Score: 78 / 100")


# ─────────────────────────────────────────────────────────────────────────────
# STYLES
# ─────────────────────────────────────────────────────────────────────────────

def build_styles():
    styles = {}

    styles['cover_title'] = ParagraphStyle(
        'cover_title', fontName='Helvetica-Bold', fontSize=22,
        textColor=WHITE, leading=28, spaceAfter=4*mm, alignment=TA_LEFT
    )
    styles['cover_sub'] = ParagraphStyle(
        'cover_sub', fontName='Helvetica', fontSize=11,
        textColor=WHITE_60, leading=16, spaceAfter=2*mm
    )
    styles['cover_meta'] = ParagraphStyle(
        'cover_meta', fontName='Helvetica', fontSize=9,
        textColor=WHITE_40, leading=14
    )
    styles['section_header'] = ParagraphStyle(
        'section_header', fontName='Helvetica-Bold', fontSize=8,
        textColor=AMBER, leading=12, spaceBefore=6*mm, spaceAfter=2*mm,
        letterSpacing=1.5, alignment=TA_LEFT
    )
    styles['h2'] = ParagraphStyle(
        'h2', fontName='Helvetica-Bold', fontSize=13,
        textColor=WHITE, leading=18, spaceBefore=5*mm, spaceAfter=2*mm
    )
    styles['h3'] = ParagraphStyle(
        'h3', fontName='Helvetica-Bold', fontSize=10,
        textColor=CYAN, leading=14, spaceBefore=4*mm, spaceAfter=1.5*mm
    )
    styles['body'] = ParagraphStyle(
        'body', fontName='Helvetica', fontSize=9,
        textColor=WHITE_80, leading=14, spaceAfter=3*mm, alignment=TA_JUSTIFY
    )
    styles['body_small'] = ParagraphStyle(
        'body_small', fontName='Helvetica', fontSize=8,
        textColor=WHITE_60, leading=12, spaceAfter=2*mm
    )
    styles['mono'] = ParagraphStyle(
        'mono', fontName='Courier', fontSize=8,
        textColor=WHITE_80, leading=12, spaceAfter=1*mm
    )
    styles['mono_amber'] = ParagraphStyle(
        'mono_amber', fontName='Courier-Bold', fontSize=9,
        textColor=AMBER, leading=13
    )
    styles['table_header'] = ParagraphStyle(
        'table_header', fontName='Helvetica-Bold', fontSize=7.5,
        textColor=WHITE_60, leading=10
    )
    styles['table_cell'] = ParagraphStyle(
        'table_cell', fontName='Helvetica', fontSize=8.5,
        textColor=WHITE_80, leading=12
    )
    styles['table_cell_mono'] = ParagraphStyle(
        'table_cell_mono', fontName='Courier-Bold', fontSize=9,
        textColor=WHITE, leading=12
    )
    styles['flag_critical'] = ParagraphStyle(
        'flag_critical', fontName='Helvetica-Bold', fontSize=8,
        textColor=RED, leading=12
    )
    styles['flag_warning'] = ParagraphStyle(
        'flag_warning', fontName='Helvetica-Bold', fontSize=8,
        textColor=YELLOW, leading=12
    )
    styles['flag_ok'] = ParagraphStyle(
        'flag_ok', fontName='Helvetica-Bold', fontSize=8,
        textColor=GREEN, leading=12
    )
    styles['disclaimer'] = ParagraphStyle(
        'disclaimer', fontName='Helvetica', fontSize=7.5,
        textColor=WHITE_40, leading=11, alignment=TA_JUSTIFY
    )
    styles['executive_lead'] = ParagraphStyle(
        'executive_lead', fontName='Helvetica-Bold', fontSize=10,
        textColor=WHITE, leading=16, spaceAfter=3*mm, alignment=TA_JUSTIFY
    )

    return styles


# ─────────────────────────────────────────────────────────────────────────────
# PAGE TEMPLATE — Black background with header/footer
# ─────────────────────────────────────────────────────────────────────────────

def make_page_template(doc, page_num_holder):

    def on_page(canvas_obj, doc):
        canvas_obj.saveState()
        w, h = A4

        # Full black background
        canvas_obj.setFillColor(BLACK)
        canvas_obj.rect(0, 0, w, h, fill=1, stroke=0)

        # Top amber rule
        canvas_obj.setFillColor(AMBER)
        canvas_obj.rect(0, h - 1.5*mm, w, 1.5*mm, fill=1, stroke=0)

        # Header bar
        canvas_obj.setFillColor(SURFACE)
        canvas_obj.rect(0, h - 12*mm, w, 10.5*mm, fill=1, stroke=0)

        # Header text
        canvas_obj.setFillColor(WHITE_60)
        canvas_obj.setFont("Helvetica", 7)
        canvas_obj.drawString(MARGIN_L, h - 8.5*mm, "CLIMACTIX GLOBAL — CLIMATE INTELLIGENCE REPORT")

        canvas_obj.setFillColor(AMBER)
        canvas_obj.setFont("Helvetica-Bold", 7)
        canvas_obj.drawRightString(w - MARGIN_R, h - 8.5*mm, "BHARAT STEEL & ALLOYS LTD. (BSAL)  |  B  |  FY2024")

        # Header bottom rule
        canvas_obj.setStrokeColor(BORDER_STR)
        canvas_obj.setLineWidth(0.5)
        canvas_obj.line(MARGIN_L, h - 12*mm, w - MARGIN_R, h - 12*mm)

        # Footer rule
        canvas_obj.line(MARGIN_L, MARGIN_B + 5*mm, w - MARGIN_R, MARGIN_B + 5*mm)

        # Footer text
        canvas_obj.setFillColor(WHITE_40)
        canvas_obj.setFont("Helvetica", 6.5)
        canvas_obj.drawString(MARGIN_L, MARGIN_B + 1.5*mm,
            "CONFIDENTIAL — FOR AUTHORIZED RECIPIENTS ONLY  |  © 2026 CLIMACTIX GLOBAL  |  "
            "NOT INVESTMENT ADVICE  |  Assessment ID: CX-2026-BSAL-001")

        canvas_obj.setFillColor(WHITE_60)
        canvas_obj.setFont("Helvetica-Bold", 7)
        canvas_obj.drawRightString(w - MARGIN_R, MARGIN_B + 1.5*mm, f"PAGE {doc.page}")

        canvas_obj.restoreState()

    frame = Frame(
        MARGIN_L, MARGIN_B + 8*mm,
        CONTENT_W, PAGE_H - MARGIN_T - MARGIN_B - 20*mm,
        leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0
    )
    return PageTemplate(id='main', frames=[frame], onPage=on_page)


# ─────────────────────────────────────────────────────────────────────────────
# HELPER FUNCTIONS
# ─────────────────────────────────────────────────────────────────────────────

def section_divider(title, styles):
    """Bloomberg-style ALL-CAPS section header with rule"""
    elements = []
    elements.append(Spacer(1, 3*mm))
    elements.append(HRFlowable(width=CONTENT_W, thickness=0.5, color=BORDER_STR, spaceAfter=1*mm))
    elements.append(Paragraph(title.upper(), styles['section_header']))
    return elements


def score_table_row(domain, rating, score, peer_pct, maturity, styles):
    """Single row for the main scorecard table"""
    rating_color = RATING_COLORS.get(rating.replace('+','').replace('-',''), WHITE_60)

    maturity_colors = {
        'ADVANCED': GREEN, 'PROGRESSING': CYAN, 'DEVELOPING': YELLOW,
        'LAGGARD': RED, 'ELEVATED': YELLOW
    }
    mat_color = maturity_colors.get(maturity.split()[0], WHITE_60)

    bar_fill = score / 100.0

    return [
        Paragraph(domain, styles['table_cell']),
        Paragraph(f'<b>{rating}</b>', ParagraphStyle('rc', fontName='Courier-Bold',
                  fontSize=10, textColor=rating_color, leading=12)),
        Paragraph(f'<b>{score:.1f}</b>', ParagraphStyle('sc', fontName='Courier-Bold',
                  fontSize=10, textColor=WHITE, leading=12)),
        Paragraph(f'{peer_pct}th', ParagraphStyle('pc', fontName='Courier',
                  fontSize=9, textColor=WHITE_60, leading=12)),
        Paragraph(maturity, ParagraphStyle('mc', fontName='Helvetica-Bold',
                  fontSize=8, textColor=mat_color, leading=12)),
    ]


def info_box(text, styles, box_color=SURFACE_2, border_color=BORDER_STR, text_style='body'):
    """Highlighted info box"""
    data = [[Paragraph(text, styles[text_style])]]
    t = Table(data, colWidths=[CONTENT_W])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), box_color),
        ('BOX', (0,0), (-1,-1), 0.5, border_color),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    return t


def amber_box(text, styles):
    """Amber-bordered highlight box"""
    data = [[Paragraph(text, styles['body'])]]
    t = Table(data, colWidths=[CONTENT_W])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#1A0A00')),
        ('BOX', (0,0), (-1,-1), 1.0, AMBER),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    return t


def make_standard_table(headers, rows, col_widths, styles, header_bg=SURFACE_3):
    header_row = [Paragraph(h.upper(), styles['table_header']) for h in headers]
    table_data = [header_row] + rows
    t = Table(table_data, colWidths=col_widths, repeatRows=1)
    ts = TableStyle([
        ('BACKGROUND', (0,0), (-1,0), header_bg),
        ('BACKGROUND', (0,1), (-1,-1), SURFACE),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [SURFACE, SURFACE_2]),
        ('LINEBELOW', (0,0), (-1,0), 0.5, AMBER),
        ('LINEBELOW', (0,1), (-1,-1), 0.3, BORDER),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOX', (0,0), (-1,-1), 0.5, BORDER_STR),
    ])
    t.setStyle(ts)
    return t


# ─────────────────────────────────────────────────────────────────────────────
# COVER PAGE
# ─────────────────────────────────────────────────────────────────────────────

def build_cover_page(styles):
    elements = []

    # Top spacing
    elements.append(Spacer(1, 8*mm))

    # Firm name
    elements.append(Paragraph("CLIMACTIX GLOBAL", ParagraphStyle(
        'firm', fontName='Helvetica-Bold', fontSize=9, textColor=AMBER,
        letterSpacing=3, spaceAfter=1*mm
    )))

    # Report type label
    elements.append(Paragraph("CLIMATE INTELLIGENCE ANALYSIS REPORT", ParagraphStyle(
        'rtype', fontName='Helvetica', fontSize=8, textColor=WHITE_40,
        letterSpacing=2, spaceAfter=6*mm
    )))

    # Amber rule
    elements.append(HRFlowable(width=CONTENT_W, thickness=1.5, color=AMBER, spaceAfter=6*mm))

    # Company name
    elements.append(Paragraph("BHARAT STEEL &amp; ALLOYS LTD.", ParagraphStyle(
        'co', fontName='Helvetica-Bold', fontSize=26, textColor=WHITE,
        leading=32, spaceAfter=2*mm
    )))

    # Ticker + sector
    elements.append(Paragraph(
        "BSE / NSE: BSAL  ·  Steel — Integrated Producer (GICS: 15101030)  ·  India",
        ParagraphStyle('ticker', fontName='Courier', fontSize=9, textColor=WHITE_60, spaceAfter=6*mm)
    ))

    # Rating badge
    elements.append(RatingBadge("B", 40.3, "HIGH"))
    elements.append(Spacer(1, 6*mm))

    # Key metrics row — 4-column table
    metrics_data = [
        [Paragraph("PEER RANK", styles['table_header']),
         Paragraph("CONFIDENCE", styles['table_header']),
         Paragraph("ASSESSMENT YEAR", styles['table_header']),
         Paragraph("OUTLOOK", styles['table_header'])],
        [Paragraph("28th Percentile", ParagraphStyle('mv', fontName='Courier-Bold', fontSize=11, textColor=CYAN, leading=14)),
         Paragraph("78 / 100", ParagraphStyle('mv', fontName='Courier-Bold', fontSize=11, textColor=CYAN, leading=14)),
         Paragraph("FY2024", ParagraphStyle('mv', fontName='Courier-Bold', fontSize=11, textColor=WHITE, leading=14)),
         Paragraph("STABLE / POS.", ParagraphStyle('mv', fontName='Courier-Bold', fontSize=11, textColor=YELLOW, leading=14))],
        [Paragraph("Steel-IN-Integrated-Large", styles['body_small']),
         Paragraph("Data Freshness: Excellent", styles['body_small']),
         Paragraph("Apr 2023 – Mar 2024", styles['body_small']),
         Paragraph("Positive potential", styles['body_small'])],
    ]
    col_w = CONTENT_W / 4
    metrics_t = Table(metrics_data, colWidths=[col_w]*4)
    metrics_t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), SURFACE_2),
        ('BACKGROUND', (0,0), (-1,0), SURFACE_3),
        ('BOX', (0,0), (-1,-1), 0.5, BORDER_STR),
        ('INNERGRID', (0,0), (-1,-1), 0.3, BORDER),
        ('LINEBELOW', (0,0), (-1,0), 0.5, AMBER),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    elements.append(metrics_t)
    elements.append(Spacer(1, 6*mm))

    # Thin rule
    elements.append(HRFlowable(width=CONTENT_W, thickness=0.3, color=BORDER_STR, spaceAfter=4*mm))

    # Report metadata table
    meta_data = [
        ["REPORT DATE", "June 2026", "ENGINE VERSION", "Climactix Intelligence Engine v1.0"],
        ["ASSESSMENT ID", "CX-2026-BSAL-001", "METHODOLOGY", "ARCHITECTURE.md v1.0"],
        ["REPORT TYPE", "Full-Spectrum Climate Intelligence", "NEXT REVIEW", "June 2027 / Milestone Trigger"],
        ["PREPARED BY", "Climactix Global Intelligence Engine", "CLASSIFICATION", "Institutional — Authorized Recipients Only"],
    ]
    meta_col_w = [30*mm, 65*mm, 32*mm, 48*mm]
    meta_rows = []
    for row in meta_data:
        meta_rows.append([
            Paragraph(row[0], ParagraphStyle('mk', fontName='Helvetica-Bold', fontSize=7, textColor=WHITE_40, leading=10)),
            Paragraph(row[1], ParagraphStyle('mv', fontName='Helvetica', fontSize=8, textColor=WHITE_80, leading=11)),
            Paragraph(row[2], ParagraphStyle('mk', fontName='Helvetica-Bold', fontSize=7, textColor=WHITE_40, leading=10)),
            Paragraph(row[3], ParagraphStyle('mv', fontName='Helvetica', fontSize=8, textColor=WHITE_80, leading=11)),
        ])
    meta_t = Table(meta_rows, colWidths=meta_col_w)
    meta_t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), SURFACE),
        ('BOX', (0,0), (-1,-1), 0.3, BORDER),
        ('LINEBELOW', (0,0), (-1,-1), 0.2, BORDER),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
    ]))
    elements.append(meta_t)
    elements.append(Spacer(1, 5*mm))

    # Disclaimer box
    disc_text = (
        "DISCLAIMER: This report is generated from structured assessment data submitted by Bharat Steel &amp; Alloys Ltd. "
        "and publicly available climate science databases. All financial projections are model-based estimates carrying "
        "material uncertainty. This report does not constitute investment advice. Scores reflect climate risk management "
        "quality and disclosure — not creditworthiness or equity valuation. For authorized recipients only."
    )
    elements.append(info_box(disc_text, styles, box_color=SURFACE, border_color=BORDER, text_style='disclaimer'))

    elements.append(PageBreak())
    return elements


# ─────────────────────────────────────────────────────────────────────────────
# EXECUTIVE SUMMARY
# ─────────────────────────────────────────────────────────────────────────────

def build_executive_summary(styles):
    elements = []
    elements += section_divider("01 — EXECUTIVE SUMMARY", styles)

    lead = (
        "Bharat Steel &amp; Alloys Ltd. has received a <b>Climate Intelligence Score of B (40.3/100)</b>, "
        "placing it in the <b>28th percentile</b> of its peer cohort (Steel — India — Integrated Large, n=11). "
        "Confidence in this rating is <b>HIGH (78/100)</b>."
    )
    elements.append(Paragraph(lead, styles['executive_lead']))

    summary = (
        "BSAL is a company in transition — one that discloses consistently, governs adequately, and has begun "
        "reducing emissions intensity — but has not yet built the institutional climate risk infrastructure "
        "required by the capital market standards now being set by SEBI, RBI, and global institutional investors. "
        "The company faces existential financial exposure under a Disorderly Transition scenario: combined physical "
        "and transition risk reaches <b>$148M (23.9% of revenue) by 2030</b> and an unmanageable <b>$911M (147% of revenue) "
        "by 2050</b> if no material decarbonization investment is made."
    )
    elements.append(Paragraph(summary, styles['body']))
    elements.append(Spacer(1, 3*mm))

    # Three structural vulnerabilities
    elements.append(Paragraph("THREE STRUCTURAL VULNERABILITIES", styles['section_header']))

    vulns = [
        ["01", "CARBON LOCK-IN", "BF-BOF technology with 15–20yr remaining asset life. Scope 1 intensity 1.92 tCO2e/t (above sector median 1.85). No technology transition investment visible in disclosed CAPEX."],
        ["02", "CLIMATE INTELLIGENCE DEFICIT", "No scenario analysis conducted. No physical risk assessment completed. Net-zero aspiration (2050) without roadmap, interim milestones, or capital allocation."],
        ["03", "SUPPLY CHAIN OPACITY", "12% of Tier 1 suppliers assessed for climate/ESG risk. 78% coking coal concentration in single country (Australia). Supply chain risk unmonitored."],
    ]

    for v in vulns:
        row = Table([[
            Paragraph(v[0], ParagraphStyle('vnum', fontName='Courier-Bold', fontSize=18, textColor=AMBER, leading=22)),
            Table([[
                Paragraph(v[1], ParagraphStyle('vtitle', fontName='Helvetica-Bold', fontSize=9, textColor=WHITE, leading=13, spaceAfter=1*mm)),
                Paragraph(v[2], styles['body_small'])
            ]], colWidths=[CONTENT_W - 22*mm]),
        ]], colWidths=[18*mm, CONTENT_W - 18*mm])
        row.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), SURFACE_2),
            ('BOX', (0,0), (-1,-1), 0.5, BORDER_STR),
            ('LEFTPADDING', (0,0), (-1,-1), 5),
            ('RIGHTPADDING', (0,0), (-1,-1), 5),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ]))
        elements.append(row)
        elements.append(Spacer(1, 1.5*mm))

    elements.append(Spacer(1, 3*mm))

    # Investor guidance
    elements.append(amber_box(
        "<b>FOR INSTITUTIONAL INVESTORS:</b> BSAL is a borderline hold at current climate risk management maturity. "
        "The trajectory is positive but speed of progress is insufficient given the 2030 financial exposure horizon. "
        "Recommended: conditional engagement with 12-month reassessment trigger tied to SBTi submission, "
        "physical risk assessment completion, and third-party ESG assurance.",
        styles
    ))

    elements.append(PageBreak())
    return elements


# ─────────────────────────────────────────────────────────────────────────────
# SCORECARD
# ─────────────────────────────────────────────────────────────────────────────

def build_scorecard(styles):
    elements = []
    elements += section_divider("02 — CLIMATE INTELLIGENCE SCORECARD", styles)

    # Overall score strip
    overall_data = [[
        Paragraph("OVERALL CIS", styles['table_header']),
        Paragraph("<b>B</b>", ParagraphStyle('or', fontName='Courier-Bold', fontSize=20,
                  textColor=colors.HexColor('#F97316'), leading=24)),
        Paragraph("<b>40.3</b> / 100", ParagraphStyle('os', fontName='Courier-Bold', fontSize=14,
                  textColor=WHITE, leading=18)),
        Paragraph("28th Percentile  ·  DEVELOPING", ParagraphStyle('op', fontName='Helvetica',
                  fontSize=9, textColor=WHITE_60, leading=13)),
        Paragraph("HIGH (78)", ParagraphStyle('oc', fontName='Helvetica-Bold', fontSize=10,
                  textColor=CYAN, leading=13)),
    ]]
    overall_t = Table(overall_data, colWidths=[30*mm, 18*mm, 38*mm, 62*mm, 27*mm])
    overall_t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), SURFACE_3),
        ('BOX', (0,0), (-1,-1), 1.0, AMBER),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    elements.append(overall_t)
    elements.append(Spacer(1, 3*mm))

    # Domain scorecard table
    headers = ["DOMAIN", "RATING", "SCORE", "PEER PCT", "MATURITY"]
    col_widths = [52*mm, 18*mm, 22*mm, 22*mm, 61*mm]

    domain_data = [
        ("Governance", "BBB", 59.8, 55, "PROGRESSING"),
        ("Physical Risk", "BB+", 49.5, 47, "DEVELOPING"),
        ("Transition Risk", "CCC", 28.2, 16, "LAGGARD ⚠"),
        ("Carbon Management", "CCC", 33.0, 18, "LAGGARD ⚠"),
        ("Supply Chain", "D", 19.3, 12, "LAGGARD ⚠"),
        ("Compliance", "BB", 50.2, 48, "DEVELOPING"),
        ("Adaptation", "BB", 46.9, 52, "PROGRESSING"),
        ("Disclosure Quality", "A", 74.4, 78, "ADVANCED ✓"),
        ("Greenwashing Risk", "—", 41.5, 60, "ELEVATED ⚠"),
        ("Climate Resilience", "D", 13.8, 8, "LAGGARD ⚠"),
    ]

    rows = [score_table_row(d[0], d[1], d[2], d[3], d[4], styles) for d in domain_data]
    scorecard_t = make_standard_table(headers, rows, col_widths, styles)
    elements.append(scorecard_t)
    elements.append(Spacer(1, 3*mm))

    # Score interpretation
    interp = (
        "The B rating (40.3) reflects a company with functional governance and disclosure infrastructure "
        "but without climate risk management depth. The wide dispersion across domains is the defining "
        "characteristic — Disclosure Quality (A, 78th percentile) and Governance (BBB, 55th percentile) "
        "are institutional-grade. Carbon Management (CCC, 18th), Transition Risk (CCC, 16th), and "
        "Climate Resilience (D, 8th) are near-bottom of cohort — a classic profile of strong form, weak substance."
    )
    elements.append(Paragraph(interp, styles['body']))

    elements.append(PageBreak())
    return elements


# ─────────────────────────────────────────────────────────────────────────────
# DOMAIN ANALYSIS SECTIONS
# ─────────────────────────────────────────────────────────────────────────────

def domain_header(number, title, rating, score, peer_pct, maturity, styles):
    """Consistent domain section header"""
    elements = []
    elements += section_divider(f"{number} — {title}", styles)

    r_color = RATING_COLORS.get(rating.replace('+','').replace('-',''), WHITE_60)
    mat_colors = {'ADVANCED': GREEN, 'PROGRESSING': CYAN, 'DEVELOPING': YELLOW, 'LAGGARD': RED}
    m_color = mat_colors.get(maturity.split()[0], WHITE_60)

    strip_data = [[
        Paragraph(f"<b>{rating}</b>", ParagraphStyle('dr', fontName='Courier-Bold',
                  fontSize=16, textColor=r_color, leading=20)),
        Paragraph(f"<b>{score:.1f}</b> / 100", ParagraphStyle('ds', fontName='Courier-Bold',
                  fontSize=12, textColor=WHITE, leading=16)),
        Paragraph(f"{peer_pct}th Percentile", ParagraphStyle('dp', fontName='Courier',
                  fontSize=9, textColor=WHITE_60, leading=13)),
        Paragraph(maturity, ParagraphStyle('dm', fontName='Helvetica-Bold',
                  fontSize=9, textColor=m_color, leading=13)),
    ]]
    strip_t = Table(strip_data, colWidths=[22*mm, 35*mm, 40*mm, 78*mm])
    strip_t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), SURFACE_2),
        ('BOX', (0,0), (-1,-1), 0.5, BORDER_STR),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    elements.append(strip_t)
    elements.append(Spacer(1, 2*mm))
    return elements


def build_governance(styles):
    elements = []
    elements += domain_header("03", "GOVERNANCE", "BBB", 59.8, 55, "PROGRESSING", styles)

    elements.append(Paragraph("Strengths", styles['h3']))
    elements.append(Paragraph(
        "BSAL's governance structure is substantively ahead of many Steel sector peers. The Environment and "
        "Sustainability Committee, established at Board level in FY2022, has verified Terms of Reference "
        "confirming mandate to review climate risk disclosures, approve sustainability targets, and monitor "
        "environmental compliance. The board-approved Sustainability Policy (FY2023) provides the foundational "
        "governance document from which disclosure obligations and target commitments are derived.",
        styles['body']
    ))

    elements.append(Paragraph("Material Gaps", styles['h3']))
    elements.append(Paragraph(
        "Executive accountability is materially insufficient. The MD/CEO has 5% of variable compensation "
        "linked to PAT Scheme energy efficiency targets only. No other C-suite member has climate-linked KPIs. "
        "For a company with $73M+ carbon pricing exposure by 2030, climate performance should constitute "
        "15–25% of executive variable pay to be considered institutionally credible.",
        styles['body']
    ))
    elements.append(Paragraph(
        "No third-party assurance exists on any sustainability data. BSAL's emissions, energy, and water "
        "data is entirely self-reported. There is no ISAE 3000 verification, no ISO 14064 audit, and no "
        "specialist firm review. This is the single most significant governance gap — and the highest-leverage "
        "action available: commissioning ISAE 3000 limited assurance would alone add 8–10 points to Governance "
        "and cascade to Confidence Score and Disclosure Quality.",
        styles['body']
    ))

    # Score breakdown table
    elements.append(Paragraph("Score Breakdown", styles['h3']))
    gb_data = [
        [Paragraph("Board oversight", styles['table_cell']),
         Paragraph("100.0", ParagraphStyle('sv', fontName='Courier-Bold', fontSize=9, textColor=GREEN, leading=12)),
         Paragraph("0.30", styles['body_small']),
         Paragraph("30.0", ParagraphStyle('sv', fontName='Courier-Bold', fontSize=9, textColor=WHITE, leading=12))],
        [Paragraph("ESG policy quality", styles['table_cell']),
         Paragraph("65.0", ParagraphStyle('sv', fontName='Courier-Bold', fontSize=9, textColor=CYAN, leading=12)),
         Paragraph("0.25", styles['body_small']),
         Paragraph("16.3", ParagraphStyle('sv', fontName='Courier-Bold', fontSize=9, textColor=WHITE, leading=12))],
        [Paragraph("Executive accountability", styles['table_cell']),
         Paragraph("40.0", ParagraphStyle('sv', fontName='Courier-Bold', fontSize=9, textColor=YELLOW, leading=12)),
         Paragraph("0.20", styles['body_small']),
         Paragraph("8.0", ParagraphStyle('sv', fontName='Courier-Bold', fontSize=9, textColor=WHITE, leading=12))],
        [Paragraph("Audit / verification", styles['table_cell']),
         Paragraph("0.0", ParagraphStyle('sv', fontName='Courier-Bold', fontSize=9, textColor=RED, leading=12)),
         Paragraph("0.15", styles['body_small']),
         Paragraph("0.0", ParagraphStyle('sv', fontName='Courier-Bold', fontSize=9, textColor=RED, leading=12))],
        [Paragraph("Stakeholder engagement", styles['table_cell']),
         Paragraph("55.0", ParagraphStyle('sv', fontName='Courier-Bold', fontSize=9, textColor=YELLOW, leading=12)),
         Paragraph("0.10", styles['body_small']),
         Paragraph("5.5", ParagraphStyle('sv', fontName='Courier-Bold', fontSize=9, textColor=WHITE, leading=12))],
    ]
    gb_t = make_standard_table(["Component", "Score", "Weight", "Contribution"], gb_data,
                               [90*mm, 28*mm, 25*mm, 32*mm], styles)
    elements.append(gb_t)
    return elements


def build_carbon_management(styles):
    elements = []
    elements += domain_header("04", "CARBON MANAGEMENT", "CCC", 33.0, 18, "LAGGARD", styles)

    # Emissions profile table
    elements.append(Paragraph("Emissions Profile — FY2024", styles['h3']))
    em_data = [
        [Paragraph("Scope 1 (Direct)", styles['table_cell']),
         Paragraph("5,376,000", ParagraphStyle('mv', fontName='Courier-Bold', fontSize=9, textColor=RED, leading=12)),
         Paragraph("1.92", ParagraphStyle('mv', fontName='Courier-Bold', fontSize=9, textColor=RED, leading=12)),
         Paragraph("3.8% above median ⚠", styles['flag_warning'])],
        [Paragraph("Scope 2 Market-based", styles['table_cell']),
         Paragraph("892,000", ParagraphStyle('mv', fontName='Courier', fontSize=9, textColor=WHITE_80, leading=12)),
         Paragraph("0.32", ParagraphStyle('mv', fontName='Courier', fontSize=9, textColor=WHITE_80, leading=12)),
         Paragraph("", styles['body_small'])],
        [Paragraph("Scope 2 Location-based", styles['table_cell']),
         Paragraph("1,104,000", ParagraphStyle('mv', fontName='Courier', fontSize=9, textColor=WHITE_80, leading=12)),
         Paragraph("0.39", ParagraphStyle('mv', fontName='Courier', fontSize=9, textColor=WHITE_80, leading=12)),
         Paragraph("", styles['body_small'])],
        [Paragraph("Sector Median (p50)", styles['table_cell']),
         Paragraph("—", styles['body_small']),
         Paragraph("1.85", ParagraphStyle('mv', fontName='Courier-Bold', fontSize=9, textColor=CYAN, leading=12)),
         Paragraph("Benchmark reference", styles['body_small'])],
    ]
    em_t = make_standard_table(
        ["Scope", "Absolute (tCO2e)", "Intensity (tCO2e/t)", "vs Benchmark"],
        em_data, [55*mm, 38*mm, 42*mm, 40*mm], styles
    )
    elements.append(em_t)
    elements.append(Spacer(1, 2*mm))

    elements.append(Paragraph(
        "BSAL's 3-year Scope 1 intensity decline of <b>2.94%/yr</b> is Paris-aligned (2–7%/yr range). "
        "This is the most positive data point in BSAL's carbon profile. However, the company remains above "
        "the sector median (1.92 vs 1.85 tCO2e/t), driving a <b>zero score on emissions performance</b> "
        "— the largest single sub-component (weight: 0.35). Crossing below 1.85 tCO2e/t (achievable "
        "on current trajectory by FY2027) would alone raise CMS from 33.0 to approximately 68 (BBB+).",
        styles['body']
    ))

    # Target credibility
    elements.append(Paragraph("Target Credibility Assessment", styles['h3']))
    tc_data = [
        [Paragraph("SBTi Validation", styles['table_cell']),
         Paragraph("Not submitted", styles['flag_critical']),
         Paragraph("0", ParagraphStyle('ts', fontName='Courier-Bold', fontSize=9, textColor=RED, leading=12))],
        [Paragraph("Interim 2030 milestone", styles['table_cell']),
         Paragraph("Not defined", styles['flag_critical']),
         Paragraph("0", ParagraphStyle('ts', fontName='Courier-Bold', fontSize=9, textColor=RED, leading=12))],
        [Paragraph("CAPEX allocation to decarbonization", styles['table_cell']),
         Paragraph("Undisclosed", styles['flag_critical']),
         Paragraph("0", ParagraphStyle('ts', fontName='Courier-Bold', fontSize=9, textColor=RED, leading=12))],
        [Paragraph("Technology transition roadmap", styles['table_cell']),
         Paragraph("Not published", styles['flag_critical']),
         Paragraph("0", ParagraphStyle('ts', fontName='Courier-Bold', fontSize=9, textColor=RED, leading=12))],
        [Paragraph("Board approval of target", styles['table_cell']),
         Paragraph("Yes — policy uploaded", styles['flag_ok']),
         Paragraph("25", ParagraphStyle('ts', fontName='Courier-Bold', fontSize=9, textColor=GREEN, leading=12))],
    ]
    tc_t = make_standard_table(["Criterion", "Status", "Score"], tc_data, [75*mm, 75*mm, 25*mm], styles)
    elements.append(tc_t)
    elements.append(Spacer(1, 1.5*mm))
    elements.append(info_box(
        "A Net-Zero 2050 commitment from a BF-BOF steel company without a technology transition plan, "
        "without SBTi validation, and without disclosed CAPEX allocation is not an institutional-grade target. "
        "It is an aspiration. Target Credibility Score: 30/100.",
        styles, box_color=colors.HexColor('#1A0000'), border_color=RED
    ))
    return elements


def build_physical_risk(styles):
    elements = []
    elements += domain_header("05", "PHYSICAL RISK", "BB+", 49.5, 47, "DEVELOPING", styles)

    elements.append(Paragraph("Hazard Exposure Map", styles['h3']))
    hazard_data = [
        [Paragraph("Water Stress", styles['table_cell']),
         Paragraph("Raipur", styles['body_small']),
         Paragraph("CRITICAL", styles['flag_critical']),
         Paragraph("WRI: 3.8/5 (High) — 62% capacity in stressed zones", styles['body_small']),
         Paragraph("Worsening", styles['flag_warning'])],
        [Paragraph("Heat Stress", styles['table_cell']),
         Paragraph("Raipur", styles['body_small']),
         Paragraph("HIGH", styles['flag_warning']),
         Paragraph("WBGT p95: 29.8°C — at heavy work threshold", styles['body_small']),
         Paragraph("Worsening", styles['flag_warning'])],
        [Paragraph("Cyclone", styles['table_cell']),
         Paragraph("Vizag", styles['body_small']),
         Paragraph("HIGH", styles['flag_warning']),
         Paragraph("Bay of Bengal exposure — 18% assets coastal", styles['body_small']),
         Paragraph("Intensifying", styles['flag_warning'])],
        [Paragraph("Flood", styles['table_cell']),
         Paragraph("Vizag", styles['body_small']),
         Paragraph("MEDIUM", ParagraphStyle('med', fontName='Helvetica-Bold', fontSize=8, textColor=CYAN, leading=12)),
         Paragraph("9% assets in 100yr flood zone", styles['body_small']),
         Paragraph("Worsening", styles['flag_warning'])],
        [Paragraph("Sea Level Rise", styles['table_cell']),
         Paragraph("Vizag", styles['body_small']),
         Paragraph("MEDIUM", ParagraphStyle('med', fontName='Helvetica-Bold', fontSize=8, textColor=CYAN, leading=12)),
         Paragraph("4.2km coastal — IPCC SLR potential", styles['body_small']),
         Paragraph("Accelerating", styles['flag_warning'])],
    ]
    h_t = make_standard_table(
        ["Hazard", "Site", "Level", "Detail", "2050 Trend"],
        hazard_data, [28*mm, 18*mm, 22*mm, 82*mm, 25*mm], styles
    )
    elements.append(h_t)
    elements.append(Spacer(1, 2*mm))

    elements.append(Paragraph(
        "<b>Water stress is the most pressing physical risk.</b> 62% of manufacturing capacity is in WRI "
        "High/Extremely High stress zones. The ZLD system at Raipur provides meaningful mitigation (resilience "
        "factor: 0.65 vs 1.0 without). However, ZLD addresses liquid discharge — not raw water procurement risk. "
        "No formal water risk assessment or water stewardship strategy was evidenced in any uploaded document.",
        styles['body']
    ))
    elements.append(Paragraph(
        "<b>Heat stress is an emerging operational risk.</b> Raipur's WBGT p95 is 29.8°C — already at the "
        "Kjellstrom heavy-work threshold. Under IPCC AR6 3°C projections, this rises to 32.2°C by 2050, "
        "projecting 28% heavy-work productivity loss. No heat mitigation CAPEX identified in FY2024 disclosures.",
        styles['body']
    ))
    return elements


def build_transition_risk(styles):
    elements = []
    elements += domain_header("06", "TRANSITION RISK", "CCC", 28.2, 16, "LAGGARD", styles)

    elements.append(amber_box(
        "<b>CRITICAL FINDING:</b> This is BSAL's most material financial risk domain. "
        "Carbon pricing alone will consume an estimated <b>59% of FY2024 EBITDA by 2030</b> "
        "under Disorderly Transition pricing ($15/tCO2e). At 2040 prices ($60/tCO2e), "
        "the exposure exceeds total current EBITDA.",
        styles
    ))
    elements.append(Spacer(1, 2*mm))

    # Carbon pricing table
    elements.append(Paragraph("Carbon Pricing Cost Projection", styles['h3']))
    cp_data = [
        [Paragraph("Carbon Price ($/tCO2e)", styles['table_cell']),
         Paragraph("$8–12", ParagraphStyle('cv', fontName='Courier', fontSize=9, textColor=WHITE_80, leading=12)),
         Paragraph("$15–20", ParagraphStyle('cv', fontName='Courier', fontSize=9, textColor=YELLOW, leading=12)),
         Paragraph("$60–80", ParagraphStyle('cv', fontName='Courier', fontSize=9, textColor=colors.HexColor('#F97316'), leading=12)),
         Paragraph("$150–180", ParagraphStyle('cv', fontName='Courier-Bold', fontSize=9, textColor=RED, leading=12))],
        [Paragraph("BSAL Scope 1 (with traj.)", styles['table_cell']),
         Paragraph("5,376,000t", ParagraphStyle('cv', fontName='Courier', fontSize=9, textColor=WHITE_80, leading=12)),
         Paragraph("4,868,000t", ParagraphStyle('cv', fontName='Courier', fontSize=9, textColor=WHITE_80, leading=12)),
         Paragraph("3,782,000t", ParagraphStyle('cv', fontName='Courier', fontSize=9, textColor=WHITE_80, leading=12)),
         Paragraph("2,937,000t", ParagraphStyle('cv', fontName='Courier', fontSize=9, textColor=WHITE_80, leading=12))],
        [Paragraph("Annual Carbon Cost", styles['table_cell']),
         Paragraph("$53M", ParagraphStyle('cv', fontName='Courier', fontSize=9, textColor=WHITE_80, leading=12)),
         Paragraph("$73M", ParagraphStyle('cv', fontName='Courier', fontSize=9, textColor=YELLOW, leading=12)),
         Paragraph("$227M", ParagraphStyle('cv', fontName='Courier-Bold', fontSize=9, textColor=colors.HexColor('#F97316'), leading=12)),
         Paragraph("$441M", ParagraphStyle('cv', fontName='Courier-Bold', fontSize=9, textColor=RED, leading=12))],
        [Paragraph("As % of FY24 EBITDA ($124M)", styles['table_cell']),
         Paragraph("42.7%", ParagraphStyle('cv', fontName='Courier', fontSize=9, textColor=YELLOW, leading=12)),
         Paragraph("58.9%", ParagraphStyle('cv', fontName='Courier-Bold', fontSize=9, textColor=YELLOW, leading=12)),
         Paragraph("183%", ParagraphStyle('cv', fontName='Courier-Bold', fontSize=9, textColor=RED, leading=12)),
         Paragraph("356%", ParagraphStyle('cv', fontName='Courier-Bold', fontSize=9, textColor=RED, leading=12))],
    ]
    cp_t = make_standard_table(
        ["Metric", "Now (FY26)", "2030", "2040", "2050"],
        cp_data, [55*mm, 28*mm, 28*mm, 28*mm, 28*mm], styles
    )
    elements.append(cp_t)
    elements.append(Spacer(1, 2*mm))

    elements.append(Paragraph(
        "<b>Technology lock-in is the most structurally significant transition risk.</b> BSAL's BF-BOF "
        "equipment at Raipur was refurbished in 2019, implying remaining asset life to ~2039–2044. "
        "No investment in DRI-H2 or EAF technology has been disclosed. Each year of continued BF-BOF "
        "investment without a transition plan represents additional stranded asset risk accumulation. "
        "Energy intensity at 23.4 GJ/t is 18.2% above the sector median (19.8 GJ/t), driving a "
        "<b>zero score on the energy efficiency sub-component</b> — the second-largest transition weight (0.25).",
        styles['body']
    ))
    return elements


def build_supply_chain(styles):
    elements = []
    elements += domain_header("07", "SUPPLY CHAIN", "D", 19.3, 12, "LAGGARD", styles)

    elements.append(Paragraph(
        "Supply chain risk management is BSAL's weakest domain and near the bottom of its peer cohort. "
        "Three structural vulnerabilities define the exposure:",
        styles['body']
    ))

    sc_items = [
        ("COKING COAL CONCENTRATION", "78% of coking coal (1.8 MTPA) sourced from Australia. "
         "Queensland flood events (2011, 2022) have previously caused significant global disruption. "
         "Single-country concentration at 78% for a CRITICAL input is unmanaged supply chain risk."),
        ("SUPPLIER ESG COVERAGE: 12%", "Only 17 of 142 Tier 1 suppliers have received any ESG or climate "
         "risk assessment. Cohort average: 31%. Best-in-class: 75%+. With Scope 3 Category 1 being the "
         "largest single upstream emission source for steel, BSAL cannot credibly claim to manage its full carbon exposure."),
        ("NO FORMAL SUPPLIER PROGRAMME", "No supplier ESG questionnaire programme is evidenced in any uploaded "
         "document. No supplier BCDR requirements. No climate-related supplier contractual clauses identified."),
    ]

    for item in sc_items:
        elements.append(Paragraph(item[0], styles['h3']))
        elements.append(Paragraph(item[1], styles['body']))

    # Score breakdown
    sc_data = [
        [Paragraph("Supplier ESG audit coverage (12%)", styles['table_cell']),
         Paragraph("10.0", ParagraphStyle('sv', fontName='Courier-Bold', fontSize=9, textColor=RED, leading=12)),
         Paragraph("0.30", styles['body_small']),
         Paragraph("3.0", ParagraphStyle('sv', fontName='Courier-Bold', fontSize=9, textColor=RED, leading=12))],
        [Paragraph("Scope 3 upstream data quality", styles['table_cell']),
         Paragraph("15.0", ParagraphStyle('sv', fontName='Courier-Bold', fontSize=9, textColor=RED, leading=12)),
         Paragraph("0.25", styles['body_small']),
         Paragraph("3.75", ParagraphStyle('sv', fontName='Courier-Bold', fontSize=9, textColor=RED, leading=12))],
        [Paragraph("Critical material concentration", styles['table_cell']),
         Paragraph("30.0", ParagraphStyle('sv', fontName='Courier-Bold', fontSize=9, textColor=YELLOW, leading=12)),
         Paragraph("0.20", styles['body_small']),
         Paragraph("6.0", ParagraphStyle('sv', fontName='Courier-Bold', fontSize=9, textColor=YELLOW, leading=12))],
        [Paragraph("Supplier questionnaire programme", styles['table_cell']),
         Paragraph("20.0", ParagraphStyle('sv', fontName='Courier-Bold', fontSize=9, textColor=RED, leading=12)),
         Paragraph("0.15", styles['body_small']),
         Paragraph("3.0", ParagraphStyle('sv', fontName='Courier-Bold', fontSize=9, textColor=RED, leading=12))],
        [Paragraph("Supply chain BCDR planning", styles['table_cell']),
         Paragraph("35.0", ParagraphStyle('sv', fontName='Courier-Bold', fontSize=9, textColor=YELLOW, leading=12)),
         Paragraph("0.10", styles['body_small']),
         Paragraph("3.5", ParagraphStyle('sv', fontName='Courier-Bold', fontSize=9, textColor=YELLOW, leading=12))],
    ]
    sc_t = make_standard_table(["Component", "Score", "Weight", "Contribution"],
                               sc_data, [90*mm, 28*mm, 25*mm, 32*mm], styles)
    elements.append(sc_t)
    return elements


# ─────────────────────────────────────────────────────────────────────────────
# SIMULATION
# ─────────────────────────────────────────────────────────────────────────────

def build_simulation(styles):
    elements = []
    elements += section_divider("08 — CLIMATE RISK SIMULATION", styles)
    elements.append(Paragraph(
        "Methodology: NGFS 2023 scenarios × IPCC AR6 physical projections. "
        "Uncertainty band: ±35% at 80% confidence. Base year: FY2024 revenue $620M, EBITDA $124M.",
        styles['body_small']
    ))
    elements.append(Spacer(1, 2*mm))

    # Full scenario matrix table
    sim_data = [
        # Physical — Orderly
        [Paragraph("Physical Risk", styles['table_cell']),
         Paragraph("Orderly NZ2050", styles['body_small']),
         Paragraph("$11.1M", ParagraphStyle('sv', fontName='Courier', fontSize=8, textColor=GREEN, leading=12)),
         Paragraph("$24.1M", ParagraphStyle('sv', fontName='Courier', fontSize=8, textColor=CYAN, leading=12)),
         Paragraph("$41.6M", ParagraphStyle('sv', fontName='Courier', fontSize=8, textColor=YELLOW, leading=12))],
        [Paragraph("Physical Risk", styles['table_cell']),
         Paragraph("Disorderly ~3°C", styles['body_small']),
         Paragraph("$19.7M", ParagraphStyle('sv', fontName='Courier', fontSize=8, textColor=YELLOW, leading=12)),
         Paragraph("$44.7M", ParagraphStyle('sv', fontName='Courier', fontSize=8, textColor=colors.HexColor('#F97316'), leading=12)),
         Paragraph("$92.4M", ParagraphStyle('sv', fontName='Courier-Bold', fontSize=8, textColor=RED, leading=12))],
        [Paragraph("Physical Risk", styles['table_cell']),
         Paragraph("Hot House ~4°C", styles['body_small']),
         Paragraph("$28.1M", ParagraphStyle('sv', fontName='Courier', fontSize=8, textColor=colors.HexColor('#F97316'), leading=12)),
         Paragraph("$68.5M", ParagraphStyle('sv', fontName='Courier-Bold', fontSize=8, textColor=RED, leading=12)),
         Paragraph("$151.8M", ParagraphStyle('sv', fontName='Courier-Bold', fontSize=8, textColor=RED, leading=12))],
        # Transition
        [Paragraph("Transition Risk", styles['table_cell']),
         Paragraph("Orderly NZ2050", styles['body_small']),
         Paragraph("$82.7M", ParagraphStyle('sv', fontName='Courier', fontSize=8, textColor=YELLOW, leading=12)),
         Paragraph("$193.2M", ParagraphStyle('sv', fontName='Courier-Bold', fontSize=8, textColor=colors.HexColor('#F97316'), leading=12)),
         Paragraph("$320.5M", ParagraphStyle('sv', fontName='Courier-Bold', fontSize=8, textColor=RED, leading=12))],
        [Paragraph("Transition Risk", styles['table_cell']),
         Paragraph("Disorderly ~3°C", styles['body_small']),
         Paragraph("$128.5M", ParagraphStyle('sv', fontName='Courier-Bold', fontSize=8, textColor=colors.HexColor('#F97316'), leading=12)),
         Paragraph("$406.4M", ParagraphStyle('sv', fontName='Courier-Bold', fontSize=8, textColor=RED, leading=12)),
         Paragraph("$818.9M", ParagraphStyle('sv', fontName='Courier-Bold', fontSize=8, textColor=RED, leading=12))],
        [Paragraph("Transition Risk", styles['table_cell']),
         Paragraph("Hot House ~4°C", styles['body_small']),
         Paragraph("$31.4M", ParagraphStyle('sv', fontName='Courier', fontSize=8, textColor=YELLOW, leading=12)),
         Paragraph("$45.9M", ParagraphStyle('sv', fontName='Courier', fontSize=8, textColor=YELLOW, leading=12)),
         Paragraph("$71.9M", ParagraphStyle('sv', fontName='Courier', fontSize=8, textColor=colors.HexColor('#F97316'), leading=12))],
        # Combined
        [Paragraph("COMBINED — % Revenue", ParagraphStyle('th', fontName='Helvetica-Bold', fontSize=8.5, textColor=WHITE, leading=12)),
         Paragraph("Orderly NZ2050", styles['body_small']),
         Paragraph("15.1%", ParagraphStyle('sv', fontName='Courier-Bold', fontSize=9, textColor=YELLOW, leading=12)),
         Paragraph("35.1%", ParagraphStyle('sv', fontName='Courier-Bold', fontSize=9, textColor=colors.HexColor('#F97316'), leading=12)),
         Paragraph("58.4%", ParagraphStyle('sv', fontName='Courier-Bold', fontSize=9, textColor=RED, leading=12))],
        [Paragraph("COMBINED — % Revenue", ParagraphStyle('th', fontName='Helvetica-Bold', fontSize=8.5, textColor=WHITE, leading=12)),
         Paragraph("Disorderly ~3°C", styles['body_small']),
         Paragraph("23.9%", ParagraphStyle('sv', fontName='Courier-Bold', fontSize=9, textColor=colors.HexColor('#F97316'), leading=12)),
         Paragraph("72.8%", ParagraphStyle('sv', fontName='Courier-Bold', fontSize=9, textColor=RED, leading=12)),
         Paragraph("147.0% ⚠", ParagraphStyle('sv', fontName='Courier-Bold', fontSize=9, textColor=RED, leading=12))],
        [Paragraph("COMBINED — % Revenue", ParagraphStyle('th', fontName='Helvetica-Bold', fontSize=8.5, textColor=WHITE, leading=12)),
         Paragraph("Hot House ~4°C", styles['body_small']),
         Paragraph("9.6%", ParagraphStyle('sv', fontName='Courier', fontSize=9, textColor=YELLOW, leading=12)),
         Paragraph("18.5%", ParagraphStyle('sv', fontName='Courier', fontSize=9, textColor=colors.HexColor('#F97316'), leading=12)),
         Paragraph("36.1%", ParagraphStyle('sv', fontName='Courier-Bold', fontSize=9, textColor=RED, leading=12))],
    ]

    sim_t = make_standard_table(
        ["Risk Type", "Scenario", "2030", "2040", "2050"],
        sim_data, [35*mm, 38*mm, 32*mm, 32*mm, 38*mm], styles
    )
    elements.append(sim_t)
    elements.append(Spacer(1, 2*mm))

    elements.append(info_box(
        "<b>KEY INSIGHT:</b> The most financially dangerous scenario for BSAL is Disorderly Transition — not Hot House. "
        "Under Hot House (~4°C), carbon prices remain low (governments fail to act) making transition costs modest. "
        "Under Disorderly, prices rise faster than BSAL can adapt while physical risk simultaneously intensifies. "
        "The 147% revenue exposure by 2050 in Disorderly represents an existential scenario without material "
        "decarbonization investment beginning by 2028.",
        styles, box_color=colors.HexColor('#0D0A00'), border_color=YELLOW
    ))
    return elements


# ─────────────────────────────────────────────────────────────────────────────
# BENCHMARKING
# ─────────────────────────────────────────────────────────────────────────────

def build_benchmarking(styles):
    elements = []
    elements += section_divider("09 — PEER BENCHMARK ANALYSIS", styles)
    elements.append(Paragraph(
        "Cohort: Steel — India — Integrated Producer — Large Cap (n=11)  |  Period: FY2024",
        styles['body_small']
    ))
    elements.append(Spacer(1, 1.5*mm))

    bm_data = [
        ("CIS Overall", 40.3, 47.2, 58.4, 78.3, 28, "DEVELOPING", colors.HexColor('#F97316')),
        ("Governance", 59.8, 55.0, 68.0, 91.0, 55, "PROGRESSING", CYAN),
        ("Physical Risk", 49.5, 52.0, 65.0, 82.0, 47, "DEVELOPING", YELLOW),
        ("Transition Risk", 28.2, 43.0, 56.0, 79.0, 16, "LAGGARD", RED),
        ("Carbon Management", 33.0, 58.0, 72.0, 95.0, 18, "LAGGARD", RED),
        ("Supply Chain", 19.3, 35.0, 48.0, 79.0, 12, "LAGGARD", RED),
        ("Compliance", 50.2, 52.0, 65.0, 88.0, 48, "DEVELOPING", YELLOW),
        ("Adaptation", 46.9, 45.0, 58.0, 84.0, 52, "PROGRESSING", CYAN),
        ("Disclosure Quality", 74.4, 60.0, 72.0, 93.0, 78, "ADVANCED", GREEN),
        ("Resilience", 13.8, 33.0, 48.0, 79.0, 8, "LAGGARD", RED),
    ]

    rows = []
    for d in bm_data:
        name, bsal, median, p75, bic, pct, maturity, color = d
        vs_med = bsal - median
        vs_str = f"+{vs_med:.1f}" if vs_med >= 0 else f"{vs_med:.1f}"
        vs_color = GREEN if vs_med >= 0 else RED

        mat_colors = {'ADVANCED': GREEN, 'PROGRESSING': CYAN, 'DEVELOPING': YELLOW, 'LAGGARD': RED}
        mc = mat_colors.get(maturity, WHITE_60)

        rows.append([
            Paragraph(name, styles['table_cell']),
            Paragraph(f"{bsal:.1f}", ParagraphStyle('bv', fontName='Courier-Bold', fontSize=9, textColor=color, leading=12)),
            Paragraph(f"{median:.1f}", ParagraphStyle('mv', fontName='Courier', fontSize=9, textColor=WHITE_60, leading=12)),
            Paragraph(f"{p75:.1f}", ParagraphStyle('p75v', fontName='Courier', fontSize=9, textColor=WHITE_60, leading=12)),
            Paragraph(f"{bic:.1f}", ParagraphStyle('bicv', fontName='Courier', fontSize=9, textColor=GREEN, leading=12)),
            Paragraph(f"{pct}th", ParagraphStyle('pctv', fontName='Courier-Bold', fontSize=9,
                      textColor=GREEN if pct >= 50 else (YELLOW if pct >= 25 else RED), leading=12)),
            Paragraph(vs_str, ParagraphStyle('vsv', fontName='Courier-Bold', fontSize=9, textColor=vs_color, leading=12)),
        ])

    bm_t = make_standard_table(
        ["Domain", "BSAL", "Median", "P75", "Best-in-Class", "Pct", "vs Median"],
        rows, [42*mm, 18*mm, 18*mm, 18*mm, 25*mm, 16*mm, 18*mm], styles
    )
    elements.append(bm_t)
    return elements


# ─────────────────────────────────────────────────────────────────────────────
# PRIORITY ACTION PLAN
# ─────────────────────────────────────────────────────────────────────────────

def build_priority_actions(styles):
    elements = []
    elements += section_divider("10 — PRIORITY ACTION PLAN", styles)

    tier1_actions = [
        ("01", "CRITICAL", "Conduct formal climate scenario analysis",
         "Directly resolves TCFD Strategy.b and IFRS S2 Para 22 gaps. Raises Climate Resilience "
         "from 13.8 to ~53 (+39.2 pts). CIS impact: +2.0. Commission NGFS-aligned scenario analysis "
         "covering 2030/2040/2050 using Orderly, Disorderly, and Hot House pathways.",
         "3–4 months | ₹30–60 Lakhs | CFO + CSO + Board Committee"),
        ("02", "CRITICAL", "Submit SBTi Commitment Letter",
         "Target credibility moves from 30 to 65. Carbon Management rises from 33.0 to ~41.3. "
         "CIS impact: +1.5. Submit SBTi commitment at sbti.org. Engage SBTi Steel Sector Guidance (2023). "
         "Define interim 2030 absolute reduction target (minimum −42% per SBTi Steel).",
         "1 month | Low cost | Chief Sustainability Officer"),
        ("03", "CRITICAL", "Commission third-party ESG data assurance (ISAE 3000)",
         "Verification Status moves from 55 to 90. Confidence Score from 78 to ~86 (VERY HIGH). "
         "Unlocks credit-grade institutional investor access. Engage Big 4 or specialist firm "
         "(ERM, Apex, Bureau Veritas) for limited assurance on FY2025 Scope 1, Scope 2, water, waste data.",
         "2–3 months | ₹20–40 Lakhs | CFO + External Auditor"),
    ]

    tier2_actions = [
        ("04", "HIGH", "Publish standalone carbon inventory (ISO 14064)",
         "Data quality sub-score in Carbon Management rises from 60 to 85. CMS gains ~5 points. "
         "Resolves Scope 3 evidence gap. Commission ISO 14064-compliant GHG inventory covering all three Scopes.",
         "3–4 months | ₹15–25 Lakhs | Environment Team"),
        ("05", "HIGH", "Launch formal Supplier ESG Audit Programme",
         "Supply Chain score rises from 19.3 toward 35+ over 2–3 years. Set target: 40% Tier 1 "
         "coverage by FY2026. Start with top 20 suppliers by spend. Issue ESG questionnaire. On-site audit top 5.",
         "6–9 months ongoing | ₹10–20 Lakhs | Procurement + CSO"),
        ("06", "HIGH", "Commission physical risk assessment — both sites",
         "Physical Risk score rises to ~60. Closes TCFD Risk Management.a gap. Enables IFRS S2 Para 9 disclosure. "
         "Engage climate risk advisory for Raipur + Vizag site-level assessment under IPCC AR6 RCP 4.5 and 8.5.",
         "3–4 months | ₹25–40 Lakhs | Operations + CSO"),
        ("07", "HIGH", "Expand executive climate KPIs across full C-suite",
         "Executive accountability from 40 to 75. Governance rises from 59.8 to ~65. "
         "Introduce Scope 1 intensity, water recycling rate, supplier audit coverage as C-suite KPIs "
         "with 15–20% weighting of variable pay. Board NRC approval required.",
         "1–2 months | Internal | Board NRC + CEO"),
    ]

    elements.append(Paragraph("TIER 1 — CRITICAL  (within 6 months)", ParagraphStyle(
        'tier', fontName='Helvetica-Bold', fontSize=9, textColor=RED,
        letterSpacing=1, spaceBefore=2*mm, spaceAfter=2*mm
    )))

    for action in tier1_actions:
        num, tier, title, body, effort = action
        action_data = [[
            Paragraph(num, ParagraphStyle('anum', fontName='Courier-Bold', fontSize=16,
                      textColor=RED if tier == 'CRITICAL' else YELLOW, leading=20)),
            Table([[
                Paragraph(title, ParagraphStyle('atitle', fontName='Helvetica-Bold', fontSize=9,
                          textColor=WHITE, leading=13, spaceAfter=1.5*mm)),
                Paragraph(body, styles['body_small']),
                Paragraph(f"Effort: {effort}", ParagraphStyle('aeff', fontName='Helvetica',
                          fontSize=7.5, textColor=CYAN, leading=11, spaceBefore=1.5*mm)),
            ]], colWidths=[CONTENT_W - 18*mm]),
        ]]
        at = Table(action_data, colWidths=[14*mm, CONTENT_W - 14*mm])
        at.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), SURFACE_2),
            ('BOX', (0,0), (-1,-1), 0.5,
             RED if tier == 'CRITICAL' else YELLOW),
            ('LEFTPADDING', (0,0), (-1,-1), 5),
            ('TOPPADDING', (0,0), (-1,-1), 5),
            ('BOTTOMPADDING', (0,0), (-1,-1), 5),
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ]))
        elements.append(at)
        elements.append(Spacer(1, 1.5*mm))

    elements.append(Paragraph("TIER 2 — HIGH PRIORITY  (within 12 months)", ParagraphStyle(
        'tier', fontName='Helvetica-Bold', fontSize=9, textColor=YELLOW,
        letterSpacing=1, spaceBefore=3*mm, spaceAfter=2*mm
    )))

    for action in tier2_actions:
        num, tier, title, body, effort = action
        action_data = [[
            Paragraph(num, ParagraphStyle('anum', fontName='Courier-Bold', fontSize=16,
                      textColor=YELLOW, leading=20)),
            Table([[
                Paragraph(title, ParagraphStyle('atitle', fontName='Helvetica-Bold', fontSize=9,
                          textColor=WHITE, leading=13, spaceAfter=1.5*mm)),
                Paragraph(body, styles['body_small']),
                Paragraph(f"Effort: {effort}", ParagraphStyle('aeff', fontName='Helvetica',
                          fontSize=7.5, textColor=CYAN, leading=11, spaceBefore=1.5*mm)),
            ]], colWidths=[CONTENT_W - 18*mm]),
        ]]
        at = Table(action_data, colWidths=[14*mm, CONTENT_W - 14*mm])
        at.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), SURFACE),
            ('BOX', (0,0), (-1,-1), 0.5, BORDER_STR),
            ('LEFTPADDING', (0,0), (-1,-1), 5),
            ('TOPPADDING', (0,0), (-1,-1), 5),
            ('BOTTOMPADDING', (0,0), (-1,-1), 5),
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ]))
        elements.append(at)
        elements.append(Spacer(1, 1.5*mm))

    return elements


# ─────────────────────────────────────────────────────────────────────────────
# RATING RATIONALE & INVESTOR GUIDANCE
# ─────────────────────────────────────────────────────────────────────────────

def build_rating_rationale(styles):
    elements = []
    elements += section_divider("11 — RATING RATIONALE & INSTITUTIONAL GUIDANCE", styles)

    elements.append(Paragraph("Rating: B (40.3)  |  Outlook: STABLE / POSITIVE POTENTIAL", styles['h2']))
    elements.append(Spacer(1, 1*mm))

    # Positives and negatives side by side
    pos = [
        "Consistent BRSR Core disclosure — evidence-verified",
        "Board ESG committee with documented mandate (FY2022)",
        "Paris-aligned Scope 1 intensity trajectory: −2.94%/yr",
        "ZLD system at Raipur — verified CPCB certificate",
        "PAT Scheme Cycle 5 target achieved",
        "Disclosure Quality at 78th peer percentile",
        "HIGH confidence (78) — current, near-complete data",
    ]
    neg = [
        "Scope 1 intensity above sector median → zero performance score",
        "No scenario analysis of any kind conducted or disclosed",
        "Net-Zero 2050 claim with no roadmap or CAPEX plan",
        "Supply chain near-bottom of cohort (12% coverage)",
        "Energy intensity 18.2% above sector median",
        "Climate Resilience at bottom decile (8th percentile)",
        "No third-party ESG data assurance",
    ]

    pos_col = [[Paragraph("POSITIVE FACTORS", ParagraphStyle('ph', fontName='Helvetica-Bold',
                fontSize=7.5, textColor=GREEN, letterSpacing=1, leading=11, spaceAfter=2*mm))]]
    for p in pos:
        pos_col.append([Paragraph(f"+ {p}", ParagraphStyle('pi', fontName='Helvetica',
                        fontSize=8, textColor=WHITE_80, leading=12))])

    neg_col = [[Paragraph("NEGATIVE FACTORS", ParagraphStyle('nh', fontName='Helvetica-Bold',
                fontSize=7.5, textColor=RED, letterSpacing=1, leading=11, spaceAfter=2*mm))]]
    for n in neg:
        neg_col.append([Paragraph(f"− {n}", ParagraphStyle('ni', fontName='Helvetica',
                        fontSize=8, textColor=WHITE_80, leading=12))])

    pos_t = Table(pos_col, colWidths=[(CONTENT_W/2) - 2*mm])
    pos_t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), SURFACE),
        ('BACKGROUND', (0,0), (-1,0), SURFACE_2),
        ('BOX', (0,0), (-1,-1), 0.5, BORDER_STR),
        ('LINEBELOW', (0,0), (-1,0), 0.5, GREEN),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
    ]))

    neg_t = Table(neg_col, colWidths=[(CONTENT_W/2) - 2*mm])
    neg_t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), SURFACE),
        ('BACKGROUND', (0,0), (-1,0), SURFACE_2),
        ('BOX', (0,0), (-1,-1), 0.5, BORDER_STR),
        ('LINEBELOW', (0,0), (-1,0), 0.5, RED),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
    ]))

    pn_outer = Table([[pos_t, neg_t]], colWidths=[CONTENT_W/2, CONTENT_W/2])
    pn_outer.setStyle(TableStyle([
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    elements.append(pn_outer)
    elements.append(Spacer(1, 3*mm))

    # Upgrade triggers
    elements.append(Paragraph("Upgrade Triggers (to BB or BB+)", styles['h3']))
    triggers = [
        "SBTi commitment submitted (achievable in <3 months)",
        "Third-party ISAE 3000 assurance on FY2025 sustainability data",
        "Scope 1 intensity falls below 1.85 tCO2e/t (on trajectory: FY2027)",
        "Formal climate scenario analysis published (TCFD-aligned)",
    ]
    for t in triggers:
        elements.append(Paragraph(f"  ▸  {t}", ParagraphStyle('trig', fontName='Helvetica', fontSize=8.5,
                        textColor=CYAN, leading=14)))
    elements.append(Spacer(1, 2*mm))

    # Investor guidance table
    elements.append(Paragraph("Institutional Investor Guidance", styles['h3']))
    inv_data = [
        [Paragraph("ESG / Climate equity fund", styles['table_cell']),
         Paragraph("CONDITIONAL HOLD", ParagraphStyle('ig', fontName='Helvetica-Bold', fontSize=8.5, textColor=YELLOW, leading=12)),
         Paragraph("Monitor SBTi submission. Below Paris-aligned threshold for most mandates.", styles['body_small'])],
        [Paragraph("Investment grade bond / NCD", styles['table_cell']),
         Paragraph("REQUIRES IMPROVEMENT", ParagraphStyle('ig', fontName='Helvetica-Bold', fontSize=8.5, textColor=colors.HexColor('#F97316'), leading=12)),
         Paragraph("Commission ESG assurance before credit mandate. Confidence HIGH but not VERY HIGH.", styles['body_small'])],
        [Paragraph("Green / sustainability-linked bond", styles['table_cell']),
         Paragraph("NOT ELIGIBLE (current)", ParagraphStyle('ig', fontName='Helvetica-Bold', fontSize=8.5, textColor=RED, leading=12)),
         Paragraph("No SBTi target. No verified KPI framework. Eligible after SBTi + scenario analysis.", styles['body_small'])],
        [Paragraph("Infrastructure / project finance", styles['table_cell']),
         Paragraph("PROCEED WITH CONDITIONS", ParagraphStyle('ig', fontName='Helvetica-Bold', fontSize=8.5, textColor=CYAN, leading=12)),
         Paragraph("Physical risk assessment required as loan condition. Carbon pricing stress-test in project model.", styles['body_small'])],
        [Paragraph("Pension fund (Paris-aligned mandate)", styles['table_cell']),
         Paragraph("BELOW THRESHOLD", ParagraphStyle('ig', fontName='Helvetica-Bold', fontSize=8.5, textColor=RED, leading=12)),
         Paragraph("B rating (28th pct) below typical PA mandate minimums (BB+ / A). Reassess in 12 months.", styles['body_small'])],
    ]
    inv_t = make_standard_table(
        ["Use Case", "Suitability", "Rationale"],
        inv_data, [48*mm, 42*mm, 85*mm], styles
    )
    elements.append(inv_t)
    elements.append(Spacer(1, 4*mm))

    # Signature block
    sig_data = [[
        Paragraph("CLIMATE INTELLIGENCE SCORE", styles['table_header']),
        Paragraph("CONFIDENCE", styles['table_header']),
        Paragraph("OUTLOOK", styles['table_header']),
        Paragraph("ASSESSMENT ID", styles['table_header']),
        Paragraph("ENGINE", styles['table_header']),
    ],[
        Paragraph("<b>B  (40.3)</b>", ParagraphStyle('sv', fontName='Courier-Bold', fontSize=11,
                  textColor=colors.HexColor('#F97316'), leading=14)),
        Paragraph("<b>HIGH (78)</b>", ParagraphStyle('sv', fontName='Courier-Bold', fontSize=11,
                  textColor=CYAN, leading=14)),
        Paragraph("<b>STABLE / POS.</b>", ParagraphStyle('sv', fontName='Courier-Bold', fontSize=11,
                  textColor=YELLOW, leading=14)),
        Paragraph("CX-2026-BSAL-001", ParagraphStyle('sv', fontName='Courier', fontSize=9,
                  textColor=WHITE_60, leading=13)),
        Paragraph("v1.0  |  June 2026", ParagraphStyle('sv', fontName='Courier', fontSize=9,
                  textColor=WHITE_60, leading=13)),
    ]]
    sig_t = Table(sig_data, colWidths=[42*mm, 30*mm, 32*mm, 40*mm, 31*mm])
    sig_t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), SURFACE_3),
        ('BOX', (0,0), (-1,-1), 1.0, AMBER),
        ('LINEBELOW', (0,0), (-1,0), 0.5, BORDER_STR),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    elements.append(sig_t)

    return elements


# ─────────────────────────────────────────────────────────────────────────────
# MAIN BUILD
# ─────────────────────────────────────────────────────────────────────────────

def build_pdf():
    page_num_holder = [0]

    doc = BaseDocTemplate(
        OUTPUT_PATH,
        pagesize=A4,
        leftMargin=MARGIN_L,
        rightMargin=MARGIN_R,
        topMargin=MARGIN_T,
        bottomMargin=MARGIN_B,
        title="BSAL Climate Intelligence Report — Climactix Global",
        author="Climactix Global Intelligence Engine",
        subject="Climate Intelligence Assessment FY2024",
        creator="Climactix Global v1.0",
    )

    page_tmpl = make_page_template(doc, page_num_holder)
    doc.addPageTemplates([page_tmpl])

    styles = build_styles()
    elements = []

    # Cover
    elements += build_cover_page(styles)

    # Executive Summary
    elements += build_executive_summary(styles)

    # Scorecard
    elements += build_scorecard(styles)

    # Domain analyses
    elements += build_governance(styles)
    elements.append(PageBreak())

    elements += build_carbon_management(styles)
    elements.append(PageBreak())

    elements += build_physical_risk(styles)
    elements += build_transition_risk(styles)
    elements.append(PageBreak())

    elements += build_supply_chain(styles)
    elements.append(Spacer(1, 4*mm))

    # Simulation
    elements += build_simulation(styles)
    elements.append(PageBreak())

    # Benchmarking
    elements += build_benchmarking(styles)
    elements.append(Spacer(1, 4*mm))

    # Priority actions
    elements += build_priority_actions(styles)
    elements.append(PageBreak())

    # Rating rationale
    elements += build_rating_rationale(styles)

    doc.build(elements)
    print(f"PDF generated: {OUTPUT_PATH}")
    size_mb = os.path.getsize(OUTPUT_PATH) / (1024 * 1024)
    print(f"File size: {size_mb:.2f} MB")


if __name__ == "__main__":
    build_pdf()
