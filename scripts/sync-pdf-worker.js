/**
 * Script para sincronizar el PDF worker con la versión de react-pdf
 * Ejecutar después de npm install para mantener versiones alineadas
 */

import { copyFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Ruta del worker en node_modules
// Usar el worker de react-pdf para evitar mismatch de versiones en iOS
// react-pdf usa pdfjs-dist@5.4.296, mientras que el package directo usa 5.4.530
const workerSource = join(projectRoot, 'node_modules', 'react-pdf', 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs');
const workerSourceFallback = join(projectRoot, 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs');

// Ruta de destino en public
const workerDest = join(projectRoot, 'client', 'public', 'pdf.worker.min.mjs');

try {
  let source = workerSource;
  
  // Intentar primero desde react-pdf (versión compatible)
  if (!existsSync(workerSource)) {
    console.log('Worker no encontrado en react-pdf, usando pdfjs-dist fallback...');
    source = workerSourceFallback;
  }
  
  if (!existsSync(source)) {
    console.error('❌ No se encontró pdf.worker.min.mjs en node_modules');
    console.error('   Ejecuta: npm install');
    process.exit(1);
  }
  
  copyFileSync(source, workerDest);
  console.log('✅ PDF worker sincronizado correctamente');
  console.log(`   Copiado desde: ${source}`);
  console.log(`   Hacia: ${workerDest}`);
} catch (error) {
  console.error('❌ Error al sincronizar PDF worker:', error.message);
  process.exit(1);
}
