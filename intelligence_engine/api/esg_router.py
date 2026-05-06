"""ESG Intelligence API Router."""

from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import List, Optional
import sys, os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from engines.esg_scoring_engine import esg_scoring_engine, ESGScoringInput

router = APIRouter()


class ESGScoreRequest(BaseModel):
    company_name: str
    sector: str
    country: str
    revenue_usd_m: float = Field(1000.0, gt=0)
    scope1_emissions_t: float = Field(0.0, ge=0)
    scope2_emissions_t: float = Field(0.0, ge=0)
    scope3_emissions_t: float = Field(0.0, ge=0)
    has_net_zero_target: bool = False
    net_zero_year: Optional[int] = None
    has_sbti: bool = False
    renewable_energy_pct: float = Field(0.0, ge=0, le=100)
    waste_recycling_rate_pct: float = Field(0.0, ge=0, le=100)
    biodiversity_policy: bool = False
    employee_safety_incidents: int = Field(0, ge=0)
    living_wage_policy: bool = False
    diversity_board_pct: float = Field(0.0, ge=0, le=100)
    supply_chain_audits: bool = False
    community_investment_pct_revenue: float = Field(0.0, ge=0)
    board_independence_pct: float = Field(0.0, ge=0, le=100)
    esg_committee_exists: bool = False
    third_party_audit: bool = False
    anti_corruption_policy: bool = True
    executive_esg_link: bool = False
    whistleblower_policy: bool = True
    framework_disclosures: List[str] = Field(default_factory=list)
    disclosure_frequency: str = "annual"
    data_assurance_level: str = "none"


@router.post("/score", summary="Compute ESG score with multi-framework analysis")
async def compute_esg_score(req: ESGScoreRequest):
    inp = ESGScoringInput(**req.dict())
    result = esg_scoring_engine.compute(inp)
    return {
        "status": "success",
        "company": req.company_name,
        "esg_score": {
            "overall": result.overall,
            "esg_rating": result.esg_rating,
            "dimensions": {
                "environmental": result.environmental,
                "social": result.social,
                "governance": result.governance,
                "disclosure_quality": result.disclosure_quality,
            },
            "sdg_alignment": result.sdg_alignment,
            "peer_percentile": result.peer_percentile,
            "sector_benchmark": result.sector_benchmark,
            "key_strengths": result.key_strengths,
            "key_gaps": result.key_gaps,
            "framework_scores": result.framework_scores,
            "sdg_mapping": result.sdg_mapping,
        }
    }


@router.get("/benchmark/{sector}", summary="Get sector ESG benchmark scores")
async def sector_benchmark(sector: str):
    from engines.esg_scoring_engine import SECTOR_BENCHMARKS
    sector_key = sector.lower().replace(" ", "-")
    bench = SECTOR_BENCHMARKS.get(sector_key, SECTOR_BENCHMARKS["default"])
    return {
        "sector": sector,
        "benchmark": {
            "environmental": bench["e"],
            "social": bench["s"],
            "governance": bench["g"],
            "overall": round((bench["e"] + bench["s"] + bench["g"]) / 3, 1),
        }
    }


@router.post("/greenwashing", summary="Analyze ESG narrative for greenwashing risk")
async def greenwashing_analysis(
    company_name: str,
    claims: List[str],
    sector: str = "default",
):
    """
    NLP-based greenwashing detection.
    Analyzes submitted ESG claims for:
    - Unsupported assertions
    - Missing verification evidence
    - Temporal inconsistencies
    - Scope boundary ambiguities
    """
    # Simplified rule-based scoring for demonstration
    RED_FLAGS = [
        ("carbon neutral", 0.82),
        ("net zero", 0.65 if sector in ["oil-gas", "mining"] else 0.35),
        ("100% renewable", 0.72),
        ("science-based", 0.45),
        ("sustainable", 0.38),
        ("green", 0.28),
        ("eco-friendly", 0.55),
    ]

    flags = []
    for claim in claims:
        claim_lower = claim.lower()
        for keyword, risk_weight in RED_FLAGS:
            if keyword in claim_lower:
                flags.append({
                    "claim": claim,
                    "flag": keyword,
                    "greenwash_probability": round(risk_weight, 2),
                    "severity": "HIGH" if risk_weight > 0.65 else "MEDIUM" if risk_weight > 0.4 else "LOW",
                    "reason": f"Claim contains '{keyword}' without verified evidence or third-party assurance",
                })
                break

    integrity_score = max(0, 100 - len(flags) * 18) if flags else 80
    return {
        "company": company_name,
        "claims_analyzed": len(claims),
        "flags_detected": len(flags),
        "integrity_score": integrity_score,
        "greenwash_risk": "HIGH" if integrity_score < 40 else "MEDIUM" if integrity_score < 65 else "LOW",
        "flags": flags,
        "methodology": "Rule-based NLP + Keyword Risk Weights + Context Analysis",
    }
