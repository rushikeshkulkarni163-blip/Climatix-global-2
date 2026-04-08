"""
Climactix AI — File Extraction Service
Supports: PDF (PyMuPDF), DOCX (python-docx), XLSX (openpyxl)
"""

import io
import re


def extract_text(content: bytes, filename: str, content_type: str = "") -> str:
    """Route file to the correct extractor based on extension / MIME type."""
    fn = filename.lower()

    if fn.endswith(".pdf") or "pdf" in content_type:
        return _extract_pdf(content)
    elif fn.endswith(".docx") or "word" in content_type or "openxmlformats" in content_type:
        return _extract_docx(content)
    elif fn.endswith(".xlsx") or "spreadsheet" in content_type or "excel" in content_type:
        return _extract_xlsx(content)
    elif fn.endswith(".txt") or "text/plain" in content_type:
        return content.decode("utf-8", errors="replace")
    else:
        # Best-effort: try UTF-8 text decode
        try:
            return content.decode("utf-8", errors="replace")
        except Exception:
            raise ValueError(f"Unsupported file type: {filename}")


def _extract_pdf(content: bytes) -> str:
    """Extract text from PDF using PyMuPDF."""
    try:
        import fitz  # PyMuPDF

        parts = []
        with fitz.open(stream=content, filetype="pdf") as doc:
            for i, page in enumerate(doc):
                text = page.get_text("text")
                if text.strip():
                    parts.append(f"[Page {i + 1}]\n{text.strip()}")

        full_text = "\n\n".join(parts)
        return _clean_text(full_text)
    except ImportError:
        raise RuntimeError("PyMuPDF not installed. Run: pip install pymupdf")


def _extract_docx(content: bytes) -> str:
    """Extract text from DOCX using python-docx."""
    try:
        from docx import Document

        doc = Document(io.BytesIO(content))
        paragraphs = []

        for para in doc.paragraphs:
            text = para.text.strip()
            if text:
                paragraphs.append(text)

        # Also extract tables
        for table in doc.tables:
            for row in table.rows:
                cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                if cells:
                    paragraphs.append(" | ".join(cells))

        return _clean_text("\n\n".join(paragraphs))
    except ImportError:
        raise RuntimeError("python-docx not installed. Run: pip install python-docx")


def _extract_xlsx(content: bytes) -> str:
    """Extract text from XLSX using openpyxl."""
    try:
        import openpyxl

        wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
        parts = []

        for sheet in wb.worksheets:
            parts.append(f"=== Sheet: {sheet.title} ===")
            for row in sheet.iter_rows(values_only=True):
                cells = [str(c) for c in row if c is not None and str(c).strip() not in ("", "None")]
                if cells:
                    parts.append("  |  ".join(cells))

        return _clean_text("\n".join(parts))
    except ImportError:
        raise RuntimeError("openpyxl not installed. Run: pip install openpyxl")


def _clean_text(text: str) -> str:
    """Remove excessive whitespace and normalize text."""
    # Collapse 3+ blank lines to 2
    text = re.sub(r"\n{3,}", "\n\n", text)
    # Remove non-printable characters except newlines/tabs
    text = re.sub(r"[^\x09\x0A\x0D\x20-\x7E\u00A0-\uFFFF]", " ", text)
    return text.strip()
