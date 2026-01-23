-- ═══════════════════════════════════════════════════════════════════════════
-- ACCOUNTING SYSTEM - Contabilidad
-- Add tables for expense/income tracking and receipt management
-- ═══════════════════════════════════════════════════════════════════════════

-- Expense Categories
CREATE TABLE IF NOT EXISTS expense_categories (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  color VARCHAR(7) DEFAULT '#EF4444',
  icon VARCHAR(50) DEFAULT 'Receipt',
  is_active BOOLEAN DEFAULT true NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS expense_categories_company_idx ON expense_categories(company_id);

-- Income Categories
CREATE TABLE IF NOT EXISTS income_categories (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  color VARCHAR(7) DEFAULT '#10B981',
  icon VARCHAR(50) DEFAULT 'TrendingUp',
  is_active BOOLEAN DEFAULT true NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS income_categories_company_idx ON income_categories(company_id);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES expense_categories(id) ON DELETE SET NULL,
  submitted_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  employee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  
  concept VARCHAR(200) NOT NULL,
  description TEXT,
  amount DECIMAL(10, 2) NOT NULL,
  vat_amount DECIMAL(10, 2) DEFAULT 0.00 NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'EUR' NOT NULL,
  
  expense_date DATE NOT NULL,
  
  payment_method VARCHAR(50),
  invoice_number VARCHAR(50),
  supplier VARCHAR(200),
  
  status VARCHAR(20) DEFAULT 'pending' NOT NULL,
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TIMESTAMP,
  review_notes TEXT,
  
  is_reimbursable BOOLEAN DEFAULT false NOT NULL,
  reimbursed_at TIMESTAMP,
  
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS expenses_company_date_idx ON expenses(company_id, expense_date);
CREATE INDEX IF NOT EXISTS expenses_employee_idx ON expenses(employee_id);
CREATE INDEX IF NOT EXISTS expenses_category_idx ON expenses(category_id);
CREATE INDEX IF NOT EXISTS expenses_status_idx ON expenses(company_id, status);

-- Incomes
CREATE TABLE IF NOT EXISTS incomes (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES income_categories(id) ON DELETE SET NULL,
  submitted_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  concept VARCHAR(200) NOT NULL,
  description TEXT,
  amount DECIMAL(10, 2) NOT NULL,
  vat_amount DECIMAL(10, 2) DEFAULT 0.00 NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'EUR' NOT NULL,
  
  income_date DATE NOT NULL,
  
  payment_method VARCHAR(50),
  invoice_number VARCHAR(50),
  client VARCHAR(200),
  
  status VARCHAR(20) DEFAULT 'received' NOT NULL,
  
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS incomes_company_date_idx ON incomes(company_id, income_date);
CREATE INDEX IF NOT EXISTS incomes_category_idx ON incomes(category_id);
CREATE INDEX IF NOT EXISTS incomes_status_idx ON incomes(company_id, status);

-- Expense Receipts
CREATE TABLE IF NOT EXISTS expense_receipts (
  id SERIAL PRIMARY KEY,
  expense_id INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR(100),
  uploaded_by INTEGER NOT NULL REFERENCES users(id),
  uploaded_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS expense_receipts_expense_idx ON expense_receipts(expense_id);

-- Income Receipts
CREATE TABLE IF NOT EXISTS income_receipts (
  id SERIAL PRIMARY KEY,
  income_id INTEGER NOT NULL REFERENCES incomes(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR(100),
  uploaded_by INTEGER NOT NULL REFERENCES users(id),
  uploaded_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS income_receipts_income_idx ON income_receipts(income_id);

-- Insert default expense categories
INSERT INTO expense_categories (company_id, name, description, color, icon, sort_order)
SELECT 
  c.id,
  category_name,
  category_desc,
  category_color,
  category_icon,
  category_order
FROM companies c
CROSS JOIN (
  VALUES 
    ('Suministros', 'Luz, agua, gas, teléfono, internet', '#F59E0B', 'Zap', 1),
    ('Personal', 'Nóminas, seguridad social, formación', '#8B5CF6', 'Users', 2),
    ('Alquiler', 'Oficina, almacén, local comercial', '#6366F1', 'Home', 3),
    ('Material', 'Compras de material, herramientas, consumibles', '#EC4899', 'Package', 4),
    ('Vehículos', 'Combustible, mantenimiento, seguros', '#10B981', 'Car', 5),
    ('Marketing', 'Publicidad, diseño, web', '#EF4444', 'Megaphone', 6),
    ('Otros gastos', 'Gastos varios no categorizados', '#6B7280', 'MoreHorizontal', 7)
) AS defaults(category_name, category_desc, category_color, category_icon, category_order)
ON CONFLICT DO NOTHING;

-- Insert default income categories
INSERT INTO income_categories (company_id, name, description, color, icon, sort_order)
SELECT 
  c.id,
  category_name,
  category_desc,
  category_color,
  category_icon,
  category_order
FROM companies c
CROSS JOIN (
  VALUES 
    ('Ventas', 'Ingresos por ventas de productos o servicios', '#10B981', 'ShoppingCart', 1),
    ('Servicios', 'Facturación por servicios prestados', '#3B82F6', 'Briefcase', 2),
    ('Otros ingresos', 'Ingresos varios no categorizados', '#6B7280', 'TrendingUp', 3)
) AS defaults(category_name, category_desc, category_color, category_icon, category_order)
ON CONFLICT DO NOTHING;
