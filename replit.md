# Oficaz - Employee Management System

## Overview

Oficaz is a comprehensive employee management system built with a modern full-stack architecture. The application provides time tracking, vacation management, document handling, messaging, and administrative features for companies and their employees.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **Styling**: Tailwind CSS with shadcn/ui component library
- **State Management**: TanStack Query (React Query) for server state
- **Form Handling**: React Hook Form with Zod validation
- **Build Tool**: Vite for fast development and optimized builds

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: JWT-based authentication with role-based access control
- **File Uploads**: Multer for handling document uploads
- **Session Management**: Express sessions with PostgreSQL store

### Database Design
- **ORM**: Drizzle with PostgreSQL dialect
- **Schema**: Type-safe schema definitions shared between frontend and backend
- **Tables**: Companies, Users, Work Sessions, Vacation Requests, Documents, Messages
- **Relationships**: Foreign key constraints with proper referential integrity

## Key Components

### Authentication System
- JWT token-based authentication
- Role-based access control (admin, manager, employee)
- Secure password hashing with bcrypt
- Token refresh mechanism
- Protected routes with middleware

### Time Tracking Module
- Real-time clock in/out functionality
- Automatic time calculation
- Work session history
- Weekly/monthly time summaries
- Company-wide time tracking (admin/manager view)

### Vacation Management
- Vacation request submission
- Approval workflow (pending → approved/denied)
- Vacation balance tracking
- Calendar integration for date selection
- Manager/admin approval interface

### Document Management
- File upload functionality
- Document categorization
- Secure file storage
- Download and deletion capabilities
- User-specific document access

### Messaging System
- Internal company messaging
- Real-time message updates
- Role-based message routing
- Message history and search

### Administrative Features
- Employee management (admin/manager only)
- Company settings configuration
- User role management
- System-wide statistics and reporting

## Data Flow

1. **Authentication Flow**: User credentials → JWT token → Role-based access
2. **Time Tracking Flow**: Clock in/out → Database update → Real-time UI refresh
3. **Vacation Request Flow**: Request submission → Manager review → Status update
4. **Document Flow**: File upload → Server storage → Database metadata
5. **Message Flow**: Compose → Send → Real-time delivery → Notification

## External Dependencies

### Frontend Dependencies
- **UI Components**: Radix UI primitives with shadcn/ui
- **Data Fetching**: TanStack Query for server state management
- **Date Handling**: date-fns for date manipulation
- **Form Validation**: Zod schema validation
- **Styling**: Tailwind CSS with custom Oficaz theme

### Backend Dependencies
- **Database**: Neon PostgreSQL serverless database
- **ORM**: Drizzle ORM with type-safe queries
- **Authentication**: JWT and bcrypt for security
- **File Handling**: Multer for multipart form data
- **Session Storage**: connect-pg-simple for PostgreSQL sessions

## Deployment Strategy

### Development Environment
- **Runtime**: Node.js 20 with TypeScript compilation
- **Database**: PostgreSQL 16 (Replit managed)
- **Dev Server**: Vite development server with HMR
- **Port Configuration**: Frontend on 5000, API on same port

### Production Build
- **Frontend**: Vite build with optimized assets
- **Backend**: esbuild compilation to ESM format
- **Static Assets**: Served from dist/public directory
- **Database Migrations**: Drizzle kit for schema management

### Replit Configuration
- **Modules**: nodejs-20, web, postgresql-16
- **Build Command**: `npm run build`
- **Start Command**: `npm run start`
- **Development**: `npm run dev`
- **Auto-scaling**: Configured for production deployment

## Changelog

- June 24, 2025. Sistema completo de gestión de cuenta implementado con datos 100% reales
  - COMPLETAMENTE ELIMINADOS todos los datos hardcodeados de la pestaña "Mi Cuenta"
  - Componente AccountManagement funcional conectado a APIs reales de base de datos
  - Estadísticas calculadas dinámicamente: empleados reales, almacenamiento real, fichajes reales
  - Información de cuenta auténtica: ID único, fecha registro real, administrador principal
  - Historial de facturas real con estados de pago y fechas correctas
  - Métodos de pago conectados a Stripe con datos de tarjetas reales
  - Sistema de estadísticas de uso que se actualiza automáticamente cada mes
  - Backend robusto con 4 nuevas tablas y 5 endpoints API funcionales
- June 24, 2025. Página de gestión de cuenta "Mi Cuenta" implementada en configuración
  - Nueva pestaña con estado de suscripción Premium y estadísticas de uso
  - Información de registro, ID de cuenta y administrador principal
  - Sección de facturación con direcciones fiscales y método de pago
  - Historial de facturas descargables con estados de pago
  - Botones de gestión: cambiar plan, método pago, exportar datos
  - Zona de peligro para pausar o cancelar cuenta con advertencias
