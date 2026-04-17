-- RenameTable
ALTER TABLE "PageSection" RENAME TO "AboutPage";

-- RenameConstraints
ALTER TABLE "AboutPage" RENAME CONSTRAINT "PageSection_pkey" TO "AboutPage_pkey";
ALTER TABLE "AboutPage" RENAME CONSTRAINT "PageSection_pageId_fkey" TO "AboutPage_pageId_fkey";

-- RenameIndexes
ALTER INDEX "PageSection_pageId_position_idx" RENAME TO "AboutPage_pageId_position_idx";
ALTER INDEX "PageSection_pageId_sectionKey_key" RENAME TO "AboutPage_pageId_sectionKey_key";

