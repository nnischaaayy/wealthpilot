"""Model-agnostic embedding wrapper (architecture.md §13.3, §13.4) — same
pattern as llm_client.py: rag/ depends only on this interface, tests inject
a fake instead of hitting the network.

Talks to Voyage AI's REST API directly over httpx (already a dependency for
the Anthropic SDK) rather than pulling in the official `voyageai` SDK, which
drags in numpy/tokenizers/langchain — far more than embedding a few dozen
short KB articles needs.
"""

from __future__ import annotations

import os
from collections.abc import Sequence
from typing import Protocol

import httpx

DEFAULT_MODEL = "voyage-3-lite"
EMBEDDING_DIM = 512  # must match the `vector(512)` column in knowledge_articles


class EmbeddingBackend(Protocol):
    async def embed(self, texts: Sequence[str], *, input_type: str) -> list[list[float]]: ...


class VoyageBackend:
    def __init__(self, api_key: str, model: str = DEFAULT_MODEL) -> None:
        self._api_key = api_key
        self._model = model

    async def embed(self, texts: Sequence[str], *, input_type: str) -> list[list[float]]:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.voyageai.com/v1/embeddings",
                headers={"Authorization": f"Bearer {self._api_key}"},
                json={"input": list(texts), "model": self._model, "input_type": input_type},
            )
            response.raise_for_status()
            data = response.json()
            return [item["embedding"] for item in data["data"]]


class EmbeddingClient:
    def __init__(self, backend: EmbeddingBackend | None = None) -> None:
        self._backend = backend if backend is not None else _make_default_backend()

    @property
    def configured(self) -> bool:
        return self._backend is not None

    async def embed_documents(self, texts: Sequence[str]) -> list[list[float]]:
        if self._backend is None:
            raise RuntimeError(_NOT_CONFIGURED)
        return await self._backend.embed(texts, input_type="document")

    async def embed_query(self, text: str) -> list[float]:
        if self._backend is None:
            raise RuntimeError(_NOT_CONFIGURED)
        [embedding] = await self._backend.embed([text], input_type="query")
        return embedding


_NOT_CONFIGURED = "EmbeddingClient is not configured (VOYAGE_API_KEY or GEMINI_API_KEY unset)"


def _make_default_backend() -> EmbeddingBackend | None:
    # Voyage takes priority when both are configured — Gemini is a
    # free-tier fallback, not a replacement.
    voyage_key = os.environ.get("VOYAGE_API_KEY")
    if voyage_key:
        return VoyageBackend(api_key=voyage_key)

    gemini_key = os.environ.get("GEMINI_API_KEY")
    if gemini_key:
        from gemini_embedding_backend import GeminiEmbeddingBackend

        return GeminiEmbeddingBackend(api_key=gemini_key)

    return None
