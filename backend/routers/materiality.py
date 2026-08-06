"""
Dynamic Materiality Engine router — /api/v1/materiality/*

Serves the industry-driven aspect applicability, significance scoring,
weight allocation, adaptive question tiers, and framework crosswalk that
power the Environmental Impact Index on the enterprise assessment.
Read-only, no auth — this is reference/methodology config, not
company-specific data.
"""

from fastapi import APIRouter, HTTPException

import database as db
from services.materiality_engine import build_materiality_profile, get_parameter_definitions

router = APIRouter(prefix="/api/v1/materiality", tags=["materiality"])


@router.get("/profile/{industry_key}")
async def materiality_profile(industry_key: str):
    """
    Full dynamic materiality profile for one industry: per-category
    applicability, significance score/band, normalized weight (%),
    per-sub-aspect applicability + adaptive question tier, and the
    framework crosswalk table.
    """
    try:
        pool = await db.get_pool()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {exc}")

    try:
        profile = await build_materiality_profile(pool, industry_key)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Materiality profile computation failed: {e}")

    return profile


@router.get("/parameters")
async def materiality_parameters():
    """The 12 materiality parameter definitions and their global weights."""
    try:
        pool = await db.get_pool()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {exc}")

    params = await get_parameter_definitions(pool)
    return {"parameters": params, "count": len(params)}
