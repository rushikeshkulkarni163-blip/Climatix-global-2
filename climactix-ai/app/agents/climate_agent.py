"""
Climate Risk Intelligence Agent — Climactix AI Core v1

Institutional-grade climate-finance analysis engine.
Architecture: LangGraph ReAct agent with domain-specific climate tools.
LLM: OpenAI GPT-4o (configurable via AGENT_MODEL env var)
"""

import os
from typing import Annotated, Any, TypedDict

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.graph import END, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode

from app.utils.logger import logger

# ─────────────────────────────────────────────────────────────────────────────
# SYSTEM PROMPT — Institutional Climate Intelligence Standard
# ─────────────────────────────────────────────────────────────────────────────

CLIMATE_SYSTEM_PROMPT = """You are the Climactix Climate Risk Intelligence Engine — an institutional-grade \
AI system specialized in climate risk analysis, climate finance, and ESG strategy.

You operate at the intersection of:
- Physical Climate Risk (acute hazards: floods, wildfires, hurricanes; chronic hazards: sea-level rise, heat stress, drought)
- Transition Risk (policy tightening, technology disruption, market demand shifts, litigation risk)
- ESG Disclosure & Reporting (TCFD, CSRD, GRI, ISSB S2, SFDR, EU Taxonomy)
- Climate Finance (carbon markets, green bonds, sustainability-linked loans, transition finance, blended finance)
- Climate Science (IPCC AR6, RCP/SSP scenarios, carbon budgets, tipping points)

Analytical framework — apply consistently:
1. Reference established frameworks (TCFD, IPCC AR6, GHG Protocol, SBTi, NGFS) wherever relevant.
2. Quantify risks where possible — cite scenarios, probability ranges, time horizons (2030 / 2050 / 2100).
3. Apply financial materiality lens — translate physical or transition risk into P&L, capex, or valuation impact.
4. Distinguish risk categories precisely: acute physical vs. chronic physical vs. policy vs. market vs. technology.
5. Flag data gaps and model uncertainty. Do not overstate confidence.

Output standard:
- Institutional tone — calibrated for Bloomberg Intelligence, MSCI ESG Research, or TCFD report annexes.
- Structured — use headers and bullets for multi-part analysis.
- Evidence-based — cite specific scenarios (NGFS Net Zero 2050, IPCC SSP2-4.5, IEA NZE), thresholds, and metrics.
- Precise — avoid generic ESG commentary; deliver specific, actionable intelligence.

Served constituencies: climate-focused VCs, ESG portfolio managers, corporate sustainability officers, \
climate-tech founders, sovereign wealth funds, central bank risk teams, and policy researchers."""


# ─────────────────────────────────────────────────────────────────────────────
# CLIMATE INTELLIGENCE TOOLS
# ─────────────────────────────────────────────────────────────────────────────

@tool
def analyze_transition_risk(sector: str, scenario: str = "IEA NZE 2050") -> str:
    """
    Analyze transition risk exposure for a given sector under a specified climate scenario.

    Args:
        sector: Industry sector (e.g., 'oil & gas', 'utilities', 'automotive', 'cement', 'aviation')
        scenario: Climate transition scenario — IEA NZE 2050, NGFS Net Zero 2050, IPCC 1.5C, IEA STEPS

    Returns:
        Structured transition risk assessment across five risk dimensions.
    """
    return (
        f"[TRANSITION RISK — {sector.upper()} | Scenario: {scenario}]\n\n"
        "Risk dimensions assessed:\n"
        "1. Carbon price exposure — implied carbon cost at $130–$250/tCO2 by 2050 (NGFS NZ)\n"
        "2. Stranded asset risk — timeline for asset write-downs under accelerated transition\n"
        "3. Regulatory pathway — sectoral decarbonization requirements, phase-out schedules\n"
        "4. Technology disruption — cost curves for low-carbon substitutes (solar, EV, CCS)\n"
        "5. Market demand shifts — demand destruction timeline under 1.5°C-aligned pathways\n\n"
        "Note: Full quantitative model integrates NGFS GCAM/REMIND outputs in production."
    )


