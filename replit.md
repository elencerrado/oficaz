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