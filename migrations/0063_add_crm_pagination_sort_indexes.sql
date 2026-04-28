-- Improve CRM pagination and sorting performance
-- Targets ORDER BY created_at DESC with company-scoped filters

CREATE INDEX IF NOT EXISTS business_contacts_company_created_at_idx
ON business_contacts (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS projects_company_created_at_idx
ON projects (company_id, created_at DESC);
