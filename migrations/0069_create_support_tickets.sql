CREATE TABLE IF NOT EXISTS support_tickets (
  id SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  company_name VARCHAR(255),
  user_name VARCHAR(255) NOT NULL,
  user_email VARCHAR(255) NOT NULL,
  subject VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  source VARCHAR(50) NOT NULL DEFAULT 'app_feedback',
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  resolved_at TIMESTAMP,
  resolved_by VARCHAR(255),
  resolution_comment TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT support_tickets_status_check CHECK (status IN ('open', 'resolved'))
);

CREATE INDEX IF NOT EXISTS support_tickets_status_created_idx
  ON support_tickets (status, created_at DESC);

CREATE INDEX IF NOT EXISTS support_tickets_company_created_idx
  ON support_tickets (company_id, created_at DESC);
