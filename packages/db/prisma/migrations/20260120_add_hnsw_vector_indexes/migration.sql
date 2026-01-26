-- HNSW Vector Indexes for Semantic Search Optimization
-- HNSW (Hierarchical Navigable Small World) provides fast approximate nearest neighbor search
-- Uses cosine distance for text embeddings (OpenAI, Anthropic models)

-- Job embeddings for semantic job search
-- embedding is vector(1536) - OpenAI ada-002 or similar
CREATE INDEX IF NOT EXISTS "job_embedding_hnsw_idx"
ON "Job" USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- ResumeSection embeddings for CV semantic search
-- embeddingVector is variable-length vector
CREATE INDEX IF NOT EXISTS "resume_section_embedding_hnsw_idx"
ON "ResumeSection" USING hnsw ("embeddingVector" vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- HNSW parameters:
-- m = 16: Maximum connections per layer (default, good balance)
-- ef_construction = 64: Dynamic candidate list size during index build (default)
--
-- Performance characteristics:
-- - Index build: O(n log n) time, but can be slow for large datasets
-- - Query: O(log n) time with high recall (>95% typical)
-- - Memory: ~16 * m * n bytes (approx 512 bytes per vector with m=16)
--
-- Search performance tuning (runtime):
-- SET hnsw.ef_search = 100; -- Default 40, higher = better recall but slower
--
-- For queries like:
-- SELECT * FROM "Job" ORDER BY embedding <=> '[...]' LIMIT 10;
-- The index will use cosine distance operator <=>
