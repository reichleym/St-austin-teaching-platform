DO $$ BEGIN
  CREATE TYPE "ModuleVisibilityRule" AS ENUM ('ALL_VISIBLE', 'LIMITED_ACCESS');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LessonVisibility" AS ENUM ('VISIBLE', 'HIDDEN');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LessonAttachmentKind" AS ENUM ('FILE', 'PDF', 'VIDEO_LINK');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "CourseModule" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "position" INTEGER NOT NULL DEFAULT 0,
  "releaseAt" TIMESTAMP(3),
  "visibilityRule" "ModuleVisibilityRule" NOT NULL DEFAULT 'ALL_VISIBLE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CourseModule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CourseModule_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Lesson" (
  "id" TEXT NOT NULL,
  "moduleId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT,
  "position" INTEGER NOT NULL DEFAULT 0,
  "visibility" "LessonVisibility" NOT NULL DEFAULT 'VISIBLE',
  "isRequired" BOOLEAN NOT NULL DEFAULT true,
  "embedUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Lesson_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "CourseModule"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "LessonAttachment" (
  "id" TEXT NOT NULL,
  "lessonId" TEXT NOT NULL,
  "kind" "LessonAttachmentKind" NOT NULL DEFAULT 'FILE',
  "label" TEXT,
  "fileName" TEXT,
  "mimeType" TEXT,
  "sizeBytes" INTEGER,
  "storageKey" TEXT,
  "publicUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LessonAttachment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LessonAttachment_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "LessonCompletion" (
  "id" TEXT NOT NULL,
  "lessonId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LessonCompletion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LessonCompletion_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "LessonCompletion_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "CourseModule_courseId_position_idx" ON "CourseModule"("courseId", "position");
CREATE INDEX IF NOT EXISTS "Lesson_moduleId_position_idx" ON "Lesson"("moduleId", "position");
CREATE INDEX IF NOT EXISTS "LessonAttachment_lessonId_kind_idx" ON "LessonAttachment"("lessonId", "kind");
CREATE INDEX IF NOT EXISTS "LessonCompletion_studentId_completedAt_idx" ON "LessonCompletion"("studentId", "completedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "LessonCompletion_lessonId_studentId_key" ON "LessonCompletion"("lessonId", "studentId");
