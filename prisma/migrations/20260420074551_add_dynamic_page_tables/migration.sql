-- CreateTable
CREATE TABLE "TuitionPage" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "sections" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TuitionPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DonationsPage" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "sections" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DonationsPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovernmentEmployeesPage" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "sections" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GovernmentEmployeesPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdmissionsPage" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "sections" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdmissionsPage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TuitionPage_slug_key" ON "TuitionPage"("slug");

-- CreateIndex
CREATE INDEX "TuitionPage_slug_idx" ON "TuitionPage"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "DonationsPage_slug_key" ON "DonationsPage"("slug");

-- CreateIndex
CREATE INDEX "DonationsPage_slug_idx" ON "DonationsPage"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "GovernmentEmployeesPage_slug_key" ON "GovernmentEmployeesPage"("slug");

-- CreateIndex
CREATE INDEX "GovernmentEmployeesPage_slug_idx" ON "GovernmentEmployeesPage"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionsPage_slug_key" ON "AdmissionsPage"("slug");

-- CreateIndex
CREATE INDEX "AdmissionsPage_slug_idx" ON "AdmissionsPage"("slug");
