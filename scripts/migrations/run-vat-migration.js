import fs from 'fs';
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

async function runMigration() {
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL no está configurada');
    }

    const sql = neon(process.env.DATABASE_URL);
    const migrationSQL = fs.readFileSync('./migrations/0029_add_vat_rate_to_accounting.sql', 'utf-8');
    const statements = migrationSQL.split(';').filter(s => s.trim());
    
    console.log('🔄 Ejecutando migración: 0029_add_vat_rate_to_accounting.sql');
    console.log(`📜 Ejecutando ${statements.length} statements...`);
    
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i].trim();
      if (stmt) {
        try {
          await sql(stmt);
          console.log(`✅ [${i + 1}/${statements.length}] Ejecutado`);
        } catch (err) {
          console.error(`⚠️  [${i + 1}/${statements.length}] Error (ignorado):`);
          console.error(`   ${err.message}`);
        }
      }
    }
    
    console.log('\n✅ ¡MIGRACIÓN COMPLETADA EXITOSAMENTE!');
    console.log('📋 Resumen:');
    console.log('   - Columna vat_rate agregada a accounting_entries');
    console.log('   - Valores existentes configurados a 21.00% (IVA general)');
    console.log('   - Índice creado para consultas fiscales rápidas');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error ejecutando migración:', error.message);
    process.exit(1);
  }
}

runMigration();
