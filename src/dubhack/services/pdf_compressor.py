"""Utilities for compressing PDF documents before LLM ingestion."""

from __future__ import annotations

import logging
import shutil
import subprocess
import tempfile
from pathlib import Path

logger = logging.getLogger(__name__)


class PDFCompressor:
    """Compress PDF documents using Ghostscript if available."""

    def __init__(self, gs_binary: str | None = None) -> None:
        self._gs_binary = gs_binary or shutil.which("gs")
        if not self._gs_binary:
            logger.warning("Ghostscript not found; PDF compression will be skipped.")

    @property
    def available(self) -> bool:
        return self._gs_binary is not None

    def compress_documents(self, document_paths: list[str]) -> list[str]:
        compressed: list[str] = []
        for path in document_paths:
            try:
                if self.compress_document(path):
                    compressed.append(path)
            except Exception:  # pragma: no cover - defensive logging
                logger.exception("Failed to compress document %s", path)
                raise
        return compressed

    def compress_document(self, document_path: str) -> bool:
        pdf_path = Path(document_path)
        if pdf_path.suffix.lower() != ".pdf":
            return False

        if not self.available:
            return False

        if not pdf_path.exists():
            return False

        original_size = pdf_path.stat().st_size

        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as temp_output:
            temp_output_path = Path(temp_output.name)

        command = [
            self._gs_binary,
            "-sDEVICE=pdfwrite",
            "-dCompatibilityLevel=1.4",
            "-dPDFSETTINGS=/ebook",
            "-dDetectDuplicateImages",
            "-dDownsampleColorImages=true",
            "-dColorImageResolution=144",
            "-dNOPAUSE",
            "-dQUIET",
            "-dBATCH",
            f"-sOutputFile={temp_output_path}",
            str(pdf_path),
        ]

        try:
            subprocess.run(command, check=True)
        except subprocess.CalledProcessError as exc:
            logger.exception("Ghostscript compression failed for %s", pdf_path)
            temp_output_path.unlink(missing_ok=True)
            raise RuntimeError("Ghostscript compression failed") from exc

        if not temp_output_path.exists():
            logger.error("Ghostscript did not produce an output for %s", pdf_path)
            return False

        compressed_size = temp_output_path.stat().st_size

        if compressed_size >= original_size:
            temp_output_path.unlink(missing_ok=True)
            return False

        temp_output_path.replace(pdf_path)
        logger.info(
            "Compressed %s from %.2f MB to %.2f MB",
            pdf_path.name,
            original_size / (1024 * 1024),
            compressed_size / (1024 * 1024),
        )
        return True
