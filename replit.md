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
- **Email template padding**: Use increased padding for mobile compatibility
- **SMTP Configuration**: nodemailer.createTransport() (NOT createTransporter)
- **User confirmed working**: "ya funciona el mail, guarda esta configuracion a muerte"

### Automatic Demo Data Generation (⚠️ CRITICAL SYSTEM)
- **Auto-generation on registration**: Every new company registration automatically generates comprehensive demo data
- **Demo content includes**: 4 employees (3 working, 1 on vacation), work sessions, bidirectional messages, vacation requests, reminders with multiple assignments, and incomplete sessions
- **Incomplete Sessions**: System generates 1-3 realistic incomplete sessions (employees who forgot to clock out) from previous days that exceed company working hours
- **Realistic data patterns**: Complete monthly work sessions, current day activity, varied reminder assignments, forgotten clock-outs
- **Duplicate prevention**: Fixed duplicate work sessions for same-day registrations with proper date verification
- **User requirement confirmed**: "Se tienen que crear bien cada vez que alguien registra su cuenta admin"
- **Implementation**: Integrated into company registration endpoint with error handling and duplicate detection
- **Updated**: August 10, 2025 - Added generateIncompleteSessions function for realistic incomplete session demonstration

### Dynamic Work Hours Configuration (✅ FIXED - AUGUST 10, 2025)
- **Problem Solved**: Replaced hardcoded 8-hour limits with dynamic company-specific work hour settings
- **Configuration Source**: Uses `workingHoursPerDay` field from company settings (configurable via Settings page)
- **Endpoint Integration**: Fetches data from `/api/settings/work-hours` endpoint with proper caching
- **Consistent Logic**: Both session status calculation and "Incompleto" display use the same dynamic value
- **User Control**: Admins can modify work hours via Settings > Company > "Horas de trabajo por día" input field
- **Default Fallback**: Falls back to 8 hours if configuration is not available

### SEO Optimization System (✅ PRODUCTION READY - VERIFIED WORKING)
- **Problem Solved**: Direct file serving with explicit headers bypasses all framework interference
- **Implementation**: robots.txt and sitemap.xml served from client/public directory
- **File Location**: robots.txt and sitemap.xml now stored in client/public for easier maintenance
- **Server Integration**: Express endpoints serve files directly with optimized production headers
- **Content-Type Verification**: Confirmed working - robots.txt (text/plain), sitemap.xml (application/xml)
- **Production Headers**: Includes Cache-Control, X-Content-Type-Options, CORS headers
- **Google PageSpeed Ready**: Content-types properly detected by crawlers and analysis tools
- **Updated**: August 5, 2025 - Moved SEO files to client/public and removed external SEO directories

### Performance Optimization System (🚀 PERFORMANCE ENHANCED)
- **Problem Addressed**: Render-blocking requests causing 1200ms delays and long main thread tasks
- **Lazy Loading Implementation**: All non-critical pages wrapped with React.lazy() and Suspense
- **Code Splitting Strategy**: Critical pages (Landing, Login, Legal) load immediately, features load on-demand
- **Async Resource Loading**: Stripe and Replit banner scripts load asynchronously to prevent blocking
- **Critical CSS Optimization**: Inline critical styles to prevent FOUC and layout shifts
- **Resource Hints**: Added preconnect, dns-prefetch, and modulepreload for faster resource loading
- **Bundle Optimization**: Main App component lazy-loaded to reduce initial JavaScript execution time
- **Loading States**: Consistent loading spinners across all lazy-loaded components
- **Performance Targets**: Reduced LCP, eliminated render-blocking requests, improved TBT scores
- **Implementation Date**: August 5, 2025 - Comprehensive performance optimization deployed

### Error Monitoring System (✅ SENTRY INTEGRATED - PRODUCTION READY)
- **Integration Completed**: Sentry error monitoring successfully integrated and tested
- **Manual Configuration**: Custom setup for Vite + React environment with proper DSN configuration
- **Error Capture Verified**: User confirmed error tracking is working correctly via test button
- **Performance Monitoring**: Includes both error tracking and performance metrics collection
- **Production Status**: Fully operational in production environment
- **Test Results**: Error capture functionality verified and test components removed
- **Implementation Date**: August 6, 2025 - Sentry integration completed and verified working


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
    - Animated elements for enhanced user engagement (e.g., loading spinners, chart animations, button effects).
    - Unified avatar system with unique background colors or user-uploaded photos.

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: JWT-based authentication with role-based access control, supporting DNI/NIE or email login. Secure password hashing with bcrypt.
- **File Uploads**: Multer for handling document uploads with image compression (Sharp).
- **Session Management**: Express sessions with PostgreSQL store.
- **Security**: Helmet for CSP, CORS, rate limiting (global and per-endpoint), HSTS, X-XSS-Protection, Referrer-Policy. SQL injection protection via parameterized queries.
- **Core Modules**:
    - **Authentication System**: JWT-based, role-based access (admin, manager, employee), secure password hashing, token refresh, protected routes.
    - **Time Tracking Module**: Real-time clock in/out, automatic time calculation, work session history, admin/manager views.
    - **Vacation Management**: Request submission, approval workflow, balance tracking, calendar integration.
    - **Document Management**: Upload, categorization, secure storage, download/deletion, intelligent file naming, document notifications.
    - **Messaging System**: Internal company messaging, real-time updates, role-based routing, message history.
    - **Administrative Features**: Employee management, company settings, user role management, system statistics, customizable features per company.
    - **Subscription Management**: Dynamic plan changes (upgrade/downgrade), prorated billing, integration with Stripe for invoicing and payments.
    - **Reminders System**: Google Keep-style reminders with notifications, prioritization, customizable colors, and advanced assignment system. Admins/managers can assign reminders to multiple employees with proper permission controls.

### Database Design
- **ORM**: Drizzle with PostgreSQL dialect
- **Schema**: Type-safe schema definitions shared between frontend and backend.
- **Key Tables**: Companies, Users, Work Sessions, Vacation Requests, Documents, Messages, Subscriptions, Reminders, Notifications, Features.
- **Relationships**: Foreign key constraints with referential integrity. User data includes detailed identification, labor, address, vacation, and emergency contact fields.

### Deployment Strategy
- **Development Environment**: Node.js 20, PostgreSQL 16 (Replit managed), Vite dev server.
- **Production Build**: Vite for frontend, esbuild for backend.
- **Replit Configuration**: `nodejs-20`, `web`, `postgresql-16` modules. Auto-scaling configured.

## External Dependencies

### Frontend Dependencies
- **UI Components**: Radix UI primitives with shadcn/ui
- **Data Fetching**: TanStack Query
- **Date Handling**: date-fns
- **Form Validation**: Zod
- **Styling**: Tailwind CSS
- **Testing**: Vitest (for component and utility testing)

### Backend Dependencies
- **Database**: Neon PostgreSQL serverless database
- **ORM**: Drizzle ORM
- **Authentication**: JWT, bcrypt
- **File Handling**: Multer, Sharp (for image processing)
- **Session Storage**: connect-pg-simple
- **Email Services**: Nodemailer (for verification emails)
- **Payment Processing**: Stripe API (for subscriptions, invoicing, and payment methods)
- **Avatar Generation**: UI Avatars API (external service for initial avatars)