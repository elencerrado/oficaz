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
- **Calendar Grid System**: Custom calendar grid layout (2.25rem fixed day columns, 1fr responsive connectors) is PROTECTED - critical for perfect worm effect alignment
- **User Requirement**: "Blindfold" (protect/secure) critical functionality to prevent breaking changes
- **Protection Pattern**: Wrap critical functions with warning comments and clear boundaries

### Email System Configuration
- **Logo URL**: MUST use static URL `'https://oficaz.es/email-logo-white.png'` - this is the ONLY solution that works
- **Never use dynamic domain detection for email logos** - it breaks the email display
- **SMTP Configuration**: nodemailer.createTransport() (NOT createTransporter)
- **Outlook Compatibility**: Email marketing templates use HTML height attribute (height="40") with width:auto in CSS to maintain logo proportions in Outlook. Tracking pixel uses border="0" and display:block for maximum compatibility.
- **Tracking Domain**: Production emails use https://oficaz.es for tracking URLs (pixel and click tracking) for better deliverability and reliability.
- **Image URL Architecture**: Email marketing images use RELATIVE paths (e.g., `/public-objects/email-marketing/email-123.jpg`) stored in database/campaigns for cross-environment compatibility. Upload endpoint returns relative paths only. Frontend renders images using browser's native relative URL resolution. Email sending process converts relative paths to absolute URLs with production domain dynamically. Migration endpoint `POST /api/super-admin/email-marketing/fix-image-urls` available to normalize existing hardcoded URLs to relative paths. This architecture ensures images work correctly whether campaign is created/viewed in preview or production environment.

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
- **Authentication**: JWT-based with role-based access control, bcrypt hashing. Silent auth error handling prevents user-facing errors from transient network issues.
- **File Uploads**: Multer with Sharp (image compression), with specific handling for iOS devices.
- **Session Management**: Express sessions with PostgreSQL store.
- **Security**: Helmet for CSP, CORS, rate limiting, HSTS, X-XSS-Protection, Referrer-Policy; SQL injection protection. SuperAdmin access is exclusive via email verification with enhanced security (short-lived tokens in `sessionStorage`, automatic logout, enterprise-grade audit logging, rate limiting, comprehensive security headers).
- **Core Modules**: Authentication, Time Tracking, Vacation Management, Document Management, Messaging, Administrative Features, Subscription Management, Reminders, Email Marketing (SuperAdmin), Time Tracking Modification & Audit System (Legal Compliance RD-ley 8/2019).
- **Object Storage**: Replit Object Storage integration for persistent file storage of email marketing images, served via `/public-objects/:filePath(*)`.
- **Account Management**: 30-day grace period for account deletion with recovery, immediate blocking of cancelled accounts.
- **Data Integrity**: Break periods belong to current work session. Orphaned documents are removed.
- **Email Marketing System** (SuperAdmin): Campaign management, prospect database, user segmentation by subscription status. Includes SendGrid integration structure, HTML content, audience targeting, and tracking (sends, opens, clicks). Zod validation ensures data integrity. Marketing Consent & Audience Types (subscribers vs. one-time campaigns) with conditional email footer generation. Unsubscribe system with public endpoint and user filtering. Contact Tracking System for WhatsApp/Instagram outreach with separate conversation status tracking per channel (whatsappConversationStatus, instagramConversationStatus) allowing independent status management for each communication platform.
- **Time Tracking Modification & Audit System** (Legal Compliance RD-ley 8/2019): Complete audit trail for ALL time tracking modifications as required by Spanish law. Available to ALL subscription plans (not premium-only) due to legal requirements. Admin features: (1) Create manual work sessions for forgotten check-ins, (2) Modify existing work session times (clock-in/clock-out), (3) View complete audit history with old/new values and reasons. Employee features: (1) Request time modifications via floating action button in employee time tracking page, (2) Submit forgotten check-ins or time corrections with required reason, (3) **Partial modifications**: Employees can request changes to ONLY clock-in OR ONLY clock-out - the system preserves the original value for the unmodified field. System features: (1) Complete audit log (workSessionAuditLog table) recording who modified, when, what changed, and why with granular modification types (modified_clockin, modified_clockout, modified_both), (2) Modification requests (workSessionModificationRequests table) for employee-initiated changes requiring admin approval with NULL support for optional fields, (3) Work sessions track isManuallyCreated, lastModifiedBy, lastModifiedAt fields, (4) Real-time pending requests count with animated badge and bell icon, (5) Responsive UI with dialogs for all modification operations. All modifications require mandatory reason field for legal compliance audit trail. **Database alignment**: requested_date column migrated from DATE to TIMESTAMP for proper date handling.
- **PWA System**: Complete PWA implementation for locked-phone notifications with interactive action buttons via Web Push API. Server-side scheduler for work alarms and daily incomplete session monitoring, dynamic action buttons based on employee status (clock in/out, start/end break), and service worker handling button clicks. Supports iOS PWA installation for locked-screen notifications. Daily check at 9 AM (Spain time) sends push notifications to employees with incomplete work sessions. **⚠️ CRITICAL TIMEZONE**: ALL push notification time comparisons use Europe/Madrid timezone (getSpainTime() utility) - server runs in UTC but all scheduling logic converts to Spain time before comparison to ensure notifications trigger at correct local times (work alarms, 9 AM incomplete session checks, reminder due dates). **Vacation notifications**: Instant push notifications when vacation requests are approved or denied, displaying date range and admin comments. **Document notifications**: Instant push notifications when: (1) new payroll document pending signature is uploaded, (2) any new document is uploaded to employee, (3) admin requests employee to upload a document. **Message notifications**: Instant push notifications when employee receives a new message (individual or company-wide broadcast). **Reminder notifications**: Push notifications when: (1) admin/manager shares reminder with employee, (2) reminder due date arrives for reminders with notifications enabled. Security: Notification actions use JWT authentication with short-lived temporary tokens (5-min expiration for work actions, 24h for incomplete sessions) embedded in notification data. Push subscriptions are automatically removed from server and service worker on logout to prevent unauthorized access. Notification deduplication ensures one notification per unique device. Alarm notifications use unique tags (alarm-{alarmId}-{minute}) to prevent duplicates on devices with multiple service workers (iOS Safari). **Performance optimization**: All push notification sends are asynchronous (fire-and-forget) to prevent blocking HTTP endpoints, with parallel batch sending for multiple recipients (e.g., company-wide messages). **SuperAdmin Control**: Push notification system can be enabled/disabled per subscription plan via "Notificaciones Push" feature in super-admin-plans panel.

