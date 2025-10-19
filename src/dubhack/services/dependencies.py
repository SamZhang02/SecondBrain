"""Factory helpers for shared service instances."""

from __future__ import annotations

from functools import lru_cache

from dubhack.services.concept_extractor import ConceptExtractor
from dubhack.services.concept_populator import ConceptPopulator
from dubhack.services.document_store import DocumentStore
from dubhack.services.orchestrator import Orchestrator
from dubhack.config import get_concept_store


@lru_cache(maxsize=1)
def get_document_store() -> DocumentStore:
    """Return a cached document store instance."""

    return DocumentStore()


@lru_cache(maxsize=1)
def get_concept_extractor() -> ConceptExtractor:
    """Return a cached concept extractor instance."""

    return ConceptExtractor()


@lru_cache(maxsize=1)
def get_concept_populator() -> ConceptPopulator:
    """Return a cached concept populator instance."""

    return ConceptPopulator(get_concept_store())


@lru_cache(maxsize=1)
def get_orchestrator() -> Orchestrator:
    """Return a cached orchestrator that wires the pipeline together."""

    return Orchestrator(
        document_store=get_document_store(),
        concept_extractor=get_concept_extractor(),
        concept_populator=get_concept_populator(),
    )