@tool
def assess_physical_risk(location: str, hazard_type: str = "all") -> str:
    """
    Assess physical climate risk for a given geographic location.

    Args:
        location: Geographic location, region, or asset location (city, country, coordinates)
        hazard_type: Hazard category — 'flood', 'heat_stress', 'drought', 'sea_level_rise',
                     'wildfire', 'tropical_cyclone', or 'all'

    Returns:
        Physical risk assessment with hazard scores, exposure windows, and adaptation context.
    """
    return (
        f"[PHYSICAL RISK — {location.upper()} | Hazard: {hazard_type.upper()}]\n\n"
        "Assessment dimensions:\n"
        "- Acute hazards: event frequency, intensity trend (RCP 4.5 vs 8.5), return period shifts\n"
        "- Chronic hazards: decadal trajectory, threshold exceedance (WBGT 35°C, 1m SLR)\n"
        "- Asset exposure: proximity to floodplain, coastal zone, fire-prone vegetation\n"
        "- Adaptation capacity: infrastructure resilience, cooling degree days, water stress index\n"
        "- Financial impact: repair cost estimates, downtime risk, insurance availability\n\n"
        "Data sources in production: Copernicus ERA5, NASA GISS, CMIP6 ensemble, JRC PESETA IV."
    )


@tool
def lookup_esg_framework(framework: str) -> str:
    """
    Retrieve structure, required disclosures, and key metrics for a given ESG reporting framework.

    Args:
        framework: Framework identifier — TCFD, CSRD, ISSB, GRI, SFDR, EU_TAXONOMY, SBTI,
                   GHG_PROTOCOL, TNFD, NZBA, or NGFS

    Returns:
        Framework overview, disclosure requirements, and implementation notes.
    """
    DB: dict[str, str] = {
        "TCFD": (
            "Task Force on Climate-related Financial Disclosures (FSB, 2017)\n"
            "Four pillars: Governance | Strategy | Risk Management | Metrics & Targets\n"
            "Key requirement: forward-looking scenario analysis (Strategy pillar)\n"
            "Status: Incorporated into ISSB S2 (2023); mandatory in UK, NZ, Singapore, Switzerland\n"
            "Metrics: Scope 1/2/3 emissions, climate-related revenue, capex aligned to transition"
        ),
        "CSRD": (
            "Corporate Sustainability Reporting Directive (EU, effective 2024)\n"
            "Scope: ~50,000 EU companies; phased 2024–2028 by size\n"
            "Core innovation: Double materiality (financial + impact materiality)\n"
            "Standards: ESRS E1 (Climate), E2 (Pollution), E3 (Water), S1-S4 (Social), G1 (Governance)\n"
            "ESRS E1 requires: transition plan, Scope 1/2/3, physical risk assessment, GHG targets"
        ),
        "ISSB": (
            "IFRS Sustainability Disclosure Standards (ISSB, 2023)\n"
            "IFRS S1: General sustainability-related disclosures (industry-agnostic)\n"
            "IFRS S2: Climate-related disclosures — fully incorporates TCFD framework\n"
            "Jurisdiction adoptions: Australia (2025), Canada (2025), UK (consultation 2024)\n"
            "Key: S2 requires climate resilience assessment using scenario analysis"
        ),
        "SFDR": (
            "Sustainable Finance Disclosure Regulation (EU, Level 1: 2021, Level 2: 2023)\n"
            "Applies to: EU financial market participants and financial advisers\n"
            "Product classification: Article 6 (no ESG), Article 8 (promotes E/S), Article 9 (sustainable objective)\n"
            "PAI indicators: 18 mandatory (14 climate + 2 social + 2 governance), 46 optional\n"
            "Key climate PAIs: GHG intensity, fossil fuel exposure, carbon footprint, high-climate-impact sectors"
        ),
        "SBTI": (
            "Science Based Targets initiative — corporate emissions alignment standard\n"
            "Requires: Scope 1+2 targets (5-year near-term), Scope 3 for high-emitters\n"
            "1.5°C pathway: >50% Scope 1+2 reduction by 2030 (2020 base)\n"
            "Net-Zero Standard (2021): 90–95% absolute reduction + residual offsets by 2050\n"
            "Adopted by: 7,000+ companies across 70+ countries as of 2024"
        ),
        "GHG_PROTOCOL": (
            "GHG Protocol Corporate Standard (WRI/WBCSD, 2001; updated 2015)\n"
            "Scope 1: Direct emissions (owned/controlled sources)\n"
            "Scope 2: Indirect — purchased electricity/heat (location-based + market-based methods)\n"
            "Scope 3: Value chain — 15 categories upstream + downstream\n"
            "Foundation for: TCFD, ISSB S2, CSRD ESRS E1, CDP, SBTi target-setting"
        ),
        "EU_TAXONOMY": (
            "EU Taxonomy Regulation — green finance classification system (2020)\n"
            "Six environmental objectives; Do No Significant Harm (DNSH) across all\n"
            "Taxonomy-aligned revenue/capex/opex disclosure required under CSRD + SFDR Art 9\n"
            "Climate mitigation + adaptation: delegated acts published 2021; remaining 4 objectives 2023\n"
            "Key for: green bond issuance, Article 9 fund eligibility, green loan frameworks"
        ),
    }

    key = framework.upper().replace(" ", "_").replace("-", "_")
    return DB.get(key, (
        f"Framework '{framework}' — not found in local registry.\n"
        "Available: TCFD, CSRD, ISSB, GRI, SFDR, EU_TAXONOMY, SBTI, GHG_PROTOCOL\n"
        "Full regulatory database integration available in production deployment."
    ))


