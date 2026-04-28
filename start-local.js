#!/usr/bin/env node
/**
 * Script de inicio local para Oficaz
 * 
 * USO:
 *   Desarrollo: node start-local.js dev
 *   Producción: node start-local.js
 * 
 * Asegúrate de tener un archivo .env en la raíz del proyecto.
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Verificar que existe el archivo .env
const envPath = join(__dirname, '.env');
if (!existsSync(envPath)) {
  console.error('❌ Error: No se encontró el archivo .env');
  console.error('   Copia .env.example a .env y configura las variables:');
  console.error('   cp .env.example .env');
  process.exit(1);
}

// Determinar si es desarrollo o producción
const isDev = process.argv.includes('dev');

// In local development we pin the app to 5000 to avoid frequent 3000 conflicts
// from other Node processes/tools in Windows environments.
const devPort = 5000;
const port = isDev ? devPort : Number(process.env.PORT || 5000);

console.log(`🚀 Iniciando Oficaz en modo ${isDev ? 'desarrollo' : 'producción'}...`);
console.log(`📁 Usando variables de entorno de: ${envPath}`);
console.log(`🔗 Abrir en el navegador: http://localhost:${port}`);

// Cargar variables de entorno de forma explícita para evitar depender de --env-file
dotenv.config({ path: envPath });

function getTsxCommand() {
  return join(__dirname, 'node_modules', 'tsx', 'dist', 'cli.mjs');
}

function buildNodeOptionsWithHeapFallback() {
  const current = process.env.NODE_OPTIONS || '';
  if (/--max-old-space-size=\d+/i.test(current)) {
    return current;
  }
  return `${current} --max-old-space-size=4096`.trim();
}

if (isDev) {
  // Modo desarrollo: ejecutar tsx mediante node para evitar EINVAL en Windows
  const tsxCliPath = getTsxCommand();
  const child = spawn(process.execPath, [tsxCliPath, 'server/index.ts'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PORT: String(devPort),
      NODE_OPTIONS: buildNodeOptionsWithHeapFallback(),
    }
  });
  child.on('exit', (code, signal) => {
    if (code !== 0) {
      console.error(`❌ Proceso de desarrollo terminado con código ${code}${signal ? ` y señal ${signal}` : ''}`);
    }
  });
  
  child.on('error', (err) => {
    console.error('❌ Error al iniciar:', err.message);
  });
} else {
  // Modo producción: usar node con el build
  const distPath = join(__dirname, 'dist', 'index.js');
  
  if (!existsSync(distPath)) {
    console.error('❌ Error: No se encontró el build de producción.');
    console.error('   Ejecuta primero: npm run build');
    process.exit(1);
  }
  
  const child = spawn('node', ['--env-file=.env', 'dist/index.js'], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' }
  });
  child.on('exit', (code, signal) => {
    if (code !== 0) {
      console.error(`❌ Proceso de producción terminado con código ${code}${signal ? ` y señal ${signal}` : ''}`);
    }
  });
  
  child.on('error', (err) => {
    console.error('❌ Error al iniciar:', err.message);
  });
}
