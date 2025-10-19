"""FastAPI application entrypoint for the dubhack service."""

import os
import shutil

from fastapi import BackgroundTasks, Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from dubhack.config import DOCUMENTS_PERSIST_PATH, get_concept_store
from dubhack.models import (
    ConceptSummaryResponse,
    PipelineStatusResponse,
    StatusResponse,
)
from dubhack.redis.concept_store import ConceptStore
from dubhack.services.dependencies import get_orchestrator
from dubhack.services.orchestrator import Orchestrator, PipelineState

app = FastAPI(title="dubhack")

frontend_origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["health"], response_model=StatusResponse)
async def health() -> StatusResponse:
    """Basic liveness probe endpoint."""
    return StatusResponse(status="ok")


@app.post("/upload", tags=["upload"], response_model=StatusResponse)
async def upload(
    background_tasks: BackgroundTasks,
    documents: list[UploadFile] = File(...),
    orchestrator: Orchestrator = Depends(get_orchestrator),
) -> StatusResponse:
    """Receive and persist a batch of uploaded documents."""
    if not documents:
        raise HTTPException(status_code=400, detail="No documents provided")

    if orchestrator.current_state() not in {
        PipelineState.DONE.value,
        PipelineState.ERROR.value,
        PipelineState.STARTING.value,
    }:
        raise HTTPException(status_code=409, detail="Pipeline is already running")

    try:
        orchestrator.reset()
    except RuntimeError:
        # Safe to ignore as we already verified the pipeline is idle.
        pass

    DOCUMENTS_PERSIST_PATH.mkdir(parents=True, exist_ok=True)

    for item in DOCUMENTS_PERSIST_PATH.iterdir():
        if item.is_dir() and not item.is_symlink():
            shutil.rmtree(item)
        else:
            item.unlink()

    for document in documents:
        safe_name = os.path.basename(document.filename)
        if not safe_name:
            raise HTTPException(status_code=400, detail="Document filename missing")

        destination = DOCUMENTS_PERSIST_PATH / safe_name
        document.file.seek(0)
        with destination.open("wb") as output_file:
            shutil.copyfileobj(document.file, output_file)

    background_tasks.add_task(orchestrator.run)

    return StatusResponse(status=f"queued processing for {len(documents)} document(s)")


@app.get("/status", tags=["status"], response_model=PipelineStatusResponse)
async def status(
    orchestrator: Orchestrator = Depends(get_orchestrator),
) -> PipelineStatusResponse:
    """Return the current state of the document processing pipeline."""

    state = orchestrator.current_state()
    compressed = orchestrator.last_compressed_documents()
    extracted = orchestrator.extraction_progress()
    populated = orchestrator.population_progress()
    graph = orchestrator.last_graph() if state == PipelineState.DONE.value else None
    message = orchestrator.last_error() if state == PipelineState.ERROR.value else None

    return PipelineStatusResponse(
        state=state,
        compressed_documents=compressed,
        extracted_documents=extracted,
        populated_concepts=populated,
        graph=graph,
        message=message,
    )


@app.post("/status/cancel", tags=["status"], response_model=StatusResponse)
async def cancel(orchestrator: Orchestrator = Depends(get_orchestrator)) -> StatusResponse:
    """Request cancellation of the running pipeline."""

    if orchestrator.current_state() in {
        PipelineState.DONE.value,
        PipelineState.ERROR.value,
        PipelineState.STARTING.value,
    }:
        raise HTTPException(status_code=409, detail="Pipeline is not running")

    orchestrator.cancel()
    return StatusResponse(status="cancellation requested")


@app.post("/status/reset", tags=["status"], response_model=StatusResponse)
async def reset(orchestrator: Orchestrator = Depends(get_orchestrator)) -> StatusResponse:
    """Clear cached pipeline results for a fresh session."""

    try:
        orchestrator.reset()
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    return StatusResponse(status="reset")


@app.get("/concepts/{concept_name}", tags=["concepts"], response_model=ConceptSummaryResponse)
async def read_concept_summary(
    concept_name: str, concept_store: ConceptStore = Depends(get_concept_store)
) -> ConceptSummaryResponse:
    """Return a stored concept summary or 404 if it is missing."""

    summary = concept_store.read_concept(concept_name)
    if summary is None:
        raise HTTPException(status_code=404, detail="Concept not found")

    return ConceptSummaryResponse(concept=concept_name, summary=summary)
