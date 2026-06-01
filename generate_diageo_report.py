"""
Climactix Global — Diageo-Style Institutional Report Generator
Reference: Diageo Climate Transition Plan 2026
Typography: Georgia (display/serif) + Arial (body/sans) + Courier New (data)
Design: White/cream backgrounds, section accent colors, clean institutional layout
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer,
    Table, TableStyle, HRFlowable, PageBreak, Flowable, KeepTogether
)
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os

# ─────────────────────────────────────────────────────────────────────────────
# REGISTER FONTS
# ─────────────────────────────────────────────────────────────────────────────
FONT_PATH = "/System/Library/Fonts/Supplemental/"

pdfmetrics.registerFont(TTFont("Georgia", FONT_PATH + "Georgia.ttf"))
pdfmetrics.registerFont(TTFont("Georgia-Bold", FONT_PATH + "Georgia Bold.ttf"))
pdfmetrics.registerFont(TTFont("Georgia-Italic", FONT_PATH + "Georgia Italic.ttf"))
pdfmetrics.registerFont(TTFont("Georgia-BoldItalic", FONT_PATH + "Georgia Bold Italic.ttf"))
pdfmetrics.registerFont(TTFont("Arial", FONT_PATH + "Arial.ttf"))
pdfmetrics.registerFont(TTFont("Arial-Bold", FONT_PATH + "Arial Bold.ttf"))
pdfmetrics.registerFont(TTFont("Arial-Italic", FONT_PATH + "Arial Italic.ttf"))
pdfmetrics.registerFont(TTFont("Arial-BoldItalic", FONT_PATH + "Arial Bold Italic.ttf"))
pdfmetrics.registerFont(TTFont("CourierNew", FONT_PATH + "Courier New.ttf"))
pdfmetrics.registerFont(TTFont("CourierNew-Bold", FONT_PATH + "Courier New Bold.ttf"))

pdfmetrics.registerFontFamily(
    "Georgia",
    normal="Georgia", bold="Georgia-Bold",
    italic="Georgia-Italic", boldItalic="Georgia-BoldItalic"
)
pdfmetrics.registerFontFamily(
    "Arial",
    normal="Arial", bold="Arial-Bold",
    italic="Arial-Italic", boldItalic="Arial-BoldItalic"
)

# ─────────────────────────────────────────────────────────────────────────────
# COLOR PALETTE — Diageo-Inspired Institutional
# ─────────────────────────────────────────────────────────────────────────────
WHITE       = colors.HexColor("#FFFFFF")
CREAM       = colors.HexColor("#F8F5F0")
CREAM_LIGHT = colors.HexColor("#FAF8F4")
TEXT_DARK   = colors.HexColor("#1C1C1C")
TEXT_MED    = colors.HexColor("#4A4A4A")
TEXT_LIGHT  = colors.HexColor("#7A7A7A")
TEXT_MUTED  = colors.HexColor("#AAAAAA")
BORDER_L    = colors.HexColor("#E8E4DC")
BORDER_M    = colors.HexColor("#C8C0B0")

# Section accent colors
S01_GREEN   = colors.HexColor("#2A5C45")   # Ambition & Targets (forest green)
S02_PURPLE  = colors.HexColor("#5B4A82")   # Physical Risk (deep purple)
S03_SIENNA  = colors.HexColor("#7A4520")   # Transition Risk (burnt sienna)
S04_BLUE    = colors.HexColor("#2C5F8A")   # Supply Chain (deep blue)
S05_ROSE    = colors.HexColor("#B5524A")   # Governance (warm rose)
S06_OLIVE   = colors.HexColor("#4A6830")   # Disclosure (olive green)
S_APP       = colors.HexColor("#3A3A3A")   # Appendices (dark grey)

# Accent gold used across report
GOLD        = colors.HexColor("#C8963A")
GOLD_LIGHT  = colors.HexColor("#F5E8CC")

# Risk colors
RISK_CRITICAL = colors.HexColor("#B03020")
RISK_HIGH     = colors.HexColor("#D4621A")
RISK_MED      = colors.HexColor("#C89A1A")
RISK_LOW      = colors.HexColor("#2A7A40")
RISK_GOOD     = colors.HexColor("#1A6B42")

PAGE_W, PAGE_H = A4
MARGIN_L = 20*mm
MARGIN_R = 20*mm
MARGIN_T = 18*mm
MARGIN_B = 16*mm
CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R

OUTPUT_PATH = "/Users/rushikeshkulkarni/Desktop/Climatix-global/BSAL_CIS_REPORT_INSTITUTIONAL.pdf"

# ─────────────────────────────────────────────────────────────────────────────
# STYLES
# ─────────────────────────────────────────────────────────────────────────────
def S(name, **kwargs):
    return ParagraphStyle(name, **kwargs)

def build_styles():
    return {
        # Display / Cover
        "company_name": S("company_name", fontName="Georgia-Bold", fontSize=30,
                          textColor=TEXT_DARK, leading=36, spaceAfter=3*mm),
        "company_sub": S("company_sub", fontName="Arial", fontSize=11,
                         textColor=TEXT_LIGHT, leading=16, spaceAfter=2*mm),
        "cover_label": S("cover_label", fontName="Arial-Bold", fontSize=7.5,
                         textColor=TEXT_MUTED, leading=11, letterSpacing=1.5),
        "cover_value": S("cover_value", fontName="Georgia-Bold", fontSize=13,
                         textColor=TEXT_DARK, leading=18),
        "cover_value_sm": S("cover_value_sm", fontName="Arial", fontSize=9,
                            textColor=TEXT_MED, leading=13),

        # Section divider
        "section_num": S("section_num", fontName="Georgia-Bold", fontSize=52,
                         textColor=WHITE, leading=58),
        "section_title": S("section_title", fontName="Georgia-BoldItalic", fontSize=34,
                           textColor=WHITE, leading=42),
        "section_subtitle": S("section_subtitle", fontName="Arial", fontSize=13,
                              textColor=colors.HexColor("#DDDDDD"), leading=18),

        # Content headers
        "brand_label": S("brand_label", fontName="Arial-Bold", fontSize=7.5,
                         textColor=TEXT_MUTED, letterSpacing=2, leading=11, spaceAfter=1*mm),
        "h1": S("h1", fontName="Georgia-Bold", fontSize=20,
                textColor=TEXT_DARK, leading=26, spaceBefore=4*mm, spaceAfter=2*mm),
        "h1_italic": S("h1_italic", fontName="Georgia-BoldItalic", fontSize=20,
                       textColor=TEXT_DARK, leading=26, spaceBefore=4*mm, spaceAfter=2*mm),
        "h2": S("h2", fontName="Georgia-Bold", fontSize=13,
                textColor=TEXT_DARK, leading=18, spaceBefore=4*mm, spaceAfter=1.5*mm),
        "h3": S("h3", fontName="Arial-Bold", fontSize=8,
                textColor=TEXT_MED, leading=12, letterSpacing=1.5,
                spaceBefore=3*mm, spaceAfter=1*mm),
        "h3_colored": S("h3_colored", fontName="Arial-Bold", fontSize=8,
                        textColor=S01_GREEN, leading=12, letterSpacing=1.5,
                        spaceBefore=3*mm, spaceAfter=1*mm),

        # Body
        "body": S("body", fontName="Arial", fontSize=9.5,
                  textColor=TEXT_MED, leading=15.5, spaceAfter=3*mm, alignment=TA_JUSTIFY),
        "body_sm": S("body_sm", fontName="Arial", fontSize=8.5,
                     textColor=TEXT_LIGHT, leading=13.5, spaceAfter=2*mm),
        "body_lead": S("body_lead", fontName="Georgia-Italic", fontSize=12,
                       textColor=TEXT_DARK, leading=18, spaceAfter=3*mm, alignment=TA_JUSTIFY),

        # Pull quote
        "pull_quote": S("pull_quote", fontName="Georgia-Italic", fontSize=13,
                        textColor=TEXT_DARK, leading=20, spaceAfter=1*mm, alignment=TA_LEFT),
        "pull_quote_attr": S("pull_quote_attr", fontName="Arial-Bold", fontSize=8,
                             textColor=TEXT_LIGHT, leading=12),

        # Data
        "big_number": S("big_number", fontName="Georgia-Bold", fontSize=36,
                        textColor=TEXT_DARK, leading=42),
        "big_number_label": S("big_number_label", fontName="Arial", fontSize=9,
                              textColor=TEXT_LIGHT, leading=13),
        "data_value": S("data_value", fontName="CourierNew-Bold", fontSize=11,
                        textColor=TEXT_DARK, leading=15),
        "data_label": S("data_label", fontName="Arial", fontSize=8,
                        textColor=TEXT_LIGHT, leading=12),

        # Table
        "th": S("th", fontName="Arial-Bold", fontSize=7.5,
                textColor=TEXT_LIGHT, leading=11, letterSpacing=0.5),
        "td": S("td", fontName="Arial", fontSize=8.5,
                textColor=TEXT_MED, leading=13),
        "td_bold": S("td_bold", fontName="Arial-Bold", fontSize=8.5,
                     textColor=TEXT_DARK, leading=13),
        "td_mono": S("td_mono", fontName="CourierNew-Bold", fontSize=9,
                     textColor=TEXT_DARK, leading=13),
        "td_risk_critical": S("td_risk_critical", fontName="Arial-Bold", fontSize=8.5,
                              textColor=RISK_CRITICAL, leading=13),
        "td_risk_high": S("td_risk_high", fontName="Arial-Bold", fontSize=8.5,
                          textColor=RISK_HIGH, leading=13),
        "td_risk_low": S("td_risk_low", fontName="Arial-Bold", fontSize=8.5,
                         textColor=RISK_LOW, leading=13),
        "td_good": S("td_good", fontName="Arial-Bold", fontSize=8.5,
                     textColor=RISK_GOOD, leading=13),

        # Footer / disclaimer
        "footer": S("footer", fontName="Arial", fontSize=6.5,
                    textColor=TEXT_MUTED, leading=10),
        "disclaimer": S("disclaimer", fontName="Arial", fontSize=7.5,
                        textColor=TEXT_LIGHT, leading=11, alignment=TA_JUSTIFY),
    }

# ─────────────────────────────────────────────────────────────────────────────
# CUSTOM FLOWABLES
# ─────────────────────────────────────────────────────────────────────────────

class SectionDividerPage(Flowable):
    """Full-page section divider in Diageo style — solid color + white text"""
    def __init__(self, number, title, subtitle, accent_color):
        Flowable.__init__(self)
        self.number = number
        self.title = title
        self.subtitle = subtitle
        self.accent = accent_color
        self.width = PAGE_W
        self.height = PAGE_H

    def draw(self):
        c = self.canv
        w, h = PAGE_W, PAGE_H
        c.setFillColor(self.accent)
        c.rect(0, 0, w, h, fill=1, stroke=0)

        # Subtle texture — semi-transparent white rectangle top right
        c.setFillColor(WHITE)
        c.setFillAlpha(0.06)
        c.rect(w * 0.55, h * 0.3, w * 0.5, h * 0.5, fill=1, stroke=0)
        c.setFillAlpha(1.0)

        # Top white strip
        c.setFillColor(WHITE)
        c.setFillAlpha(0.08)
        c.rect(0, h - 14*mm, w, 14*mm, fill=1, stroke=0)
        c.setFillAlpha(1.0)

        # Top label
        c.setFillColor(WHITE)
        c.setFillAlpha(0.55)
        c.setFont("Arial", 8)
        c.drawString(MARGIN_L, h - 9*mm, "CLIMACTIX GLOBAL  ·  CLIMATE INTELLIGENCE REPORT")
        c.setFillAlpha(1.0)

        # Section number — bottom third
        c.setFillColor(WHITE)
        c.setFillAlpha(0.15)
        c.setFont("Georgia-Bold", 120)
        c.drawString(MARGIN_L - 4*mm, 38*mm, self.number)
        c.setFillAlpha(1.0)

        # Section title
        c.setFillColor(WHITE)
        c.setFont("Georgia-Bold", 38)
        title_y = 52*mm
        c.drawString(MARGIN_L, title_y, self.number + ".")
        c.setFont("Georgia-BoldItalic", 38)
        c.drawString(MARGIN_L + 28*mm, title_y, self.title)

        # Subtitle
        c.setFillColor(WHITE)
        c.setFillAlpha(0.72)
        c.setFont("Arial", 13)
        c.drawString(MARGIN_L, 40*mm, self.subtitle)
        c.setFillAlpha(1.0)

        # Bottom rule
        c.setStrokeColor(WHITE)
        c.setStrokeAlpha(0.20)
        c.setLineWidth(0.5)
        c.line(MARGIN_L, 20*mm, w - MARGIN_R, 20*mm)
        c.setStrokeAlpha(1.0)


class ScorePanel(Flowable):
    """Score display panel — rating + score + bar, Diageo style"""
    def __init__(self, domain, rating, score, peer_pct, maturity,
                 accent_color=None, width=None):
        Flowable.__init__(self)
        self.domain = domain
        self.rating = rating
        self.score = score
        self.peer_pct = peer_pct
        self.maturity = maturity
        self.accent = accent_color or S01_GREEN
        self.width = width or CONTENT_W
        self.height = 14*mm

    def draw(self):
        c = self.canv
        w = self.width
        h = self.height

        # Background
        c.setFillColor(CREAM_LIGHT)
        c.rect(0, 0, w, h, fill=1, stroke=0)

        # Left accent strip
        c.setFillColor(self.accent)
        c.rect(0, 0, 3, h, fill=1, stroke=0)

        # Score bar background
        bar_x = 6*mm
        bar_y = 4.5*mm
        bar_w = w * 0.38
        bar_h = 3.5*mm
        c.setFillColor(BORDER_L)
        c.rect(bar_x, bar_y, bar_w, bar_h, fill=1, stroke=0)

        # Score fill
        fill_w = (self.score / 100.0) * bar_w
        risk_colors = {
            "CRITICAL": RISK_CRITICAL, "HIGH": RISK_HIGH, "MEDIUM": RISK_MED,
        }
        fill_color = self.accent
        if self.score < 30:
            fill_color = RISK_CRITICAL
        elif self.score < 50:
            fill_color = RISK_HIGH
        elif self.score < 65:
            fill_color = RISK_MED
        c.setFillColor(fill_color)
        c.rect(bar_x, bar_y, fill_w, bar_h, fill=1, stroke=0)

        # Domain label
        c.setFillColor(TEXT_DARK)
        c.setFont("Arial-Bold", 8.5)
        c.drawString(6*mm, h - 5.5*mm, self.domain.upper())

        # Score number
        c.setFont("CourierNew-Bold", 11)
        c.setFillColor(fill_color)
        score_x = bar_x + bar_w + 4*mm
        c.drawString(score_x, bar_y + 1.5*mm, f"{self.score:.0f}")

        # Rating
        c.setFont("Georgia-Bold", 10)
        rating_x = score_x + 14*mm
        c.drawString(rating_x, bar_y + 1.5*mm, self.rating)

        # Peer percentile
        c.setFont("Arial", 7.5)
        c.setFillColor(TEXT_LIGHT)
        peer_x = rating_x + 18*mm
        c.drawString(peer_x, bar_y + 1.5*mm, f"{self.peer_pct}th pct")

        # Maturity label
        mat_colors = {
            "ADVANCED": RISK_GOOD, "PROGRESSING": S04_BLUE,
            "DEVELOPING": RISK_MED, "LAGGARD": RISK_HIGH,
            "ELEVATED": RISK_HIGH,
        }
        mat_color = mat_colors.get(self.maturity.split()[0], TEXT_LIGHT)
        c.setFont("Arial-Bold", 7)
        c.setFillColor(mat_color)
        c.drawRightString(w - 4*mm, bar_y + 1.5*mm, self.maturity)


class AccentBar(Flowable):
    """Thin colored top rule for sections"""
    def __init__(self, color, width=None, height=2.5):
        Flowable.__init__(self)
        self.bar_color = color
        self.width = width or CONTENT_W
        self.height = height + 2

    def draw(self):
        self.canv.setFillColor(self.bar_color)
        self.canv.rect(0, 1, self.width, self.height - 2, fill=1, stroke=0)


class ColorBlock(Flowable):
    """Solid color rectangle — for callout box backgrounds"""
    def __init__(self, w, h, color):
        Flowable.__init__(self)
        self.rect_w = w
        self.rect_h = h
        self.block_color = color
        self.width = w
        self.height = h

    def draw(self):
        self.canv.setFillColor(self.block_color)
        self.canv.rect(0, 0, self.rect_w, self.rect_h, fill=1, stroke=0)


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def callout_box(text_or_paragraphs, st, accent=S01_GREEN, bg=None,
                left_bar=True, padding=5):
    """Creates a styled callout box"""
    bg = bg or CREAM
    if isinstance(text_or_paragraphs, str):
        content = [Paragraph(text_or_paragraphs, st["body"])]
    else:
        content = text_or_paragraphs

    inner = Table([[c] for c in content],
                  colWidths=[CONTENT_W - (4 if left_bar else 0)*mm - 12])
    inner.setStyle(TableStyle([
        ("LEFTPADDING", (0,0), (-1,-1), 0),
        ("RIGHTPADDING", (0,0), (-1,-1), 0),
        ("TOPPADDING", (0,0), (-1,-1), 0),
        ("BOTTOMPADDING", (0,0), (-1,-1), 2),
    ]))

    if left_bar:
        outer_data = [[ColorBlock(2.5*mm, 20, accent), inner]]
        outer = Table(outer_data, colWidths=[2.5*mm, CONTENT_W - 2.5*mm])
        outer.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,-1), bg),
            ("LEFTPADDING", (0,0), (-1,-1), 0),
            ("RIGHTPADDING", (0,0), (-1,-1), padding),
            ("TOPPADDING", (0,0), (-1,-1), padding),
            ("BOTTOMPADDING", (0,0), (-1,-1), padding),
            ("VALIGN", (0,0), (-1,-1), "TOP"),
        ]))
    else:
        outer_data = [[inner]]
        outer = Table(outer_data, colWidths=[CONTENT_W])
        outer.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,-1), bg),
            ("LEFTPADDING", (0,0), (-1,-1), padding),
            ("RIGHTPADDING", (0,0), (-1,-1), padding),
            ("TOPPADDING", (0,0), (-1,-1), padding),
            ("BOTTOMPADDING", (0,0), (-1,-1), padding),
        ]))
    return outer


def two_col(left_content, right_content, left_pct=0.60):
    """Two-column layout"""
    left_w = CONTENT_W * left_pct - 3*mm
    right_w = CONTENT_W * (1 - left_pct) - 3*mm

    left_table = Table([[item] for item in left_content], colWidths=[left_w])
    left_table.setStyle(TableStyle([
        ("LEFTPADDING", (0,0), (-1,-1), 0),
        ("RIGHTPADDING", (0,0), (-1,-1), 0),
        ("TOPPADDING", (0,0), (-1,-1), 0),
        ("BOTTOMPADDING", (0,0), (-1,-1), 2),
    ]))

    right_table = Table([[item] for item in right_content], colWidths=[right_w])
    right_table.setStyle(TableStyle([
        ("LEFTPADDING", (0,0), (-1,-1), 0),
        ("RIGHTPADDING", (0,0), (-1,-1), 0),
        ("TOPPADDING", (0,0), (-1,-1), 0),
        ("BOTTOMPADDING", (0,0), (-1,-1), 2),
    ]))

    outer = Table([[left_table, Spacer(6*mm, 1), right_table]],
                  colWidths=[left_w, 6*mm, right_w])
    outer.setStyle(TableStyle([
        ("LEFTPADDING", (0,0), (-1,-1), 0),
        ("RIGHTPADDING", (0,0), (-1,-1), 0),
        ("TOPPADDING", (0,0), (-1,-1), 0),
        ("BOTTOMPADDING", (0,0), (-1,-1), 0),
        ("VALIGN", (0,0), (-1,-1), "TOP"),
    ]))
    return outer


def clean_table(headers, rows, col_widths, st, accent=S01_GREEN):
    header_cells = [Paragraph(h, st["th"]) for h in headers]
    table_data = [header_cells] + rows
    t = Table(table_data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#F0EDE6")),
        ("LINEBELOW", (0,0), (-1,0), 1.0, accent),
        ("LINEBELOW", (0,1), (-1,-1), 0.3, BORDER_L),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [WHITE, CREAM_LIGHT]),
        ("LEFTPADDING", (0,0), (-1,-1), 5),
        ("RIGHTPADDING", (0,0), (-1,-1), 5),
        ("TOPPADDING", (0,0), (-1,-1), 4),
        ("BOTTOMPADDING", (0,0), (-1,-1), 4),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
    ]))
    return t


def section_label(text, st, color=TEXT_MUTED):
    """Small ALL-CAPS label above section heading"""
    return Paragraph(text.upper(), ParagraphStyle(
        "section_label_" + text[:8],
        fontName="Arial-Bold", fontSize=7.5, textColor=color,
        leading=11, letterSpacing=2, spaceAfter=0.5*mm
    ))


def stat_box(number, unit, label, accent=S01_GREEN):
    """Large metric display (like Diageo's 38,000 tonnes display)"""
    data = [[
        Paragraph(number, ParagraphStyle("sn", fontName="Georgia-Bold", fontSize=28,
                  textColor=accent, leading=32)),
        Paragraph(unit + "\n" + label,
                  ParagraphStyle("sl", fontName="Arial", fontSize=9,
                                 textColor=TEXT_LIGHT, leading=14))
    ]]
    t = Table(data, colWidths=[None, None])
    t.setStyle(TableStyle([
        ("LEFTPADDING", (0,0), (-1,-1), 0),
        ("RIGHTPADDING", (0,0), (-1,-1), 0),
        ("TOPPADDING", (0,0), (-1,-1), 0),
        ("BOTTOMPADDING", (0,0), (-1,-1), 0),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("LINEBELOW", (0,-1), (-1,-1), 0.5, BORDER_L),
    ]))
    return t


# ─────────────────────────────────────────────────────────────────────────────
# PAGE TEMPLATE
# ─────────────────────────────────────────────────────────────────────────────

def make_page_template(doc):
    def on_page(cv, doc):
        cv.saveState()
        w, h = A4

        # Top accent line (3pt gold)
        cv.setFillColor(GOLD)
        cv.rect(0, h - 2.5*mm, w, 2.5*mm, fill=1, stroke=0)

        # Header strip
        cv.setFillColor(CREAM)
        cv.rect(0, h - 12*mm, w, 9.5*mm, fill=1, stroke=0)

        cv.setFillColor(TEXT_MUTED)
        cv.setFont("Arial", 7)
        cv.drawString(MARGIN_L, h - 8.5*mm, "CLIMACTIX GLOBAL  ·  CLIMATE INTELLIGENCE ASSESSMENT REPORT")

        cv.setFillColor(TEXT_LIGHT)
        cv.setFont("Arial-Bold", 7)
        cv.drawRightString(w - MARGIN_R, h - 8.5*mm,
                           "BHARAT STEEL & ALLOYS LTD.  ·  FY2024  ·  CONFIDENTIAL")

        # Header bottom rule
        cv.setStrokeColor(BORDER_L)
        cv.setLineWidth(0.5)
        cv.line(MARGIN_L, h - 12*mm, w - MARGIN_R, h - 12*mm)

        # Footer rule
        cv.line(MARGIN_L, MARGIN_B + 5*mm, w - MARGIN_R, MARGIN_B + 5*mm)

        # Footer
        cv.setFillColor(TEXT_MUTED)
        cv.setFont("Arial", 6.5)
        cv.drawString(MARGIN_L, MARGIN_B + 2*mm,
                      "For authorized recipients only  ·  Not investment advice  ·  "
                      "© 2026 Climactix Global  ·  Assessment ID: CX-2026-BSAL-001")

        cv.setFillColor(TEXT_MED)
        cv.setFont("Arial-Bold", 7)
        cv.drawRightString(w - MARGIN_R, MARGIN_B + 2*mm, str(doc.page))

        cv.restoreState()

    def on_cover(cv, doc):
        cv.saveState()
        w, h = A4
        # Gold top bar (thicker on cover)
        cv.setFillColor(GOLD)
        cv.rect(0, h - 3*mm, w, 3*mm, fill=1, stroke=0)
        # No header/footer text on cover
        cv.restoreState()

    main_frame = Frame(
        MARGIN_L, MARGIN_B + 8*mm,
        CONTENT_W, PAGE_H - MARGIN_T - MARGIN_B - 22*mm,
        leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0
    )
    cover_frame = Frame(
        MARGIN_L, MARGIN_B,
        CONTENT_W, PAGE_H - MARGIN_T - MARGIN_B,
        leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0
    )
    div_frame = Frame(0, 0, PAGE_W, PAGE_H,
                      leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)

    return [
        PageTemplate(id="cover", frames=[cover_frame], onPage=on_cover),
        PageTemplate(id="main",  frames=[main_frame],  onPage=on_page),
        PageTemplate(id="divider", frames=[div_frame], onPage=lambda cv, doc: None),
    ]


# ─────────────────────────────────────────────────────────────────────────────
# CONTENT BUILDERS
# ─────────────────────────────────────────────────────────────────────────────

def build_cover(st):
    elements = []
    elements.append(Spacer(1, 10*mm))

    # Firm brand
    elements.append(Paragraph("CLIMACTIX GLOBAL", ParagraphStyle(
        "brand", fontName="Arial-Bold", fontSize=8, textColor=GOLD,
        letterSpacing=3, leading=12, spaceAfter=0.5*mm
    )))
    elements.append(Paragraph("Climate Intelligence Assessment Report", ParagraphStyle(
        "brand2", fontName="Arial", fontSize=9, textColor=TEXT_LIGHT,
        leading=13, spaceAfter=8*mm
    )))

    # Gold rule
    elements.append(HRFlowable(width=CONTENT_W, thickness=1, color=GOLD, spaceAfter=7*mm))

    # Company name — Diageo-style mixed serif display
    elements.append(Paragraph("Bharat Steel &amp;", ParagraphStyle(
        "cn1", fontName="Georgia", fontSize=36, textColor=TEXT_DARK, leading=42, spaceAfter=0
    )))
    elements.append(Paragraph("<i>Alloys</i> Ltd.", ParagraphStyle(
        "cn2", fontName="Georgia-BoldItalic", fontSize=36, textColor=TEXT_DARK, leading=44, spaceAfter=4*mm
    )))
    elements.append(Paragraph(
        "BSE / NSE: BSAL  ·  Steel — Integrated Producer  ·  India  ·  FY2024",
        ParagraphStyle("cn_sub", fontName="Arial", fontSize=9.5, textColor=TEXT_LIGHT,
                       leading=14, spaceAfter=8*mm)
    ))

    # Key scores strip — 3 metric cards side by side
    rating_card = [
        [Paragraph("CLIMATE INTELLIGENCE SCORE", ParagraphStyle(
            "rc_label", fontName="Arial-Bold", fontSize=6.5, textColor=TEXT_MUTED,
            letterSpacing=1, leading=10))],
        [Paragraph("B", ParagraphStyle(
            "rc_rating", fontName="Georgia-Bold", fontSize=48,
            textColor=RISK_HIGH, leading=52))],
        [Paragraph("40.3 / 100", ParagraphStyle(
            "rc_score", fontName="CourierNew-Bold", fontSize=13,
            textColor=TEXT_DARK, leading=17))],
    ]
    conf_card = [
        [Paragraph("CONFIDENCE", ParagraphStyle(
            "conf_label", fontName="Arial-Bold", fontSize=6.5, textColor=TEXT_MUTED,
            letterSpacing=1, leading=10))],
        [Paragraph("HIGH", ParagraphStyle(
            "conf_val", fontName="Georgia-Bold", fontSize=28,
            textColor=S04_BLUE, leading=34))],
        [Paragraph("Score: 78 / 100", ParagraphStyle(
            "conf_score", fontName="Arial", fontSize=9,
            textColor=TEXT_LIGHT, leading=13))],
    ]
    rank_card = [
        [Paragraph("PEER RANKING", ParagraphStyle(
            "rank_label", fontName="Arial-Bold", fontSize=6.5, textColor=TEXT_MUTED,
            letterSpacing=1, leading=10))],
        [Paragraph("28th", ParagraphStyle(
            "rank_val", fontName="Georgia-Bold", fontSize=28,
            textColor=TEXT_DARK, leading=34))],
        [Paragraph("Percentile  ·  Steel-IN-Large", ParagraphStyle(
            "rank_score", fontName="Arial", fontSize=9,
            textColor=TEXT_LIGHT, leading=13))],
    ]

    card_w = (CONTENT_W - 8*mm) / 3
    for card_data in [rating_card, conf_card, rank_card]:
        t = Table(card_data, colWidths=[card_w])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,-1), CREAM),
            ("LEFTPADDING", (0,0), (-1,-1), 5),
            ("TOPPADDING", (0,0), (-1,-1), 4),
            ("BOTTOMPADDING", (0,0), (-1,-1), 4),
        ]))

    # Build 3-card row
    cards_row = Table(
        [[Table(rating_card, colWidths=[card_w]),
          Table(conf_card, colWidths=[card_w]),
          Table(rank_card, colWidths=[card_w])]],
        colWidths=[card_w, card_w, card_w],
        hAlign="LEFT"
    )
    cards_row.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), CREAM),
        ("LINEAFTER", (0,0), (1,-1), 0.5, BORDER_M),
        ("LEFTPADDING", (0,0), (-1,-1), 6),
        ("RIGHTPADDING", (0,0), (-1,-1), 6),
        ("TOPPADDING", (0,0), (-1,-1), 6),
        ("BOTTOMPADDING", (0,0), (-1,-1), 6),
        ("VALIGN", (0,0), (-1,-1), "TOP"),
    ]))
    elements.append(cards_row)
    elements.append(Spacer(1, 5*mm))

    # Outlook strip
    outlook_data = [[
        Paragraph("OUTLOOK", ParagraphStyle("ol", fontName="Arial-Bold", fontSize=7,
                  textColor=TEXT_MUTED, letterSpacing=1, leading=11)),
        Paragraph("STABLE / POSITIVE POTENTIAL", ParagraphStyle("ov", fontName="Georgia-Bold",
                  fontSize=11, textColor=S01_GREEN, leading=15)),
        Paragraph("ASSESSMENT YEAR", ParagraphStyle("ay", fontName="Arial-Bold", fontSize=7,
                  textColor=TEXT_MUTED, letterSpacing=1, leading=11)),
        Paragraph("FY2024", ParagraphStyle("ayv", fontName="Georgia-Bold", fontSize=11,
                  textColor=TEXT_DARK, leading=15)),
        Paragraph("NEXT REVIEW", ParagraphStyle("nr", fontName="Arial-Bold", fontSize=7,
                  textColor=TEXT_MUTED, letterSpacing=1, leading=11)),
        Paragraph("June 2027", ParagraphStyle("nrv", fontName="Arial", fontSize=11,
                  textColor=TEXT_LIGHT, leading=15)),
    ]]
    ol_widths = [22*mm, 52*mm, 28*mm, 22*mm, 22*mm, 24*mm]
    ol_t = Table(outlook_data, colWidths=ol_widths)
    ol_t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), WHITE),
        ("BOX", (0,0), (-1,-1), 0.5, BORDER_L),
        ("LINEAFTER", (0,0), (4,-1), 0.3, BORDER_L),
        ("LEFTPADDING", (0,0), (-1,-1), 5),
        ("TOPPADDING", (0,0), (-1,-1), 4),
        ("BOTTOMPADDING", (0,0), (-1,-1), 4),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
    ]))
    elements.append(ol_t)
    elements.append(Spacer(1, 5*mm))

    # Report metadata
    meta_rows = [
        [Paragraph("REPORT TYPE", st["cover_label"]),
         Paragraph("Full-Spectrum Climate Intelligence Assessment", st["cover_value_sm"]),
         Paragraph("ENGINE VERSION", st["cover_label"]),
         Paragraph("Climactix Intelligence Engine v1.0", st["cover_value_sm"])],
        [Paragraph("ASSESSMENT ID", st["cover_label"]),
         Paragraph("CX-2026-BSAL-001", st["cover_value_sm"]),
         Paragraph("METHODOLOGY REF", st["cover_label"]),
         Paragraph("ARCHITECTURE.md v1.0", st["cover_value_sm"])],
        [Paragraph("PREPARED BY", st["cover_label"]),
         Paragraph("Climactix Global Intelligence Engine", st["cover_value_sm"]),
         Paragraph("CLASSIFICATION", st["cover_label"]),
         Paragraph("Institutional — Authorized Recipients Only", st["cover_value_sm"])],
    ]
    meta_t = Table(meta_rows, colWidths=[28*mm, 64*mm, 28*mm, 55*mm])
    meta_t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), WHITE),
        ("LINEBELOW", (0,0), (-1,-1), 0.2, BORDER_L),
        ("LEFTPADDING", (0,0), (-1,-1), 5),
        ("TOPPADDING", (0,0), (-1,-1), 3),
        ("BOTTOMPADDING", (0,0), (-1,-1), 3),
    ]))
    elements.append(meta_t)
    elements.append(Spacer(1, 5*mm))

    # Disclaimer
    disc = ("This report is generated from structured assessment data submitted by "
            "Bharat Steel &amp; Alloys Ltd. and publicly available climate science databases. "
            "Financial projections are model-based estimates. This report does not constitute "
            "investment advice. Scores reflect climate risk management quality — not "
            "creditworthiness or equity value. For authorized recipients only.")
    elements.append(callout_box(
        [Paragraph(disc, st["disclaimer"])],
        st, accent=BORDER_M, bg=CREAM, left_bar=False
    ))
    elements.append(PageBreak())
    return elements


