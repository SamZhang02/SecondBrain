"""Application configuration utilities and dependency providers."""

from functools import lru_cache
from pathlib import Path

import redis

from dubhack.redis.concept_store import ConceptStore

DOCUMENTS_PERSIST_PATH = Path("/Users/samzhang/repos/dubhack/src/data")


@lru_cache(maxsize=1)
def get_redis_client() -> redis.Redis:
    """Return a cached Redis client for the local Redis instance."""

    return redis.Redis(host="localhost", port=6379, decode_responses=True)


def get_concept_store() -> ConceptStore:
    """Provide a concept store backed by the shared Redis connection."""

    return ConceptStore(get_redis_client())
