"""Populate concept summaries using a concept store and an LLM backend."""

from __future__ import annotations

import logging
from collections.abc import Iterable, Mapping, Sequence
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock
from typing import final

from dubhack.llm.bedrock import query_llm
from dubhack.redis.concept_store import ConceptStore

Concept = str

logger = logging.getLogger(__name__)


@final
class ConceptPopulator:
    """Populate the concept store with generated summaries."""

    PROMPT = """
    Given this list of documents write a mini wiki. The structure of the wiki should be composed of 2 to 4 paragraphs. The first paragraph is a couple sentence summary of the concept based on the given documents and your knowledge. The rest of the paragraph should compare how the concept the presented in each document, and any connections, whether it is similarities, differences, or related in some way. ONLY REFER TO DOCUMENTS THAT I GAVE YOU, DO NOT REFER TO EXTERNAL SOURCES, DO NOT DIG INTO THE REFERENCES TO USE OTHER DOCUMENTS. DO STATE THE DOCUMENT NAME WHEN YOU REFER TO THEM.

    The concept that you will write on is: 
    """

    def __init__(self, concept_store: ConceptStore, max_workers: int = 3) -> None:
        self._concept_store = concept_store
        self._max_workers = max_workers
        self._lock = Lock()
        self._completed: list[Concept] = []

    def clear_progress(self) -> None:
        """Reset tracked population progress."""

        with self._lock:
            self._completed = []

    def completed_concepts(self) -> list[Concept]:
        """Return the list of concepts successfully populated so far."""

        with self._lock:
            return list(self._completed)

    def populate(
        self,
        concepts: Iterable[Concept],
        documents: Sequence[str],
        concept_map: Mapping[str, Sequence[str]] | None = None,
    ) -> None:
        """Generate summaries for every concept and store them."""

        concept_list = list(dict.fromkeys(concepts))
        if not concept_list:
            return

        concept_documents: dict[Concept, list[str]] | None = None
        if concept_map is not None:
            concept_documents = self._group_documents_by_concept(concept_map)
            concept_list = [concept for concept in concept_list if concept_documents.get(concept)]
            if not concept_list:
                return

        self.clear_progress()

        with ThreadPoolExecutor(max_workers=min(self._max_workers, len(concept_list))) as executor:
            future_map = {}
            for concept in concept_list:
                doc_list = (
                    concept_documents.get(concept, [])
                    if concept_documents is not None
                    else list(documents)
                )
                if concept_documents is not None and not doc_list:
                    continue
                future_map[executor.submit(self._populate_single, concept, doc_list)] = concept

            if not future_map:
                return

            for future in as_completed(future_map):
                concept = future_map[future]
                try:
                    future.result()
                except Exception as exc:  # pragma: no cover - defensive logging
                    logger.exception("Failed to populate concept %s", concept)
                    raise exc

    def _populate_single(self, concept: Concept, documents: Sequence[str]) -> None:
        summary = query_llm(self.PROMPT + concept, documents)
        self._concept_store.create_concept(concept, summary)
        self._record_completion(concept)

    def _record_completion(self, concept: Concept) -> None:
        with self._lock:
            if concept not in self._completed:
                self._completed.append(concept)

    @staticmethod
    def _group_documents_by_concept(
        concept_map: Mapping[str, Sequence[str]],
    ) -> dict[Concept, list[str]]:
        index: dict[Concept, list[str]] = {}
        for document, keywords in concept_map.items():
            if not keywords:
                continue
            for keyword in keywords:
                if not keyword:
                    continue
                docs = index.setdefault(keyword, [])
                if document not in docs:
                    docs.append(document)
        return index


if __name__ == "__main__":
    import redis

    redis_client = redis.Redis(host="localhost", port=6379, decode_responses=True)
    concept_store = ConceptStore(redis_client)
    concept_store.reset()

    populator = ConceptPopulator(concept_store)
    demo_concepts = ["Head Wearable Device"]
    demo_documents = [
        "/Users/samzhang/repos/dubhack/src/data/testdoc1.pdf",
    ]

    populator.populate(demo_concepts, demo_documents)

    missing_concepts = []
    for concept in demo_concepts:
        summary = concept_store.read_concept(concept)
        print(summary)
        if not summary:
            missing_concepts.append(concept)

    if missing_concepts:
        print("Missing concepts:", missing_concepts)
    else:
        print("All demo concepts have been populated in Redis.")
