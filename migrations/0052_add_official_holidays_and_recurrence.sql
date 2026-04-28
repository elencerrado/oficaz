-- Official holidays + recurring custom holidays + company exceptions

ALTER TABLE custom_holidays ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE custom_holidays ADD COLUMN IF NOT EXISTS recurrence_month INTEGER;
ALTER TABLE custom_holidays ADD COLUMN IF NOT EXISTS recurrence_day INTEGER;

CREATE TABLE IF NOT EXISTS official_holidays (
  id SERIAL PRIMARY KEY,
  country_code VARCHAR(2) NOT NULL DEFAULT 'ES',
  region_code VARCHAR(10),
  name TEXT NOT NULL,
  date DATE NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'national',
  source TEXT NOT NULL DEFAULT 'nager',
  year INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS official_holidays_date_idx ON official_holidays(date);
CREATE INDEX IF NOT EXISTS official_holidays_region_idx ON official_holidays(region_code);
CREATE INDEX IF NOT EXISTS official_holidays_year_idx ON official_holidays(year);
CREATE UNIQUE INDEX IF NOT EXISTS official_holidays_unique ON official_holidays(date, region_code, name);

CREATE TABLE IF NOT EXISTS company_holiday_exceptions (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  official_holiday_id INTEGER NOT NULL REFERENCES official_holidays(id) ON DELETE CASCADE,
  is_excluded BOOLEAN NOT NULL DEFAULT true,
  reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS company_holiday_exceptions_company_idx ON company_holiday_exceptions(company_id);
CREATE INDEX IF NOT EXISTS company_holiday_exceptions_holiday_idx ON company_holiday_exceptions(official_holiday_id);
CREATE UNIQUE INDEX IF NOT EXISTS company_holiday_exceptions_unique ON company_holiday_exceptions(company_id, official_holiday_id);
