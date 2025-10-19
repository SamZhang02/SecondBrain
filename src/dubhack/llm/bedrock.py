"""Helpers for invoking DeepSeek (Llama) via Amazon Bedrock."""

from pathlib import Path
from typing import Any, Iterable

import boto3  # pyright: ignore[reportMissingTypeStubs]
from botocore.exceptions import ClientError  # pyright: ignore[reportMissingTypeStubs]

# Create a Bedrock Runtime client in the AWS Region you want to use.
client = boto3.client("bedrock-runtime", region_name="us-east-1")

# Set the model ID, e.g. Llama 3.1 90B Instruct.
model_id = "us.meta.llama3-1-90b-instruct-v1:0"


def _load_document(path: Path) -> dict[Any, Any]:
    """Return a document payload for Bedrock based on file suffix."""

    suffix = path.suffix.lower()
    if suffix not in {".pdf", ".md", ".txt"}:
        raise ValueError(f"Unsupported document format for Bedrock: {path}")

    if suffix == ".pdf":
        data = path.read_bytes()
        fmt = "pdf"
    else:
        # Bedrock expects bytes for text-based formats as well.
        data = path.read_text(encoding="utf-8").encode("utf-8")
        fmt = suffix.lstrip(".")

    return {
        "document": {
            "format": fmt,
            "name": path.name,
            "source": {"bytes": data},
        }
    }


def query_llm(prompt: str, document_paths: Iterable[str]) -> str:
    """Run the DeepSeek model with a prompt and optional documents and return the reply."""

    content = [{"text": prompt}]

    # Attach referenced documents to the user message.
    for doc_path in document_paths:
        document = _load_document(Path(doc_path))
        content.append(document)

    conversation = [{"role": "user", "content": content}]

    try:
        response = client.converse(
            modelId=model_id,
            messages=conversation,
            inferenceConfig={"maxTokens": 500, "temperature": 0.3},
        )
    except (ClientError, Exception) as exc:
        raise RuntimeError(f"ERROR: Can't invoke '{model_id}'. Reason: {exc}") from exc

    return response["output"]["message"]["content"][0]["text"]


def _health_check() -> None:
    """Basic smoke test to confirm Bedrock access."""

    try:
        reply = invoke_deepseek("Hello world", [])
    except RuntimeError as exc:
        print(exc)
        return

    print(reply)


if __name__ == "__main__":
    _health_check()
