"""
Generates SYNTHETIC disclosure documents for tests and local demonstration.

The companies named here do not exist. Every figure is invented for testing
the pipeline and must never be presented as a real company's data.
"""

from __future__ import annotations

import io
import sys
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

SS = getSampleStyleSheet()


def _table(rows):
    t = Table(rows, hAlign="LEFT")
    t.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                           ("FONTSIZE", (0, 0), (-1, -1), 8),
                           ("BACKGROUND", (0, 0), (-1, 0), colors.whitesmoke)]))
    return t


def brsr_pdf(company: str = "Meridian Forge Industries Limited", fy: str = "2024-25", prev: str = "2023-24",
             *, s1=(182400, 196300), s2=(96200, 104800), s3=(1240000, None), energy=(4120000, 4310000),
             water=(2860000, 3010000), recycled=(915000, 880000), waste=(48200, 51100), waste_rec=(39500, 39800),
             haz=(3120, 3460), revenue=(8420, 7910), renewable=(31.5, 24.0), assurance=True,
             net_zero=True) -> bytes:
    """A BRSR-style report. Tuples are (current FY, previous FY)."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, title=f"{company} Business Responsibility and Sustainability Report FY{fy}")
    cur, old = f"FY {fy}", f"FY {prev}"

    def row(label, pair):
        return [label, f"{pair[0]:,}" if pair[0] is not None else "-", f"{pair[1]:,}" if pair[1] is not None else "-"]

    s = [Paragraph(company, SS["Title"]),
         Paragraph(f"Business Responsibility and Sustainability Report FY{fy}", SS["Heading1"]),
         Paragraph(f"This Business Responsibility and Sustainability Report (BRSR) of {company} covers the financial "
                   f"year {fy} and is prepared in accordance with the SEBI BRSR format. SYNTHETIC TEST DOCUMENT.",
                   SS["BodyText"]),
         Spacer(1, 12),
         Paragraph("Section A: General Disclosures", SS["Heading2"]),
         _table([["Particulars (INR crore)", cur, old], row("Revenue from operations", revenue),
                 ["Total employees", "12,480", "12,105"]]),
         PageBreak(),
         Paragraph("Principle 6: Environment", SS["Heading1"]),
         Paragraph("Greenhouse gas emissions", SS["Heading2"]),
         _table([["Parameter", "Unit", cur, old],
                 ["Total Scope 1 emissions", "tCO2e"] + row("", s1)[1:],
                 ["Total Scope 2 emissions (location-based)", "tCO2e"] + row("", s2)[1:],
                 ["Total Scope 3 emissions", "tCO2e"] + row("", s3)[1:]]),
         Spacer(1, 10),
         Paragraph("Energy, water and waste", SS["Heading2"]),
         _table([["Parameter", "Unit", cur, old],
                 ["Total energy consumption", "GJ"] + row("", energy)[1:],
                 ["Total water withdrawal", "kilolitres"] + row("", water)[1:],
                 ["Water recycled and reused", "kilolitres"] + row("", recycled)[1:],
                 ["Total waste generated", "tonnes"] + row("", waste)[1:],
                 ["Waste recycled", "tonnes"] + row("", waste_rec)[1:],
                 ["Hazardous waste", "tonnes"] + row("", haz)[1:]]),
         Spacer(1, 10),
         Paragraph(f"Renewable energy share of total energy consumption was {renewable[0]}% in FY {fy}, "
                   f"compared with {renewable[1]}% in FY {prev}.", SS["BodyText"]),
         PageBreak(),
         Paragraph("Climate strategy and governance", SS["Heading1"])]
    if net_zero:
        s += [Paragraph("We have set a target to achieve net zero Scope 1 and Scope 2 emissions by 2045. "
                        "We are committed to reduce Scope 1 and 2 emissions by 42% by 2030 from a 2020 baseline.",
                        SS["BodyText"])]
    else:
        s += [Paragraph("The Company has not yet set a quantified emissions target.", SS["BodyText"])]
    s += [Paragraph("The Board of Directors oversees climate and sustainability matters through the ESG and "
                    "Sustainability Committee, which met four times during the year.", SS["BodyText"]),
          Paragraph("Physical climate risk was assessed across all manufacturing sites, including flood risk "
                    "exposure at our coastal plants. Climate scenario analysis was conducted using NGFS scenarios.",
                    SS["BodyText"]),
          Paragraph("Our decarbonisation roadmap includes fuel switching and electrification of process heat. "
                    "Climate adaptation measures include flood protection at two sites.", SS["BodyText"])]
    if assurance:
        s += [Paragraph("Scope 1 and 2 GHG emissions, energy and water data were subject to limited assurance by an "
                        "independent third party in accordance with ISAE 3000.", SS["BodyText"])]
    else:
        s += [Paragraph("The data in this report has not been externally assured.", SS["BodyText"])]
    doc.build(s)
    return buf.getvalue()


def scanned_pdf() -> bytes:
    """A PDF whose only page is an image (no text layer)."""
    import fitz
    from PIL import Image, ImageDraw
    img = Image.new("RGB", (1000, 400), "white")
    ImageDraw.Draw(img).text((40, 40), "Total Scope 1 emissions 1,234 tCO2e", fill="black")
    b = io.BytesIO()
    img.save(b, "PNG")
    d = fitz.open()
    page = d.new_page()
    page.insert_image(page.rect, stream=b.getvalue())
    return d.tobytes()


if __name__ == "__main__":
    out = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
    out.mkdir(parents=True, exist_ok=True)
    (out / "SYNTHETIC_meridian_forge_brsr_fy2024-25.pdf").write_bytes(brsr_pdf())
    print("written to", out)
