# Guía de Migraciones de Base de Datos

## ⚠️ PATRÓN OFICIAL PARA EJECUTAR MIGRACIONES

Este proyecto usa **Neon Serverless** para la base de datos PostgreSQL. Todas las migraciones deben seguir este patrón:

## Cómo Crear una Nueva Migración

### 1. Crear el archivo SQL

Crear un nuevo archivo en `migrations/` siguiendo el patrón de numeración:
```
migrations/00XX_nombre_descriptivo.sql
```

Ejemplo:
```sql
-- migrations/0028_add_crm_client_supplier_to_accounting.sql
ALTER TABLE accounting_entries
ADD COLUMN crm_client_id INTEGER REFERENCES business_contacts(id) ON DELETE SET NULL,
ADD COLUMN crm_supplier_id INTEGER REFERENCES business_contacts(id) ON DELETE SET NULL;

CREATE INDEX accounting_entries_crm_client_idx ON accounting_entries(crm_client_id);
CREATE INDEX accounting_entries_crm_supplier_idx ON accounting_entries(crm_supplier_id);
```

### 2. Actualizar el Schema TypeScript

Actualizar `shared/schema.ts` con los nuevos campos:
```typescript
export const accountingEntries = pgTable("accounting_entries", {
  // ... campos existentes
  crmClientId: integer("crm_client_id").references(() => businessContacts.id, { onDelete: "set null" }),
  crmSupplierId: integer("crm_supplier_id").references(() => businessContacts.id, { onDelete: "set null" }),
  // ...
});
```

### 3. Crear el Script de Migración

Copiar el template de `run-migration.mjs` y crear uno nuevo:

```javascript
// run-nueva-migracion.js
import fs from 'fs';
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

async function runMigration() {
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL not set');
    }

    const sql = neon(process.env.DATABASE_URL);
    const sqlMigration = fs.readFileSync('./migrations/00XX_nombre.sql', 'utf-8');
    const statements = sqlMigration.split(';').filter(s => s.trim());
    
    console.log(`📜 Ejecutando migración (${statements.length} statements)...`);
    
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i].trim();
      if (stmt) {
        try {
          await sql(stmt);
          console.log(`✅ [${i + 1}/${statements.length}] Ejecutado`);
        } catch (err) {
          if (err.message.includes('already exists')) {
            console.log(`⚠️  [${i + 1}/${statements.length}] Ya existe (ignorado)`);
          } else {
            console.error(`⚠️  [${i + 1}/${statements.length}] Error:`);
            console.error(`   ${err.message}`);
          }
        }
      }
    }
    
    console.log('\n✅ ¡MIGRACIÓN COMPLETADA!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fatal:', error.message);
    process.exit(1);
  }
}

runMigration();
```

### 4. Ejecutar la Migración

```bash
node run-nueva-migracion.js
```

## ❌ NO USAR ESTOS MÉTODOS

### ❌ NO usar `drizzle-kit push`
Puede detectar cambios no deseados en otras tablas y causar pérdida de datos.

### ❌ NO usar `pg` Pool directamente
```javascript
// ❌ MAL - No funciona con Neon
import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
```

### ❌ NO ejecutar SQL sin dividir por statements
```javascript
// ❌ MAL - Falla si hay múltiples comandos
await sql(todoElArchivoSQL);
```

## ✅ PATRÓN CORRECTO

```javascript
// ✅ BIEN - Usar @neondatabase/serverless
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

// ✅ BIEN - Dividir por statements
const statements = sqlMigration.split(';').filter(s => s.trim());
for (const stmt of statements) {
  if (stmt) await sql(stmt);
}
```

## Verificación Post-Migración

1. **Verificar en la base de datos** que las columnas/tablas se crearon
2. **Ejecutar el servidor** y verificar que no hay errores
3. **Probar la funcionalidad** que usa los nuevos campos
4. **Hacer commit** del archivo de migración y los cambios en el schema

## Troubleshooting

### Error: "DATABASE_URL not set"
- Asegúrate de tener el archivo `.env` con `DATABASE_URL`
- Ejecuta desde la raíz del proyecto

### Error: "already exists"
- La migración ya fue ejecutada
- Es normal, el script lo ignora automáticamente

### Error: "connect ECONNREFUSED"
- Estás intentando conectar a PostgreSQL local en lugar de Neon
- Verifica que `DATABASE_URL` apunte a Neon

### Assertion failed (al final)
- Es un warning de cierre de proceso de Neon
- Si la migración mostró "✅ COMPLETADA", ignóralo

## Ejemplos de Migraciones Anteriores

- `0001_add_accounting_system.sql` - Sistema de contabilidad
- `0005_create_crm_tables.sql` - Tablas CRM
- `0017_create_email_queue.sql` - Cola de emails
- `0028_add_crm_client_supplier_to_accounting.sql` - Integración CRM con contabilidad

## Recursos

- [Neon Serverless Docs](https://neon.tech/docs/serverless/serverless-driver)
- [Drizzle ORM Schema](https://orm.drizzle.team/docs/sql-schema-declaration)
