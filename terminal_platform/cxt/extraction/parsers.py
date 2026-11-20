"""
Format parsers → ParsedDocument (a list of locatable units with text,
headings, tables and a visual-content flag).

Each parser returns units an analyst can navigate to: PDF pages, PPTX
slides, XLSX sheets, DOCX/HTML heading sections, TXT parts. New formats are
added by registering a function in PARSERS — nothing downstream changes.
"""

from __future__ import annotations

import csv
import io
import ipaddress
import re
import socket
import statistics
import threading
from typing import Callable
from urllib.parse import urlparse

from .domain import ParsedDocument, ParsedPage, ParsedTable

_OCR_MIN_CHARS = 20          # below this a PDF page is treated as having no text layer
_TXT_UNIT_CHARS = 4000       # logical "part" size for unpaginated text
_MAX_URL_BYTES = 60 * 1024 * 1024


# PyMuPDF is not thread-safe: concurrent use from worker threads silently corrupts
# results (e.g. table detection dropping rows). Every fitz call goes through this lock.
# Scale-out path: run extraction in a process pool / separate workers instead.
FITZ_LOCK = threading.Lock()


class UnsupportedFormat(ValueError):
    pass


def _clean_cell(v) -> str:
    if v is None:
        return ""
    return re.sub(r"\s+", " ", str(v)).strip()


# ── PDF ──────────────────────────────────────────────────────────────────────

def _ocr_png(png: bytes) -> str:
    try:
        import pytesseract
        from PIL import Image
        return pytesseract.image_to_string(Image.open(io.BytesIO(png))) or ""
    except Exception:
        return ""   # OCR stack unavailable — caller records the page as unreadable


def parse_pdf(content: bytes) -> ParsedDocument:
    with FITZ_LOCK:
        return _parse_pdf(content)


def _parse_pdf(content: bytes) -> ParsedDocument:
    import fitz  # PyMuPDF

    pages: list[ParsedPage] = []
    warnings: list[str] = []
    with fitz.open(stream=content, filetype="pdf") as doc:
        title = (doc.metadata or {}).get("title") or None
        for i, page in enumerate(doc):
            page_no = i + 1
            text = page.get_text("text") or ""
            is_ocr = False
            if len(text.strip()) < _OCR_MIN_CHARS:
                ocr = _ocr_png(page.get_pixmap(dpi=200).tobytes("png"))
                if ocr.strip():
                    text, is_ocr = ocr, True
                elif page.get_images():
                    warnings.append(f"Page {page_no}: image-only page, OCR unavailable — no text extracted")

            headings = [] if is_ocr else _pdf_headings(page)
            tables: list[ParsedTable] = []
            table_rects = []        # every detected table region (for chart detection)
            table_pos = []          # (region, table) for tables actually kept
            if not is_ocr:
                try:
                    for t_idx, tab in enumerate(page.find_tables().tables):
                        table_rects.append(fitz.Rect(tab.bbox) + (-4, -4, 4, 4))
                        data = [[_clean_cell(c) for c in row] for row in tab.extract()]
                        data = [r for r in data if any(r)]
                        if len(data) >= 2:
                            tables.append(ParsedTable(index=t_idx + 1, header=data[0], rows=data[1:]))
                            table_pos.append((table_rects[-1], tables[-1]))
                except Exception:
                    pass  # table finder is best-effort; page text is still retained

            # Charts in sustainability reports are usually vector drawings or
            # embedded images. Flag them so numbers are never read off a chart
            # that the text layer does not also state. Table borders are excluded.
            try:
                drawings = [d for d in page.get_drawings() if not any(_inside(d["rect"], tr) for tr in table_rects)]
            except Exception:
                drawings = []
            has_visuals = bool(page.get_images()) or len(drawings) >= 4

            if not is_ocr:
                text = _paragraph_text(page, table_pos) or text

            pages.append(ParsedPage(page_no=page_no, label=f"Page {page_no}", text=text,
                                    headings=headings, tables=tables, is_ocr=is_ocr,
                                    has_visuals=has_visuals))
    return ParsedDocument(file_format="pdf", pages=pages, title=title, warnings=warnings)


def _paragraph_text(page, table_pos: list) -> str:
    """Page text with paragraph breaks preserved (one PDF text block = one paragraph)
    and each detected table rendered as pipe-delimited rows in reading order. Without
    this, untitled table cells run straight into the next sentence and corrupt it."""
    import fitz
    parts: list[tuple[float, float, str]] = []
    for x0, y0, x1, y1, txt, _no, btype in page.get_text("blocks"):
        if btype != 0 or not txt.strip():
            continue
        if any(_inside(fitz.Rect(x0, y0, x1, y1), tr) for tr, _ in table_pos):
            continue
        parts.append((y0, x0, txt.strip()))
    for tr, t in table_pos:
        parts.append((tr.y0, tr.x0, "\n".join(t.as_text_lines())))
    parts.sort(key=lambda p: (round(p[0]), p[1]))
    return "\n\n".join(p[2] for p in parts)