def build_executive_summary(st):
    elements = []
    elements.append(AccentBar(GOLD))
    elements.append(Spacer(1, 2*mm))

    elements.append(section_label("Executive Summary", st, GOLD))
    elements.append(Paragraph(
        "Bharat Steel &amp; Alloys Ltd.", ParagraphStyle(
        "es_co", fontName="Georgia-Bold", fontSize=18, textColor=TEXT_DARK,
        leading=24, spaceAfter=0)))
    elements.append(Paragraph(
        "Climate Intelligence Score: <b>B (40.3 / 100)</b>  ·  28th Percentile  ·  "
        "Confidence: HIGH  ·  Outlook: Stable / Positive Potential",
        ParagraphStyle("es_meta", fontName="Arial", fontSize=9.5, textColor=TEXT_LIGHT,
                       leading=15, spaceAfter=5*mm)
    ))

    lead = (
        "BSAL is a company in transition — one that discloses consistently, governs adequately, "
        "and has begun reducing emissions intensity — but has not yet built the institutional "
        "climate risk infrastructure required by capital market standards now being set by SEBI, "
        "RBI, and global institutional investors."
    )
    elements.append(Paragraph(lead, st["body_lead"]))
    elements.append(Spacer(1, 2*mm))

    # Three structural vulnerabilities — Diageo-style numbered cards
    elements.append(section_label("Three Structural Vulnerabilities", st, TEXT_MUTED))
    elements.append(Spacer(1, 1*mm))

    vulns = [
        ("01", "Carbon Lock-in",
         "BF-BOF technology with 15–20 years remaining asset life. Scope 1 intensity 1.92 tCO₂e/t — "
         "above the sector median (1.85). No technology transition investment visible in disclosed CAPEX. "
         "Carbon pricing will consume an estimated 59% of FY2024 EBITDA by 2030 under Disorderly pricing."),
        ("02", "Climate Intelligence Deficit",
         "No scenario analysis conducted or disclosed. No physical risk assessment completed. "
         "Net-Zero 2050 aspiration without roadmap, interim milestones, or capital allocation. "
         "Climate Resilience score: 13.8/100 — bottom decile of peer cohort."),
        ("03", "Supply Chain Opacity",
         "12% of Tier 1 suppliers assessed for climate or ESG risk. 78% of coking coal sourced "
         "from a single country (Australia). No formal supplier ESG questionnaire programme. "
         "Supply Chain score: 19.3/100 — 12th percentile of peer cohort."),
    ]

    for num, title, body in vulns:
        v_data = [[
            Paragraph(num, ParagraphStyle("vnum", fontName="Georgia-Bold", fontSize=24,
                      textColor=GOLD, leading=28)),
            Table([
                [Paragraph(title, ParagraphStyle("vtitle", fontName="Georgia-Bold", fontSize=11,
                           textColor=TEXT_DARK, leading=15, spaceAfter=1*mm))],
                [Paragraph(body, st["body_sm"])],
            ], colWidths=[CONTENT_W - 18*mm])
        ]]
        v_t = Table(v_data, colWidths=[14*mm, CONTENT_W - 14*mm])
        v_t.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,-1), CREAM_LIGHT),
            ("LINEBELOW", (0,0), (-1,-1), 0.3, BORDER_L),
            ("LEFTPADDING", (0,0), (-1,-1), 5),
            ("TOPPADDING", (0,0), (-1,-1), 5),
            ("BOTTOMPADDING", (0,0), (-1,-1), 5),
            ("VALIGN", (0,0), (-1,-1), "TOP"),
        ]))
        elements.append(v_t)
        elements.append(Spacer(1, 1.5*mm))

    elements.append(Spacer(1, 3*mm))
    elements.append(callout_box(
        [Paragraph(
            "<b>For institutional investors:</b> BSAL is a borderline hold at current climate "
            "risk management maturity. Trajectory is positive but speed of progress is insufficient "
            "given the 2030 financial exposure horizon. Recommend conditional engagement with a "
            "12-month reassessment trigger tied to SBTi submission and scenario analysis completion.",
            st["body"]
        )],
        st, accent=GOLD, bg=GOLD_LIGHT
    ))
    elements.append(PageBreak())
    return elements


