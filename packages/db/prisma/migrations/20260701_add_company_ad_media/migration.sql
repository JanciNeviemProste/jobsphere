-- PR1: company profile video + job ad media (additive, nullable)
ALTER TABLE "Organization" ADD COLUMN "videoUrl" TEXT;
ALTER TABLE "Job" ADD COLUMN "imageUrl" TEXT;
ALTER TABLE "Job" ADD COLUMN "videoUrl" TEXT;
