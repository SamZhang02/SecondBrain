"""FastAPI application entrypoint for the dubhack service."""

import os
import shutil

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from dubhack.config import get_concept_store, DOCUMENTS_PERSIST_PATH
from dubhack.models import ConceptSummaryResponse, StatusResponse
from dubhack.redis.concept_store import ConceptStore

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
async def upload(documents: list[UploadFile] = File(...)) -> StatusResponse:
    """Receive and persist a batch of uploaded documents."""
    if not documents:
        raise HTTPException(status_code=400, detail="No documents provided")

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

    return StatusResponse(status=f"stored {len(documents)} document(s)")


@app.get("/concepts/{concept_name}", tags=["concepts"], response_model=ConceptSummaryResponse)
async def read_concept_summary(
    concept_name: str, concept_store: ConceptStore = Depends(get_concept_store)
) -> ConceptSummaryResponse:
    """Return a stored concept summary or 404 if it is missing."""

    summary = concept_store.read_concept(concept_name)
    if summary is None:
        raise HTTPException(status_code=404, detail="Concept not found")

    return ConceptSummaryResponse(concept=concept_name, summary=summary)
