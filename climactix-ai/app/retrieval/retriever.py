"""
RAG Retriever — Climactix AI

Query-time semantic retrieval: embed query → search Qdrant → return context chunks.
Used by the climate agent's `search_climate_knowledge_base` tool.
"""

from typing import Optional

from app.services.openai_service import embed_text
from app.retrieval.qdrant_client import vector_store
from app.utils.logger import logger


async def retrieve(
    query: str,
    collection: str = "esg_documents",
    top_k: int = 5,
    filter_by: Optional[dict] = None,
) -> list[dict]:
    """
    Embed a query and retrieve the top-K most semantically similar chunks.

    Args:
        query:      Natural language search query
        collection: Qdrant collection to search
        top_k:      Number of results to return
        filter_by:  Optional exact-match metadata filter e.g. {"framework": "TCFD"}

    Returns:
        List of {"text", "source", "score", "page"} dicts
    """
    if not vector_store.is_ready:
        logger.debug("Retriever: Qdrant offline — returning empty results")
        return []

    query_vector = await embed_text(query)
    hits = vector_store.search(collection, query_vector, top_k=top_k, filter_by=filter_by)

    return [
        {
            "text":   h["payload"].get("text", ""),
            "source": h["payload"].get("source", "unknown"),
            "page":   h["payload"].get("page", 0),
            "score":  round(h["score"], 4),
        }
        for h in hits
    ]


async def retrieve_formatted(
    query: str,
    collection: str = "esg_documents",
    top_k: int = 5,
    filter_by: Optional[dict] = None,
) -> str:
    """
    Retrieve chunks and format as a readable context block for LLM injection.

    Returns a formatted string the agent can reason over directly.
    """
    chunks = await retrieve(query, collection=collection, top_k=top_k, filter_by=filter_by)

    if not chunks:
        return "No relevant documents found in the Climactix knowledge base for this query."

    sections = []
    for i, c in enumerate(chunks, 1):
        sections.append(
            f"[{i}] Source: {c['source']} | Page: {c['page']} | Relevance: {c['score']}\n"
            f"{c['text']}"
        )

    return (
        f"Retrieved {len(chunks)} relevant passages from the Climactix knowledge base:\n\n"
        + "\n\n---\n\n".join(sections)
    )


async def multi_collection_retrieve(
    query: str,
    collections: Optional[list] = None,
    top_k_per_collection: int = 3,
) -> str:
    """
    Search across multiple collections and merge results.
    Useful when the query spans ESG documents + regulatory frameworks.
    """
    if collections is None:
        collections = ["esg_documents", "climate_reports", "regulatory_frameworks"]

    all_chunks: list[dict] = []
    for col in collections:
        chunks = await retrieve(query, collection=col, top_k=top_k_per_collection)
        for c in chunks:
            c["collection"] = col
        all_chunks.extend(chunks)

    # Sort by relevance score across all collections
    all_chunks.sort(key=lambda x: x["score"], reverse=True)
    top = all_chunks[:top_k_per_collection * 2]

    if not top:
        return "No relevant documents found across knowledge base collections."

    sections = []
    for i, c in enumerate(top, 1):
        sections.append(
            f"[{i}] Collection: {c.get('collection','?')} | Source: {c['source']} | Score: {c['score']}\n"
            f"{c['text']}"
        )

    return (
        f"Retrieved {len(top)} passages across {len(collections)} collections:\n\n"
        + "\n\n---\n\n".join(sections)
    )
