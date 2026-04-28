-- Improve CRM contacts listing when filtering by role (client/provider)
-- Optimizes WHERE company_id = ? AND role = ? ORDER BY created_at DESC

CREATE INDEX IF NOT EXISTS business_contacts_company_role_created_at_idx
ON business_contacts (company_id, role, created_at DESC);