def _inside(r, box) -> bool:
    # coordinate test: PyMuPDF treats zero-height line rects as empty, so .intersects() is False for them
    return box.x0 <= r.x0 and r.x1 <= box.x1 and box.y0 <= r.y0 and r.y1 <= box.y1


def _pdf_headings(page) -> list[tuple[int, str]]:
    """Headings = short lines set noticeably larger than the page's body text."""
    spans = []
    for block in page.get_text("dict").get("blocks", []):
        for line in block.get("lines", []):
            txt = "".join(s["text"] for s in line.get("spans", [])).strip()
            if not txt or not line.get("spans"):
                continue
            size = max(s["size"] for s in line["spans"])
            bold = any("bold" in s.get("font", "").lower() for s in line["spans"])
            spans.append((size, bold, txt))
    if not spans:
        return []
    body = statistics.median(s for s, _, _ in spans)
    out = []
    for size, bold, txt in spans:
        if len(txt) > 120 or len(txt) < 3 or re.fullmatch(r"[\d\s.,%|-]+", txt):
            continue
        if size >= body * 1.45:
            out.append((1, txt))
        elif size >= body * 1.15 and bold:
            out.append((2, txt))
    return out


# ── DOCX ─────────────────────────────────────────────────────────────────────

def parse_docx(content: bytes) -> ParsedDocument:
    import docx
    from docx.document import Document as _Doc
    from docx.table import Table
    from docx.text.paragraph import Paragraph

    d: _Doc = docx.Document(io.BytesIO(content))
    units: list[ParsedPage] = []
    cur_lines: list[str] = []
    cur_heads: list[tuple[int, str]] = []
    cur_tables: list[ParsedTable] = []

    def flush():
        if cur_lines or cur_tables:
            n = len(units) + 1
            label = f"Section {n}" + (f": {cur_heads[0][1][:60]}" if cur_heads else "")
            units.append(ParsedPage(page_no=n, label=label, text="\n\n".join(cur_lines),
                                    headings=list(cur_heads), tables=list(cur_tables)))
        cur_lines.clear(); cur_heads.clear(); cur_tables.clear()

    body = d.element.body
    for child in body.iterchildren():
        tag = child.tag.rsplit("}", 1)[-1]
        if tag == "p":
            p = Paragraph(child, d)
            txt = p.text.strip()
            style = (p.style.name or "").lower() if p.style is not None else ""
            m = re.match(r"heading (\d)", style)
            if m and txt:
                if int(m.group(1)) <= 2:
                    flush()
                cur_heads.append((int(m.group(1)), txt))
            if txt:
                cur_lines.append(txt)
        elif tag == "tbl":
            t = Table(child, d)
            data = [[_clean_cell(c.text) for c in r.cells] for r in t.rows]
            data = [r for r in data if any(r)]
            if data:
                pt = ParsedTable(index=len(cur_tables) + 1, header=data[0], rows=data[1:])
                cur_tables.append(pt)
                cur_lines.extend(pt.as_text_lines())
    flush()
    has_images = bool(d.inline_shapes)
    if has_images and units:
        units[0].has_visuals = True
    return ParsedDocument(file_format="docx", pages=units,
                          title=(d.core_properties.title or None))


# ── XLSX / CSV ───────────────────────────────────────────────────────────────

_HEADER_HINT = re.compile(r"^(?:FY\s?)?20\d\d(?:\s?[-–/]\s?\d{2,4})?$|^(?:unit|units|uom|parameter|particulars|metric|indicator)s?$", re.I)


def _split_header(rows: list[list[str]]) -> tuple[list[str], list[str], list[list[str]]]:
    """(title lines, header, body). Report spreadsheets often carry title rows
    above the real header; the header is the first of the top rows that names
    a reporting year or a unit/parameter column."""
    for i, r in enumerate(rows[:8]):
        filled = [c for c in r if c]
        if len(filled) >= 2 and any(_HEADER_HINT.match(c.strip()) for c in filled):
            return [" ".join(x for x in t if x) for t in rows[:i]], r, rows[i + 1:]
    return [], rows[0], rows[1:]


