"""
Qdrant Vector Store Client — Climactix AI Core v1

Manages ESG document embeddings and semantic retrieval for the climate RAG pipeline.
Collections: esg_documents, climate_reports, regulatory_frameworks, company_disclosures

Usage:
    from app.retrieval.qdrant_client import vector_store
    vector_store.connect()  # called at startup
    results = await vector_store.search("esg_documents", query_vector, top_k=5)
"""

import os
from typing import Optional

from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchValue,
    PointStruct,
    VectorParams,
)

from app.utils.logger import logger

# ─────────────────────────────────────────────────────────────────────────────
# COLLECTION REGISTRY
# Each collection targets a distinct ESG/climate data domain.
# Vector size 1536 = OpenAI text-embedding-3-small output dimension.
# ─────────────────────────────────────────────────────────────────────────────

COLLECTIONS: dict[str, dict] = {
    "esg_documents": {
        "size": 1536,
        "distance": Distance.COSINE,
        "description": "General ESG reports, sustainability disclosures, TCFD filings",
    },
    "climate_reports": {
        "size": 1536,
        "distance": Distance.COSINE,
        "description": "IPCC reports, NGFS scenarios, IEA outlooks, academic climate research",
    },
    "regulatory_frameworks": {
        "size": 1536,
        "distance": Distance.COSINE,
        "description": "CSRD, ISSB, SFDR, EU Taxonomy text chunks for regulatory lookup",
    },
    "company_disclosures": {
        "size": 1536,
        "distance": Distance.COSINE,
        "description": "Company-level CDP, annual report, and sustainability disclosure chunks",
    },
}


class ClimactixVectorStore:
    """
    Vector store wrapper for climate intelligence retrieval.

    Gracefully degrades if Qdrant is unavailable — the API server
    continues to operate with LLM-only responses.
    """

    def __init__(self) -> None:
        self._client: Optional[QdrantClient] = None
        self._ready = False

    # ── Connection ───────────────────────────────────────────────────────────

    def connect(self) -> bool:
        """
        Initialize Qdrant connection. Returns True if successful.

        Priority:
          1. Remote Qdrant server (QDRANT_URL env var)
          2. In-memory Qdrant (no Docker required — data lost on restart)

        Called once at FastAPI startup.
        """
        url = os.getenv("QDRANT_URL", "http://localhost:6333")
        api_key = os.getenv("QDRANT_API_KEY") or None

        # Try server connection first
        try:
            self._client = QdrantClient(url=url, api_key=api_key, timeout=3.0)
            self._client.get_collections()  # connectivity probe
            self._ready = True
            logger.info(f"Qdrant connected: {url}")
            self.ensure_collections()
            return True
        except Exception as e:
            logger.warning(f"Qdrant server unavailable ({url}): {e}")

        # Fall back to in-memory mode
        try:
            self._client = QdrantClient(":memory:")
            self._ready = True
            logger.info("Qdrant running in-memory (data resets on restart — install Docker for persistence)")
            self.ensure_collections()
            return True
        except Exception as e:
            logger.error(f"Qdrant in-memory init failed: {e}")
            return False

    # ── Collection Management ────────────────────────────────────────────────

    def ensure_collections(self) -> None:
        """Create all registered collections if they don't already exist."""
        if not self._ready or self._client is None:
            return

        existing = {c.name for c in self._client.get_collections().collections}

        for name, cfg in COLLECTIONS.items():
            if name not in existing:
                self._client.create_collection(
                    collection_name=name,
                    vectors_config=VectorParams(size=cfg["size"], distance=cfg["distance"]),
                )
                logger.info(f"Qdrant collection created: {name}")

    # ── Write ────────────────────────────────────────────────────────────────

    def upsert(
        self,
        collection: str,
        doc_id: str,
        vector: list[float],
        payload: dict,
    ) -> None:
        """
        Insert or update a document vector with metadata payload.

        Args:
            collection: Target collection name (must be in COLLECTIONS registry)
            doc_id: Unique document identifier (str UUID recommended)
            vector: Embedding vector (must match collection dimension)
            payload: Metadata dict — e.g., {"source": "TCFD 2023", "company": "Shell", "year": 2023}
        """
        if not self._ready or self._client is None:
            raise RuntimeError("Qdrant not connected — call vector_store.connect() first")
        if collection not in COLLECTIONS:
            raise ValueError(f"Unknown collection '{collection}'. Valid: {list(COLLECTIONS)}")

        self._client.upsert(
            collection_name=collection,
            points=[PointStruct(id=doc_id, vector=vector, payload=payload)],
        )

    # ── Search ───────────────────────────────────────────────────────────────

    def search(
        self,
        collection: str,
        query_vector: list[float],
        top_k: int = 5,
        filter_by: Optional[dict[str, str]] = None,
    ) -> list[dict]:
        """
        Semantic nearest-neighbour search over a collection.

        Args:
            collection: Collection name
            query_vector: Embedded query (1536-dim for text-embedding-3-small)
            top_k: Number of results to return
            filter_by: Optional exact-match metadata filter, e.g. {"company": "Tesla"}

        Returns:
            List of {"id", "score", "payload"} dicts, sorted by descending cosine similarity.
        """
        if not self._ready or self._client is None:
            logger.debug("Qdrant search skipped — not connected")
            return []

        query_filter: Optional[Filter] = None
        if filter_by:
            query_filter = Filter(
                must=[
                    FieldCondition(key=k, match=MatchValue(value=v))
                    for k, v in filter_by.items()
                ]
            )

        hits = self._client.search(
            collection_name=collection,
            query_vector=query_vector,
            limit=top_k,
            query_filter=query_filter,
        )

        return [{"id": h.id, "score": h.score, "payload": h.payload} for h in hits]

    # ── Properties ───────────────────────────────────────────────────────────

    @property
    def is_ready(self) -> bool:
        return self._ready

    def collection_info(self, collection: str) -> dict:
        """Return point count and config for a collection."""
        if not self._ready or self._client is None:
            return {"error": "not connected"}
        info = self._client.get_collection(collection)
        return {
            "points_count": info.points_count,
            "vectors_config": str(info.config.params.vectors),
        }


# Singleton — shared across all FastAPI request handlers
vector_store = ClimactixVectorStore()
