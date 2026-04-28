#!/usr/bin/env node
/**
 * Script de inicio para Replit
 * Ejecuta el servidor Express y Vite en paralelo
 * Mata procesos anteriores si es necesario
 */

import { spawn, exec } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { promisify } from 'util';
import { rmSync } from 'fs';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 Iniciando Oficaz en Replit...');
console.log('📁 Directorio:', __dirname);
console.log('🔧 NODE_ENV:', process.env.NODE_ENV || 'development');

// Limpiar caché de Vite en Replit para evitar problemas con deps obsoletos
const viteCacheDir = path.join(os.tmpdir(), 'vite-cache-oficaz');
console.log(`🧹 Limpiando caché de Vite: ${viteCacheDir}`);
try {
  rmSync(viteCacheDir, { recursive: true, force: true });
  console.log('✅ Caché de Vite limpiado');
} catch (err) {
  console.warn('⚠️ No se pudo limpiar caché de Vite:', err.message);
}

// Matar procesos anteriores en el puerto
const PORT = process.env.PORT || '5000';
console.log(`🔍 Verificando puerto ${PORT}...`);

try {
  // Intentar matar procesos en el puerto (solo en Linux/Replit)
  if (process.platform === 'linux') {
    await execAsync(`lsof -ti:${PORT} | xargs kill -9 2>/dev/null || true`);
    console.log(`✅ Puerto ${PORT} liberado`);
  }
} catch (error) {
  // Ignorar errores si no hay nada que matar
  console.log(`ℹ️  Puerto ${PORT} disponible`);
}

// Iniciar el servidor con tsx que incluye Vite
const child = spawn('npx', ['tsx', 'server/index.ts'], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    NODE_ENV: 'development',
    PORT: PORT
  }
});

child.on('exit', (code, signal) => {
  if (code !== 0) {
    console.error(`❌ Proceso terminado con código ${code}${signal ? ` y señal ${signal}` : ''}`);
    process.exit(code || 1);
  }
});

child.on('error', (err) => {
  console.error('❌ Error al iniciar:', err.message);
  process.exit(1);
});

// Manejar señales de terminación
process.on('SIGTERM', () => {
  console.log('🛑 Recibida señal SIGTERM, cerrando...');
  child.kill('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('🛑 Recibida señal SIGINT, cerrando...');
  child.kill('SIGINT');
});
