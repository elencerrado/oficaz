# Oficaz - Employee Management System

## Overview
Oficaz is a comprehensive employee management system designed to streamline employee management for companies. It offers features like time tracking, vacation management, document handling, messaging, and administrative tools. The project aims to automate tasks, boost productivity, and allow businesses to focus on core operations through a modern, full-stack application. The vision is to deliver a robust and efficient solution for employee management, enhancing business efficiency and growth.

## User Preferences
Preferred communication style: Simple, everyday language.

### Design Standards
- **Header Layout**: Always use consistent header format across admin pages:
  - Simple header with mb-6 margin (NO white background container)
  - px-6 py-4 min-h-screen bg-gray-50 with overflowX: 'clip'
  - h1 with text-2xl font-semibold text-gray-900 (simple title)
  - p with text-gray-500 mt-1 (descriptive subtitle)
  - Follow exact time-tracking.tsx pattern for consistency
- **User expects consistency**: Header and margins must follow the same pattern as time-tracking and other admin pages
- **No custom containers**: Always follow the px-6 py-4 pattern, never use max-w-7xl containers with border-bottom

### Code Protection Standards
- **Critical Functions Must Be Protected**: User has experienced functionality regression issues
- **Protected Code Sections**: Use ⚠️ PROTECTED comments with "DO NOT MODIFY" warnings
- **Document Classification**: The analyzeFileName function is CRITICAL and must remain stable
- **Calendar Grid System**: Custom calendar grid layout (2.25rem fixed day columns, 1fr responsive connectors) is PROTECTED - critical for perfect worm effect alignment
- **User Requirement**: "Blindfold" (protect/secure) critical functionality to prevent breaking changes
- **Protection Pattern**: Wrap critical functions with warning comments and clear boundaries

### Security & Reliability Standards
- **🚨 ZERO ERROR TOLERANCE**: User has ABSOLUTE ZERO tolerance for error screens in production
  - **Global Error Suppression**: Inline script in `client/index.html` (first script, executes before everything) suppresses Vite HMR WebSocket errors and network errors during navigation. Prevents unhandled rejection popups.
  - **Auto-Reload ErrorBoundary**: `client/src/components/ErrorBoundary.tsx` automatically reloads page (up to 3 times within 1 minute) when React errors occur. Shows loading spinner during reload, never shows error screens.
  - **WebSocket Fix**: Time tracking WebSocket uses `window.location.host` (not `hostname:port`) to prevent `localhost:undefined` errors
  - **Vite HMR Errors**: Development-only WebSocket errors are suppressed globally in both `client/index.html` and `client/src/main.tsx`
  - **Network Errors**: Failed fetch, NetworkError, and Load failed errors are suppressed during page navigation/reload
  - **React Query**: Automatic retries with exponential backoff (2 retries, 500ms-2000ms delay)
  - **Result**: NEVER show error screens - only loading states and auto-recovery

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript, Wouter for routing.
- **Styling**: Tailwind CSS with shadcn/ui, full dark mode support.
- **State Management**: TanStack Query (React Query) for data fetching and caching.
- **Form Handling**: React Hook Form with Zod validation.
- **Error Handling**: Global ErrorBoundary for React errors and robust query resilience.
- **UI/UX Decisions**: Consistent header layouts, modern aesthetic (glassmorphism, shadows, rounded borders), responsive design, professional color scheme, animated elements, unified avatar system, and descriptive page titles.

### Backend Architecture
- **Runtime**: Node.js with Express.js (TypeScript, ES modules).
- **Database**: PostgreSQL with Drizzle ORM.
- **Authentication**: JWT-based with role-based access control, bcrypt hashing, silent auth error handling.
- **File Uploads**: Multer with Sharp for image compression, handling iOS device specifics.
- **Session Management**: Express sessions with PostgreSQL store.
- **Security**: Helmet for CSP, CORS, rate limiting, HSTS, X-XSS-Protection, Referrer-Policy; SQL injection protection. SuperAdmin access requires email verification.
- **Core Modules**: Authentication, Time Tracking (with audit trail), Vacation Management, Document Management, Messaging, Administrative Features, Subscription Management, Reminders, Email Marketing (SuperAdmin), PWA System, and AI Assistant.
- **Subscription Model**: Single "Oficaz" plan (39€/month) with modular add-ons and role-based user pricing.
  - **PÁGINAS BASE** (siempre disponibles, NO son add-ons): Panel de Control, Configuración, Empleados, Tienda
  - **Add-ons Gratuitos** (incluidos automáticamente): Fichajes, Vacaciones, Cuadrante
  - **Add-ons de Pago**: Mensajes (9€), Recordatorios (6€), Documentos (15€), Partes de Trabajo (12€), Asistente IA (25€)
  - **Usuarios adicionales**: Empleados +2€, Managers +6€, Admins +12€
- **AI Assistant System**: GPT-5 Nano assistant for admin/manager roles, providing administrative task automation with conversational context. Includes comprehensive work schedule management (create, delete, modify, copy, swap, bulk operations), smart reminder creation with natural language interpretation, employee data management, and time tracking report generation. Employs a "Consultar→Decidir→Actuar" methodology for error prevention and consistent timezone handling.
- **Object Storage**: Replit Object Storage for persistent file storage.
- **Account Management**: 30-day grace period for account deletion, immediate blocking of cancelled accounts.
- **Data Integrity**: Break periods associated with current work session; orphaned documents removed.
- **Email Marketing System (SuperAdmin)**: Campaign management, prospect database, user segmentation, SendGrid integration, HTML content, audience targeting, tracking, Zod validation, marketing consent, unsubscribe system, contact tracking. Uses static logo URL and relative image paths.
- **PWA System**: Full PWA implementation for locked-phone notifications with interactive action buttons via Web Push API. Server-side scheduler for alarms and incomplete session monitoring. Supports iOS PWA installation and provides instant push notifications for various events. Includes notification deduplication, alarm tags, and asynchronous, parallel batch sending.
- **Performance Optimizations**: Reduced re-renders, efficient calculations, generic hooks, reduced polling, optimized query caching, memoization, and timeout cleanup.

### Deployment Strategy
- **Development Environment**: Node.js 20, PostgreSQL 16 (Replit managed), Vite dev server.
- **Production Build**: Vite for frontend, esbuild for backend.
- **Replit Configuration**: `nodejs-20`, `web`, `postgresql-16` modules.

## External Dependencies

### Frontend Dependencies
- **UI Components**: Radix UI primitives with shadcn/ui
- **Data Fetching**: TanStack Query
- **Date Handling**: date-fns
- **Form Validation**: Zod
- **Styling**: Tailwind CSS

### Backend Dependencies
- **Database**: Neon PostgreSQL serverless database
- **ORM**: Drizzle ORM
- **Authentication**: JWT, bcrypt
- **File Handling**: Multer, Sharp
- **Object Storage**: @google-cloud/storage (Replit Object Storage)
- **Session Store**: connect-pg-simple
- **Email Services**: Nodemailer (SMTP Configuration)
- **Payment Processing**: Stripe API
- **Avatar Generation**: UI Avatars API
- **Push Notifications**: web-push