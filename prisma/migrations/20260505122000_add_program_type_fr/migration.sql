-- Add french program type field to programs
ALTER TABLE "Program" ADD COLUMN IF NOT EXISTS "programTypeFr" TEXT;

