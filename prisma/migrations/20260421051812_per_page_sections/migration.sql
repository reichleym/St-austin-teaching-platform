-- Introduce per-page section tables that mirror AboutPage/StudentExperience,
-- but attach sections to the generic DynamicPage record.

-- CreateTable
CREATE TABLE "DonationsSection" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "componentType" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DonationsSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdmissionsSection" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "componentType" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdmissionsSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TuitionSection" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "componentType" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TuitionSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovernmentEmployeesSection" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "componentType" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GovernmentEmployeesSection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DonationsSection_pageId_sectionKey_key" ON "DonationsSection"("pageId", "sectionKey");

-- CreateIndex
CREATE INDEX "DonationsSection_pageId_position_idx" ON "DonationsSection"("pageId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionsSection_pageId_sectionKey_key" ON "AdmissionsSection"("pageId", "sectionKey");

-- CreateIndex
CREATE INDEX "AdmissionsSection_pageId_position_idx" ON "AdmissionsSection"("pageId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "TuitionSection_pageId_sectionKey_key" ON "TuitionSection"("pageId", "sectionKey");

-- CreateIndex
CREATE INDEX "TuitionSection_pageId_position_idx" ON "TuitionSection"("pageId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "GovernmentEmployeesSection_pageId_sectionKey_key" ON "GovernmentEmployeesSection"("pageId", "sectionKey");

-- CreateIndex
CREATE INDEX "GovernmentEmployeesSection_pageId_position_idx" ON "GovernmentEmployeesSection"("pageId", "position");

-- AddForeignKey
ALTER TABLE "DonationsSection" ADD CONSTRAINT "DonationsSection_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "DynamicPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionsSection" ADD CONSTRAINT "AdmissionsSection_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "DynamicPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TuitionSection" ADD CONSTRAINT "TuitionSection_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "DynamicPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernmentEmployeesSection" ADD CONSTRAINT "GovernmentEmployeesSection_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "DynamicPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
