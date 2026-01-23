-- Add categories array column to business_contacts table
-- Using INTEGER[] to store IDs of CRM categories
ALTER TABLE business_contacts
ADD COLUMN IF NOT EXISTS categories INTEGER[] DEFAULT '{}';

-- Update existing contacts to have empty array for categories
UPDATE business_contacts SET categories = '{}' WHERE categories IS NULL;