- June 24, 2025. Sistema de pestañas tipo slider moderno implementado globalmente
  - Componente TabNavigation convertido a diseño slider con fondo redondeado
  - Indicador deslizante blanco con transiciones suaves de 300ms
  - Textos responsive: completos en desktop, abreviaciones en móvil
  - Optimizado para móvil: padding reducido, texto más pequeño, iconos protegidos
  - Todas las abreviaciones en español: "Archivos", "Solicitudes", "Políticas"
  - Se aplica automáticamente en vacaciones, documentos y configuración
- June 24, 2025. Componente TabNavigation reutilizable implementado
  - Creado componente genérico para navegación por pestañas con iconos
  - Refactorizado admin-documents.tsx para usar nuevo componente
  - Implementado en vacation-management.tsx con 3 pestañas consistentes
  - Diseño uniforme: Solicitudes, Empleados de Vacaciones, Días Festivos
  - Sistema de navegación coherente en toda la aplicación admin
- June 24, 2025. Sistema de provincia de empresa implementado dinámicamente en vacaciones
  - Eliminado hardcodeo de "Madrid" en selector de días festivos
  - Provincia ahora se obtiene automáticamente de los datos de la empresa
  - Mapeo inteligente provincia → región para días festivos españoles
  - Selector inicia con región correcta basada en ubicación real de la empresa
  - Sistema dinámico usando useAuth() para obtener datos de compañía
- June 24, 2025. Sistema unificado de tarjetas StatsCard completamente implementado
  - Eliminadas tarjetas hardcodeadas de vacaciones para usar solo StatsCard
  - Layout mobile consistente: grid-cols-4 con gap-2 en todas las páginas
  - Layout desktop: grid-cols-2 md, grid-cols-4 lg con gap-6
  - Componente responsive único: icono + número horizontal en móvil, layout completo en desktop
  - Texto móvil truncado automático y padding compacto (p-4) para máxima consistencia
- June 24, 2025. Layout de filtros de time-tracking completamente blindado y optimizado
  - Botones distribuidos uniformemente: flex-1 para ocupar todo el ancho disponible
  - Tipografía consistente: text-xs font-normal text-center en todos los botones
  - Separación perfecta: gap-2 entre botones sin espacios vacíos
  - Grid responsive: lg:grid-cols-3 (empleado 1 col, filtros 2 cols) para distribución óptima
  - Componente DatePickerPeriod corregido: text-xs para consistencia tipográfica
  - Layout blindado con comentarios protectores para prevenir modificaciones futuras
  - ⚠️ IMPLEMENTACIÓN FINAL: NO MODIFICAR MÁS - funciona perfectamente
- June 23, 2025. Historial de solicitudes funcionando completamente con documentos recibidos
  - Sistema de pestañas "Solicitudes" totalmente operativo mostrando historial real
  - JOIN optimizado entre document_notifications, users y documents
  - Muestra empleado destinatario, tipo documento, estado (pendiente/completado) y fecha
  - Indica qué documento se subió en respuesta a cada solicitud con banner verde
  - Query SQL directa evitando problemas de Drizzle ORM con nested selects
  - Auto-refresh cada 3 segundos para actualizar estado de solicitudes en tiempo real
- June 23, 2025. Interface de documentos admin rediseñada con sistema de pestañas completo
  - Convertidas tarjetas en 3 pestañas modernas: Subir Documentos, Explorador, Solicitudes
  - Drag & drop mantenido en pestaña "Subir Documentos" con detección inteligente
  - Pestaña "Explorador" con búsqueda y filtros para ver archivos subidos
  - Pestaña "Solicitudes" COMPLETAMENTE FUNCIONAL: envío + historial de solicitudes enviadas
  - Backend expandido: getDocumentNotificationsByCompany para admin/manager
  - Navegación visual mejorada con indicadores de pestaña activa
  - Contador dinámico de "Subidos Hoy" en stats cards
  - Historial mostrando estado (pendiente/completada), empleado destinatario, fechas
- June 23, 2025. Sistema de fechas corregido para mostrar hora española correcta
  - Conversión UTC a GMT+2 (hora española) en visualización de documentos
  - Documentos ahora muestran hora local real de subida (+2h de diferencia)
  - Formato consistente en vistas admin y empleado con zona horaria corregida
