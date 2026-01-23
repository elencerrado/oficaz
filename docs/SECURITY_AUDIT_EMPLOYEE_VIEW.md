# Auditoría de Seguridad y Optimización - Vista del Empleado

**Fecha:** 16 de enero de 2026  
**Alcance:** Vista completa del empleado (dashboard, navegación, páginas específicas, autenticación)  
**Estado:** ✅ Sistema generalmente seguro con oportunidades de mejora

---

## 📋 Resumen Ejecutivo

La vista del empleado presenta una arquitectura sólida con separación de roles, pero se han identificado **4 vulnerabilidades de severidad media**, **6 oportunidades de optimización** y **3 mejores prácticas pendientes de implementar**.

### Severidad de Hallazgos
- 🔴 **Crítico:** 0
- 🟠 **Alto:** 0
- 🟡 **Medio:** 4
- 🔵 **Bajo:** 6
- ✅ **Informativo:** 3

---

## 🔒 Hallazgos de Seguridad

### 🟡 MEDIO-01: Exposición de Sesión en LocalStorage sin Encriptación

**Ubicación:** `client/src/lib/auth.tsx`  
**Riesgo:** Tokens almacenados en texto plano en localStorage son vulnerables a XSS

**Problema actual:**
```typescript
// authData se guarda directamente en localStorage sin encriptar
localStorage.setItem('authData', JSON.stringify(authData));
```

**Recomendación:**
```typescript
// Implementar encriptación básica para tokens sensibles
import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY = import.meta.env.VITE_STORAGE_KEY || 'default-key';

function encryptData(data: any): string {
  return CryptoJS.AES.encrypt(JSON.stringify(data), ENCRYPTION_KEY).toString();
}

function decryptData(encryptedData: string): any {
  const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
  return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
}

// Al guardar
localStorage.setItem('authData', encryptData(authData));

// Al leer
const encrypted = localStorage.getItem('authData');
const authData = encrypted ? decryptData(encrypted) : null;
```

**Impacto:** Dificulta robo de sesiones mediante XSS  
**Prioridad:** Media

---

### 🟡 MEDIO-02: Falta de Validación de Ownership en Frontend

**Ubicación:** `employee-dashboard.tsx`, `employee-time-tracking.tsx`  
**Riesgo:** Confianza excesiva en el servidor para validar ownership

**Problema actual:**
```typescript
// employee-dashboard.tsx
// No se valida en cliente que user.id === session.userId antes de mostrar
{activeSession && (
  <div>
    <p>Entrada: {format(new Date(activeSession.clockIn), 'HH:mm')}</p>
  </div>
)}
```

**Recomendación:**
```typescript
// Validar ownership antes de renderizar datos sensibles
{activeSession && activeSession.userId === user?.id && (
  <div>
    <p>Entrada: {format(new Date(activeSession.clockIn), 'HH:mm')}</p>
  </div>
)}

// O mejor, con un hook reutilizable
const isOwner = (resourceUserId: number) => resourceUserId === user?.id;

{activeSession && isOwner(activeSession.userId) && (
  // Render content
)}
```

**Impacto:** Defensa en profundidad contra bugs en API  
**Prioridad:** Media

---

### 🟡 MEDIO-03: Manejo de Errores Expone Información de Sesión

**Ubicación:** `employee-dashboard.tsx:749-760`  
**Riesgo:** Mensajes de error demasiado detallados pueden ayudar a atacantes

**Problema actual:**
```typescript
onError: (error: any) => {
  if (error.message?.includes('Invalid or expired token') || error.message?.includes('403')) {
    toast({
      title: "Sesión expirada",
      description: "Redirigiendo al login...",
      variant: "destructive",
    });
    localStorage.removeItem('authData');
    setTimeout(() => {
      window.location.href = '/login'; // ⚠️ Redirect sin pathname
    }, 1000);
  }
}
```

