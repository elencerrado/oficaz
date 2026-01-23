-- Add company fiscal settings
CREATE TABLE IF NOT EXISTS company_fiscal_settings (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
    taxpayer_type VARCHAR(20) NOT NULL DEFAULT 'autonomo',
    vat_regime VARCHAR(50) DEFAULT 'general',
    vat_proration NUMERIC(5,2) DEFAULT 100 NOT NULL,
    irpf_model130_rate NUMERIC(5,2) NOT NULL DEFAULT 20,
    irpf_manual_withholdings NUMERIC(12,2) NOT NULL DEFAULT 0,
    irpf_previous_payments NUMERIC(12,2) NOT NULL DEFAULT 0,
    irpf_manual_social_security NUMERIC(12,2) NOT NULL DEFAULT 0,
    irpf_other_adjustments NUMERIC(12,2) NOT NULL DEFAULT 0,
    community VARCHAR(100),
    retention_default_rate NUMERIC(5,2),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add IRPF meta fields to accounting entries
ALTER TABLE accounting_entries
    ADD COLUMN IF NOT EXISTS irpf_retention_rate NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS irpf_retention_amount NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS irpf_deductible BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS irpf_is_social_security BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS accounting_entries_irpf_idx ON accounting_entries (company_id, type, status);
