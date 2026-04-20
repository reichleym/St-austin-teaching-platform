-- CreateTable
CREATE TABLE "TuitionPageSection" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "componentType" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TuitionPageSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DonationsPageSection" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "componentType" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DonationsPageSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovernmentEmployeesPageSection" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "componentType" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GovernmentEmployeesPageSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdmissionsPageSection" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "componentType" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdmissionsPageSection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TuitionPageSection_pageId_position_idx" ON "TuitionPageSection"("pageId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "TuitionPageSection_pageId_sectionKey_key" ON "TuitionPageSection"("pageId", "sectionKey");

-- CreateIndex
CREATE INDEX "DonationsPageSection_pageId_position_idx" ON "DonationsPageSection"("pageId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "DonationsPageSection_pageId_sectionKey_key" ON "DonationsPageSection"("pageId", "sectionKey");

-- CreateIndex
CREATE INDEX "GovernmentEmployeesPageSection_pageId_position_idx" ON "GovernmentEmployeesPageSection"("pageId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "GovernmentEmployeesPageSection_pageId_sectionKey_key" ON "GovernmentEmployeesPageSection"("pageId", "sectionKey");

-- CreateIndex
CREATE INDEX "AdmissionsPageSection_pageId_position_idx" ON "AdmissionsPageSection"("pageId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionsPageSection_pageId_sectionKey_key" ON "AdmissionsPageSection"("pageId", "sectionKey");

-- AddForeignKey
ALTER TABLE "TuitionPageSection" ADD CONSTRAINT "TuitionPageSection_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "TuitionPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonationsPageSection" ADD CONSTRAINT "DonationsPageSection_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "DonationsPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernmentEmployeesPageSection" ADD CONSTRAINT "GovernmentEmployeesPageSection_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "GovernmentEmployeesPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionsPageSection" ADD CONSTRAINT "AdmissionsPageSection_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "AdmissionsPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