**Recomendación:**
```typescript
onError: (error: any) => {
  // No exponer detalles técnicos del error
  const isAuthError = error.status === 401 || error.status === 403;
  
  if (isAuthError) {
    toast({
      title: "Sesión expirada",
      description: "Por favor, inicia sesión nuevamente",
      variant: "destructive",
    });
    
    // Limpiar toda la autenticación
    localStorage.removeItem('authData');
    sessionStorage.clear();
    
    // Redirect preservando company alias
    const companyAlias = window.location.pathname.split('/')[1];
    window.location.href = `/${companyAlias}/login`;
  } else {
    // Error genérico sin detalles
    toast({ 
      title: 'Error', 
      description: 'Ocurrió un problema. Intenta de nuevo.',
      variant: 'destructive'
    });
  }
}
```

**Impacto:** Reduce información útil para atacantes  
**Prioridad:** Media

---

### 🟡 MEDIO-04: Geolocalización Sin Consentimiento Explícito

**Ubicación:** `employee-dashboard.tsx:670-690`  
**Riesgo:** GDPR/LOPD requiere consentimiento explícito para geolocalización

**Problema actual:**
```typescript
const getCurrentLocation = async () => {
  return new Promise<{ latitude: number; longitude: number } | null>((resolve) => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        () => resolve(null)
      );
    } else {
      resolve(null);
    }
  });
};

// Se usa directamente al fichar
clockInMutation.mutate();
```

**Recomendación:**
```typescript
// Añadir estado de consentimiento
const [hasLocationConsent, setHasLocationConsent] = useState(() => {
  return localStorage.getItem('locationConsent') === 'granted';
});

// Pedir consentimiento al primer fichaje
const requestLocationConsent = () => {
  return new Promise((resolve) => {
    // Mostrar dialog explicando el uso
    const consent = window.confirm(
      'Para registrar tu ubicación en fichajes, necesitamos acceso a tu ubicación. ' +
      '¿Permites que Oficaz acceda a tu ubicación al fichar?'
    );
    
    if (consent) {
      localStorage.setItem('locationConsent', 'granted');
      setHasLocationConsent(true);
    } else {
      localStorage.setItem('locationConsent', 'denied');
    }
    
    resolve(consent);
  });
};

// Usar antes de obtener ubicación
const getCurrentLocation = async () => {
  // Si no tiene consentimiento, no pedir ubicación
  if (!hasLocationConsent) {
    const consent = await requestLocationConsent();
    if (!consent) return null;
  }
  
  // ... resto del código
};
```

**Impacto:** Compliance con GDPR/LOPD  
**Prioridad:** Media (Legal)

---

## ⚡ Optimizaciones de Rendimiento

### OPT-01: Employee Dashboard Carga Demasiados Queries Simultáneos

**Ubicación:** `employee-dashboard.tsx:100-400`  
**Problema:** 8+ queries concurrentes al cargar el dashboard

**Queries actuales:**
```typescript
useQuery({ queryKey: ['/api/work-sessions/active'] });
useQuery({ queryKey: ['/api/break-periods/active'] });
useQuery({ queryKey: ['/api/vacation-requests'] });
useQuery({ queryKey: ['/api/documents/requests'] });
useQuery({ queryKey: ['/api/documents/unsigned-count'] });
useQuery({ queryKey: ['/api/messages/unread-count'] });
useQuery({ queryKey: ['/api/work-sessions/active-count'] });
useQuery({ queryKey: ['/api/reminders'] });
```

**Recomendación:**
```typescript
// Crear endpoint agregado en el servidor
// GET /api/employee/dashboard-data
app.get('/api/employee/dashboard-data', authenticateToken, async (req, res) => {
  const userId = req.user!.id;
  
  const [
    activeSession,
    activeBreak,
    vacationRequests,
    documentRequests,
    unsignedCount,
    unreadMessages,
    reminders
  ] = await Promise.all([
    storage.getActiveWorkSession(userId),
    storage.getActiveBreakPeriod(userId),
    storage.getVacationRequests(userId),
    storage.getPendingDocumentRequests(userId),
    storage.getUnsignedDocumentsCount(userId),
    storage.getUnreadMessagesCount(userId),
    storage.getUpcomingReminders(userId)
  ]);
  
  res.json({
    activeSession,
    activeBreak,
    vacationRequests,
    documentRequests,
    unsignedCount,
    unreadMessages,
    reminders
  });
});

// En el cliente
const { data: dashboardData } = useQuery({
  queryKey: ['/api/employee/dashboard-data'],
  staleTime: 30000, // 30 segundos
});
```

