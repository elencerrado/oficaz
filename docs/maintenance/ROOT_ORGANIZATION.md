# Organización de la raíz del proyecto

Se ha limpiado la raíz para dejar solo archivos de arranque/configuración y carpetas principales del producto.

## Cambios aplicados

- Scripts de mantenimiento/migración ad-hoc movidos a:
  - `scripts/maintenance/`
- Informes de auditoría movidos a:
  - `docs/audits/`
- Snapshots temporales de Vite (`vite.config.ts.timestamp-*.mjs`) movidos a:
  - `scripts/archive/vite-config-snapshots/`

## Qué permanece en raíz

- Entrypoints operativos (`start-local.js`, `start-replit.js`)
- Configuración del proyecto (`package.json`, `tsconfig.json`, `vite.config.ts`, etc.)
- Carpetas core (`client`, `server`, `shared`, `migrations`, `scripts`, `docs`, `tests`, etc.)

## Ejemplos de uso tras reorganización

- `node scripts/maintenance/run-migrations.js`
- `node scripts/maintenance/run-migration-0058.js`
- `node scripts/maintenance/fix-via-api.mjs`
