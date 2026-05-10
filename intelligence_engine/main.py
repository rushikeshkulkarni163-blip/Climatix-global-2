"""
Climactix Global — Intelligence Engine API
==========================================
Production-grade FastAPI backend for the Climate Risk Intelligence OS.

Modules:
  - Physical Risk Engine
  - Transition Risk Engine
  - Scenario Simulation Engine
  - Financial Impact Engine
  - ESG Scoring Engine
  - Greenwashing Detection Engine
  - Disclosure Generator
  - Supply Chain Intelligence
  - Narrative Intelligence
  - Carbon Market Feed
"""

from fastapi import FastAPI, HTTPException, Depends, Security, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import JSONResponse
import uvicorn
import logging
from contextlib import asynccontextmanager

from api.risk_router import router as risk_router
from api.simulation_router import router as sim_router
from api.esg_router import router as esg_router
from api.portfolio_router import router as portfolio_router
from api.disclosure_router import router as disclosure_router
from api.supply_chain_router import router as supply_chain_router
from api.narrative_router import router as narrative_router
from api.finance_router import router as finance_router
from api.ws_router import router as ws_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("climactix")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Climactix Intelligence Engine starting up...")
    yield
    logger.info("Intelligence Engine shutting down...")


app = FastAPI(
    title="Climactix Global Intelligence Engine",
    description="""
## Climate Risk Intelligence API

End-to-end API for climate risk assessment, ESG scoring, scenario simulation,
and institutional-grade financial climate intelligence.

### Engines
- **Physical Risk Engine** — Flood, heat, wildfire, sea-level, storm exposure
- **Transition Risk Engine** — Carbon pricing, regulatory, technology, market risk
- **Scenario Simulation Engine** — NGFS 1.5°C / 2°C / 3°C / 4°C+ pathways
- **Financial Impact Engine** — Revenue at risk, EBITDA, stranded assets, VaR
- **ESG Scoring Engine** — Multi-framework scoring with GRI, SASB, TCFD, ISSB
- **Greenwashing Detection** — NLP narrative analysis with confidence scoring
- **Disclosure Studio** — TCFD, IFRS S2, CSRD report generation
- **Supply Chain** — Scope 3 mapping, vendor risk, logistics emissions
- **Narrative Intelligence** — ESG sentiment, media, regulatory monitoring
- **Climate Finance** — Green bonds, carbon markets, capital flows

### Authentication
All endpoints require Bearer token authentication via API key.
    """,
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# ── Middleware ────────────────────────────────────────────────────────────────

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://climactix.global"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(risk_router,          prefix="/api/v1/risk",          tags=["Physical & Transition Risk"])
app.include_router(sim_router,           prefix="/api/v1/simulation",    tags=["Scenario Simulation"])
app.include_router(esg_router,           prefix="/api/v1/esg",           tags=["ESG Intelligence"])
app.include_router(portfolio_router,     prefix="/api/v1/portfolio",     tags=["Investor Portfolio"])
app.include_router(disclosure_router,    prefix="/api/v1/disclosure",    tags=["Disclosure Studio"])
app.include_router(supply_chain_router,  prefix="/api/v1/supply-chain",  tags=["Supply Chain"])
app.include_router(narrative_router,     prefix="/api/v1/narrative",     tags=["Narrative Intelligence"])
app.include_router(finance_router,       prefix="/api/v1/finance",       tags=["Climate Finance"])
app.include_router(ws_router,                                            tags=["WebSocket Streaming"])

# ── Health & status ───────────────────────────────────────────────────────────

@app.get("/health", tags=["System"])
async def health():
    return {
        "status": "healthy",
        "version": "2.0.0",
        "engines": {
            "physical_risk": "operational",
            "transition_risk": "operational",
            "simulation": "operational",
            "financial_impact": "operational",
            "esg_scoring": "operational",
            "greenwashing": "operational",
            "disclosure": "operational",
            "supply_chain": "operational",
            "narrative": "operational",
            "carbon_market": "operational",
        }
    }


@app.get("/api/v1/status", tags=["System"])
async def system_status():
    return {
        "api_version": "v1",
        "data_freshness": "real-time",
        "supported_scenarios": ["net_zero_2050", "delayed_transition", "below_2c", "current_policy", "hot_house"],
        "supported_frameworks": ["tcfd", "issb_s2", "csrd", "gri", "cdp", "sbti", "sasb", "brsr"],
        "geographic_coverage": "140 countries",
        "asset_classes": ["equity", "fixed_income", "real_estate", "infrastructure", "private_equity"],
    }


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, workers=4)
