#!/usr/bin/env node
/**
 * Create accounting tables if missing to resolve 500 errors
 * Uses Neon serverless driver directly.
 */
import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

async function run() {
  try {
    console.log('🔧 Creating accounting tables if missing...');

    // accounting_categories
    await sql(`
      CREATE TABLE IF NOT EXISTS accounting_categories (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        type VARCHAR(10) NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        color VARCHAR(7) NOT NULL,
        icon VARCHAR(50) DEFAULT 'Receipt',
        is_active BOOLEAN DEFAULT TRUE NOT NULL,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS accounting_categories_company_type_idx ON accounting_categories(company_id, type);
    `);

    // accounting_entries
    await sql(`
      CREATE TABLE IF NOT EXISTS accounting_entries (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        category_id INTEGER REFERENCES accounting_categories(id) ON DELETE SET NULL,
        type VARCHAR(10) NOT NULL,
        submitted_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        employee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
        crm_client_id INTEGER REFERENCES business_contacts(id) ON DELETE SET NULL,
        crm_supplier_id INTEGER REFERENCES business_contacts(id) ON DELETE SET NULL,
        concept VARCHAR(200) NOT NULL,
        description TEXT,
        amount NUMERIC(10,2) NOT NULL,
        vat_rate NUMERIC(5,2),
        vat_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
        total_amount NUMERIC(10,2) NOT NULL,
        currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
        irpf_retention_rate NUMERIC(5,2),
        irpf_retention_amount NUMERIC(12,2),
        irpf_deductible BOOLEAN NOT NULL DEFAULT TRUE,
        irpf_is_social_security BOOLEAN NOT NULL DEFAULT FALSE,
        entry_date DATE NOT NULL,
        payment_method VARCHAR(50),
        invoice_number VARCHAR(100),
        ref_code VARCHAR(50),
        contact_name VARCHAR(200),
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        reviewed_at TIMESTAMP,
        review_notes TEXT,
        is_reimbursable BOOLEAN NOT NULL DEFAULT FALSE,
        reimbursed_at TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS accounting_entries_company_date_idx ON accounting_entries(company_id, entry_date);
      CREATE INDEX IF NOT EXISTS accounting_entries_type_idx ON accounting_entries(company_id, type);
      CREATE INDEX IF NOT EXISTS accounting_entries_employee_idx ON accounting_entries(employee_id);
      CREATE INDEX IF NOT EXISTS accounting_entries_status_idx ON accounting_entries(company_id, status);
      CREATE INDEX IF NOT EXISTS accounting_entries_project_idx ON accounting_entries(project_id);
      CREATE INDEX IF NOT EXISTS accounting_entries_crm_client_idx ON accounting_entries(crm_client_id);
      CREATE INDEX IF NOT EXISTS accounting_entries_crm_supplier_idx ON accounting_entries(crm_supplier_id);
      CREATE INDEX IF NOT EXISTS accounting_entries_vat_rate_idx ON accounting_entries(company_id, vat_rate, entry_date);
      CREATE INDEX IF NOT EXISTS accounting_entries_irpf_idx ON accounting_entries(company_id, type, status);
    `);

    // accounting_attachments
    await sql(`
      CREATE TABLE IF NOT EXISTS accounting_attachments (
        id SERIAL PRIMARY KEY,
        entry_id INTEGER NOT NULL REFERENCES accounting_entries(id) ON DELETE CASCADE,
        file_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_size INTEGER,
        mime_type VARCHAR(100),
        uploaded_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        uploaded_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS accounting_attachments_entry_idx ON accounting_attachments(entry_id);
    `);

    // company_fiscal_settings (if missing)
    await sql(`
      CREATE TABLE IF NOT EXISTS company_fiscal_settings (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
        taxpayer_type VARCHAR(20) NOT NULL DEFAULT 'autonomo',
        vat_regime VARCHAR(50) DEFAULT 'general',
        vat_proration NUMERIC(5,2) NOT NULL DEFAULT 100,
        irpf_model130_rate NUMERIC(5,2) NOT NULL DEFAULT 20,
        irpf_manual_withholdings NUMERIC(12,2) NOT NULL DEFAULT 0,
        irpf_previous_payments NUMERIC(12,2) NOT NULL DEFAULT 0,
        irpf_manual_social_security NUMERIC(12,2) NOT NULL DEFAULT 0,
        irpf_other_adjustments NUMERIC(12,2) NOT NULL DEFAULT 0,
        community VARCHAR(100),
        retention_default_rate NUMERIC(5,2),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    console.log('✅ Accounting tables ensured.');
  } catch (err) {
    console.error('❌ Failed to create tables:', err);
    process.exit(1);
  }
}

run();
