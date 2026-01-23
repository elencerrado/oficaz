-- Migration: Create shift_templates table
-- Description: Stores shift templates that can be reused by admins/managers within a company
-- Templates are shared across all users in the same company
-- Created: 2026-01-06

CREATE TABLE IF NOT EXISTS shift_templates (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  color VARCHAR(7) NOT NULL DEFAULT '#2563EB',
  location TEXT,
  notes TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index for faster queries by company
CREATE INDEX idx_shift_templates_company_id ON shift_templates(company_id);

-- Index for ordering templates within a company
CREATE INDEX idx_shift_templates_company_order ON shift_templates(company_id, display_order);

-- Index for lookups by creator
CREATE INDEX idx_shift_templates_created_by ON shift_templates(created_by);

-- Add comment to table
COMMENT ON TABLE shift_templates IS 'Reusable shift templates shared within a company for scheduling';
COMMENT ON COLUMN shift_templates.company_id IS 'Company that owns this template';
COMMENT ON COLUMN shift_templates.title IS 'Name/title of the shift template';
COMMENT ON COLUMN shift_templates.start_time IS 'Start time of the shift (time only, no date)';
COMMENT ON COLUMN shift_templates.end_time IS 'End time of the shift (time only, no date)';
COMMENT ON COLUMN shift_templates.color IS 'Hex color code for visual identification';
COMMENT ON COLUMN shift_templates.location IS 'Optional location/address for the shift';
COMMENT ON COLUMN shift_templates.notes IS 'Optional notes or instructions for the shift';
COMMENT ON COLUMN shift_templates.display_order IS 'Order for displaying templates in the UI (lower = first)';
COMMENT ON COLUMN shift_templates.created_by IS 'User who created this template';
