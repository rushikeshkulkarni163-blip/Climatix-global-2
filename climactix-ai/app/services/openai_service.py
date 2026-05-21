"""
OpenAI Service Layer — Climactix AI Core v1

Centralized async client for embeddings and completions.
All OpenAI calls in the application should go through this module
to ensure unified key management, error handling, and future model-swap flexibility.
"""

import os
from typing import Optional

from openai import AsyncOpenAI

from app.utils.logger import logger

_client: Optional[AsyncOpenAI] = None


def get_openai_client() -> AsyncOpenAI:
    """Return the shared AsyncOpenAI client, initializing it on first call."""
    global _client
    if _client is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise EnvironmentError(
                "OPENAI_API_KEY is not set. Add it to your .env file."
            )
        _client = AsyncOpenAI(api_key=api_key)
        logger.info("OpenAI async client initialized")
    return _client


# ─────────────────────────────────────────────────────────────────────────────
# EMBEDDINGS
# ─────────────────────────────────────────────────────────────────────────────

async def embed_text(
    text: str,
    model: str = "text-embedding-3-small",
) -> list[float]:
    """
    Embed a single text string.

    Models:
        text-embedding-3-small — 1536 dims, cost-efficient (recommended for ESG chunks)
        text-embedding-3-large — 3072 dims, highest accuracy (for critical retrieval)

    Returns:
        Embedding vector as list[float]
    """
    client = get_openai_client()
    response = await client.embeddings.create(model=model, input=text)
    return response.data[0].embedding


async def embed_batch(
    texts: list[str],
    model: str = "text-embedding-3-small",
) -> list[list[float]]:
    """
    Embed multiple texts in a single API call (more efficient than looping).
    OpenAI supports up to 2048 inputs per batch request.

    Returns:
        List of embedding vectors in the same order as input texts.
    """
    if not texts:
        return []
    client = get_openai_client()
    response = await client.embeddings.create(model=model, input=texts)
    # Response order matches input order per OpenAI spec
    return [item.embedding for item in sorted(response.data, key=lambda x: x.index)]


# ─────────────────────────────────────────────────────────────────────────────
# COMPLETIONS (direct, bypassing LangGraph — for lightweight utility calls)
# ─────────────────────────────────────────────────────────────────────────────

async def complete(
    prompt: str,
    system: str = "You are a climate intelligence assistant.",
    model: str = "gpt-4o-mini",
    temperature: float = 0.1,
    max_tokens: int = 512,
) -> str:
    """
    Single-turn completion for lightweight tasks (summarization, classification, extraction).
    For multi-turn agent reasoning, use run_climate_query() from climate_agent instead.
    """
    client = get_openai_client()
    response = await client.chat.completions.create(
        model=model,
        temperature=temperature,
        max_tokens=max_tokens,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
    )
    return response.choices[0].message.content or ""
