-- Add isBeta field to addons table for marking features in beta phase
ALTER TABLE addons ADD COLUMN IF NOT EXISTS is_beta BOOLEAN NOT NULL DEFAULT false;

-- Add comment to document the field
COMMENT ON COLUMN addons.is_beta IS 'Indicates if this addon is in beta phase (shows Beta badge in UI)';
