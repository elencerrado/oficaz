ALTER TABLE accounting_entries
ADD COLUMN crm_client_id INTEGER REFERENCES business_contacts(id) ON DELETE SET NULL,
ADD COLUMN crm_supplier_id INTEGER REFERENCES business_contacts(id) ON DELETE SET NULL;

CREATE INDEX accounting_entries_crm_client_idx ON accounting_entries(crm_client_id);
CREATE INDEX accounting_entries_crm_supplier_idx ON accounting_entries(crm_supplier_id);
