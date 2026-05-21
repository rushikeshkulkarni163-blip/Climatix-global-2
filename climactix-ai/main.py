"""
Climactix AI Core v1 — FastAPI Entry Point

Climate Risk Intelligence Infrastructure
Multi-Agent API Server powered by LangGraph + OpenAI GPT-4o

Run:
    uvicorn main:app --reload --port 8000

Docs:
    http://localhost:8000/docs
"""

import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()  # Must load before any app module imports

from app.retrieval.qdrant_client import vector_store
from app.routes.query import router as query_router
from app.routes.ingest import router as ingest_router
from app.schemas.query import HealthResponse
from app.utils.logger import logger


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    logger.info("  Climactix AI Core v1 — starting up")
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

    # Attempt Qdrant connection (non-blocking — server starts even if Qdrant is down)
    qdrant_ok = vector_store.connect()
    if qdrant_ok:
        logger.info("Vector store: READY")
    else:
        logger.warning("Vector store: OFFLINE (LLM-only mode)")

    yield

    logger.info("Climactix AI Core v1 — shutting down")


app = FastAPI(
    title="Climactix AI Core",
    description=(
        "**Climate Risk Intelligence Infrastructure**\n\n"
        "Institutional-grade multi-agent API for climate risk analysis, "
        "ESG disclosure interpretation, transition risk modeling, and climate finance intelligence.\n\n"
        "Powered by LangGraph + OpenAI GPT-4o."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # Tighten to specific origins in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(query_router, prefix="/api/v1")
app.include_router(ingest_router, prefix="/api/v1")


@app.get(
    "/health",
    response_model=HealthResponse,
    summary="Server health check",
    tags=["System"],
)
async def health() -> HealthResponse:
    return HealthResponse(
        status="operational",
        service="Climactix AI Core",
        version="1.0.0",
        vector_store="ready" if vector_store.is_ready else "offline",
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("APP_PORT", 8000)),
        reload=True,
    )
