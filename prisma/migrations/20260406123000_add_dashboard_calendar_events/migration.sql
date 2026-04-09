ALTER TABLE "SystemSettings"
ADD COLUMN IF NOT EXISTS "dashboardCalendarEvents" JSONB;
