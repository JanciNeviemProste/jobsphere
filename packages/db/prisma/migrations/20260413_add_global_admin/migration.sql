-- AddColumn: isGlobalAdmin on User
ALTER TABLE "User" ADD COLUMN "isGlobalAdmin" BOOLEAN NOT NULL DEFAULT false;
