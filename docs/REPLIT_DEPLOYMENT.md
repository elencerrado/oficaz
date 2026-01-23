# Guía de Despliegue en Replit

## 📋 Archivos que copiar a Replit

### Carpetas principales
- `client/` - Frontend React
- `server/` - Backend Express
- `public/` - Assets estáticos
- `shared/` - Tipos TypeScript compartidos
- `migrations/` - Migraciones de base de datos
- `scripts/` - Scripts de utilidades

### Archivos de configuración raíz
```
package.json
tsconfig.json
vite.config.ts
drizzle.config.ts
tailwind.config.ts
postcss.config.js
components.json
.replit (archivo de configuración de Replit)
start-replit.js (script de inicio para Replit)
.env (crear con tus credenciales)
```

### ❌ NO copiar
- `node_modules/` - Se instala automáticamente
- `dist/` - Se genera con el build
- `vite.config.ts.timestamp-*` - Archivos temporales corruptos
- `.git/` - Control de versiones
- `package-lock.json` - Replit usa npm install sin lock

## 🚀 Pasos de despliegue

### 1. Preparar archivos en local

```powershell
# Limpiar archivos temporales de Vite
rm -f vite.config.ts.timestamp-*
```

### 2. Copiar archivos a Replit

Copia las carpetas y archivos listados arriba a tu Replit.

### 3. Configurar variables de entorno en Replit

Ve a **Secrets (🔐)** en el panel izquierdo de Replit y añade:

```env
NODE_ENV=development
PORT=5000
DATABASE_URL=postgresql://...
SESSION_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://tu-replit-url.replit.dev/api/auth/google/callback
# ... resto de variables de tu .env
```

### 4. Arrancar la aplicación

Replit debería ejecutar automáticamente `node start-replit.js` según el archivo `.replit`.

Si necesitas ejecutarlo manualmente en la **Shell** de Replit:

```bash
# Instalar dependencias (solo primera vez)
npm install

# Arrancar servidor
node start-replit.js
```

### 5. Aplicar migraciones de base de datos

```bash
npm run db:push
```

## 🐛 Solución de problemas

### Error 502 (Bad Gateway)

**Síntomas:**
```
GET /@vite/client net::ERR_ABORTED 502 (Bad Gateway)
GET /src/main.tsx net::ERR_ABORTED 502 (Bad Gateway)
```

**Causas comunes:**
1. Vite no está corriendo
2. `NODE_ENV` no está configurado como `development`
3. Puerto incorrecto

**Solución:**

1. **Verifica los logs en la consola de Replit:**
   ```
   🔍 Environment: NODE_ENV=development, app.get("env")=development, isDevelopment=true
   🚀 Starting Vite server...
   ✅ Vite setup completed successfully
   ```

2. **Si ves `isDevelopment=false`**, añade en Secrets:
   ```
   NODE_ENV=development
   ```

3. **Reinicia el servidor:** Haz clic en "Stop" y luego "Run" en Replit

### Error EADDRINUSE (Puerto ocupado)

**Solución en Replit Shell:**
```bash
# Matar procesos de Node
killall -9 node
killall -9 tsx

# Reiniciar
node start-replit.js
```

### Error de CORS

**Síntoma:** `Access-Control-Allow-Origin` errors

**Solución:** El código ya detecta Replit automáticamente vía `REPLIT_DOMAINS`.
Verifica que en el log aparezca:
```
🔧 Detected Replit environment, binding to 0.0.0.0
```

### Vite Timestamp Error

```
Uncaught Error: @vitejs/plugin-react can't detect preamble
```

**Solución:**
```bash
rm -f vite.config.ts.timestamp-*
```

### Acceso desde iOS no carga

**Verifica:**
1. El endpoint `/api/diagnostics` muestra `trustProxy: 1`
2. La URL usa HTTPS (no HTTP)
3. El navegador iOS no tiene bloqueador de contenido activo

## 📊 Endpoints de diagnóstico

### `/api/diagnostics`
Muestra información del servidor:
```json
{
  "environment": "development",
  "trustProxy": 1,
  "port": 5000,
  "platform": "linux",
  "requestDetails": {
    "ip": "...",
    "protocol": "https",
    "host": "..."
  }
}
```

### iOS Debug Logs

En la consola del navegador iOS (Safari):
```javascript
window.getIOSDebugLogs()
```

## ✅ Checklist de verificación

- [ ] Archivos copiados correctamente (client/, server/, public/, shared/)
- [ ] Variables de entorno configuradas en Secrets
- [ ] `NODE_ENV=development` configurado
- [ ] `npm install` completado sin errores
- [ ] Servidor arrancado con `node start-replit.js`
- [ ] Logs muestran `✅ Vite setup completed successfully`
- [ ] Logs muestran `🔧 Detected Replit environment, binding to 0.0.0.0`
- [ ] Migraciones aplicadas con `npm run db:push`
- [ ] `/api/diagnostics` responde correctamente
- [ ] Aplicación carga en navegador desktop
- [ ] Aplicación carga en navegador iOS
- [ ] PDFs se visualizan correctamente en iOS

## 🔧 Configuración técnica aplicada

### vite.config.ts
```typescript
server: {
  host: "0.0.0.0", // Permite conexiones externas en Replit
  port: 5173,
  hmr: {
    clientPort: process.env.REPLIT_DOMAINS ? 443 : 5173,
  },
}
```

### server/index.ts
```typescript
// Trust proxy en Replit
if (process.env.NODE_ENV === 'production' || process.env.REPLIT_DOMAINS) {
  app.set('trust proxy', 1);
}

// Detección de Replit para binding
const isReplit = process.env.REPLIT_DOMAINS !== undefined;
const host = isReplit ? '0.0.0.0' : '127.0.0.1';
```

### CORS configurado para Replit
```typescript
const isReplit = process.env.REPLIT_DOMAINS !== undefined;
const isDevelopment = process.env.NODE_ENV === 'development' || isReplit;
```

## 📞 Soporte

Si encuentras problemas:
1. Revisa los logs de la consola de Replit
2. Ejecuta `/api/diagnostics` y comparte el resultado
3. En iOS, ejecuta `window.getIOSDebugLogs()` en Safari Web Inspector
