-- Migration 0060: Add postal address field to business contacts
-- Adds dedicated postalAddress column and migrates data from label field

-- Add new postalAddress column
ALTER TABLE business_contacts ADD COLUMN IF NOT EXISTS postal_address TEXT;

-- Copy label data to postalAddress (only non-default labels like "Cliente" or "Proveedor")
UPDATE business_contacts 
SET postal_address = label 
WHERE label IS NOT NULL 
  AND label NOT IN ('Cliente', 'Proveedor')
  AND postal_address IS NULL;

-- For contacts with default labels, keep postal_address NULL
-- label field is kept for backward compatibility

-- Create index on postal_address for faster queries
CREATE INDEX IF NOT EXISTS business_contacts_postal_address_idx 
ON business_contacts(company_id, postal_address) 
WHERE postal_address IS NOT NULL;

