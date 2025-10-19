"""Response models for FastAPI endpoints."""

from typing import Any

from pydantic import BaseModel


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
    concepts: dict[str, list[str]] | None = None
    graph: Any | None = None
