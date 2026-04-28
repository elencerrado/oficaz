-- Track effective date and previous mode for absence day calculation
-- Supports "apply to future only" changes without recalculating past requests

ALTER TABLE companies ADD COLUMN IF NOT EXISTS absence_day_calculation_mode_previous VARCHAR(20);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS absence_day_calculation_mode_effective_from TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_companies_absence_calculation_effective_from
  ON companies(absence_day_calculation_mode_effective_from);
