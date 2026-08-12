"""Offline seed script: embeds every article in rag/knowledge_base.py and
upserts it into knowledge_articles. Run manually — the KB doesn't change
per-request, so this isn't part of app startup.

    python -m rag.seed

Requires VOYAGE_API_KEY. Without it, this prints a clear message and exits
rather than crashing — same graceful-degradation posture as everything else
in Phase 5/6.
"""

from __future__ import annotations

import asyncio
import uuid

from dotenv import load_dotenv

load_dotenv()

from db import close_pool, get_pool  # noqa: E402
from embedding_client import EmbeddingClient  # noqa: E402
from rag.knowledge_base import ARTICLES  # noqa: E402
from rag.retriever import to_vector_literal  # noqa: E402


async def seed() -> None:
    embedding_client = EmbeddingClient()
    if not embedding_client.configured:
        print(
            "VOYAGE_API_KEY / GEMINI_API_KEY is not set — skipping KB seed. "
            "Set one of them in apps/ai-service/.env to embed the knowledge base."
        )
        return

    texts = [f"{article.title}\n\n{article.content}" for article in ARTICLES]
    embeddings = await embedding_client.embed_documents(texts)

    pool = await get_pool()
    for article, embedding in zip(ARTICLES, embeddings, strict=True):
        await pool.execute(
            """
            INSERT INTO knowledge_articles (id, slug, title, content, embedding)
            VALUES ($1, $2, $3, $4, $5::vector)
            ON CONFLICT (slug) DO UPDATE SET
                title = EXCLUDED.title,
                content = EXCLUDED.content,
                embedding = EXCLUDED.embedding
            """,
            f"kb-{uuid.uuid4().hex[:12]}",
            article.slug,
            article.title,
            article.content,
            to_vector_literal(embedding),
        )
    print(f"Seeded {len(ARTICLES)} knowledge articles.")
    await close_pool()


if __name__ == "__main__":
    asyncio.run(seed())
