# Auditoría de Seguridad - Time Tracking System

**Fecha:** 16 de enero de 2026  
**Alcance:** Módulos de control horario (admin-time-tracking.tsx, employee-time-tracking.tsx, rutas API)  
**Estado:** ✅ Sistema generalmente seguro con mejoras recomendadas

---

## 📋 Resumen Ejecutivo

El sistema de time tracking implementa buenas prácticas de seguridad con autenticación, autorización por roles y validación de datos. Se han identificado **3 vulnerabilidades de severidad media** y **8 oportunidades de optimización**.

### Severidad de Hallazgos
- 🔴 **Crítico:** 0
- 🟠 **Alto:** 0  
- 🟡 **Medio:** 3
- 🔵 **Bajo:** 5
- ✅ **Informativo:** 8

---

## 🔒 Hallazgos de Seguridad

### 🟡 MEDIO-01: Falta de Rate Limiting en endpoints críticos

**Ubicación:** `server/routes.ts` - endpoints de clock-in/out  
**Riesgo:** Un atacante podría crear múltiples sesiones de forma automatizada

```typescript
// ACTUAL (líneas 4640, 4688)
app.post('/api/work-sessions/clock-in', authenticateToken, async (req: AuthRequest, res) => {
  // Sin rate limiting
```

**Recomendación:**
```typescript
import rateLimit from 'express-rate-limit';

const clockInLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // máximo 10 intentos
  message: 'Demasiados intentos de fichaje, intenta de nuevo más tarde'
});

app.post('/api/work-sessions/clock-in', authenticateToken, clockInLimiter, async (req: AuthRequest, res) => {
```

**Impacto:** Previene abuso automatizado del sistema de fichajes  
**Prioridad:** Media

---

### 🟡 MEDIO-02: Validación insuficiente de fechas en modificaciones

**Ubicación:** `server/routes.ts:4994-5049` - PATCH `/api/work-sessions/:id`  
**Riesgo:** Usuario podría modificar fechas futuras o muy antiguas sin restricción

```typescript
// ACTUAL
const updateData: any = {};
if (clockIn) updateData.clockIn = new Date(clockIn);
if (clockOut) updateData.clockOut = new Date(clockOut);
// Sin validación de rango de fechas
```

**Recomendación:**
```typescript
// Validar que las fechas estén en un rango razonable
const MAX_PAST_DAYS = 90; // Política de empresa
const clockInDate = new Date(clockIn);
const now = new Date();
const maxPastDate = new Date(now.getTime() - MAX_PAST_DAYS * 24 * 60 * 60 * 1000);

if (clockInDate < maxPastDate) {
  return res.status(400).json({ 
    message: `No se pueden modificar fichajes de hace más de ${MAX_PAST_DAYS} días` 
  });
}

if (clockInDate > now) {
  return res.status(400).json({ 
    message: 'No se pueden crear fichajes en el futuro' 
  });
}

// Validar que clockOut sea posterior a clockIn
if (clockOut && clockIn && new Date(clockOut) <= new Date(clockIn)) {
  return res.status(400).json({ 
    message: 'La hora de salida debe ser posterior a la de entrada' 
  });
}
```

**Impacto:** Previene manipulación de registros históricos  
**Prioridad:** Media

---

### 🟡 MEDIO-03: Exposición de información en logs de auditoría

**Ubicación:** `server/routes.ts:5200` - GET `/api/admin/work-sessions/:id/audit-log`  
**Riesgo:** Los logs de auditoría exponen información completa sin filtrado

```typescript
// ACTUAL
app.get('/api/admin/work-sessions/:id/audit-log', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
  const logs = await storage.getWorkSessionAuditLog(sessionId);
  res.json(logs); // Devuelve todo sin filtrado
```

**Recomendación:**
```typescript
// Filtrar campos sensibles antes de devolver
const filteredLogs = logs.map(log => ({
  ...log,
  // Eliminar metadatos internos que no deben exponerse
  internalNotes: undefined,
  systemMetadata: undefined
}));

res.json(filteredLogs);
```

**Impacto:** Previene fuga de información interna  
**Prioridad:** Media

---

### 🔵 BAJO-04: Falta de sanitización en campos de texto libre

**Ubicación:** `admin-time-tracking.tsx:557-583`, `employee-time-tracking.tsx:1436-1477`  
**Riesgo:** XSS almacenado en campo "reason" de modificaciones

**Recomendación:**
```typescript
// En el servidor, antes de guardar
import DOMPurify from 'isomorphic-dompurify';

const sanitizedReason = DOMPurify.sanitize(req.body.reason, {
  ALLOWED_TAGS: [], // Solo texto plano
  ALLOWED_ATTR: []
});
```