**Beneficio:** Reduce de 8 requests a 1, mejora tiempo de carga inicial  
**Prioridad:** Alta

---

### OPT-02: Console.logs en Producción

**Ubicación:** `employee-dashboard.tsx:1267-1300`  
**Problema:** Múltiples console.log comentados pero presentes

```typescript
// console.log('🔔 Real-time notifications status:', { ... });
// console.log('Employee dashboard feature access:', { ... });
```

**Recomendación:**
```typescript
// Crear logger condicional
const logger = {
  debug: (...args: any[]) => {
    if (import.meta.env.DEV) {
      console.log('[Employee]', ...args);
    }
  },
  error: (...args: any[]) => {
    console.error('[Employee]', ...args);
  }
};

// Usar en lugar de console.log
logger.debug('Real-time notifications:', { hasVacationUpdates });
```

**Beneficio:** Logs solo en desarrollo, código más limpio  
**Prioridad:** Baja

---

### OPT-03: Polling Innecesario para Notificaciones

**Ubicación:** Múltiples `useQuery` con `refetchInterval`  
**Problema:** Polling constante consume batería y datos

**Actual:**
```typescript
const { data: unreadCount } = useQuery({
  queryKey: ['/api/messages/unread-count'],
  refetchInterval: 30000, // Poll cada 30 segundos
});
```

**Recomendación:**
```typescript
// Usar WebSocket para notificaciones en tiempo real (ya disponible)
useEffect(() => {
  const wsServer = getWebSocketServer();
  if (!wsServer) return;
  
  const handler = (event: any) => {
    if (event.type === 'message_received') {
      queryClient.invalidateQueries({ queryKey: ['/api/messages/unread-count'] });
    }
  };
  
  wsServer.subscribe('messages', handler);
  return () => wsServer.unsubscribe('messages', handler);
}, []);

// Query sin polling
const { data: unreadCount } = useQuery({
  queryKey: ['/api/messages/unread-count'],
  // Sin refetchInterval
});
```

**Beneficio:** Ahorra batería, reduce tráfico de red  
**Prioridad:** Media

---

### OPT-04: Renderizado Excesivo en Dashboard

**Ubicación:** `employee-dashboard.tsx:1500-2500`  
**Problema:** Componente de 2500+ líneas dificulta mantenimiento

**Recomendación:**
```typescript
// Dividir en componentes más pequeños
// components/employee/dashboard/ClockCard.tsx
export function ClockCard({ activeSession, onClockAction }) {
  // Lógica de fichaje
}

// components/employee/dashboard/NotificationBadges.tsx
export function NotificationBadges({ counts }) {
  // Badges de notificaciones
}

// components/employee/dashboard/MenuGrid.tsx
export function MenuGrid({ menuItems, onNavigate }) {
  // Grid de navegación
}

// employee-dashboard.tsx (simplificado)
export default function EmployeeDashboard() {
  return (
    <div>
      <EmployeeTopBar />
      <ClockCard activeSession={activeSession} onClockAction={handleClock} />
      <NotificationBadges counts={notificationCounts} />
      <MenuGrid items={menuItems} onNavigate={handleNav} />
    </div>
  );
}
```

**Beneficio:** Código más mantenible, mejor tree-shaking  
**Prioridad:** Media

---

### OPT-05: Imágenes de Logo Sin Optimización

**Ubicación:** `employee-dashboard.tsx:1348`  
**Problema:** Logos se cargan sin lazy loading ni optimización

```typescript
{shouldShowLogo && (
  <img 
    src={company.logoUrl} 
    alt={company.name} 
    className="h-12 object-contain"
  />
)}
```

**Recomendación:**
```typescript
{shouldShowLogo && (
  <img 
    src={company.logoUrl} 
    alt={company.name} 
    className="h-12 object-contain"
    loading="lazy"
    decoding="async"
    onError={(e) => {
      // Fallback si imagen falla
      e.currentTarget.style.display = 'none';
    }}
  />
)}
```

**Beneficio:** Carga más rápida, mejor UX  
**Prioridad:** Baja

