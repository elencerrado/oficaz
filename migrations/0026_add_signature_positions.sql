CREATE TABLE IF NOT EXISTS document_signature_positions (
  id SERIAL PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  position_x DECIMAL(5, 2) NOT NULL DEFAULT 75,
  position_y DECIMAL(5, 2) NOT NULL DEFAULT 80,
  position_width DECIMAL(5, 2) NOT NULL DEFAULT 18,
  position_height DECIMAL(5, 2) NOT NULL DEFAULT 15,
  page_number INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(document_id)
);

CREATE INDEX IF NOT EXISTS document_signature_positions_document_id_idx 
ON document_signature_positions(document_id);
