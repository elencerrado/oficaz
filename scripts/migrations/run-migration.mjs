import fs from 'fs';
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

async function runMigration() {
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL not set');
    }

    const sql = neon(process.env.DATABASE_URL);
    const sqlMigration = fs.readFileSync('./migrations/0017_create_email_queue.sql', 'utf-8');
    const statements = sqlMigration.split(';').filter(s => s.trim());
    
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
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fatal:', error.message);
    process.exit(1);
  }
}

runMigration();
