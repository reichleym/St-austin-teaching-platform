-- Add program type to programs
ALTER TABLE "Program" ADD COLUMN IF NOT EXISTS "programType" TEXT;

