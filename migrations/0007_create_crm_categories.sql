-- Create CRM categories table
CREATE TABLE IF NOT EXISTS crm_categories (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(20) NOT NULL DEFAULT 'blue', -- predeterminado, naranja, gris, marrón, amarillo, verde, azul, morado, rosa, rojo
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, name)
);

CREATE INDEX IF NOT EXISTS idx_crm_categories_company ON crm_categories(company_id);
