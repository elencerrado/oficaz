-- Performance indexes for high-concurrency clock-ins (1000+ simultaneous users)
CREATE INDEX IF NOT EXISTS "break_periods_user_status_idx" ON "break_periods" USING btree ("user_id","status");
CREATE INDEX IF NOT EXISTS "break_periods_session_idx" ON "break_periods" USING btree ("work_session_id");
CREATE INDEX IF NOT EXISTS "work_sessions_user_status_idx" ON "work_sessions" USING btree ("user_id","status");
CREATE INDEX IF NOT EXISTS "work_sessions_clock_in_idx" ON "work_sessions" USING btree ("clock_in");
CREATE INDEX IF NOT EXISTS "work_sessions_user_clock_in_idx" ON "work_sessions" USING btree ("user_id","clock_in");
