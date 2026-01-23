-- Add vat_rate column to accounting_entries table for fiscal calculations
-- This field stores the VAT percentage applied (21%, 10%, 4%, 0%)

ALTER TABLE accounting_entries 
ADD COLUMN IF NOT EXISTS vat_rate DECIMAL(5,2);

-- Set default VAT rate to 21% for existing entries that don't have it
UPDATE accounting_entries 
SET vat_rate = 21.00 
WHERE vat_rate IS NULL;

-- Create index for faster fiscal queries
CREATE INDEX IF NOT EXISTS accounting_entries_vat_rate_idx 
ON accounting_entries(company_id, vat_rate, entry_date);

COMMENT ON COLUMN accounting_entries.vat_rate IS 'VAT percentage applied: 21 (general), 10 (reduced), 4 (super-reduced), 0 (exempt)';
