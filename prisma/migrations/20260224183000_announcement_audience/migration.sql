CREATE TYPE "AnnouncementAudience" AS ENUM ('BOTH', 'TEACHER_ONLY');

ALTER TABLE "Announcement"
  ADD COLUMN "audience" "AnnouncementAudience" NOT NULL DEFAULT 'BOTH';

CREATE INDEX "Announcement_audience_expiresAt_idx" ON "Announcement"("audience", "expiresAt");
