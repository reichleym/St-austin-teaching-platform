BEGIN;

ALTER TABLE "Program" ADD COLUMN IF NOT EXISTS "degreeLevel" TEXT;
ALTER TABLE "Program" ADD COLUMN IF NOT EXISTS "fieldOfStudy" TEXT;

-- Copy existing metadata from any linked course to the program (pick first matching course per program)
WITH first_course AS (
  SELECT DISTINCT ON (pc."programId") pc."programId" AS pid, c."degreeLevel", c."fieldOfStudy"
  FROM "ProgramCourse" pc
  JOIN "Course" c ON c."id" = pc."courseId"
  WHERE c."degreeLevel" IS NOT NULL OR c."fieldOfStudy" IS NOT NULL
  ORDER BY pc."programId", c."createdAt" DESC NULLS LAST
)
UPDATE "Program" p
SET "degreeLevel" = fc."degreeLevel",
    "fieldOfStudy" = fc."fieldOfStudy"
FROM first_course fc
WHERE p."id" = fc.pid;

-- Remove duplicate columns from Course
ALTER TABLE "Course" DROP COLUMN IF EXISTS "degreeLevel";
ALTER TABLE "Course" DROP COLUMN IF EXISTS "fieldOfStudy";

COMMIT;
