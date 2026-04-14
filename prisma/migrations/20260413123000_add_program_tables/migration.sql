-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ProgramVisibility" AS ENUM ('DRAFT', 'PUBLISHED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Program" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "programContent" TEXT,
  "visibility" "ProgramVisibility" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);

-- Ensure compatibility with pre-migration runtime-created table
ALTER TABLE "Program" ADD COLUMN IF NOT EXISTS "programContent" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Program_code_key" ON "Program"("code");

-- CreateTable
CREATE TABLE IF NOT EXISTS "ProgramCourse" (
  "programId" TEXT NOT NULL,
  "courseId" TEXT NOT NULL
);

-- Ensure composite primary key exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ProgramCourse_pkey'
  ) THEN
    ALTER TABLE "ProgramCourse"
    ADD CONSTRAINT "ProgramCourse_pkey" PRIMARY KEY ("programId", "courseId");
  END IF;
END $$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProgramCourse_courseId_idx" ON "ProgramCourse"("courseId");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ProgramCourse_programId_fkey'
  ) THEN
    ALTER TABLE "ProgramCourse"
    ADD CONSTRAINT "ProgramCourse_programId_fkey"
    FOREIGN KEY ("programId") REFERENCES "Program"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ProgramCourse_courseId_fkey'
  ) THEN
    ALTER TABLE "ProgramCourse"
    ADD CONSTRAINT "ProgramCourse_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
