# Maintenance Scripts

Organización interna de scripts de mantenimiento:

- `diagnostics/`: scripts de inspección y diagnóstico
- `fixes/`: scripts correctivos puntuales
- `migrations/`: migraciones manuales/ad-hoc

## Compatibilidad

Se mantienen wrappers en esta carpeta con los nombres históricos.
Esto permite seguir ejecutando comandos antiguos sin cambios.

Ejemplos compatibles:

- `node scripts/maintenance/run-migrations.js`
- `node scripts/maintenance/fix-via-api.mjs`
- `node scripts/maintenance/diagnose-juan-jose.mjs`