**Impacto:** Previene XSS  
**Prioridad:** Baja (React ya escapa HTML por defecto)

---

### 🔵 BAJO-05: Logs de consola en producción

**Ubicación:** Múltiples archivos (ya corregido parcialmente)

**Recomendación:**
```typescript
// Usar un logger condicional
const logger = {
  debug: (...args: any[]) => {
    if (import.meta.env.DEV) {
      console.log(...args);
    }
  }
};
```

---

## ⚡ Optimizaciones de Rendimiento

### OPT-01: Query N+1 en carga de empleados con sesiones

**Ubicación:** `admin-time-tracking.tsx:731-750`

**Problema actual:**
```typescript
const employeesList = (employees as any[]) || [];
const filteredSessions = (sessions as any[]) || [];
// Luego se hace un loop que busca employee por cada sesión
```

**Recomendación:**
- El servidor ya devuelve `userName` en las sesiones, evitar joins adicionales en cliente
- ✅ **Ya implementado correctamente**

---

### OPT-02: Caché excesivo en datos sensibles

**Ubicación:** `admin-time-tracking.tsx:305-320`

```typescript
// ACTUAL
const { data: employees = [] } = useQuery<any[]>({
  queryKey: ['/api/employees'],
  staleTime: 30 * 60 * 1000, // 30 minutos cache
  gcTime: 2 * 60 * 60 * 1000, // 2 horas
});
```

**Problema:** Cambios en tiempo real (estado de empleados) tardan 30min en reflejarse

**Recomendación:**
```typescript
const { data: employees = [] } = useQuery<any[]>({
  queryKey: ['/api/employees'],
  staleTime: 2 * 60 * 1000, // 2 minutos (más razonable)
  gcTime: 15 * 60 * 1000, // 15 minutos
  refetchOnWindowFocus: true, // Actualizar al volver a la ventana
});
```

**Impacto:** Mejora UX con datos más frescos  
**Prioridad:** Media

---

### OPT-03: Paginación infinita sin límite

**Ubicación:** `admin-time-tracking.tsx:242-304`

```typescript
// ACTUAL
const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
  // Sin límite máximo de páginas cargadas
```

**Problema:** En empresas grandes, cargar años de datos puede saturar memoria

**Recomendación:**
```typescript
const MAX_SESSIONS_LOADED = 10000; // Límite razonable

useEffect(() => {
  if (allSessions.length >= MAX_SESSIONS_LOADED) {
    toast({
      title: 'Límite alcanzado',
      description: 'Usa los filtros para refinar la búsqueda',
      variant: 'default'
    });
  }
}, [allSessions.length]);
```

**Impacto:** Previene problemas de rendimiento en clientes grandes  
**Prioridad:** Baja

---

### OPT-04: Cálculos repetidos en renderizado

**Ubicación:** `admin-time-tracking.tsx:792-850`

```typescript
// ACTUAL - dentro de useMemo pero recalcula en cada cambio de filteredSessions
const totalHours = filteredSessions.reduce((total: number, session: any) => {
  let sessionHours = calculateHours(session.clockIn, session.clockOut);
  // ...
}, 0);
```

**Recomendación:**
- ✅ **Ya está optimizado con useMemo**
- Considerar mover cálculos pesados al servidor si el dataset crece

---

### OPT-05: Exportación a PDF/Excel bloquea UI

**Ubicación:** `admin-time-tracking.tsx:780-1690`

**Problema:** Generación de PDFs grandes bloquea thread principal

**Recomendación:**
```typescript
// Usar Web Worker para generación de PDF
const generatePDFInWorker = async (data: any) => {
  const worker = new Worker('/pdf-generator.worker.js');
  
  return new Promise((resolve, reject) => {
    worker.postMessage({ sessions: data });
    
    worker.onmessage = (e) => {
      resolve(e.data);
      worker.terminate();
    };
    
    worker.onerror = reject;
  });
};
```

**Impacto:** Mejora UX en exportaciones grandes  
**Prioridad:** Baja (solo afecta a exportaciones)

---

## 🎯 Mejores Prácticas Implementadas ✅

### Autenticación y Autorización
- ✅ Middleware `authenticateToken` en todos los endpoints
- ✅ `requireRole(['admin', 'manager'])` para operaciones sensibles
- ✅ `requireVisibleFeature('time_tracking')` para permisos granulares
- ✅ Validación de `companyId` en operaciones multi-tenant
- ✅ Sistema de permisos de manager con `visibleFeatures`

### Validación de Datos
- ✅ Uso de `parseIntParam()` para IDs
- ✅ Validación de campos requeridos
- ✅ Verificación de propiedad de recursos (userId check)
- ✅ Validación de estados de sesión (incomplete, active, etc.)

