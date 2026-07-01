-- PR3: Branch (company offices) + Interview (scheduling)

CREATE TABLE "Branch" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "street" TEXT,
  "city" TEXT,
  "region" TEXT,
  "country" TEXT,
  "postalCode" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Branch_orgId_deletedAt_idx" ON "Branch"("orgId", "deletedAt");
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "Interview" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "durationMin" INTEGER,
  "location" TEXT,
  "branchId" TEXT,
  "meetingUrl" TEXT,
  "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
  "createdBy" TEXT NOT NULL,
  "invitedUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Interview_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Interview_orgId_scheduledAt_idx" ON "Interview"("orgId", "scheduledAt");
CREATE INDEX "Interview_applicationId_idx" ON "Interview"("applicationId");
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
