-- Create hour-based absences table for tracking absences by hours instead of full days
-- Used for incidents within a single day where employee works partial hours

CREATE TABLE IF NOT EXISTS hour_based_absences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  absence_date TIMESTAMP NOT NULL,
  hours_start NUMERIC(4, 2) NOT NULL,
  hours_end NUMERIC(4, 2) NOT NULL,
  total_hours NUMERIC(5, 2) NOT NULL,
  absence_type TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP,
  admin_comment TEXT,
  attachment_path TEXT,
  auto_approve BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS hour_absences_user_id_idx ON hour_based_absences(user_id);
CREATE INDEX IF NOT EXISTS hour_absences_date_idx ON hour_based_absences(absence_date);
CREATE INDEX IF NOT EXISTS hour_absences_status_idx ON hour_based_absences(status);
CREATE INDEX IF NOT EXISTS hour_absences_user_date_idx ON hour_based_absences(user_id, absence_date);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_hour_absences_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS hour_absences_updated_at_trigger ON hour_based_absences;
CREATE TRIGGER hour_absences_updated_at_trigger
BEFORE UPDATE ON hour_based_absences
FOR EACH ROW
EXECUTE FUNCTION update_hour_absences_timestamp();
