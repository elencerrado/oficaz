# Oficaz - Employee Management System

## Overview
Oficaz is a comprehensive employee management system designed to streamline employee management for companies. It provides features such as time tracking, vacation management, document handling, messaging, and various administrative tools. The project aims to automate tedious tasks, boost productivity, and allow businesses to focus on their core operations through a modern, full-stack application, ready for official publication.

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

### Email System Configuration
- **Logo URL**: MUST use static URL `'https://oficaz.es/email-logo-white.png'` - this is the ONLY solution that works
- **Never use dynamic domain detection for email logos** - it breaks the email display
- **SMTP Configuration**: nodemailer.createTransport() (NOT createTransporter)
- **Outlook Compatibility**: Email marketing templates use HTML height attribute (height="40") with width:auto in CSS to maintain logo proportions in Outlook. Tracking pixel uses border="0" and display:block for maximum compatibility.
- **Tracking Domain**: Production emails use https://oficaz.es for tracking URLs (pixel and click tracking) for better deliverability and reliability.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **Styling**: Tailwind CSS with shadcn/ui
- **State Management**: TanStack Query (React Query)
- **Form Handling**: React Hook Form with Zod validation
- **Build Tool**: Vite
- **UI/UX Decisions**: Consistent header layouts (px-6 py-4, no custom containers), modern aesthetic (glassmorphism, shadows, rounded borders), responsive design, professional color scheme (Oficaz primary color #007AFF), animated elements, unified avatar system. Full dark mode support with `localStorage` persistence. Logo uses `dark:brightness-0 dark:invert` for dark mode compatibility.

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: JWT-based with role-based access control (DNI/NIE or email login), bcrypt hashing.
- **File Uploads**: Multer with Sharp (image compression), with specific handling for iOS devices.
- **Session Management**: Express sessions with PostgreSQL store.
- **Security**: Helmet for CSP, CORS, rate limiting, HSTS, X-XSS-Protection, Referrer-Policy; SQL injection protection via parameterized queries. SuperAdmin access is exclusive via email verification (`soy@oficaz.es`).
- **SuperAdmin Security**: JWT tokens expire in 2 hours (not 24h); tokens stored in `sessionStorage` (auto-logout on browser close); automatic token expiration check with redirect to login; no token persistence across browser sessions. **Enterprise-grade audit logging**: All SuperAdmin actions persisted to PostgreSQL `audit_logs` table with timestamp, IP, action, email, success status, and details. Rate limiting (3 attempts access password, 5 attempts login per 15 min). Email notifications on successful login. Comprehensive security headers (X-Frame-Options: DENY, strict CSP, Referrer-Policy, Permissions-Policy) applied to all SuperAdmin endpoints. Audit logs accessible via GET `/api/super-admin/audit-logs` with pagination.
- **Core Modules**: Authentication, Time Tracking, Vacation Management, Document Management, Messaging, Administrative Features, Subscription Management, Reminders, Email Marketing (SuperAdmin).
- **Account Management**: Includes a 30-day grace period for account deletion with a recovery process that bypasses the registration wizard. Cancelled accounts are immediately blocked.
- **Data Integrity**: Break periods must belong to the current work session. Orphaned documents (DB records without physical files) are automatically removed.
- **Email Marketing System** (SuperAdmin): Complete email marketing module with campaign management, prospect database, and user segmentation by subscription status (active, trial, blocked, cancelled). Includes SendGrid integration structure for transactional/marketing emails. Campaign creation with HTML content, audience targeting, and tracking infrastructure (sends, opens, clicks). Zod validation on backend endpoints ensures data integrity. **Marketing Consent & Audience Types**: Registration wizard includes optional marketing consent checkbox (step 4); campaigns support two audience types: "subscribers" (opted-in users, includes unsubscribe footer) and "one-time campaigns" (prospecting, copyright-only footer); conditional email footer generation based on audienceType; complete conversion tracking from email to paid subscription. **Unsubscribe System**: Public endpoint `/api/email/unsubscribe?email=XXX` updates `marketingEmailsConsent` to false; renders HTML confirmation page; users automatically filtered from "subscribers" campaigns; link included in email footer with `{{{recipient_email}}}` placeholder.

### Database Design
- **ORM**: Drizzle with PostgreSQL dialect.
- **Schema**: Type-safe schema definitions.
- **Key Tables**: Companies, Users, Work Sessions, Vacation Requests, Documents, Messages, Subscriptions, Reminders, Notifications, Features, Email Campaigns, Email Prospects, Email Campaign Sends, **Audit Logs** (SuperAdmin security tracking with indexed columns for timestamp, action, email).

### Performance & Scalability
- **High Concurrency Support**: Optimized for 1000+ simultaneous clock-ins during peak hours
- **Connection Pool**: Configured with max 20 connections, min 2, 30s idle timeout, 3s connection timeout
- **Database Indexes**: Performance indexes on work_sessions (user_id+status, clock_in, user_id+clock_in) and break_periods (user_id+status, work_session_id)
- **Retry Logic**: Database operations use exponential backoff retry (3 attempts, 50ms-200ms delays) for timeout resilience
- **Query Optimization**: Clock-in endpoint uses 3 optimized indexed queries for maximum performance
- **Scalability Considerations**: Current architecture handles 500-1000 simultaneous users; further scaling requires Neon Scale plan (~200 connections) and appropriate Replit plan
- **Automatic Session Cleanup**: Sessions exceeding maxWorkingHoursPerDay + 4 hours margin are automatically marked as 'incomplete' during next clock-in attempt, preventing blocking issues

### Deployment Strategy
- **Development Environment**: Node.js 20, PostgreSQL 16 (Replit managed), Vite dev server.
- **Production Build**: Vite for frontend, esbuild for backend.
- **Replit Configuration**: `nodejs-20`, `web`, `postgresql-16` modules.

### Key Features & Implementations
- **Dynamic Work Hours Configuration**: Replaced hardcoded 8-hour limits with company-specific settings.
- **Incomplete Sessions Management**: Sessions exceeding maxWorkingHoursPerDay + 4 hours margin are automatically marked as 'incomplete' by backend during clock-in; frontend displays status based on database value, not calculations; `getActiveWorkSession` excludes 'incomplete' sessions to allow new clock-ins; orphaned break periods are automatically closed.
- **Manager Role Permissions System**: Backend API supports manager role assignment with restricted access.
- **Navigation Performance Optimization**: Eliminated full page reloads and implemented `useScrollReset` hook; SuperAdmin uses `window.history.back()`.
- **Performance Optimization**: Database optimizations, frontend caching, reduced network overhead, lazy loading, code splitting, async resource loading, critical CSS, resource hints.
- **Mobile-Responsive Interfaces**: Dual-layout system for time tracking (desktop table, mobile card views).
- **Error Monitoring**: Integrated Sentry.
- **SEO Optimization**: Direct file serving of `robots.txt` and `sitemap.xml`.
- **Reminder System**: Uses 7 harmonious colors with optimal text contrast. Supports three-state individual completion logic, requiring all assigned users to complete.
- **Invoice System**: Displays all Stripe invoice statuses (paid, open, draft, void, uncollectible) without filtering.
- **Automatic Demo Data Generation**: Comprehensive demo data is generated for new company registrations, including incomplete sessions.
- **Test-to-Production Migration**: System detects and resolves hybrid Stripe subscription states, with an alert system and data cleanup endpoint.
- **Registration Wizard**: Plan recommendation algorithm adjusted to be more conservative, prioritizing Basic plan for smaller teams. Master plan temporarily hidden.

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