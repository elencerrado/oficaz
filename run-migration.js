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
    
    // Leer el archivo de migración
    const sql = readFileSync('./migrations/0031_add_irpf_fields_to_accounting.sql', 'utf8');
    
    console.log('📝 Ejecutando migración 0031_add_irpf_fields_to_accounting.sql...');
    
    // Ejecutar la migración
    await pool.query(sql);
    
    console.log('✅ Migración completada exitosamente!');
    console.log('✨ Campos añadidos:');
    console.log('   - irpf_deduction_percentage (decimal)');
    console.log('   - irpf_is_amortization (boolean)');
    console.log('   - irpf_fiscal_adjustment (decimal)');
    console.log('   - fiscal_notes (text)');
    
  } catch (error) {
    console.error('❌ Error ejecutando migración:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

runMigration().catch(console.error);