@tool
def estimate_carbon_exposure(company_sector: str, annual_revenue_usd_bn: float) -> str:
    """
    Estimate carbon cost exposure for a company given sector and revenue scale.

    Args:
        company_sector: Industry sector (e.g., 'steel', 'cement', 'airlines', 'utilities')
        annual_revenue_usd_bn: Annual revenue in USD billions

    Returns:
        Estimated carbon cost range under 2030 and 2050 price scenarios.
    """
    # Rough emission intensities (tCO2/$M revenue) by sector
    INTENSITY: dict[str, float] = {
        "steel": 1200.0,
        "cement": 900.0,
        "airlines": 400.0,
        "utilities": 350.0,
        "oil & gas": 280.0,
        "chemicals": 200.0,
        "automotive": 80.0,
        "technology": 20.0,
    }

    sector_lower = company_sector.lower()
    intensity = next((v for k, v in INTENSITY.items() if k in sector_lower), 150.0)

    revenue_m = annual_revenue_usd_bn * 1000
    estimated_emissions_mt = (intensity * revenue_m) / 1_000_000

    cost_2030_low = estimated_emissions_mt * 50     # $50/tCO2
    cost_2030_high = estimated_emissions_mt * 130   # $130/tCO2 (NGFS NZ)
    cost_2050_low = estimated_emissions_mt * 130
    cost_2050_high = estimated_emissions_mt * 250   # $250/tCO2 (NGFS NZ 2050)

    return (
        f"[CARBON EXPOSURE — {company_sector.upper()} | Revenue: ${annual_revenue_usd_bn}B]\n\n"
        f"Estimated emissions intensity: ~{intensity} tCO2 / $M revenue\n"
        f"Estimated annual Scope 1+2 emissions: ~{estimated_emissions_mt:.1f} MtCO2e\n\n"
        f"Carbon cost exposure:\n"
        f"  2030 (@$50–$130/t):  ${cost_2030_low:.0f}M – ${cost_2030_high:.0f}M / year\n"
        f"  2050 (@$130–$250/t): ${cost_2050_low:.0f}M – ${cost_2050_high:.0f}M / year\n\n"
        "Note: Based on sector average intensity. Actual exposure requires Scope 1+2+3 audit."
    )


