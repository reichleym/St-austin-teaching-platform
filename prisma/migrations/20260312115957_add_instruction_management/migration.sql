-- CreateEnum
CREATE TYPE "InstructionThreadStatus" AS ENUM ('OPEN', 'ANSWERED', 'CLOSED');

-- CreateEnum
CREATE TYPE "InstructionThreadContext" AS ENUM ('COURSE', 'MODULE', 'LESSON');

-- DropIndex
DROP INDEX "Announcement_isGlobal_expiresAt_idx";

-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN     "courseId" TEXT,
ADD COLUMN     "hiddenAt" TIMESTAMP(3),
ADD COLUMN     "hiddenById" TEXT,
ADD COLUMN     "isHidden" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "InstructionThread" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "moduleId" TEXT,
    "lessonId" TEXT,
    "context" "InstructionThreadContext" NOT NULL DEFAULT 'COURSE',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "InstructionThreadStatus" NOT NULL DEFAULT 'OPEN',
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstructionThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstructionMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isTeacherReply" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstructionMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InstructionThread_courseId_status_idx" ON "InstructionThread"("courseId", "status");

-- CreateIndex
CREATE INDEX "InstructionThread_courseId_isPinned_idx" ON "InstructionThread"("courseId", "isPinned");

-- CreateIndex
CREATE INDEX "InstructionThread_studentId_createdAt_idx" ON "InstructionThread"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "InstructionThread_moduleId_status_idx" ON "InstructionThread"("moduleId", "status");

-- CreateIndex
CREATE INDEX "InstructionThread_lessonId_status_idx" ON "InstructionThread"("lessonId", "status");

-- CreateIndex
CREATE INDEX "InstructionMessage_threadId_createdAt_idx" ON "InstructionMessage"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "InstructionMessage_authorId_createdAt_idx" ON "InstructionMessage"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "Announcement_isGlobal_isHidden_expiresAt_idx" ON "Announcement"("isGlobal", "isHidden", "expiresAt");

-- CreateIndex
CREATE INDEX "Announcement_courseId_isHidden_idx" ON "Announcement"("courseId", "isHidden");

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_hiddenById_fkey" FOREIGN KEY ("hiddenById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstructionThread" ADD CONSTRAINT "InstructionThread_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstructionThread" ADD CONSTRAINT "InstructionThread_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstructionThread" ADD CONSTRAINT "InstructionThread_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "CourseModule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstructionThread" ADD CONSTRAINT "InstructionThread_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstructionMessage" ADD CONSTRAINT "InstructionMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "InstructionThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstructionMessage" ADD CONSTRAINT "InstructionMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