def build_scorecard(st):
    elements = []
    elements.append(AccentBar(TEXT_DARK))
    elements.append(Spacer(1, 2*mm))

    elements.append(section_label("Climate Intelligence Scorecard", st, TEXT_MUTED))
    elements.append(Paragraph("Full Domain Assessment", st["h1"]))
    elements.append(Spacer(1, 2*mm))

    # Overall score display
    overall = Table([[
        Paragraph("OVERALL CIS", ParagraphStyle("oc_l", fontName="Arial-Bold", fontSize=7.5,
                  textColor=TEXT_MUTED, letterSpacing=1.5, leading=11)),
        Paragraph("B", ParagraphStyle("oc_r", fontName="Georgia-Bold", fontSize=38,
                  textColor=RISK_HIGH, leading=42)),
        Paragraph("40.3\n/ 100", ParagraphStyle("oc_s", fontName="CourierNew-Bold", fontSize=14,
                  textColor=TEXT_DARK, leading=18)),
        Paragraph("28th Percentile\nSteel–India–Large", ParagraphStyle("oc_p", fontName="Arial",
                  fontSize=9, textColor=TEXT_LIGHT, leading=14)),
        Paragraph("HIGH\nConfidence", ParagraphStyle("oc_c", fontName="Georgia-Bold", fontSize=12,
                  textColor=S04_BLUE, leading=16)),
        Paragraph("STABLE /\nPOS. POTENTIAL", ParagraphStyle("oc_o", fontName="Arial-Bold",
                  fontSize=8.5, textColor=S01_GREEN, leading=13)),
    ]])
    overall.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), CREAM),
        ("LINEBELOW", (0,0), (-1,-1), 1.0, GOLD),
        ("LEFTPADDING", (0,0), (-1,-1), 7),
        ("TOPPADDING", (0,0), (-1,-1), 6),
        ("BOTTOMPADDING", (0,0), (-1,-1), 6),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
    ]))
    elements.append(overall)
    elements.append(Spacer(1, 3*mm))

    # Domain scores
    domain_data = [
        ("Governance", "BBB", 59.8, 55, "PROGRESSING", S05_ROSE),
        ("Physical Risk", "BB+", 49.5, 47, "DEVELOPING", S02_PURPLE),
        ("Transition Risk", "CCC", 28.2, 16, "LAGGARD ⚠", S03_SIENNA),
        ("Carbon Management", "CCC", 33.0, 18, "LAGGARD ⚠", S03_SIENNA),
        ("Supply Chain", "D", 19.3, 12, "LAGGARD ⚠", RISK_CRITICAL),
        ("Compliance", "BB", 50.2, 48, "DEVELOPING", S04_BLUE),
        ("Adaptation", "BB", 46.9, 52, "PROGRESSING", S01_GREEN),
        ("Disclosure Quality", "A", 74.4, 78, "ADVANCED ✓", S01_GREEN),
        ("Greenwashing Risk", "—", 41.5, 60, "ELEVATED ⚠", RISK_HIGH),
        ("Climate Resilience", "D", 13.8, 8, "LAGGARD ⚠", RISK_CRITICAL),
    ]
    for d in domain_data:
        elements.append(ScorePanel(*d))
        elements.append(Spacer(1, 1.2*mm))

    elements.append(Spacer(1, 3*mm))
    elements.append(Paragraph(
        "The B rating reflects a company with functional governance and disclosure infrastructure "
        "but without climate risk management depth. The wide dispersion — Disclosure Quality at "
        "A (78th percentile) alongside Carbon Management at CCC (18th) — is characteristic of "
        "strong form without substance.",
        st["body_sm"]
    ))
    elements.append(PageBreak())
    return elements


