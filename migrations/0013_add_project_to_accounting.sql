-- Add project_id column to accounting_entries table
-- This allows associating accounting entries with CRM projects

ALTER TABLE accounting_entries
ADD COLUMN project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX accounting_entries_project_idx ON accounting_entries(project_id);
