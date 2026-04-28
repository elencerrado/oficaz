-- Migration: Add adverse weather incident type
-- Add deductFromVacation column to vacation_requests table
-- This allows admin to decide if adverse weather incidents deduct from vacation balance

-- Add new column
ALTER TABLE vacation_requests 
ADD COLUMN deduct_from_vacation BOOLEAN DEFAULT true;

-- Note: The absenceType field already accepts text values, so 'adverse_weather' 
-- can be used without schema changes. Update the comment if needed:
COMMENT ON COLUMN vacation_requests.absence_type IS 'vacation, maternity_paternity, marriage, family_death, family_death_travel, family_illness, family_illness_travel, home_relocation, public_duty, temporary_disability, adverse_weather';
