-- Add vacation cutoff day to companies (defaults to 01-31)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS vacation_cutoff_day TEXT NOT NULL DEFAULT '01-31';
