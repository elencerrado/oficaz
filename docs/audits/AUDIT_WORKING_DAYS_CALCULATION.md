## ANÁLISIS EXHAUSTIVO: SISTEMA DE CÁLCULO DE DÍAS LABORABLES VS NATURALES

### STATUS: ✅ CORRECCIONES IMPLEMENTADAS

**Fecha de implementación**: 17 Enero 2025
**Archivos modificados**:
- [client/src/pages/admin-vacation-management.tsx](client/src/pages/admin-vacation-management.tsx) - Correcciones en líneas 307-342, 3210-3227, 3327

---

### 1. PROBLEMAS IDENTIFICADOS (AHORA RESUELTOS)

#### 🔴 CRÍTICO: admin-vacation-management.tsx línea 307
**Problema**: `calculateDays()` usa `differenceInDays(end, start) + 1`
```tsx
const calculateDays = (startDate: string, endDate: string) => {
  const start = parseDateOnlyLocal(startDate);
  const end = parseDateOnlyLocal(endDate);
  return differenceInDays(end, start) + 1;  // ❌ SIEMPRE cuenta días naturales
};
```
- Ignora completamente el setting `calculationMode` (working vs natural)
- Ignora holidays y workingDays configurados
- Muestra número de días incorrecto en la vista admin cuando mode='working'
- Afecta al modal de solicitar ausencias para admin

#### 🔴 CRÍTICO: admin-vacation-management.tsx línea 1870+ (daysCount calculation)
**Ubicación**: Donde se muestra el contador de días en las tarjetas de solicitudes de vacaciones
```tsx
const daysCount = calculateDays(request.startDate, request.endDate);
```
- Mismo problema: usa calculateDays() simple que no respeta modo

#### 🟡 ALTO: Falta implementación en modal de crear vacaciones del admin
**Ubicación**: Cuando el admin crea una nueva solicitud de vacaciones
- El calendario muestra `isVacationDisabledDay()` para deshabilitar weekends
- Pero el preview de días probablemente usa calculateDays() incorrecto
- No se valida que se seleccionen solo días laborables cuando mode='working'

#### 🟡 ALTO: Inconsistencia en employee-vacation-requests.tsx
**Ubicación**: Línea ~310 `calculateDays()`
```tsx
const calculateDays = (startDate: string, endDate: string) => {
  const start = parseDateOnlyLocal(startDate);
  const end = parseDateOnlyLocal(endDate);
  return calculateDaysForRangeWithCompanyMode(start, end);
};
```
- ✅ CORRECTO: Usa `calculateDaysForRangeWithCompanyMode()`
- PERO: Se llama sin company data en algunos places
- El cliente NO tiene acceso a customHolidays en algunos contextos

#### 🟡 ALTO: Cálculo de políticas horarias no considerado
**Problema**: El sistema actual NO respeta `companyWorkSchedules`
- La tabla `companyWorkSchedules` existe pero NO se usa
- Define `expectedEntryTime` y `expectedExitTime` por día
- Podría usarse para cálculos más precisos (e.g., medio día trabajado)
- Actualmente se ignora completamente

#### 🟡 MEDIO: Orden de validaciones en server/routes.ts
**Ubicación**: Línea 6455+
```typescript
const requestedDays = calculateDaysForRangeWithCompanyMode(
  startDate,
  endDate,
  company,
  workingDays,
  customHolidays
);
if (requestedDays <= 0) {
  return res.status(400).json({
    message: 'El rango seleccionado no contiene dias laborables. Elige al menos un dia laborable.'
  });
}
```
- ✅ CORRECTO: Valida usando calculateDaysForRangeWithCompanyMode
- PERO: El mensaje de error es genérico
- No diferencia "fin de semana" vs "festivo"

### 2. FLUJOS AFECTADOS

#### Flujo 1: Admin crea ausencia para sí mismo
- **Frontend**: admin-vacation-management.tsx → modal de creación
- **Cálculo**: calculateDays() ❌ INCORRECTO
- **Backend**: POST /api/vacation-requests con validateVacationBalance
- **Backend Cálculo**: calculateDaysForRangeWithCompanyMode() ✅ CORRECTO
- **PROBLEMA**: Frontend y backend dan números diferentes

#### Flujo 2: Admin crea ausencia para otro empleado
- **Frontend**: admin-vacation-management.tsx → modal de creación
- **Cálculo**: calculateDays() ❌ INCORRECTO
- **Backend**: POST /api/vacation-requests (se valida para cada target)
- **Backend Cálculo**: calculateDaysForRangeWithCompanyMode() ✅ CORRECTO
- **PROBLEMA**: Frontend muestra días incorrectos pero backend fuerza validación correct

#### Flujo 3: Empleado solicita ausencia
- **Frontend**: employee-vacation-requests.tsx
- **Cálculo**: calculateDaysForRangeWithCompanyMode() ✅ CORRECTO
- **Backend**: POST /api/vacation-requests
- **Backend Cálculo**: calculateDaysForRangeWithCompanyMode() ✅ CORRECTO
- **ESTADO**: ✅ CONSISTENTE