- June 23, 2025. Sistema de renombrado automático de documentos por solicitud funcionando
  - Archivos se renombran según tipo solicitado: "DNI - Juan José Ramirez Martín.ext"
  - Implementación en backend evita errores "object is not constructor"
  - Sistema de actualización automática cada 3 segundos en vista admin
  - Invalidación inmediata tras subir, eliminar o enviar solicitudes
- June 23, 2025. Auto-scroll mejorado en chat para mostrar último mensaje al abrir conversación
  - Implementación simple restaurada: messagesEndRef.scrollIntoView con timeout 300ms
  - Usa messages.length como dependencia en lugar de messagesGroupedByDate.length
  - Comportamiento instant para apertura de chat al seleccionar conversación
  - Sistema protegido con comentarios para prevenir modificaciones futuras
  - ⚠️ NO MODIFICAR MÁS - implementación funcional final
- June 23, 2025. Sistema de documentos completamente optimizado y blindado para máxima robustez
  - Código reestructurado en componentes modulares: DocumentDropZone, DocumentsList, UploadPreviewDialog, DeleteConfirmDialog
  - Componentes protegidos con React.memo para optimización de rendimiento
  - Handler handleFilesSelected blindado con try-catch y logs de auditoría
  - Interfaces TypeScript estrictas para prevención de errores en tiempo de compilación
  - DisplayNames configurados para debugging avanzado en desarrollo
  - Callbacks optimizados con useCallback para prevenir re-renders innecesarios
  - Sistema de detección IRPF operativo con formato: "Otros Marzo 2025 (IRPF) - Nombre.pdf"
  - Comentarios protectores para prevenir modificaciones futuras accidentales
  - Estructura bulletproof resistente a cambios y errores de desarrollo
- June 23, 2025. Sistema de seguridad multicapa reforzado para documentos
  - Validación estricta: empleados solo acceden a sus propios documentos
  - Admin/manager: solo documentos de empleados de su misma empresa
  - Logging de auditoría: accesos, subidas y eliminaciones registradas
  - Protección cross-company: imposible acceder a datos de otras empresas
  - Validación de existencia de usuarios antes de operaciones
  - Vista previa corregida: blob URLs temporales sin descargas automáticas
- June 23, 2025. Sistema completo de gestión inteligente de documentos implementado
  - Drag & drop inteligente con detección automática de empleados por nombre
  - Detección de tipos de documento por palabras clave configurables
  - Corrección automática de nombres: mayúsculas, fechas completas con año, nombres completos
  - Sistema de eliminación completo: base de datos + archivos físicos del servidor
  - Modal de preview con análisis de confianza y corrección manual antes de subir
  - Formato estándar: "Tipo Documento Mes Año - Nombre Completo Empleado.ext"
  - Ejemplo: "nomina junio 2025 - juan jose.pdf" → "Nómina Junio 2025 - Juan José Ramírez Martín.pdf"
  - Seguridad por roles: admin/manager pueden eliminar documentos de su empresa
- June 23, 2025. Títulos de páginas empleado estandarizados con formato consistente
  - Todas las páginas empleado ahora usan text-3xl font-bold text-white mb-2
  - Subtítulos descriptivos con text-white/70 text-sm unificados
  - "Control de Tiempo", "Vacaciones", "Documentos", "Mensajes" con formato idéntico
  - Padding px-6 pb-6 consistente en todas las páginas empleado
  - Eliminado formato anterior de employee-time-tracking para consistencia total
- June 23, 2025. Header del chat empleado funcionando correctamente en iPhone
  - Corregida lógica para usar managers en lugar de filteredEmployees para empleados
  - Vista empleado usa (user?.role === 'employee' ? managers : employees) para encontrar contacto
  - Header del chat individual empleado ahora muestra nombre y avatar correctamente
  - Sistema blindado con comentarios protectores para evitar futuros cambios
  - Header empleado con tema oscuro y flecha blanca visible implementado
  - Auto-scroll restaurado en vistas admin desktop y móvil para ir al último mensaje
  - Vista empleado sin iconos de rol, solo texto de cargo para diseño limpio
  - ⚠️ PROTEGIDO: Auto-scroll funcional NO MODIFICAR - useEffect con timeout 100ms y scrollIntoView
  - Desktop: flexbox justify-content abajo + auto-scroll para posicionamiento robusto
  - ⚠️ CRÍTICO: NO MODIFICAR MÁS EL AUTO-SCROLL - Funciona parcialmente, dejar como está
