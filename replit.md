# Oficaz - Employee Management System

## Overview
Oficaz is a comprehensive employee management system providing time tracking, vacation management, document handling, messaging, and administrative features. Its vision is to streamline employee management for companies through a modern, full-stack application, automating tedious tasks to boost productivity and focus on core business.

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
- **User Requirement**: "Blindfold" (protect/secure) critical functionality to prevent breaking changes
- **Protection Pattern**: Wrap critical functions with warning comments and clear boundaries

### Email System Configuration (⚠️ CRITICAL - DO NOT MODIFY)
- **Logo URL**: MUST use static URL `'https://oficaz.es/email-logo.png'` - this is the ONLY solution that works
- **Never use dynamic domain detection for email logos** - it breaks the email display
- **SMTP Configuration**: nodemailer.createTransport() (NOT createTransporter)
- **User confirmed working**: "ya funciona el mail, guarda esta configuracion a muerte"

### Automatic Demo Data Generation (⚠️ CRITICAL SYSTEM)
- **Auto-generation on registration**: Every new company registration automatically generates comprehensive demo data.
- **Demo content includes**: 4 employees (3 working, 1 on vacation), work sessions, bidirectional messages, vacation requests, reminders with multiple assignments, and incomplete sessions.
- **Incomplete Sessions**: System generates 1-3 realistic incomplete sessions from previous days that exceed company working hours.
- **User requirement confirmed**: "Se tienen que crear bien cada vez que alguien registra su cuenta admin"

### Dynamic Work Hours Configuration
- **Problem Solved**: Replaced hardcoded 8-hour limits with dynamic company-specific work hour settings.
- **User Control**: Admins can modify work hours via Settings > Company > "Horas de trabajo por día" input field.

### Incomplete Sessions Management
- **Critical Bug Fixed**: Modified `getActiveWorkSession` to detect both active and incomplete sessions from any day.
- **Problem Solved**: Employees with incomplete sessions from previous days can now properly close them.
- **Business Rules**: Differentiated between active sessions (today) and incomplete sessions (previous days).
- **User Requirement**: "juan jose ramirez tiene un fichaje de ayer incompleto pero haciendo login con su cuenta en el dash de empleado veo que no ha cambiado el estado de los botones de fichar"

### Manager Role Permissions System
- **Role Assignment Fixed**: Backend API now allows updating user roles from employee to manager.
- **Manager Navigation Access**: Managers see all admin features including Fichajes, Empleados, and Configuración.
- **Company Settings Protection**: Only administrators can edit company information and policies.
- **Read-Only Configuration**: Managers can view but not modify company work hours and vacation policies.
- **Role Creation Restrictions**: Managers can only create employees with "employee" role, cannot assign manager/admin roles.
- **User Confirmation**: "un manager no puede editar la info de la empresa" and role restrictions successfully implemented.

### Navigation Performance Optimization
- **Problem Solved**: Eliminated page reloads during admin navigation between sections.
- **User Feedback**: "en la vista admin cuando voy cambiando las paginas con la barra menu lateral las primeras veces que entro en cada pagina se recarga la pagina entera"
- **Result**: Smooth navigation experience with maintained layout and instant page switching.

### Scroll Position Reset System
- **Problem Solved**: Automatic scroll reset when navigating between pages via sidebar menu.
- **User Feedback**: "si yo hago scroll en una pagina, fichajes vista admin por ejemplo, y en el menu lateral elijo otra pagina, me carga pero manteniendo el scroll de la pagina que estaba antes"
- **Implementation**: Created useScrollReset hook that monitors route changes and smoothly scrolls to top.
- **Coverage**: Applied to both admin/manager layouts and employee simplified layouts.
- **User Experience**: Clean navigation without inherited scroll positions from previous pages.

### Mobile-Responsive Time Tracking Interface
- **Problem Solved**: Eliminated horizontal scrolling in mobile time tracking view that made data difficult to access.
- **Solution Implemented**: Dual-layout system with desktop table and mobile card views.
- **Mobile Design Features**:
  - Card-based layout for each employee's daily session
  - Compact header with avatar, name, date, and total hours
  - Integrated timeline view with background styling
  - Full editing capabilities preserved in mobile-optimized forms
  - Summary cards for weekly/monthly totals
  - Maintains all functionality without horizontal scrolling
