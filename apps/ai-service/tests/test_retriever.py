import uuid
from collections.abc import Sequence

import pytest

from db import close_pool, get_pool
from embedding_client import EmbeddingClient
from rag.retriever import rag_lookup, to_vector_literal

DIM = 512


def _vector(*nonzero: tuple[int, float]) -> list[float]:
    v = [0.0] * DIM
    for index, value in nonzero:
        v[index] = value
    return v


class FixedQueryBackend:
    """Always returns the same pre-set vector for a query, regardless of text —
    lets the test control similarity ranking deterministically."""

    def __init__(self, query_vector: list[float]) -> None:
        self._query_vector = query_vector

    async def embed(self, texts: Sequence[str], *, input_type: str) -> list[list[float]]:
        return [self._query_vector for _ in texts]


def _id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


async def _seed_article(slug: str, title: str, content: str, embedding: list[float]) -> None:
    pool = await get_pool()
    await pool.execute(
        """
        INSERT INTO knowledge_articles (id, slug, title, content, embedding)
        VALUES ($1, $2, $3, $4, $5::vector)
        """,
        _id("kb"),
        slug,
        title,
        content,
        to_vector_literal(embedding),
    )


async def _cleanup(*slugs: str) -> None:
    pool = await get_pool()
    await pool.execute("DELETE FROM knowledge_articles WHERE slug = ANY($1::text[])", list(slugs))


@pytest.fixture(autouse=True)
async def _fresh_pool_per_test():
    yield
    await close_pool()


async def test_raises_when_not_configured(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("VOYAGE_API_KEY", raising=False)
    client = EmbeddingClient()

    with pytest.raises(RuntimeError, match="VOYAGE_API_KEY"):
        await rag_lookup(client, "what is an emergency fund")


async def test_ranks_by_cosine_similarity_closest_first() -> None:
    slugs = [
        f"test-exact-{uuid.uuid4().hex[:8]}",
        f"test-close-{uuid.uuid4().hex[:8]}",
        f"test-far-{uuid.uuid4().hex[:8]}",
    ]
    exact, close, far = slugs
    try:
        await _seed_article(exact, "Exact match", "content a", _vector((0, 1.0)))
        await _seed_article(close, "Close match", "content b", _vector((0, 0.9), (1, 0.1)))
        await _seed_article(far, "Far match", "content c", _vector((1, 1.0)))

        client = EmbeddingClient(backend=FixedQueryBackend(_vector((0, 1.0))))
        results = await rag_lookup(client, "irrelevant query text", top_k=3)

        matched_slugs = [r.slug for r in results if r.slug in slugs]
        assert matched_slugs == [exact, close, far]
        assert results[0].similarity > results[1].similarity
    finally:
        await _cleanup(*slugs)


async def test_respects_top_k() -> None:
    slugs = [f"test-topk-{i}-{uuid.uuid4().hex[:8]}" for i in range(5)]
    try:
        for i, slug in enumerate(slugs):
            await _seed_article(slug, f"Article {i}", "content", _vector((0, 1.0 - i * 0.01)))

        client = EmbeddingClient(backend=FixedQueryBackend(_vector((0, 1.0))))
        results = await rag_lookup(client, "query", top_k=2)

        assert len(results) == 2
    finally:
        await _cleanup(*slugs)
