"""
API Schemas — Climactix AI Core v1
Pydantic v2 request/response models for all query endpoints.
"""

from typing import Any

from pydantic import BaseModel, Field


class QueryRequest(BaseModel):
    query: str = Field(
        ...,
        min_length=10,
        max_length=2000,
        description="Natural language climate intelligence query",
        examples=[
            "What is transition risk and how does it affect oil & gas companies?",
            "Explain TCFD scenario analysis requirements for a bank.",
            "Estimate carbon cost exposure for a steel company with $5B annual revenue.",
        ],
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "query": "What is transition risk and how does it affect the energy sector under an IEA Net Zero 2050 scenario?"
            }
        }
    }


class QueryResponse(BaseModel):
    query: str = Field(description="The original query submitted")
    answer: str = Field(description="Climate intelligence response from the agent")
    tool_calls_used: list[str] = Field(
        default_factory=list,
        description="Names of climate tools invoked during analysis",
    )
    metadata: dict[str, Any] = Field(
        default_factory=dict,
        description="Model metadata: model name, message count, etc.",
    )


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    vector_store: str


class ErrorResponse(BaseModel):
    detail: str
