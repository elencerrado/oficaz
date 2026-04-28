# Variables de Ambiente - Oficaz App

## Variables del Servidor

### Base de Datos (REQUERIDO)
```env
# PostgreSQL - Neon, Supabase, o cualquier PostgreSQL
DATABASE_URL=postgresql://user:password@host.neon.tech/dbname?sslmode=require
```

### Stripe - Pagos (REQUERIDO)
```env
# Claves privadas (solo servidor)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Claves públicas (puede estar en cliente)
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

### Cloudflare R2 - Almacenamiento (REQUERIDO)
```env
# Credenciales R2
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_ACCOUNT_ID=...
R2_BUCKET_NAME=oficaz-storage
```

### Email SMTP (REQUERIDO)
```env
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=tu@email.com
SMTP_PASS=contraseña
FEEDBACK_RECIPIENT_EMAIL=soporte@email.com
```

### Push Notifications (REQUERIDO)
```env
# Genera con: npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
```

## Variables del Cliente

### API URL (Opcional - solo si se necesita)
```env
# Para conectar a un servidor remoto desde el cliente
# Déjalo vacío para usar URLs relativas (mismo origen)
# Useful para Capacitor/Android en emulador

VITE_API_URL=http://10.0.2.2:5000  # Emulador Android
# VITE_API_URL=http://192.168.x.x:5000  # Dispositivo real en red local
# VITE_API_URL=https://api.oficaz.es  # Producción
```

### Stripe Publishable Key (Cliente)
```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

## Configuración por Ambiente

### Desarrollo Local
```env
DATABASE_URL=postgresql://neondb_owner:...@ep-young-mouse-....neon.tech/neondb?sslmode=require
STRIPE_SECRET_KEY=sk_test_...
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_ACCOUNT_ID=...
R2_BUCKET_NAME=oficaz-storage-dev
VITE_API_URL=  # Vacío = URLs relativas
```

### Desarrollo Android Emulador
```env
# Usar VITE_API_URL para apuntar al host
VITE_API_URL=http://10.0.2.2:5000
# Resto igual a desarrollo
```

### Producción (Replit/Servidor Remoto)
```env
REPLIT_DEPLOYMENT=1
NODE_ENV=production
PORT=5000

DATABASE_URL=postgresql://...@prod-neon.....neon.tech/neondb?sslmode=require
STRIPE_SECRET_KEY=sk_live_...
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_ACCOUNT_ID=...
R2_BUCKET_NAME=oficaz-storage-prod

# API URL puede estar vacío (mismo origen en producción)
VITE_API_URL=
```

## Variables del Sistema (No editar)
```env
# Android en Capacitor
CAPACITOR_ANDROID_SCHEME=https
CAPACITOR_ANDROID_CLEARTEXT=true  # Solo desarrollo

# Node.js
NODE_ENV=development|production
PORT=5000

# Replit
REPLIT_DEPLOYMENT=1  # Auto-detectado
REPLIT_CLUSTER=...   # Auto-detectado
```

## Cómo Usar

1. **Copia el archivo base:**
   ```bash
   cp .env.example .env
   ```

2. **Rellena tus valores:**
   ```bash
   nano .env
   # o abre con tu editor favorito
   ```

3. **Reinicia el servidor:**
   ```bash
   npm run dev
   ```

4. **Para Android:**
   ```bash
   scripts/build-android.bat build
   ```

## Debugging

Para ver las variables de ambiente cargadas:

```bash
# En desarrollo
npm run dev
# Busca en console: "DEV: Environment variables loaded"

# En código
import.meta.env  # Acceso en cliente
process.env      # Acceso en servidor
```

## Seguridad

⚠️ **NUNCA** commits `.env` archivo
- Las claves están en `.gitignore`
- Mantén claves privadas seguras
- En producción, usa variables del sistema

Verificar `.gitignore`:
```
.env
.env.local
.env.*.local
```
