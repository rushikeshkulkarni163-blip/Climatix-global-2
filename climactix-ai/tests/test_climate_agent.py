"""
Climactix AI Core — Test Suite

Run: pytest tests/ -v
"""

import pytest
from httpx import ASGITransport, AsyncClient


@pytest.mark.asyncio
async def test_health_returns_operational():
    from main import app

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/health")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "operational"
    assert data["service"] == "Climactix AI Core"
    assert "vector_store" in data


@pytest.mark.asyncio
async def test_query_too_short_returns_422():
    from main import app

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/query", json={"query": "hi"})

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_query_schema_structure():
    from app.schemas.query import QueryResponse

    mock = QueryResponse(
        query="What is transition risk?",
        answer="Transition risk refers to the financial risks...",
        tool_calls_used=["analyze_transition_risk"],
        metadata={"model": "gpt-4o", "message_count": 3},
    )
    assert mock.query == "What is transition risk?"
    assert "analyze_transition_risk" in mock.tool_calls_used
    assert mock.metadata["model"] == "gpt-4o"


def test_climate_tools_callable():
    from app.agents.climate_agent import (
        analyze_transition_risk,
        assess_physical_risk,
        estimate_carbon_exposure,
        lookup_esg_framework,
    )

    tr = analyze_transition_risk.invoke({"sector": "oil & gas", "scenario": "IEA NZE 2050"})
    assert "TRANSITION RISK" in tr

    pr = assess_physical_risk.invoke({"location": "Miami, FL", "hazard_type": "flood"})
    assert "PHYSICAL RISK" in pr

    fw = lookup_esg_framework.invoke({"framework": "TCFD"})
    assert "Task Force" in fw

    carbon = estimate_carbon_exposure.invoke({"company_sector": "steel", "annual_revenue_usd_bn": 10.0})
    assert "CARBON EXPOSURE" in carbon


def test_orchestrator_classifier():
    from app.orchestration.graph import classify_query

    state = classify_query({"query": "What is transition risk for coal companies?", "agent_type": "", "result": ""})
    assert state["agent_type"] == "transition_risk"

    state = classify_query({"query": "Explain TCFD disclosure requirements.", "agent_type": "", "result": ""})
    assert state["agent_type"] == "esg_disclosure"

    state = classify_query({"query": "How do green bonds work?", "agent_type": "", "result": ""})
    assert state["agent_type"] == "climate_finance"
