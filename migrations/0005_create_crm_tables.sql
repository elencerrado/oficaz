CREATE TABLE IF NOT EXISTS business_contacts (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(180) NOT NULL,
  role VARCHAR(20) NOT NULL,
  label VARCHAR(50),
  email VARCHAR(200),
  phone VARCHAR(40),
  tax_id VARCHAR(50),
  city VARCHAR(120),
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT business_contacts_role_check CHECK (role IN ('client','provider'))
);

CREATE INDEX IF NOT EXISTS idx_business_contacts_company_role ON business_contacts(company_id, role);
CREATE INDEX IF NOT EXISTS idx_business_contacts_company_name ON business_contacts(company_id, name);

CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  code VARCHAR(50),
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  stage VARCHAR(30),
  description TEXT,
  start_date DATE,
  due_date DATE,
  budget DECIMAL(12,2),
  progress INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_company ON projects(company_id);
CREATE INDEX IF NOT EXISTS idx_projects_company_status ON projects(company_id, status);

CREATE TABLE IF NOT EXISTS project_contacts (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  contact_id INTEGER NOT NULL REFERENCES business_contacts(id) ON DELETE CASCADE,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT project_contacts_role_check CHECK (role IN ('client','provider'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_contacts_unique ON project_contacts(project_id, contact_id, role);
CREATE INDEX IF NOT EXISTS idx_project_contacts_project ON project_contacts(project_id);
CREATE INDEX IF NOT EXISTS idx_project_contacts_company ON project_contacts(company_id);
