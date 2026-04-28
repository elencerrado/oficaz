-- Improve CRM search performance for ILIKE '%term%' queries
-- Requires PostgreSQL pg_trgm extension for trigram GIN indexes

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- business_contacts: used by /api/crm/contacts name search
CREATE INDEX IF NOT EXISTS business_contacts_name_trgm_idx
ON business_contacts USING gin (name gin_trgm_ops);

-- projects: used by /api/crm/projects name search
CREATE INDEX IF NOT EXISTS projects_name_trgm_idx
ON projects USING gin (name gin_trgm_ops);
