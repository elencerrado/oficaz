-- Add recovery_percentage to absence_policies for configurable adverse_weather recovery rate
ALTER TABLE absence_policies ADD COLUMN IF NOT EXISTS recovery_percentage INTEGER DEFAULT 70;

-- Create adverse_weather_incidents table to track weather events and lost hours
CREATE TABLE IF NOT EXISTS adverse_weather_incidents (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  incident_date DATE NOT NULL,
  description TEXT,
  lost_hours DECIMAL(6, 2) NOT NULL,
  recovery_hours DECIMAL(6, 2) NOT NULL,
  recovery_percentage INTEGER DEFAULT 70,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by INTEGER REFERENCES users(id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_adverse_weather_incidents_company_date 
ON adverse_weather_incidents(company_id, incident_date);
