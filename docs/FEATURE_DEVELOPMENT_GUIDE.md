# Guía Completa para Desarrollo de Nuevas Funcionalidades

> **Última actualización**: 29 de Diciembre, 2025  
> **Basado en**: Implementación de Contabilidad, CRM (Clientes y Proyectos), y otras funcionalidades  
> **Referencias**: accounting.tsx, crm.tsx, vacation-management.tsx, inventory.tsx, time-tracking.tsx

Esta guía documenta todos los estándares, patrones y mejores prácticas para crear nuevas funcionalidades **pagables (addons)** en Oficaz de forma completa y consistente. Aplica a CUALQUIER nueva funcionalidad que requiera ser comprada en la tienda.

---

## 📋 Tabla de Contenidos

0. [⚠️ IMPORTANTE: Sistema de Addons Pagables](#0-importante-sistema-de-addons-pagables)
1. [Estructura de Página Admin](#1-estructura-de-página-admin)
2. [Sistema de Autenticación y Permisos](#2-sistema-de-autenticación-y-permisos)
3. [React Query y Carga Progresiva](#3-react-query-y-carga-progresiva)
4. [Cards de Estadísticas](#4-cards-de-estadísticas)
5. [Sistema de Pestañas (Tabs)](#5-sistema-de-pestañas-tabs)
6. [Layout y Espaciado](#6-layout-y-espaciado)
7. [Modales y Diálogos](#7-modales-y-diálogos)
8. [Confirmaciones de Acciones](#8-confirmaciones-de-acciones)
9. [Cards de Lista/Grid](#9-cards-de-listagrid)
   - [9.6 Cards con Estados Coloreados y Ajuste Responsivo](#96-cards-con-estados-coloreados-en-la-esquina-superior-derecha)
10. [Botones y Acciones](#11-botones-y-acciones)
11. [Modo Oscuro](#12-modo-oscuro)
12. [Iconos](#13-iconos)
13. [Formularios](#14-formularios)
14. [Integración en la Tienda (Addons Pagables)](#15-integración-en-la-tienda-addons-pagables)
15. [Checklist de Implementación](#16-checklist-de-implementación)

---

## 0. ⚠️ IMPORTANTE: Sistema de Addons Pagables

**Esta es la lección aprendida de la implementación del CRM.** Cualquier funcionalidad nueva DEBE implementar el flujo completo de addon desde el inicio.

### 0.1 ¿Qué es un Addon Pagable?

Un addon es una funcionalidad que:
- ✅ Se compra en la tienda (addon-store.tsx)
- ✅ Aparece en el carrito de compra de Stripe
- ✅ Solo funciona si `subscription.features[key] === true`
- ✅ Aparece en el menú lateral SOLO si está comprado
- ✅ Los endpoints `/api/addon-name/*` retornan 402 si no está comprado

### 0.2 Flujo Incorrecto (QUE NO HACER)

```
❌ Implementar feature sin pensar en tienda
❌ Feature aparece en menú porque acceso directo a página
❌ No añadir a addon-definitions.ts
❌ No proteger rutas con middleware
❌ Feature en barra lateral pero no comprada = CONFUSIÓN DE USUARIO
```

### 0.3 Flujo Correcto (SIEMPRE HACER ESTO)

```
✅ 1. Crear definición en shared/addon-definitions.ts
✅ 2. Crear rutas protegidas con middleware requireFeature()
✅ 3. Crear migration SQL para insertar en tabla addons
✅ 4. Actualizar addon-store.tsx (icon + color)
✅ 5. Actualizar landing.tsx (pricing calculator)
✅ 6. Añadir link navegación condicionado a compra
✅ 7. Verificar que barra lateral muestra feature SOLO si comprado
```

### 0.4 Responsabilidad por Integración Incompleta

**Si una funcionalidad aparece en la barra lateral pero el usuario no la ha comprado, es un bug.** El usuario debe ser dirigido a comprar primero.

### 0.5 Puntos Críticos a NO Olvidar

1. **Definición de Addon** (`shared/addon-definitions.ts`)
   - Está el PUNTO ÚNICO DE VERDAD para nombre, precio, icono
   - Todos los otros lugares importan de aquí
   
2. **Middleware de Protección** (`requireFeature()` en `server/middleware/auth.ts`)
   - TODAS las rutas del addon deben estar protegidas
   - Retorna 402 si no está comprado
   - Evita que usuarios sin pago accedan a funcionalidad

3. **Base de Datos - Tabla addons**
   - DEBE existir registro en tabla `addons` (insert via migration)
   - Fields: `key`, `name`, `price`, `is_active`, `sort_order`
   - Sin esto, no aparece en tienda

4. **Base de Datos - Tabla company_addons**
   - Se crea automático cuando usuario compra
   - Status puede ser 'active' o 'cancelled'
   - Si status='cancelled', NO aparece como comprado

5. **UI - Addon Store** (`client/src/pages/addon-store.tsx`)
   - Debe tener icon en `getAddonIcon()`
   - Debe tener color en `getAddonColor()`
   - Busca por `addon.key` para mapear

6. **UI - Landing Page** (`client/src/pages/landing.tsx`)
   - Agrega addon al array de precios
   - Usa icon de addon-definitions

7. **Navegación en Menú** (`client/src/components/Sidebar.tsx` o similar)
   - Link SOLO aparece si `hasAccess` o `subscription.features[key] === true`
   - Nunca acceso directo a URL
   - Dirigir a tienda si no comprado

### 0.6 Checklist rápido para un addon nuevo (tienda + landing + registro)

- Definición única: añade/actualiza el addon en [shared/addon-definitions.ts](shared/addon-definitions.ts) con `key`, `name`, `description`, `shortDescription`, `monthlyPrice`, `icon`, `isFreeFeature`. No hardcodes en ningún otro sitio.
- Sincroniza base de datos: como super-admin llama a `/api/super-admin/sync-addons` (desde consola del navegador con `fetch('/api/super-admin/sync-addons', { method: 'POST', credentials: 'include' })`). Sin esto, la tienda sigue mostrando nombres/precios antiguos.
- Tienda: verifica que el icono/color estén mapeados en [client/src/pages/addon-store.tsx](client/src/pages/addon-store.tsx) (`getAddonIcon`/`getAddonColor`) y que el addon aparezca en el grid.
- Landing (pricing): añade el addon al array de precios en [client/src/pages/landing.tsx](client/src/pages/landing.tsx) con `key`, `name`, `price`, `icon`. Importa el icono si no está ya.
- Registro/wizard: hoy no hay selección de addons en el wizard; si se introduce un paso de elección, usa las definiciones de `ADDON_DEFINITIONS` y la API `/api/addons` para poblar la UI y evita hardcodear precios/nombres.
- Menú y gating: asegúrate de que el enlace del nuevo addon en la sidebar solo se renderiza si `subscription.features[key]` es true y las rutas están protegidas con `requireFeature()`.

---

## 1. Estructura de Página Admin

### 1.1 Imports Estándar

```typescript
// React y Hooks
import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

// Componentes UI (shadcn/ui)
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';

// Iconos Lucide React
import { 
  Loader2, Plus, Edit2, Trash2, X, Calendar as CalendarIcon,
  ChevronLeft, ChevronRight, Filter, Download, Upload,
  Check, AlertCircle, Info, TrendingUp, TrendingDown
  // ... otros iconos específicos
} from 'lucide-react';

// Context
import { useAuth } from '@/contexts/AuthContext';

// Utilidades
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
```

### 1.2 Estructura del Componente

```typescript
export default function MiNuevaFuncionalidad() {
  const { user, token } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ========== ESTADOS ==========
  // (ver sección de estados más abajo)

  // ========== REACT QUERY ==========
  // (ver sección de React Query)

  // ========== FUNCIONES ==========
  // (ver secciones específicas)

  // ========== EFECTOS ==========
  useEffect(() => {
    // Efectos secundarios
  }, [dependencies]);

  // ========== RENDER ==========
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 sticky top-0 z-30">
        {/* ... */}
      </div>

      {/* Content */}
      <div className="container mx-auto p-6 pb-20">
        {/* Tabs si es necesario */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {/* ... */}
        </Tabs>
      </div>

      {/* Modales */}
      {/* AlertDialogs */}
    </div>
  );
}
```

---

## 2. Sistema de Autenticación y Permisos

### 2.1 Obtener Datos de Usuario

```typescript
const { user, token } = useAuth(); // ✅ SIEMPRE usar useAuth()

// NUNCA usar:
// ❌ localStorage.getItem('token')
// ❌ sessionStorage
```

### 2.2 Headers de Autenticación

```typescript
// Función helper para headers
const getAuthHeaders = () => ({
  'Authorization': `Bearer ${token}`,
});

// Uso en fetch
const response = await fetch('/api/mi-endpoint', {
  method: 'GET',
  headers: getAuthHeaders(),
  credentials: 'include', // ✅ Siempre incluir
});
```

### 2.3 Verificación de Permisos

```typescript
// Verificar rol de usuario
{user?.role === 'admin' && (
  <Button>Solo Admin</Button>
)}

// Verificar compañía
{user?.companyId && (
  // Contenido que requiere compañía
)}

// Permisos específicos en acciones
const handleDelete = async (id: number) => {
  // Solo permitir si es admin o el creador
  if (user?.role !== 'admin' && item.userId !== user?.id) {
    toast({
      title: 'Error',
      description: 'No tienes permisos para esta acción',
      variant: 'destructive'
    });
    return;
  }
  // ... lógica de eliminación
};
```

### 2.4 Enabled en React Query

```typescript
// ✅ Asegurar que las queries solo se ejecuten cuando hay usuario
const { data, isLoading } = useQuery({
  queryKey: ['/api/mi-endpoint'],
  queryFn: async () => {
    const response = await fetch('/api/mi-endpoint', {
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Error al cargar datos');
    return response.json();
  },
  enabled: !!user?.companyId, // ✅ IMPORTANTE: Solo ejecutar si hay usuario
  staleTime: 5 * 60 * 1000, // 5 minutos
});
```

---

## 3. React Query y Carga Progresiva

### 3.0 Patrón de Scroll Infinito (useInfiniteQuery)

**⚠️ IMPORTANTE**: Este patrón está implementado en:
- `admin-time-tracking.tsx` (fichajes) - REFERENCIA COMPLETA
- `admin-documents.tsx` (documentos) - REFERENCIA COMPLETA

**DEBE usarse en TODAS las listas grandes para evitar sobrecargar servidor:**
- Productos inventario
- Movimientos inventario
- Listas CRM (contactos, proyectos, tareas)
- Partes de trabajo
- Movimientos de contabilidad
- Recordatorios

**Ventajas respecto a cargar todo**:
- ✅ Carga inicial rápida (solo primeros 50 items)
- ✅ API responde más rápido (menos datos en respuesta)
- ✅ Menos tráfico de red (crucial en móvil)
- ✅ Mejor UX - usuario ve items inmediatamente
- ✅ Progresivo - carga más solo si usuario scrollea
- ✅ Indicadores visuales - "Cargando más...", "Has visto todos"

#### 3.0.1 Estructura Completa del Patrón

```typescript
// 1️⃣ CONSTANTES - Paginación
const ITEMS_PER_PAGE = 50;      // Items cargados CADA VEZ del servidor
const ITEMS_PER_LOAD = 10;      // Items mostrados PROGRESIVAMENTE en UI

// 2️⃣ ESTADOS - Ui e internos
const [displayedCount, setDisplayedCount] = useState(10);  // Items visibles ahora
const loadMoreRef = useRef<HTMLDivElement>(null);         // Elemento observador

// 3️⃣ REACT QUERY - useInfiniteQuery (lo más importante)
const {
  data: infiniteData,           // Todas las páginas cargadas
  isLoading,                    // Primera carga
  isFetchingNextPage,           // Cargando página siguiente
  hasNextPage,                  // ¿Hay más en servidor?
  fetchNextPage,                // Función para cargar siguiente página
} = useInfiniteQuery({
  // Identificador único - incluir TODOS los parámetros de filtro
  queryKey: ['/api/mi-endpoint', filterType, searchTerm, filterStatus],
  
  // Función que hace fetch
  queryFn: async ({ pageParam = 0 }) => {
    const url = `/api/mi-endpoint?limit=${ITEMS_PER_PAGE}&offset=${pageParam}&type=${filterType}&search=${searchTerm}`;
    const response = await fetch(url, {
      credentials: 'include',
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Error al cargar');
    
    // Servidor debe retornar:
    // { items: [...], totalCount: number, hasMore: boolean }
    return await response.json();
  },
  
  // Primera página (offset) = 0
  initialPageParam: 0,
  
  // Calcular próximo offset basado en páginas anteriores
  getNextPageParam: (lastPage, allPages) => {
    // Si servidor dice no hay más, retornar undefined (detiene paginación)
    if (!lastPage.hasMore) return undefined;
    
    // Si no, retornar offset para próxima página
    // offset = número de páginas * items por página
    return allPages.length * ITEMS_PER_PAGE;
  },
  
  enabled: !!user?.companyId,           // ✅ Solo ejecutar con usuario
  staleTime: 30 * 1000,                 // Cachear por 30 seg
  gcTime: 10 * 60 * 1000,               // Mantener 10 min en memoria
  retry: 2,
  retryDelay: 750,
});

// 4️⃣ APLANAR - Convertir [page1, page2, page3] en array único
const allItems = useMemo(() => {
  if (!infiniteData?.pages) return [];
  // Cada página tiene array de items - concatenar todos
  return infiniteData.pages.flatMap(page => page.items || []);
}, [infiniteData]);

// 5️⃣ TOTAL COUNT - Obtener del servidor (última página)
const totalCount = infiniteData?.pages?.[infiniteData.pages.length - 1]?.totalCount || 0;

// 6️⃣ HAS MORE - Verificar si hay items no mostrados (local O server)
const hasMoreToDisplay = displayedCount < allItems.length || (hasNextPage ?? false);

// 7️⃣ LOAD MORE - Función smart: muestra local primero, después fetch server
const loadMoreItems = useCallback(() => {
  // PRIMERO: si tenemos items cargados pero no mostrados, mostrarlos
  if (displayedCount < allItems.length) {
    // Mostrar ITEMS_PER_LOAD más (máximo hasta allItems.length)
    setDisplayedCount(prev => Math.min(prev + ITEMS_PER_LOAD, allItems.length + ITEMS_PER_LOAD));
    return;
  }
  
  // SEGUNDO: si server tiene más páginas sin cargar, fetch siguiente
  if (hasNextPage && !isFetchingNextPage) {
    fetchNextPage();  // Carga ITEMS_PER_PAGE más del servidor
    // Incrementar displayedCount para mostrar items nuevos cuando lleguen
    setDisplayedCount(prev => prev + ITEMS_PER_LOAD);
  }
}, [displayedCount, allItems.length, hasNextPage, isFetchingNextPage, fetchNextPage, ITEMS_PER_LOAD]);

// 8️⃣ DISPLAYED - Slice del total (solo mostrar displayedCount items)
const displayedItems = allItems.slice(0, displayedCount);

// 9️⃣ INTERSECTION OBSERVER - Detecta cuando usuario scrollea al final
useEffect(() => {
  // ⚠️ IMPORTANTE: Solo si estamos en el tab correcto
  if (activeTab !== 'items') return;
  
  const observer = new IntersectionObserver(
    (entries) => {
      // Se activa cuando elemento es visible Y cumple condiciones
      if (entries.some(entry => entry.isIntersecting) &&    // Elemento visible
          !isLoading &&                                      // No cargando inicial
          !isFetchingNextPage &&                             // No cargando más
          hasMoreToDisplay) {                                // Hay más items
        loadMoreItems();
      }
    },
    { 
      threshold: 0.1,        // Activar cuando 10% del elemento visible
      rootMargin: '100px'    // Activar 100px ANTES de llegar al final (anticipado)
    }
  );
  
  // Delay pequeño para asegurar que ref está montado (especialmente después tab switch)
  const timeoutId = setTimeout(() => {
    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }
  }, 50);
  
  return () => {
    clearTimeout(timeoutId);
    observer.disconnect();
  };
}, [isLoading, isFetchingNextPage, hasMoreToDisplay, activeTab, loadMoreItems]);

// 🔟 RESET ON FILTER - Cuando filtros cambian, volver al inicio
useEffect(() => {
  setDisplayedCount(10);  // Mostrar solo los primeros 10
  // React Query invalida automaticamente queryKey al cambiar [filterType, ...]
}, [filterType, searchTerm, filterStatus]);
```

#### 3.0.2 Renderizado en JSX

```typescript
{/* Estado: Cargando inicial */}
{isLoading && <ListLoadingState message="items" />}

{/* Estado: Lista vacía */}
{!isLoading && displayedItems.length === 0 && (
  <ListEmptyState 
    title="No hay items" 
    subtitle="Intenta cambiar los filtros"
  />
)}

{/* Lista/Grid de items mostrados */}
{!isLoading && displayedItems.length > 0 && (
  <>
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {displayedItems.map((item) => (
        <ItemCard key={item.id} item={item} onEdit={handleEdit} onDelete={handleDelete} />
      ))}
    </div>
    
    {/* Observador + Indicador Visual de Carga */}
    {hasMoreToDisplay && (
      <div ref={loadMoreRef} className="py-4">
        <div className="flex items-center justify-center gap-2 text-gray-400 dark:text-gray-500 text-sm">
          {isFetchingNextPage ? (
            <>
              <LoadingSpinner size="sm" />
              <span>Cargando más items...</span>
            </>
          ) : (
            <>
              <ArrowDown className="w-4 h-4 animate-bounce" />
              <span>Desplaza para ver más ({totalCount - displayedCount} restantes de {totalCount})</span>
            </>
          )}
        </div>
      </div>
    )}
    
    {/* Estado: Se cargaron todos */}
    {!hasMoreToDisplay && totalCount > 0 && (
      <div className="py-4 text-center">
        <span className="text-gray-400 dark:text-gray-600 text-sm">
          Has visto todos los {totalCount} items
        </span>
      </div>
    )}
  </>
)}
```

#### 3.0.3 Endpoint del Servidor (CRÍTICO)

**El servidor DEBE retornar paginación correctamente**:

```typescript
// server/routes.ts
app.get('/api/mi-endpoint', authenticateToken, async (req, res) => {
  const { limit = 50, offset = 0 } = req.query;
  const companyId = req.user!.companyId;
  
  try {
    // IMPORTANTE: Cargar +1 para detectar si hay más
    const items = await db.select()
      .from(schema.items)
      .where(eq(schema.items.companyId, companyId))
      .limit(parseInt(limit) + 1)           // ← +1 para saber si hay siguiente
      .offset(parseInt(offset));
    
    // Obtener count total
    const [{ value: totalCount }] = await db.select({
      value: count()
    }).from(schema.items)
      .where(eq(schema.items.companyId, companyId));
    
    // Detectar si hay más items en servidor
    const hasMore = items.length > parseInt(limit);
    const itemsToReturn = hasMore ? items.slice(0, -1) : items; // Sacar el +1
    
    // RESPUESTA - FORMATO ESTRICTO
    res.json({
      items: itemsToReturn,          // Items para esta página
      totalCount: totalCount,        // Total en servidor
      hasMore: hasMore               // ¿Hay siguiente página?
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al cargar items' });
  }
});
```

**Formato esperado**:
```json
{
  "items": [
    { "id": 1, "name": "Item 1", ... },
    { "id": 2, "name": "Item 2", ... }
  ],
  "totalCount": 250,
  "hasMore": true
}
```

#### 3.0.4 Detalles Clave del Patrón

**✅ QUÉ HACE BIEN**:
- `useInfiniteQuery` carga en páginas (automático)
- Primeras 10 items visibles al instante
- User scrollea → muestra 10 más (local, sin fetch)
- Al llegar al final → fetch 50 más del servidor
- Indicadores visuales ("Cargando...", "Has visto todos")
- Soporta filtros (invalidación automática al cambiar)

**❌ QUÉ NO HACER**:
- ❌ `useQuery` para listas > 100 items (carga todo)
- ❌ Omitir IntersectionObserver (user no sabe desplazar)
- ❌ Olvidar +1 en backend (no detecta hasMore)
- ❌ No resetear displayedCount con filtros
- ❌ Ignorar rootMargin (fetch muy tarde)

#### 3.0.5 Checklist Implementación

- [ ] Usar `useInfiniteQuery` (NO `useQuery`)
- [ ] Backend retorna `{ items: [], totalCount, hasMore }`
- [ ] Aplanar con `.flatMap()` en `useMemo`
- [ ] `displayedCount` estado local
- [ ] `loadMoreRef` para IntersectionObserver
- [ ] Función `loadMoreItems()` con lógica smart
- [ ] IntersectionObserver con `rootMargin: '100px'`
- [ ] Indicador visual de carga ("Cargando más...")
- [ ] Mensaje "Has visto todos" cuando termina
- [ ] Reset `displayedCount` en cambio de filtros
- [ ] `enabled: !!user?.companyId` en query
- [ ] Dark mode en indicadores (clases `dark:`)

---

### 3.1 Setup de React Query

```typescript
const queryClient = useQueryClient();

const getAuthHeaders = () => ({
  'Authorization': `Bearer ${token}`,
});
```

### 3.2 Queries Básicas

```typescript
// Query simple
const { data: items = [], isLoading: isLoadingItems } = useQuery<MiTipo[]>({
  queryKey: ['/api/mi-endpoint'],
  queryFn: async () => {
    const response = await fetch('/api/mi-endpoint', {
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Error al cargar');
    return response.json();
  },
  enabled: !!user?.companyId,
  staleTime: 5 * 60 * 1000,
});

// Query con parámetros
const { data: filteredItems = [], isLoading } = useQuery<MiTipo[]>({
  queryKey: ['/api/mi-endpoint', startDate, endDate, status],
  queryFn: async () => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate.toISOString());
    if (endDate) params.append('endDate', endDate.toISOString());
    if (status !== 'all') params.append('status', status);
    
    const response = await fetch(`/api/mi-endpoint?${params}`, {
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Error');
    return response.json();
  },
  enabled: !!user?.companyId,
  staleTime: 5 * 60 * 1000,
});
```

### 3.3 Invalidación de Queries

```typescript
// Después de CREATE
queryClient.invalidateQueries({ queryKey: ['/api/mi-endpoint'] });
queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });

// Después de UPDATE
queryClient.invalidateQueries({ queryKey: ['/api/mi-endpoint'] });

// Después de DELETE
queryClient.invalidateQueries({ queryKey: ['/api/mi-endpoint'] });
queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
```

### 3.4 Loading States Progresivos

```typescript
// ✅ Loading por sección, NO global
const { data: stats, isLoading: isLoadingStats } = useQuery({...});
const { data: items, isLoading: isLoadingItems } = useQuery({...});

// En el render:
{isLoadingStats ? (
  <div>Loading stats...</div>
) : (
  <StatsCards data={stats} />
)}

{isLoadingItems ? (
  <div>Loading items...</div>
) : (
  <ItemsList data={items} />
)}
```

---

## 4. Cards de Estadísticas

### 4.1 Componente StatsCard

```typescript
interface StatsCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  isLoading?: boolean;
  index?: number; // Para animación en onda
}

function StatsCard({ label, value, icon, trend, isLoading, index = 0 }: StatsCardProps) {
  if (isLoading) {
    return (
      <Card 
        className="dark:bg-gray-800 dark:border-gray-700"
        style={{ 
          animation: 'fadeIn 0.5s ease-out',
          animationDelay: `${index * 0.1}s`,
          animationFillMode: 'backwards'
        }}
      >
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-2">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card 
      className="dark:bg-gray-800 dark:border-gray-700"
      style={{ 
        animation: 'fadeIn 0.5s ease-out',
        animationDelay: `${index * 0.1}s`,
        animationFillMode: 'backwards'
      }}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {label}
          </p>
          {icon && <div className="text-gray-400 dark:text-gray-500">{icon}</div>}
        </div>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          {value}
        </p>
        {trend && (
          <p className={`text-sm mt-2 flex items-center gap-1 ${
            trend.isPositive ? 'text-green-600' : 'text-red-600'
          }`}>
            {trend.isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            {trend.value}%
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```

### 4.2 Grid de Stats con Filtros Clickeables

```typescript
// Estado para rastrear filtro activo
const [activeStatsFilter, setActiveStatsFilter] = useState<'expenses' | 'incomes' | 'pending' | null>(null);

// Handlers para filtros al hacer click
const handleExpensesFilter = () => {
  if (activeStatsFilter === 'expenses') {
    setActiveStatsFilter(null);
    setFilterType('all');
  } else {
    setActiveStatsFilter('expenses');
    setFilterType('expense');
    setFilterStatus('all');
    setActiveTab('movements');
  }
};

const handleIncomesFilter = () => {
  if (activeStatsFilter === 'incomes') {
    setActiveStatsFilter(null);
    setFilterType('all');
  } else {
    setActiveStatsFilter('incomes');
    setFilterType('income');
    setFilterStatus('all');
    setActiveTab('movements');
  }
};

const handlePendingFilter = () => {
  if (activeStatsFilter === 'pending') {
    setActiveStatsFilter(null);
    setFilterStatus('all');
  } else {
    setActiveStatsFilter('pending');
    setFilterStatus('pending');
    setFilterType('all');
    setActiveTab('movements');
  }
};

// Grid de 4 columnas con onClick e isActive
<StatsCardGrid columns={4}>
  <StatsCard 
    label="Total Gastos" 
    value={formatCurrency(stats?.totalExpenses || 0)}
    color="red"
    icon={TrendingDown}
    isLoading={isLoadingStats}
    index={0}
    onClick={handleExpensesFilter}
    isActive={activeStatsFilter === 'expenses'}
  />
  <StatsCard 
    label="Total Ingresos" 
    value={formatCurrency(stats?.totalIncomes || 0)}
    color="green"
    icon={TrendingUp}
    isLoading={isLoadingStats}
    index={1}
    onClick={handleIncomesFilter}
    isActive={activeStatsFilter === 'incomes'}
  />
  <StatsCard 
    label="Balance" 
    value={formatCurrency(stats?.balance || 0)}
    color={(stats?.balance || 0) >= 0 ? 'green' : 'red'}
    icon={Calculator}
    isLoading={isLoadingStats}
    index={2}
  />
  <StatsCard 
    label="Pendientes" 
    value={stats?.pending || 0}
    color="orange"
    icon={AlertCircle}
    isLoading={isLoadingStats}
    index={3}
    onClick={handlePendingFilter}
    isActive={activeStatsFilter === 'pending'}
  />
</StatsCardGrid>
```

**Características**:
- ✅ Click en card aplica filtro y cambia a pestaña correspondiente
- ✅ Segundo click desactiva el filtro
- ✅ Borde fino azul cuando está activa (isActive)
- ✅ Transición a pestaña de lista con filtro aplicado
- ✅ Cards no clickeables (como Balance) no tienen onClick

### 4.3 Grid de Stats (sin filtros)

```typescript
// Grid de 4 columnas (responsive)
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
  <StatsCard 
    label="Total Items" 
    value={stats?.total || 0}
    icon={<Package className="w-5 h-5" />}
    isLoading={isLoadingStats}
    index={0}
  />
  <StatsCard 
    label="Activos" 
    value={stats?.active || 0}
    icon={<Check className="w-5 h-5" />}
    isLoading={isLoadingStats}
    index={1}
  />
  <StatsCard 
    label="Pendientes" 
    value={stats?.pending || 0}
    icon={<AlertCircle className="w-5 h-5" />}
    isLoading={isLoadingStats}
    index={2}
  />
  <StatsCard 
    label="Total Valor" 
    value={formatCurrency(stats?.totalValue || 0)}
    icon={<DollarSign className="w-5 h-5" />}
    isLoading={isLoadingStats}
    index={3}
  />
</div>
```

### 4.3 CSS Animación

```css
/* Agregar en el archivo CSS global o en <style> */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

---

## 5. Sistema de Pestañas (Tabs)

### 5.1 Estructura Básica

```typescript
const [activeTab, setActiveTab] = useState('overview'); // overview, list, settings, etc.

<Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
  <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent dark:bg-transparent dark:border-gray-700">
    <TabsTrigger 
      value="overview" 
      className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#007AFF] data-[state=active]:bg-transparent dark:data-[state=active]:border-[#007AFF] dark:text-gray-400 dark:data-[state=active]:text-white px-6 py-3"
    >
      Vista General
    </TabsTrigger>
    <TabsTrigger 
      value="list" 
      className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#007AFF] data-[state=active]:bg-transparent dark:data-[state=active]:border-[#007AFF] dark:text-gray-400 dark:data-[state=active]:text-white px-6 py-3"
    >
      Lista
    </TabsTrigger>
    <TabsTrigger 
      value="settings" 
      className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#007AFF] data-[state=active]:bg-transparent dark:data-[state=active]:border-[#007AFF] dark:text-gray-400 dark:data-[state=active]:text-white px-6 py-3"
    >
      Configuración
    </TabsTrigger>
  </TabsList>

  <TabsContent value="overview" className="mt-6">
    {/* Contenido de Vista General */}
  </TabsContent>

  <TabsContent value="list" className="mt-6">
    {/* Contenido de Lista */}
  </TabsContent>

  <TabsContent value="settings" className="mt-6">
    {/* Contenido de Configuración */}
  </TabsContent>
</Tabs>
```

### 5.2 Tabs con Iconos

```typescript
<TabsTrigger value="overview" className="...">
  <TrendingUp className="w-4 h-4 mr-2" />
  Vista General
</TabsTrigger>
```

---

## 6. Layout y Espaciado

### 6.1 Estructura de Página Estándar

**⚠️ IMPORTANTE: Esta es la estructura OBLIGATORIA para todas las páginas admin.**

```typescript
// ✅ CORRECTO - Estructura estándar (ver inventory.tsx, accounting.tsx, crm.tsx)
export default function MiFuncionalidad() {
  const [activeTab, setActiveTab] = useState('tab1');
  
  return (
    <div>
      {/* 1. Stats Cards - sin margen extra */}
      <StatsCardGrid columns={4}>
        <StatsCard icon={Icon1} label="Métrica 1" value={stat1} color="blue" />
        <StatsCard icon={Icon2} label="Métrica 2" value={stat2} color="green" />
        <StatsCard icon={Icon3} label="Métrica 3" value={stat3} color="purple" />
        <StatsCard icon={Icon4} label="Métrica 4" value={stat4} color="amber" />
      </StatsCardGrid>

      {/* 2. Tab Navigation - StatsCardGrid y TabNavigation tienen margin-bottom integrado */}
      <TabNavigation
        tabs={[
          { id: 'tab1', label: 'Tab 1', icon: Icon1 },
          { id: 'tab2', label: 'Tab 2', icon: Icon2 },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* 3. Contenido del tab - SOLO aquí usar space-y-4 */}
      <div className="space-y-4">
        {/* 3a. Barra de búsqueda/filtros - SIN card contenedora */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Contador a la IZQUIERDA */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg">
            <span className="text-sm font-medium text-foreground dark:text-white">15</span>
            <span className="text-sm text-muted-foreground dark:text-gray-400">items</span>
          </div>
          
          {/* Búsqueda en el CENTRO */}
          <div className="relative flex-1 max-w-md">
            <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input 
              placeholder="Buscar..." 
              className="pl-9 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>
          
          {/* Espaciador - empuja botón a la derecha */}
          <div className="hidden sm:block flex-1" />
          
          {/* Botón a la DERECHA */}
          <Button><Plus className="h-4 w-4 mr-2" />Nuevo</Button>
        </div>

        {/* 3b. Contenido (lista, grid, etc.) */}
        <div>
          {/* Aquí va el contenido del tab */}
        </div>
      </div>
    </div>
  );
}

// ❌ INCORRECTO - NO hacer esto
export default function MiFuncionalidad() {
  return (
    <div className="space-y-6 min-h-screen dark:bg-gray-900">  {/* ❌ NO */}
      <StatsCardGrid columns={4}>...</StatsCardGrid>
      <TabNavigation tabs={...} />
      {/* ❌ Los márgenes quedan mal */}
    </div>
  );
}
```

### 6.2 Reglas de Espaciado

**✅ SIEMPRE:**
- Contenedor principal: `<div>` sin clases (los componentes internos tienen su spacing)
- `StatsCardGrid` y `TabNavigation` tienen `margin-bottom` integrado automáticamente
- Contenido del tab: envolver en `<div className="space-y-4">`
- Usar `space-y-4` para espaciar elementos dentro del contenido

**❌ NUNCA:**
- `className="space-y-6"` en el contenedor principal (demasiado espacio)
- `className="min-h-screen dark:bg-gray-900"` en contenedor principal
- Agregar márgenes manuales a `StatsCardGrid` o `TabNavigation`
- Omitir el `<div className="space-y-4">` del contenido

### 6.3 Márgenes y Espaciado Estándar

```typescript
// Entre elementos dentro del contenido del tab
className="space-y-4"  // ← Usar este

// Entre cards en grid
className="gap-4"

// Padding de cards
className="p-6"

// Padding de modales
className="p-6"

// Espaciado en forms
className="space-y-4"

// Gap entre botones
className="gap-2"
```

### 6.4 Barra de Filtros Estándar

**⚠️ ESTRUCTURA OBLIGATORIA: Contador → Búsqueda/Filtros → Espaciador → Botón**

```typescript
{/* Estructura estándar de barra de filtros */}
<div className="flex flex-col sm:flex-row sm:items-center gap-3">
  {/* 1. IZQUIERDA: Contador de resultados */}
  <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg">
    <span className="text-sm font-medium text-foreground dark:text-white">
      {filteredItems.length}
    </span>
    <span className="text-sm text-muted-foreground dark:text-gray-400">
      items
    </span>
  </div>
  
  {/* 2. CENTRO: Input de búsqueda (si aplica) */}
  <div className="relative flex-1 max-w-md">
    <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
    <Input
      placeholder="Buscar..."
      className="pl-9 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
    />
  </div>
  
  {/* O si hay filtros tipo Select en lugar de búsqueda */}
  <Select value={filterType} onValueChange={setFilterType}>
    <SelectTrigger className="w-[180px]">
      <SelectValue placeholder="Tipo" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">Todos</SelectItem>
      {/* ... opciones ... */}
    </SelectContent>
  </Select>
  
  {/* 3. ESPACIADOR: Empuja botón a la derecha en desktop */}
  <div className="hidden sm:block flex-1" />
  
  {/* 4. DERECHA: Botón de acción principal */}
  <Button size="sm" className="bg-[#007AFF] hover:bg-[#0056CC]">
    <Plus className="w-4 h-4 mr-2" />
    Nuevo Item
  </Button>
</div>

// ❌ INCORRECTO - NO usar justify-between
<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
  {/* El justify-between no permite control fino del espaciado */}
</div>

// ❌ INCORRECTO - NO envolver en card
<div className="bg-white dark:bg-gray-800 p-4 rounded-lg border">
  {/* NO agregar card contenedora */}
</div>
```

**Reglas importantes:**
- ✅ Contador SIEMPRE a la izquierda
- ✅ Búsqueda/filtros en el centro
- ✅ Espaciador flexible `<div className="hidden sm:block flex-1" />`
- ✅ Botón de acción a la derecha
- ❌ NO usar `justify-between` (usar espaciador)
- ❌ NO envolver en card con borde

---

## 7. Modales y Diálogos

### 7.1 Modal con Scroll y Headers Sticky

```typescript
<Dialog open={showModal} onOpenChange={setShowModal}>
  <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 dark:bg-gray-800">
    {/* Header Sticky */}
    <DialogHeader className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b dark:border-gray-700 px-6 py-4">
      <DialogTitle className="dark:text-white">
        {isEditing ? 'Editar Item' : 'Nuevo Item'}
      </DialogTitle>
      <DialogDescription className="dark:text-gray-400">
        Completa los datos del item
      </DialogDescription>
    </DialogHeader>

    {/* Contenido con Scroll */}
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <div className="space-y-4">
        {/* Campos del formulario */}
        <div>
          <Label htmlFor="name">Nombre</Label>
          <Input
            id="name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="dark:bg-gray-700 dark:text-white dark:border-gray-600"
          />
        </div>
        
        {/* ... más campos ... */}
      </div>
    </div>

    {/* Footer Sticky */}
    <DialogFooter className="sticky bottom-0 z-10 bg-white dark:bg-gray-800 border-t dark:border-gray-700 px-6 py-4">
      <Button 
        variant="outline" 
        onClick={() => setShowModal(false)}
        className="dark:border-gray-600 dark:text-gray-300"
      >
        Cancelar
      </Button>
      <Button 
        onClick={handleSubmit}
        disabled={!form.name}
        className="bg-[#007AFF] hover:bg-[#0056CC]"
      >
        {isEditing ? 'Guardar' : 'Crear'}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### 7.2 Modal con Grid (Multi-columna)

```typescript
{/* Contenido con grid de 2-3 columnas */}
<div className="flex-1 overflow-y-auto px-6 py-4">
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
    {/* Columna 1 */}
    <div className="space-y-4">
      <div>
        <Label>Campo 1</Label>
        <Input {...} />
      </div>
    </div>

    {/* Columna 2 */}
    <div className="space-y-4">
      <div>
        <Label>Campo 2</Label>
        <Input {...} />
      </div>
    </div>

    {/* Columna 3 */}
    <div className="space-y-4">
      <div>
        <Label>Campo 3</Label>
        <Input {...} />
      </div>
    </div>
  </div>
</div>
```

---

## 8. Confirmaciones de Acciones

### 8.1 AlertDialog para Borrar

```typescript
// Estados
const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
const [itemToDelete, setItemToDelete] = useState<number | null>(null);

// Función para abrir confirmación
const openDeleteConfirm = (itemId: number) => {
  setItemToDelete(itemId);
  setDeleteConfirmOpen(true);
};

// Función para ejecutar eliminación
const handleDelete = async () => {
  if (!itemToDelete) return;

  try {
    const response = await fetch(`/api/mi-endpoint/${itemToDelete}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      credentials: 'include',
    });

    if (!response.ok) throw new Error('Error al eliminar');

    toast({
      title: 'Éxito',
      description: 'Item eliminado correctamente'
    });

    queryClient.invalidateQueries({ queryKey: ['/api/mi-endpoint'] });
    setDeleteConfirmOpen(false);
    setItemToDelete(null);
  } catch (error) {
    toast({
      title: 'Error',
      description: 'No se pudo eliminar el item',
      variant: 'destructive'
    });
    setDeleteConfirmOpen(false);
    setItemToDelete(null);
  }
};

// Componente AlertDialog
<AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>¿Eliminar item?</AlertDialogTitle>
      <AlertDialogDescription>
        Esta acción eliminará el item de forma permanente. 
        Esta acción no se puede deshacer.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancelar</AlertDialogCancel>
      <AlertDialogAction
        className="bg-red-600 hover:bg-red-700"
        onClick={handleDelete}
      >
        Eliminar
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>

// En el botón de eliminar
<button onClick={() => openDeleteConfirm(item.id)}>
  <Trash2 className="w-4 h-4" />
</button>
```

### 8.2 AlertDialog para Acciones Críticas

```typescript
<AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>¿Aprobar solicitud?</AlertDialogTitle>
      <AlertDialogDescription>
        {itemToConfirm && (
          <>
            Vas a aprobar la solicitud de <strong>{itemToConfirm.name}</strong>.
            Esta acción enviará una notificación al usuario.
          </>
        )}
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancelar</AlertDialogCancel>
      <AlertDialogAction
        className="bg-green-600 hover:bg-green-700"
        onClick={handleApprove}
      >
        Aprobar
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

---

## 9. Cards de Lista/Grid

**⚠️ IMPORTANTE: NO usar tablas HTML para listas de items. SIEMPRE usar cards en grid responsivo.**

### 9.0 Patrón Estándar: Barra de Búsqueda + Contador + Acción

**Todas las listas deben tener esta barra superior ANTES del contenido. ⚠️ SIN card contenedora.**

```typescript
{/* Barra de búsqueda y acciones - SIN card/borde contenedor */}
<div className="flex flex-col sm:flex-row sm:items-center gap-3">
  {/* Contador de resultados - SIEMPRE a la IZQUIERDA */}
  <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg">
    <span className="text-sm font-medium text-foreground dark:text-white">
      {filteredItems.length}
    </span>
    <span className="text-sm text-muted-foreground dark:text-gray-400">
      items
    </span>
  </div>
  
  {/* Input de búsqueda - en el CENTRO */}
  <div className="relative flex-1 max-w-md">
    <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
    <Input
      placeholder="Buscar por nombre..."
      className="pl-9 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
    />
  </div>
  
  {/* Espaciador flexible - empuja botón a la derecha en desktop */}
  <div className="hidden sm:block flex-1" />
  
  {/* Botón de acción principal - a la DERECHA */}
  <Button onClick={() => openDialog()}>
    <Plus className="h-4 w-4 mr-2" />
    Nuevo item
  </Button>
</div>

// ❌ INCORRECTO - NO usar card contenedora en la barra de filtros
<div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
  {/* NO hacer esto */}
</div>
```

### 9.1 Grid de Cards Responsivo (OBLIGATORIO)

**Este es el patrón estándar para mostrar listas. NO usar tablas HTML.**

```typescript
// Paso 1: Filtrar datos con useMemo
const filteredItems = useMemo(() => {
  const term = searchTerm.toLowerCase();
  return items.filter((item) => item.name.toLowerCase().includes(term));
}, [items, searchTerm]);

// Paso 2: Renderizar grid de cards
<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
  {filteredItems.map((item) => (
    <Card 
      key={item.id} 
      className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 hover:shadow-md transition-shadow"
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-base text-gray-900 dark:text-white">
              {item.name}
            </CardTitle>
            {item.subtitle && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {item.subtitle}
              </p>
            )}
          </div>
          <Badge variant={item.status === 'active' ? 'default' : 'secondary'} className="ml-2">
            {item.status === 'active' ? 'Activo' : item.status}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-2 text-sm">
        {/* Información con iconos emoji o lucide */}
        {item.email && (
          <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
            <span className="text-gray-500 dark:text-gray-400 text-xs">✉</span>
            <span className="truncate">{item.email}</span>
          </div>
        )}
        {item.phone && (
          <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
            <span className="text-gray-500 dark:text-gray-400 text-xs">📞</span>
            <span>{item.phone}</span>
          </div>
        )}
        {item.location && (
          <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
            <span className="text-gray-500 dark:text-gray-400 text-xs">📍</span>
            <span>{item.location}</span>
          </div>
        )}
        
        {/* Notas con borde superior si existen */}
        {item.notes && (
          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
              {item.notes}
            </p>
          </div>
        )}
        
        {/* Acciones en la parte inferior */}
        <div className="flex items-center justify-end gap-1 pt-2">
          <Button variant="ghost" size="sm" onClick={() => onEdit(item)} className="h-8">
            <Edit2 className="h-3.5 w-3.5 mr-1" />
            Editar
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => onDelete(item.id)} 
            className="h-8 text-red-500 hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Eliminar
          </Button>
        </div>
      </CardContent>
    </Card>
  ))}
</div>
```

### 9.2 Componentes Estandarizados de Carga y Estado Vacío

**⚠️ IMPORTANTE: Usa los componentes predefinidos para consistencia en toda la app.**

```typescript
import { ListLoadingState } from "@/components/ui/list-loading-state";
import { ListEmptyState } from "@/components/ui/list-empty-state";
```

**Implementación de los componentes:**

**`ListLoadingState`**: Muestra spinner y mensaje durante la carga.
```tsx
// Uso
{isLoading ? (
  <ListLoadingState message="fichajes" />
) : (
  // ... renderizado normal
)}

// Implementación (ya existe en components/ui/list-loading-state.tsx)
export function ListLoadingState({ message, className = "" }: ListLoadingStateProps) {
  return (
    <div className={`text-center py-12 ${className}`}>
      <div className="flex flex-col items-center justify-center space-y-3">
        <LoadingSpinner size="md" color="gray" />
        <div className="text-gray-500 dark:text-gray-400 font-medium">
          Cargando {message}...
        </div>
      </div>
    </div>
  );
}
```

**`ListEmptyState`**: Muestra icono y mensaje cuando no hay datos.
```tsx
// Uso
{filteredData.length === 0 && (
  <ListEmptyState 
    title="No hay solicitudes de ausencias" 
    subtitle="Las solicitudes aparecerán aquí una vez creadas"
  />
)}

// Implementación (ya existe en components/ui/list-empty-state.tsx)
export function ListEmptyState({ title, subtitle, className = "" }: ListEmptyStateProps) {
  return (
    <div className={`text-center py-12 ${className}`}>
      <div className="flex flex-col items-center justify-center space-y-2">
        <Inbox className="w-8 h-8 text-gray-400 dark:text-gray-500" />
        <div className="text-gray-600 dark:text-gray-400 font-medium">
          {title}
        </div>
        {subtitle && (
          <div className="text-gray-500 dark:text-gray-500 text-sm">
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}
```

### 9.3 Componente Reutilizable para Listas con Estados

**Patrón completo con los 3 estados (cargando, vacío, con datos):**

```typescript
// Componente ItemsList - Extraer a función separada
function ItemsList({
  data,
  loading,
  onEdit,
  onDelete,
  emptyTitle,
  emptySubtitle,
}: {
  data: Item[];
  loading: boolean;
  onEdit: (item: Item) => void;
  onDelete: (id: number) => void;
  emptyTitle: string;
  emptySubtitle?: string;
}) {
  // ✅ Estado de carga - Usar componente predefinido
  if (loading) {
    return <ListLoadingState message="elementos" />;
  }

  // ✅ Estado vacío - Usar componente predefinido
  if (!data.length) {
    return <ListEmptyState title={emptyTitle} subtitle={emptySubtitle} />;
  }

  // ✅ Cards en lista vertical (full-width) - Patrón correcto
  return (
    <div className="space-y-3">
      {data.map((item) => (
        <Card key={item.id} className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <CardTitle className="text-base text-gray-900 dark:text-white">
                {item.name}
              </CardTitle>
              <Badge variant={item.status === 'active' ? 'default' : 'secondary'}>
                {item.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {/* Contenido del card */}
            <div className="flex items-center justify-end gap-1 pt-2">
              <Button variant="ghost" size="sm" onClick={() => onEdit(item)}>
                <Edit2 className="h-3.5 w-3.5 mr-1" />
                Editar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onDelete(item.id)} className="text-red-500">
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Eliminar
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

**❌ INCORRECTO - No implementar manualmente:**
```typescript
// ❌ NO: Implementación manual del loader
if (loading) {
  return <div className="flex justify-center py-12"><LoadingSpinner /></div>;
}

// ❌ NO: Card personalizada para estado vacío
if (!data.length) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <Package className="h-12 w-12 mx-auto text-gray-300 mb-4" />
        <p className="text-gray-500">No hay items</p>
      </CardContent>
    </Card>
  );
}

// ❌ NO: Grid de múltiples columnas (las cards deben ser full-width)
return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">...</div>;
```

### 9.4 Cards con Información Compleja

**Para items con más información (proyectos, movimientos) - Siempre full-width:**

```typescript
<div className="space-y-3">
  {data.map((item) => (
    <Card key={item.id} className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 hover:shadow-md transition-shadow">
      <CardHeader className="space-y-2 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base text-gray-900 dark:text-white">
            {project.name}
          </CardTitle>
          <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
            {project.status}
          </Badge>
        </div>
        {project.code && (
          <p className="text-xs font-mono text-gray-500 dark:text-gray-400">
            {project.code}
          </p>
        )}
      </CardHeader>
      
      <CardContent className="space-y-3 text-sm">
        {/* Descripción */}
        {project.description && (
          <p className="text-sm leading-relaxed line-clamp-2">
            {project.description}
          </p>
        )}
        
        {/* Fechas con icono */}
        {(project.startDate || project.dueDate) && (
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <Calendar className="h-4 w-4" />
            <span>
              {project.startDate ? new Date(project.startDate).toLocaleDateString('es-ES') : 'Sin fecha'}
              {project.dueDate ? ` → ${new Date(project.dueDate).toLocaleDateString('es-ES')}` : ''}
            </span>
          </div>
        )}

    )}
    
    {/* Progreso con barra visual */}
    {project.progress !== null && (
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-gray-500 dark:text-gray-400">Progreso</span>
          <span className="font-medium">{project.progress}%</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${project.progress}%` }}
          />
        </div>
      </div>
    )}
    
    {/* Badges relacionados */}
    <div className="space-y-1">
      <Label className="text-xs text-gray-500 dark:text-gray-400">Clientes</Label>
      <div className="flex flex-wrap gap-1">
        {project.clients.map((c) => (
          <Badge key={c.id} variant="outline" className="text-xs">
            {c.name}
          </Badge>
        ))}
        {!project.clients.length && (
          <span className="text-xs text-gray-500">Sin clientes</span>
        )}
      </div>
    </div>
    
    {/* Acciones con borde superior */}
    <div className="flex items-center justify-end gap-1 pt-2 border-t border-gray-200 dark:border-gray-700">
      <Button variant="ghost" size="sm" onClick={() => onEdit(project)} className="h-8">
        <Edit2 className="h-3.5 w-3.5 mr-1" />
        Editar
      </Button>
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={() => onDelete(project.id)} 
        className="h-8 text-red-500 hover:text-red-600"
      >
        <Trash2 className="h-3.5 w-3.5 mr-1" />
        Eliminar
      </Button>
    </div>
  </CardContent>
</Card>
```

### 9.5 Reglas Importantes

**✅ SIEMPRE:**
- Usar grid responsivo: `grid gap-4 md:grid-cols-2 xl:grid-cols-3`
- Incluir barra de búsqueda con contador `X de Y`
- Manejar 3 estados: loading, vacío, con datos
- Usar `hover:shadow-md transition-shadow` en cards
- Incluir dark mode en todos los elementos
- Usar `line-clamp-2` para textos largos
- Poner acciones en parte inferior de card

**❌ NUNCA:**
- Usar tablas HTML (`<table>`) para listas de items
- Omitir el contador de resultados
- Olvidar el estado de loading
- Usar Alert para estado vacío
- Poner demasiada información en un card (máximo 8-10 campos)
- Olvidar el filtro con `useMemo`

---

## 9.6 Cards con Estados Coloreados en la Esquina Superior Derecha

**Patrón estándar para mostrar estados visuales en cards con ajuste responsivo horizontal.**

### 9.6.1 Diseño del Badge de Estado en Esquina Superior Derecha

Todos los cards que muestren un estado deben tener el badge coloreado en la **esquina superior derecha**, posicionado absolutamente para no afectar el layout.

**Estructura correcta:**

```typescript
<Card 
  key={item.id} 
  className="relative border border-gray-200 dark:border-gray-700 dark:bg-gray-800 hover:shadow-md transition-shadow"
>
  {/* Badge de estado - SIEMPRE en esquina superior derecha */}
  {item.status && (
    <div className="absolute -top-2 -right-2 z-10">
      <Badge 
        className={`${getStatusColor(item.status)} text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow-md`}
      >
        {getStatusLabel(item.status)}
      </Badge>
    </div>
  )}

  <CardHeader className="pb-3 pr-8">
    {/* Contenido - con padding-right adicional para que no se superponga con el badge */}
    <CardTitle className="text-base text-gray-900 dark:text-white">
      {item.name}
    </CardTitle>
  </CardHeader>

  <CardContent className="space-y-3">
    {/* Campos del card */}
  </CardContent>
</Card>
```

### 9.6.2 Función Helper para Colores de Estado

**Crear una función reutilizable para mapear estados a colores:**

```typescript
// helpers/statusColors.ts
type StatusType = 'pending' | 'approved' | 'rejected' | 'active' | 'inactive' | 'in_progress' | 'completed';

export function getStatusColor(status: StatusType): string {
  const colors: Record<StatusType, string> = {
    pending: 'bg-yellow-500 dark:bg-yellow-600',      // Amarillo - esperando
    approved: 'bg-green-500 dark:bg-green-600',       // Verde - aprobado
    rejected: 'bg-red-500 dark:bg-red-600',           // Rojo - rechazado
    active: 'bg-blue-500 dark:bg-blue-600',           // Azul - activo
    inactive: 'bg-gray-400 dark:bg-gray-600',         // Gris - inactivo
    in_progress: 'bg-purple-500 dark:bg-purple-600',  // Púrpura - en progreso
    completed: 'bg-emerald-500 dark:bg-emerald-600',  // Verde oscuro - completado
  };
  return colors[status] || 'bg-gray-400';
}

export function getStatusLabel(status: StatusType): string {
  const labels: Record<StatusType, string> = {
    pending: 'Pendiente',
    approved: 'Aprobado',
    rejected: 'Rechazado',
    active: 'Activo',
    inactive: 'Inactivo',
    in_progress: 'En progreso',
    completed: 'Completado',
  };
  return labels[status] || status;
}
```

### 9.6.3 Ajuste Responsivo Horizontal - Campos Adaptables

**Para que los campos se adapten correctamente en pantallas pequeñas y grandes SIN cortarse:**

```typescript
<CardContent className="space-y-2 text-sm">
  {/* OPCIÓN 1: Información en fila que se ajusta automáticamente */}
  {item.email && (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 min-w-0">
      <span className="flex-shrink-0 text-gray-500 dark:text-gray-400 font-medium">
        Email:
      </span>
      <span className="truncate text-gray-700 dark:text-gray-300">
        {item.email}
      </span>
    </div>
  )}

  {/* OPCIÓN 2: Información con icono que se adapta */}
  {item.phone && (
    <div className="flex items-center gap-2 min-w-0">
      <Phone className="h-4 w-4 flex-shrink-0 text-gray-500 dark:text-gray-400" />
      <span className="truncate text-gray-700 dark:text-gray-300">
        {item.phone}
      </span>
    </div>
  )}

  {/* OPCIÓN 3: Información importante - dos columnas que se colapsan */}
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
    <div className="min-w-0">
      <Label className="text-xs text-gray-500 dark:text-gray-400">
        Teléfono
      </Label>
      <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
        {item.phone || '-'}
      </p>
    </div>
    <div className="min-w-0">
      <Label className="text-xs text-gray-500 dark:text-gray-400">
        Ciudad
      </Label>
      <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
        {item.city || '-'}
      </p>
    </div>
  </div>

  {/* OPCIÓN 4: Descripción larga que se recorta */}
  {item.description && (
    <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
      <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
        {item.description}
      </p>
    </div>
  )}
</CardContent>
```

### 9.6.4 Reglas Importantes para Responsividad Horizontal

**✅ SIEMPRE:**
- Usar `min-w-0` en contenedores flex para permitir `truncate` en hijos
- Usar `flex-shrink-0` en iconos y etiquetas para evitar que se reduzcan
- Usar `truncate` o `line-clamp-N` para textos largos
- Usar `flex-col sm:flex-row` para convertir columnas en filas en desktop
- Usar `grid grid-cols-1 sm:grid-cols-2` para distribuciones que se colapsan
- Añadir `pr-8` o `pr-10` al header si hay badge en esquina derecha
- Usar `gap-1 sm:gap-2` para espaciado adaptativo

**❌ NUNCA:**
- Usar ancho fijo (width en px) en campos de texto
- Olvidar `min-w-0` en padres flex con hijos truncados
- Permitir que el texto se corte sin `truncate` o `line-clamp`
- Usar `text-ellipsis` sin `overflow-hidden truncate`
- Poner demasiados campos en una sola fila (máximo 3-4 en desktop)

### 9.6.5 Ejemplo Completo: Card con Estado y Campos Responsivos

```typescript
export function ProjectCard({ project, onEdit, onDelete }: ProjectCardProps) {
  return (
    <Card 
      key={project.id}
      className="relative border border-gray-200 dark:border-gray-700 dark:bg-gray-800 hover:shadow-md transition-shadow overflow-hidden"
    >
      {/* Badge de estado en esquina superior derecha */}
      {project.status && (
        <div className="absolute -top-2 -right-2 z-10">
          <Badge 
            className={`${getStatusColor(project.status)} text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow-md`}
          >
            {getStatusLabel(project.status)}
          </Badge>
        </div>
      )}

      <CardHeader className="pb-2 pr-8">
        <div className="space-y-1">
          <CardTitle className="text-base text-gray-900 dark:text-white">
            {project.name}
          </CardTitle>
          {project.code && (
            <p className="text-xs font-mono text-gray-500 dark:text-gray-400">
              #{project.code}
            </p>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3 text-sm">
        {/* Descripción */}
        {project.description && (
          <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
            {project.description}
          </p>
        )}

        {/* Fecha y cliente - Dos columnas que se colapsan */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="min-w-0">
            <Label className="text-xs text-gray-500 dark:text-gray-400">
              Cliente
            </Label>
            <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
              {project.clientName || '-'}
            </p>
          </div>
          <div className="min-w-0">
            <Label className="text-xs text-gray-500 dark:text-gray-400">
              Fecha Inicio
            </Label>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {project.startDate ? format(new Date(project.startDate), 'dd/MM/yyyy', { locale: es }) : '-'}
            </p>
          </div>
        </div>

        {/* Progreso con barra */}
        {project.progress !== null && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400">Progreso</span>
              <span className="font-medium text-gray-900 dark:text-white">{project.progress}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-600 dark:bg-blue-500 h-2 transition-all"
                style={{ width: `${project.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Acciones en la base */}
        <div className="flex items-center justify-end gap-1 pt-2 border-t border-gray-200 dark:border-gray-700">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => onEdit(project)}
            className="h-8 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            <Edit2 className="h-3.5 w-3.5 mr-1" />
            Editar
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => onDelete(project.id)}
            className="h-8 text-red-500 hover:text-red-600 dark:hover:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Eliminar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## 11. Botones y Acciones

### 11.1 Botón "Añadir" Principal

```typescript
// Estilo estándar para todos los botones de añadir
<Button 
  size="sm" 
  className="bg-[#007AFF] hover:bg-[#0056CC] text-white"
  onClick={handleOpenModal}
>
  <Plus className="w-4 h-4 mr-2" />
  Añadir Item
</Button>
```

### 11.2 Botones de Acción en Cards

```typescript
// Editar
<button
  onClick={() => handleEdit(item)}
  className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
  title="Editar"
>
  <Edit2 className="w-4 h-4" />
</button>

// Eliminar
<button
  onClick={() => openDeleteConfirm(item.id)}
  className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors"
  title="Eliminar"
>
  <Trash2 className="w-4 h-4" />
</button>

// Aprobar
<button
  onClick={() => handleApprove(item.id)}
  className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors"
  title="Aprobar"
>
  <Check className="w-4 h-4" />
</button>

// Rechazar
<button
  onClick={() => handleReject(item.id)}
  className="p-1.5 rounded-lg text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/30 transition-colors"
  title="Rechazar"
>
  <X className="w-4 h-4" />
</button>
```

### 11.3 FAB (Floating Action Button) - Mobile

```typescript
{/* Fixed button en mobile */}
<div className="md:hidden fixed bottom-6 right-6 z-40">
  <Button 
    size="lg"
    className="bg-[#007AFF] hover:bg-[#0056CC] text-white rounded-full shadow-lg w-14 h-14 p-0"
    onClick={handleOpenModal}
  >
    <Plus className="w-6 h-6" />
  </Button>
</div>
```

---

## 12. Modo Oscuro

### 12.1 Fondo de Página Principal

**IMPORTANTE:** El contenedor principal de página debe usar:

```typescript
// ✅ CORRECTO - Fondo blanco en modo claro, gris oscuro en modo oscuro
<div className="space-y-6 min-h-screen dark:bg-gray-900">
  {/* Contenido */}
</div>

// ❌ INCORRECTO - NO usar bg-gray-50 en contenedor principal
// Esto crea un fondo gris claro que no coincide con el resto del app
<div className="space-y-6 min-h-screen bg-gray-50 dark:bg-gray-900">
```

**Regla:** El contenedor principal de página `<div className="space-y-6 min-h-screen">` debe:
- **Modo claro**: NO tener background (hereda blanco del body)
- **Modo oscuro**: `dark:bg-gray-900`
- Los cards internos SÍ pueden tener `bg-white dark:bg-gray-800`

### 12.2 Clases Tailwind para Dark Mode

```typescript
// Backgrounds - Contenedores
className="dark:bg-gray-900"              // Page container (main div)
className="bg-white dark:bg-gray-800"     // Cards, panels
className="bg-gray-100 dark:bg-gray-700"  // Subtle backgrounds

// Borders
className="border dark:border-gray-700"
className="border-b dark:border-gray-700"

// Text
className="text-gray-900 dark:text-white"
className="text-gray-600 dark:text-gray-300"
className="text-gray-500 dark:text-gray-400"

// Inputs
className="dark:bg-gray-700 dark:text-white dark:border-gray-600"

// Hover states
className="hover:bg-gray-50 dark:hover:bg-gray-700"
className="hover:bg-gray-100 dark:hover:bg-gray-600"

// Cards
<Card className="dark:bg-gray-800 dark:border-gray-700">

// Buttons
className="dark:text-gray-300 dark:hover:bg-gray-700"
className="dark:border-gray-600"
```

### 12.3 Componentes con Dark Mode

```typescript
// Dialog
<DialogContent className="dark:bg-gray-800">
  <DialogHeader className="dark:bg-gray-800 dark:border-gray-700">
    <DialogTitle className="dark:text-white">Título</DialogTitle>
    <DialogDescription className="dark:text-gray-400">
      Descripción
    </DialogDescription>
  </DialogHeader>
  
  <div className="dark:bg-gray-800">
    {/* Content */}
  </div>
  
  <DialogFooter className="dark:bg-gray-800 dark:border-gray-700">
    <Button className="dark:border-gray-600 dark:text-gray-300">
      Cancelar
    </Button>
  </DialogFooter>
</DialogContent>

// Tabs
<TabsTrigger className="dark:text-gray-400 dark:data-[state=active]:text-white dark:data-[state=active]:border-[#007AFF]">
  Tab
</TabsTrigger>

// Badge
<Badge className="dark:bg-gray-700 dark:text-gray-300">

// Borders
className="border dark:border-gray-700"
className="border-b dark:border-gray-700"

// Text
className="text-gray-900 dark:text-white"
className="text-gray-600 dark:text-gray-300"
className="text-gray-500 dark:text-gray-400"

// Inputs
className="dark:bg-gray-700 dark:text-white dark:border-gray-600"

// Hover states
className="hover:bg-gray-50 dark:hover:bg-gray-700"
className="hover:bg-gray-100 dark:hover:bg-gray-600"

// Cards
<Card className="dark:bg-gray-800 dark:border-gray-700">

// Buttons
className="dark:text-gray-300 dark:hover:bg-gray-700"
className="dark:border-gray-600"
```

### 12.4 Componentes con Dark Mode (Dialog/Tabs)

```typescript
// Dialog
<DialogContent className="dark:bg-gray-800">
  <DialogHeader className="dark:bg-gray-800 dark:border-gray-700">
    <DialogTitle className="dark:text-white">Título</DialogTitle>
    <DialogDescription className="dark:text-gray-400">
      Descripción
    </DialogDescription>
  </DialogHeader>
  
  <div className="dark:bg-gray-800">
    {/* Content */}
  </div>
  
  <DialogFooter className="dark:bg-gray-800 dark:border-gray-700">
    <Button className="dark:border-gray-600 dark:text-gray-300">
      Cancelar
    </Button>
  </DialogFooter>
</DialogContent>

// Tabs
<TabsTrigger className="dark:text-gray-400 dark:data-[state=active]:text-white dark:data-[state=active]:border-[#007AFF]">
  Tab
</TabsTrigger>

// Badge
<Badge className="dark:bg-gray-700 dark:text-gray-300">
  Estado
</Badge>
```

### 12.5 Registrar Ruta en Theme Provider

**CRÍTICO:** Para que el modo oscuro funcione en tu página, DEBES registrar las rutas en `client/src/lib/theme-provider.tsx`.

#### Paso 1: Agregar rutas al array `adminRoutes`

```typescript
// client/src/lib/theme-provider.tsx línea ~67

const adminRoutes = [
  '/accounting',
  '/accounting/*',
  '/inventory',
  '/inventory/*',
  '/crm',                          // ← Agregar
  '/clientes-proyectos',           // ← Agregar (alias)
  '/oficaz/crm',                   // ← Agregar (variant)
  '/oficaz/clientes-proyectos',    // ← Agregar (variant)
  '/vacation-management',
  '/vacation-management/*',
  // ... más rutas admin
];
```

#### Paso 2: Actualizar regex de company alias

```typescript
// client/src/lib/theme-provider.tsx línea ~140

const companyAliasPattern = /\/accounting|\/inventory|\/crm|\/clientes-proyectos|\/vacation-management|\/time-tracking/;
```

#### Paso 3: Cómo funciona

El `ThemeProvider`:
1. Detecta si la ruta actual está en `adminRoutes`
2. Si sí, aplica `dark` class al elemento `<html>`
3. Todos los `dark:*` classes en tu página se activan automático
4. El tema sigue la preferencia del usuario (localStorage)

```typescript
// Tu página solo necesita tener las clases dark:*
<div className="space-y-6 min-h-screen dark:bg-gray-900">
  <StatsCard className="dark:bg-gray-800 dark:text-white" />
</div>

// ThemeProvider se encarga de activar/desactivar automático
```

---

## 13. Iconos

### 13.1 Iconos Predefinidos Lucide

```typescript
// Importar solo los que uses
import {
  // Acciones
  Plus, Edit2, Trash2, X, Check, Save, Download, Upload,
  
  // Navegación
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown,
  ArrowLeft, ArrowRight,
  
  // Estados
  Loader2, AlertCircle, CheckCircle, Info, AlertTriangle,
  
  // Datos
  TrendingUp, TrendingDown, Calendar, Clock, DollarSign,
  
  // Categorías (ejemplo contabilidad)
  Zap, Users, Building2, Package, Car, Megaphone,
  Briefcase, PlusCircle, Tag, Calculator,
  
  // Otros
  Filter, Search, Settings, MoreVertical, Eye, EyeOff,
  FileText, Image, Paperclip, Send, Mail
} from 'lucide-react';
```

### 13.2 Sistema de Iconos para Categorías

```typescript
// Definir mapeo de iconos
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  'Zap': Zap,
  'Users': Users,
  'Building2': Building2,
  'Package': Package,
  'Car': Car,
  'Megaphone': Megaphone,
  'DollarSign': DollarSign,
  'Briefcase': Briefcase,
  'PlusCircle': PlusCircle,
  'Tag': Tag,
  'Calculator': Calculator,
  'TrendingUp': TrendingUp,
  'TrendingDown': TrendingDown,
};

// Opciones para selector
const ICON_OPTIONS = [
  { value: 'Zap', label: 'Rayo (Suministros)' },
  { value: 'Users', label: 'Usuarios (Personal)' },
  { value: 'Building2', label: 'Edificio (Instalaciones)' },
  // ... más opciones
];

// Helper para obtener icono
const getCategoryIcon = (iconName: string): LucideIcon => {
  return CATEGORY_ICONS[iconName] || Tag;
};

// Uso en JSX
const IconComponent = getCategoryIcon(category.icon);
<IconComponent className="w-5 h-5" />
```

### 13.3 Selector de Iconos (Grid)

```typescript
<div>
  <Label>Icono</Label>
  <div className="grid grid-cols-6 gap-2 mt-2">
    {ICON_OPTIONS.map(option => {
      const IconComponent = CATEGORY_ICONS[option.value];
      return (
        <button
          key={option.value}
          type="button"
          onClick={() => setForm({ ...form, icon: option.value })}
          className={`p-3 rounded-lg border-2 transition-all ${
            form.icon === option.value
              ? 'border-[#007AFF] bg-blue-50 dark:bg-blue-900/30'
              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
          }`}
          title={option.label}
        >
          <IconComponent className={`w-5 h-5 ${
            form.icon === option.value
              ? 'text-[#007AFF]'
              : 'text-gray-600 dark:text-gray-400'
          }`} />
        </button>
      );
    })}
  </div>
</div>
```

---

## 14. Formularios

### 13.1 Estructura de Formulario en Modal

```typescript
<div className="space-y-4">
  {/* Input básico */}
  <div>
    <Label htmlFor="name">Nombre *</Label>
    <Input
      id="name"
      value={form.name}
      onChange={(e) => setForm({ ...form, name: e.target.value })}
      placeholder="Ej: Mi item"
      className="dark:bg-gray-700 dark:text-white dark:border-gray-600"
    />
  </div>

  {/* Textarea */}
  <div>
    <Label htmlFor="description">Descripción</Label>
    <Textarea
      id="description"
      value={form.description}
      onChange={(e) => setForm({ ...form, description: e.target.value })}
      rows={3}
      placeholder="Describe el item..."
      className="dark:bg-gray-700 dark:text-white dark:border-gray-600"
    />
  </div>

  {/* Select */}
  <div>
    <Label>Tipo *</Label>
    <Select value={form.type} onValueChange={(value) => setForm({ ...form, type: value })}>
      <SelectTrigger className="dark:bg-gray-700 dark:text-white dark:border-gray-600">
        <SelectValue placeholder="Selecciona un tipo" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="type1">Tipo 1</SelectItem>
        <SelectItem value="type2">Tipo 2</SelectItem>
      </SelectContent>
    </Select>
  </div>

  {/* Date picker */}
  <div>
    <Label>Fecha</Label>
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-start text-left font-normal dark:bg-gray-700 dark:text-white dark:border-gray-600"
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selectedDate ? format(selectedDate, 'PPP', { locale: es }) : 'Selecciona una fecha'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={setSelectedDate}
          locale={es}
        />
      </PopoverContent>
    </Popover>
  </div>

  {/* Number input */}
  <div>
    <Label htmlFor="amount">Importe *</Label>
    <Input
      id="amount"
      type="number"
      step="0.01"
      min="0"
      value={form.amount}
      onChange={(e) => setForm({ ...form, amount: e.target.value })}
      placeholder="0.00"
      className="dark:bg-gray-700 dark:text-white dark:border-gray-600"
    />
  </div>

  {/* File upload */}
  <div>
    <Label>Archivos adjuntos</Label>
    <input
      ref={fileInputRef}
      type="file"
      multiple
      accept="image/*,.pdf"
      onChange={handleFileChange}
      className="hidden"
    />
    <Button
      type="button"
      variant="outline"
      onClick={() => fileInputRef.current?.click()}
      className="w-full dark:bg-gray-700 dark:border-gray-600"
    >
      <Paperclip className="w-4 h-4 mr-2" />
      Adjuntar archivos ({files.length})
    </Button>
    {files.length > 0 && (
      <div className="mt-2 space-y-1">
        {files.map((file, idx) => (
          <div key={idx} className="flex items-center justify-between text-sm">
            <span className="truncate">{file.name}</span>
            <button
              onClick={() => setFiles(files.filter((_, i) => i !== idx))}
              className="text-red-600 hover:text-red-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    )}
  </div>
</div>
```

### 13.2 Validación de Formulario

```typescript
// Validar antes de submit
const handleSubmit = async () => {
  // Validaciones
  if (!form.name?.trim()) {
    toast({
      title: 'Error',
      description: 'El nombre es obligatorio',
      variant: 'destructive'
    });
    return;
  }

  if (!form.amount || parseFloat(form.amount) <= 0) {
    toast({
      title: 'Error',
      description: 'El importe debe ser mayor a 0',
      variant: 'destructive'
    });
    return;
  }

  // ... continuar con submit
};

// Deshabilitar botón de submit
<Button 
  onClick={handleSubmit}
  disabled={!form.name || !form.amount}
>
  Guardar
</Button>
```

### 13.3 FormData para Archivos

```typescript
const handleSubmit = async () => {
  try {
    const formData = new FormData();
    
    // Agregar JSON data
    const data = {
      name: form.name,
      description: form.description,
      amount: parseFloat(form.amount),
      type: form.type,
      categoryId: parseInt(form.categoryId),
      date: selectedDate?.toISOString(),
    };
    formData.append('data', JSON.stringify(data));
    
    // Agregar archivos
    files.forEach(file => {
      formData.append('files', file);
    });
    
    const response = await fetch('/api/mi-endpoint', {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: formData,
    });
    
    if (!response.ok) throw new Error('Error');
    
    toast({ title: 'Éxito', description: 'Item creado' });
    queryClient.invalidateQueries({ queryKey: ['/api/mi-endpoint'] });
    setShowModal(false);
    resetForm();
  } catch (error) {
    toast({ title: 'Error', variant: 'destructive' });
  }
};
```

---

## 15. Integración en la Tienda (Addons Pagables)

**ESTE ES EL PASO MÁS CRÍTICO. NO SALTARLO.**

### 14.1 Paso 1: Definir Addon en shared/addon-definitions.ts

Archivo: [shared/addon-definitions.ts](shared/addon-definitions.ts)

```typescript
import { Users2, Briefcase } from 'lucide-react';

export interface AddonDefinition {
  key: string;
  name: string;
  price: number;
  icon: React.ComponentType<any>;
  description: string;
  features: string[];
  isCore?: boolean;
}

export const ADDON_DEFINITIONS: AddonDefinition[] = [
  // ... addons existentes ...
  
  {
    key: 'mi_nueva_funcionalidad',
    name: 'Mi Nueva Funcionalidad',
    price: 15, // €/mes
    icon: Briefcase, // ← Icono del módulo
    description: 'Descripción clara de qué hace',
    features: [
      'Característica 1',
      'Característica 2',
      'Característica 3'
    ]
  }
];

// Esta es la FUENTE ÚNICA DE VERDAD para la funcionalidad
```

**⚠️ IMPORTANTE**: Cambios aquí se reflejan automáticamente en:
- Landing page pricing
- Addon store catalog
- API responses
- Rutas protegidas

### 14.2 Paso 2: Proteger Rutas con Middleware

Archivo: [server/middleware/auth.ts](server/middleware/auth.ts)

```typescript
// Primero, crear middleware requireFeature en auth.ts
export function requireFeature(featureKey: string, getStorage?: () => StorageInterface) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const storage = getStorage?.();
    const subscription = await storage?.getSubscription(req.user.companyId);
    
    // Verificar que feature está en subscription.features
    if (subscription?.features?.[featureKey] !== true) {
      return res.status(402).json({ 
        error: 'Funcionalidad no comprada',
        feature: featureKey 
      });
    }
    
    next();
  };
}
```

Luego en [server/routes.ts](server/routes.ts), proteger TODAS las rutas:

```typescript
import { requireFeature } from './middleware/auth';
import { ADDON_DEFINITIONS } from '@shared/addon-definitions';

// ========== MI NUEVA FUNCIONALIDAD ==========

// GET - Listar items
router.get('/api/mi-nueva-funcionalidad', 
  requireFeature('mi_nueva_funcionalidad', () => storage),
  async (req, res) => {
    // implementación
  }
);

// POST - Crear
router.post('/api/mi-nueva-funcionalidad',
  requireFeature('mi_nueva_funcionalidad', () => storage),
  async (req, res) => {
    // implementación
  }
);

// PATCH - Editar
router.patch('/api/mi-nueva-funcionalidad/:id',
  requireFeature('mi_nueva_funcionalidad', () => storage),
  async (req, res) => {
    // implementación
  }
);

// DELETE - Eliminar
router.delete('/api/mi-nueva-funcionalidad/:id',
  requireFeature('mi_nueva_funcionalidad', () => storage),
  async (req, res) => {
    // implementación
  }
);

// ✅ Resultado: API retorna 402 si feature no comprada
```

### 14.3 Paso 3: Insertar en Base de Datos (Migration SQL)

Archivo: [migrations/add_mi_nueva_funcionalidad.sql](migrations/add_mi_nueva_funcionalidad.sql)

```sql
-- Insertar nueva funcionalidad en tabla de addons
INSERT INTO addons (key, name, price, is_active, sort_order)
VALUES (
  'mi_nueva_funcionalidad',
  'Mi Nueva Funcionalidad',
  15.00,
  true,
  10 -- último sort_order
)
RETURNING id, key, name, price;

-- Verificar
SELECT id, key, name, price, is_active FROM addons WHERE key = 'mi_nueva_funcionalidad';
```

Ejecutar:
```bash
node --env-file=.env scripts/run-sql.js migrations/add_mi_nueva_funcionalidad.sql
```

**⚠️ VERIFICAR**: Sin este registro en tabla `addons`, la funcionalidad NO aparecerá en la tienda.

### 14.4 Paso 4: Actualizar Addon Store UI

Archivo: [client/src/pages/addon-store.tsx](client/src/pages/addon-store.tsx)

```typescript
// En la función getAddonIcon():
const getAddonIcon = (key: string) => {
  switch (key) {
    case 'mi_nueva_funcionalidad':
      return <Briefcase className="w-5 h-5" />;
    // ... otros addons ...
    default:
      return <Package className="w-5 h-5" />;
  }
};

// En la función getAddonColor():
const getAddonColor = (key: string) => {
  switch (key) {
    case 'mi_nueva_funcionalidad':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    // ... otros addons ...
    default:
      return 'bg-gray-100 text-gray-700';
  }
};
```

**Resultado**: Addon aparece en tienda con icono y color propios.

### 14.5 Paso 5: Actualizar Landing Page (Pricing)

Archivo: [client/src/pages/landing.tsx](client/src/pages/landing.tsx)

```typescript
import { Briefcase } from 'lucide-react';
import { ADDON_DEFINITIONS } from '@shared/addon-definitions';

// En la sección de pricing, importar addon-definitions para obtener definiciones:
const addons = ADDON_DEFINITIONS.filter(a => a.key !== 'ai_assistant');

// En render:
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {addons.map(addon => (
    <div key={addon.key} className="...">
      <div className="flex items-center gap-2">
        <addon.icon className="w-5 h-5" />
        <h3 className="font-semibold">{addon.name}</h3>
      </div>
      <p className="text-gray-600">{addon.description}</p>
      <p className="text-2xl font-bold text-gray-900">{addon.price}€/mes</p>
    </div>
  ))}
</div>
```

**Resultado**: Landing page muestra automáticamente todos los addons con precios. Si cambias addon-definitions, landing se actualiza sola.

### 14.6 Paso 6: Proteger Navegación en Menú

Archivo: [client/src/components/Sidebar.tsx](client/src/components/Sidebar.tsx) o donde esté el menú

```typescript
import { useAuth } from '@/contexts/AuthContext';

export function Sidebar() {
  const { user, subscription, hasAccess } = useAuth();
  
  // ✅ CORRECTO: Verificar que feature está activo con hasAccess()
  // hasAccess() verifica que status === 'active' (no pending_cancel)
  {hasAccess('mi_nueva_funcionalidad', { bypassManagerRestrictions: true }) && (
    <NavLink to="/admin/mi-nueva-funcionalidad">
      <Briefcase className="w-4 h-4" />
      <span>Mi Nueva Funcionalidad</span>
    </NavLink>
  )}
  
  // ❌ INCORRECTO: Confiar en subscription.features directamente
  // subscription.features incluye pending_cancel (acceso api) pero no se debería mostrar en menú
  // {subscription?.features?.mi_nueva_funcionalidad && (
  //   <NavLink to="/...">
}
```

**⚠️ CRÍTICO**: Usar `hasAccess()` para menú, no `subscription.features`. Esto evita que aparezca "comprado" cuando está siendo cancelado.

**Nota sobre estados de addon**:
- **active**: Usuario tiene acceso completo, aparece comprado en tienda
- **pending_cancel**: Cancelación programada para fin de período, usuario mantiene acceso (API + menú), pero NO aparece como "comprado" en tienda
- **cancelled**: Sin acceso, sin menú, API rechaza con 402

### 14.8 Paso 7: Lógica Correcta de Estados en Tienda (CRÍTICO)

Archivo: [client/src/pages/addon-store.tsx](client/src/pages/addon-store.tsx)

**PROBLEMA HISTÓRICO**: Si mostraba `isPurchased = true` para status 'active' Y 'pending_cancel', el usuario veía feature como "comprado" incluso cuando estaba siendo cancelado. Confusión.

```typescript
// ❌ INCORRECTO:
const isPurchased = companyAddon?.status === 'active' || companyAddon?.status === 'pending_cancel';

// ✅ CORRECTO: Diferenciar entre acceso API y mostrar en tienda
const isActive = companyAddon?.status === 'active'; // Solo para tienda
const isPendingCancel = companyAddon?.status === 'pending_cancel'; // Estado de transición

return {
  ...addon,
  isPurchased: isActive,    // ← Solo true si active, nunca si pending_cancel
  isPendingCancel,          // ← Booleano separado para mostrar "Cancelación programada"
  isInCooldown,
  // ... resto
};
```

**Comportamiento en tienda**:
- **active**: Botón rojo "Cancelar complemento"
- **pending_cancel**: Botón gris "Cancelación programada" + fecha de efectividad
- **cancelled**: Botón azul "Comprar" (disponible de nuevo)
- **cooldown**: Botón gris "No disponible aún" (hasta fecha de cooldown)

### 14.9 Paso 8: Página Admin de la Funcionalidad

Archivo: [client/src/pages/admin/mi-nueva-funcionalidad.tsx](client/src/pages/admin/mi-nueva-funcionalidad.tsx)

```typescript
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';

export default function MiNuevaFuncionalidad() {
  const { user, subscription } = useAuth();
  const { toast } = useToast();
  
  // ✅ Protección en frontend (redundante pero buena UX)
  if (!subscription?.features?.mi_nueva_funcionalidad) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card>
          <CardHeader>
            <CardTitle>Funcionalidad no disponible</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Necesitas comprar esta funcionalidad para acceder.</p>
            <Button onClick={() => navigate('/store')} className="mt-4">
              Ir a la Tienda
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Resto del componente...
}
```

### 14.8 Resumen Checklist de Tienda

- [ ] Addon definido en `shared/addon-definitions.ts` con key, name, price, icon
- [ ] TODOS los endpoints `/api/addon-name/*` protegidos con `requireFeature()`
- [ ] Registro creado en tabla `addons` via migration SQL
- [ ] Icon y color añadidos a `getAddonIcon()` y `getAddonColor()` en addon-store.tsx
- [ ] Addon incluído en landing.tsx pricing calculator
- [ ] Navegación en menú protegida: `if (hasAccess('key'))`  ← **CRÍTICO**
- [ ] Página admin tiene check de permisos y redirige a tienda si no comprado
- [ ] Error 402 en API si feature no comprada
- [ ] **🔴 IMPORTANTE**: `isPurchased = true` SOLO si status === 'active', NUNCA si pending_cancel
- [ ] Verificación en staging/producción que aparece en tienda

---

## 16. Testing y Validación de Addons
    route: '/admin/mi-nueva-funcionalidad',
  },
  
  // ... más addons ...
};
```

### 14.2 Ruta en el Router

```typescript
// En client/src/App.tsx
import MiNuevaFuncionalidad from './pages/mi-nueva-funcionalidad';

// Dentro de las rutas protegidas
<Route path="/admin/mi-nueva-funcionalidad" element={<MiNuevaFuncionalidad />} />
```

### 14.3 Verificación de Addon en la Página

```typescript
export default function MiNuevaFuncionalidad() {
  const { user } = useAuth();
  
  // Verificar si el usuario tiene acceso al addon
  const hasAccess = user?.subscriptionAddons?.includes('mi-nueva-funcionalidad');
  
  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-orange-500" />
            <h2 className="text-xl font-bold mb-2">Addon no activado</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Necesitas activar el addon "Mi Nueva Funcionalidad" para acceder a esta sección.
            </p>
            <Button 
              onClick={() => window.location.href = '/admin/store'}
              className="bg-[#007AFF] hover:bg-[#0056CC]"
            >
              Ir a la Tienda
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Resto del componente...
}
```

### 14.4 Menú de Navegación

```typescript
// Agregar en el componente de navegación (sidebar/navbar)
{user?.subscriptionAddons?.includes('mi-nueva-funcionalidad') && (
  <NavLink to="/admin/mi-nueva-funcionalidad">
    <Package className="w-5 h-5" />
    <span>Mi Funcionalidad</span>
  </NavLink>
)}
```

---

## 16. Checklist de Implementación

### ✅ Backend (API)

- [ ] Crear esquema en `shared/schema.ts` (tablas Drizzle ORM)
- [ ] Crear migración SQL en `migrations/`
- [ ] Ejecutar migración en base de datos
- [ ] Crear endpoints en `server/routes.ts`:
  - [ ] GET `/api/mi-endpoint` - Listar items
  - [ ] GET `/api/mi-endpoint/:id` - Obtener item
  - [ ] POST `/api/mi-endpoint` - Crear item
  - [ ] PUT `/api/mi-endpoint/:id` - Actualizar item
  - [ ] DELETE `/api/mi-endpoint/:id` - Eliminar item
  - [ ] GET `/api/mi-endpoint/dashboard` - Estadísticas (opcional)
- [ ] Implementar autenticación en endpoints (Bearer token)
- [ ] Verificar permisos (companyId, role)
- [ ] Manejar uploads de archivos si es necesario

### ✅ Integración Tienda (OBLIGATORIO PARA ADDONS PAGABLES)

- [ ] Addon definido en `shared/addon-definitions.ts`
- [ ] TODOS los endpoints protegidos con `requireFeature()`
- [ ] Migration SQL con INSERT en tabla `addons`
- [ ] Icon y color en `addon-store.tsx` (getAddonIcon + getAddonColor)
- [ ] Addon en `landing.tsx` pricing calculator
- [ ] **🔴 IMPORTANTE**: Menú protegido con `hasAccess()`, NO `subscription.features`
- [ ] **🔴 IMPORTANTE**: `isPurchased` solo true si status === 'active'
- [ ] **🔴 IMPORTANTE**: `isPendingCancel` mostrado como estado separado

### ✅ Frontend - Estructura

- [ ] Crear archivo `client/src/pages/mi-nueva-funcionalidad.tsx`
- [ ] Importar todos los componentes necesarios
- [ ] Configurar useAuth() y useQueryClient()
- [ ] Definir interfaces TypeScript

### ✅ Frontend - React Query

- [ ] Implementar query para listar items
- [ ] Implementar query para estadísticas (si aplica)
- [ ] Configurar `enabled: !!user?.companyId`
- [ ] Configurar `staleTime: 5 * 60 * 1000`
- [ ] Implementar invalidación en CREATE/UPDATE/DELETE

### ✅ Frontend - UI Components

- [ ] Header sticky con título
- [ ] Cards de estadísticas con loading progresivo
- [ ] Tabs si hay múltiples vistas
- [ ] Barra de filtros con altura mínima `min-h-[40px]`
- [ ] Botón "Añadir" con estilo `bg-[#007AFF]`
- [ ] Lista/Grid de items con layout horizontal
- [ ] Responsive (desktop y mobile)

### ✅ Frontend - Modales

- [ ] Modal para crear/editar con scroll
- [ ] Header sticky en modal
- [ ] Footer sticky en modal
- [ ] Grid de columnas si es formulario largo
- [ ] Validación de campos
- [ ] Estados de loading en botones

### ✅ Frontend - Confirmaciones

- [ ] AlertDialog para eliminar
- [ ] AlertDialog para otras acciones críticas
- [ ] Estados: `[deleteConfirmOpen, itemToDelete]`
- [ ] Funciones: `openDeleteConfirm()`, `handleDelete()`
- [ ] Botón rojo de eliminar

### ✅ Frontend - Dark Mode

- [ ] Todos los backgrounds con `dark:`
- [ ] Todos los borders con `dark:`
- [ ] Todos los textos con `dark:`
- [ ] Cards con `dark:bg-gray-800 dark:border-gray-700`
- [ ] Inputs con `dark:bg-gray-700 dark:border-gray-600`
- [ ] Modales con clases dark

### ✅ Integración en Tienda (CRÍTICO)

- [ ] Definición en `shared/addon-definitions.ts` (key, name, price, icon)
- [ ] Todas las rutas `/api/addon/*` protegidas con `requireFeature()`
- [ ] Migration SQL para insertar en tabla `addons`
- [ ] Icon y color en `addon-store.tsx` (getAddonIcon + getAddonColor)
- [ ] Addon en `landing.tsx` para pricing calculator
- [ ] **🔴 Menú protegido con `hasAccess()`, NO `subscription.features`**
- [ ] **🔴 `isPurchased = true` SOLO si status === 'active'**
- [ ] Página admin verifica permisos y redirige a tienda si no comprado
- [ ] Error 402 si intenta acceder a API sin comprar

### ✅ Testing y Validación (OBLIGATORIO)

- [ ] Comprar addon → aparece comprado + menú visible + API ✅
- [ ] Cancelar addon → menú desaparece INMEDIATAMENTE
- [ ] Tienda muestra "Cancelación programada" cuando status = pending_cancel
- [ ] API sigue funcionando en pending_cancel (acceso mantenido)
- [ ] Fin de período → API rechaza 402, menú oculto, tienda muestra "Comprar"
- [ ] Probar carga inicial sin errores
- [ ] Probar crear item
- [ ] Probar editar item
- [ ] Probar eliminar item (con AlertDialog)
- [ ] Probar filtros
- [ ] Probar responsive (mobile/desktop)
- [ ] Probar dark mode
- [ ] Probar permisos (admin vs user)
- [ ] Verificar que queries invalidan correctamente
- [ ] Verificar mensajes de error con toast

---

## 📚 Referencias de Código

### Páginas de Referencia

1. **accounting.tsx** - Implementación completa con:
   - React Query progresivo
   - Cards horizontales
   - AlertDialog integrado
   - Iconos Lucide
   - Modales con scroll
   - Filtros avanzados

2. **vacation-management.tsx** - Estándares de:
   - Botones consistentes
   - Layout de cards
   - Sistema de aprobaciones

3. **inventory.tsx** - Patrones de:
   - AlertDialog
   - Gestión de imágenes
   - Categorización

4. **time-tracking.tsx** - Ejemplos de:
   - React Query
   - Loading progresivo
   - Cards de estadísticas

### Utilidades Comunes

```typescript
// Formatear moneda
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
};

// Formatear fecha
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const formattedDate = format(new Date(date), 'dd MMM yyyy', { locale: es });
const formattedDateTime = format(new Date(date), 'dd/MM/yyyy HH:mm', { locale: es });

// Debounce para búsquedas
const [searchTerm, setSearchTerm] = useState('');
const [debouncedSearch, setDebouncedSearch] = useState('');

useEffect(() => {
  const timer = setTimeout(() => {
    setDebouncedSearch(searchTerm);
  }, 300);
  return () => clearTimeout(timer);
}, [searchTerm]);
```

---

## 🎯 Resumen de Mejores Prácticas

1. **Autenticación**: Siempre usar `useAuth()`, nunca localStorage directamente
2. **React Query**: Implementar carga progresiva, no loading global
3. **Permisos**: Verificar `enabled: !!user?.companyId` en queries
4. **Addons Pagables**: SIEMPRE implementar flujo completo desde el inicio (ver sección 0 y 14)
5. **Feature Gating**: Proteger rutas API con `requireFeature()`, menú con `hasAccess()` (NO `subscription.features`)
6. **UI Consistente**: Usar estándares de botones, colores, espaciado
7. **Modales**: Header y footer sticky, contenido con scroll
8. **Confirmaciones**: AlertDialog para todas las acciones críticas, nunca `confirm()`
9. **Dark Mode**: Todas las clases con variantes `dark:`
10. **Responsive**: Desktop horizontal, mobile vertical
11. **Iconos**: Lucide React, sistema de mapeo para categorías
12. **Validación**: Verificar datos antes de submit, deshabilitar botones
13. **Tienda**: Feature NO aparece en menú si no está comprado, error 402 en API
14. **Estados de Addon**: `isPurchased` SOLO true si status === 'active', nunca en pending_cancel

---

**¡Con esta guía puedes crear nuevas funcionalidades completas y consistentes, con integración en tienda desde el inicio!** 🚀

---

## Lección Aprendida I: Caso del CRM (Diciembre 2025)

**Problema**: El CRM fue implementado con todas sus funcionalidades pero se olvidó de:
- No agregar a addon-definitions.ts
- No proteger rutas con middleware
- No insertar en tabla addons
- No actualizar addon-store.tsx UI

**Resultado**: 
- ❌ CRM aparecía en menú accediendo directo a URL
- ❌ No había opción de compra en tienda
- ❌ Usuarios confundidos viendo feature sin poder activarla

**Solución** (Diciembre 29, 2025):
- Agregada sección completa "0. IMPORTANTE: Sistema de Addons Pagables"
- Expandida sección 14 con 8 pasos detallados + código de ejemplo
- Checklist adicional para tienda
- Este documento ahora es guía obligatoria para CUALQUIER nueva funcionalidad

**Lección**: Siempre implementar feature + tienda + protecciones de forma integral. No dejar pasos para "después".

---

## Lección Aprendida II: Bug de Cancelación de Addons (Diciembre 29, 2025)

**Problema**: Cuando se cancela un addon (status = 'pending_cancel' o 'cancelled'):
- ❌ El addon sigue mostrando en barra lateral como comprado
- ❌ Usuario intenta acceder y obtiene 402
- ❌ Confusión: ¿por qué aparece en menú si no funciona?

**Raiz del bug**:
1. `addon-store.tsx` mostraba `isPurchased = true` si status era 'active' O 'pending_cancel'
2. Barra lateral NO usaba `hasAccess()`, confiaba en `subscription.features` del JWT
3. `subscription.features` se construye dinámicamente en storage, INCLUYENDO pending_cancel (correcto para API)
4. Pero JWT se cachea en frontend y no se actualiza inmediatamente
5. Resultado: Menú muestra feature 1-2 segundos después de cancelar

**Solución implementada**:
- `addon-store.tsx` línea 425: `isPurchased` ahora SOLO true si status === 'active'
- `sidebar.tsx` línea 142: CRM ahora usa `hasAccess('crm')` como otros addons
- `addon-store.tsx` línea 426: `isPendingCancel` detecta correctamente estado

**Estados correctos**:
- **active**: Comprado, en menú, en tienda como "Comprado"
- **pending_cancel**: EN TRANSICIÓN - mantiene API access, sigue en menú, pero tienda muestra "Cancelación programada"
- **cancelled**: SIN acceso, NO en menú, tienda muestra "Disponible para compra"

**Lessons**:
1. El frontend debe verificar `hasAccess()` para menú, no confiar en JWT
2. Distinguir entre "acceso API" (active + pending_cancel) y "mostrar como comprado" (solo active)
3. Los estados internos de addon deben ser consistentes en toda la app

---

**¡Con esta guía puedes crear nuevas funcionalidades completas y consistentes, con integración en tienda desde el inicio!** 🚀
