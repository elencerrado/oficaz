import { neonConfig, Pool } from '@neondatabase/serverless';
import ws from 'ws';
import { config } from 'dotenv';
import { readFileSync } from 'fs';

config();

neonConfig.webSocketConstructor = ws;

async function runMigration() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    console.log('🔄 Conectando a la base de datos...');
    const sql = readFileSync('./migrations/0032_add_retention_fields.sql', 'utf8');
    console.log('📝 Ejecutando migración 0032_add_retention_fields.sql...');
    await pool.query(sql);
    console.log('✅ Migración 0032 completada exitosamente!');
  } catch (error) {
    console.error('❌ Error ejecutando migración 0032:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

runMigration().catch(console.error);
