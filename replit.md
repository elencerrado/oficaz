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
- **Manager Role Permissions System**: Backend API supports manager role assignment. Managers have restricted access to admin features (view-only settings, cannot assign admin/manager roles).
- **Navigation Performance Optimization**: Eliminated full page reloads during admin navigation for a smoother experience.
- **Scroll Position Reset System**: `useScrollReset` hook automatically resets scroll position on route changes for improved UX.
- **Performance Optimization - Time Tracking Page**: Database optimizations (batching queries, indexing), frontend caching (employees, company settings), reduced network overhead.
- **Mobile-Responsive Time Tracking Interface**: Dual-layout system (desktop table, mobile card views) with compact, intuitive design and full functionality.
- **SuperAdmin Security System**: Exclusive access via email verification (`soy@oficaz.es`) replacing `/fast` page.
- **Performance Optimization System**: Implemented lazy loading (`React.lazy()`, `Suspense`), code splitting, async resource loading, critical CSS optimization, and resource hints to reduce LCP and improve TBT.
- **Error Monitoring System**: Integrated Sentry for error tracking and performance monitoring in production.
- **SEO Optimization System**: Direct file serving of `robots.txt` and `sitemap.xml` from client/public with explicit headers.
- **Account Deletion with 30-Day Grace Period System**: Comprehensive system for scheduling and canceling account deletion, with visual countdowns and SuperAdmin dashboard for monitoring.
- **Dark Mode System**: Full dark mode support for admin interface (Light, Dark, System options) with `localStorage` persistence, managed by React Context and Tailwind's `darkMode: ["class"]`. Complete implementation covers all major components: admin dashboard, time tracking (including desktop table and mobile cards), vacation management (both pages with holiday cards), settings, and navigation components using semantic CSS variables for consistent theme adaptation. All UI elements properly adapt between light and dark themes with appropriate contrast ratios.

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