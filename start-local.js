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
const port = Number(process.env.PORT || 5000);

console.log(`🚀 Iniciando Oficaz en modo ${isDev ? 'desarrollo' : 'producción'}...`);
console.log(`📁 Usando variables de entorno de: ${envPath}`);
console.log(`🔗 Abrir en el navegador: http://localhost:${port}`);

if (isDev) {
  // Modo desarrollo: usar tsx con --import (requerido por Node >=18.19/20.6)
  const child = spawn('node', ['--env-file=.env', '--import', 'tsx', 'server/index.ts'], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'development' }
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
