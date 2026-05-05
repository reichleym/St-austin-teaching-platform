-- Add program duration fields to programs
ALTER TABLE "Program" ADD COLUMN IF NOT EXISTS "programDuration" TEXT;
ALTER TABLE "Program" ADD COLUMN IF NOT EXISTS "programDurationFr" TEXT;

