-- Migration 0040: Add Company Usage Tracking
-- Track resource consumption per company for cost analysis

-- 1. Create company_usage_stats table
CREATE TABLE IF NOT EXISTS company_usage_stats (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  
  -- Storage metrics
  r2_storage_bytes BIGINT DEFAULT 0, -- Total bytes in R2
  r2_storage_cost DECIMAL(10, 4) DEFAULT 0.00, -- Estimated cost
  db_storage_bytes BIGINT DEFAULT 0, -- Database size
  db_storage_cost DECIMAL(10, 4) DEFAULT 0.00, -- Estimated cost
  
  -- API metrics
  api_requests_count INTEGER DEFAULT 0,
  api_compute_time_ms BIGINT DEFAULT 0, -- Total compute time
  api_compute_cost DECIMAL(10, 4) DEFAULT 0.00,
  
  -- AI metrics
  ai_tokens_used INTEGER DEFAULT 0, -- Total tokens (prompt + completion)
  ai_requests_count INTEGER DEFAULT 0,
  ai_cost DECIMAL(10, 4) DEFAULT 0.00,
  
  -- Totals
  total_cost DECIMAL(10, 4) DEFAULT 0.00,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Unique constraint for period per company
  UNIQUE(company_id, period_start, period_end)
);

-- 2. Create indexes
CREATE INDEX IF NOT EXISTS company_usage_stats_company_idx ON company_usage_stats(company_id);
CREATE INDEX IF NOT EXISTS company_usage_stats_period_idx ON company_usage_stats(period_start, period_end);

-- 3. Create realtime tracking table (current month)
CREATE TABLE IF NOT EXISTS company_realtime_usage (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Current month metrics (reset monthly)
  api_requests_count INTEGER DEFAULT 0,
  api_compute_time_ms BIGINT DEFAULT 0,
  ai_tokens_used INTEGER DEFAULT 0,
  ai_requests_count INTEGER DEFAULT 0,
  
  -- Last calculation timestamps
  last_storage_check TIMESTAMP,
  last_cost_calculation TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(company_id)
);

-- 4. Create indexes for realtime table
CREATE INDEX IF NOT EXISTS company_realtime_usage_company_idx ON company_realtime_usage(company_id);

-- 5. Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_company_usage_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER company_usage_stats_updated_at
  BEFORE UPDATE ON company_usage_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_company_usage_updated_at();

CREATE TRIGGER company_realtime_usage_updated_at
  BEFORE UPDATE ON company_realtime_usage
  FOR EACH ROW
  EXECUTE FUNCTION update_company_usage_updated_at();

-- 6. Insert initial rows for existing companies
INSERT INTO company_realtime_usage (company_id)
SELECT id FROM companies
ON CONFLICT (company_id) DO NOTHING;
