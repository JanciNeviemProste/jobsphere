-- PR2: HR manual override on MatchScore (additive, nullable)
ALTER TABLE "MatchScore" ADD COLUMN "overrideScore" INTEGER;
ALTER TABLE "MatchScore" ADD COLUMN "overrideBy" TEXT;
ALTER TABLE "MatchScore" ADD COLUMN "overrideAt" TIMESTAMP(3);
ALTER TABLE "MatchScore" ADD COLUMN "overrideReason" TEXT;

-- Kanban 4-column remap (L26): collapse legacy stages into the new 4-column model
-- Columns: NEW · INTERVIEW · SCREENING · (HIRED+REJECTED). PHONE_SCREEN→SCREENING, OFFER→INTERVIEW.
UPDATE "Application" SET "stage" = 'SCREENING' WHERE "stage" = 'PHONE_SCREEN';
UPDATE "Application" SET "stage" = 'INTERVIEW' WHERE "stage" = 'OFFER';
