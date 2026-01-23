#!/usr/bin/env tsx
/**
 * Script para ejecutar migraciones SQL manualmente
 * Ejecuta todas las migraciones .sql en la carpeta migrations/
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import * as fs from 'fs';
import * as path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar variables de entorno
const envPath = resolve(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  config({ path: envPath });
  console.log('✅ Variables de entorno cargadas desde .env');
} else {
  console.log('⚠️  No se encontró .env, intentando con variables del sistema...');
}

// Importar db después de cargar las variables de entorno
const { db } = await import('../db.js');
const { sql } = await import('drizzle-orm');

async function runMigrations() {
  try {
    console.log('🔍 Buscando migraciones SQL...');
    
    const migrationsDir = path.join(__dirname, '../../migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`📁 Encontradas ${files.length} migraciones`);
    
    for (const file of files) {
      console.log(`\n▶️  Ejecutando: ${file}`);
      const migrationPath = path.join(migrationsDir, file);
      const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
      
      try {
        await db.execute(sql.raw(migrationSQL));
        console.log(`✅ ${file} ejecutada correctamente`);
      } catch (error: any) {
        // Ignorar errores si la tabla ya existe
        if (error.message?.includes('already exists')) {
          console.log(`⏭️  ${file} ya está aplicada`);
        } else {
          throw error;
        }
      }
    }

    console.log('\n✨ Migraciones completadas exitosamente');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error ejecutando migraciones:', error);
    process.exit(1);
  }
}

runMigrations();
