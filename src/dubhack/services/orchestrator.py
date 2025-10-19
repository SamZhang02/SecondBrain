"""Pipeline orchestration utilities."""

from __future__ import annotations

import logging
from enum import Enum
from pathlib import Path
from threading import Event, Lock
from typing import Optional, Protocol

from botocore.exceptions import ClientError

from dubhack.models import ForceGraphData
from dubhack.redis.concept_store import ConceptStore
from dubhack.services.concept_extractor import ConceptExtractor, ConceptMap
from dubhack.services.concept_populator import ConceptPopulator
from dubhack.services.document_store import DocumentStore
from dubhack.services.graph_builder import ConceptGraphBuilder
from dubhack.services.pdf_compressor import PDFCompressor


logger = logging.getLogger(__name__)


class PipelineState(str, Enum):
    STARTING = "starting"
    COMPRESSING = "compressing"
    PARSING = "parsing"
    POPULATING = "populating"
    GRAPHING = "graphing"
    DONE = "done"
    ERROR = "error"


class Orchestrator:
    """Run the end-to-end document processing pipeline."""

    def __init__(
        self,
        document_store: DocumentStore,
        concept_extractor: ConceptExtractor,
        concept_populator: Optional[ConceptPopulator] = None,
        graph_builder: Optional[ConceptGraphBuilder] = None,
        concept_store: Optional[ConceptStore] = None,
        pdf_compressor: Optional[PDFCompressor] = None,
    ) -> None:
        self._document_store = document_store
        self._concept_extractor = concept_extractor
        self._concept_populator = concept_populator
        self._graph_builder = graph_builder
        self._concept_store = concept_store
        self._pdf_compressor = pdf_compressor

        self._state: PipelineState = PipelineState.DONE
        self._state_lock = Lock()
        self._cancel_event = Event()

        self._last_concepts: ConceptMap = {}
        self._last_graph: ForceGraphData | None = None
        self._error_message: str | None = None
        self._last_compressed: list[str] = []

    def current_state(self) -> str:
        """Return the pipeline stage as a string for polling clients."""

        with self._state_lock:
            return self._state.value

    def extraction_progress(self) -> ConceptMap:
        """Expose incremental extraction progress."""

        return self._concept_extractor.progress()

    def population_progress(self) -> list[str]:
        """Expose incremental concept population progress."""

        if not self._concept_populator:
            return []
        return self._concept_populator.completed_concepts()

    def last_concepts(self) -> ConceptMap:
        """Return the most recent concept mapping produced by run()."""

        return self._last_concepts

    def last_graph(self) -> ForceGraphData | None:
        """Return the most recent graph object produced by run()."""

        return self._last_graph

    def run(self) -> ConceptMap:
        """Execute the pipeline synchronously and return the concept map."""

        self._last_concepts = {}
        self._last_graph = None
        self._error_message = None
        self._last_compressed = []

        self._set_state(PipelineState.COMPRESSING)
        documents = self._document_store.get_documents()
        self._cancel_event.clear()

        if self._pdf_compressor and self._pdf_compressor.available:
            try:
                compressed_docs = self._pdf_compressor.compress_documents(documents)
                self._last_compressed = compressed_docs
            except Exception as exc:
                self._error_message = (
                    f"PDF compression failed: {exc}"
                    if not isinstance(exc, ValueError)
                    else str(exc)
                )
                self._set_state(PipelineState.ERROR)
                raise
            documents = self._document_store.get_documents()

        self._set_state(PipelineState.PARSING)

        oversized_docs = self._document_store.get_oversized_documents()
        if oversized_docs:
            message = self._format_oversized_error(oversized_docs)
            self._error_message = message
            self._set_state(PipelineState.ERROR)
            raise ValueError(message)

        if self._concept_store:
            self._concept_store.reset()

        try:
            concepts = self._concept_extractor.extract(documents)
            if self._cancel_event.is_set():
                self._last_concepts = self._concept_extractor.progress()
                return {}

            self._set_state(PipelineState.POPULATING)
            if self._concept_populator and documents:
                keyword_set = {keyword for keywords in concepts.values() for keyword in keywords}
                if keyword_set:
                    self._concept_populator.populate(keyword_set, documents)
                    if self._cancel_event.is_set():
                        self._last_concepts = self._concept_extractor.progress()
                        return {}

            self._set_state(PipelineState.GRAPHING)
            if self._graph_builder:
                self._last_graph = self._graph_builder.build(concepts)
            else:
                self._last_graph = None
            if self._cancel_event.is_set():
                self._last_concepts = self._concept_extractor.progress()
                return {}

            self._last_concepts = concepts
            self._set_state(PipelineState.DONE)
            return concepts
        except Exception as exc:  # pragma: no cover - defensive logging
            if self._is_throttling_error(exc):
                self._error_message = str(exc)
                logger.warning("Pipeline throttled during population: %s", exc)
                self._last_concepts = self._concept_extractor.progress()
                return self._last_concepts

            self._error_message = str(exc)
            self._set_state(PipelineState.ERROR)
            raise
        finally:
            if self._state != PipelineState.ERROR:
                self._set_state(PipelineState.DONE)

    def _set_state(self, new_state: PipelineState) -> None:
        with self._state_lock:
            self._state = new_state

    def cancel(self) -> None:
        """Signal a cancellation request for the running pipeline."""

        self._cancel_event.set()

    def last_error(self) -> str | None:
        """Return the latest error message if the pipeline failed."""

        return self._error_message

    def last_compressed_documents(self) -> list[str]:
        """Return a list of documents that were compressed in the last run."""

        return self._last_compressed

    def reset(self) -> None:
        """Clear cached pipeline results for a fresh session."""

        if self.current_state() not in {
            PipelineState.DONE.value,
            PipelineState.ERROR.value,
            PipelineState.STARTING.value,
        }:
            raise RuntimeError("Cannot reset while pipeline is running")

        self._last_concepts = {}
        self._last_graph = None
        self._error_message = None
        self._last_compressed = []
        self._concept_extractor.clear_progress()
        if self._concept_populator:
            self._concept_populator.clear_progress()
        self._set_state(PipelineState.STARTING)

    @staticmethod
    def _is_throttling_error(exc: Exception) -> bool:
        """Return True when the exception indicates a throttling condition."""

        if isinstance(exc, ClientError):
            error = exc.response.get("Error", {})
            code = error.get("Code", "")
            return code in {
                "ThrottlingException",
                "TooManyRequestsException",
                "LimitExceededException",
            }

        message = str(exc)
        throttle_markers = (
            "ThrottlingException",
            "TooManyRequests",
            "Rate exceeded",
            "SlowDown",
        )
        return any(marker in message for marker in throttle_markers)

    def _format_oversized_error(self, documents: list[str]) -> str:
        filenames = [Path(path).name for path in documents]
        joined = ", ".join(filenames)
        return (
            "One or more documents exceed the 4.5 MB limit for analysis: "
            f"{joined}. Please remove or reduce these files and try again."
        )
