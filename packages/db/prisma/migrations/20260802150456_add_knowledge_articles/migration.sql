-- Enable pgvector (architecture.md §13.3 — RAG knowledge base, co-located
-- with the main Postgres DB). The pgvector/pgvector image ships the
-- extension; this just activates it in this database.
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "knowledge_articles" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(512),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_articles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_articles_slug_key" ON "knowledge_articles"("slug");

-- Approximate nearest-neighbor index for cosine similarity search
-- (rag/retriever.py). HNSW works fine on an empty/small table, unlike
-- ivfflat which needs data present at build time to cluster well — a good
-- fit for a KB this size (a few dozen curated articles, not millions).
CREATE INDEX "knowledge_articles_embedding_idx" ON "knowledge_articles"
    USING hnsw ("embedding" vector_cosine_ops);
