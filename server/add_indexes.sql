
-- Add performance indexes for work sessions queries
CREATE INDEX IF NOT EXISTS idx_work_sessions_company_created 
ON work_sessions(user_id, created_at DESC) 
WHERE user_id IN (SELECT id FROM users);

CREATE INDEX IF NOT EXISTS idx_users_company_id 
ON users(company_id);

CREATE INDEX IF NOT EXISTS idx_break_periods_session 
ON break_periods(work_session_id, break_start);