def parse_xlsx(content: bytes) -> ParsedDocument:
    import openpyxl
    wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True, read_only=True)
    units = []
    for i, ws in enumerate(wb.worksheets):
        rows = [[_clean_cell(c) for c in r] for r in ws.iter_rows(values_only=True)]
        rows = [r for r in rows if any(r)]
        if not rows:
            continue
        width = max(len(r) for r in rows)
        rows = [r + [""] * (width - len(r)) for r in rows]
        titles, header, body = _split_header(rows)
        table = ParsedTable(index=1, header=header, rows=body)
        units.append(ParsedPage(page_no=i + 1, label=f"Sheet: {ws.title}",
                                text="\n".join(titles + table.as_text_lines()),
                                headings=[(1, ws.title)], tables=[table]))
    return ParsedDocument(file_format="xlsx", pages=units)


def parse_csv(content: bytes) -> ParsedDocument:
    text = content.decode("utf-8-sig", errors="replace")
    rows = [[_clean_cell(c) for c in r] for r in csv.reader(io.StringIO(text))]
    rows = [r for r in rows if any(r)]
    if not rows:
        return ParsedDocument(file_format="csv", pages=[])
    titles, header, body = _split_header(rows)
    units = []
    for start in range(0, max(len(body), 1), 200):
        chunk = body[start:start + 200]
        t = ParsedTable(index=1, header=header, rows=chunk)
        units.append(ParsedPage(page_no=len(units) + 1,
                                label=f"Rows {start + 2}–{start + 1 + len(chunk)}",
                                text="\n".join((titles if start == 0 else []) + t.as_text_lines()), tables=[t]))
    return ParsedDocument(file_format="csv", pages=units)


# ── PPTX ─────────────────────────────────────────────────────────────────────

def parse_pptx(content: bytes) -> ParsedDocument:
    try:
        from pptx import Presentation
        from pptx.enum.shapes import MSO_SHAPE_TYPE
    except ImportError as exc:
        raise UnsupportedFormat("PPTX support requires python-pptx (see requirements.txt)") from exc

    prs = Presentation(io.BytesIO(content))
    units = []
    for i, slide in enumerate(prs.slides):
        lines, tables, heads, visual = [], [], [], False
        if slide.shapes.title is not None and slide.shapes.title.text.strip():
            heads.append((1, slide.shapes.title.text.strip()))
        for shape in slide.shapes:
            if shape.has_text_frame:
                t = shape.text_frame.text.strip()
                if t:
                    lines.append(t)
            if getattr(shape, "has_table", False) and shape.has_table:
                data = [[_clean_cell(c.text) for c in r.cells] for r in shape.table.rows]
                if data:
                    pt = ParsedTable(index=len(tables) + 1, header=data[0], rows=data[1:])
                    tables.append(pt)
                    lines.extend(pt.as_text_lines())
            if getattr(shape, "has_chart", False) and shape.has_chart:
                visual = True
            if shape.shape_type == MSO_SHAPE_TYPE.PICTURE:
                visual = True
        units.append(ParsedPage(page_no=i + 1, label=f"Slide {i + 1}", text="\n\n".join(lines),
                                headings=heads, tables=tables, has_visuals=visual))
    return ParsedDocument(file_format="pptx", pages=units)


# ── TXT / HTML ───────────────────────────────────────────────────────────────

def parse_txt(content: bytes) -> ParsedDocument:
    text = content.decode("utf-8", errors="replace")
    paras = re.split(r"\n\s*\n", text)
    units, buf = [], []
    for p in paras:
        buf.append(p.strip())
        if sum(len(b) for b in buf) >= _TXT_UNIT_CHARS:
            units.append("\n\n".join(buf)); buf = []
    if buf:
        units.append("\n\n".join(buf))
    return ParsedDocument(file_format="txt", pages=[
        ParsedPage(page_no=i + 1, label=f"Part {i + 1}", text=u) for i, u in enumerate(units) if u.strip()])


def parse_html(content: bytes) -> ParsedDocument:
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(content, "html.parser")
    for t in soup(["script", "style", "noscript", "nav", "footer", "svg"]):
        t.decompose()
    title = soup.title.get_text(strip=True) if soup.title else None
    root = soup.body or soup
    units: list[ParsedPage] = []
    lines: list[str] = []
    heads: list[tuple[int, str]] = []
    tables: list[ParsedTable] = []
    visual = False

    def flush():
        nonlocal visual
        if lines:
            n = len(units) + 1
            units.append(ParsedPage(page_no=n, label=f"Section {n}" + (f": {heads[0][1][:60]}" if heads else ""),
                                    text="\n\n".join(lines), headings=list(heads), tables=list(tables),
                                    has_visuals=visual))
        lines.clear(); heads.clear(); tables.clear(); visual = False

    for el in root.find_all(["h1", "h2", "h3", "p", "li", "table", "img", "canvas"]):
        if el.find_parent("table") is not None and el.name != "table":
            continue
        if el.name in ("img", "canvas"):
            visual = True
            continue
        if el.name == "table":
            data = [[_clean_cell(c.get_text(" ")) for c in tr.find_all(["td", "th"])] for tr in el.find_all("tr")]
            data = [r for r in data if any(r)]
            if data:
                pt = ParsedTable(index=len(tables) + 1, header=data[0], rows=data[1:])
                tables.append(pt)
                lines.extend(pt.as_text_lines())
            continue
        txt = _clean_cell(el.get_text(" "))
        if not txt:
            continue
        if el.name in ("h1", "h2"):
            flush()
        if el.name in ("h1", "h2", "h3"):
            heads.append((int(el.name[1]), txt))
        lines.append(txt)
    flush()
    return ParsedDocument(file_format="html", pages=units, title=title)


