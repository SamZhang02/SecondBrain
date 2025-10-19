"""Document storage utilities used by the orchestration pipeline."""

from __future__ import annotations

from pathlib import Path
from typing import Iterable

from dubhack.config import DOCUMENTS_PERSIST_PATH


class DocumentStore:
    """Thin wrapper around the persisted document directory."""

    MAX_DOCUMENT_SIZE_BYTES = int(4.5 * 1024 * 1024)

    def __init__(self, base_path: Path | None = None) -> None:
        self._base_path = base_path or DOCUMENTS_PERSIST_PATH

    @property
    def base_path(self) -> Path:
        """Return the root folder where uploaded documents are stored."""

        return self._base_path

    def get_documents(self) -> list[str]:
        """Return absolute paths for every persisted document."""

        if not self._base_path.exists():
            return []

        document_paths: list[str] = []
        for path in self._base_path.iterdir():
            if path.is_file():
                document_paths.append(str(path.resolve()))

        document_paths.sort()
        return document_paths

    def __iter__(self) -> Iterable[str]:
        """Iterate over persisted document paths."""

        return iter(self.get_documents())

    def get_oversized_documents(self, max_bytes: int | None = None) -> list[str]:
        """Return document paths that exceed the allowed LLM upload size."""

        limit = max_bytes or self.MAX_DOCUMENT_SIZE_BYTES

        if not self._base_path.exists():
            return []

        oversized: list[str] = []
        for path in self._base_path.iterdir():
            if not path.is_file():
                continue
            try:
                size = path.stat().st_size
            except OSError:
                continue

            if size > limit:
                oversized.append(str(path.resolve()))

        return sorted(oversized)
