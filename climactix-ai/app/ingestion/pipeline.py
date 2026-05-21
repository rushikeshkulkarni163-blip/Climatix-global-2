"""
RAG Ingestion Pipeline — Climactix AI

Full pipeline: file → load → chunk → embed → store in Qdrant

Usage:
    from app.ingestion.pipeline import ingest_file
    chunks_count = await ingest_file("data/ipcc_ar6_spm.pdf", collection="climate_reports")
"""

import hashlib
from typing import Optional

from langchain_core.documents import Document

from app.ingestion.chunker import chunk_documents
from app.ingestion.document_loader import load_document
from app.retrieval.qdrant_client import COLLECTIONS, vector_store
from app.services.openai_service import embed_batch
from app.utils.logger import logger

EMBED_BATCH_SIZE = 100  # OpenAI allows up to 2048; 100 keeps requests manageable


def _stable_id(source: str, index: int, text: str) -> str:
    """
    Generate a stable deterministic ID for a chunk.
    Re-ingesting the same file produces the same IDs → safe upsert (no duplicates).
    """
    fingerprint = f"{source}::{index}::{text[:80]}"
    return hashlib.sha256(fingerprint.encode()).hexdigest()[:32]


async def ingest_file(
    file_path: str,
    collection: str = "esg_documents",
    metadata: Optional[dict] = None,
    chunk_size: int = 512,
    chunk_overlap: int = 64,
) -> int:
    """
    Ingest a single document into the Qdrant vector store.

    Steps:
        1. Load file into Document objects
        2. Split into overlapping chunks
        3. Embed chunks in batches via OpenAI text-embedding-3-small
        4. Upsert vectors + metadata into Qdrant

    Args:
        file_path:     Path to .pdf, .txt, or .md file
        collection:    Target Qdrant collection (must be in COLLECTIONS registry)
        metadata:      Extra metadata to tag every chunk (e.g. {"framework": "TCFD", "year": 2023})
        chunk_size:    Characters per chunk (default 512)
        chunk_overlap: Overlap between chunks (default 64)

    Returns:
        Number of chunks ingested

    Raises:
        RuntimeError: If Qdrant is not connected
        ValueError:   If collection is not registered
    """
    if not vector_store.is_ready:
        raise RuntimeError(
            "Qdrant is not running. Start it with: docker compose up qdrant -d"
        )
    if collection not in COLLECTIONS:
        raise ValueError(f"Unknown collection '{collection}'. Valid: {list(COLLECTIONS)}")

    # ── 1. Load ───────────────────────────────────────────────────────────────
    docs = load_document(file_path)

    # ── 2. Chunk ──────────────────────────────────────────────────────────────
    chunks: list[Document] = chunk_documents(docs, chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    logger.info(f"Split into {len(chunks)} chunks (size={chunk_size}, overlap={chunk_overlap})")

    # ── 3. Embed ──────────────────────────────────────────────────────────────
    texts = [c.page_content for c in chunks]
    all_vectors: list[list[float]] = []

    for i in range(0, len(texts), EMBED_BATCH_SIZE):
        batch = texts[i : i + EMBED_BATCH_SIZE]
        vectors = await embed_batch(batch)
        all_vectors.extend(vectors)
        logger.info(f"Embedded {min(i + EMBED_BATCH_SIZE, len(texts))}/{len(texts)} chunks")

    # ── 4. Upsert ─────────────────────────────────────────────────────────────
    extra = metadata or {}
    for idx, (chunk, vector) in enumerate(zip(chunks, all_vectors)):
        doc_id = _stable_id(file_path, idx, chunk.page_content)
        payload = {
            "text": chunk.page_content,
            "source": file_path,
            "chunk_index": idx,
            "page": chunk.metadata.get("page", idx),
            **extra,
        }
        vector_store.upsert(collection, doc_id, vector, payload)

    logger.info(f"Ingestion complete: {len(chunks)} chunks → collection '{collection}'")
    return len(chunks)


async def ingest_directory(
    directory: str,
    collection: str = "esg_documents",
    glob: str = "*.pdf",
    metadata: Optional[dict] = None,
) -> dict[str, int]:
    """
    Ingest all matching files in a directory.

    Returns:
        Dict mapping filename → chunks ingested
    """
    from pathlib import Path

    results: dict[str, int] = {}
    files = list(Path(directory).glob(glob))

    if not files:
        logger.warning(f"No files matched '{glob}' in {directory}")
        return results

    logger.info(f"Ingesting {len(files)} files from {directory}")
    for f in files:
        try:
            count = await ingest_file(str(f), collection=collection, metadata=metadata)
            results[f.name] = count
        except Exception as e:
            logger.error(f"Failed to ingest {f.name}: {e}")
            results[f.name] = -1

    return results
