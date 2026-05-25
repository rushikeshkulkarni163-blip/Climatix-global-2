"""
Knowledge Base CRUD router — /api/knowledge/*
"""

from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.knowledge_base import (
    add_entry, delete_entry, retrieve, get_all, rebuild_index
)

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])


class AddEntryRequest(BaseModel):
    title: str
    category: str
    content: str
    tags: Optional[list] = []


class SearchRequest(BaseModel):
    query: str
    top_k: Optional[int] = 5


@router.get("/list")
def list_entries():
    """Return all knowledge entries."""
    return {"entries": get_all(), "count": len(get_all())}


@router.post("/add")
def add_knowledge(req: AddEntryRequest):
    """Add a new knowledge entry and embed it into the vector store."""
    try:
        entry_id = add_entry(
            title=req.title,
            category=req.category,
            content=req.content,
            tags=req.tags or [],
        )
        return {"success": True, "id": entry_id}
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add entry: {e}")


@router.delete("/{entry_id}")
def delete_knowledge(entry_id: str):
    """Delete a knowledge entry and rebuild the vector index."""
    try:
        found = delete_entry(entry_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Delete failed: {e}")
    if not found:
        raise HTTPException(status_code=404, detail=f"Entry '{entry_id}' not found.")
    return {"success": True, "deleted": entry_id}


@router.post("/search")
def search_knowledge(req: SearchRequest):
    """Semantic search over the knowledge base."""
    try:
        results = retrieve(req.query, top_k=req.top_k or 5)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    return {"results": results, "count": len(results)}


@router.post("/rebuild-index")
def rebuild_knowledge_index():
    """Force a full rebuild of the FAISS vector index."""
    try:
        rebuild_index()
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    return {"success": True, "message": "Index rebuilt successfully."}
