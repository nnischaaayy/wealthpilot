"""Real Gemini-backed implementation of embedding_client.EmbeddingBackend.

Imported lazily by embedding_client._make_default_backend() only when
GEMINI_API_KEY is set (and VOYAGE_API_KEY isn't) — same reasoning as
gemini_backend.py. Pins output_dimensionality to EMBEDDING_DIM so vectors
still match the `vector(512)` column in knowledge_articles regardless of
which provider is configured.
"""

from __future__ import annotations

from collections.abc import Sequence

import httpx

from embedding_client import EMBEDDING_DIM

_API_BASE = "https://generativelanguage.googleapis.com/v1beta"
DEFAULT_MODEL = "gemini-embedding-001"

_TASK_TYPES = {"document": "RETRIEVAL_DOCUMENT", "query": "RETRIEVAL_QUERY"}


class GeminiEmbeddingBackend:
    def __init__(self, api_key: str, model: str = DEFAULT_MODEL) -> None:
        self._api_key = api_key
        self._model = model

    async def embed(self, texts: Sequence[str], *, input_type: str) -> list[list[float]]:
        requests = [
            {
                "model": f"models/{self._model}",
                "content": {"parts": [{"text": text}]},
                "task_type": _TASK_TYPES[input_type],
                "output_dimensionality": EMBEDDING_DIM,
            }
            for text in texts
        ]
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{_API_BASE}/models/{self._model}:batchEmbedContents",
                params={"key": self._api_key},
                json={"requests": requests},
            )
            response.raise_for_status()
            return [item["values"] for item in response.json()["embeddings"]]
