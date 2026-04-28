ALTER TABLE crm_status_categories
  ADD COLUMN IF NOT EXISTS stage_key VARCHAR(40);

UPDATE crm_status_categories
SET is_default = TRUE,
    stage_key = CASE
      WHEN LOWER(name) IN ('contacto inicial') THEN 'initial_contact'
      WHEN LOWER(name) IN ('info enviada') THEN 'info_sent'
      WHEN LOWER(name) IN ('reunión agendada', 'reunion agendada') THEN 'meeting_scheduled'
      WHEN LOWER(name) IN ('negociación', 'negociacion') THEN 'negotiation'
      WHEN LOWER(name) IN ('cliente') THEN 'client'
      WHEN LOWER(name) IN ('descartado') THEN 'discarded'
      ELSE stage_key
    END,
    updated_at = NOW()
WHERE stage_key IS NULL
  AND LOWER(name) IN (
    'contacto inicial',
    'info enviada',
    'reunión agendada',
    'reunion agendada',
    'negociación',
    'negociacion',
    'cliente',
    'descartado'
  );

CREATE INDEX IF NOT EXISTS crm_status_categories_company_stage_key_idx
  ON crm_status_categories (company_id, stage_key);