---

### OPT-06: Falta Memoización en Cálculos Costosos

**Ubicación:** `employee-dashboard.tsx:859-880`  
**Problema:** `getSessionStatus()` se recalcula en cada render

```typescript
const getSessionStatus = () => {
  if (!activeSession) {
    return { isActive: false, ... };
  }
  
  const clockIn = new Date(activeSession.clockIn);
  const currentTime = new Date();
  const hoursFromClockIn = (currentTime.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
  // ... más cálculos
};

// Se usa directamente sin memo
const sessionStatus = getSessionStatus();
```

**Recomendación:**
```typescript
const sessionStatus = useMemo(() => {
  if (!activeSession) {
    return { isActive: false, isIncomplete: false, isToday: false, canStartNew: true };
  }
  
  const clockIn = new Date(activeSession.clockIn);
  const currentTime = new Date();
  const hoursFromClockIn = (currentTime.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
  // ... más cálculos
  
  return { isActive, isIncomplete, isToday, canStartNew };
}, [activeSession, activeSession?.clockIn]);
```

**Beneficio:** Reduce cálculos innecesarios  
**Prioridad:** Media

---

## 🎯 Mejores Prácticas Pendientes

### BP-01: Validación de Inputs en Formularios

**Ubicación:** `employee-dashboard.tsx:835-845` (Work Report Modal)  
**Problema:** No hay validación de campos antes de enviar

**Recomendación:**
```typescript
import { z } from 'zod';

const workReportSchema = z.object({
  reportDate: z.string().min(1, 'Fecha requerida'),
  refCode: z.string().optional(),
  location: z.string().min(1, 'Ubicación requerida'),
  description: z.string().min(10, 'Descripción debe tener al menos 10 caracteres'),
  clientName: z.string().optional(),
  notes: z.string().optional(),
});

const handleSubmitWorkReport = () => {
  try {
    workReportSchema.parse(workReportForm);
    // Enviar formulario
  } catch (error) {
    if (error instanceof z.ZodError) {
      toast({
        title: 'Errores en el formulario',
        description: error.errors[0].message,
        variant: 'destructive'
      });
    }
  }
};
```

**Beneficio:** Previene datos inválidos en servidor  
**Prioridad:** Media

---

### BP-02: Gestión de Estado Global para Modales

**Ubicación:** Múltiples `useState` para modales en diferentes páginas  
**Problema:** Estado de modales disperso, dificulta debugging

**Recomendación:**
```typescript
// hooks/use-modal-state.ts
import create from 'zustand';

interface ModalState {
  isWorkReportOpen: boolean;
  isAlarmModalOpen: boolean;
  openWorkReport: () => void;
  closeWorkReport: () => void;
  openAlarmModal: () => void;
  closeAlarmModal: () => void;
}

export const useModalState = create<ModalState>((set) => ({
  isWorkReportOpen: false,
  isAlarmModalOpen: false,
  openWorkReport: () => set({ isWorkReportOpen: true }),
  closeWorkReport: () => set({ isWorkReportOpen: false }),
  openAlarmModal: () => set({ isAlarmModalOpen: true }),
  closeAlarmModal: () => set({ isAlarmModalOpen: false }),
}));

// Uso en componentes
const { isWorkReportOpen, openWorkReport, closeWorkReport } = useModalState();
```

**Beneficio:** Estado centralizado, más fácil de debuggear  
**Prioridad:** Baja

---

### BP-03: Internacionalización (i18n) Hardcodeada

**Ubicación:** Todos los archivos employee-*.tsx  
**Problema:** Textos en español hardcodeados

**Actual:**
```typescript
<Button>Fichar Entrada</Button>
<p>Sesión expirada</p>
```

**Recomendación:**
```typescript
// hooks/use-translation.ts
import { useLanguage } from '@/hooks/use-language';

const translations = {
  es: {
    'clock.in': 'Fichar Entrada',
    'session.expired': 'Sesión expirada',
  },
  en: {
    'clock.in': 'Clock In',
    'session.expired': 'Session expired',
  }
};

export const useTranslation = () => {
  const { language } = useLanguage();
  return (key: string) => translations[language][key] || key;
};

// Uso
const t = useTranslation();
<Button>{t('clock.in')}</Button>
```

