-- PR4: optional screening/assessment gating on a job (additive)
ALTER TABLE "Job" ADD COLUMN "requiresAssessment" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Job" ADD COLUMN "assessmentId" TEXT;
ALTER TABLE "Job" ADD COLUMN "screeningQuestions" JSONB;
