"""Response models for FastAPI endpoints."""

from pydantic import BaseModel


class StatusResponse(BaseModel):
    """Generic status payload for simple health-style endpoints."""

    status: str


class ConceptSummaryResponse(BaseModel):
    """Payload describing a stored concept summary."""

    concept: str
    summary: str
