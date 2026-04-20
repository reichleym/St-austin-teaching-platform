-- CreateTable
CREATE TABLE "StudentExperience" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "componentType" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentExperience_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StudentExperience_pageId_sectionKey_key" ON "StudentExperience"("pageId", "sectionKey");

-- CreateIndex
CREATE INDEX "StudentExperience_pageId_position_idx" ON "StudentExperience"("pageId", "position");

-- AddForeignKey
ALTER TABLE "StudentExperience" ADD CONSTRAINT "StudentExperience_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "DynamicPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
