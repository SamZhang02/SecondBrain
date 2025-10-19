"""FastAPI application entrypoint for the dubhack service."""

from fastapi import Depends, FastAPI, HTTPException

from dubhack.config import get_concept_store
from dubhack.models import ConceptSummaryResponse, StatusResponse
from dubhack.redis.concept_store import ConceptStore

app = FastAPI(title="dubhack")


@app.get("/", tags=["health"], response_model=StatusResponse)
async def health() -> StatusResponse:
    """Basic liveness probe endpoint."""
    return StatusResponse(status="ok")


@app.get("/upload", tags=["upload"], response_model=StatusResponse)
async def read_upload() -> StatusResponse:
    """Basic liveness probe endpoint."""
    return StatusResponse(status="ok")


@app.get("/concepts/{concept_name}", tags=["concepts"], response_model=ConceptSummaryResponse)
async def read_concept_summary(
    concept_name: str, concept_store: ConceptStore = Depends(get_concept_store)
) -> ConceptSummaryResponse:
    """Return a stored concept summary or 404 if it is missing."""

    summary = concept_store.read_concept(concept_name)
    if summary is None:
        raise HTTPException(status_code=404, detail="Concept not found")

    return ConceptSummaryResponse(concept=concept_name, summary=summary)
