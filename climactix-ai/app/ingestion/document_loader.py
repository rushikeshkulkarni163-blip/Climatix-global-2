"""
Document Loader — Climactix AI RAG Pipeline

Loads PDFs, text files, and markdown into LangChain Document objects.
Each Document has .page_content (text) and .metadata (source, page, etc.)
"""

from pathlib import Path

from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain_core.documents import Document

from app.utils.logger import logger


def load_pdf(path: str) -> list[Document]:
    """Load a PDF file — returns one Document per page."""
    logger.info(f"Loading PDF: {path}")
    loader = PyPDFLoader(path)
    docs = loader.load()
    logger.info(f"Loaded {len(docs)} pages from {Path(path).name}")
    return docs


def load_text(path: str) -> list[Document]:
    """Load a plain text or markdown file as a single Document."""
    logger.info(f"Loading text: {path}")
    loader = TextLoader(path, encoding="utf-8")
    docs = loader.load()
    logger.info(f"Loaded {len(docs)} document(s) from {Path(path).name}")
    return docs


def load_document(path: str) -> list[Document]:
    """
    Auto-detect file type and load.
    Supported: .pdf, .txt, .md
    """
    suffix = Path(path).suffix.lower()
    if suffix == ".pdf":
        return load_pdf(path)
    elif suffix in (".txt", ".md"):
        return load_text(path)
    else:
        raise ValueError(f"Unsupported file type '{suffix}'. Supported: .pdf, .txt, .md")