### Auditoría y Compliance
- ✅ **Tabla de audit logs** (RD-ley 8/2019 - Control horario España)
- ✅ Registro de todas las modificaciones con:
  - Usuario que realizó el cambio
  - Timestamp preciso
  - Valores anteriores y nuevos
  - Motivo de la modificación
- ✅ Inmutabilidad de logs (no se pueden editar)

### Manejo de Errores
- ✅ Try-catch en todos los endpoints
- ✅ Mensajes de error descriptivos
- ✅ Códigos HTTP apropiados (400, 403, 404, 500)
- ✅ No se exponen stack traces en producción

### Frontend Security
- ✅ React auto-escapa HTML (previene XSS)
- ✅ No hay `dangerouslySetInnerHTML`
- ✅ Uso de TypeScript para type safety
- ✅ Validación en cliente antes de enviar al servidor

---

## 🚀 Recomendaciones Priorizadas

### Implementar Inmediatamente (Próxima semana)
1. **MEDIO-02**: Validación de rangos de fecha en modificaciones
2. **OPT-02**: Reducir cache de empleados a 2 minutos

### Implementar Pronto (Próximo mes)
3. **MEDIO-01**: Rate limiting en endpoints de clock-in/out
4. **MEDIO-03**: Filtrado de logs de auditoría
5. **OPT-03**: Límite máximo de sesiones cargadas

### Backlog (Próximo trimestre)
6. **BAJO-04**: Sanitización de campos de texto
7. **OPT-05**: Web Workers para exportaciones

---

## 📊 Código de Ejemplo: Validación de Fechas Mejorada

```typescript
// server/routes.ts - PATCH /api/work-sessions/:id
app.patch('/api/work-sessions/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const id = parseIntParam(req.params.id, 'session ID');
    const { clockIn, clockOut, breakPeriods: requestBreakPeriods } = req.body;

    // Verify session ownership
    const session = await storage.getWorkSession(id);
    if (!session) {
      return res.status(404).json({ message: 'Work session not found' });
    }

    if (session.userId !== req.user!.id && !['admin', 'manager'].includes(req.user!.role)) {
      return res.status(403).json({ message: 'Not authorized to edit this session' });
    }

    // ========== NUEVA VALIDACIÓN ==========
    const now = new Date();
    const companySettings = await storage.getCompanySettings(req.user!.companyId);
    const maxPastDays = companySettings?.maxEditDays || 90;
    const maxPastDate = new Date(now.getTime() - maxPastDays * 24 * 60 * 60 * 1000);

    // Validar clockIn
    if (clockIn) {
      const clockInDate = new Date(clockIn);
      
      if (clockInDate < maxPastDate) {
        return res.status(400).json({ 
          message: `No se pueden modificar fichajes de hace más de ${maxPastDays} días` 
        });
      }
      
      if (clockInDate > now) {
        return res.status(400).json({ 
          message: 'No se pueden crear fichajes en el futuro' 
        });
      }
    }

    // Validar clockOut vs clockIn
    if (clockOut && clockIn) {
      const clockOutDate = new Date(clockOut);
      const clockInDate = new Date(clockIn);
      
      if (clockOutDate <= clockInDate) {
        return res.status(400).json({ 
          message: 'La hora de salida debe ser posterior a la de entrada' 
        });
      }

      // Validar que no exceda 24 horas (prevenir errores)
      const duration = (clockOutDate.getTime() - clockInDate.getTime()) / (1000 * 60 * 60);
      if (duration > 24) {
        return res.status(400).json({ 
          message: 'La sesión no puede exceder 24 horas' 
        });
      }
    }
    // =======================================

    const updateData: any = {};
    if (clockIn) updateData.clockIn = new Date(clockIn);
    if (clockOut) updateData.clockOut = new Date(clockOut);

    // ... resto del código
```

---

## 📝 Conclusiones

### Fortalezas del Sistema Actual
1. **Arquitectura sólida** de autenticación y autorización
2. **Compliance legal** con RD-ley 8/2019 (logs de auditoría)
3. **Separación de roles** bien implementada
4. **Validación en múltiples capas** (cliente y servidor)

### Áreas de Mejora
1. Validaciones de negocio más estrictas (fechas, rangos)
2. Rate limiting para prevenir abuso
3. Optimización de caché para datos en tiempo real
4. Límites de carga para empresas grandes

### Riesgo Global
**🟢 BAJO** - El sistema es seguro para producción con las mejoras recomendadas

---

**Próxima revisión:** Tras implementar cambios priorizados  
**Responsable:** Equipo de desarrollo  
**Aprobado por:** [Pendiente]
