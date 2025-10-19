"""Response models for FastAPI endpoints."""

from typing import Any

from pydantic import BaseModel, Field


class StatusResponse(BaseModel):
    """Generic status payload for simple health-style endpoints."""

    status: str


class ConceptSummaryResponse(BaseModel):
    """Payload describing a stored concept summary."""

    concept: str
    summary: str


class PipelineStatusResponse(BaseModel):
    """Status payload for long-running orchestration."""

    state: str
    compressed_documents: list[str] = Field(
        default_factory=list,
        description="List of documents that were compressed during preprocessing.",
    )
    extracted_documents: dict[str, list[str]] = Field(
        default_factory=dict,
        description="Mapping of document paths to extracted keywords collected so far.",
    )
    populated_concepts: list[str] = Field(
        default_factory=list,
        description="List of concept names successfully written to the concept store.",
    )
    graph: Any | None = Field(
        default=None,
        description="Graph output produced during the graphing stage, if available.",
    )
    message: str | None = Field(
        default=None,
        description="Optional error message when the pipeline enters the error state.",
    )
