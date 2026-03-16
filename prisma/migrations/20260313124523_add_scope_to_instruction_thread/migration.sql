/*
  Warnings:

  - You are about to drop the column `courseId` on the `Announcement` table. All the data in the column will be lost.
  - You are about to drop the column `hiddenAt` on the `Announcement` table. All the data in the column will be lost.
  - You are about to drop the column `hiddenById` on the `Announcement` table. All the data in the column will be lost.
  - You are about to drop the column `isHidden` on the `Announcement` table. All the data in the column will be lost.
  - You are about to drop the column `body` on the `InstructionThread` table. All the data in the column will be lost.
  - You are about to drop the column `context` on the `InstructionThread` table. All the data in the column will be lost.
  - You are about to drop the column `lessonId` on the `InstructionThread` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `InstructionThread` table. All the data in the column will be lost.
  - Added the required column `subject` to the `InstructionThread` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "InstructionThreadScope" AS ENUM ('COURSE', 'MODULE');

-- DropForeignKey
ALTER TABLE "Announcement" DROP CONSTRAINT "Announcement_courseId_fkey";

-- DropForeignKey
ALTER TABLE "Announcement" DROP CONSTRAINT "Announcement_hiddenById_fkey";

-- DropForeignKey
ALTER TABLE "InstructionThread" DROP CONSTRAINT "InstructionThread_lessonId_fkey";

-- DropIndex
DROP INDEX "Announcement_courseId_isHidden_idx";

-- DropIndex
DROP INDEX "Announcement_isGlobal_isHidden_expiresAt_idx";

-- DropIndex
DROP INDEX "InstructionThread_lessonId_status_idx";

-- AlterTable
ALTER TABLE "Announcement" DROP COLUMN "courseId",
DROP COLUMN "hiddenAt",
DROP COLUMN "hiddenById",
DROP COLUMN "isHidden";

-- AlterTable
ALTER TABLE "InstructionMessage" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parentId" TEXT;

-- AlterTable
ALTER TABLE "InstructionThread" DROP COLUMN "body",
DROP COLUMN "context",
DROP COLUMN "lessonId",
DROP COLUMN "title",
ADD COLUMN     "scope" "InstructionThreadScope" NOT NULL DEFAULT 'COURSE',
ADD COLUMN     "subject" TEXT NOT NULL,
ALTER COLUMN "isPrivate" SET DEFAULT true;

-- DropEnum
DROP TYPE "InstructionThreadContext";

-- CreateIndex
CREATE INDEX "Announcement_isGlobal_expiresAt_idx" ON "Announcement"("isGlobal", "expiresAt");

-- CreateIndex
CREATE INDEX "InstructionMessage_parentId_idx" ON "InstructionMessage"("parentId");

-- AddForeignKey
ALTER TABLE "InstructionMessage" ADD CONSTRAINT "InstructionMessage_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "InstructionMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
