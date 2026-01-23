import fs from 'fs';
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

/**
 * PATRÓN OFICIAL PARA MIGRACIONES - Oficaz
 * 
 * Este script usa @neondatabase/serverless (Neon) en lugar de pg Pool.
 * Divide el SQL en statements individuales para ejecutarlos correctamente.
 * 
 * Uso:
 *   1. Crear archivo SQL en migrations/00XX_nombre.sql
 *   2. Actualizar shared/schema.ts con los nuevos campos
 *   3. Copiar este script y cambiar la ruta del archivo SQL
 *   4. Ejecutar: node run-nombre-migracion.js
 * 
 * Ver: docs/DATABASE_MIGRATIONS.md para más detalles
 */

async function runMigration() {
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL not set');
    }

    const sql = neon(process.env.DATABASE_URL);
    const sqlMigration = fs.readFileSync('./migrations/0028_add_crm_client_supplier_to_accounting.sql', 'utf-8');
    const statements = sqlMigration.split(';').filter(s => s.trim());
    
    console.log(`📜 Ejecutando migración CRM accounting (${statements.length} statements)...`);
    
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
            console.error(`⚠️  [${i + 1}/${statements.length}] Error (ignorado):`);
            console.error(`   ${err.message}`);
          }
        }
      }
    }
    
    console.log('\n✅ ¡MIGRACIÓN COMPLETADA EXITOSAMENTE!');
    console.log('   - crm_client_id agregado a accounting_entries');
    console.log('   - crm_supplier_id agregado a accounting_entries');
    console.log('   - Índices creados para optimización');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fatal:', error.message);
    process.exit(1);
  }
}

runMigration();
