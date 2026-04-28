-- ═══════════════════════════════════════════════════════════════════════════
-- 📊 IMPROVE USAGE STATS: Monthly tracking with year/month instead of ranges
-- ═══════════════════════════════════════════════════════════════════════════

-- Add year and month columns for easier monthly tracking
ALTER TABLE company_usage_stats ADD COLUMN IF NOT EXISTS year INTEGER;
ALTER TABLE company_usage_stats ADD COLUMN IF NOT EXISTS month INTEGER;

-- Populate year/month from existing periodStart if data exists
UPDATE company_usage_stats 
SET 
  year = EXTRACT(YEAR FROM period_start),
  month = EXTRACT(MONTH FROM period_start)
WHERE year IS NULL OR month IS NULL;

-- Make year/month NOT NULL after population
ALTER TABLE company_usage_stats ALTER COLUMN year SET NOT NULL;
ALTER TABLE company_usage_stats ALTER COLUMN month SET NOT NULL;

-- Add month tracking to realtime usage
ALTER TABLE company_realtime_usage ADD COLUMN IF NOT EXISTS current_year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE);
ALTER TABLE company_realtime_usage ADD COLUMN IF NOT EXISTS current_month INTEGER DEFAULT EXTRACT(MONTH FROM CURRENT_DATE);
ALTER TABLE company_realtime_usage ADD COLUMN IF NOT EXISTS r2_storage_bytes BIGINT DEFAULT 0;

-- Update existing rows
UPDATE company_realtime_usage 
SET 
  current_year = EXTRACT(YEAR FROM CURRENT_DATE),
  current_month = EXTRACT(MONTH FROM CURRENT_DATE)
WHERE current_year IS NULL OR current_month IS NULL;

-- Drop old unique constraint (periodStart, periodEnd)
ALTER TABLE company_usage_stats DROP CONSTRAINT IF EXISTS company_usage_stats_unique_period;

-- Add new unique constraint for year/month
ALTER TABLE company_usage_stats ADD CONSTRAINT company_usage_stats_unique_month 
  UNIQUE(company_id, year, month);

-- Add index for faster monthly queries
CREATE INDEX IF NOT EXISTS company_usage_stats_year_month_idx ON company_usage_stats(company_id, year, month);

-- Add comment
COMMENT ON TABLE company_usage_stats IS 'Monthly usage statistics history per company';
COMMENT ON COLUMN company_usage_stats.year IS 'Year of the usage period (e.g., 2026)';
COMMENT ON COLUMN company_usage_stats.month IS 'Month of the usage period (1-12)';
