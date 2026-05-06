"""Simulation Lab API Router — NGFS Scenario Simulation."""

from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
import sys, os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

router = APIRouter()

NGFS_SCENARIOS = {
    "net_zero_2050":       {"temp": 1.5, "carbon_price_2030": 145, "fossil_penalty": 0.85},
    "delayed_transition":  {"temp": 1.8, "carbon_price_2030": 98,  "fossil_penalty": 0.72},
    "below_2c":            {"temp": 1.9, "carbon_price_2030": 75,  "fossil_penalty": 0.62},
    "current_policy":      {"temp": 3.0, "carbon_price_2030": 30,  "fossil_penalty": 0.25},
    "hot_house_world":     {"temp": 4.2, "carbon_price_2030": 10,  "fossil_penalty": 0.08},
}


class SimulationRequest(BaseModel):
    company_name: str
    sector: str
    scenario: str = Field("below_2c", description="NGFS scenario key")
    horizon: int = Field(2050, ge=2026, le=2100)
    revenue_usd_m: float = Field(1000.0, gt=0)
    ebitda_margin_pct: float = Field(20.0)
    carbon_intensity: float = Field(150.0, ge=0)
    fossil_fuel_pct: float = Field(0.0, ge=0, le=100)


def run_scenario_simulation(req: SimulationRequest) -> Dict[str, Any]:
    cfg = NGFS_SCENARIOS.get(req.scenario, NGFS_SCENARIOS["below_2c"])
    years = list(range(2025, req.horizon + 1, 5))
    timeline = []

    for year in years:
        t = (year - 2025) / max(1, req.horizon - 2025)
        fossil_dep = req.fossil_fuel_pct / 100
        physical_hit = cfg["temp"] / 4.2 * t * 0.14
        transition_hit = fossil_dep * t * (1 - cfg["fossil_penalty"]) * 0.30
        carbon_cost = (req.carbon_intensity * cfg["carbon_price_2030"] * t) / 1_000_000 * req.revenue_usd_m
        total_impact = physical_hit + transition_hit
        revenue_adj = req.revenue_usd_m * (1 - total_impact)
        ebitda_adj = revenue_adj * (req.ebitda_margin_pct / 100) * (1 - transition_hit * 0.4)

        timeline.append({
            "year": year,
            "revenue_usd_m": round(revenue_adj, 2),
            "ebitda_usd_m": round(ebitda_adj, 2),
            "physical_cost_usd_m": round(req.revenue_usd_m * physical_hit, 2),
            "transition_cost_usd_m": round(req.revenue_usd_m * transition_hit, 2),
            "carbon_cost_usd_m": round(carbon_cost, 2),
            "carbon_price_usd_t": round(cfg["carbon_price_2030"] * t * 0.9 + 10, 2),
        })

    first = timeline[0]
    last = timeline[-1]
    return {
        "company": req.company_name,
        "scenario": req.scenario,
        "scenario_params": cfg,
        "horizon": req.horizon,
        "summary": {
            "revenue_at_risk_pct": round((first["revenue_usd_m"] - last["revenue_usd_m"]) / first["revenue_usd_m"] * 100, 2),
            "ebitda_at_risk_pct": round((first["ebitda_usd_m"] - last["ebitda_usd_m"]) / max(1, first["ebitda_usd_m"]) * 100, 2),
            "cumulative_carbon_cost_usd_m": round(sum(d["carbon_cost_usd_m"] for d in timeline), 2),
            "cumulative_transition_cost_usd_m": round(sum(d["transition_cost_usd_m"] for d in timeline), 2),
        },
        "timeline": timeline,
    }


@router.post("/run", summary="Execute NGFS climate scenario simulation")
async def run_simulation(req: SimulationRequest):
    result = run_scenario_simulation(req)
    return {"status": "success", "simulation": result}


@router.post("/compare", summary="Compare all NGFS scenarios for a company")
async def compare_scenarios(req: SimulationRequest):
    results = {}
    for scenario_key in NGFS_SCENARIOS:
        req_copy = req.model_copy(update={"scenario": scenario_key})
        results[scenario_key] = run_scenario_simulation(req_copy)["summary"]
    return {"status": "success", "company": req.company_name, "scenario_comparison": results}


@router.get("/scenarios", summary="List available NGFS scenarios")
async def list_scenarios():
    return {
        "scenarios": [
            {"key": k, "description": k.replace("_", " ").title(), **v}
            for k, v in NGFS_SCENARIOS.items()
        ]
    }
