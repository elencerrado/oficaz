-- Migration: Add incomplete session weekly reminders table
-- This table tracks weekly email reminders sent to employees with incomplete work sessions

CREATE TABLE IF NOT EXISTS "incomplete_session_weekly_reminders" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "company_id" INTEGER NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "session_count" INTEGER NOT NULL, -- Number of incomplete sessions at time of reminder
  "email_queue_id" INTEGER, -- Reference to email_queue if email was sent
  "sent_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS "incomplete_session_weekly_reminders_user_id_idx" ON "incomplete_session_weekly_reminders" ("user_id");
CREATE INDEX IF NOT EXISTS "incomplete_session_weekly_reminders_company_id_idx" ON "incomplete_session_weekly_reminders" ("company_id");
CREATE INDEX IF NOT EXISTS "incomplete_session_weekly_reminders_sent_at_idx" ON "incomplete_session_weekly_reminders" ("sent_at");

-- Comment to explain the weekly reminder system
COMMENT ON TABLE "incomplete_session_weekly_reminders" IS 'Tracks weekly email reminders sent to employees with incomplete work sessions. Sent every Monday at 9 AM for sessions from the past week.';
