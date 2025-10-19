"""Services that derive document concepts using the LLM backend."""

from __future__ import annotations

import json
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from threading import Lock
from typing import Iterable

from dubhack.llm.bedrock import query_llm

logger = logging.getLogger(__name__)

DocumentPath = str
Keyword = str
ConceptMap = dict[DocumentPath, list[Keyword]]


class ConceptExtractor:
    """Extract important concepts from documents via the LLM."""

    PROMPT_TEMPLATE = """
You are an expert knowledge architect. A document is attached to this message.
Read only the provided document and identify the most important concepts or
keywords contained in it. They should be generic but important concepts that you would expect to appear in other essays or texts on similar topics.
Be careful to not extract an acronym that has already been extracted as its full term, e.g. NLP vs Natural Language processing.

ONLY RETURN 5 TO 10 CONCISE KEYWORD STRINGS. 

Use proper casing with capitalized first letter if relevantcapitalized first letter if relevant.

Respond ONLY with JSON in the following format:
{{"document": "{document_name}", "keywords": ["keyword one", "keyword two", ...]}}
"""

    def __init__(self, max_workers: int = 4) -> None:
        self._max_workers = max_workers
        self._lock = Lock()
        self._progress: ConceptMap = {}

    def clear_progress(self) -> None:
        """Reset tracked extraction progress."""

        with self._lock:
            self._progress = {}

    def progress(self) -> ConceptMap:
        """Return a shallow copy of the extraction progress so far."""

        with self._lock:
            return dict(self._progress)

    def extract(self, document_paths: Iterable[DocumentPath]) -> ConceptMap:
        """Return a mapping of document path to extracted keyword list."""

        paths = list(document_paths)
        if not paths:
            return {}

        self.clear_progress()

        if len(paths) == 1:
            document = paths[0]
            keywords = self._extract_for_document(document)
            self._record_result(document, keywords)
            return self.progress()

        results: ConceptMap = {}
        with ThreadPoolExecutor(max_workers=min(self._max_workers, len(paths))) as executor:
            future_map = {
                executor.submit(self._extract_for_document, document): document
                for document in paths
            }

            for future in as_completed(future_map):
                document = future_map[future]
                try:
                    keywords = future.result()
                    results[document] = keywords
                    self._record_result(document, keywords)
                except Exception:  # pragma: no cover - defensive logging
                    logger.exception("Failed to extract concepts for document %s", document)
                    # Surface empty results; upstream can decide how to handle failures.
                    results[document] = []
                    self._record_result(document, [])

        return self.progress()

    def _extract_for_document(self, document_path: DocumentPath) -> list[Keyword]:
        document_name = Path(document_path).name
        prompt = self.PROMPT_TEMPLATE.format(document_name=document_name)
        response = query_llm(prompt, [document_path])
        return self._parse_keywords(response)

    def _record_result(self, document: DocumentPath, keywords: list[Keyword]) -> None:
        with self._lock:
            self._progress[document] = keywords

    @staticmethod
    def _parse_keywords(response: str) -> list[Keyword]:
        """Parse keyword list from the model response."""

        payload = ConceptExtractor._load_json(response)
        if isinstance(payload, dict):
            keywords = payload.get("keywords", [])
        elif isinstance(payload, list):
            keywords = payload
        else:
            keywords = []

        processed: list[str] = []
        for keyword in keywords:
            if not isinstance(keyword, str):
                keyword = str(keyword)
            keyword = keyword.strip()
            if keyword and keyword not in processed:
                processed.append(keyword)
        return processed[:10]

    @staticmethod
    def _load_json(response: str) -> object:
        """Attempt to deserialize JSON from an arbitrary model response."""

        try:
            return json.loads(response)
        except json.JSONDecodeError:
            pass

        # Try to recover JSON that may be wrapped in markdown fences or text.
        start = response.find("{")
        end = response.rfind("}")
        if start != -1 and end != -1 and start < end:
            candidate = response[start : end + 1]
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                pass

        start = response.find("[")
        end = response.rfind("]")
        if start != -1 and end != -1 and start < end:
            candidate = response[start : end + 1]
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                pass

        return {}


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

    from dubhack.services.document_store import DocumentStore

    store = DocumentStore()
    extractor = ConceptExtractor()

    docs = store.get_documents()
    if not docs:
        logging.info("No documents found in %%s", store.base_path)
    else:
        logging.info("Extracting concepts for %d document(s)", len(docs))
        concepts = extractor.extract(docs)
        for path, keywords in concepts.items():
            logging.info("%s -> %s", path, keywords)
