"""
Query Routes — Climactix AI Core v1
Climate intelligence query endpoints served through FastAPI.
"""

from fastapi import APIRouter, HTTPException

from app.agents.climate_agent import run_climate_query
from app.schemas.query import ErrorResponse, QueryRequest, QueryResponse
from app.utils.logger import logger

router = APIRouter(tags=["Climate Intelligence"])


@router.post(
    "/query",
    response_model=QueryResponse,
    summary="Submit a climate intelligence query",
    description=(
        "Send a natural language query to the Climactix Climate Risk Intelligence Agent. "
        "The agent will reason over the query, invoke domain tools as needed, "
        "and return a structured institutional-grade analysis."
    ),
    responses={
        422: {"description": "Validation error — query too short or too long"},
        500: {"model": ErrorResponse, "description": "Agent execution error"},
    },
)
async def query_climate_agent(request: QueryRequest) -> QueryResponse:
    """
    Supported analysis types:
    - **Transition risk**: carbon price exposure, stranded assets, regulatory shifts
    - **Physical risk**: floods, heat stress, sea-level rise, drought, wildfire
    - **ESG frameworks**: TCFD, CSRD, ISSB S2, SFDR, EU Taxonomy, SBTi, GHG Protocol
    - **Carbon exposure**: company-level carbon cost under 2030/2050 price scenarios
    - **Climate finance**: green bonds, carbon markets, transition finance structures
    """
    logger.info(f"Incoming query ({len(request.query)} chars): {request.query[:100]}…")

    try:
        result = await run_climate_query(request.query)
        return QueryResponse(
            query=request.query,
            answer=result["answer"],
            tool_calls_used=result.get("tool_calls_used", []),
            metadata=result.get("metadata", {}),
        )
    except EnvironmentError as e:
        # Missing API key — surface clearly
        logger.error(f"Environment error: {e}")
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Agent error: {e}")
        raise HTTPException(status_code=500, detail=f"Agent execution failed: {e}")