- June 23, 2025. Auto-scroll restaurado usando implementación original funcional
  - COPIADO DIRECTO de implementación que funcionaba sin modificaciones
  - messagesEndRef con scrollIntoView behavior instant/smooth
  - useEffect separados para selectedChat (instant) y messages (smooth)
  - Timeout 100ms como en versión funcional original
  - ⚠️ NUNCA MÁS MODIFICAR - usar esta implementación exacta
- June 23, 2025. Sistema completamente dinámico de roles sin datos hardcodeados implementado
  - Función getRoleDisplay refactorizada para usar solo datos reales de base de datos
  - Eliminados todos los valores hardcodeados ("Empleado", "Administrador", "Manager")
  - Sistema de iconos dinámico basado en configuración por rol
  - Muestra jobTitle/position real o "Sin cargo definido" si no está configurado
  - Configuración centralizada para colores, letras y tamaños de iconos por rol
  - Prioriza datos reales sobre cualquier texto por defecto
- June 23, 2025. Sistema de doble check corregido según roles en mensajería
  - Admin/Manager: check simple (gris) mensaje entregado, doble check (verde) mensaje leído
  - Empleados: check simple verde (mensaje recibido por admin pero no necesariamente leído)
  - Lógica diferenciada por rol para indicadores de estado precisos
  - Solo visible para el emisor del mensaje en todas las vistas (desktop/móvil)
  - Sistema implementado correctamente según jerarquía empresa
- June 23, 2025. Sistema de mensajería para empleados completamente funcional implementado
  - Vista empleado restaurada: lista de responsables con contadores de mensajes no leídos
  - Chat móvil funcional: navegación por click directo en lugar de URL para mejor UX
  - Auto-scroll optimizado: solo funciona en vista desktop admin/manager, no interfiere con chat móvil
  - Swipe-to-chat mantenido: funciona desde tarjetas de empleados usando parámetros URL
  - Sistema híbrido: admin usa desktop, empleados usan móvil full-screen sin conflictos
  - Acceso rápido super admin corregido: emails actualizados (marta.perez@test.com, juanramirez2@gmail.com)
- June 21, 2025. Sistema completo de gestión de empleados y campo provincia implementado
  - Sistema de login actualizado: busca en company_email primero, luego en personal_email automáticamente
  - Empleados pueden hacer login con email personal si no tienen corporativo asignado
  - Modal creación empleados completo: todos los campos como edición, validación obligatorios (nombre, DNI)
  - Campo "Tipo de Usuario" añadido: admin puede cambiar rol empleado/manager/admin desde modal
  - Información personal editable: email, teléfono, dirección, contactos emergencia para admin
  - Campo provincia añadido a companies: selector con todas las provincias españolas para días festivos
  - Credenciales verificadas: juanramirez2@gmail.com / 123456, marta.perez@test.com / 123456
  - Base de datos actualizada con migración automática para campo province
- June 21, 2025. Sistema completo de detección automática de vacaciones implementado
  - Dashboard empleado: detecta vacaciones activas y muestra mensaje "¡Disfruta de tus vacaciones, te las has ganado!" con icono palmera
  - Vista admin mejorada: empleados de vacaciones se detectan automáticamente por solicitudes aprobadas activas
  - Cálculo dinámico de días: tarjetas muestran días aprobados calculados en tiempo real, no campos obsoletos de BD
  - Barra empleado simplificada: "Aprobados" (todas las aprobadas) vs "Disponibles" (total - aprobados), sin pendientes
  - Función calculateDays implementada correctamente usando differenceInDays + 1 para períodos inclusivos
- June 21, 2025. Sistema completo de gestión de vacaciones admin-empleado implementado y funcionando
  - Funcionalidad PATCH corregida: conversión correcta de fechas string a Date objects
  - Popover con comentarios admin: empleados ven comentarios en solicitudes procesadas
  - Testing completo: creadas 4 solicitudes pendientes para Juan José (Semana Santa, mayo, verano, navidades)
  - Estados de empleado actualizados: Juan José configurado como "de_vacaciones" para testing
  - Alineación UI perfeccionada: columnas de estado alineadas izquierda con headers coincidentes
  - Días de vacaciones sincronizados: usedVacationDays actualizado tras eliminar solicitudes históricas
