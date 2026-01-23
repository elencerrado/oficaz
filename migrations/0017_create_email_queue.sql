-- Email Queue System for scalable email notifications
-- Similar to what enterprises like Stripe, SendGrid use

CREATE TABLE IF NOT EXISTS email_queue (
  id SERIAL PRIMARY KEY,
  
  -- Recipient information
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_email VARCHAR(255) NOT NULL,
  to_name VARCHAR(255) NOT NULL,
  
  -- Email content
  subject VARCHAR(500) NOT NULL,
  template_type VARCHAR(100) NOT NULL, -- 'document_signature_required', 'payroll_available', etc.
  template_data JSONB NOT NULL DEFAULT '{}', -- Dynamic data for template rendering
  
  -- Priority and scheduling
  priority INTEGER DEFAULT 5 NOT NULL, -- 1 (highest) to 10 (lowest)
  scheduled_for TIMESTAMP, -- NULL = send immediately
  
  -- Status tracking
  status VARCHAR(50) DEFAULT 'pending' NOT NULL, -- pending, processing, sent, failed, cancelled
  attempts INTEGER DEFAULT 0 NOT NULL,
  max_attempts INTEGER DEFAULT 3 NOT NULL,
  last_attempt_at TIMESTAMP,
  sent_at TIMESTAMP,
  failed_at TIMESTAMP,
  error_message TEXT,
  
  -- Metadata
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL, -- Who triggered this email
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status);
CREATE INDEX IF NOT EXISTS idx_email_queue_scheduled ON email_queue(scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_email_queue_priority ON email_queue(priority, created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_email_queue_user ON email_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_email_queue_company ON email_queue(company_id);
CREATE INDEX IF NOT EXISTS idx_email_queue_created_at ON email_queue(created_at);

-- Document signature tokens for direct email links
-- Short-lived tokens that allow one-time signature access
CREATE TABLE IF NOT EXISTS document_signature_tokens (
  id SERIAL PRIMARY KEY,
  token VARCHAR(64) UNIQUE NOT NULL, -- Cryptographically secure random token
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Token lifecycle
  used BOOLEAN DEFAULT false NOT NULL,
  expires_at TIMESTAMP NOT NULL, -- Typically 7 days from creation
  used_at TIMESTAMP,
  
  -- Security tracking
  created_from_ip VARCHAR(100),
  used_from_ip VARCHAR(100),
  
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_doc_sig_token ON document_signature_tokens(token) WHERE NOT used;
CREATE INDEX IF NOT EXISTS idx_doc_sig_expires ON document_signature_tokens(expires_at) WHERE NOT used;
CREATE INDEX IF NOT EXISTS idx_doc_sig_document ON document_signature_tokens(document_id);