#### Flujo 4: Ver lista de solicitudes (admin)
- **Frontend**: admin-vacation-management.tsx → daysCount
- **Cálculo**: calculateDays() ❌ INCORRECTO
- **Impacto**: Muestra contador de días incorrecto en tarjetas

### 3. CHECKLIST DE REQUISITOS

**Cuando mode='working' (días laborables):**
- ❌ [1] Debe excluir weekends en cálculos
- ❌ [2] Debe excluir holidays nacionales del calendario
- ❌ [3] Debe excluir holidays regionales (según companyRegion)
- ❌ [4] Debe excluir custom holidays personalizados
- ❌ [5] Debe respetar workingDays configurados en company
- ❓ [6] Debe validar que la solicitud contenga AL MENOS un día laborable
- ❓ [7] Debe mostrar preview de días seleccionados correctamente en UI

**Cuando mode='natural' (días naturales):**
- ✅ [1] Cuenta todos los días, incluyendo weekends
- ✅ [2] Ignora holidays
- ❓ [3] Debe ser consistente en frontend y backend

**Validación de balance:**
- ✅ [1] Valid correctly on backend
- ❌ [2] Frontend NO valida al cambiar modo
- ❌ [3] No hay mensaje claro cuando modo='working' y rango no tiene laborables

**Transición entre modos:**
- ✅ [1] Calcula correctamente split date
- ❌ [2] Frontend no considera transición en calculateDays()

### 4. LÍNEAS ESPECÍFICAS A REVISAR

**Backend (server/routes.ts):**
- ✅ Línea 6355: parseDateInput() - CORRECTO
- ✅ Línea 6437: companyDatos fetched (company, customHolidays, workingDays) - CORRECTO
- ✅ Línea 6455: calculateDaysForRangeWithCompanyMode() llamado - CORRECTO
- ✅ Línea 6470: overlapDays() usa calculateDaysForRangeWithCompanyMode() - CORRECTO
- ❌ Línea 6483: Valida solo para 'vacation' type - ESTÁ CORRECTO pero podría clearer

**Frontend (employee-vacation-requests.tsx):**
- ✅ Línea 180-210: countWorkingDays() considera wrk/holidays - CORRECTO
- ✅ Línea 209: calculateDaysForRange() - CORRECTO
- ✅ Línea 215: calculateDaysForRangeWithCompanyMode() - CORRECTO
- ✅ Línea 310: calculateDays() llama a calculateDaysForRangeWithCompanyMode() - CORRECTO

**Frontend (admin-vacation-management.tsx):**
- ❌ Línea 307: calculateDays() simple sin modo - INCORRECTO
- ❌ Línea 1870: daysCount = calculateDays() - INCORRECTO (en card display)
- ⚠️ Línea 1100+: countWorkingDays(), isWorkingDay() EXISTEN pero calculateDays() NO LAS USA
- ❌ Línea 3300+: Modal de creación - usa calculateDays() en preview

### 5. SOLUCIONES NECESARIAS

#### SOLUCIÓN 1: Unificar calculateDays() en admin-vacation-management
```typescript
const calculateDaysWithMode = (startDate: string | Date, endDate: string | Date) => {
  const start = typeof startDate === 'string' ? parseDateOnlyLocal(startDate) : startDate;
  const end = typeof endDate === 'string' ? parseDateOnlyLocal(endDate) : endDate;
  
  if (calculationMode === 'working') {
    return countWorkingDays(start, end);
  } else {
    return differenceInDays(end, start) + 1;
  }
};
```

#### SOLUCIÓN 2: Usar la función unificada en todos lados
- Línea 307: Cambiar calculateDays() → calculateDaysWithMode()
- Línea 1870 (daysCount): Cambiar calculateDays() → calculateDaysWithMode()
- Línea 3300+: Modal - usar calculateDaysWithMode()

#### SOLUCIÓN 3: Validación en modal del admin
- Cuando mode='working' y se selecciona rango sin laborables → mostrar error
- Realtime feedback: "Este rango no contiene días laborables"
- Usar misma lógica que `isVacationDisabledDay` pero aplicada al rango

#### SOLUCIÓN 4: Considerar companyWorkSchedules
- OPCIONAL para MVP: Por ahora ignorar
- FUTURO: Poder descontar horas por políticas horarias

### 6. PRUEBAS RECOMENDADAS

**Test 1: Admin en mode='working'**
- Seleccionar lunes-viernes (5 días) → debe mostrar 5
- Seleccionar viernes-lunes (incluye weekend) → debe mostrar 3
- Seleccionar rango que cae en holiday → debe excluir el festivo

**Test 2: Admin en mode='natural'**
- Seleccionar lunes-viernes (5 días) → debe mostrar 5
- Seleccionar viernes-lunes (incluye weekend) → debe mostrar 4
- Seleccionar rango que cae en holiday → debe contar igual

**Test 3: Transición entre modos**
- Cambiar de 'natural' a 'working' → preview actualiza
- Las solicitudes existentes se recalculan correctamente

**Test 4: Validación sin laborables**
- En mode='working', seleccionar solo weekend → error claro
- En mode='natural', cualquier rango válido

**Test 5: Inconsistencia admin-employee**
- Admin crea ausencia para empleado: coinciden los días mostrados
- Empleado crea ausencia: mismos números que admin vio