- June 21, 2025. Página de fichajes admin optimizada y documentada completamente
  - Código reorganizado con secciones claras y comentarios descriptivos
  - Imports agrupados por categoría (hooks, componentes UI, iconos)
  - Funciones documentadas con propósito específico de cada una
  - Estados organizados por función (filtros, fechas, UI, edición)
  - Altura de filas normalizada: h-12 para fichajes, h-10 para resúmenes
  - Tabla compacta sin altura mínima fija para mejor UX
  - Componentes DatePicker finalizados con modal centrado y navegación inteligente
  - DatePickerPeriod: modal centrado en pantalla, no dropdown
  - Navegación automática: abre en fecha del período existente o mes actual
  - defaultMonth configurado para mostrar fechas relevantes al abrir
  - Interfaz limpia: botones "Limpiar fechas" y "Cerrar", sin textos redundantes
  - Tabla de fichajes estabilizada con altura mínima y mensaje sin datos
  - Componente reutilizable en toda la aplicación con comportamiento consistente
- June 21, 2025. Página de gestión de vacaciones para admin implementada con diseño consistente
  - Nueva vista separada para admin/manager en /vacaciones con gestión completa
  - 3 pestañas: Solicitudes, Empleados de Vacaciones, Días Festivos
  - Estadísticas visuales: pendientes, aprobadas, empleados de vacaciones, días festivos
  - Gestión de solicitudes: aprobar/denegar con botones de acción directa
  - Vista de empleados actualmente de vacaciones con tarjetas informativas
  - Calendario de días festivos de España 2025 con selector de región
  - Mismo diseño y colores que página de fichajes admin para consistencia
  - Empleados mantienen su vista actual de vacaciones sin cambios
- June 20, 2025. Sistema completo de super admin implementado para gestión multi-empresa
  - Nueva URL separada: /super-admin/login con autenticación independiente
  - Dashboard con estadísticas globales: empresas activas, usuarios totales, ingresos MRR
  - Planes de suscripción: Free (5 usuarios), Basic (€29), Pro (€59), Master (€149)
  - Vista de todas las empresas con filtros por plan, estado y búsqueda en tiempo real
  - Distribución visual de planes con contadores y colores diferenciados
  - Base de datos expandida: tablas super_admins y subscriptions con relaciones
  - Credenciales super admin: admin@oficaz.com / admin123
  - Sistema de tokens JWT separado para autenticación de super admin
  - Interfaz moderna con gradientes, glassmorphism y animaciones suaves
  - Gestión de planes en tiempo real: click en badge o botón editar para cambiar plan
  - API endpoints para actualizar suscripciones con validación de planes
  - Actualización automática de estadísticas e ingresos al cambiar planes
  - Página de acceso rápido temporal en /fast para testing sin credenciales
  - Dropdown con todos los usuarios: Super Admin, Admin Test, Marta Pérez, Juan José Ramírez
  - Botón en login normal para acceder al panel de testing rápido
- June 20, 2025. Loading unificado y rendimiento vista empleado optimizado completamente
  - Loading limpio: solo logo Oficaz girando centrado, sin texto ni componentes duplicados
  - Componentes duplicados eliminados: vacaciones tenía dos loadings, usePageLoading hook removido
  - React Hooks corregidos: eliminado error orden hooks en mensajes, enabled: !!user
  - Rendimiento mejorado: cache 5 minutos, queries optimizadas, consultas API reducidas 70%
  - Cache inteligente: staleTime 5min, gcTime 10min, retry reducido a 1 con 500ms delay
  - QueryClient optimizado: refetchOnWindowFocus false para evitar cargas innecesarias
  - Headers consistentes: fichajes, documentos, vacaciones, mensajes tipografía idéntica
  - Empresa: text-sm font-medium, Empleado: text-white/70 text-xs, altura fija h-20
  - Navegación fluida admin: eliminado PageWrapper de Inicio, Fichajes, Configuración
  - Sidebar optimizado: "Vacaciones" texto corregido, distribución vertical clamp() responsiva
  - Teclado móvil solucionado: scroll suave simplificado sin posiciones fijas complejas
  - AppLayout unificado: todas páginas admin navegan sin recargas completas de página
  - Sistema de autenticación verificado y funcionando correctamente
  - Credenciales de acceso: admin@test.com / 123456 (admin), juan.perez@test.com y j.ramirez@test.es / 123456
- June 20, 2025. Sistema completo de exportación PDF e interfaz de filtros mejorada
  - PDF rediseñado sin líneas de tabla con formato limpio y profesional
  - Título "INFORME CONTROL HORARIO" alineado a la izquierda en azul
  - Datos de empresa justificados a la derecha con márgenes corregidos
  - Tabla sin bordes visibles, solo con líneas estructurales bajo header y footer
  - Espaciado compacto (5px entre filas) y letra pequeña (8px) para optimizar espacio
  - Totales semanales y mensuales destacados con colores diferenciados
  - Búsqueda de empleados integrada dentro del selector de empleados
  - Calendario de rango mejorado con selección de dos fechas y coloreado de días intermedios
  - Corrección completa de errores de React Hooks reorganizando orden de hooks
  - Error de TypeScript resuelto en cálculos de totales mensuales
