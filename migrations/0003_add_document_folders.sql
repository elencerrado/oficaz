-- Add document folders table for organizing accounting and other documents
CREATE TABLE IF NOT EXISTS document_folders (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_id INTEGER REFERENCES document_folders(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Add indexes for faster folder queries
CREATE INDEX IF NOT EXISTS document_folders_company_id_idx ON document_folders(company_id);
CREATE INDEX IF NOT EXISTS document_folders_parent_id_idx ON document_folders(parent_id);
CREATE INDEX IF NOT EXISTS document_folders_path_idx ON document_folders(company_id, path);

-- Add folder organization columns to documents table
ALTER TABLE documents ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS folder_id INTEGER REFERENCES document_folders(id) ON DELETE SET NULL;

-- Add indexes for documents table
CREATE INDEX IF NOT EXISTS documents_company_id_idx ON documents(company_id);
CREATE INDEX IF NOT EXISTS documents_folder_id_idx ON documents(folder_id);
