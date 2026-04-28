-- Add flexible vacation day calculation mode
-- Supports both natural days and working days calculation

ALTER TABLE companies ADD COLUMN IF NOT EXISTS absence_day_calculation_mode VARCHAR(20) NOT NULL DEFAULT 'natural';
-- "natural" = all calendar days | "working" = weekdays + non-holiday working days only

-- Add index for queries filtering by mode
CREATE INDEX IF NOT EXISTS idx_companies_absence_calculation_mode ON companies(absence_day_calculation_mode);
