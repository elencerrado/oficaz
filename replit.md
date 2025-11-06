# Oficaz - Employee Management System

## Overview
Oficaz is a comprehensive employee management system designed to streamline employee management for companies. It offers features like time tracking, vacation management, document handling, messaging, and administrative tools. The project aims to automate tasks, boost productivity, and allow businesses to focus on core operations through a modern, full-stack application.

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
- **🔒 SECURITY**: SMTP credentials stored in environment variables (SMTP_HOST, SMTP_USER, SMTP_PASS) - NEVER hardcode credentials in code
- **Outlook Compatibility**: Email marketing templates use HTML height attribute (height="40") with width:auto in CSS to maintain logo proportions in Outlook. Tracking pixel uses border="0" and display:block for maximum compatibility.
- **Tracking Domain**: Production emails use https://oficaz.es for tracking URLs (pixel and click tracking) for better deliverability and reliability.
- **Image URL Architecture**: Email marketing images use RELATIVE paths (e.g., `/public-objects/email-marketing/email-123.jpg`) stored in database/campaigns for cross-environment compatibility. Upload endpoint returns relative paths only. Frontend renders images using browser's native relative URL resolution. Email sending process converts relative paths to absolute URLs with production domain dynamically. Migration endpoint `POST /api/super-admin/email-marketing/fix-image-urls` available to normalize existing hardcoded URLs to relative paths. This architecture ensures images work correctly whether campaign is created/viewed in preview or production environment.

### Security Standards (Nov 2025)
- **Credential Management**: All sensitive credentials (SMTP, API keys) stored in Replit Secrets as environment variables
- **JWT Security**: Centralized JWT_SECRET management via `server/utils/jwt-secret.ts` - all modules use same secret for consistency
- **Password Hashing**: bcrypt with secure salt rounds for all password storage
- **Token Hygiene**: JWT tokens used exclusively via Authorization headers (30-day expiration, to be reduced)
- **Input Validation**: Zod schemas for all API endpoints to prevent malicious inputs
- **SQL Injection Protection**: Drizzle ORM with parameterized queries throughout
- **Rate Limiting**: Global and endpoint-specific rate limits to prevent abuse
- **Error Handling**: Errors logged but never expose sensitive data or stack traces to clients
- **Security Headers**: Helmet configuration with HTTPS enforcement, HSTS, X-Content-Type-Options, X-Frame-Options
- **Company Isolation**: All data queries filtered by companyId to prevent cross-company data access

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **Styling**: Tailwind CSS with shadcn/ui
- **State Management**: TanStack Query (React Query)
- **Form Handling**: React Hook Form with Zod validation
- **UI/UX Decisions**: Consistent header layouts (px-6 py-4, no custom containers), modern aesthetic (glassmorphism, shadows, rounded borders), responsive design, professional color scheme, animated elements, unified avatar system. Full dark mode support with `localStorage` persistence. Logo uses `dark:brightness-0 dark:invert` for dark mode compatibility.

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: JWT-based with role-based access control, bcrypt hashing. Silent auth error handling.
- **File Uploads**: Multer with Sharp (image compression), with specific handling for iOS devices.
- **Session Management**: Express sessions with PostgreSQL store.
- **Security**: Helmet for CSP, CORS, rate limiting, HSTS, X-XSS-Protection, Referrer-Policy; SQL injection protection. SuperAdmin access via email verification with enhanced security.
- **Core Modules**: Authentication, Time Tracking, Vacation Management, Document Management, Messaging, Administrative Features, Subscription Management, Reminders, Email Marketing (SuperAdmin), Time Tracking Modification & Audit System, PWA System.
- **Object Storage**: Replit Object Storage integration for persistent file storage.
- **Account Management**: 30-day grace period for account deletion, immediate blocking of cancelled accounts.
- **Data Integrity**: Break periods belong to current work session. Orphaned documents are removed.
- **Email Marketing System** (SuperAdmin): Campaign management, prospect database, user segmentation, SendGrid integration, HTML content, audience targeting, tracking, Zod validation, marketing consent, unsubscribe system, contact tracking system (WhatsApp/Instagram).
- **Time Tracking Modification & Audit System** (Legal Compliance RD-ley 8/2019): Complete audit trail for all time tracking modifications. Features include manual work session creation, modification of existing work sessions, full audit history, employee-initiated modification requests, partial modifications (clock-in OR clock-out), audit log (workSessionAuditLog table), modification requests (workSessionModificationRequests table), work session fields (`isManuallyCreated`, `lastModifiedBy`, `lastModifiedAt`), real-time pending requests count, responsive UI, PDF export with complete audit trail including before/after times and reasons. All modifications require mandatory reasons. `requested_date` column is TIMESTAMP.
- **PWA System**: Complete PWA implementation for locked-phone notifications with interactive action buttons via Web Push API. Server-side scheduler for work alarms and daily incomplete session monitoring, dynamic action buttons, and service worker handling button clicks. Supports iOS PWA installation. Daily check at 9 AM (Spain time) for incomplete work sessions. Instant push notifications for vacation approvals/denials, new payroll/general documents, new messages, and reminders. Notification actions use JWT authentication with short-lived tokens. Push subscriptions are removed on logout. Notification deduplication and alarm tags prevent duplicates. Asynchronous, parallel batch sending of notifications. SuperAdmin can enable/disable push notifications per subscription plan.
- **Performance Optimizations** (Nov 2025): Server-side filtering for work sessions endpoint, WebSocket real-time updates for work session changes (`/ws/work-sessions`), lazy loading of audit logs.

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
- **Email Services**: Nodemailer
- **Payment Processing**: Stripe API
- **Avatar Generation**: UI Avatars API
- **Push Notifications**: web-push