def build_ambition_section(st):
    elements = []
    elements.append(SectionDividerPage(
        "01", "Ambition &amp; Targets",
        "Emissions baseline, trajectories and target credibility",
        S01_GREEN
    ))
    elements.append(PageBreak())

    # Content page
    elements.append(AccentBar(S01_GREEN))
    elements.append(Spacer(1, 2*mm))
    elements.append(section_label("01 — Ambition & Targets", st, S01_GREEN))
    elements.append(Paragraph("Our <i>emissions</i> baseline", st["h1_italic"]))

    left_content = [
        Paragraph(
            "Recognising where emissions come from is the foundation of effective climate strategy. "
            "BSAL's FY2024 baseline confirms that Scope 1 direct emissions — primarily from the "
            "Blast Furnace–Basic Oxygen Furnace steelmaking route — represent the dominant and "
            "most financially material emission source.",
            st["body"]
        ),
        Paragraph(
            "BSAL's Scope 1 intensity of <b>1.92 tCO₂e per tonne of crude steel</b> is 3.8% above "
            "the Steel-India-Large cohort median of 1.85 tCO₂e/t. This above-median position drives "
            "a zero score on the emissions performance sub-component — the largest single weight "
            "(0.35) in the Carbon Management domain.",
            st["body"]
        ),
        Paragraph(
            "The three-year emissions intensity trend (2.94%/yr decline) is broadly Paris-aligned "
            "for the steel sector. If sustained, BSAL crosses below the sector median by FY2027 — "
            "at which point the Carbon Management score moves from 33 to approximately 68.",
            st["body"]
        ),
    ]

    # Right panel: emissions profile
    em_rows = [
        [Paragraph("Scope 1 (Direct)", st["td"]),
         Paragraph("5,376,000 t", st["td_mono"]),
         Paragraph("1.92 tCO₂e/t", st["td_risk_high"])],
        [Paragraph("Scope 2 Market-based", st["td"]),
         Paragraph("892,000 t", st["td_mono"]),
         Paragraph("0.32 tCO₂e/t", st["td"])],
        [Paragraph("Scope 3 (Partial)", st["td"]),
         Paragraph("Estimated", st["td"]),
         Paragraph("Cat. 1, 11 only", st["td_risk_high"])],
        [Paragraph("Sector Median (p50)", st["td"]),
         Paragraph("—", st["td"]),
         Paragraph("1.85 tCO₂e/t", st["td_good"])],
    ]
    em_t = clean_table(
        ["Scope", "Absolute", "Intensity"],
        em_rows,
        [42*mm, 28*mm, 30*mm],
        st, S01_GREEN
    )

    trend_rows = [
        [Paragraph("FY2022", st["td"]),
         Paragraph("2.04 tCO₂e/t", st["td_mono"]),
         Paragraph("—", st["td"])],
        [Paragraph("FY2023", st["td"]),
         Paragraph("1.98 tCO₂e/t", st["td_mono"]),
         Paragraph("−2.9%", st["td_good"])],
        [Paragraph("FY2024", st["td"]),
         Paragraph("1.92 tCO₂e/t", st["td_mono"]),
         Paragraph("−3.0%", st["td_good"])],
    ]
    trend_t = clean_table(
        ["Year", "Scope 1 Intensity", "YoY Change"],
        trend_rows,
        [22*mm, 35*mm, 22*mm],
        st, S01_GREEN
    )

    right_content = [
        Paragraph("EMISSIONS PROFILE — FY2024", ParagraphStyle("ep_h",
            fontName="Arial-Bold", fontSize=7.5, textColor=S01_GREEN,
            letterSpacing=1, leading=11, spaceAfter=1.5*mm)),
        em_t,
        Spacer(1, 3*mm),
        Paragraph("3-YEAR INTENSITY TREND", ParagraphStyle("tt_h",
            fontName="Arial-Bold", fontSize=7.5, textColor=S01_GREEN,
            letterSpacing=1, leading=11, spaceAfter=1.5*mm)),
        trend_t,
        Spacer(1, 3*mm),
        callout_box([
            stat_box("2.94%", "per year", "Scope 1 intensity\ndecline — FY22–24", S01_GREEN)
        ], st, accent=S01_GREEN, bg=CREAM, left_bar=False)
    ]

    elements.append(two_col(left_content, right_content, 0.55))
    elements.append(Spacer(1, 4*mm))

    # Target credibility
    elements.append(HRFlowable(width=CONTENT_W, thickness=0.3, color=BORDER_L, spaceBefore=2*mm, spaceAfter=3*mm))
    elements.append(section_label("Target Credibility Assessment", st, S01_GREEN))
    elements.append(Paragraph(
        "Net-Zero 2050: <i>aspiration without architecture</i>", st["h1_italic"]
    ))

    elements.append(Paragraph(
        "BSAL has declared a Net-Zero by 2050 target in its Annual Report and Sustainability Policy. "
        "The Climactix Target Credibility engine assessed this commitment against five institutional "
        "criteria — and found material gaps across all five.",
        st["body"]
    ))

    tc_rows = [
        [Paragraph("SBTi Validation", st["td"]),
         Paragraph("Not submitted", st["td_risk_critical"]),
         Paragraph("0 / 25", st["td_mono"])],
        [Paragraph("Interim 2030 milestone", st["td"]),
         Paragraph("Not defined", st["td_risk_critical"]),
         Paragraph("0 / 25", st["td_mono"])],
        [Paragraph("CAPEX allocation to decarbonisation", st["td"]),
         Paragraph("Undisclosed", st["td_risk_critical"]),
         Paragraph("0 / 20", st["td_mono"])],
        [Paragraph("Technology transition roadmap", st["td"]),
         Paragraph("Not published", st["td_risk_critical"]),
         Paragraph("0 / 20", st["td_mono"])],
        [Paragraph("Board approval of target", st["td"]),
         Paragraph("Yes — Sustainability Policy", st["td_good"]),
         Paragraph("30 / 10", st["td_mono"])],
    ]
    tc_t = clean_table(
        ["Criterion", "Status", "Score"],
        tc_rows,
        [75*mm, 70*mm, 25*mm],
        st, S01_GREEN
    )
    elements.append(tc_t)
    elements.append(Spacer(1, 3*mm))
    elements.append(callout_box(
        [Paragraph(
            "A Net-Zero 2050 commitment from a BF-BOF steel company without a technology "
            "transition plan, without SBTi validation, and without disclosed CAPEX allocation "
            "is not an institutional-grade target. Target Credibility Score: <b>30 / 100</b>.",
            st["body"]
        )],
        st, accent=S01_GREEN, bg=CREAM
    ))
    elements.append(PageBreak())
    return elements


