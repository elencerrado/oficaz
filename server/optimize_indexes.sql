
-- Add more specific performance indexes
CREATE INDEX IF NOT EXISTS idx_work_sessions_company_recent 
ON work_sessions(created_at DESC)
WHERE created_at > NOW() - INTERVAL '30 days';

-- Add covering index for common query pattern
CREATE INDEX IF NOT EXISTS idx_users_company_name_active
ON users(company_id, full_name)
WHERE is_active = true;

