-- ============================================================================
-- Wave 1 backfill — link Candidate.userId to the owning User account.
-- Run this AFTER the schema is synced to the DB (yarn db:push / migrate) so the
-- Candidate.userId column + FKs exist. Idempotent: only fills NULLs / nulls true orphans.
-- Usage:  psql "$DATABASE_URL" -f remediation/wave1_candidate_userId.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- SECTION A — PRE-SYNC CHECK (run BEFORE `yarn db:push`).
-- The new ConsentRecord.candidateId FK fails to create if any ConsentRecord
-- points at a candidateId that no longer exists. Inspect first:
-- ----------------------------------------------------------------------------
--   SELECT cr.id, cr."candidateId"
--   FROM "ConsentRecord" cr
--   LEFT JOIN "Candidate" c ON c.id = cr."candidateId"
--   WHERE cr."candidateId" IS NOT NULL AND c.id IS NULL;
--
-- If that returns rows, null out the orphans so the FK can be created:
--   UPDATE "ConsentRecord" cr
--   SET "candidateId" = NULL
--   WHERE cr."candidateId" IS NOT NULL
--     AND NOT EXISTS (SELECT 1 FROM "Candidate" c WHERE c.id = cr."candidateId");

-- ----------------------------------------------------------------------------
-- SECTION B — BACKFILL (run AFTER the schema is synced).
-- ----------------------------------------------------------------------------
BEGIN;

-- Link each Candidate to the User whose email matches the candidate's PRIMARY
-- contact email (case-insensitive). User.email is unique, so at most one match.
-- Recruiter-imported candidates with no matching user legitimately stay NULL.
UPDATE "Candidate" c
SET "userId" = u.id
FROM "CandidateContact" cc
JOIN "User" u ON lower(u.email) = lower(cc.email)
WHERE cc."candidateId" = c.id
  AND cc."isPrimary" = true
  AND cc.email IS NOT NULL
  AND c."userId" IS NULL;

COMMIT;

-- ----------------------------------------------------------------------------
-- SECTION C — VERIFICATION (read-only).
-- ----------------------------------------------------------------------------
-- Linked vs unlinked (unlinked = recruiter-imported candidates, expected > 0):
--   SELECT count(*) FILTER (WHERE "userId" IS NOT NULL) AS linked,
--          count(*) FILTER (WHERE "userId" IS NULL)     AS unlinked
--   FROM "Candidate";
--
-- Sanity sample of linked rows:
--   SELECT c.id, c."userId", u.email
--   FROM "Candidate" c JOIN "User" u ON u.id = c."userId"
--   LIMIT 20;