**Beneficio:** Preparado para internacionalización  
**Prioridad:** Baja (solo si hay planes de internacionalización)

---

## ✅ Fortalezas del Sistema Actual

### Seguridad Implementada Correctamente

1. **✅ Autenticación JWT**: Token en header, refresh token, expiración
2. **✅ Separación de Roles**: Employee view vs Admin view
3. **✅ Feature Gates**: `hasAccess()` para features premium
4. **✅ Manager Permissions**: Sistema granular de permisos
5. **✅ Protected Routes**: `<ProtectedRoute>` y `<FeatureProtectedRoute>`
6. **✅ CSRF Protection**: Tokens incluidos en requests
7. **✅ Employee View Mode**: Admins/Managers pueden ver como empleado

### Optimizaciones Existentes

1. **✅ React Query**: Caché inteligente de datos
2. **✅ Lazy Loading**: Componentes cargados bajo demanda
3. **✅ WebSocket**: Notificaciones en tiempo real
4. **✅ PWA**: Push notifications sin polling
5. **✅ Memoization**: useMemo en varios cálculos
6. **✅ Code Splitting**: Rutas separadas por rol

### UX/UI Excelente

1. **✅ Tema Oscuro**: Toggle light/dark/system
2. **✅ Responsive**: Mobile-first design
3. **✅ Animaciones**: Transiciones suaves
4. **✅ Loading States**: Spinners y skeletons
5. **✅ Error Handling**: Toasts informativos
6. **✅ Accessibility**: ARIA labels, keyboard navigation

---

## 📊 Resumen de Recomendaciones Priorizadas

### Implementar Inmediatamente (Alta Prioridad)

1. **MEDIO-04**: Consentimiento explícito para geolocalización (Legal/GDPR)
2. **OPT-01**: Endpoint agregado para dashboard (Performance crítico)
3. **MEDIO-02**: Validación de ownership en frontend (Seguridad)

### Implementar Pronto (Media Prioridad)

4. **MEDIO-01**: Encriptación de authData en localStorage
5. **MEDIO-03**: Mejora en manejo de errores
6. **OPT-03**: Usar WebSocket en lugar de polling
7. **OPT-04**: Refactorizar dashboard en componentes
8. **OPT-06**: Memoización de cálculos costosos
9. **BP-01**: Validación de formularios con Zod

### Backlog (Baja Prioridad)

10. **OPT-02**: Limpiar console.logs
11. **OPT-05**: Optimización de imágenes
12. **BP-02**: Estado global de modales
13. **BP-03**: i18n (solo si se planea)

---

## 🧪 Testing Recomendado

### Tests E2E Críticos

```typescript
describe('Employee Authentication', () => {
  it('should redirect to login when session expires', () => {
    // Simular token expirado
    // Verificar redirect a /login
  });
  
  it('should preserve location consent across sessions', () => {
    // Dar consentimiento
    // Cerrar sesión
    // Volver a iniciar
    // Verificar que consentimiento persiste
  });
});

describe('Employee Clock Actions', () => {
  it('should not allow clock-in twice', () => {
    // Clock in
    // Intentar clock in de nuevo
    // Verificar error
  });
  
  it('should validate ownership before showing session', () => {
    // Login como employee A
    // Intentar ver sesión de employee B
    // Verificar que no se muestra
  });
});
```

---

## 📝 Conclusión

**Estado Final:** 🟢 **SISTEMA SEGURO CON MEJORAS RECOMENDADAS**

La vista del empleado está bien implementada con:
- Autenticación robusta
- Separación de roles correcta
- Buena experiencia de usuario
- Optimizaciones de rendimiento

**Áreas críticas a mejorar:**
1. Consentimiento de geolocalización (Legal)
2. Performance del dashboard (UX)
3. Validación de ownership (Seguridad)

**Riesgo Global:** 🟢 **BAJO** - Sistema listo para producción con mejoras recomendadas

---

**Responsable:** Sistema de IA  
**Próxima revisión:** Tras implementar cambios de alta prioridad  
**Aprobado para producción:** [Pendiente]
