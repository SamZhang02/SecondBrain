"""Populate concept summaries using a concept store and an LLM backend."""

from __future__ import annotations
from collections.abc import Iterable, Sequence
from typing import final


from dubhack.redis.concept_store import ConceptStore


Concept = str


class MockLLM:
    """Basic mock LLM used for local development and tests."""

    def summarize(self, concept: Concept, documents: Sequence[str]) -> str:
        """Return a lightweight summary based on the provided documents."""

        return f"Lorem Ipsum"


@final
class ConceptPopulator:
    """Populate the concept store with generated summaries."""

    def __init__(self, concept_store: ConceptStore, llm: MockLLM | None = None) -> None:
        self._concept_store = concept_store
        self._llm = llm or MockLLM()

    def populate(self, concepts: Iterable[Concept], documents: Sequence[str]) -> None:
        """Generate summaries for every concept and store them."""
        for concept in concepts:
            summary = self._llm.summarize(concept, documents)
            print(summary)
            # Overwrite or create the concept entry with the generated summary.
            self._concept_store.create_concept(concept, summary)


if __name__ == "__main__":
    import redis

    redis_client = redis.Redis(host="localhost", port=6379, decode_responses=True)
    concept_store = ConceptStore(redis_client)
    concept_store.reset()

    populator = ConceptPopulator(concept_store)
    demo_concepts = [f"demo_concept_{index}" for index in range(10)]
    demo_documents = [
        "Document one with placeholder content.",
        "Document two with additional placeholder content.",
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