def build_physical_risk_section(st):
    elements = []
    elements.append(SectionDividerPage(
        "02", "Climate Risk Exposure",
        "Physical hazards, asset vulnerability and adaptation measures",
        S02_PURPLE
    ))
    elements.append(PageBreak())

    elements.append(AccentBar(S02_PURPLE))
    elements.append(Spacer(1, 2*mm))
    elements.append(section_label("02 — Climate Risk Exposure", st, S02_PURPLE))
    elements.append(Paragraph("Physical <i>risk</i> and adaptation", st["h1_italic"]))

    elements.append(Paragraph(
        "BSAL operates across two geographically distinct risk environments. The Raipur primary "
        "site (3.2 MTPA) faces inland water stress and heat risk. The Vizag rolling mill "
        "(0.8 MTPA) carries coastal hazard exposure. Together, they create a compound physical "
        "risk profile that scores BB+ (49.5) — 47th percentile of peers.",
        st["body"]
    ))

    # Hazard table
    h_rows = [
        [Paragraph("Water Stress", st["td_bold"]),
         Paragraph("Raipur — Primary", st["td"]),
         Paragraph("CRITICAL", st["td_risk_critical"]),
         Paragraph("WRI score: 3.8/5  ·  62% capacity in high-stress zones", st["td_sm"] if "td_sm" in st else st["td"]),
         Paragraph("Worsening", st["td_risk_high"])],
        [Paragraph("Heat Stress", st["td_bold"]),
         Paragraph("Raipur", st["td"]),
         Paragraph("HIGH", st["td_risk_high"]),
         Paragraph("WBGT p95: 29.8°C  ·  Heavy work threshold", st["td"]),
         Paragraph("Worsening", st["td_risk_high"])],
        [Paragraph("Cyclone", st["td_bold"]),
         Paragraph("Vizag — Coastal", st["td"]),
         Paragraph("HIGH", st["td_risk_high"]),
         Paragraph("Bay of Bengal  ·  18% assets coastal", st["td"]),
         Paragraph("Intensifying", st["td_risk_high"])],
        [Paragraph("Flood", st["td_bold"]),
         Paragraph("Vizag", st["td"]),
         Paragraph("MEDIUM", ParagraphStyle("med", fontName="Arial-Bold", fontSize=8.5,
                   textColor=RISK_MED, leading=13)),
         Paragraph("9% assets in 100-yr flood zone", st["td"]),
         Paragraph("Worsening", st["td_risk_high"])],
        [Paragraph("Sea Level Rise", st["td_bold"]),
         Paragraph("Vizag", st["td"]),
         Paragraph("MEDIUM", ParagraphStyle("med2", fontName="Arial-Bold", fontSize=8.5,
                   textColor=RISK_MED, leading=13)),
         Paragraph("4.2 km coastal  ·  IPCC SLR trajectory", st["td"]),
         Paragraph("Accelerating", st["td_risk_high"])],
    ]
    h_t = clean_table(
        ["Hazard", "Site", "Level", "Detail", "2050 Trend"],
        h_rows,
        [26*mm, 28*mm, 22*mm, 76*mm, 23*mm],
        st, S02_PURPLE
    )
    elements.append(h_t)
    elements.append(Spacer(1, 3*mm))

    left_content = [
        section_label("Water Stress — Critical Exposure", st, S02_PURPLE),
        Paragraph(
            "This is BSAL's most pressing physical risk. 62% of manufacturing capacity is in "
            "WRI High or Extremely High water stress zones. Integrated steel manufacturing requires "
            "water for blast furnace cooling, coke quenching, and continuous casting — the process "
            "is not discretionary.",
            st["body"]
        ),
        Paragraph(
            "BSAL's Zero Liquid Discharge (ZLD) system at Raipur provides genuine mitigation — "
            "reducing fresh water consumption through recirculation, with CPCB certificate verified. "
            "However, ZLD addresses liquid discharge, not raw water procurement risk. "
            "No formal water risk assessment or stewardship strategy was identified in any uploaded document.",
            st["body"]
        ),
    ]

    right_content = [
        section_label("Physical Risk Score Breakdown", st, S02_PURPLE),
        Spacer(1, 1*mm),
        ScorePanel("Physical Risk (Overall)", "BB+", 49.5, 47, "DEVELOPING", S02_PURPLE,
                   width=CONTENT_W * 0.42),
        Spacer(1, 2*mm),
        clean_table(
            ["Hazard", "Sub-Score", "Weight"],
            [
                [Paragraph("Water Stress", st["td"]),
                 Paragraph("24.7", st["td_risk_high"]),
                 Paragraph("0.25", st["td"])],
                [Paragraph("Heat Stress", st["td"]),
                 Paragraph("12.7", st["td_risk_critical"]),
                 Paragraph("0.20", st["td"])],
                [Paragraph("Flood", st["td"]),
                 Paragraph("81.9", st["td_good"]),
                 Paragraph("0.25", st["td"])],
                [Paragraph("Cyclone", st["td"]),
                 Paragraph("61.5", st["td"]),
                 Paragraph("0.15", st["td"])],
                [Paragraph("Sea Level", st["td"]),
                 Paragraph("65.6", st["td"]),
                 Paragraph("0.10", st["td"])],
            ],
            [38*mm, 22*mm, 18*mm],
            st, S02_PURPLE
        )
    ]
    elements.append(two_col(left_content, right_content, 0.58))
    elements.append(PageBreak())
    return elements


