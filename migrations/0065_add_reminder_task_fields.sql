ALTER TABLE reminders
  ADD COLUMN IF NOT EXISTS task_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS context_type text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS context_name text,
  ADD COLUMN IF NOT EXISTS responsible_user_id integer REFERENCES users(id);

UPDATE reminders
SET responsible_user_id = user_id
WHERE responsible_user_id IS NULL;

CREATE INDEX IF NOT EXISTS reminders_company_task_status_idx
  ON reminders(company_id, task_status);

CREATE INDEX IF NOT EXISTS reminders_company_responsible_user_idx
  ON reminders(company_id, responsible_user_id);

CREATE INDEX IF NOT EXISTS reminders_company_context_name_idx
  ON reminders(company_id, context_name);
