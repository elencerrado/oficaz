-- Add retention fields to accounting_entries for 111/115 handling
ALTER TABLE public.accounting_entries
  ADD COLUMN IF NOT EXISTS retention_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS retention_applied_by_us BOOLEAN NOT NULL DEFAULT false;

-- Extend company_fiscal_settings with default retention rates and auto-apply toggle
ALTER TABLE public.company_fiscal_settings
  ADD COLUMN IF NOT EXISTS professional_retention_rate NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS new_professional_retention_rate NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS rent_retention_rate NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS auto_apply_retention_defaults BOOLEAN NOT NULL DEFAULT false;
