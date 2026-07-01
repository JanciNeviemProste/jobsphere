-- PR6: scraper import provenance + dedup (additive). NULLs are distinct in Postgres,
-- so normal (non-scraped) jobs with both columns NULL never collide.
ALTER TABLE "Job" ADD COLUMN "externalSource" TEXT;
ALTER TABLE "Job" ADD COLUMN "externalId" TEXT;
CREATE UNIQUE INDEX "Job_externalSource_externalId_key" ON "Job"("externalSource", "externalId");
