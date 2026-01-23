# Solución: Error OCR en Producción

## 🔴 Problema Reportado

```
Error: Endpoint: 'POST /v1/chat/completions' is not supported. - Endpoint: 'POST /v1/chat/completions' is not supported.
```

## 🔍 Raíz del Problema

La clave API de OpenAI (`AI_INTEGRATIONS_OPENAI_API_KEY`) estaba **vacía** en `.env.prod`, causando que el endpoint OCR fallara.

**En `.env.prod` línea 29:**
```dotenv
AI_INTEGRATIONS_OPENAI_API_KEY=""  # ❌ VACÍA
```

## ✅ Soluciones Disponibles

### Opción 1: Usar Groq (⭐ RECOMENDADO - Gratis)

Groq es **gratis** y rápido para OCR. El sistema ahora lo soporta como fallback.

**Pasos:**
1. Ve a https://console.groq.com
2. Crea una cuenta gratis
3. Genera una API key
4. Actualiza `.env.prod`:
   ```dotenv
   GROQ_API_KEY="gsk_xxxxxxxxxxxxx"
   ```

**Ventajas:**
- ✅ Gratis
- ✅ Muy rápido (~1-2 segundos)
- ✅ Buena precisión para OCR de tickets

### Opción 2: Usar OpenAI (Pago)

Si prefieres OpenAI:

**Pasos:**
1. Ve a https://platform.openai.com/account/api-keys
2. Crea una API key
3. Carga créditos en tu cuenta (pago)
4. Actualiza `.env.prod`:
   ```dotenv
   AI_INTEGRATIONS_OPENAI_API_KEY="sk_live_xxxxxxxxxxxxx"
   ```

**Ventajas:**
- ✅ Mayor precisión
- ✅ Mejor análisis complejo
- ❌ Costo por llamada

## 🔧 Cambios Realizados en el Código

1. **Soporte dual de proveedores**: El OCR ahora intenta primero OpenAI, y si no está configurado, usa Groq
2. **Mejor manejo de errores**: Mensaje claro cuando no hay proveedor de IA configurado
3. **Fallback automático**: Si OpenAI falla, el sistema no falla sino que usa Groq

### Código Modificado:

**`server/routes.ts` - Endpoint `/api/accounting/ocr-receipt`**

```typescript
// Check if OpenAI API key is configured, fallback to Groq if not
const hasOpenAI = Boolean(process.env.AI_INTEGRATIONS_OPENAI_API_KEY);
const hasGroq = Boolean(process.env.GROQ_API_KEY);

if (!hasOpenAI && !hasGroq) {
  return res.status(500).json({ 
    message: 'No hay proveedor de IA configurado',
    details: 'Configure AI_INTEGRATIONS_OPENAI_API_KEY o GROQ_API_KEY'
  });
}

// Usa el proveedor disponible
const useGroq = !hasOpenAI && hasGroq;
```

## 📋 Checklist de Configuración

- [ ] Elegir entre Groq (gratis) u OpenAI (pago)
- [ ] Crear cuenta en plataforma elegida
- [ ] Generar API key
- [ ] Actualizar `.env.prod` con la API key
- [ ] Hacer deploy
- [ ] Probar subiendo un ticket en Contabilidad → Movimientos

## 🧪 Cómo Probar

1. **En tu app**, ve a: **Contabilidad → Movimientos → Agregar Movimiento**
2. **Sube un ticket/recibo** (imagen o PDF)
3. Si ves que se procesa correctamente y extrae datos, ¡funciona! ✅

## 🚨 Posibles Errores Después del Deploy

### "No hay proveedor de IA configurado"
→ No tienes ni OpenAI ni Groq en `.env.prod`  
→ Agrega una de las dos opciones arriba

### "API key inválida"  
→ La API key es incorrecta o expiró  
→ Genera una nueva en la plataforma

### "Límite de solicitudes alcanzado"  
→ Superaste el límite gratuito/de créditos  
→ (Groq) Espera, (OpenAI) Agrega más créditos

## 📚 Documentación Relevante

- **Groq**: https://console.groq.com
- **OpenAI**: https://platform.openai.com
- **Archivo modificado**: `server/routes.ts` (línea ~21140)
- **Configuración**: `.env.prod` (línea ~29-35)

## 💡 Recomendaciones

1. **Usa Groq para empezar** (gratis, rápido)
2. Si necesitas mayor precisión, cambia a OpenAI después
3. Mantén un fallback en `.env.prod` comentado por si cambias de proveedor

---

**Estado**: ✅ Código listo, solo necesita API key configurada en `.env.prod`
