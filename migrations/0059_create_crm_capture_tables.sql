-- CRM Captación: timeline de interacciones, pipeline, tareas y plantillas

CREATE TABLE IF NOT EXISTS crm_lead_profiles (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id INTEGER NOT NULL REFERENCES business_contacts(id) ON DELETE CASCADE,
  pipeline_stage VARCHAR(40) NOT NULL DEFAULT 'initial_contact',
  source VARCHAR(40) NOT NULL DEFAULT 'web',
  priority VARCHAR(20) NOT NULL DEFAULT 'medium',
  estimated_value DECIMAL(12,2),
  last_interaction_at TIMESTAMP,
  next_follow_up_at TIMESTAMP,
  is_client BOOLEAN NOT NULL DEFAULT false,
  is_discarded BOOLEAN NOT NULL DEFAULT false,
  discard_reason TEXT,
  won_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT crm_lead_profiles_company_contact_unique UNIQUE (company_id, contact_id)
);

CREATE INDEX IF NOT EXISTS crm_lead_profiles_company_stage_idx ON crm_lead_profiles(company_id, pipeline_stage);
CREATE INDEX IF NOT EXISTS crm_lead_profiles_company_priority_idx ON crm_lead_profiles(company_id, priority);
CREATE INDEX IF NOT EXISTS crm_lead_profiles_company_source_idx ON crm_lead_profiles(company_id, source);
CREATE INDEX IF NOT EXISTS crm_lead_profiles_follow_up_idx ON crm_lead_profiles(company_id, next_follow_up_at);

CREATE TABLE IF NOT EXISTS crm_contact_interactions (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id INTEGER NOT NULL REFERENCES business_contacts(id) ON DELETE CASCADE,
  project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  interaction_type VARCHAR(40) NOT NULL,
  subject VARCHAR(240),
  notes TEXT,
  responded BOOLEAN NOT NULL DEFAULT false,
  result VARCHAR(40),
  scheduled_at TIMESTAMP,
  occurred_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS crm_contact_interactions_company_contact_occurred_idx ON crm_contact_interactions(company_id, contact_id, occurred_at);
CREATE INDEX IF NOT EXISTS crm_contact_interactions_company_scheduled_idx ON crm_contact_interactions(company_id, scheduled_at);
CREATE INDEX IF NOT EXISTS crm_contact_interactions_company_type_idx ON crm_contact_interactions(company_id, interaction_type);

CREATE TABLE IF NOT EXISTS crm_follow_up_tasks (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id INTEGER NOT NULL REFERENCES business_contacts(id) ON DELETE CASCADE,
  interaction_id INTEGER REFERENCES crm_contact_interactions(id) ON DELETE SET NULL,
  task_type VARCHAR(40) NOT NULL DEFAULT 'manual',
  title VARCHAR(240) NOT NULL,
  description TEXT,
  due_at TIMESTAMP NOT NULL,
  reminder_at TIMESTAMP,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  priority VARCHAR(20) NOT NULL DEFAULT 'medium',
  template_key VARCHAR(80),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  completed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT crm_follow_up_tasks_auto_unique UNIQUE (company_id, contact_id, task_type, due_at)
);

CREATE INDEX IF NOT EXISTS crm_follow_up_tasks_company_due_idx ON crm_follow_up_tasks(company_id, due_at);
CREATE INDEX IF NOT EXISTS crm_follow_up_tasks_company_status_idx ON crm_follow_up_tasks(company_id, status);
CREATE INDEX IF NOT EXISTS crm_follow_up_tasks_company_contact_idx ON crm_follow_up_tasks(company_id, contact_id);

CREATE TABLE IF NOT EXISTS crm_message_templates (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  template_key VARCHAR(80) NOT NULL,
  title VARCHAR(180) NOT NULL,
  content TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT crm_message_templates_company_key_unique UNIQUE (company_id, template_key)
);

CREATE INDEX IF NOT EXISTS crm_message_templates_company_idx ON crm_message_templates(company_id);

-- Seed plantillas por defecto para empresas existentes (si no existen)
INSERT INTO crm_message_templates (company_id, template_key, title, content, is_default)
SELECT c.id, 'followup_email', 'Email de seguimiento', 'Hola {{nombre}},\n\nTe escribo para hacer seguimiento de nuestra última conversación.\n\n¿Te viene bien que avancemos con los siguientes pasos?\n\nGracias.', true
FROM companies c
ON CONFLICT (company_id, template_key) DO NOTHING;

INSERT INTO crm_message_templates (company_id, template_key, title, content, is_default)
SELECT c.id, 'request_feedback', 'Solicitar feedback', 'Hola {{nombre}},\n\n¿Podrías compartirnos tu feedback sobre la propuesta enviada?\n\nNos ayudará a ajustar mejor la solución para ti.\n\nGracias.', true
FROM companies c
ON CONFLICT (company_id, template_key) DO NOTHING;

INSERT INTO crm_message_templates (company_id, template_key, title, content, is_default)
SELECT c.id, 'close_sale', 'Cerrar venta', 'Hola {{nombre}},\n\nSi todo está correcto por tu parte, podemos cerrar el acuerdo esta semana.\n\nQuedo atento para formalizarlo.', true
FROM companies c
ON CONFLICT (company_id, template_key) DO NOTHING;
