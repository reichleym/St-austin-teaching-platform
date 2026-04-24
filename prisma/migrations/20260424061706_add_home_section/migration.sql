/*
  Warnings:

  - You are about to drop the `AdmissionsPageSection` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `DonationsPageSection` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `GovernmentEmployeesPageSection` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TuitionPageSection` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "AdmissionsPageSection" DROP CONSTRAINT "AdmissionsPageSection_pageId_fkey";

-- DropForeignKey
ALTER TABLE "DonationsPageSection" DROP CONSTRAINT "DonationsPageSection_pageId_fkey";

-- DropForeignKey
ALTER TABLE "GovernmentEmployeesPageSection" DROP CONSTRAINT "GovernmentEmployeesPageSection_pageId_fkey";

-- DropForeignKey
ALTER TABLE "TuitionPageSection" DROP CONSTRAINT "TuitionPageSection_pageId_fkey";

-- DropTable
DROP TABLE "AdmissionsPageSection";

-- DropTable
DROP TABLE "DonationsPageSection";

-- DropTable
DROP TABLE "GovernmentEmployeesPageSection";

-- DropTable
DROP TABLE "TuitionPageSection";

-- CreateTable
CREATE TABLE "HomePage" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "sections" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomePage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeSection" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "componentType" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeSection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HomePage_slug_key" ON "HomePage"("slug");

-- CreateIndex
CREATE INDEX "HomePage_slug_idx" ON "HomePage"("slug");

-- CreateIndex
CREATE INDEX "HomeSection_pageId_position_idx" ON "HomeSection"("pageId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "HomeSection_pageId_sectionKey_key" ON "HomeSection"("pageId", "sectionKey");

-- AddForeignKey
ALTER TABLE "HomeSection" ADD CONSTRAINT "HomeSection_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "DynamicPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