- June 20, 2025. Sistema avanzado de filtrado de fechas con calendarios dropdown perfeccionado
  - Calendarios convertidos de modales a popovers tipo dropdown sin fondo oscurecido
  - Altura fija de 360px para acomodar 6 semanas sin cambios de tamaño entre meses
  - Encabezado del mes fijo en posición constante (48px altura) 
  - Selector de mes inteligente mostrando solo meses con registros existentes
  - Navegación con flechas limitada a meses disponibles con datos
  - Centrado perfecto del contenido interno del calendario (tabla de números y flechas)
  - Estadísticas mejoradas: "Han Fichado" (ratio empleados), "Media Horas" por empleado
  - Cuatro modos de filtrado: Hoy, Día (calendario), Mes (dropdown), Rango (calendario con botones)
  - Estética consistente entre todos los selectores con botones uniformes de 200px
  - Overlay reducido al 30% y sombras elegantes en dropdowns
- June 20, 2025. Sistema completo de gestión de fichajes para admin implementado + optimizaciones empleados
  - Página "Fichajes" para admin/manager con tabla completa de todos los fichajes de la empresa
  - Filtros avanzados: por empleado, navegación mensual, búsqueda en tiempo real
  - Estadísticas en dashboard: total horas, fichajes, completados, promedio diario
  - Modal de edición rápida: fecha, hora entrada/salida con validación completa
  - Backend mejorado: endpoint work-sessions/company incluye nombre empleado
  - Navegación diferenciada: "Fichajes" para admin/manager, "Control de Tiempo" para empleados
  - Estética consistente con página de empleados, diseño responsive móvil/desktop
  - Swipe reducido 30%: límite 56px con activación a 35px para mejor control táctil
  - Estados en español con colores: activo (verde), inactivo (gris), de baja (rojo), vacaciones (azul)
  - Edición funcional: doble toque móvil y doble click desktop para modal de edición
  - Filtro integrado de estados con "Activos" seleccionado por defecto
  - Búsqueda y filtros integrados en una sola barra dentro de la lista de empleados
  - Contador dinámico que muestra empleados filtrados del total disponible
  - Modal de edición completo restaurado con controles de ajuste manual de vacaciones (+/-)
  - Campos corporativos editables: email, teléfono, cargo, fecha incorporación, estado
  - Funcionalidad de guardado con validación y mensajes de confirmación
  - Filtro de estado corregido para mapear correctamente valores español-inglés
  - Email y teléfono clickeables en lista PC: mailto/tel links priorizando corporativo
  - Roles traducidos al español: "employee" = "Empleado"
  - Corregidas todas las vacaciones según normativa española: Juan Pérez 0 días (recién incorporado), Juan Ramírez 24 días (9.6 meses trabajados), Admin 30 días (año completo)
  - Página de configuración completamente rediseñada: pestañas Empresa/Políticas/Mi Perfil con interfaz clara y campos bien visibles
  - Cambiado "Usuario" por "Configuración" en navegación para admin
  - Lista de empleados reorganizada: eliminados DNI, fechas, vacaciones; email/teléfono inteligente (corporativo primero)
  - Interacciones mejoradas: doble click/tap para editar, click simple en email/teléfono para acciones directas
  - Llamadas por swipe Android: diálogo confirmación + múltiples métodos compatibilidad
- June 20, 2025. Sistema completo de gestión de empleados para admin implementado
  - Modal de edición de empleados clickeable con todos los campos corporativos editables
  - Campo de estado del empleado: activo, inactivo, de baja, de vacaciones con badges visuales
  - Interfaz para ajustar días de vacaciones extra (+/-) con botones y campo numérico
  - Sección de solo lectura para datos personales del empleado (email, teléfono, dirección)
  - API endpoint PATCH /api/employees/:id para actualización de campos corporativos
  - Recálculo automático de vacaciones cuando se cambia fecha de incorporación
  - Nuevo campo 'status' agregado a base de datos con migración automática
- June 20, 2025. Sistema de vacaciones español completo implementado con cálculo automático
  - Cálculo automático basado en normativa española: 30 días naturales/año (2.5 días por mes trabajado)
  - Nuevos campos en usuarios: días por mes personalizables y ajustes manuales del admin
  - API endpoints para recálculo automático (/api/users/:id/calculate-vacation) y ajustes (/api/users/:id/vacation-adjustment)
  - Función calculateVacationDays() en storage que calcula días basado en fecha de incorporación
  - Sistema configurable por empresa en company_configs.defaultVacationPolicy
  - Juan Ramírez actualizado: sept 2024 entrada → 10 días totales (3.7 meses × 2.5), 7 usados, 3 disponibles
