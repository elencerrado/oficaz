# Oficaz - Employee Management System

## Overview
Oficaz is a comprehensive employee management system designed to streamline employee management for companies. It provides features such as time tracking, vacation management, document handling, messaging, and various administrative tools. The project aims to automate tedious tasks, boost productivity, and allow businesses to focus on their core operations through a modern, full-stack application.

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

### Break Period Management System (⚠️ CRITICAL LOGIC FIX)
- **Logical Rule**: When user clocks in, they cannot be in break by definition
- **Fixed Issue**: `getActiveBreakPeriod` now only returns breaks for current active session
- **Auto-cleanup**: Clock-in automatically closes orphaned break periods from previous sessions
- **Data Integrity**: Break periods must belong to current work session to be considered active
- **User Confirmed Bug**: "Ese fallo no debería ocurrir, es decir, si ficho la entrada, obviamente no estoy en un descanso"

### Email System Configuration (⚠️ CRITICAL - DO NOT MODIFY)
- **Logo URL**: MUST use static URL `'https://oficaz.es/email-logo.png'` - this is the ONLY solution that works
- **Never use dynamic domain detection for email logos** - it breaks the email display
- **SMTP Configuration**: nodemailer.createTransport() (NOT createTransporter)
- **User confirmed working**: "ya funciona el mail, guarda esta configuracion a muerte"

### Invoice System Configuration (⚠️ CRITICAL - DO NOT MODIFY)
- **Show All Invoice States**: System displays ALL invoice statuses (paid, open, draft, void, uncollectible) for complete billing history
- **No Status Filtering**: Removed `status: 'paid'` filter from Stripe API calls to ensure users always see their invoices
- **Immediate Visibility**: New invoices appear immediately, even in "open" status while Stripe processes payment
- **Status Mapping**: Comprehensive status display with proper colors and translations (Pendiente, Pagada, Borrador, etc.)
- **User issue resolved**: "porque no me aparece ninguna factura aqui? si se supone acabo de pagar?" - facturas now appear immediately after payment

### Stripe Production Mode Configuration (⚠️ CRITICAL - DO NOT MODIFY)
- **Production Mode Active**: System automatically detects and uses live Stripe keys when available
- **Intelligent Key Detection**: Uses STRIPE_SECRET_KEY for production, falls back to STRIPE_SECRET_KEY_TEST for development
- **Live Payment Processing**: All payments now process real money - no test mode
- **Key Type Validation**: Confirms sk_live_ prefix for production mode activation
- **Production Status**: System confirmed working with live Stripe integration
- **Custom Pricing Integration**: Both backend and frontend now support custom monthly pricing per company
- **Fixed Price Display**: Payment forms now show correct custom price (€0.50/month) instead of standard plan pricing (€39.95/month)

