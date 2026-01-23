-- Migrate categories column from TEXT[] to INTEGER[]
-- First, convert existing TEXT values to empty INTEGER array
ALTER TABLE business_contacts
ALTER COLUMN categories SET DEFAULT ARRAY[]::integer[];

-- Update the column type
ALTER TABLE business_contacts
ALTER COLUMN categories TYPE integer[] USING '{}'::integer[];

-- Ensure NOT NULL constraint
ALTER TABLE business_contacts
ALTER COLUMN categories SET NOT NULL;
