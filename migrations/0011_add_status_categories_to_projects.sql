-- Add status categories to projects
-- Migrar de status string a statusCategories array de IDs

-- Paso 1: Crear columna para IDs de categorías de estado
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS status_categories INTEGER[] DEFAULT '{}';

-- Paso 2: Los estados por defecto se crearán automáticamente en el backend
-- cuando se haga la primera petición a /api/crm/project-status-categories

-- Paso 3: El campo "status" existente se mantendrá por compatibilidad
-- pero ya no se usará en el frontend (se puede eliminar en el futuro)

-- Crear índice para mejorar búsquedas por estados
CREATE INDEX IF NOT EXISTS idx_projects_status_categories 
ON projects USING GIN (status_categories);

COMMENT ON COLUMN projects.status_categories IS 'IDs de categorías de estado de proyectos';