### Database Design
- **ORM**: Drizzle with PostgreSQL dialect.
- **Schema**: Type-safe schema definitions.
- **Key Tables**: Companies, Users, Work Sessions, Work Session Audit Log, Work Session Modification Requests, Vacation Requests, Documents, Messages, Subscriptions, Reminders, Notifications, Features, Email Campaigns, Email Prospects, Email Campaign Sends.

### Performance & Scalability
- **High Concurrency Support**: Optimized for 1000+ simultaneous clock-ins.
- **Connection Pool**: Configured with max 20 connections, min 2, 30s idle timeout, 3s connection timeout.
- **Database Indexes**: Performance indexes on `work_sessions` and `break_periods`.
- **Retry Logic**: Exponential backoff retry for database operations (3 attempts, 50ms-200ms delays).
- **Query Optimization**: Clock-in endpoint uses 3 optimized indexed queries.
- **Scalability Considerations**: Current architecture handles 500-1000 simultaneous users; further scaling requires Neon Scale plan and appropriate Replit plan.
- **Automatic Session Cleanup**: Sessions exceeding `maxWorkingHoursPerDay + 4` hours margin are automatically marked as 'incomplete' during next clock-in attempt.
- **Push Notification Scalability**: Asynchronous delivery prevents endpoint blocking (<10K users: current async architecture, 10K-100K users: add message queue like Bull/BullMQ + batching, 100K-1M users: add Redis cache + horizontal scaling + DB indexes, 1M+ users: microservices architecture). All notifications use Promise.allSettled for parallel sending and fire-and-forget pattern to ensure instant API responses.

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