-- Add additional IRPF fields to accounting_entries for more accurate tax calculations
-- These fields allow better control over tax deductions and fiscal adjustments

-- Add field for deduction percentage (some expenses are only partially deductible)
ALTER TABLE "accounting_entries" 
ADD COLUMN IF NOT EXISTS "irpf_deduction_percentage" DECIMAL(5, 2) DEFAULT 100.00;

-- Add field to mark expenses as non-deductible for tax purposes
ALTER TABLE "accounting_entries" 
ADD COLUMN IF NOT EXISTS "irpf_is_amortization" BOOLEAN DEFAULT false NOT NULL;

-- Add field for fiscal adjustments (positive or negative adjustments to the tax base)
ALTER TABLE "accounting_entries" 
ADD COLUMN IF NOT EXISTS "irpf_fiscal_adjustment" DECIMAL(12, 2) DEFAULT 0.00;

-- Add notes for tax purposes
ALTER TABLE "accounting_entries" 
ADD COLUMN IF NOT EXISTS "fiscal_notes" TEXT;

-- Comment on new columns
COMMENT ON COLUMN "accounting_entries"."irpf_deduction_percentage" IS 'Percentage of expense deductible for IRPF (e.g., meals 30%, representation 100%)';
COMMENT ON COLUMN "accounting_entries"."irpf_is_amortization" IS 'Mark if this entry is an amortization/depreciation expense';
COMMENT ON COLUMN "accounting_entries"."irpf_fiscal_adjustment" IS 'Positive or negative fiscal adjustment to apply to tax base';
COMMENT ON COLUMN "accounting_entries"."fiscal_notes" IS 'Notes about fiscal treatment of this entry';
