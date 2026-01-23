#!/usr/bin/env node

/**
 * Script para validar integridad de archivos Word generados
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Packer, Document } from 'docx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WORD_DIR = path.join(__dirname, 'docs', 'legal', 'word');

console.log('\n🔍 Validando integridad de documentos Word...\n');

const files = fs.readdirSync(WORD_DIR).filter(f => f.endsWith('.docx'));

files.forEach((file) => {
  const filePath = path.join(WORD_DIR, file);
  try {
    const stats = fs.statSync(filePath);
    const sizeKB = (stats.size / 1024).toFixed(2);
    const sizeOK = stats.size > 5000;
    
    console.log(`${sizeOK ? '✅' : '⚠️ '} ${file}: ${sizeKB} KB`);
    
    if (!sizeOK) {
      console.log(`   ⚠️  Archivo muy pequeño, posible corrupción`);
    }
  } catch (error) {
    console.log(`❌ ${file}: Error al leer - ${error.message}`);
  }
});

console.log('\n✅ Validación completada\n');
