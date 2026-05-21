"""
Ingest Routes — Climactix AI RAG Pipeline

Endpoints for uploading and ingesting documents into the vector store.
"""

import os
import tempfile

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from app.ingestion.pipeline import ingest_directory, ingest_file
from app.retrieval.qdrant_client import COLLECTIONS, vector_store
from app.utils.logger import logger

router = APIRouter(tags=["RAG Ingestion"])


class IngestResponse(BaseModel):
    file: str
    collection: str
    chunks_ingested: int
    status: str


class CollectionsResponse(BaseModel):
    collections: list[dict]


@router.post(
    "/ingest/upload",
    response_model=IngestResponse,
    summary="Upload and ingest a document into the knowledge base",
    description=(
        "Upload a PDF, TXT, or MD file. The pipeline will:\n"
        "1. Load and parse the document\n"
        "2. Split into overlapping chunks\n"
        "3. Embed each chunk via OpenAI text-embedding-3-small\n"
        "4. Store vectors + metadata in Qdrant\n\n"
        "Requires Qdrant to be running (`docker compose up qdrant -d`)."
    ),
)
async def upload_and_ingest(
    file: UploadFile = File(..., description="PDF, TXT, or MD file to ingest"),
    collection: str = Form(default="esg_documents", description="Target collection"),
    document_type: str = Form(default="", description="Optional tag e.g. 'TCFD report', 'IPCC AR6'"),
    year: str = Form(default="", description="Optional publication year e.g. '2023'"),
) -> IngestResponse:
    if not vector_store.is_ready:
        raise HTTPException(
            status_code=503,
            detail="Qdrant is not running. Start it with: docker compose up qdrant -d",
        )
    if collection not in COLLECTIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown collection '{collection}'. Valid: {list(COLLECTIONS)}",
        )

    suffix = os.path.splitext(file.filename or "")[1].lower()
    if suffix not in (".pdf", ".txt", ".md"):
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Upload a .pdf, .txt, or .md file.",
        )

    # Write upload to a temp file, then ingest
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        metadata = {"original_filename": file.filename}
        if document_type:
            metadata["document_type"] = document_type
        if year:
            metadata["year"] = year

        chunks = await ingest_file(tmp_path, collection=collection, metadata=metadata)
        logger.info(f"Uploaded and ingested '{file.filename}' → {chunks} chunks")

        return IngestResponse(
            file=file.filename or tmp_path,
            collection=collection,
            chunks_ingested=chunks,
            status="success",
        )
    finally:
        os.unlink(tmp_path)


@router.post(
    "/ingest/directory",
    summary="Ingest all PDFs from the data/ directory",
    description="Batch-ingest all .pdf files from the local `data/` folder into the knowledge base.",
)
async def ingest_data_directory(
    collection: str = "esg_documents",
    glob: str = "*.pdf",
) -> dict:
    if not vector_store.is_ready:
        raise HTTPException(
            status_code=503,
            detail="Qdrant is not running. Start it with: docker compose up qdrant -d",
        )

    results = await ingest_directory("data/", collection=collection, glob=glob)
    total = sum(v for v in results.values() if v > 0)
    return {
        "files_processed": len(results),
        "total_chunks": total,
        "results": results,
    }


@router.get(
    "/collections",
    response_model=CollectionsResponse,
    summary="List all Qdrant collections and their document counts",
)
async def list_collections() -> CollectionsResponse:
    if not vector_store.is_ready:
        return CollectionsResponse(collections=[{"error": "Qdrant offline"}])

    info = []
    for name in COLLECTIONS:
        try:
            col_info = vector_store.collection_info(name)
            info.append({"name": name, **col_info})
        except Exception:
            info.append({"name": name, "points_count": 0})

    return CollectionsResponse(collections=info)