def build_transition_section(st):
    elements = []
    elements.append(SectionDividerPage(
        "03", "Transition Readiness",
        "Carbon pricing exposure, energy efficiency and technology lock-in",
        S03_SIENNA
    ))
    elements.append(PageBreak())

    elements.append(AccentBar(S03_SIENNA))
    elements.append(Spacer(1, 2*mm))
    elements.append(section_label("03 — Transition Readiness", st, S03_SIENNA))
    elements.append(Paragraph(
        "Transition Risk: <i>the most material near-term financial exposure</i>",
        st["h1_italic"]
    ))

    elements.append(callout_box(
        [Paragraph(
            "<b>Critical finding:</b> Carbon pricing alone will consume an estimated <b>59% of "
            "FY2024 EBITDA by 2030</b> under Disorderly Transition pricing ($15/tCO₂e). "
            "At 2040 prices ($60/tCO₂e), the exposure exceeds total current EBITDA. "
            "Transition Risk domain score: <b>CCC (28.2 / 100)</b> — 16th percentile of peers.",
            st["body"]
        )],
        st, accent=S03_SIENNA, bg=colors.HexColor("#F5EDE8")
    ))
    elements.append(Spacer(1, 3*mm))

    # Carbon pricing table
    elements.append(section_label("Carbon Pricing Cost Projection — Disorderly Scenario", st, S03_SIENNA))
    cp_rows = [
        [Paragraph("Carbon Price ($/tCO₂e)", st["td_bold"]),
         Paragraph("$8–12", st["td_mono"]),
         Paragraph("$15–20", st["td_mono"]),
         Paragraph("$60–80", st["td_mono"]),
         Paragraph("$150–180", st["td_mono"])],
        [Paragraph("BSAL Scope 1 (with trajectory)", st["td"]),
         Paragraph("5,376,000 t", st["td_mono"]),
         Paragraph("4,868,000 t", st["td_mono"]),
         Paragraph("3,782,000 t", st["td_mono"]),
         Paragraph("2,937,000 t", st["td_mono"])],
        [Paragraph("Annual Carbon Cost", st["td_bold"]),
         Paragraph("$53M", st["td_mono"]),
         Paragraph("$73M", ParagraphStyle("cp_y", fontName="CourierNew-Bold", fontSize=9,
                   textColor=RISK_MED, leading=13)),
         Paragraph("$227M", ParagraphStyle("cp_o", fontName="CourierNew-Bold", fontSize=9,
                   textColor=RISK_HIGH, leading=13)),
         Paragraph("$441M", ParagraphStyle("cp_r", fontName="CourierNew-Bold", fontSize=9,
                   textColor=RISK_CRITICAL, leading=13))],
        [Paragraph("As % of FY24 EBITDA ($124M)", st["td_bold"]),
         Paragraph("42.7%", ParagraphStyle("ei_y", fontName="Arial-Bold", fontSize=8.5,
                   textColor=RISK_MED, leading=13)),
         Paragraph("58.9%", ParagraphStyle("ei_o", fontName="Arial-Bold", fontSize=8.5,
                   textColor=RISK_HIGH, leading=13)),
         Paragraph("183%", ParagraphStyle("ei_r", fontName="Arial-Bold", fontSize=8.5,
                   textColor=RISK_CRITICAL, leading=13)),
         Paragraph("356%", ParagraphStyle("ei_c", fontName="Arial-Bold", fontSize=8.5,
                   textColor=RISK_CRITICAL, leading=13))],
    ]
    cp_t = clean_table(
        ["Metric", "Now (FY26)", "2030", "2040", "2050"],
        cp_rows,
        [55*mm, 28*mm, 28*mm, 28*mm, 30*mm],
        st, S03_SIENNA
    )
    elements.append(cp_t)
    elements.append(Spacer(1, 3*mm))

    left_content = [
        section_label("Technology Lock-in", st, S03_SIENNA),
        Paragraph(
            "BSAL's BF-BOF equipment at Raipur was refurbished in 2019, implying remaining "
            "asset life to approximately 2039–2044. No investment in DRI-H2 or EAF technology "
            "has been disclosed. Each year of continued BF-BOF investment without a transition plan "
            "represents additional stranded asset accumulation.",
            st["body"]
        ),
        Paragraph(
            "BSAL's energy intensity of 23.4 GJ/t is 18.2% above the sector median (19.8 GJ/t). "
            "Annual energy cost is approximately $205M — 33% of revenue. This drives a zero score "
            "on the energy efficiency sub-component, the second-largest transition weight (0.25).",
            st["body"]
        ),
    ]

    right_content = [
        section_label("Transition Score Breakdown", st, S03_SIENNA),
        Spacer(1, 1*mm),
        ScorePanel("Transition Risk (Overall)", "CCC", 28.2, 16, "LAGGARD ⚠", S03_SIENNA,
                   width=CONTENT_W * 0.42),
        Spacer(1, 2*mm),
        clean_table(
            ["Component", "Score", "Weight"],
            [
                [Paragraph("Carbon price exposure", st["td"]),
                 Paragraph("30.6", st["td_risk_high"]), Paragraph("0.30", st["td"])],
                [Paragraph("Energy efficiency", st["td"]),
                 Paragraph("0.0", st["td_risk_critical"]), Paragraph("0.25", st["td"])],
                [Paragraph("Technology readiness", st["td"]),
                 Paragraph("25.0", st["td_risk_critical"]), Paragraph("0.20", st["td"])],
                [Paragraph("Regulatory compliance", st["td"]),
                 Paragraph("80.0", st["td_good"]), Paragraph("0.15", st["td"])],
                [Paragraph("Market demand", st["td"]),
                 Paragraph("20.0", st["td_risk_critical"]), Paragraph("0.10", st["td"])],
            ],
            [48*mm, 18*mm, 18*mm],
            st, S03_SIENNA
        )
    ]
    elements.append(two_col(left_content, right_content, 0.58))
    elements.append(PageBreak())
    return elements


def build_simulation_section(st):
    elements = []
    elements.append(AccentBar(S04_BLUE))
    elements.append(Spacer(1, 2*mm))
    elements.append(section_label("Financial Risk Simulation", st, S04_BLUE))
    elements.append(Paragraph(
        "Climate <i>risk</i> in financial terms", st["h1_italic"]
    ))
    elements.append(Paragraph(
        "Methodology: NGFS 2023 scenarios × IPCC AR6. "
        "Base year: FY2024 (Revenue $620M, EBITDA $124M). Uncertainty band: ±35% at 80% confidence.",
        st["body_sm"]
    ))
    elements.append(Spacer(1, 2*mm))

    sim_rows = [
        [Paragraph("Physical Risk", st["td"]),
         Paragraph("Orderly NZ2050", st["td"]),
         Paragraph("$11.1M  (1.8%)", ParagraphStyle("sv_g", fontName="CourierNew-Bold", fontSize=8.5, textColor=RISK_LOW, leading=13)),
         Paragraph("$24.1M  (3.9%)", st["td_mono"]),
         Paragraph("$41.6M  (6.7%)", st["td_risk_high"])],
        [Paragraph("Physical Risk", st["td"]),
         Paragraph("Disorderly ~3°C", st["td_bold"]),
         Paragraph("$19.7M  (3.2%)", st["td_risk_high"]),
         Paragraph("$44.7M  (7.2%)", st["td_risk_high"]),
         Paragraph("$92.4M  (14.9%)", st["td_risk_critical"])],
        [Paragraph("Physical Risk", st["td"]),
         Paragraph("Hot House ~4°C", st["td"]),
         Paragraph("$28.1M  (4.5%)", st["td_risk_high"]),
         Paragraph("$68.5M  (11.1%)", st["td_risk_critical"]),
         Paragraph("$151.8M  (24.5%)", st["td_risk_critical"])],
        [Paragraph("Transition Risk", st["td"]),
         Paragraph("Orderly NZ2050", st["td"]),
         Paragraph("$82.7M  (13.3%)", st["td_risk_high"]),
         Paragraph("$193M  (31.2%)", st["td_risk_critical"]),
         Paragraph("$321M  (51.8%)", st["td_risk_critical"])],
        [Paragraph("Transition Risk", st["td_bold"]),
         Paragraph("Disorderly ~3°C", st["td_bold"]),
         Paragraph("$128.5M  (20.7%)", st["td_risk_critical"]),
         Paragraph("$406M  (65.5%)", st["td_risk_critical"]),
         Paragraph("$819M  (132%)", ParagraphStyle("sv_cr", fontName="CourierNew-Bold", fontSize=8.5, textColor=RISK_CRITICAL, leading=13))],
        [Paragraph("Transition Risk", st["td"]),
         Paragraph("Hot House ~4°C", st["td"]),
         Paragraph("$31.4M  (5.1%)", st["td_risk_high"]),
         Paragraph("$45.9M  (7.4%)", st["td_risk_high"]),
         Paragraph("$71.9M  (11.6%)", st["td_risk_high"])],
    ]
    sim_t = clean_table(
        ["Risk Type", "Scenario", "2030 (% Rev)", "2040 (% Rev)", "2050 (% Rev)"],
        sim_rows,
        [30*mm, 35*mm, 38*mm, 38*mm, 38*mm],
        st, S04_BLUE
    )
    elements.append(sim_t)
    elements.append(Spacer(1, 3*mm))
    elements.append(callout_box([
        Paragraph(
            "<b>Key insight:</b> The most financially dangerous scenario for BSAL is "
            "<b>Disorderly Transition</b> — not Hot House. Under Hot House, carbon prices remain "
            "low. Under Disorderly, prices rise faster than the company can adapt while physical "
            "risk simultaneously intensifies. The 132% revenue exposure by 2050 represents an "
            "existential scenario without material decarbonisation investment by 2028.",
            st["body"]
        )],
        st, accent=S04_BLUE, bg=colors.HexColor("#EEF3F8")
    ))
    elements.append(PageBreak())
    return elements


