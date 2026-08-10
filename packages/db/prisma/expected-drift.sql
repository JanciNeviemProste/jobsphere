-- Known, explained difference between the migration history and schema.prisma.
--
-- scripts/check-migration-drift.mjs compares the output of
-- `prisma migrate diff --from-migrations --to-schema-datamodel` against this
-- file. Byte-identical (after normalisation) means the only drift left is the
-- drift we understand. Anything else fails CI.
--
-- Why these two can never be resolved: Prisma 5.22 does not understand
-- `type: Hnsw` in a schema index ("Unknown index type: Hnsw"), so the pgvector
-- HNSW indexes created by 20260120_add_hnsw_vector_indexes exist only in SQL.
-- `migrate diff` therefore sees them in the database side and not in the schema
-- side, and proposes dropping them, forever. Acting on that would take semantic
-- search back to a sequential scan plus a full sort.
--
-- If Prisma gains HNSW support, delete this file and the allowance in the script.
-- Do not add anything else here to make CI green: a new line in this file is a
-- claim that `db push` and the migration history may legitimately disagree, and
-- that claim needs to be true.

-- DropIndex
DROP INDEX "job_embedding_hnsw_idx";

-- DropIndex
DROP INDEX "resume_section_embedding_hnsw_idx";
