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
import { sql } from 'drizzle-orm';

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

function splitSqlStatements(sqlText: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;
  let dollarTag: string | null = null;

  for (let index = 0; index < sqlText.length; index += 1) {
    const char = sqlText[index];
    const nextChar = sqlText[index + 1];
    const remaining = sqlText.slice(index);

    if (inLineComment) {
      current += char;
      if (char === '\n') {
        inLineComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      current += char;
      if (char === '*' && nextChar === '/') {
        current += nextChar;
        index += 1;
        inBlockComment = false;
      }
      continue;
    }

    if (dollarTag) {
      if (remaining.startsWith(dollarTag)) {
        current += dollarTag;
        index += dollarTag.length - 1;
        dollarTag = null;
      } else {
        current += char;
      }
      continue;
    }

    if (inSingleQuote) {
      current += char;
      if (char === '\'' && nextChar === '\'') {
        current += nextChar;
        index += 1;
      } else if (char === '\'') {
        inSingleQuote = false;
      }
      continue;
    }

    if (inDoubleQuote) {
      current += char;
      if (char === '"' && nextChar === '"') {
        current += nextChar;
        index += 1;
      } else if (char === '"') {
        inDoubleQuote = false;
      }
      continue;
    }

    if (char === '-' && nextChar === '-') {
      current += char + nextChar;
      index += 1;
      inLineComment = true;
      continue;
    }

    if (char === '/' && nextChar === '*') {
      current += char + nextChar;
      index += 1;
      inBlockComment = true;
      continue;
    }

    if (char === '\'') {
      current += char;
      inSingleQuote = true;
      continue;
    }

    if (char === '"') {
      current += char;
      inDoubleQuote = true;
      continue;
    }

    if (char === '$') {
      const dollarMatch = remaining.match(/^\$[A-Za-z0-9_]*\$/);
      if (dollarMatch) {
        dollarTag = dollarMatch[0];
        current += dollarTag;
        index += dollarTag.length - 1;
        continue;
      }
    }

    if (char === ';') {
      const statement = current.trim();
      if (statement) {
        statements.push(statement);
      }
      current = '';
      continue;
    }

    current += char;
  }

  const trailingStatement = current.trim();
  if (trailingStatement) {
    statements.push(trailingStatement);
  }

  return statements;
}

async function runMigrations() {
  try {
    const { db } = await import('../db.js');

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
      const statements = splitSqlStatements(migrationSQL);
      
      try {
        for (const statement of statements) {
          await db.execute(sql.raw(statement));
        }
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
