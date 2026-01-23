-- Add ref_code column to accounting_entries table
ALTER TABLE accounting_entries ADD COLUMN IF NOT EXISTS ref_code TEXT;

-- Add index for faster searches by ref_code
CREATE INDEX IF NOT EXISTS accounting_entries_ref_code_idx ON accounting_entries(company_id, ref_code) WHERE ref_code IS NOT NULL;
