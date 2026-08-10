-- Brings the migration history back in line with schema.prisma.
--
-- Schema changes reach production through `db push` (see deploy.yml and the
-- "Modifying Database Schema" section of CLAUDE.md), so production has had these
-- objects for a long time while the migration files never learned about them.
-- Nobody noticed because the CI job that "tests migrations" only checked that
-- they apply to an empty database, not that the result matches the schema.
--
-- The gap was not cosmetic. A database built from the migration history was
-- missing the whole freelancer/gigs feature, Candidate.userId (which the
-- application-ownership check depends on), and User.sessionEpoch — so the app
-- died with P2022 on the first query. That is what disaster recovery, a new
-- environment, or a Neon preview branch would have produced.
--
-- Everything here is written to be idempotent. Production already has these
-- objects and is meant to be reconciled with
--   prisma migrate resolve --applied 20260810_align_migrations_with_schema
-- rather than by running this file — but if someone does run it, it must not
-- explode halfway through and leave the history half-applied.
--
-- Generated from `prisma migrate diff --from-migrations --to-schema-datamodel`,
-- with two deliberate omissions documented at the bottom.

-- Extensions are NOT recreated here. 20250114_complete_schema already creates
-- btree_gin, pg_trgm, vector and uuid-ossp. `migrate diff` proposes them on every
-- run regardless — see expected-drift.sql — so repeating them here would be a
-- no-op that makes this file look like it does more than it does.

-- ------------------------------------------------------------------ Columns
ALTER TABLE "Candidate" ADD COLUMN IF NOT EXISTS "userId" TEXT;

ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "country" TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "viewCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sessionEpoch" INTEGER NOT NULL DEFAULT 0;

-- ------------------------------------------------- Freelancer / gigs feature
CREATE TABLE IF NOT EXISTS "FreelancerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "bio" TEXT,
    "services" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hourlyRate" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "availability" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "location" TEXT,
    "portfolioUrl" TEXT,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FreelancerProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Gig" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "budget" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "durationDays" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Gig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GigProposal" (
    "id" TEXT NOT NULL,
    "gigId" TEXT NOT NULL,
    "freelancerId" TEXT NOT NULL,
    "proposedRate" INTEGER,
    "proposedDurationDays" INTEGER,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GigProposal_pkey" PRIMARY KEY ("id")
);

-- ------------------------------------------------------------------ Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "FreelancerProfile_userId_key" ON "FreelancerProfile"("userId");
CREATE INDEX IF NOT EXISTS "FreelancerProfile_visible_idx" ON "FreelancerProfile"("visible");
CREATE INDEX IF NOT EXISTS "Gig_orgId_status_idx" ON "Gig"("orgId", "status");
CREATE INDEX IF NOT EXISTS "Gig_status_idx" ON "Gig"("status");
CREATE INDEX IF NOT EXISTS "GigProposal_gigId_idx" ON "GigProposal"("gigId");
CREATE INDEX IF NOT EXISTS "GigProposal_freelancerId_idx" ON "GigProposal"("freelancerId");
CREATE UNIQUE INDEX IF NOT EXISTS "GigProposal_gigId_freelancerId_key" ON "GigProposal"("gigId", "freelancerId");
CREATE INDEX IF NOT EXISTS "Application_candidateId_idx" ON "Application"("candidateId");
CREATE INDEX IF NOT EXISTS "Application_orgId_stage_createdAt_idx" ON "Application"("orgId", "stage", "createdAt");
CREATE INDEX IF NOT EXISTS "Candidate_userId_idx" ON "Candidate"("userId");
CREATE INDEX IF NOT EXISTS "Job_status_seniority_idx" ON "Job"("status", "seniority");
CREATE INDEX IF NOT EXISTS "Job_status_remote_idx" ON "Job"("status", "remote");

-- Superseded by Application_orgId_stage_createdAt_idx above: the schema replaced
-- the two-column index with a three-column one, but the migration that created
-- the old one was never followed up.
DROP INDEX IF EXISTS "Application_orgId_createdAt_idx";

-- ------------------------------------------------------------- Foreign keys
-- ADD CONSTRAINT has no IF NOT EXISTS, so each one is guarded by name.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FreelancerProfile_userId_fkey') THEN
    ALTER TABLE "FreelancerProfile" ADD CONSTRAINT "FreelancerProfile_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Gig_orgId_fkey') THEN
    ALTER TABLE "Gig" ADD CONSTRAINT "Gig_orgId_fkey"
      FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Gig_createdBy_fkey') THEN
    ALTER TABLE "Gig" ADD CONSTRAINT "Gig_createdBy_fkey"
      FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GigProposal_gigId_fkey') THEN
    ALTER TABLE "GigProposal" ADD CONSTRAINT "GigProposal_gigId_fkey"
      FOREIGN KEY ("gigId") REFERENCES "Gig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GigProposal_freelancerId_fkey') THEN
    ALTER TABLE "GigProposal" ADD CONSTRAINT "GigProposal_freelancerId_fkey"
      FOREIGN KEY ("freelancerId") REFERENCES "FreelancerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Candidate_userId_fkey') THEN
    ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ConsentRecord_candidateId_fkey') THEN
    ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_candidateId_fkey"
      FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

-- ------------------------------------------------- Deliberately NOT included
-- The generated diff also wanted to drop two HNSW indexes:
--
--   DROP INDEX "job_embedding_hnsw_idx";
--   DROP INDEX "resume_section_embedding_hnsw_idx";
--
-- Not a real drift. Prisma 5.22 cannot express `type: Hnsw` in the schema
-- ("Unknown index type: Hnsw"), so those indexes can only ever exist in a
-- migration and will always look absent to `migrate diff`. Dropping them would
-- undo 20260120_add_hnsw_vector_indexes and take semantic search back to a
-- sequential scan.
--
-- They are therefore the expected residual reported by the drift gate — see
-- packages/db/prisma/expected-drift.sql, which the gate compares against.
