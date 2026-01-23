# Guía de Deployment en Replit - Oficaz

## ✅ Correcciones Aplicadas

### 1. Health Check Endpoint
- **Problema**: El deployment fallaba porque no había un endpoint `/` que respondiera rápidamente a las health checks.
- **Solución**: Se ha añadido un endpoint `/` que responde inmediatamente con status 200 a health checks de Replit sin realizar consultas a la base de datos.

### 2. Optimización del Tiempo de Inicio
- **Problema**: El servidor tardaba demasiado en iniciar porque validaba R2 y ejecutaba workers antes de escuchar en el puerto.
- **Solución**: 
  - Validación de R2 movida DESPUÉS de `server.listen()`
  - Background workers (email queue, push notifications, image processor) movidos DESPUÉS de `server.listen()`
  - Ahora el servidor responde a health checks en segundos

### 3. Configuración de NODE_ENV
- **Problema**: El deployment usaba `NODE_ENV=development` en lugar de `production`.
- **Solución**: Actualizado `.replit` para forzar `NODE_ENV=production` durante el build y el start.

### 4. Exportaciones del Schema
- **Problema**: Warnings sobre importaciones indefinidas en `schema.ts`.
- **Nota**: Estas importaciones NO existen en el schema actual y deben ser eliminadas donde se referencien. Los warnings específicos eran:
  - `expenses`
  - `vacationInfo`  
  - `documentNotifications`
  - `crmContacts`

## 📋 Pasos para Deployment en Replit

### Pre-requisitos
Asegúrate de tener configuradas las siguientes variables de entorno en Replit Secrets:

```env
# Database
DATABASE_URL=postgresql://...

# Stripe
STRIPE_SECRET_KEY=sk_live_... o sk_test_...
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_... o pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# JWT
JWT_SECRET=tu-secreto-seguro-aqui

# Email (Gmail)
GMAIL_USER=tu-email@gmail.com
GMAIL_APP_PASSWORD=tu-app-password

# Cloudflare R2
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=...
R2_ENDPOINT=https://....r2.cloudflarestorage.com
R2_PUBLIC_URL=https://...

# Push Notifications (opcional)
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...

# Groq/OpenAI (opcional)
GROQ_API_KEY=...
OPENAI_API_KEY=...

# IMPORTANTE: NO incluir NODE_ENV aquí - se configura automáticamente
```

### Deployment Steps

1. **Conecta tu repositorio a Replit**
   - Importa desde GitHub o sube los archivos

2. **Configura los Secrets**
   - Ve a la pestaña "Secrets" en Replit
   - Añade todas las variables de entorno listadas arriba

3. **Build y Deploy**
   ```bash
   # El archivo .replit ya está configurado para:
   # - Ejecutar NODE_ENV=production durante el build
   # - Ejecutar NODE_ENV=production durante el start
   # - Escuchar en puerto 5000 (mapeado a 80 externamente)
   ```

4. **Verifica el Health Check**
   - Una vez desplegado, accede a `https://tu-app.repl.co/`
   - Si ves un 404, es correcto (las requests normales se manejan por Vite)
   - Para verificar el health check funciona, usa:
     ```bash
     curl -H "User-Agent: Replit-Health-Check" https://tu-app.repl.co/
     ```
   - Deberías ver: `{"status":"ok","timestamp":"...","service":"oficaz"}`

5. **Monitorea los Logs**
   - Los logs deberían mostrar:
     ```
     serving on port 5000
     ✅ Server is ready to accept health checks
     [init] Validating object storage...
     [init] Starting background services...
     [init] Background services started
     [init] Starting background worker...
     [init] Background worker started
     🎉 All services initialized - application ready
     ```

## 🔍 Troubleshooting

### Health Checks Fallando
- **Síntoma**: Deployment timeout, "health checks failing"
- **Solución**: 
  - Verifica que el puerto 5000 esté mapeado correctamente en `.replit`
  - Revisa los logs para ver si hay errores durante el startup
  - Asegúrate de que `NODE_ENV=production` esté configurado

### Server Tarda Demasiado en Iniciar
- **Síntoma**: Timeout durante deployment
- **Solución**: 
  - Los cambios ya aplicados deberían resolver esto
  - Si persiste, verifica que la conexión a la base de datos funcione
  - Considera aumentar el timeout en Replit (si es posible)

### Errores de Importación en Schema
- **Síntoma**: Build warnings sobre imports indefinidos
- **Solución**: 
  - Busca referencias a `expenses`, `vacationInfo`, `documentNotifications`, `crmContacts`
  - Elimínalas o reemplázalas con las exportaciones correctas del schema

### Errores de Stripe
- **Síntoma**: "401 Unauthorized" en Stripe Elements
- **Solución**:
  - Verifica que las keys coincidan (ambas test o ambas live)
  - Formato correcto: `pk_test_...` con `sk_test_...` O `pk_live_...` con `sk_live_...`

## 📊 Optimizaciones Aplicadas

1. **Inicio Secuencial**:
   - Servidor HTTP escucha primero → Health checks pasan
   - Background services se inician después
   - Validaciones de R2 se hacen después

2. **Health Check Ligero**:
   - Sin consultas a base de datos
   - Respuesta instantánea (< 10ms)
   - Solo detecta requests de Replit

3. **Manejo de Errores Graceful**:
   - Si R2 falla, el servidor sigue funcionando
   - Si workers fallan, se logea pero no crash
   - WebSocket se inicializa independientemente

## 🚀 Próximos Pasos

Después del deployment:
1. Configura el dominio personalizado en Replit (opcional)
2. Configura los webhooks de Stripe con la URL de producción
3. Verifica que los emails se envíen correctamente
4. Prueba el registro y login de usuarios
5. Verifica que las notificaciones push funcionen (si configuradas)

## 📝 Notas Importantes

- El health check solo responde a requests con User-Agent de Replit
- Las requests normales de navegador obtienen 404 en `/` (correcto - Vite las maneja)
- El servidor escucha en `0.0.0.0:5000` en Replit (mapeado a puerto 80 externamente)
- Los logs son verbosos para facilitar debugging en producción
