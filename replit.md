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

- June 20, 2025. Base de datos restaurada y credenciales de acceso actualizadas
  - Contraseñas de usuarios restablecidas tras reversión de base de datos
  - Credenciales de acceso: admin@test.com / 123456 (admin)
  - Empleados de prueba: juan.perez@test.com y j.ramirez@test.es / 123456
  - Error de HTML anidado corregido en página de login (Link component)
  - Sistema de autenticación verificado y funcionando correctamente
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