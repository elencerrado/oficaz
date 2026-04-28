#!/usr/bin/env tsx
/**
 * Script para ejecutar SOLO la nueva migración de shift_templates
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../db.js';
import { sql } from 'drizzle-orm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar variables de entorno
const envPath = resolve(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  config({ path: envPath });
}

async function runShiftTemplatesMigration() {
  try {
    console.log('🚀 Ejecutando migración de shift_templates...\n');
    
    const migrationPath = path.join(__dirname, '../../migrations/0015_create_shift_templates.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    // Dividir por comandos individuales (separados por ;)
    // Remover comentarios de línea completa primero
    const sqlWithoutComments = migrationSQL
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');
    
    const commands = sqlWithoutComments
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0);
    
    console.log(`📝 Ejecutando ${commands.length} comandos SQL...\n`);
    
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      
      try {
        console.log(`▶️  Comando ${i + 1}/${commands.length}...`);
        await db.execute(sql.raw(command));
        console.log(`✅ Completado`);
      } catch (error: any) {
        if (error.message?.includes('already exists')) {
          console.log(`⏭️  Ya existe, saltando`);
        } else if (error.code === '42P07') {
          // Tabla ya existe
          console.log(`⏭️  Tabla ya existe, saltando`);
        } else {
          console.error(`❌ Error en comando ${i + 1}:`, error.message);
          throw error;
        }
      }
    }

    console.log('\n✨ Migración de shift_templates completada exitosamente!');
    console.log('📊 La tabla shift_templates está lista para usar\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error ejecutando migración:', error);
    process.exit(1);
  }
}

runShiftTemplatesMigration();
