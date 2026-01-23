# 🔔 Configuración del Webhook de Stripe - Guía Paso a Paso

## ¿Por qué necesitas esto?

El webhook permite que Stripe te notifique **instantáneamente** cuando:
- Un trial está a punto de expirar (3 días antes)
- Un trial se convierte en pago
- Un pago falla
- Una suscripción se cancela

**Sin webhook:** Revisar cada hora (desperdicio de recursos)
**Con webhook:** Notificación instantánea (0 delay)

---

## 📋 Pasos para Configurar en Producción

### 1. Ve al Dashboard de Stripe

Abre en tu navegador:
```
https://dashboard.stripe.com/webhooks
```

> **Importante:** Asegúrate de estar en modo **LIVE** (no Test) si usas claves de producción (`sk_live_...`)

### 2. Crea un Nuevo Webhook

1. Click en **"Add endpoint"** (botón azul)
2. En **"Endpoint URL"** ingresa:
   ```
   https://oficaz.es/api/webhooks/stripe
   ```
   
   > ⚠️ **Cambia `oficaz.es` por tu dominio real** si usas otro dominio

3. En **"Description"** (opcional):
   ```
   Trial expiration and subscription events
   ```

### 3. Selecciona los Eventos a Escuchar

En la sección **"Select events to listen to"**, busca y selecciona:

- ✅ `customer.subscription.trial_will_end`
- ✅ `customer.subscription.updated`
- ✅ `invoice.payment_failed`
- ✅ `customer.subscription.deleted`

> 💡 **Tip:** Usa el buscador para encontrarlos rápidamente

### 4. Guarda el Endpoint

Click en **"Add endpoint"** al final de la página

### 5. Copia el Signing Secret

1. Después de crear el endpoint, verás una sección **"Signing secret"**
2. Click en **"Reveal"** o **"Click to reveal"**
3. Copia el valor (empieza con `whsec_...`)

**Ejemplo:**
```
whsec_1234567890abcdefghijklmnopqrstuvwxyz
```

### 6. Agrega el Secret al .env

Abre el archivo `.env` y reemplaza:

```bash
# ANTES:
STRIPE_WEBHOOK_SECRET=whsec_PENDIENTE_CONFIGURAR_EN_STRIPE_DASHBOARD

# DESPUÉS (con tu secret real):
STRIPE_WEBHOOK_SECRET=whsec_1234567890abcdefghijklmnopqrstuvwxyz
```

### 7. Reinicia el Servidor

```powershell
# Detén el servidor (Ctrl+C en la terminal)
# Reinicia:
node start-local.js dev
```

---

## 🧪 Cómo Probar que Funciona

### Opción 1: Desde el Dashboard de Stripe (Más fácil)

1. Ve a: https://dashboard.stripe.com/webhooks
2. Click en tu webhook recién creado
3. Scroll hasta **"Send test webhook"**
4. Selecciona evento: `customer.subscription.trial_will_end`
5. Click **"Send test webhook"**
6. Verifica en los logs de tu servidor que apareció:
   ```
   📥 Stripe webhook received: customer.subscription.trial_will_end
   ```

### Opción 2: Con Stripe CLI (Más avanzado)

Si quieres probar localmente **antes** de configurar en producción:

#### Instalar Stripe CLI (Windows)

1. Descarga desde: https://stripe.com/docs/stripe-cli
2. O con Scoop (si lo tienes):
   ```powershell
   scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git
   scoop install stripe
   ```

#### Configurar Stripe CLI

```powershell
# Login a tu cuenta de Stripe
stripe login

# Esto abrirá tu navegador para autorizar
```

#### Escuchar Webhooks Localmente

```powershell
# Forwarding de webhooks a localhost
stripe listen --forward-to localhost:5000/api/webhooks/stripe

# Esto mostrará un webhook secret temporal (empieza con whsec_)
# Cópialo y úsalo en tu .env LOCAL para testing
```

#### Enviar Eventos de Prueba

En otra terminal:

```powershell
# Simular trial a punto de expirar
stripe trigger customer.subscription.trial_will_end

# Simular actualización de suscripción
stripe trigger customer.subscription.updated

# Simular pago fallido
stripe trigger invoice.payment_failed
```

Deberías ver en los logs de tu servidor:
```
📥 Stripe webhook received: customer.subscription.trial_will_end
⏳ Trial ending soon for subscription: sub_xxxxxxxxxxxxx
```

---

## ✅ Verificación Final

### En Producción

1. Ve a: https://dashboard.stripe.com/webhooks
2. Click en tu webhook
3. Verás una tabla de **"Recent webhook deliveries"**
4. Cada evento debe mostrar:
   - ✅ **200 OK** (verde) = Funcionando
   - ❌ **4xx/5xx** (rojo) = Error (revisa logs)

### En los Logs del Servidor

Deberías ver mensajes como:

```
✅ Scheduler started: Alarms+Reminders=event-driven, Incomplete/Deletions=daily-cron, Trials=hourly-cron
📥 Stripe webhook received: customer.subscription.trial_will_end
⏳ Trial ending soon for subscription: sub_1234567890
```

---

## 🚨 Solución de Problemas

### Error: "Webhook signature verification failed"

**Causa:** El `STRIPE_WEBHOOK_SECRET` en `.env` no coincide con el de Stripe

**Solución:**
1. Ve a https://dashboard.stripe.com/webhooks
2. Click en tu webhook
3. Copia el signing secret de nuevo
4. Reemplaza en `.env`
5. Reinicia el servidor

### Error: "404 Not Found" en Stripe Dashboard

**Causa:** La URL del webhook es incorrecta

**Solución:**
1. Verifica que tu dominio esté correcto
2. Asegúrate que el servidor esté corriendo
3. Verifica que no haya firewall bloqueando `/api/webhooks/stripe`

### No recibo eventos

**Causa:** Stripe no puede alcanzar tu servidor

**Checklist:**
- [ ] El servidor está corriendo en producción
- [ ] El dominio es accesible públicamente (no localhost)
- [ ] HTTPS está configurado (Stripe requiere SSL)
- [ ] No hay firewall bloqueando webhooks de Stripe

---

## 🎯 Próximos Pasos (Después de Configurar)

Una vez que el webhook esté funcionando correctamente:

1. **Monitorear por 1-2 semanas** en producción
2. **Verificar que no hay errores** en Stripe Dashboard
3. **Remover el cron de trials** (ya no es necesario):
   
   En `server/pushNotificationScheduler.ts`, comenta:
   ```typescript
   // ✅ Cron obsoleto - reemplazado por webhooks de Stripe
   // global.pushSchedulerTrialTask = cron.schedule('0 * * * *', async () => {
   //   await processExpiredTrials();
   // });
   ```

---

## 📚 Referencias

- [Stripe Webhooks Documentation](https://stripe.com/docs/webhooks)
- [Testing Webhooks](https://stripe.com/docs/webhooks/test)
- [Stripe CLI](https://stripe.com/docs/stripe-cli)
- [Event Types Reference](https://stripe.com/docs/api/events/types)

---

**¿Necesitas ayuda?** Revisa los logs del servidor o contacta con soporte técnico.
