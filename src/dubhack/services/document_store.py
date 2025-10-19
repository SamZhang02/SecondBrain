"""Document storage utilities used by the orchestration pipeline."""

from __future__ import annotations

from pathlib import Path
from typing import Iterable

from dubhack.config import DOCUMENTS_PERSIST_PATH


class DocumentStore:
    """Thin wrapper around the persisted document directory."""

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
