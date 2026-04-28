-- Create table to track accumulated adverse weather recovery hours per user per period
CREATE TABLE IF NOT EXISTS adverse_weather_hours_pool (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_hours DECIMAL(6, 2) NOT NULL DEFAULT 0,
  used_hours DECIMAL(6, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, period_start, period_end)
);

-- Add columns to adverse_weather_incident to track lost hours and recovery hours
ALTER TABLE adverse_weather_incident 
ADD COLUMN IF NOT EXISTS lost_hours DECIMAL(6, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS recovery_hours DECIMAL(6, 2) DEFAULT 0;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_adverse_weather_hours_pool_user_period 
ON adverse_weather_hours_pool(user_id, period_start, period_end);
