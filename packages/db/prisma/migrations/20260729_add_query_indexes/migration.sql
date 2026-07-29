-- Query indexes for the public job listing + candidate match-score lookups.
-- Index names below are EXACTLY what `prisma migrate diff` emits for the matching
-- schema.prisma declarations, so this file and `prisma db push` converge on the
-- same objects and neither one fights the other.
--
-- ⚠️ HOW THIS REACHES PRODUCTION (read .github/workflows/deploy.yml, lines 3-12):
-- this repo ships the production schema with `prisma db push`, NOT `migrate deploy`.
-- All five indexes ARE declared in schema.prisma (the GIN ones via Prisma's
-- extended-index syntax `@@index([col(ops: raw("gin_trgm_ops"))], type: Gin)`),
-- so `yarn db:push` alone is enough to create them. This file exists for
-- migration-history parity and for anyone running `migrate deploy` on a fresh DB.
--
-- ⚠️ WHY THERE IS NO `CREATE INDEX CONCURRENTLY` IN THIS FILE:
-- Prisma wraps each migration.sql in a single transaction, and Postgres rejects
-- CREATE INDEX CONCURRENTLY inside a transaction block
-- ("CREATE INDEX CONCURRENTLY cannot run inside a transaction block", SQLSTATE 25001).
-- Every existing index migration here (20260120_add_performance_indexes,
-- 20260120_add_hnsw_vector_indexes, 20260706_add_job_external_dedup) uses plain
-- CREATE INDEX for the same reason; this file follows that convention.
-- A non-concurrent build holds an ACCESS EXCLUSIVE lock on the table for its whole
-- duration — writes to "Job"/"MatchScore"/"Organization" block until it finishes.
-- On the LIVE Neon database run the CONCURRENTLY variants FIRST, by hand:
--   remediation/pgvector-hnsw-runbook.md § Appendix A.
-- They use the identical index names, so the later `yarn db:push` sees them as
-- already present and becomes a no-op for these indexes.

-- CreateIndex
-- GET /api/jobs (apps/web/src/app/api/jobs/route.ts:96-142):
--   WHERE status = 'PUBLISHED' ORDER BY "createdAt" DESC
-- The existing "Job_publishedAt_status_idx" can serve neither half: it sorts on
-- publishedAt, and `status` is its trailing column so it cannot drive the equality
-- filter either. This index turns the filter+sort into one ordered index scan.
CREATE INDEX "Job_status_createdAt_idx" ON "Job"("status", "createdAt");

-- CreateIndex
-- GET /api/candidates/[id]/match-scores (route.ts:93-97):
--   WHERE "candidateId" = $1 AND "jobId" IN (...)
-- candidateId only appears as the TRAILING column of @@unique([jobId, candidateId]),
-- so it is never a leading column and the lookup degrades to a scan of the table.
CREATE INDEX "MatchScore_candidateId_idx" ON "MatchScore"("candidateId");

-- CreateExtension
-- Already listed in the datasource `extensions` block (schema.prisma:9); repeated
-- here so the migration is self-contained on a fresh database.
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateIndex
-- GET /api/jobs builds { title | description | organization.name: { contains: term,
-- mode: 'insensitive' } }, which Prisma emits as ILIKE '%term%'. The leading
-- wildcard makes every btree index unusable; a pg_trgm GIN index is the only
-- structure Postgres can use for that predicate.
CREATE INDEX "Job_title_idx" ON "Job" USING GIN ("title" gin_trgm_ops);
CREATE INDEX "Job_description_idx" ON "Job" USING GIN ("description" gin_trgm_ops);
CREATE INDEX "Organization_name_idx" ON "Organization" USING GIN ("name" gin_trgm_ops);

-- Notes on the trigram indexes:
-- - gin_trgm_ops supports LIKE/ILIKE with leading wildcards and the % similarity
--   operator. Postgres only picks it when the search term yields at least one
--   trigram (>= 3 characters); shorter terms still fall back to a seq scan.
-- - "Job"."description" is long free text, so its GIN index is by far the largest
--   of the three. Build it last and watch storage on the Neon branch.