def build_governance_section(st):
    elements = []
    elements.append(SectionDividerPage(
        "04", "Governance &amp; Disclosure",
        "Board oversight, accountability and framework readiness",
        S05_ROSE
    ))
    elements.append(PageBreak())

    elements.append(AccentBar(S05_ROSE))
    elements.append(Spacer(1, 2*mm))
    elements.append(section_label("04 — Governance & Disclosure", st, S05_ROSE))
    elements.append(Paragraph(
        "Governance: <i>strong form, incomplete substance</i>", st["h1_italic"]
    ))

    left_content = [
        Paragraph(
            "BSAL's governance structure is substantively ahead of many Steel sector peers. "
            "The Environment and Sustainability Committee, established at Board level in FY2022, "
            "has verified Terms of Reference. A board-approved Sustainability Policy (FY2023) "
            "provides the foundational governance document.",
            st["body"]
        ),
        section_label("Material Gap", st, S05_ROSE),
        Paragraph(
            "No third-party assurance exists on any sustainability data. BSAL's emissions, "
            "energy, and water data is entirely self-reported. There is no ISAE 3000 verification, "
            "no ISO 14064 audit, and no specialist firm review. This is the single highest-leverage "
            "governance action available — commissioning ISAE 3000 limited assurance would alone "
            "add 8–10 points to Governance and cascade to Confidence Score.",
            st["body"]
        ),
    ]

    gov_breakdown_rows = [
        [Paragraph("Board oversight", st["td"]),
         Paragraph("100.0", st["td_good"]),
         Paragraph("0.30", st["td"]),
         Paragraph("30.0", st["td_bold"])],
        [Paragraph("ESG policy quality", st["td"]),
         Paragraph("65.0", ParagraphStyle("gv_y", fontName="CourierNew-Bold", fontSize=9, textColor=RISK_MED, leading=13)),
         Paragraph("0.25", st["td"]),
         Paragraph("16.3", st["td_bold"])],
        [Paragraph("Executive accountability", st["td"]),
         Paragraph("40.0", st["td_risk_high"]),
         Paragraph("0.20", st["td"]),
         Paragraph("8.0", st["td_bold"])],
        [Paragraph("Audit / verification", st["td"]),
         Paragraph("0.0", st["td_risk_critical"]),
         Paragraph("0.15", st["td"]),
         Paragraph("0.0", st["td_risk_critical"])],
        [Paragraph("Stakeholder engagement", st["td"]),
         Paragraph("55.0", ParagraphStyle("gv_y2", fontName="CourierNew-Bold", fontSize=9, textColor=RISK_MED, leading=13)),
         Paragraph("0.10", st["td"]),
         Paragraph("5.5", st["td_bold"])],
    ]
    gov_t = clean_table(
        ["Component", "Score", "Weight", "Contribution"],
        gov_breakdown_rows,
        [52*mm, 20*mm, 20*mm, 26*mm],
        st, S05_ROSE
    )

    right_content = [
        ScorePanel("Governance Score", "BBB", 59.8, 55, "PROGRESSING", S05_ROSE,
                   width=CONTENT_W * 0.42),
        Spacer(1, 2.5*mm),
        section_label("Score Breakdown", st, S05_ROSE),
        Spacer(1, 1*mm),
        gov_t,
    ]
    elements.append(two_col(left_content, right_content, 0.55))
    elements.append(Spacer(1, 3*mm))

    # Framework readiness
    elements.append(HRFlowable(width=CONTENT_W, thickness=0.3, color=BORDER_L,
                               spaceBefore=1*mm, spaceAfter=3*mm))
    elements.append(section_label("Disclosure Framework Readiness", st, S05_ROSE))
    fw_rows = [
        [Paragraph("BRSR Core", st["td_bold"]),
         Paragraph("78%", ParagraphStyle("fw_g", fontName="CourierNew-Bold", fontSize=9, textColor=RISK_LOW, leading=13)),
         Paragraph("Required — Top Listed", st["td"]),
         Paragraph("Near-ready", st["td_good"])],
        [Paragraph("BRSR Full", st["td"]),
         Paragraph("58%", ParagraphStyle("fw_y", fontName="CourierNew-Bold", fontSize=9, textColor=RISK_MED, leading=13)),
         Paragraph("Required", st["td"]),
         Paragraph("Gap work needed", st["td_risk_high"])],
        [Paragraph("TCFD", st["td_bold"]),
         Paragraph("36%", st["td_risk_high"]),
         Paragraph("Required (upcoming)", st["td"]),
         Paragraph("Major gaps — Scenario analysis", st["td_risk_critical"])],
        [Paragraph("IFRS S2", st["td_bold"]),
         Paragraph("25%", st["td_risk_critical"]),
         Paragraph("Required (2-3 yrs)", st["td"]),
         Paragraph("Critical gaps", st["td_risk_critical"])],
        [Paragraph("GRI", st["td"]),
         Paragraph("59%", ParagraphStyle("fw_y2", fontName="CourierNew-Bold", fontSize=9, textColor=RISK_MED, leading=13)),
         Paragraph("Voluntary", st["td"]),
         Paragraph("Reasonable", st["td"])],
        [Paragraph("CDP Climate", st["td"]),
         Paragraph("40%", st["td_risk_high"]),
         Paragraph("Voluntary", st["td"]),
         Paragraph("Medium gaps", st["td"])],
    ]
    fw_t = clean_table(
        ["Framework", "Readiness", "Status", "Assessment"],
        fw_rows,
        [28*mm, 22*mm, 40*mm, 80*mm],
        st, S05_ROSE
    )
    elements.append(fw_t)
    elements.append(PageBreak())
    return elements


def build_priority_actions(st):
    elements = []
    elements.append(SectionDividerPage(
        "05", "Priority Action Plan",
        "Ranked actions by combined score, confidence and financial risk impact",
        S_APP
    ))
    elements.append(PageBreak())

    elements.append(AccentBar(S_APP))
    elements.append(Spacer(1, 2*mm))
    elements.append(section_label("Priority Action Plan", st, S_APP))
    elements.append(Paragraph("What needs to <i>change</i>", st["h1_italic"]))
    elements.append(Spacer(1, 2*mm))

    tier1 = [
        ("01", "Conduct formal climate scenario analysis",
         "Resolves TCFD Strategy.b and IFRS S2 Para 22 gaps. Raises Climate Resilience "
         "from 13.8 to ~53 (+39.2 pts). CIS impact: +2.0 points.",
         "3–4 months  ·  ₹30–60 Lakhs  ·  CFO + CSO + Board"),
        ("02", "Submit SBTi Commitment Letter",
         "Target credibility moves 30 → 65. Carbon Management rises 33.0 → ~41.3. "
         "CIS impact: +1.5 points. Even commitment (unvalidated) moves score.",
         "1 month  ·  Low cost  ·  Chief Sustainability Officer"),
        ("03", "Commission third-party ESG data assurance (ISAE 3000)",
         "Confidence Score moves 78 → ~86 (VERY HIGH). Unlocks credit-grade "
         "institutional investor access. Verification Status 55 → 90.",
         "2–3 months  ·  ₹20–40 Lakhs  ·  CFO + External Auditor"),
    ]
    tier2 = [
        ("04", "Publish standalone carbon inventory (ISO 14064)",
         "Data quality sub-score in Carbon Management 60 → 85. CMS gains ~5 points. "
         "Resolves Scope 3 evidence gap.",
         "3–4 months  ·  ₹15–25 Lakhs"),
        ("05", "Launch formal Supplier ESG Audit Programme",
         "Supply Chain score rises from 19.3 toward 35+ over 2–3 years. Target: 40% "
         "Tier 1 coverage by FY2026. Start with top 20 suppliers by spend.",
         "6–9 months ongoing  ·  ₹10–20 Lakhs"),
        ("06", "Commission physical risk assessment — both sites",
         "Physical Risk score rises to ~60. Closes TCFD Risk Management.a gap. "
         "Enables IFRS S2 Para 9 disclosure.",
         "3–4 months  ·  ₹25–40 Lakhs"),
        ("07", "Expand executive climate KPIs across full C-suite",
         "Executive accountability 40 → 75. Governance rises from 59.8 to ~65. "
         "Introduce Scope 1 intensity, water recycling, supplier audit coverage.",
         "1–2 months  ·  Board NRC approval"),
    ]

    elements.append(Paragraph("TIER 1 — CRITICAL  (within 6 months)", ParagraphStyle(
        "t1h", fontName="Arial-Bold", fontSize=8, textColor=RISK_CRITICAL,
        letterSpacing=1, spaceBefore=2*mm, spaceAfter=2*mm
    )))
    for num, title, body, effort in tier1:
        row = Table([[
            Paragraph(num, ParagraphStyle("an", fontName="Georgia-Bold", fontSize=22,
                      textColor=RISK_CRITICAL, leading=26)),
            Table([
                [Paragraph(title, ParagraphStyle("at", fontName="Georgia-Bold", fontSize=10,
                           textColor=TEXT_DARK, leading=14, spaceAfter=1.5*mm))],
                [Paragraph(body, st["body_sm"])],
                [Paragraph(effort, ParagraphStyle("ae", fontName="Arial-Italic", fontSize=8,
                           textColor=S04_BLUE, leading=12, spaceBefore=1.5*mm))],
            ], colWidths=[CONTENT_W - 16*mm]),
        ]], colWidths=[12*mm, CONTENT_W - 12*mm])
        row.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,-1), CREAM_LIGHT),
            ("LINEBELOW", (0,0), (-1,-1), 0.5, RISK_CRITICAL),
            ("LEFTPADDING", (0,0), (-1,-1), 5),
            ("TOPPADDING", (0,0), (-1,-1), 5),
            ("BOTTOMPADDING", (0,0), (-1,-1), 5),
            ("VALIGN", (0,0), (-1,-1), "TOP"),
        ]))
        elements.append(row)
        elements.append(Spacer(1, 1.5*mm))

    elements.append(Paragraph("TIER 2 — HIGH PRIORITY  (within 12 months)", ParagraphStyle(
        "t2h", fontName="Arial-Bold", fontSize=8, textColor=RISK_HIGH,
        letterSpacing=1, spaceBefore=3*mm, spaceAfter=2*mm
    )))
    for num, title, body, effort in tier2:
        row = Table([[
            Paragraph(num, ParagraphStyle("an2", fontName="Georgia-Bold", fontSize=22,
                      textColor=RISK_HIGH, leading=26)),
            Table([
                [Paragraph(title, ParagraphStyle("at2", fontName="Georgia-Bold", fontSize=10,
                           textColor=TEXT_DARK, leading=14, spaceAfter=1.5*mm))],
                [Paragraph(body, st["body_sm"])],
                [Paragraph(effort, ParagraphStyle("ae2", fontName="Arial-Italic", fontSize=8,
                           textColor=S04_BLUE, leading=12, spaceBefore=1.5*mm))],
            ], colWidths=[CONTENT_W - 16*mm]),
        ]], colWidths=[12*mm, CONTENT_W - 12*mm])
        row.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,-1), WHITE),
            ("LINEBELOW", (0,0), (-1,-1), 0.3, BORDER_L),
            ("LEFTPADDING", (0,0), (-1,-1), 5),
            ("TOPPADDING", (0,0), (-1,-1), 5),
            ("BOTTOMPADDING", (0,0), (-1,-1), 5),
            ("VALIGN", (0,0), (-1,-1), "TOP"),
        ]))
        elements.append(row)
        elements.append(Spacer(1, 1.2*mm))

    elements.append(PageBreak())
    return elements


