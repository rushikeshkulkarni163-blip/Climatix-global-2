"""
Climactix — RAG Knowledge Base Service
========================================
Manages a persistent vector store of custom ESG/climate rules using:
  - OpenAI text-embedding-3-small for embeddings
  - FAISS for fast similarity search
  - JSON file for persistence

Public API:
  add_entry(title, category, content, tags)  → entry_id
  delete_entry(entry_id)                     → bool
  retrieve(query, top_k=5)                   → list[dict]
  get_all()                                  → list[dict]
  rebuild_index()                            → None
"""

import json
import os
import time
import uuid
from typing import Optional

import numpy as np
import faiss
from openai import OpenAI

# ── Paths ──────────────────────────────────────────────────────────────────────
_DIR = os.path.join(os.path.dirname(__file__), "..", "knowledge")
_RULES_FILE = os.path.join(_DIR, "rules.json")
_INDEX_FILE = os.path.join(_DIR, "faiss.index")
_IDS_FILE = os.path.join(_DIR, "faiss_ids.json")

EMBED_MODEL = "text-embedding-3-small"
EMBED_DIM = 1536

# ── OpenAI client ──────────────────────────────────────────────────────────────
_client: Optional[OpenAI] = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY not set.")
        _client = OpenAI(api_key=api_key)
    return _client


# ── In-memory state ────────────────────────────────────────────────────────────
_index: Optional[faiss.IndexFlatIP] = None   # inner-product (cosine after L2-norm)
_id_map: list[str] = []                       # position → entry_id
_rules: list[dict] = []                       # full rule objects


def _load_rules() -> list[dict]:
    if not os.path.exists(_RULES_FILE):
        return []
    with open(_RULES_FILE, "r") as f:
        return json.load(f)


def _save_rules(rules: list[dict]) -> None:
    os.makedirs(_DIR, exist_ok=True)
    with open(_RULES_FILE, "w") as f:
        json.dump(rules, f, indent=2)


def _embed(texts: list[str]) -> np.ndarray:
    """Embed a list of strings → float32 L2-normalized matrix (N × EMBED_DIM)."""
    client = _get_client()
    resp = client.embeddings.create(model=EMBED_MODEL, input=texts)
    vecs = np.array([d.embedding for d in resp.data], dtype=np.float32)
    # L2-normalise so inner product == cosine similarity
    norms = np.linalg.norm(vecs, axis=1, keepdims=True)
    norms = np.where(norms == 0, 1.0, norms)
    return vecs / norms


def _build_text(entry: dict) -> str:
    """Combine fields for embedding — title + category + tags + content."""
    tags = " ".join(entry.get("tags", []))
    return f"{entry['title']} | {entry.get('category','')} | {tags}\n\n{entry['content']}"


def rebuild_index() -> None:
    """Rebuild the FAISS index from scratch using all stored rules."""
    global _index, _id_map, _rules

    _rules = _load_rules()
    _index = faiss.IndexFlatIP(EMBED_DIM)
    _id_map = []

    if not _rules:
        return

    texts = [_build_text(r) for r in _rules]
    vecs = _embed(texts)
    _index.add(vecs)
    _id_map = [r["id"] for r in _rules]

    # Persist index
    os.makedirs(_DIR, exist_ok=True)
    faiss.write_index(_index, _INDEX_FILE)
    with open(_IDS_FILE, "w") as f:
        json.dump(_id_map, f)


def _ensure_index() -> None:
    """Load persisted index if available; otherwise rebuild."""
    global _index, _id_map, _rules

    if _index is not None:
        return

    _rules = _load_rules()

    if os.path.exists(_INDEX_FILE) and os.path.exists(_IDS_FILE):
        try:
            _index = faiss.read_index(_INDEX_FILE)
            with open(_IDS_FILE) as f:
                _id_map = json.load(f)
            # Validate alignment
            if _index.ntotal == len(_id_map) == len(_rules):
                return
        except Exception:
            pass

    # Fallback: full rebuild
    rebuild_index()


# ── Public API ─────────────────────────────────────────────────────────────────

def add_entry(title: str, category: str, content: str, tags: list[str] = None) -> str:
    """
    Add a new knowledge entry, embed it, and add to the FAISS index.
    Returns the new entry_id.
    """
    global _index, _id_map, _rules

    _ensure_index()

    entry = {
        "id": f"rule_{uuid.uuid4().hex[:8]}",
        "title": title,
        "category": category,
        "tags": tags or [],
        "content": content,
        "created_at": int(time.time()),
    }

    # Embed and add to index
    vec = _embed([_build_text(entry)])
    if _index is None:
        _index = faiss.IndexFlatIP(EMBED_DIM)
        _id_map = []
    _index.add(vec)
    _id_map.append(entry["id"])

    # Persist
    _rules.append(entry)
    _save_rules(_rules)
    faiss.write_index(_index, _INDEX_FILE)
    with open(_IDS_FILE, "w") as f:
        json.dump(_id_map, f)

    return entry["id"]


def delete_entry(entry_id: str) -> bool:
    """
    Remove an entry from the JSON store and rebuild the index.
    FAISS IndexFlatIP doesn't support removal, so a full rebuild is needed.
    """
    global _rules

    _ensure_index()
    original_count = len(_rules)
    _rules = [r for r in _rules if r["id"] != entry_id]

    if len(_rules) == original_count:
        return False  # not found

    _save_rules(_rules)
    rebuild_index()
    return True


def retrieve(query: str, top_k: int = 5) -> list[dict]:
    """
    Semantic search: return the top_k most relevant knowledge entries.
    Returns list of dicts with entry data + similarity score.
    """
    _ensure_index()

    if not _rules or _index is None or _index.ntotal == 0:
        return []

    k = min(top_k, _index.ntotal)
    q_vec = _embed([query])
    scores, indices = _index.search(q_vec, k)

    results = []
    for score, idx in zip(scores[0], indices[0]):
        if idx < 0 or idx >= len(_id_map):
            continue
        eid = _id_map[idx]
        entry = next((r for r in _rules if r["id"] == eid), None)
        if entry:
            results.append({**entry, "similarity": float(score)})

    return results


def get_all() -> list[dict]:
    """Return all stored knowledge entries."""
    _ensure_index()
    return list(_rules)


def format_context(entries: list[dict]) -> str:
    """Format retrieved entries as a system-prompt context block."""
    if not entries:
        return ""

    lines = [
        "════════════════════════════════════════",
        "PROPRIETARY KNOWLEDGE BASE — APPLY THESE RULES:",
        "════════════════════════════════════════",
    ]
    for i, e in enumerate(entries, 1):
        lines.append(f"\n[Rule {i}] {e['title']} ({e.get('category','')}):")
        lines.append(e["content"])

    lines.append("\n════════════════════════════════════════")
    lines.append("Always apply the above rules when they are relevant to the analysis.")
    lines.append("Rules override generic knowledge — they encode proprietary expertise.")
    return "\n".join(lines)
