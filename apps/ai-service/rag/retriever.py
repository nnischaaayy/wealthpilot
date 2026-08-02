"""RAG retriever (architecture.md §13.3) — cosine-similarity search over the
knowledge_articles table via pgvector. Retrieval is for *conceptual*
questions only ("what is an emergency fund") — never a substitute for the
deterministic tools when the question is about the user's own numbers.
"""

from __future__ import annotations

from dataclasses import dataclass

from db import get_pool
from embedding_client import EmbeddingClient


@dataclass
class ArticleMatch:
    slug: str
    title: str
    content: str
    similarity: float  # 1 - cosine distance; higher is more similar


def to_vector_literal(embedding: list[float]) -> str:
    """pgvector's text input format, e.g. "[0.1,0.2,0.3]" — asyncpg has no
    native codec for the `vector` type, so this is passed as a string and
    cast with `::vector` in SQL."""
    return "[" + ",".join(repr(x) for x in embedding) + "]"


async def rag_lookup(
    embedding_client: EmbeddingClient,
    query: str,
    top_k: int = 3,
) -> list[ArticleMatch]:
    if not embedding_client.configured:
        raise RuntimeError("EmbeddingClient is not configured (VOYAGE_API_KEY unset)")

    query_embedding = await embedding_client.embed_query(query)
    vector_literal = to_vector_literal(query_embedding)

    pool = await get_pool()
    rows = await pool.fetch(
        """
        SELECT slug, title, content, 1 - (embedding <=> $1::vector) AS similarity
        FROM knowledge_articles
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> $1::vector
        LIMIT $2
        """,
        vector_literal,
        top_k,
    )
    return [
        ArticleMatch(
            slug=r["slug"], title=r["title"], content=r["content"], similarity=r["similarity"]
        )
        for r in rows
    ]
