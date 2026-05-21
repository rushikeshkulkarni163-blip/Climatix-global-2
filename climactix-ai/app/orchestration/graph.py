"""
Multi-Agent Orchestration Graph — Climactix AI Core v1

Routes incoming queries to the appropriate specialized agent node.
Phase 1: Single climate agent handles all types; routing layer is wired for Phase 2 expansion.
Phase 2: Each node will be a dedicated specialized agent (physical risk, transition, ESG disclosure).
"""

from typing import Literal, TypedDict

from langgraph.graph import END, StateGraph


class OrchestratorState(TypedDict):
    query: str
    agent_type: str
    result: str


# ─────────────────────────────────────────────────────────────────────────────
# CLASSIFIER — keyword-based routing (Phase 1), LLM-based in Phase 2
# ─────────────────────────────────────────────────────────────────────────────

_TRANSITION_KEYWORDS = {
    "transition risk", "carbon price", "stranded asset", "policy risk",
    "regulation", "carbon tax", "net zero", "decarbonization", "phase-out",
    "fossil fuel", "low-carbon", "abatement",
}
_PHYSICAL_KEYWORDS = {
    "flood", "heat stress", "sea level", "drought", "wildfire", "hurricane",
    "physical risk", "hazard", "extreme weather", "climate hazard",
    "precipitation", "temperature rise",
}
_ESG_KEYWORDS = {
    "tcfd", "csrd", "issb", "gri", "sfdr", "disclosure", "reporting",
    "esg framework", "taxonomy", "sbti", "scope 1", "scope 2", "scope 3",
    "ghg protocol", "materiality",
}
_FINANCE_KEYWORDS = {
    "green bond", "carbon market", "climate fund", "blended finance",
    "sustainability-linked", "climate finance", "impact investing",
    "carbon offset", "vcm", "eua",
}


def classify_query(state: OrchestratorState) -> dict:
    """Classify query into one of four agent domains."""
    q = state["query"].lower()

    scores = {
        "transition_risk": sum(1 for kw in _TRANSITION_KEYWORDS if kw in q),
        "physical_risk":   sum(1 for kw in _PHYSICAL_KEYWORDS if kw in q),
        "esg_disclosure":  sum(1 for kw in _ESG_KEYWORDS if kw in q),
        "climate_finance": sum(1 for kw in _FINANCE_KEYWORDS if kw in q),
    }

    best = max(scores, key=lambda k: scores[k])
    agent_type = best if scores[best] > 0 else "general_climate"
    return {"agent_type": agent_type}


def route_by_agent(
    state: OrchestratorState,
) -> Literal["transition_risk", "physical_risk", "esg_disclosure", "climate_finance", "general_climate"]:
    return state["agent_type"]  # type: ignore[return-value]


# ─────────────────────────────────────────────────────────────────────────────
# AGENT NODES — all delegate to climate_agent in Phase 1
# Each will become its own specialized agent in Phase 2
# ─────────────────────────────────────────────────────────────────────────────

async def _invoke_climate_agent(query: str) -> str:
    from app.agents.climate_agent import run_climate_query
    result = await run_climate_query(query)
    return result["answer"]


async def transition_risk_node(state: OrchestratorState) -> dict:
    result = await _invoke_climate_agent(state["query"])
    return {"result": result}


async def physical_risk_node(state: OrchestratorState) -> dict:
    result = await _invoke_climate_agent(state["query"])
    return {"result": result}


async def esg_disclosure_node(state: OrchestratorState) -> dict:
    result = await _invoke_climate_agent(state["query"])
    return {"result": result}


async def climate_finance_node(state: OrchestratorState) -> dict:
    result = await _invoke_climate_agent(state["query"])
    return {"result": result}


async def general_climate_node(state: OrchestratorState) -> dict:
    result = await _invoke_climate_agent(state["query"])
    return {"result": result}


# ─────────────────────────────────────────────────────────────────────────────
# GRAPH COMPILATION
# ─────────────────────────────────────────────────────────────────────────────

def build_orchestrator():
    graph = StateGraph(OrchestratorState)

    graph.add_node("classify",        classify_query)
    graph.add_node("transition_risk", transition_risk_node)
    graph.add_node("physical_risk",   physical_risk_node)
    graph.add_node("esg_disclosure",  esg_disclosure_node)
    graph.add_node("climate_finance", climate_finance_node)
    graph.add_node("general_climate", general_climate_node)

    graph.set_entry_point("classify")
    graph.add_conditional_edges(
        "classify",
        route_by_agent,
        {
            "transition_risk": "transition_risk",
            "physical_risk":   "physical_risk",
            "esg_disclosure":  "esg_disclosure",
            "climate_finance": "climate_finance",
            "general_climate": "general_climate",
        },
    )
    for node in ["transition_risk", "physical_risk", "esg_disclosure", "climate_finance", "general_climate"]:
        graph.add_edge(node, END)

    return graph.compile()
