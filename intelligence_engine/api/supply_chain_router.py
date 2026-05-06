"""Supply Chain Intelligence API Router."""

from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import List, Optional, Dict

router = APIRouter()


class Supplier(BaseModel):
    name: str
    country: str
    tier: int = Field(1, ge=1, le=4)
    annual_spend_usd_m: float
    scope1_emissions_t: Optional[float] = None
    verified: bool = False
    sbti: bool = False


class Scope3Request(BaseModel):
    company_name: str
    sector: str
    annual_revenue_usd_m: float
    suppliers: List[Supplier] = Field(default_factory=list)
    include_downstream: bool = True


@router.post("/scope3", summary="Map Scope 3 emissions across supply chain")
async def scope3_mapping(req: Scope3Request):
    # Spend-based emission factor estimates (tCO₂e per $M spend)
    SPEND_FACTORS = {
        "manufacturing": 250, "mining": 420, "agriculture": 380,
        "transportation": 180, "technology": 85, "services": 45,
        "energy": 580, "chemicals": 340, "construction": 290, "default": 150,
    }

    total_scope3 = 0.0
    supplier_breakdown = []

    for supplier in req.suppliers:
        country_factor = 1.0 + (0.3 if supplier.country in ["CN", "IN", "ID", "VN"] else 0.0)
        spend_factor = SPEND_FACTORS.get(req.sector.lower(), SPEND_FACTORS["default"])
        estimated = supplier.scope1_emissions_t or (supplier.annual_spend_usd_m * spend_factor * country_factor)
        total_scope3 += estimated
        supplier_breakdown.append({
            "name": supplier.name,
            "country": supplier.country,
            "tier": supplier.tier,
            "estimated_emissions_t": round(estimated, 0),
            "measurement": "measured" if supplier.scope1_emissions_t else "spend-based",
            "data_quality": "high" if supplier.verified else "medium" if supplier.scope1_emissions_t else "low",
            "risk_flag": estimated > 50000,
        })

    # GHG Protocol categories (simplified)
    cat_breakdown = {
        "Cat 1 — Purchased Goods & Services": round(total_scope3 * 0.38, 0),
        "Cat 4 — Upstream Transportation": round(total_scope3 * 0.12, 0),
        "Cat 11 — Use of Sold Products": round(total_scope3 * 0.25 if req.include_downstream else 0, 0),
        "Cat 2 — Capital Goods": round(total_scope3 * 0.11, 0),
        "Cat 3 — Fuel & Energy": round(total_scope3 * 0.08, 0),
        "Other Categories": round(total_scope3 * 0.06, 0),
    }

    return {
        "company": req.company_name,
        "total_scope3_tco2e": round(total_scope3, 0),
        "data_coverage_pct": round(len([s for s in req.suppliers if s.scope1_emissions_t]) / max(1, len(req.suppliers)) * 100, 1),
        "category_breakdown": cat_breakdown,
        "supplier_breakdown": supplier_breakdown,
        "high_risk_suppliers": [s for s in supplier_breakdown if s["risk_flag"]],
        "methodology": "GHG Protocol Corporate Value Chain (Scope 3) Standard",
    }


@router.get("/vendor-risk/{supplier_name}", summary="Climate risk score for a supplier")
async def vendor_risk(supplier_name: str, country: str = "US", sector: str = "manufacturing"):
    # Simplified vendor risk scoring
    country_risk = {"CN": 72, "IN": 68, "BD": 74, "VN": 65, "ID": 70, "US": 38, "DE": 28, "NO": 22}
    sector_risk = {"mining": 82, "oil-gas": 88, "agriculture": 65, "manufacturing": 52, "technology": 28}

    base = country_risk.get(country, 45)
    sect = sector_risk.get(sector.lower(), 45)
    overall = (base * 0.4 + sect * 0.6)

    return {
        "supplier": supplier_name,
        "country": country,
        "sector": sector,
        "climate_risk_score": round(overall, 1),
        "risk_rating": "HIGH" if overall > 65 else "MEDIUM" if overall > 40 else "LOW",
        "primary_risks": [
            "High physical risk in operating country" if base > 55 else None,
            "High-emission sector" if sect > 60 else None,
        ],
        "recommended_actions": [
            "Request verified Scope 1 & 2 data",
            "Require SBTi commitment by 2027",
        ] if overall > 60 else ["Continue monitoring", "Annual disclosure request"],
    }
