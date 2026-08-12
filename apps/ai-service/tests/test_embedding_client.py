from collections.abc import Sequence

import pytest

from embedding_client import EmbeddingClient


class FakeBackend:
    def __init__(self) -> None:
        self.calls: list[dict[str, object]] = []

    async def embed(self, texts: Sequence[str], *, input_type: str) -> list[list[float]]:
        self.calls.append({"texts": list(texts), "input_type": input_type})
        return [[float(len(t)), 0.0] for t in texts]


async def test_not_configured_without_an_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("VOYAGE_API_KEY", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    client = EmbeddingClient()
    assert client.configured is False

    with pytest.raises(RuntimeError, match="VOYAGE_API_KEY"):
        await client.embed_query("what is an emergency fund")


async def test_embed_documents_delegates_to_the_backend() -> None:
    backend = FakeBackend()
    client = EmbeddingClient(backend=backend)

    result = await client.embed_documents(["hello", "financial glossary"])

    assert result == [[5.0, 0.0], [18.0, 0.0]]
    assert backend.calls == [{"texts": ["hello", "financial glossary"], "input_type": "document"}]


async def test_embed_query_delegates_and_unwraps_a_single_result() -> None:
    backend = FakeBackend()
    client = EmbeddingClient(backend=backend)

    result = await client.embed_query("hi")

    assert result == [2.0, 0.0]
    assert backend.calls == [{"texts": ["hi"], "input_type": "query"}]
