# 🎯 Guía de Configuración - App Oficaz Android

## Problemas Resueltos

✅ **Íconos de la app** - Ahora embebidos en 5 resoluciones (mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi)
✅ **Logo en splash screen** - Configurado con fondo azul (#007AFF) y spinner blanco
✅ **Logo en la app** - Disponible en `/assets/logo.png` localmente

## Problema: Error al Iniciar Sesión

Si la app muestra errores de conexión con la base de datos, es usualment por conectividad.

### ✅ Solución 1: Emulador Android

**Problema:** El emulador no puede acceder al servidor local
**Solución:**

1. Asegurate que el servidor esté corriendo:
```bash
npm run dev
```

2. En el emulador, accede a `http://10.0.2.2:5000` en lugar de `localhost`
   - `10.0.2.2` es la IP especial para acceder al host desde el emulador Android
   - Capacitor lo detecta automáticamente

3. Verifica que el servidor esté escuchando en `0.0.0.0`:
```
✅ Server listening on port 5000 - health checks ready!
```

### ✅ Solución 2: Dispositivo Real Android

**Problema:** El dispositivo no puede conectarse a `localhost`
**Opciones:**

**Opción A: IP Local (desarrollado)**
1. Encuentra la IP de tu máquina:
```powershell
ipconfig
# Busca "IPv4 Address: 192.168.x.x"
```

2. Configura en `capacitor.config.ts`:
```typescript
server: {
  url: `http://192.168.x.x:5000`,
}
```

3. Asegurate que el dispositivo y la máquina estén en la misma red
4. Ejecuta `npx cap sync android`
5. Reconstruye la app

**Opción B: Ngrok (remoto públicamente)**
1. Instala Ngrok: https://ngrok.com
2. Expone tu servidor:
```bash
ngrok http 5000
# Output: https://xxxx-xx-xxx-x-xx.ngrok.io
```

3. Configura en `capacitor.config.ts`:
```typescript
server: {
  url: `https://xxxx-xx-xxx-x-xx.ngrok.io`,
  cleartext: false,
}
```

4. Sincroniza y reconstruye

### Debug: Ver Logs de la App

En el emulador/dispositivo, abre la consola:
```bash
adb logcat | grep -i oficaz
```

## Problemas de Conectividad - Checklist

- [ ] Servidor local corriendo (`npm run dev`)
- [ ] Puerto 5000 accesible (`netstat -an | find ":5000"`)
- [ ] Firewall permite tráfico en puerto 5000
- [ ] Variables de ambiente configuradas (`.env` con DATABASE_URL, Stripe, R2, etc.)
- [ ] Emulador usa `10.0.2.2` para localhost
- [ ] Dispositivo real en la misma red o usa ngrok/túnel
- [ ] Base de datos Neon accesible desde tu red
- [ ] R2 credenciales válidas para descargas de archivos

## Conectividad Neon

Si obtienes error `PostgreSQL connection failed`:

1. Verifica la URL en `.env`:
```
DATABASE_URL=postgresql://...@ep-young-mouse-...c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require
```

2. Prueba conexión desde tu máquina:
```bash
psql "postgresql://neondb_owner:npg_...@ep-young-mouse-...c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require"
```

3. Si funciona en tu máquina pero no en la app:
   - La app comparte el servidor Node.js
   - El servidor usa `DATABASE_URL` automáticamente (via Drizzle)
   - Verifica logs del servidor: `npm run dev` (output en consola)

## Conectividad R2 (Cloudflare)

Si las imágenes no cargan:

1. Verifica credenciales en `.env`:
```
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_ACCOUNT_ID=...
R2_BUCKET_NAME=oficaz-storage
```

2. Prueba acceso al bucket:
```bash
curl https://pub-xxxx.r2.dev/test.jpg
```

3. En la app Android, se usa el logo embebido (`/assets/logo.png`) como fallback

## Arquivos Generados

```
android/app/src/main/res/
├── mipmap-mdpi/
│   ├── ic_launcher.png (48x48)
│   ├── ic_launcher_foreground.png (31x31)
│   └── ic_launcher_round.png (48x48)
├── mipmap-hdpi/
│   └── ... (72x72)
├── mipmap-xhdpi/
│   └── ... (96x96)
├── mipmap-xxhdpi/
│   └── ... (144x144)
├── mipmap-xxxhdpi/
│   └── ... (192x192)
└── drawable/
    └── logo.png (256x256)
```

## Script de Build

Para reconstruir todo cuando cambies configuración:

```bash
scripts/build-android.bat build
```

Esto:
1. Compila el web frontend (Vite)
2. Genera íconos
3. Sincroniza con Capacitor
4. Construye el APK

## Próximos Pasos

1. Prueba la app en el emulador/dispositivo:
   - Verifica que aparezca el icono ✓
   - Verifica que el splash sea azul + spinner blanco ✓
   - Intenta iniciar sesión (verifica conectividad)

2. Para Google Play Store:
   - Usa `scripts/build-android.bat` con AAB (release)
   - Sube a Google Play Console
   - Espera revisión (24-72 horas)

## Soporte

Errores comunes:

| Error | Solución |
|-------|----------|
| `Cannot connect to server` | Verifica puerto 5000 está abierto |
| `PostgreSQL connection failed` | Verifica DATABASE_URL en .env |
| `Login fails but web works` | Comprueba conectividad desde emulador a host |
| `No images load` | Verifica R2 credenciales o usa logo embebido |
| `Splash screen not showing` | Reconstruye: `scripts/build-android.bat build` |

