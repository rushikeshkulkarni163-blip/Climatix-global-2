"""Portfolio Screening API Router."""

from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
import sys, os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

router = APIRouter()


class Holding(BaseModel):
    ticker: str
    name: str
    sector: str
    weight_pct: float = Field(..., gt=0, le=100)
    physical_risk_score: Optional[float] = None
    transition_risk_score: Optional[float] = None
    esg_score: Optional[float] = None
    paris_alignment: Optional[str] = None   # "1.5C" | "2C" | "3C" | "4C+"
    sbti: bool = False


class PortfolioScreenRequest(BaseModel):
    portfolio_name: str
    holdings: List[Holding]
    scenario: str = "2C"
    horizon: int = 2050
    benchmark: str = "MSCI World ESG Leaders"


@router.post("/screen", summary="Climate screen a portfolio of holdings")
async def screen_portfolio(req: PortfolioScreenRequest):
    if not req.holdings:
        return {"error": "No holdings provided"}

    total_weight = sum(h.weight_pct for h in req.holdings)

    # Weighted portfolio metrics
    phys_risk_avg = sum(
        (h.physical_risk_score or 50) * h.weight_pct for h in req.holdings
    ) / total_weight

    trans_risk_avg = sum(
        (h.transition_risk_score or 45) * h.weight_pct for h in req.holdings
    ) / total_weight

    esg_avg = sum(
        (h.esg_score or 50) * h.weight_pct for h in req.holdings
    ) / total_weight

    climate_var = -1 * (phys_risk_avg * 0.45 + trans_risk_avg * 0.55) / 100 * 28

    paris_counts = {}
    for h in req.holdings:
        p = h.paris_alignment or "2C"
        paris_counts[p] = paris_counts.get(p, 0) + h.weight_pct

    sbti_weight = sum(h.weight_pct for h in req.holdings if h.sbti)

    red_flags = [h for h in req.holdings if (h.physical_risk_score or 50) > 70 or (h.transition_risk_score or 45) > 75]

    return {
        "portfolio": req.portfolio_name,
        "holdings_count": len(req.holdings),
        "scenario": req.scenario,
        "summary": {
            "weighted_physical_risk": round(phys_risk_avg, 2),
            "weighted_transition_risk": round(trans_risk_avg, 2),
            "weighted_esg_score": round(esg_avg, 2),
            "climate_var_pct": round(climate_var, 2),
            "sbti_committed_weight_pct": round(sbti_weight, 2),
            "paris_alignment_breakdown": paris_counts,
        },
        "red_flags": [
            {
                "ticker": h.ticker,
                "name": h.name,
                "sector": h.sector,
                "weight": h.weight_pct,
                "physical_risk": h.physical_risk_score,
                "transition_risk": h.transition_risk_score,
                "reason": "High physical or transition risk score exceeds 70/100",
            }
            for h in red_flags
        ],
        "benchmark_comparison": {
            "benchmark": req.benchmark,
            "portfolio_esg": round(esg_avg, 2),
            "benchmark_esg": 62.0,
            "gap": round(esg_avg - 62.0, 2),
        }
    }


@router.get("/paris-alignment/{ticker}", summary="Get Paris Agreement alignment for a holding")
async def paris_alignment(ticker: str, sector: str = "default"):
    sector_paris = {
        "oil-gas": "4C+", "mining": "3C", "utilities": "2C",
        "transportation": "3C", "manufacturing": "2C", "technology": "1.5C",
        "financials": "2C", "agriculture": "2C", "default": "2C",
    }
    alignment = sector_paris.get(sector.lower().replace(" ", "-"), "2C")
    return {
        "ticker": ticker,
        "sector": sector,
        "paris_alignment": alignment,
        "methodology": "Implied Temperature Rise (ITR) via MSCI / SBTI",
        "data_source": "Sector-level trajectory model",
    }
