"""Pipeline orchestration utilities."""

from __future__ import annotations

from enum import Enum
from threading import Event, Lock
from typing import Any, Optional, Protocol

from dubhack.services.concept_extractor import ConceptExtractor, ConceptMap
from dubhack.services.concept_populator import ConceptPopulator
from dubhack.services.document_store import DocumentStore


class GraphBuilder(Protocol):
    """Protocol describing the graph building step."""

    def build(self, concepts: ConceptMap) -> Any:  # pragma: no cover - structural typing
        ...


class PipelineState(str, Enum):
    PARSING = "parsing"
    POPULATING = "populating"
    GRAPHING = "graphing"
    DONE = "done"


class Orchestrator:
    """Run the end-to-end document processing pipeline."""

    def __init__(
        self,
        document_store: DocumentStore,
        concept_extractor: ConceptExtractor,
        concept_populator: Optional[ConceptPopulator] = None,
        graph_builder: Optional[GraphBuilder] = None,
    ) -> None:
        self._document_store = document_store
        self._concept_extractor = concept_extractor
        self._concept_populator = concept_populator
        self._graph_builder = graph_builder

        self._state: PipelineState = PipelineState.DONE
        self._state_lock = Lock()
        self._cancel_event = Event()

        self._last_concepts: ConceptMap = {}
        self._last_graph: Any = None

    def current_state(self) -> str:
        """Return the pipeline stage as a string for polling clients."""

        with self._state_lock:
            return self._state.value

    def last_concepts(self) -> ConceptMap:
        """Return the most recent concept mapping produced by run()."""

        return self._last_concepts

    def last_graph(self) -> Any:
        """Return the most recent graph object produced by run()."""

        return self._last_graph

    def run(self) -> ConceptMap:
        """Execute the pipeline synchronously and return the concept map."""

        self._last_concepts = {}
        self._last_graph = None
        self._set_state(PipelineState.PARSING)
        documents = self._document_store.get_documents()
        self._cancel_event.clear()

        try:
            concepts = self._concept_extractor.extract(documents)
            if self._cancel_event.is_set():
                return {}

            self._set_state(PipelineState.POPULATING)
            if self._concept_populator and documents:
                keyword_set = {keyword for keywords in concepts.values() for keyword in keywords}
                if keyword_set:
                    self._concept_populator.populate(keyword_set, documents)
                    if self._cancel_event.is_set():
                        return {}

            self._set_state(PipelineState.GRAPHING)
            if self._graph_builder:
                self._last_graph = self._graph_builder.build(concepts)
            else:
                self._last_graph = None
            if self._cancel_event.is_set():
                return {}

            self._last_concepts = concepts
            return concepts
        finally:
            self._set_state(PipelineState.DONE)

    def _set_state(self, new_state: PipelineState) -> None:
        with self._state_lock:
            self._state = new_state

    def cancel(self) -> None:
        """Signal a cancellation request for the running pipeline."""

        self._cancel_event.set()
