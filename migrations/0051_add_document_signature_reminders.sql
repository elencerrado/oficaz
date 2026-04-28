-- Migration: Add document signature reminders table
-- This table tracks escalating email reminders sent to employees for unsigned documents

CREATE TABLE IF NOT EXISTS "document_signature_reminders" (
  "id" SERIAL PRIMARY KEY,
  "document_id" INTEGER NOT NULL REFERENCES "documents"("id") ON DELETE CASCADE,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "company_id" INTEGER NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "reminder_number" INTEGER NOT NULL, -- 1, 2, 3, 4 (escalating reminders)
  "email_queue_id" INTEGER, -- Reference to email_queue if email was sent
  "sent_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "unique_reminder_per_doc" UNIQUE ("document_id", "user_id", "reminder_number")
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS "document_signature_reminders_document_id_idx" ON "document_signature_reminders" ("document_id");
CREATE INDEX IF NOT EXISTS "document_signature_reminders_user_id_idx" ON "document_signature_reminders" ("user_id");
CREATE INDEX IF NOT EXISTS "document_signature_reminders_company_id_idx" ON "document_signature_reminders" ("company_id");

-- Comment to explain the escalating reminder system
COMMENT ON TABLE "document_signature_reminders" IS 'Tracks escalating email reminders sent to employees for unsigned documents. Reminders: 1=24h, 2=3d, 3=7d, 4=14d after upload.';