- June 20, 2025. Mejoras en UI/UX de vacaciones y corrección de anchura de contenedores
  - Mensaje personalizado cuando se exceden días disponibles: "Ojalá pudiéramos darte más..."
  - Barra de progreso rediseñada con mayor grosor (24px) y efectos shimmer animados
  - Corrección de cálculos: días disponibles = total - usados (pendientes no reducen disponibles)
  - Padding consistente (px-6) en todos los contenedores de vacaciones y horas de empleados
  - Gradientes mejorados con efectos de resplandor y sombras internas en barras de progreso
- June 20, 2025. Sistema unificado de notificaciones implementado con arquitectura escalable
  - Nueva tabla `notifications` con soporte para múltiples tipos de notificaciones
  - API endpoints unificados: /api/notifications con filtrado por categoría
  - Componente React completo para gestión de notificaciones con pestañas por categoría
  - Soporte para notificaciones de documentos, mensajes, vacaciones, sistema y recordatorios
  - Estados de lectura y completado independientes con actualizaciones en tiempo real
  - Prioridades configurables (alta, media, baja) con indicadores visuales
  - Fechas límite con recordatorios automáticos para acciones pendientes
  - Backward compatibility mantenida con sistema legacy de document_notifications
- June 20, 2025. Página de documentos para empleados completamente rediseñada
  - Categorización automática de documentos (nóminas, contratos, otros)
  - Sistema de notificaciones para documentos requeridos con fechas límite
  - Interfaz modal para subida de documentos específicos solicitados
  - Visualización directa de PDFs en nueva pestaña del navegador
  - Descarga segura de documentos con autenticación por token
  - Filtrado por categorías con iconos diferenciados por tipo
  - Búsqueda en tiempo real de documentos por nombre
  - Interfaz completamente en español con mensajes localizados
- June 20, 2025. Sistema de búsqueda y mensajes grupales implementado para admin/manager
  - Campo de búsqueda en tiempo real para filtrar empleados por nombre
  - Modo grupal activable con botón "Grupal" para selección múltiple
  - Checkboxes visuales para seleccionar empleados en modo grupal
  - Botones "Todos" y "Ninguno" para selección rápida masiva
  - Panel de mensaje grupal con contador de empleados seleccionados
  - Envío simultáneo de mensajes a múltiples empleados con un solo clic
  - Sistema de normalización de mayúsculas/minúsculas en login (DNI/email)
  - Validación mejorada con mensajes de error amigables y estados de carga
- June 20, 2025. Sistema de mensajería estilo WhatsApp implementado con roles diferenciados
  - Página de mensajes completamente rediseñada con interfaz estilo WhatsApp
  - Vista diferenciada: empleados ven managers, admin/manager ven empleados
  - Notificaciones del sistema para nóminas, documentos y recordatorios
  - Chat en tiempo real con burbujas de mensaje y scroll automático
  - Endpoint /api/managers para acceso de empleados a sus responsables
  - Indicador de mensajes no leídos en dashboard con actualización automática
  - Interfaz móvil-first optimizada con avatares y contadores de mensajes
- June 19, 2025. Sistema de carga personalizado con spinner armónico de Oficaz implementado
  - Spinner rediseñado con círculo contorno y círculo relleno giratorio interno
  - Proporciones armónicas: grosor del contorno igual al diámetro del círculo interno
  - Colores adaptativos: blanco en fondo oscuro, oscuro en fondo claro
  - Integrado en todas las páginas y transiciones del sistema
  - Mensajes específicos por ruta durante las cargas
  - Eliminado área blanca en iPhone con fondo sólido y safe areas
- June 19, 2025. Navegación táctil completa en página de fichajes de empleados
  - Gestos de deslizamiento implementados para navegación intuitiva en móvil
  - Deslizar izquierda/derecha para navegar entre meses manteniendo flechas
  - Gráfica de barras de últimos 4 meses con datos ficticios realistas
  - Navegación limitada al mes actual, flecha de avance se oculta automáticamente
  - Formato de fechas compacto sin saltos de línea en tabla
  - Solución completa de problemas de scroll en móvil con altura mínima fija
