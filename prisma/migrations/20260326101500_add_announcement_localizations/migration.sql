ALTER TABLE "Announcement"
ADD COLUMN "sourceLanguage" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN "translations" JSONB;
