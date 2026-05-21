"""
Document Chunker — Climactix AI RAG Pipeline

Splits large documents into overlapping chunks for embedding.
Smaller chunks = more precise retrieval.
Overlap = prevents context from being cut at chunk boundaries.
"""

from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

# 512 tokens ≈ 400 words — good balance for ESG/climate report chunks
DEFAULT_CHUNK_SIZE = 512
DEFAULT_CHUNK_OVERLAP = 64


def chunk_documents(
    documents: list[Document],
    chunk_size: int = DEFAULT_CHUNK_SIZE,
    chunk_overlap: int = DEFAULT_CHUNK_OVERLAP,
) -> list[Document]:
    """
    Split documents into overlapping text chunks.

    Args:
        documents: List of LangChain Documents (from document_loader)
        chunk_size: Max characters per chunk
        chunk_overlap: Characters shared between adjacent chunks

    Returns:
        List of smaller Document chunks, each with inherited metadata
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        # Try these separators in order — prefer natural breaks
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    chunks = splitter.split_documents(documents)
    return chunks
