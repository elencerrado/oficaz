-- Actualizar email para Jose Garcia (usuario ID 418)
-- Reemplaza 'jose.garcia@ejemplo.com' con el email real de Jose Garcia

UPDATE users 
SET email = 'jose.garcia@ejemplo.com'  -- ⚠️ CAMBIA ESTO POR EL EMAIL REAL
WHERE id = 418;

-- Verificar el cambio
SELECT id, full_name, email, dni FROM users WHERE id = 418;
