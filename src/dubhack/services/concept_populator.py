"""Populate concept summaries using a concept store and an LLM backend."""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from typing import final

from dubhack.llm.bedrock import query_llm
from dubhack.redis.concept_store import ConceptStore

Concept = str


@final
class ConceptPopulator:
    """Populate the concept store with generated summaries."""

    PROMPT = """
    Given this list of documents write a mini wiki. The structure of the wiki should be composed of 2 to 4 paragraphs. The first paragraph is a couple sentence summary of the concept based on the given documents and your knowledge. The rest of the paragraph should compare how the concept the presented in each document, and any connections, whether it is similarities, differences, or related in some way. ONLY REFER TO DOCUMENTS I GAVE YOU, DO NOT REFER TO EXTERNAL SOURCES.

    The concept that you will write on is: 
    """

    def __init__(self, concept_store: ConceptStore) -> None:
        self._concept_store = concept_store

    def populate(self, concepts: Iterable[Concept], documents: Sequence[str]) -> None:
        """Generate summaries for every concept and store them."""
        for concept in concepts:
            summary = query_llm(self.PROMPT + concept, documents)
            # Overwrite or create the concept entry with the generated summary.
            self._concept_store.create_concept(concept, summary)


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
