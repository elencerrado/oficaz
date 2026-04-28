-- Add auto_approve field to vacation_requests table
ALTER TABLE vacation_requests ADD COLUMN IF NOT EXISTS auto_approve BOOLEAN DEFAULT false;
