-- Records why an application was rejected, and when.
--
-- Rejection was previously nothing but `stage = 'REJECTED'`. There was nowhere to
-- put the reason, so a recruiter reopening a file months later had none, and a
-- candidate asking for feedback could not be answered from the record.
--
-- Idempotent, like every migration in this repo since the history was realigned:
-- production takes schema through `db push`, so a column may already exist by the
-- time this runs.
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP(3);
