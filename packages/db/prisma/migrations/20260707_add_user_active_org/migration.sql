-- PR7: dual-role active-org context for the session switcher (additive, nullable)
ALTER TABLE "User" ADD COLUMN "activeOrgId" TEXT;