- **User Requirement**: "tenemos que hacer un diseño adaptado al movil, sin tener que hacer scrol horizontal, optimiza el espacio y hazlo intuitivo y atractivo"

### SuperAdmin Security System
- **Maximum Security Implementation**: Eliminated /fast page and replaced with email verification system.
- **Restricted Access**: Exclusive access limited to soy@oficaz.es email address only.
- **User Requirement**: "máxima seguridad superadmin acceso con verificación por email" - Successfully implemented.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **Styling**: Tailwind CSS with shadcn/ui component library
- **State Management**: TanStack Query (React Query) for server state
- **Form Handling**: React Hook Form with Zod validation
- **Build Tool**: Vite for fast development and optimized builds
- **UI/UX Decisions**:
    - Consistent header layouts (px-6 py-4, no custom containers).
    - Modern aesthetic with glassmorphism, subtle shadows, and rounded borders.
    - Responsive design for optimal viewing on mobile and desktop.
    - Professional color scheme using Oficaz primary color (#007AFF) and structured grayscale.
    - Animated elements for enhanced user engagement.
    - Unified avatar system with unique background colors or user-uploaded photos.

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: JWT-based authentication with role-based access control, supporting DNI/NIE or email login. Secure password hashing with bcrypt.
- **File Uploads**: Multer for handling document uploads with image compression (Sharp).
- **Session Management**: Express sessions with PostgreSQL store.
- **Security**: Helmet for CSP, CORS, rate limiting, HSTS, X-XSS-Protection, Referrer-Policy. SQL injection protection via parameterized queries.
- **Core Modules**:
    - **Authentication System**: JWT-based, role-based access, secure password hashing.
    - **Time Tracking Module**: Real-time clock in/out, automatic time calculation.
    - **Vacation Management**: Request submission, approval workflow, balance tracking.
    - **Document Management**: Upload, categorization, secure storage, intelligent file naming.
    - **Messaging System**: Internal company messaging, real-time updates.
    - **Administrative Features**: Employee management, company settings, user role management.
    - **Subscription Management**: Dynamic plan changes, prorated billing, integration with Stripe.
    - **Reminders System**: Google Keep-style reminders with notifications and advanced assignment system.

### Database Design
- **ORM**: Drizzle with PostgreSQL dialect
- **Schema**: Type-safe schema definitions shared between frontend and backend.
- **Key Tables**: Companies, Users, Work Sessions, Vacation Requests, Documents, Messages, Subscriptions, Reminders, Notifications, Features.

### Deployment Strategy
- **Development Environment**: Node.js 20, PostgreSQL 16 (Replit managed), Vite dev server.
- **Production Build**: Vite for frontend, esbuild for backend.
- **Replit Configuration**: `nodejs-20`, `web`, `postgresql-16` modules.

### Performance Optimization System
- **Problem Addressed**: Render-blocking requests causing 1200ms delays and long main thread tasks.
- **Lazy Loading Implementation**: All non-critical pages wrapped with React.lazy() and Suspense.
- **Code Splitting Strategy**: Critical pages load immediately, features load on-demand.
- **Async Resource Loading**: Stripe and Replit banner scripts load asynchronously.
- **Critical CSS Optimization**: Inline critical styles.
- **Resource Hints**: Added preconnect, dns-prefetch, and modulepreload.
- **Bundle Optimization**: Main App component lazy-loaded to reduce initial JavaScript execution time.
- **Performance Targets**: Reduced LCP, eliminated render-blocking requests, improved TBT scores.

### Error Monitoring System
- **Integration Completed**: Sentry error monitoring successfully integrated and tested.
- **Performance Monitoring**: Includes both error tracking and performance metrics collection.
- **Production Status**: Fully operational in production environment.

### SEO Optimization System
- **Problem Solved**: Direct file serving with explicit headers bypasses all framework interference.
- **Implementation**: robots.txt and sitemap.xml served from client/public directory.
- **Server Integration**: Express endpoints serve files directly with optimized production headers.
- **Content-Type Verification**: Confirmed working - robots.txt (text/plain), sitemap.xml (application/xml).

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
- **File Handling**: Multer, Sharp (for image processing)
- **Session Storage**: connect-pg-simple
- **Email Services**: Nodemailer (for verification emails)
- **Payment Processing**: Stripe API (for subscriptions, invoicing, and payment methods)
- **Avatar Generation**: UI Avatars API (external service for initial avatars)