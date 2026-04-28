-- Add separate vacation day configuration fields for natural and working days
ALTER TABLE companies ADD COLUMN vacation_days_natural INTEGER DEFAULT 30;
ALTER TABLE companies ADD COLUMN vacation_days_working INTEGER DEFAULT 22;