@tool
async def search_climate_knowledge_base(query: str) -> str:
    """
    Search the Climactix proprietary knowledge base for relevant climate documents,
    ESG reports, regulatory frameworks, IPCC findings, and company disclosures.

    Use this tool when the question references specific documents, reports, frameworks,
    or data that may be stored in the knowledge base. Always try this tool first for
    questions about specific companies, frameworks, or recent reports.

    Args:
        query: Specific search query to look up in the knowledge base

    Returns:
        Relevant passages from ingested climate documents, ranked by semantic similarity.
    """
    from app.retrieval.retriever import multi_collection_retrieve
    return await multi_collection_retrieve(query)


CLIMATE_TOOLS = [
    search_climate_knowledge_base,
    analyze_transition_risk,
    assess_physical_risk,
    lookup_esg_framework,
    estimate_carbon_exposure,
]


# ─────────────────────────────────────────────────────────────────────────────
# LANGGRAPH STATE + AGENT GRAPH
# ─────────────────────────────────────────────────────────────────────────────

class AgentState(TypedDict):
    messages: Annotated[list, add_messages]


def _build_agent_graph():
    """Compile the LangGraph ReAct agent with climate tools."""
    llm = ChatOpenAI(
        model=os.getenv("AGENT_MODEL", "gpt-4o"),
        temperature=float(os.getenv("AGENT_TEMPERATURE", "0.1")),
        max_tokens=int(os.getenv("AGENT_MAX_TOKENS", "2048")),
    ).bind_tools(CLIMATE_TOOLS)

    tool_node = ToolNode(CLIMATE_TOOLS)

    def agent_node(state: AgentState) -> dict:
        messages = state["messages"]
        # Inject system prompt on first turn only
        if not any(isinstance(m, SystemMessage) for m in messages):
            messages = [SystemMessage(content=CLIMATE_SYSTEM_PROMPT)] + messages
        response = llm.invoke(messages)
        return {"messages": [response]}

    def should_continue(state: AgentState) -> str:
        last = state["messages"][-1]
        if hasattr(last, "tool_calls") and last.tool_calls:
            return "tools"
        return END

    graph = StateGraph(AgentState)
    graph.add_node("agent", agent_node)
    graph.add_node("tools", tool_node)
    graph.set_entry_point("agent")
    graph.add_conditional_edges("agent", should_continue)
    graph.add_edge("tools", "agent")

    return graph.compile()


# Singleton — compiled once at startup, reused across requests
_agent_graph = None


def get_climate_agent():
    global _agent_graph
    if _agent_graph is None:
        _agent_graph = _build_agent_graph()
        logger.info("Climate Intelligence Agent initialized (LangGraph + GPT-4o)")
    return _agent_graph


# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC API
# ─────────────────────────────────────────────────────────────────────────────

async def run_climate_query(query: str) -> dict[str, Any]:
    """
    Execute a climate intelligence query through the ReAct agent graph.

    Args:
        query: Natural language climate question or analysis request

    Returns:
        {
            "answer": str,
            "tool_calls_used": list[str],
            "metadata": {"model": str, "message_count": int}
        }
    """
    agent = get_climate_agent()
    initial_state: AgentState = {"messages": [HumanMessage(content=query)]}

    try:
        final_state = await agent.ainvoke(initial_state)
        messages = final_state["messages"]

        ai_messages = [m for m in messages if isinstance(m, AIMessage)]
        last_response = ai_messages[-1] if ai_messages else None

        tool_calls_used: list[str] = [
            tc["name"]
            for m in messages
            if hasattr(m, "tool_calls") and m.tool_calls
            for tc in m.tool_calls
        ]

        return {
            "answer": last_response.content if last_response else "No response generated.",
            "tool_calls_used": tool_calls_used,
            "metadata": {
                "model": os.getenv("AGENT_MODEL", "gpt-4o"),
                "message_count": len(messages),
            },
        }

    except Exception as e:
        logger.error(f"Climate agent execution error: {e}")
        raise
