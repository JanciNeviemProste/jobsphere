-- Known, explained difference between the migration history and schema.prisma.
--
-- scripts/check-migration-drift.mjs compares the output of
-- `prisma migrate diff --from-migrations --to-schema-datamodel` against this
-- file. Equal (after normalisation) means the only drift left is drift we
-- understand. Anything else fails CI.
--
-- Order matters: the comparison is textual, so these statements must appear in
-- the order Prisma emits them.
--
-- Two reasons a line legitimately belongs here, and no others:
--
-- 1. CREATE EXTENSION — Prisma proposes these on every run. Extensions are not
--    part of the datamodel it compares, so the migration side never "counts" as
--    having them no matter how many times a migration creates them.
--    20250114_complete_schema does create all four.
--
-- 2. The two HNSW indexes — Prisma 5.22 cannot express `type: Hnsw` in a schema
--    index ("Unknown index type: Hnsw"), so the pgvector indexes created by
--    20260120_add_hnsw_vector_indexes exist only in SQL. migrate diff sees them
--    on the database side, not on the schema side, and proposes dropping them
--    forever. Acting on that would put semantic search back on a sequential scan
--    plus a full sort. If Prisma ever gains HNSW support, delete those two
--    entries and express the indexes in the schema instead.
--
-- Adding anything else here is a claim that `db push` and the migration history
-- may legitimately disagree — which is the exact failure this gate exists to
-- catch. Write the migration instead.

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- DropIndex
DROP INDEX "job_embedding_hnsw_idx";

-- DropIndex
DROP INDEX "resume_section_embedding_hnsw_idx";