# ── Registry ─────────────────────────────────────────────────────────────────

PARSERS: dict[str, Callable[[bytes], ParsedDocument]] = {
    "pdf": parse_pdf, "docx": parse_docx, "xlsx": parse_xlsx, "csv": parse_csv,
    "pptx": parse_pptx, "txt": parse_txt, "html": parse_html,
}

_EXT = {".pdf": "pdf", ".docx": "docx", ".xlsx": "xlsx", ".xlsm": "xlsx", ".csv": "csv",
        ".pptx": "pptx", ".txt": "txt", ".md": "txt", ".html": "html", ".htm": "html"}

_MAGIC = [(b"%PDF", "pdf")]


def detect_format(filename: str, content: bytes, content_type: str = "") -> str:
    """Determine format from extension, cross-checked against magic bytes."""
    fn = filename.lower()
    fmt = next((f for ext, f in _EXT.items() if fn.endswith(ext)), None)
    for magic, f in _MAGIC:
        if content.startswith(magic):
            return f
    if fmt in ("docx", "xlsx", "pptx") and not content.startswith(b"PK"):
        raise UnsupportedFormat(f"{filename}: content is not a valid Office Open XML package")
    if fmt == "pdf":
        raise UnsupportedFormat(f"{filename}: extension is .pdf but content is not a PDF")
    if fmt:
        return fmt
    ct = content_type.lower()
    if "html" in ct:
        return "html"
    if "csv" in ct:
        return "csv"
    if "text/plain" in ct:
        return "txt"
    raise UnsupportedFormat(f"Unsupported file type: {filename}")


def parse(content: bytes, file_format: str) -> ParsedDocument:
    if file_format not in PARSERS:
        raise UnsupportedFormat(f"No parser registered for '{file_format}'")
    return PARSERS[file_format](content)


# ── Public URL ingestion (SSRF-guarded) ──────────────────────────────────────

def _assert_public_host(host: str, allowlist: tuple[str, ...]) -> None:
    if allowlist and host.lower() not in allowlist and not any(host.lower().endswith("." + a) for a in allowlist):
        raise UnsupportedFormat(f"Host {host} is not in EVIDENCE_URL_ALLOWLIST")
    for info in socket.getaddrinfo(host, None):
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
            raise UnsupportedFormat("URL resolves to a non-public address")


def fetch_url(url: str, allowlist: tuple[str, ...] = ()) -> tuple[bytes, str, str]:
    """Download a public document. Returns (content, filename, content_type)."""
    import httpx

    current = url
    for _ in range(4):  # follow redirects manually so every hop is re-validated
        parsed = urlparse(current)
        if parsed.scheme not in ("http", "https") or not parsed.hostname:
            raise UnsupportedFormat("Only http(s) URLs are supported")
        _assert_public_host(parsed.hostname, allowlist)
        with httpx.Client(timeout=30, follow_redirects=False) as client:
            with client.stream("GET", current, headers={"User-Agent": "Climactix-Evidence-Engine/1.0"}) as r:
                if r.status_code in (301, 302, 303, 307, 308) and r.headers.get("location"):
                    current = str(httpx.URL(current).join(r.headers["location"]))
                    continue
                r.raise_for_status()
                buf = bytearray()
                for chunk in r.iter_bytes():
                    buf.extend(chunk)
                    if len(buf) > _MAX_URL_BYTES:
                        raise UnsupportedFormat("Remote document exceeds size limit")
                ct = r.headers.get("content-type", "")
                name = parsed.path.rsplit("/", 1)[-1] or parsed.hostname
                if "pdf" in ct and not name.lower().endswith(".pdf"):
                    name += ".pdf"
                elif "html" in ct and not name.lower().endswith((".html", ".htm")):
                    name += ".html"
                return bytes(buf), name, ct
    raise UnsupportedFormat("Too many redirects")