def build_rating_page(st):
    elements = []
    elements.append(AccentBar(TEXT_DARK))
    elements.append(Spacer(1, 2*mm))
    elements.append(section_label("Rating Rationale & Institutional Guidance", st, TEXT_MUTED))
    elements.append(Paragraph(
        "Rating: <b>B (40.3)</b>  ·  Outlook: <b>Stable / Positive Potential</b>",
        st["h1"]
    ))

    # Positive vs Negative two-column
    positives = [
        "+ Consistent BRSR Core disclosure — evidence-verified",
        "+ Board ESG committee with documented mandate (FY2022)",
        "+ Paris-aligned Scope 1 intensity trajectory: −2.94%/yr",
        "+ ZLD system at Raipur — verified CPCB certificate",
        "+ PAT Scheme Cycle 5 target achieved",
        "+ Disclosure Quality: A rating, 78th peer percentile",
        "+ HIGH confidence (78) — current, near-complete data",
    ]
    negatives = [
        "− Scope 1 intensity above sector median → zero performance score",
        "− No scenario analysis of any kind conducted or disclosed",
        "− Net-Zero 2050 claim with no roadmap or CAPEX plan",
        "− Supply chain: 12% supplier coverage, bottom decile",
        "− Energy intensity 18.2% above sector median",
        "− Climate Resilience: D, 8th percentile of peers",
        "− No third-party ESG data assurance",
    ]

    pos_rows = [[Paragraph("POSITIVE FACTORS", ParagraphStyle("pos_h",
                fontName="Arial-Bold", fontSize=7.5, textColor=RISK_GOOD,
                letterSpacing=1, leading=11, spaceAfter=2*mm))]]
    for p in positives:
        pos_rows.append([Paragraph(p, ParagraphStyle("pos_i", fontName="Arial", fontSize=8.5,
                         textColor=TEXT_MED, leading=13))])

    neg_rows = [[Paragraph("NEGATIVE FACTORS", ParagraphStyle("neg_h",
                fontName="Arial-Bold", fontSize=7.5, textColor=RISK_CRITICAL,
                letterSpacing=1, leading=11, spaceAfter=2*mm))]]
    for n in negatives:
        neg_rows.append([Paragraph(n, ParagraphStyle("neg_i", fontName="Arial", fontSize=8.5,
                         textColor=TEXT_MED, leading=13))])

    col_w = (CONTENT_W - 4*mm) / 2
    pos_t = Table(pos_rows, colWidths=[col_w])
    pos_t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), CREAM_LIGHT),
        ("LINEBELOW", (0,0), (-1,0), 1.0, RISK_GOOD),
        ("LEFTPADDING", (0,0), (-1,-1), 5),
        ("TOPPADDING", (0,0), (-1,-1), 3),
        ("BOTTOMPADDING", (0,0), (-1,-1), 3),
    ]))
    neg_t = Table(neg_rows, colWidths=[col_w])
    neg_t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), CREAM_LIGHT),
        ("LINEBELOW", (0,0), (-1,0), 1.0, RISK_CRITICAL),
        ("LEFTPADDING", (0,0), (-1,-1), 5),
        ("TOPPADDING", (0,0), (-1,-1), 3),
        ("BOTTOMPADDING", (0,0), (-1,-1), 3),
    ]))
    pn = Table([[pos_t, neg_t]], colWidths=[col_w, col_w])
    pn.setStyle(TableStyle([
        ("LEFTPADDING", (0,0), (-1,-1), 0),
        ("RIGHTPADDING", (0,0), (-1,-1), 0),
        ("TOPPADDING", (0,0), (-1,-1), 0),
        ("BOTTOMPADDING", (0,0), (-1,-1), 0),
        ("VALIGN", (0,0), (-1,-1), "TOP"),
    ]))
    elements.append(pn)
    elements.append(Spacer(1, 3*mm))

    # Upgrade triggers
    elements.append(section_label("Upgrade Triggers — to BB or BB+", st, S01_GREEN))
    for trigger in [
        "SBTi commitment submitted (achievable in < 3 months)",
        "Third-party ISAE 3000 assurance on FY2025 sustainability data",
        "Scope 1 intensity falls below 1.85 tCO₂e/t (on trajectory: FY2027)",
        "Formal climate scenario analysis published (TCFD-aligned)",
    ]:
        elements.append(Paragraph(f"  ›  {trigger}", ParagraphStyle(
            "trig", fontName="Arial", fontSize=9, textColor=S01_GREEN, leading=14
        )))
    elements.append(Spacer(1, 3*mm))

    # Investor guidance table
    elements.append(section_label("Institutional Investor Guidance", st, TEXT_MUTED))
    inv_rows = [
        [Paragraph("ESG / Climate equity fund", st["td_bold"]),
         Paragraph("CONDITIONAL HOLD", ParagraphStyle("ig1", fontName="Arial-Bold", fontSize=8.5,
                   textColor=RISK_MED, leading=13)),
         Paragraph("Monitor SBTi submission. Below Paris-aligned threshold for most mandates.", st["td"])],
        [Paragraph("Investment grade bond / NCD", st["td_bold"]),
         Paragraph("REQUIRES IMPROVEMENT", ParagraphStyle("ig2", fontName="Arial-Bold", fontSize=8.5,
                   textColor=RISK_HIGH, leading=13)),
         Paragraph("Commission ESG assurance before credit mandate. Confidence HIGH but not VERY HIGH.", st["td"])],
        [Paragraph("Green / SLL bond", st["td_bold"]),
         Paragraph("NOT ELIGIBLE (current)", ParagraphStyle("ig3", fontName="Arial-Bold", fontSize=8.5,
                   textColor=RISK_CRITICAL, leading=13)),
         Paragraph("No SBTi target. No verified KPI framework. Eligible after SBTi + scenario analysis.", st["td"])],
        [Paragraph("Infrastructure / project finance", st["td_bold"]),
         Paragraph("PROCEED WITH CONDITIONS", ParagraphStyle("ig4", fontName="Arial-Bold", fontSize=8.5,
                   textColor=S04_BLUE, leading=13)),
         Paragraph("Physical risk assessment required as loan condition. Carbon stress-test in project model.", st["td"])],
        [Paragraph("Pension fund (PA mandate)", st["td_bold"]),
         Paragraph("BELOW THRESHOLD", ParagraphStyle("ig5", fontName="Arial-Bold", fontSize=8.5,
                   textColor=RISK_CRITICAL, leading=13)),
         Paragraph("B rating (28th pct) below typical PA mandate minimums (BB+ / A). Reassess in 12 months.", st["td"])],
    ]
    inv_t = clean_table(
        ["Use Case", "Suitability", "Rationale"],
        inv_rows,
        [45*mm, 42*mm, 88*mm],
        st, TEXT_DARK
    )
    elements.append(inv_t)
    elements.append(Spacer(1, 4*mm))

    # Final signature block
    sig = Table([[
        Paragraph("CIS RATING\nB  (40.3)", ParagraphStyle("sig1", fontName="Georgia-Bold", fontSize=12,
                  textColor=RISK_HIGH, leading=18)),
        Paragraph("CONFIDENCE\nHIGH (78)", ParagraphStyle("sig2", fontName="Georgia-Bold", fontSize=12,
                  textColor=S04_BLUE, leading=18)),
        Paragraph("OUTLOOK\nSTABLE / POS.", ParagraphStyle("sig3", fontName="Georgia-Bold", fontSize=12,
                  textColor=S01_GREEN, leading=18)),
        Paragraph("ASSESSMENT ID\nCX-2026-BSAL-001", ParagraphStyle("sig4", fontName="Arial", fontSize=9,
                  textColor=TEXT_LIGHT, leading=15)),
        Paragraph("ENGINE\nClimactix v1.0  ·  June 2026", ParagraphStyle("sig5", fontName="Arial", fontSize=9,
                  textColor=TEXT_LIGHT, leading=15)),
    ]])
    sig.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), CREAM),
        ("LINEABOVE", (0,0), (-1,-1), 1.5, GOLD),
        ("LINEBELOW", (0,0), (-1,-1), 0.3, BORDER_L),
        ("LINEAFTER", (0,0), (3,-1), 0.3, BORDER_M),
        ("LEFTPADDING", (0,0), (-1,-1), 8),
        ("TOPPADDING", (0,0), (-1,-1), 7),
        ("BOTTOMPADDING", (0,0), (-1,-1), 7),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
    ]))
    elements.append(sig)
    return elements


# ─────────────────────────────────────────────────────────────────────────────
# MAIN BUILD
# ─────────────────────────────────────────────────────────────────────────────

def build_pdf():
    doc = BaseDocTemplate(
        OUTPUT_PATH,
        pagesize=A4,
        leftMargin=MARGIN_L, rightMargin=MARGIN_R,
        topMargin=MARGIN_T, bottomMargin=MARGIN_B,
        title="BSAL Climate Intelligence Report — Climactix Global",
        author="Climactix Global Intelligence Engine",
        subject="Climate Intelligence Assessment FY2024",
        creator="Climactix Global v1.0",
    )

    templates = make_page_template(doc)
    doc.addPageTemplates(templates)

    st = build_styles()
    story = []

    # 1. Cover (uses cover template)
    story.append(Paragraph('<para></para>', ParagraphStyle("switch_cover",
                           fontName="Arial", fontSize=1, textColor=WHITE)))
    story[0]._frame = None  # handled by template switch below

    # Use nextTemplate commands to switch templates
    from reportlab.platypus import NextPageTemplate

    story = []
    story.append(NextPageTemplate("cover"))
    story += build_cover(st)

    story.append(NextPageTemplate("main"))
    story += build_executive_summary(st)
    story += build_scorecard(st)

    # Section dividers use full-page frame
    story.append(NextPageTemplate("divider"))
    story.append(SectionDividerPage("01", "Ambition &amp; Targets",
                 "Emissions baseline, trajectories and target credibility", S01_GREEN))
    story.append(NextPageTemplate("main"))
    story.append(PageBreak())

    # Section 01 content
    story.append(AccentBar(S01_GREEN))
    story.append(Spacer(1, 2*mm))
    story.append(section_label("01 — Ambition & Targets", st, S01_GREEN))
    story.append(Paragraph("Our <i>emissions</i> baseline", st["h1_italic"]))
    story += build_ambition_section(st)[4:]  # skip the section divider already added

    story.append(NextPageTemplate("divider"))
    story.append(SectionDividerPage("02", "Climate Risk Exposure",
                 "Physical hazards, asset vulnerability and adaptation", S02_PURPLE))
    story.append(NextPageTemplate("main"))
    story.append(PageBreak())
    story += build_physical_risk_section(st)[4:]

    story.append(NextPageTemplate("divider"))
    story.append(SectionDividerPage("03", "Transition Readiness",
                 "Carbon pricing, energy efficiency and technology lock-in", S03_SIENNA))
    story.append(NextPageTemplate("main"))
    story.append(PageBreak())
    story += build_transition_section(st)[4:]

    story += build_simulation_section(st)

    story.append(NextPageTemplate("divider"))
    story.append(SectionDividerPage("04", "Governance &amp; Disclosure",
                 "Board oversight, accountability and framework readiness", S05_ROSE))
    story.append(NextPageTemplate("main"))
    story.append(PageBreak())
    story += build_governance_section(st)[4:]

    story.append(NextPageTemplate("divider"))
    story.append(SectionDividerPage("05", "Priority Action Plan",
                 "Ranked by combined score impact and financial risk reduction", S_APP))
    story.append(NextPageTemplate("main"))
    story.append(PageBreak())
    story += build_priority_actions(st)[4:]

    story += build_rating_page(st)

    doc.build(story)
    size_mb = os.path.getsize(OUTPUT_PATH) / (1024 * 1024)
    print(f"PDF generated: {OUTPUT_PATH}")
    print(f"File size: {size_mb:.2f} MB")


if __name__ == "__main__":
    build_pdf()
