-- Add work schedules management system
-- Horarios globales de la empresa y detección de patrones de empleados

-- 1. Create company_work_schedules table for global work hours
CREATE TABLE IF NOT EXISTS company_work_schedules (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday, 1=Monday...6=Saturday
  expected_entry_time TIME NOT NULL, -- e.g., 09:00
  expected_exit_time TIME NOT NULL, -- e.g., 18:00
  is_working_day BOOLEAN NOT NULL DEFAULT true,
  tolerance_minutes INTEGER NOT NULL DEFAULT 15, -- Tolerance for late entry (minutes)
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, day_of_week)
);

CREATE INDEX idx_company_work_schedules_company_id ON company_work_schedules(company_id);

-- 2. Add detected_work_pattern to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS detected_work_pattern JSONB;
-- Format: {
--   "0": { "entry": 9.25, "exit": 18.33, "frequency": 0 },  -- Sunday (frequency=0 means doesn't work)
--   "1": { "entry": 9.25, "exit": 18.33, "frequency": 20 }, -- Monday (frequency=count of days worked)
--   ...
--   "6": { "entry": null, "exit": null, "frequency": 0 }     -- Saturday
--   "last_updated": "2024-01-30T10:00:00Z",
--   "reliability": 0.95,  -- 0-1 score based on consistency
--   "analysis_days": 30   -- Number of days analyzed
-- }

ALTER TABLE users ADD COLUMN IF NOT EXISTS pattern_detection_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_pattern_analysis TIMESTAMP;

-- 3. Add index for efficient pattern queries
CREATE INDEX IF NOT EXISTS idx_users_pattern_detection ON users(company_id, pattern_detection_enabled) WHERE pattern_detection_enabled = true;
