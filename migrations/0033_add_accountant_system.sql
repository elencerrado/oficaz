-- Migration 0033: Add Accountant/Advisory System
-- Adds support for external accountants to manage multiple companies

-- 1. Create company_accountants table (relation many-to-many)
CREATE TABLE IF NOT EXISTS company_accountants (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  accountant_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  enabled_at TIMESTAMP DEFAULT NOW() NOT NULL,
  disabled_at TIMESTAMP,
  created_by INTEGER REFERENCES users(id),
  notes TEXT,
  UNIQUE(company_id, accountant_user_id)
);

-- 2. Indexes for company_accountants
CREATE INDEX IF NOT EXISTS company_accountants_company_idx ON company_accountants(company_id) WHERE disabled_at IS NULL;
CREATE INDEX IF NOT EXISTS company_accountants_accountant_idx ON company_accountants(accountant_user_id) WHERE disabled_at IS NULL;

-- 3. Add accountant-specific fields to accounting_entries
ALTER TABLE accounting_entries
ADD COLUMN IF NOT EXISTS accountant_reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS accountant_reviewed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS accountant_notes TEXT;

-- 4. Add indexes for new statuses in accounting_entries
CREATE INDEX IF NOT EXISTS accounting_entries_status_submitted_idx ON accounting_entries(company_id, status) WHERE status = 'submitted';
CREATE INDEX IF NOT EXISTS accounting_entries_status_accountant_approved_idx ON accounting_entries(company_id, status) WHERE status = 'accountant_approved';

-- 5. Add company configuration for accountant workflow
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS uses_external_accountant BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN IF NOT EXISTS auto_submit_to_accountant BOOLEAN DEFAULT FALSE NOT NULL;