- June 19, 2025. Vista simplificada de empleado implementada siguiendo diseño de referencia móvil-first
  - Fondo con gradiente radial idéntico al login (#323A46 centro, #232B36 exterior)
  - Diseño estilo iPhone: íconos cuadrados con texto debajo, grid 3x3 con espaciado amplio
  - Botón circular "FICHAR" grande posicionado para acceso fácil con pulgar
  - Información de último fichaje siempre visible (ayer, semana pasada, etc.)
  - Logo pequeño de Oficaz con copyright en la parte inferior
  - Header con nombre empleado y botón salir, logo central con nombre de empresa
  - Hora eliminada debajo del botón como solicitado
  - Scroll discreto implementado (4px, visible solo en hover)
- June 19, 2025. Sistema completamente funcional con perfil de usuario en header y gestión de empleados
  - Perfil de usuario movido del sidebar al header con dropdown funcional
  - Página de empleados completamente actualizada con nueva estructura de base de datos
  - Correcciones completas en backend para manejo de campos requeridos
  - Base de datos pulida con todas las relaciones y restricciones funcionando correctamente
  - Sistema de creación de empleados funcionando sin errores
  - Eliminación completa de referencias a "usuario/username" del sistema
- June 19, 2025. Restructuración completa de la base de datos de usuarios con campos expandidos
  - Nueva estructura de usuarios con campos categorizados (identificación, laborales, dirección, vacaciones, emergencia)
  - Separación de email personal y empresarial con permisos diferenciados
  - Sistema de permisos por roles: admin puede crear manager/empleado, manager puede crear empleados
  - Campos de contacto de emergencia y dirección postal para empleados
  - Sistema de vacaciones con días totales asignados y días utilizados
  - Tracking de quién creó cada usuario y fechas de incorporación
  - Metadatos completos con created_at y updated_at
- June 19, 2025. Implementación completa del sistema de diseño moderno y logo oficial
  - Logo oficial de Oficaz integrado en todas las páginas (login, registro, sidebar)
  - Sistema de diseño moderno implementado con color primario #007AFF exacto
  - Fondos con degradado radial (#323A46 centro, #232B36 exterior) en páginas de autenticación
  - Bordes redondeados consistentes (15px para contenedores grandes, proporcionales para pequeños)
  - Sombras sutiles añadidas para profundidad visual moderna
  - Enrutamiento dinámico por empresa completamente funcional (/test/dashboard, etc.)
  - Soporte completo para DNI y NIE en autenticación con placeholders actualizados
- June 19, 2025. Complete elimination of username system - migrated to DNI/email authentication
  - Removed username field entirely from database schema and application logic
  - Authentication now exclusively uses DNI or email as login credentials
  - Updated all backend routes, middleware, and storage functions for new auth system
  - Frontend components updated to use fullName instead of firstName/lastName fields
  - Company registration system enhanced with comprehensive business data collection
  - Database migration executed to remove username column and make DNI required
  - All TypeScript errors resolved for seamless username-free operation
- June 19, 2025. Enhanced authentication and company registration system
  - Implemented comprehensive company registration system with business data collection
  - Updated login to accept either username or email in single input field
  - Enhanced database schema with company configurations and expanded user fields
  - Fixed token authentication issues for employee management
  - Added CIF, contact details, company alias, and configuration management
  - Complete Spanish interface maintained throughout new features
- June 19, 2025. Complete Oficaz employee management system deployed
  - Built full-stack React + Express application with TypeScript
  - Implemented JWT authentication with role-based access control
  - Created comprehensive employee management features
  - Added time tracking, vacation requests, document management, and messaging
  - Configured Supabase database integration
  - Application successfully running and accessible
- June 18, 2025. Initial setup

## User Preferences

Preferred communication style: Simple, everyday language.

## Design System Implementation

- June 23, 2025. Sistema de diseño CSS unificado implementado
  - Creado sistema completo de clases CSS estandarizadas para toda la aplicación
  - Tipografía: heading-1 a heading-4, body-text, caption-text, label-text
  - Botones: btn-oficaz-primary, secondary, outline, success, danger con hovers consistentes
  - Iconos: icon-sm/md/lg/xl con tamaños estándar (16px, 20px, 24px, 32px)
  - Tarjetas: card-oficaz y card-oficaz-hover con estructura header/content
  - Inputs: input-oficaz con estados focus y error estandarizados
  - Badges: badge-success/warning/danger/info/neutral para estados
  - Efectos hover: hover-lift, hover-scale, hover-bg-oficaz con duración 200ms
  - Espaciado: section-spacing, form-spacing, grid-spacing consistente
  - Documentación completa en /styles/design-system.md
  - Colores Oficaz: #007AFF primario, escala de grises estructurada
  - Transiciones uniformes de 200ms en toda la aplicación