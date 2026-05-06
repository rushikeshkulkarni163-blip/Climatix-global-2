"""Narrative Intelligence API Router."""

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timedelta
import random

router = APIRouter()


@router.get("/sentiment", summary="ESG sentiment score for company or topic")
async def esg_sentiment(
    query: str = Query(..., description="Company name or ESG topic"),
    sources: str = Query("all", description="news | social | regulatory | all"),
    window_days: int = Query(30, ge=1, le=365),
):
    # Sentiment simulation (production would use NLP pipeline)
    seed = sum(ord(c) for c in query)
    random.seed(seed)
    base_sentiment = (random.random() - 0.5) * 1.2

    positive_pct = max(0, min(100, 45 + base_sentiment * 30))
    negative_pct = max(0, min(100, 100 - positive_pct - 20))
    neutral_pct = 100 - positive_pct - negative_pct

    return {
        "query": query,
        "sources": sources,
        "window_days": window_days,
        "sentiment": {
            "composite_score": round(base_sentiment, 3),
            "label": "POSITIVE" if base_sentiment > 0.2 else "NEGATIVE" if base_sentiment < -0.2 else "NEUTRAL",
            "positive_pct": round(positive_pct, 1),
            "negative_pct": round(negative_pct, 1),
            "neutral_pct": round(neutral_pct, 1),
        },
        "mention_volume": {
            "total": random.randint(200, 3000),
            "trend": "increasing" if base_sentiment > 0 else "decreasing",
        },
        "top_themes": [
            {"theme": "Net Zero", "sentiment": 0.42, "volume": 340},
            {"theme": "Carbon Disclosure", "sentiment": 0.28, "volume": 240},
            {"theme": "Supply Chain", "sentiment": -0.18, "volume": 180},
        ],
        "methodology": "Simulated NLP — production uses fine-tuned ClimateBERT model",
    }


@router.get("/regulatory-calendar", summary="Upcoming climate regulatory events")
async def regulatory_calendar(region: str = Query("all")):
    events = [
        {"region": "EU", "regulation": "CSRD Phase 2 Expansion", "effective": "2026-01-01", "impact": "HIGH"},
        {"region": "US", "regulation": "SEC Climate Disclosure Rule", "effective": "2026-06-01", "impact": "HIGH"},
        {"region": "UK", "regulation": "IFRS S1/S2 Mandatory", "effective": "2025-12-01", "impact": "MEDIUM"},
        {"region": "AU", "regulation": "Treasury Climate Disclosure", "effective": "2026-07-01", "impact": "HIGH"},
        {"region": "IN", "regulation": "BRSR Core Extended", "effective": "2026-04-01", "impact": "MEDIUM"},
        {"region": "CN", "regulation": "Carbon Market Phase 3", "effective": "2025-12-31", "impact": "HIGH"},
    ]
    if region.lower() != "all":
        events = [e for e in events if e["region"].lower() == region.lower()]
    return {"events": events, "count": len(events)}


@router.get("/topics/pulse", summary="Real-time ESG topic pulse")
async def topic_pulse(limit: int = Query(10, ge=1, le=50)):
    topics = [
        {"topic": "Net Zero", "mentions_7d": 2840, "sentiment": 0.42, "trend": "up"},
        {"topic": "CSRD", "mentions_7d": 1920, "sentiment": 0.28, "trend": "up"},
        {"topic": "Carbon Markets", "mentions_7d": 1640, "sentiment": 0.18, "trend": "flat"},
        {"topic": "Greenwashing", "mentions_7d": 1380, "sentiment": -0.48, "trend": "up"},
        {"topic": "ESG Backlash", "mentions_7d": 1210, "sentiment": -0.62, "trend": "up"},
        {"topic": "Clean Energy", "mentions_7d": 1100, "sentiment": 0.71, "trend": "up"},
        {"topic": "Carbon Tax", "mentions_7d": 980, "sentiment": -0.24, "trend": "down"},
        {"topic": "SBTi", "mentions_7d": 840, "sentiment": 0.54, "trend": "flat"},
        {"topic": "Biodiversity", "mentions_7d": 720, "sentiment": 0.32, "trend": "up"},
        {"topic": "Climate Litigation", "mentions_7d": 690, "sentiment": -0.55, "trend": "up"},
    ]
    return {"topics": topics[:limit], "as_of": datetime.utcnow().isoformat() + "Z"}
