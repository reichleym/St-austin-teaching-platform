DO $$ BEGIN
  CREATE TYPE "CourseVisibility" AS ENUM ('DRAFT', 'PUBLISHED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Course"
ADD COLUMN IF NOT EXISTS "visibility" "CourseVisibility" NOT NULL DEFAULT 'DRAFT';
