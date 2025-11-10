# Oficaz - Employee Management System

## Overview
Oficaz is a comprehensive employee management system designed to streamline employee management for companies. It offers features like time tracking, vacation management, document handling, messaging, and administrative tools. The project aims to automate tasks, boost productivity, and allow businesses to focus on core operations through a modern, full-stack application with a vision to deliver a robust and efficient solution for employee management.

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
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **Styling**: Tailwind CSS with shadcn/ui
- **State Management**: TanStack Query (React Query)
- **Form Handling**: React Hook Form with Zod validation
- **Error Handling**: Global ErrorBoundary (`client/src/components/ErrorBoundary.tsx`) captures all React errors.
- **Query Resilience**: React Query with automatic retries, stale data handling, and automatic refetching.
- **UI/UX Decisions**: Consistent header layouts (px-6 py-4), modern aesthetic (glassmorphism, shadows, rounded borders), responsive design, professional color scheme, animated elements, unified avatar system. Full dark mode support with `localStorage` persistence. Logo uses `dark:brightness-0 dark:invert` for dark mode compatibility.
- **Page Titles**: All pages use `usePageTitle` hook for descriptive browser tab titles.

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: JWT-based with role-based access control, bcrypt hashing, silent auth error handling.
- **File Uploads**: Multer with Sharp (image compression), with specific handling for iOS devices.
- **Session Management**: Express sessions with PostgreSQL store.
- **Security**: Helmet for CSP, CORS, rate limiting, HSTS, X-XSS-Protection, Referrer-Policy; SQL injection protection. SuperAdmin access via email verification with enhanced security.
- **Core Modules**: Authentication, Time Tracking, Vacation Management, Document Management, Messaging, Administrative Features, Subscription Management, Reminders, Email Marketing (SuperAdmin), Time Tracking Modification & Audit System, PWA System, AI Assistant.
- **AI Assistant System** (Pro/Master plans, Admin/Manager only): GPT-5 Nano assistant for administrative task automation with conversational context persistence (localStorage, 2-day auto-cleanup). **🔒 SECURITY: Only visible to admin and manager roles** - employees NEVER see the AI assistant, even on master plan. Frontend checks role via `userSummary.role`, backend enforces `requireRole(['admin', 'manager'])`. Includes COMPLETE work schedule ("cuadrante") management capabilities with ZERO loose ends - supports ALL operations (create, delete, modify, copy, swap) for BOTH individual shifts AND bulk operations (days, weeks, months, custom ranges). All schedule modifications validate input and handle overnight/cross-midnight shifts correctly.
  - **UTC Helper (Nov 2025)**: Shared `getUTCDayBoundaries()` helper function ensures consistent timezone handling across all date-based AI operations. Prevents off-by-one timezone bugs when filtering shifts by date.
  - **Chat UI (Nov 2025)**: Auto-scroll to bottom when chat opens or receives new messages for better UX.
  - **Auto-color System (Nov 2025)**: Each employee gets unique color based on ID % 8 to visually distinguish schedules. 8 colors rotate: blue, green, amber, purple, red, cyan, orange, pink.
  - **Real-time UI Sync (Nov 2025)**: All AI shift modification functions trigger immediate React Query cache invalidation for instant frontend updates without page reload.
  - **Bulk Operations (Nov 2025)**: COMPLETE support for range-based operations across flexible time periods:
    - **Create**: `assignSchedule` (single shift), `assignScheduleInRange` (bulk create for weeks/months, auto-skips weekends)
    - **Delete**: `deleteWorkShift` (single date), `deleteWorkShiftsInRange` (bulk delete by range, supports employee filtering)
    - **Modify**: `updateWorkShiftTimes` (single shift), `updateWorkShiftsInRange` (bulk modify times for entire ranges)
    - **Copy/Swap**: `copyEmployeeShifts` (duplicate shifts to another employee), `swapEmployeeShifts` (exchange shifts between employees)
    - **Color Management**: `updateWorkShiftColor` (single shift), `updateEmployeeShiftsColor` (bulk color change)
    - **Details**: `updateWorkShiftDetails` (title, location, notes for single shift)
  - **Advanced Shift Management (Nov 2025)**: AI can swap all shifts between two employees atomically (useful for schedule exchanges) or copy shifts from one employee to another (useful for replication). Both operations support optional date range filtering and handle employee name resolution automatically.
  - **Intelligence Architecture (Nov 2025)**: AI follows "Consultar→Decidir→Actuar" (Query→Decide→Act) methodology to prevent errors. CRITICAL upgrade with 3 read-only query functions (listEmployees, getEmployeeShifts, getCompanyContext) that AI MUST use before executing mutations. System prompt enforces context awareness: AI must verify data exists before acting (no guessing shift titles/employee names), detect ambiguity vs continuation in conversation flow, and ask specific questions only when truly ambiguous. Prevents context bugs like creating new shifts when user meant to modify existing ones.
- **Object Storage**: Replit Object Storage integration for persistent file storage.
- **Account Management**: 30-day grace period for account deletion, immediate blocking of cancelled accounts.
- **Data Integrity**: Break periods belong to current work session. Orphaned documents are removed.
- **Email Marketing System** (SuperAdmin): Campaign management, prospect database, user segmentation, SendGrid integration, HTML content, audience targeting, tracking, Zod validation, marketing consent, unsubscribe system, contact tracking system.
  - **Logo URL**: MUST use static URL `'https://oficaz.es/email-logo-white.png'`. Never use dynamic domain detection.
  - **Image URL Architecture**: Email marketing images use RELATIVE paths (e.g., `/public-objects/email-marketing/email-123.jpg`) stored in database/campaigns for cross-environment compatibility. Upload endpoint returns relative paths only. Frontend renders images using browser's native relative URL resolution. Email sending process converts relative paths to absolute URLs with production domain dynamically. Migration endpoint `POST /api/super-admin/email-marketing/fix-image-urls` available to normalize existing hardcoded URLs to relative paths.
- **Time Tracking Modification & Audit System**: Complete audit trail for all time tracking modifications, including employee-initiated modification requests, partial modifications, and PDF export with full audit trail.
- **PWA System**: Complete PWA implementation for locked-phone notifications with interactive action buttons via Web Push API. Server-side scheduler for work alarms and daily incomplete session monitoring. Supports iOS PWA installation. Instant push notifications for various events. Notification actions use JWT authentication. Push subscriptions are removed on logout. Notification deduplication and alarm tags prevent duplicates. Asynchronous, parallel batch sending of notifications. SuperAdmin can enable/disable push notifications per subscription plan.
- **Performance Optimizations**: Implemented optimizations including reduced re-renders, efficient calculations, generic hooks, reduced polling, optimized query caching, memoization of functions and arrays, and timeout cleanup.

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
- **Email Services**: Nodemailer (SMTP Configuration: nodemailer.createTransport(), credentials in environment variables)
- **Payment Processing**: Stripe API
- **Avatar Generation**: UI Avatars API
- **Push Notifications**: web-push