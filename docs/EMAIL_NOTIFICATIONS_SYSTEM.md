# Sistema de Notificaciones por Email - Implementación Completa

## 📧 **Sistema Implementado**

Se ha implementado un sistema empresarial de notificaciones por correo electrónico para documentos que requieren firma, similar a lo que usan grandes empresas como Stripe, SendGrid, etc.

### **Características Principales**

✅ **Cola de Correos en Base de Datos**
- Sistema de cola escalable para miles de usuarios
- Procesamiento en segundo plano (background worker)
- No bloquea las peticiones HTTP

✅ **Sistema de Prioridades**
- Prioridad 1-10 (1 = más alta)
- Nóminas tienen prioridad 1 (alta)
- Documentos normales prioridad 3 (normal)

✅ **Reintentos Automáticos**
- Hasta 3 intentos por email
- Exponential backoff (espera progresiva)
- Logs detallados de errores

✅ **Enlaces Directos de Firma**
- Token seguro de un solo uso
- Válido por 7 días
- Un clic en el email → firma directa

✅ **Templates Profesionales**
- HTML responsive
- Diseño moderno con gradientes
- Diferenciados por tipo (nómina vs documento)

✅ **Rate Limiting**
- Control de envío para no saturar SMTP
- Procesamiento por lotes (10 emails cada 10 segundos)

✅ **Limpieza Automática**
- Emails antiguos (>30 días) se borran automáticamente
- Tokens expirados se limpian cada hora

---

## 📁 **Archivos Creados/Modificados**

### Nuevos Archivos:
1. **`migrations/0017_create_email_queue.sql`** - Migración de base de datos
2. **`server/emailQueue.ts`** - Sistema de cola y templates
3. **`server/emailQueueWorker.ts`** - Worker en segundo plano

### Archivos Modificados:
1. **`shared/schema.ts`** - Añadidas tablas `emailQueue` y `documentSignatureTokens`
2. **`server/routes.ts`** - 
   - Inicialización del worker
   - Endpoint de firma con soporte para tokens de email
   - Fix subida documentos a R2
3. **`server/pushNotificationScheduler.ts`** - Integración con cola de emails

---

## 🚀 **Cómo Funciona**

### **Flujo Completo:**

1. **Admin sube documento/nómina** para empleado
2. **Sistema automáticamente:**
   - Sube archivo a Cloudflare R2 ✅
   - Crea registro en BD
   - Genera token seguro de firma
   - Encola email con enlace directo
   - Envía notificación push
3. **Worker en segundo plano:**
   - Cada 10 segundos revisa la cola
   - Procesa 10 emails por lote
   - Envía emails via SMTP
   - Marca como enviados/fallidos
4. **Empleado recibe email:**
   - Con botón "Firmar Documento Ahora"
   - Un clic → lleva directo a la app
   - Token se valida y consume (un solo uso)
   - Firma el documento

---

## 🔧 **Configuración Requerida**

### **Variables de Entorno** (`.env`):
```env
# Ya las tienes configuradas:
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=tu-email@gmail.com
SMTP_PASS=tu-app-password

# URL base de la aplicación
VITE_APP_URL=http://localhost:5000  # o tu dominio en producción
```

### **Aplicar Migración de Base de Datos:**
```bash
# Desde PowerShell en la raíz del proyecto
cd migrations
psql -U postgres -d oficaz < 0017_create_email_queue.sql
```

O si usas Drizzle:
```bash
npm run db:push
```

---

## ✅ **Cómo Probar**

### **1. Reiniciar el Servidor**
El servidor ya debería estar corriendo con los cambios. Si no:
```bash
node start-local.js dev
```

Deberías ver en consola:
```
📧 Starting Email Queue Worker...
✅ Email Queue Worker started successfully
✅ Email queue worker started
```

### **2. Subir un Documento**
1. Ve a **Admin Documents**
2. Sube una nómina o documento para un empleado
3. En consola del servidor verás:
   ```
   ✅ Admin document uploaded to R2: documents/xxx.pdf
   📧 Payroll email queued for user X
   ```

### **3. Espera 10-15 segundos**
El worker procesará la cola automáticamente:
```
📬 Processing 1 emails from queue...
✅ Email sent: Nueva Nómina Pendiente to empleado@test.com
```

### **4. Revisar Email**
El empleado recibirá un email profesional con:
- Título: "💰 Nueva Nómina Pendiente de Firma"
- Botón grande: "✍️ Firmar Documento Ahora"
- Enlace directo que lleva a: `/{companyAlias}/inicio?signDocument={id}&token={token}`

### **5. Firmar desde Email**
Al hacer clic:
1. Se abre la app
2. Token se valida automáticamente
3. Documento se abre para firma
4. Después de firmar, token queda invalidado (un solo uso)

---

## 📊 **Monitoreo**

### **Ver Cola de Emails:**
```sql
SELECT 
  id, 
  to_email, 
  subject, 
  status, 
  attempts, 
  created_at 
FROM email_queue 
ORDER BY created_at DESC 
LIMIT 10;
```

### **Ver Tokens de Firma:**
```sql
SELECT 
  token, 
  document_id, 
  user_id, 
  used, 
  expires_at 
FROM document_signature_tokens 
WHERE NOT used 
ORDER BY created_at DESC;
```

### **Emails Fallidos:**
```sql
SELECT * FROM email_queue WHERE status = 'failed';
```

---

## 🔒 **Seguridad**

✅ **Tokens de Firma:**
- Generados con crypto.randomBytes (64 caracteres hex)
- Un solo uso (se marcan como "used" al consumir)
- Expiran en 7 días
- Validados contra documento, usuario y empresa

✅ **Rate Limiting:**
- 10 emails cada 10 segundos
- Evita saturar SMTP y blacklisting

✅ **Logging Completo:**
- Cada email enviado se registra
- IP tracking para tokens
- Auditoría completa

---

## 🎨 **Personalización de Templates**

Para modificar los emails, edita `server/emailQueue.ts` función `renderEmailTemplate()`.

Templates disponibles:
- `payroll_available` - Nóminas
- `document_signature_required` - Documentos normales
- `signature_reminder` - Recordatorios (futuro)

---

## 📈 **Escalabilidad**

El sistema está diseñado para miles de usuarios:
- ✅ Cola en base de datos (más confiable que Redis para tu escala)
- ✅ Procesamiento por lotes
- ✅ Worker independiente (no afecta web requests)
- ✅ Limpieza automática de registros antiguos
- ✅ Rate limiting para evitar throttling SMTP

Si creces mucho, puedes:
1. Aumentar `BATCH_SIZE` en el worker
2. Usar múltiples workers en paralelo
3. Migrar a servicios como SendGrid/AWS SES

---

## 🐛 **Troubleshooting**

### **Los emails no se envían:**
1. Verifica variables SMTP en `.env`
2. Revisa consola: `❌ Email configuration missing`
3. Verifica la cola: puede estar vacía o fallando

### **Token inválido:**
- Ya fue usado (tokens de un solo uso)
- Expiró (>7 días)
- No coincide documento/usuario

### **Worker no arranca:**
- Error en migración (tablas no existen)
- Error de sintaxis en código TypeScript

---

## 🎯 **Próximos Pasos (Opcionales)**

1. **Recordatorios Automáticos:** Email a los 3 días si no firman
2. **Email de Confirmación:** Cuando firman el documento
3. **Estadísticas:** Dashboard de emails enviados/abiertos
4. **Templates Personalizados:** Por empresa
5. **Webhooks:** Notificar a sistemas externos cuando firman

---

¿Necesitas que implemente alguna de estas mejoras o tienes dudas sobre algo específico?
