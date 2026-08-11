-- Tags, tasks and email templates.
--
-- Three things a recruiting tool is expected to have and this one did not:
--
--  * Tag / CandidateTag — Candidate.tags is a String[] written nowhere and read
--    once. Free-form strings cannot be renamed, listed, or spelled consistently
--    by two people, so they are not a vocabulary. The old column is left in place
--    rather than dropped: it holds whatever anyone ever put there, and a
--    migration is not the place to decide it is worthless.
--  * Task — there was no model and no field anywhere to record "call her back on
--    Thursday", so follow-ups lived outside the product and nothing could remind
--    anyone or show a colleague what was outstanding.
--  * EmailTemplate — every message outside a sequence was typed from scratch.
--
-- Idempotent throughout: production takes schema through `db push`, so objects
-- may already exist when this runs. See 20260810_align_migrations_with_schema.

CREATE TABLE IF NOT EXISTS "Tag" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CandidateTag" (
    "candidateId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateTag_pkey" PRIMARY KEY ("candidateId","tagId")
);

CREATE TABLE IF NOT EXISTS "Task" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "assigneeId" TEXT,
    "createdBy" TEXT NOT NULL,
    "applicationId" TEXT,
    "candidateId" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EmailTemplate" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "Tag_orgId_name_key" ON "Tag"("orgId", "name");
CREATE INDEX IF NOT EXISTS "Tag_orgId_idx" ON "Tag"("orgId");
CREATE INDEX IF NOT EXISTS "CandidateTag_tagId_idx" ON "CandidateTag"("tagId");
CREATE INDEX IF NOT EXISTS "Task_orgId_status_dueDate_idx" ON "Task"("orgId", "status", "dueDate");
CREATE INDEX IF NOT EXISTS "Task_assigneeId_status_idx" ON "Task"("assigneeId", "status");
CREATE INDEX IF NOT EXISTS "Task_applicationId_idx" ON "Task"("applicationId");
CREATE UNIQUE INDEX IF NOT EXISTS "EmailTemplate_orgId_name_key" ON "EmailTemplate"("orgId", "name");
CREATE INDEX IF NOT EXISTS "EmailTemplate_orgId_category_idx" ON "EmailTemplate"("orgId", "category");
CREATE INDEX IF NOT EXISTS "EmailTemplate_deletedAt_idx" ON "EmailTemplate"("deletedAt");

-- Foreign keys. ADD CONSTRAINT has no IF NOT EXISTS, so each is guarded by name.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Tag_orgId_fkey') THEN
    ALTER TABLE "Tag" ADD CONSTRAINT "Tag_orgId_fkey"
      FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CandidateTag_candidateId_fkey') THEN
    ALTER TABLE "CandidateTag" ADD CONSTRAINT "CandidateTag_candidateId_fkey"
      FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CandidateTag_tagId_fkey') THEN
    ALTER TABLE "CandidateTag" ADD CONSTRAINT "CandidateTag_tagId_fkey"
      FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Task_orgId_fkey') THEN
    ALTER TABLE "Task" ADD CONSTRAINT "Task_orgId_fkey"
      FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Task_assigneeId_fkey') THEN
    ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey"
      FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Task_createdBy_fkey') THEN
    ALTER TABLE "Task" ADD CONSTRAINT "Task_createdBy_fkey"
      FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Task_applicationId_fkey') THEN
    ALTER TABLE "Task" ADD CONSTRAINT "Task_applicationId_fkey"
      FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Task_candidateId_fkey') THEN
    ALTER TABLE "Task" ADD CONSTRAINT "Task_candidateId_fkey"
      FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EmailTemplate_orgId_fkey') THEN
    ALTER TABLE "EmailTemplate" ADD CONSTRAINT "EmailTemplate_orgId_fkey"
      FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