### Reminder System Standards (⚠️ CRITICAL - DO NOT MODIFY)
- **Color Palette**: 7 optimized harmonious colors for all reminders (#FFB3BA coral red, #FFE4B5 warm peach, #FFFFCC light yellow, #C8E6C9 soft green, #BBDEFB sky blue, #E1BEE7 lavender purple, #F8BBD9 rose pink)
- **Text Contrast**: All text uses gray-900/gray-800 for optimal readability on light backgrounds
- **Action Buttons**: Standardized "Marcar como hecho" button with icons and improved visibility
- **Demo Data**: Uses exact same color palette as user-selectable colors for perfect consistency
- **User confirmed**: "Los colores están mucho mejor" - colors are now vivid and clearly distinguishable

### Automatic Demo Data Generation (⚠️ CRITICAL SYSTEM)
- **Auto-generation on registration**: Every new company registration automatically generates comprehensive demo data.
- **Demo content includes**: 4 employees (3 working, 1 on vacation), work sessions, bidirectional messages, vacation requests, reminders with multiple assignments, and incomplete sessions.
- **Incomplete Sessions**: System generates 1-3 realistic incomplete sessions from previous days that exceed company working hours.
- **User requirement confirmed**: "Se tienen que crear bien cada vez que alguien registra su cuenta admin"

### Account Deletion Grace Period Protection (⚠️ BUSINESS LOGIC FIX)
- **Registration Conflict Prevention**: System now prevents registration with emails/CIFs from companies in 30-day grace period
- **Smart Error Messages**: Users attempting to register with conflicted data receive specific guidance to restore existing accounts instead
- **Data Integrity**: Prevents accidental data loss by guiding users to restore rather than recreate accounts
- **User education**: Clear messaging explains the restoration process vs new registration
- **Business rule**: "Una empresa borra su cuenta, se guarda 30 días. No puede hacer login pero si intenta registrarse con el mismo email, que ocurre?"

### Account Recovery Flow System (⚠️ CRITICAL RECOVERY MECHANISM)
- **Smart Detection**: When requesting verification code, system detects emails from accounts in 30-day grace period
- **Recovery Email Template**: Special email template for account recovery vs normal registration
- **Automatic Restoration**: Code verification automatically cancels deletion schedule and restores account
- **Data Preservation**: All company data, subscriptions, and configurations are maintained during recovery
- **User Flow**: Recovery bypasses registration wizard and redirects directly to login after successful restoration
- **Clear Messaging**: Users receive explicit notifications about recovery process and account status
- **User requirement**: "en la pagina de registro cuando solicita el codigo, si ya existe el mail, la cuenta se ha borrado y esta en ese peridodo de 30 dias. Se envia el codigo igualmente, pero en lugar del wizard de registro habra una ventana que acepte recuperar la cuenta en el mismo estado"

### Document Cleanup System (⚠️ CRITICAL SECURITY UPDATE)
- **Auto-cleanup**: System automatically detects and removes orphaned documents (DB records without physical files)
- **Security principle**: "Si los documentos no existen físicamente, no deberían aparecer para nadie"
- **Implementation**: Both user and admin document endpoints now filter and cleanup orphaned records
- **iPad/iOS Compatibility**: Special handling for iOS devices using direct links with token in query parameters
- **User requirement confirmed**: Documents without physical files must not appear in any list

### Logo Display Standards (⚠️ VISUAL CONSISTENCY)
- **Dark Mode Fix**: Oficaz logo uses `dark:brightness-0 dark:invert` for proper visibility in dark mode
- **Consistent Application**: Applied to sidebar, mobile header, and demo loading overlay
- **User issue resolved**: "El ícono loader de oficial en el modo oscuro a veces sale gris en el fondo oscuro"

### SuperAdmin Navigation System (⚠️ USER EXPERIENCE FIX)
- **Smart Back Navigation**: Implemented `window.history.back()` as primary navigation method
- **Fallback Routes**: Added appropriate fallbacks when history is empty (companies list, dashboard)
- **Consistent Behavior**: All SuperAdmin pages now use the same navigation pattern
- **User issue resolved**: "sigo teniendo problema en las paginas del superadmin al usar el boton atras dentro de ellas, a veces me saca al login del pueradmin"

### Test-to-Production Migration System (⚠️ STRIPE TRANSITION HANDLER)
- **Edge Case Detection**: Automatically detects hybrid subscription states (test Stripe subscription with production mode)
- **Data Cleanup Endpoint**: `/api/account/cleanup-test-stripe` safely removes test mode Stripe data
- **Visual Alert System**: PaymentMethodManager shows migration alert for affected companies
- **Automatic Resolution**: Cancels orphaned test subscriptions and resets to trial status for proper re-subscription
- **Oficaz SL Case**: Specific solution for test-to-production transition where test card was configured but now in production mode
- **User confirmed issue**: "se acabo del periodo de prueba y puse la tarjteta test de stripe y ahora estoy usandolo pero no tengo metodo de pago añadido"

### SuperAdmin Company Deletion Fix (⚠️ CRITICAL SECURITY FIX)
- **Foreign Key Constraint Error**: Fixed critical error in permanent company deletion where password_reset_tokens were not being deleted
- **Error Details**: "update or delete on table companies violates foreign key constraint password_reset_tokens_company_id_fkey"
- **Solution**: Added password reset tokens deletion step in correct order (step 8) before user deletion
- **Database Integrity**: Ensures all dependent records are properly cleaned up during SuperAdmin permanent deletions
- **Prevention**: Added comprehensive logging to track deletion progress and identify any future constraint violations

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **Styling**: Tailwind CSS with shadcn/ui
- **State Management**: TanStack Query (React Query)
- **Form Handling**: React Hook Form with Zod validation
- **Build Tool**: Vite
- **UI/UX Decisions**: Consistent header layouts (px-6 py-4, no custom containers), modern aesthetic (glassmorphism, shadows, rounded borders), responsive design, professional color scheme (Oficaz primary color #007AFF), animated elements, unified avatar system.

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: JWT-based with role-based access control (DNI/NIE or email login), bcrypt hashing.
- **File Uploads**: Multer with Sharp (image compression).
- **Session Management**: Express sessions with PostgreSQL store.
- **Security**: Helmet for CSP, CORS, rate limiting, HSTS, X-XSS-Protection, Referrer-Policy; SQL injection protection via parameterized queries.
- **Core Modules**: Authentication, Time Tracking, Vacation Management, Document Management, Messaging, Administrative Features, Subscription Management, Reminders.

### Database Design
- **ORM**: Drizzle with PostgreSQL dialect.
- **Schema**: Type-safe schema definitions.
- **Key Tables**: Companies, Users, Work Sessions, Vacation Requests, Documents, Messages, Subscriptions, Reminders, Notifications, Features.

### Deployment Strategy
- **Development Environment**: Node.js 20, PostgreSQL 16 (Replit managed), Vite dev server.
- **Production Build**: Vite for frontend, esbuild for backend.
- **Replit Configuration**: `nodejs-20`, `web`, `postgresql-16` modules.

### Key Features & Implementations
- **Dynamic Work Hours Configuration**: Replaced hardcoded 8-hour limits with company-specific settings via admin interface.
- **Incomplete Sessions Management**: `getActiveWorkSession` detects and allows closing of incomplete sessions from previous days.
- **Manager Role Permissions System**: Backend API supports manager role assignment. Managers have restricted access to admin features.
- **Navigation Performance Optimization**: Eliminated full page reloads during admin navigation.
- **Scroll Position Reset System**: `useScrollReset` hook automatically resets scroll position on route changes.
- **Performance Optimization - Time Tracking Page**: Database optimizations (batching queries, indexing), frontend caching (employees, company settings), reduced network overhead.
- **Mobile-Responsive Time Tracking Interface**: Dual-layout system (desktop table, mobile card views) with compact, intuitive design.
- **SuperAdmin Security System**: Exclusive access via email verification (`soy@oficaz.es`).
- **Performance Optimization System**: Implemented lazy loading, code splitting, async resource loading, critical CSS optimization, and resource hints to reduce LCP and improve TBT.
- **Error Monitoring System**: Integrated Sentry for error tracking and performance monitoring.
- **SEO Optimization System**: Direct file serving of `robots.txt` and `sitemap.xml` from client/public with explicit headers.
- **Account Deletion with 30-Day Grace Period System**: Comprehensive system for scheduling and canceling account deletion, with visual countdowns and SuperAdmin dashboard for monitoring.
- **Dark Mode System**: Full dark mode support for admin interface (Light, Dark, System options) with `localStorage` persistence, managed by React Context and Tailwind's `darkMode: ["class"]`. All UI elements adapt between light and dark themes with appropriate contrast ratios. Mobile support included.

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
- **Session Storage**: connect-pg-simple
- **Email Services**: Nodemailer
- **Payment Processing**: Stripe API
- **Avatar Generation**: UI Avatars API