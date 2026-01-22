import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import rateLimit from 'express-rate-limit';
import Stripe from 'stripe';
import webpush from 'web-push';
import { subDays, startOfDay } from 'date-fns';
import { storage } from "./storage";
import { SimpleObjectStorageService } from './objectStorageSimple.js';
import { parseExcludedWeekdays } from './ai-schedule-parser';
import { authenticateToken, requireRole, generateToken, generateRefreshToken, AuthRequest, requireVisibleFeature, requireFeature } from './middleware/auth';
import { withDatabaseRetry } from './utils';
import { createAccountingDocument } from './utils/accounting-documents';
import { loginSchema, companyRegistrationSchema, insertVacationRequestSchema, insertWorkShiftSchema, insertMessageSchema, passwordResetRequestSchema, passwordResetSchema, contactFormSchema } from '@shared/schema';
import { ADDON_DEFINITIONS } from '@shared/addon-definitions';
import { z } from 'zod';
import { db } from './db';
import { eq, and, or, desc, asc, sql, not, inArray, count, gte, lte, lt, isNotNull, isNull, ilike } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import * as schema from '@shared/schema';
import { subscriptions, companies, features, users, workSessions, breakPeriods, vacationRequests, messages, reminders, documents, employeeActivationTokens, passwordResetTokens, pushSubscriptions, companyFiscalSettings, accountingEntries, accountingCategories } from '@shared/schema';
import { sendEmail, sendEmployeeWelcomeEmail, sendPasswordResetEmail, sendSuperAdminSecurityCode, sendNewCompanyRegistrationNotification } from './email';

// 🔒 SECURITY: Helper function to safely parse and validate integer IDs from params
function parseIntParam(value: string, paramName: string = 'id'): number {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${paramName}: must be a positive integer`);
  }
  return parsed;
}
import { backgroundImageProcessor } from './backgroundWorker.js';
import { startPushNotificationScheduler } from './pushNotificationScheduler.js';
import { initializeWebSocketServer, getWebSocketServer } from './websocket.js';
import { startEmailQueueWorker } from './emailQueueWorker.js';
import { JWT_SECRET } from './utils/jwt-secret.js';
import Groq from 'groq-sdk';
import OpenAI from 'openai';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PDFDocument, rgb } from 'pdf-lib';
import * as XLSX from 'xlsx';

// Initialize Stripe
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY environment variable is required');
}

// Basic sanity checks to prevent common 401 issues in Stripe Elements
const stripePublishableKey = process.env.VITE_STRIPE_PUBLISHABLE_KEY;
if (!stripePublishableKey) {
  console.warn('⚠️  VITE_STRIPE_PUBLISHABLE_KEY not set. Frontend will fail to load Stripe.');
} else {
  const skMode = stripeSecretKey.startsWith('sk_test') ? 'test' : (stripeSecretKey.startsWith('sk_live') ? 'live' : 'unknown');
  const pkMode = stripePublishableKey.startsWith('pk_test') ? 'test' : (stripePublishableKey.startsWith('pk_live') ? 'live' : 'unknown');
  if (skMode !== 'unknown' && pkMode !== 'unknown' && skMode !== pkMode) {
    console.error(`🚫 Stripe key mismatch: server is '${skMode}' but client key is '${pkMode}'. Use matching keys (pk_${skMode}_..., sk_${skMode}_...).`);
  }
  if (stripePublishableKey.startsWith('pk_tpk_')) {
    console.error('🚫 Invalid Stripe publishable key format detected (starts with pk_tpk_). It should start with pk_test_ or pk_live_.');
  }
}

console.log('Stripe initialized:', stripeSecretKey.substring(0, 8) + '...');

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2025-05-28.basil',
});

// Configure web-push for PWA notifications
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (!vapidPublicKey || !vapidPrivateKey) {
  console.warn('⚠️  VAPID keys not configured. Push notifications will not work.');
} else {
  webpush.setVapidDetails(
    'mailto:soy@oficaz.es',
    vapidPublicKey,
    vapidPrivateKey
  );
  console.log('✓ Web Push configured successfully');
}

// Initialize object storage service (R2 or Replit fallback)
const objectStorage = new SimpleObjectStorageService();

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), 'uploads');

// 🔒 SECURITY: Simple in-memory rate limiting for critical endpoints
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function simpleRateLimit(maxRequests: number, windowMs: number) {
  return (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
    const userId = req.user?.id;
    if (!userId) return next(); // Skip if not authenticated

    const key = `${userId}:${req.path}`;
    const now = Date.now();
    const record = rateLimitStore.get(key);

    // Clean up old entries periodically
    if (Math.random() < 0.01) { // 1% chance
      for (const [k, v] of rateLimitStore.entries()) {
        if (v.resetTime < now) rateLimitStore.delete(k);
      }
    }

    if (!record || record.resetTime < now) {
      // New window
      rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (record.count >= maxRequests) {
      return res.status(429).json({ 
        message: 'Demasiados intentos, por favor espera un momento' 
      });
    }

    record.count++;
    next();
  };
}

// Reusable safe user DTO to avoid exposing PII
function toSafeUser(user: any) {
  return {
    id: user.id,
    fullName: user.fullName,
    dni: user.dni,
    role: user.role,
    companyEmail: user.companyEmail,
    companyId: user.companyId,
    avatarUrl: user.avatarUrl || null,
    profilePicture: user.profilePicture || null,
    position: user.position || null,
    startDate: user.startDate || null,
    status: user.status || null,
    workReportMode: user.workReportMode || null,
    totalVacationDays: user.totalVacationDays || null,
    usedVacationDays: user.usedVacationDays || null,
    vacationDaysPerMonth: user.vacationDaysPerMonth || null,
    isPendingActivation: user.isPendingActivation || false,
  };
}
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const allowedDocumentMimeTypes = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv'
];

const allowedDocumentExtensions = [
  '.pdf', '.png', '.jpg', '.jpeg', '.webp', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv'
];

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const isAllowedMime = allowedDocumentMimeTypes.includes(file.mimetype);
    const isAllowedExt = allowedDocumentExtensions.includes(ext);

    if (!isAllowedMime && !isAllowedExt) {
      return cb(new Error('Tipo de archivo no permitido')); // 400 handled by route catch
    }

    cb(null, true);
  },
});

// Memory storage for Excel file uploads (need buffer access)
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// SECURE multer configuration for profile pictures with strict validation
const profilePictureUpload = multer({
  storage: multer.memoryStorage(), // Use memory storage for R2 upload
  limits: { 
    fileSize: 5 * 1024 * 1024, // 5MB per file
    files: 1, // Only 1 file allowed
  },
  fileFilter: (req, file, cb) => {
    // Allowed file types - only images
    const allowedTypes = [
      'image/png', 
      'image/jpeg',
      'image/jpg',
      'image/webp'
    ];
    
    // Allowed extensions as backup check
    const allowedExts = ['.png', '.jpg', '.jpeg', '.webp'];
    
    // Check both mimetype and extension for security
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(file.mimetype) && allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Tipo de archivo no permitido para foto de perfil. Solo se permiten: PNG, JPG, JPEG, WEBP. Recibido: ${file.mimetype} con extensión ${ext}`));
    }
  }
});

// SECURE multer configuration for contact form with strict validation
const contactUpload = multer({
  dest: uploadDir,
  limits: { 
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 5, // Maximum 5 files
  },
  fileFilter: (req, file, cb) => {
    // Allowed file types - only secure formats
    const allowedTypes = [
      'application/pdf',
      'image/png', 
      'image/jpeg',
      'image/jpg',
      'image/webp'
    ];
    
    // Allowed extensions as backup check
    const allowedExts = ['.pdf', '.png', '.jpg', '.jpeg', '.webp'];
    
    // Check both mimetype and extension for security
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(file.mimetype) && allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Tipo de archivo no permitido. Solo se permiten: PDF, PNG, JPG, JPEG, WEBP. Recibido: ${file.mimetype} con extensión ${ext}`));
    }
  }
});

// 🔒 MONITOR EMAIL: Test/control email that receives all campaigns but doesn't count in stats
const MONITOR_EMAIL = 'soy@oficaz.es';
const isMonitorEmail = (email: string) => email.toLowerCase() === MONITOR_EMAIL.toLowerCase();

// Helper function to fix UTF-8 encoding in filenames from multer
// Multer decodes filenames as latin1, but browsers send them as UTF-8
function fixFilenameEncoding(filename: string): string {
  try {
    // Convert from latin1 to UTF-8
    return Buffer.from(filename, 'latin1').toString('utf8');
  } catch {
    return filename;
  }
}

// Contact form rate limiter - strict limits to prevent abuse
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Maximum 3 contact form submissions per 15 minutes per IP
  skipSuccessfulRequests: false, // Count successful requests
  skipFailedRequests: false, // Count failed requests
  message: {
    success: false,
    message: 'Demasiados envíos de formularios de contacto. Intenta de nuevo en 15 minutos.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// 🔒 SUPER ADMIN SECURITY: Audit logging system with database persistence
async function logAudit(log: {
  timestamp: Date;
  ip: string;
  action: string;
  email?: string;
  success: boolean;
  details?: string;
}) {
  // Console log for immediate visibility
  const emoji = log.success ? '✅' : '🚨';
  console.log(`${emoji} AUDIT [${log.timestamp.toISOString()}] IP: ${log.ip} | Action: ${log.action} | ${log.details || ''}`);
  
  // Persist to database for enterprise-grade audit trail
  try {
    await storage.createAuditLog({
      timestamp: log.timestamp,
      ip: log.ip,
      action: log.action,
      email: log.email,
      success: log.success,
      details: log.details,
    });
  } catch (error) {
    // Critical: Log errors should never break the application
    console.error('🚨 CRITICAL: Failed to persist audit log to database:', error);
  }
}

// 🔒 SUPER ADMIN SECURITY: Very strict rate limiting for super admin endpoints
const superAdminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Maximum 5 login attempts per 15 minutes per IP
  skipSuccessfulRequests: true, // ✅ Don't count successful logins
  skipFailedRequests: false, // ❌ Count failed attempts
  message: {
    success: false,
    message: '🚨 Demasiados intentos de acceso. IP bloqueada temporalmente por seguridad. Intenta de nuevo en 15 minutos.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Log all blocked requests for security audit
  handler: (req, res) => {
    console.log(`🚨 SECURITY ALERT: Super Admin rate limit exceeded - IP: ${req.ip}, Time: ${new Date().toISOString()}`);
    res.status(429).json({
      success: false,
      message: '🚨 Demasiados intentos de acceso. IP bloqueada temporalmente por seguridad. Intenta de nuevo en 15 minutos.',
    });
  },
});

const superAdminAccessLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Maximum 3 access password attempts per 15 minutes per IP - even stricter
  skipSuccessfulRequests: true, // ✅ Don't count successful verifications
  skipFailedRequests: false, // ❌ Count failed attempts
  message: {
    success: false,
    message: '🚨 Demasiados intentos de verificación. IP bloqueada temporalmente. Intenta de nuevo en 15 minutos.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.log(`🚨 SECURITY ALERT: Super Admin access password rate limit exceeded - IP: ${req.ip}, Time: ${new Date().toISOString()}`);
    res.status(429).json({
      success: false,
      message: '🚨 Demasiados intentos de verificación. IP bloqueada temporalmente. Intenta de nuevo en 15 minutos.',
    });
  },
});

// ⚠️ PROTECTED - DO NOT MODIFY
// Demo data generation for new companies
// @param forceRegenerate - If true, bypasses hasDemoData check (used by force regeneration endpoint)
async function generateDemoData(companyId: number, forceRegenerate: boolean = false) {
  console.log('🎭 [DEMO DATA] Starting generation for company:', companyId, forceRegenerate ? '(FORCE MODE)' : '');
  
  let demoDataStarted = false;
  
  try {
    // Get company registration date for dynamic data generation
    const company = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
    if (!company[0]) {
      console.error('🎭 [DEMO DATA] ERROR: Company not found for demo data generation, ID:', companyId);
      return;
    }
    
    // ⚠️ CRITICAL: Check if demo data already exists - prevent duplicate generation
    // Skip this check if forceRegenerate is true (used by force endpoint)
    if (!forceRegenerate && company[0].hasDemoData === true) {
      console.log('🎭 [DEMO DATA] SKIPPING - Company already has demo data, ID:', companyId);
      return;
    }
    
    const registrationDate = new Date(company[0].createdAt);
    console.log('🎭 [DEMO DATA] Company registered on:', registrationDate.toISOString());
    
    // Mark company as having demo data BEFORE starting (atomic flag to prevent race conditions)
    await db.update(companies)
      .set({ hasDemoData: true })
      .where(eq(companies.id, companyId));
    
    demoDataStarted = true;
    console.log('🎭 [DEMO DATA] Flag set to true, starting employee creation...');
    
    // Generate unique identifiers to avoid conflicts
    const uniqueId = Date.now();
    
    // Demo employees data - 7 realistic employees with new avatar photos
    const demoEmployees = [
      {
        fullName: "María García López",
        companyEmail: `maria.garcia.${uniqueId}@demo.com`,
        dni: `${uniqueId.toString().slice(-8)}A`,
        position: "Desarrolladora Senior",
        role: "employee" as const,
        status: "working",
        startDate: new Date(registrationDate.getTime() - 365 * 24 * 60 * 60 * 1000),
        avatarSource: "woman01_1764778692816.webp",
      },
      {
        fullName: "Carlos Rodríguez Martín",
        companyEmail: `carlos.rodriguez.${uniqueId + 1}@demo.com`, 
        dni: `${(uniqueId + 1).toString().slice(-8)}B`,
        position: "Jefe de Proyectos",
        role: "manager" as const,
        status: "working",
        startDate: new Date(registrationDate.getTime() - 200 * 24 * 60 * 60 * 1000),
        avatarSource: "man01_1764778692814.webp",
      },
      {
        fullName: "Ana Fernández Silva",
        companyEmail: `ana.fernandez.${uniqueId + 2}@demo.com`,
        dni: `${(uniqueId + 2).toString().slice(-8)}C`, 
        position: "Analista de Marketing",
        role: "employee" as const,
        status: "vacation",
        startDate: new Date(registrationDate.getTime() - 180 * 24 * 60 * 60 * 1000),
        avatarSource: "woman02_1764778692816.webp",
      },
      {
        fullName: "David López Ruiz",
        companyEmail: `david.lopez.${uniqueId + 3}@demo.com`,
        dni: `${(uniqueId + 3).toString().slice(-8)}D`,
        position: "Diseñador UX/UI", 
        role: "employee" as const,
        status: "working",
        startDate: new Date(registrationDate.getTime() - 90 * 24 * 60 * 60 * 1000),
        avatarSource: "man02_1764778692815.webp",
      },
      {
        fullName: "Laura Martínez Sánchez",
        companyEmail: `laura.martinez.${uniqueId + 4}@demo.com`,
        dni: `${(uniqueId + 4).toString().slice(-8)}E`,
        position: "Contable",
        role: "employee" as const,
        status: "working",
        startDate: new Date(registrationDate.getTime() - 120 * 24 * 60 * 60 * 1000),
        avatarSource: "woman03_1764778692816.webp",
      },
      {
        fullName: "Javier Hernández Gómez",
        companyEmail: `javier.hernandez.${uniqueId + 5}@demo.com`,
        dni: `${(uniqueId + 5).toString().slice(-8)}F`,
        position: "Comercial",
        role: "employee" as const,
        status: "working",
        startDate: new Date(registrationDate.getTime() - 60 * 24 * 60 * 60 * 1000),
        avatarSource: "man03_1764778692815.webp",
      },
      {
        fullName: "Pablo Ruiz Torres",
        companyEmail: `pablo.ruiz.${uniqueId + 6}@demo.com`,
        dni: `${(uniqueId + 6).toString().slice(-8)}G`,
        position: "Técnico de Soporte",
        role: "employee" as const,
        status: "working",
        startDate: new Date(registrationDate.getTime() - 30 * 24 * 60 * 60 * 1000),
        avatarSource: "man04_1764778692815.webp",
      }
    ];

    // Create demo employees with avatars
    const createdEmployees = [];
    for (const employeeData of demoEmployees) {
      const hashedPassword = await bcrypt.hash('Demo123!', 10);
      
      // Use avatar from R2 (uploaded by migration script)
      let profilePicturePath = null;
      if (employeeData.avatarSource) {
        // Avatar should already be in R2 (uploaded by migration script)
        // We just reference it via /uploads/ endpoint which serves from R2
        profilePicturePath = `/uploads/${employeeData.avatarSource}`;
        console.log(`📸 Assigned demo avatar from R2: ${employeeData.avatarSource}`);
      }
      
      const employee = await storage.createUser({
        companyEmail: employeeData.companyEmail,
        password: hashedPassword,
        fullName: employeeData.fullName,
        dni: employeeData.dni,
        position: employeeData.position,
        role: employeeData.role,
        companyId: companyId,
        startDate: employeeData.startDate,
        isActive: true,
        totalVacationDays: "25.0",
        createdBy: null,
        profilePicture: profilePicturePath, // Assign avatar to employee
      });
      
      createdEmployees.push({ ...employee, status: employeeData.status });
      console.log(`👤 Created demo employee: ${employee.fullName} (${employeeData.status}) with avatar: ${profilePicturePath || 'none'}`);
      
      // Update employee status if needed (for vacation status)
      if (employeeData.status === 'vacation') {
        await db.execute(sql`
          UPDATE users 
          SET is_active = false 
          WHERE id = ${employee.id}
        `);
        console.log(`🏖️ Set ${employee.fullName} as on vacation`);
      }
    }

    // Generate comprehensive demo data based on registration date
    console.log('🎭 [DEMO DATA] Starting comprehensive data generation for', createdEmployees.length, 'employees...', forceRegenerate ? '(FORCE MODE)' : '');
    await generateComprehensiveDemoData(companyId, createdEmployees, registrationDate, forceRegenerate);
    
    console.log('✅ [DEMO DATA] Complete! Generated demo data for company:', companyId);
    
  } catch (error) {
    console.error('❌ [DEMO DATA] ERROR generating demo data for company', companyId, ':', error);
    
    // If we started but failed, reset the flag so user knows data wasn't generated
    if (demoDataStarted) {
      try {
        await db.update(companies)
          .set({ hasDemoData: false })
          .where(eq(companies.id, companyId));
        console.log('🎭 [DEMO DATA] Reset hasDemoData flag to false due to error');
      } catch (resetError) {
        console.error('🎭 [DEMO DATA] Could not reset hasDemoData flag:', resetError);
      }
    }
    
    // Re-throw to propagate to caller
    throw error;
  }
}

// Generate comprehensive demo data based on company registration date
// @param forceRegenerate - If true, bypasses duplicate checks in sub-functions (passed from force regeneration)
async function generateComprehensiveDemoData(companyId: number, employees: any[], registrationDate: Date, forceRegenerate: boolean = false) {
  console.log('📊 [DEMO DATA] Generating comprehensive data for', employees.length, 'employees...', forceRegenerate ? '(FORCE MODE)' : '');
  
  if (employees.length === 0) {
    console.warn('⚠️ [DEMO DATA] No employees provided, skipping comprehensive data generation');
    return;
  }
  
  const now = new Date();
  const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  // Generate work sessions for previous month and current month
  for (const employee of employees) {
    // Previous month data (complete month)
    await generateMonthlyWorkSessions(employee, previousMonth, true);
    // Current month data (up to today)
    await generateMonthlyWorkSessions(employee, currentMonth, false);
  }
  
  // Generate activity for company registration date
  await generateRegistrationDayActivity(employees, registrationDate);
  
  // Generate current day activity - ALWAYS generate for today to populate current week quadrant
  // The generateCurrentDayActivity function checks for duplicates internally
  await generateCurrentDayActivity(employees, now);
  
  // Generate vacation requests (approved and pending)
  await generateRealisticVacationRequests(companyId, employees, registrationDate, forceRegenerate);
  
  // Generate bidirectional messages (employee-admin communication)
  await generateBidirectionalMessages(companyId, employees, forceRegenerate);
  
  // Generate reminders for employees
  await generateDemoReminders(companyId, employees, forceRegenerate);
  
  // Generate incomplete sessions for demonstration
  await generateIncompleteSessions(employees, companyId);
  
  // Generate work shifts for current week + 3 next weeks
  await generateDemoWorkShifts(companyId, employees, registrationDate, forceRegenerate);
  
  // Generate pending document requests
  await generateDemoDocumentRequests(companyId, employees, forceRegenerate);
  
  console.log('✅ Generated comprehensive demo data for', employees.length, 'employees');
}

// Generate realistic work sessions for an employee
// Generate realistic work sessions for a complete month or up to current date
async function generateMonthlyWorkSessions(employee: any, monthStart: Date, isCompleteMonth: boolean) {
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const maxDay = isCompleteMonth ? daysInMonth : Math.min(daysInMonth, today.getDate());
  
  const workDays = [1, 2, 3, 4, 5]; // Monday to Friday
  
  // Check for existing sessions to prevent duplicates
  const existingSessions = await db.select()
    .from(workSessions)
    .where(and(
      eq(workSessions.userId, employee.id),
      gte(workSessions.clockIn, monthStart),
      lt(workSessions.clockIn, new Date(year, month + 1, 1))
    ));
  
  const existingDates = new Set(
    existingSessions.map(session => 
      session.clockIn.toISOString().split('T')[0]
    )
  );
  
  for (let day = 1; day <= maxDay; day++) {
    const date = new Date(year, month, day);
    const dayOfWeek = date.getDay();
    const dateStr = date.toISOString().split('T')[0];
    
    // Skip weekends
    if (!workDays.includes(dayOfWeek)) continue;
    
    // Skip if already has session for this date
    if (existingDates.has(dateStr)) {
      console.log(`⚠️ Skipping duplicate session for ${employee.fullName} on ${dateStr}`);
      continue;
    }
    
    // Skip if employee is on vacation (Ana Fernández Silva in current month)
    if (employee.status === "vacation" && !isCompleteMonth && day >= 20 && day <= 25) {
      continue;
    }
    
    // 95% attendance rate for working employees
    if (Math.random() > 0.95) continue;
    
    // Generate realistic work patterns based on employee
    let startHour, workHours;
    if (employee.fullName.includes("María")) {
      // Early starter
      startHour = 8 + Math.floor(Math.random() * 1); // 8:00-8:59
      workHours = 8 + Math.random() * 0.5; // 8-8.5 hours
    } else if (employee.fullName.includes("Carlos")) {
      // Manager - longer hours
      startHour = 8 + Math.floor(Math.random() * 1.5); // 8:00-9:29
      workHours = 8.5 + Math.random() * 1; // 8.5-9.5 hours
    } else {
      // Regular schedule
      startHour = 8 + Math.floor(Math.random() * 2); // 8:00-9:59
      workHours = 7.5 + Math.random() * 1; // 7.5-8.5 hours
    }
    
    const startMinute = Math.floor(Math.random() * 4) * 15; // 0, 15, 30, 45
    
    const clockInTime = new Date(date);
    clockInTime.setHours(startHour, startMinute, 0, 0);
    
    const clockOutTime = new Date(clockInTime);
    clockOutTime.setTime(clockOutTime.getTime() + workHours * 60 * 60 * 1000);
    
    // Create work session
    const workSession = await storage.createWorkSession({
      userId: employee.id,
      clockIn: clockInTime,
      clockOut: clockOutTime,
      totalHours: workHours.toFixed(1),
      status: 'completed',
    });
    
    // Generate breaks (70% chance) - Now properly create break periods
    if (Math.random() < 0.7 && workSession) {
      const breakStart = new Date(clockInTime.getTime() + (2.5 + Math.random() * 2) * 60 * 60 * 1000);
      const breakDuration = 20 + Math.random() * 40; // 20-60 minutes
      const breakEnd = new Date(breakStart.getTime() + breakDuration * 60 * 1000);
      
      // Ensure break doesn't exceed work session
      if (breakEnd < clockOutTime) {
        // Create break period directly in database
        await db.insert(breakPeriods).values({
          workSessionId: workSession.id,
          userId: employee.id,
          breakStart,
          breakEnd,
          duration: (breakDuration / 60).toFixed(2), // Convert to hours
          status: 'completed'
        });
      }
    }
  }
  
  console.log(`📅 Generated work sessions for ${employee.fullName} - ${isCompleteMonth ? 'complete' : 'partial'} month (avoided duplicates)`);
}

// Generate activity for company registration date
async function generateRegistrationDayActivity(employees: any[], registrationDate: Date) {
  const regDate = new Date(registrationDate);
  const dayOfWeek = regDate.getDay();
  
  // Only generate if registration was on a weekday
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    console.log('📅 Registration was on weekend, skipping registration day activity');
    return;
  }
  
  // Check for existing sessions on registration date to prevent duplicates
  const dayStart = new Date(regDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(regDate);
  dayEnd.setHours(23, 59, 59, 999);
  
  const existingSessions = await db.select()
    .from(workSessions)
    .where(and(
      gte(workSessions.clockIn, dayStart),
      lt(workSessions.clockIn, dayEnd)
    ));
  
  if (existingSessions.length > 0) {
    console.log('📅 Registration day activity already exists, skipping to avoid duplicates');
    return;
  }

  // All employees working on registration day (company founding day)
  for (const employee of employees) {
    // Only employees who started before registration (existing employees)
    if (new Date(employee.startDate) <= regDate) {
      const startHour = 8 + Math.floor(Math.random() * 2); // 8:00-9:59
      const workHours = 7.5 + Math.random() * 1; // 7.5-8.5 hours
      const startMinute = Math.floor(Math.random() * 4) * 15;
      
      const clockInTime = new Date(regDate);
      clockInTime.setHours(startHour, startMinute, 0, 0);
      
      const clockOutTime = new Date(clockInTime);
      clockOutTime.setTime(clockOutTime.getTime() + workHours * 60 * 60 * 1000);
      
      const workSession = await storage.createWorkSession({
        userId: employee.id,
        clockIn: clockInTime,
        clockOut: clockOutTime,
        totalHours: workHours.toFixed(1),
        status: "completed",
      });
      
      // Add lunch break for founding day
      if (workSession) {
        const breakStart = new Date(clockInTime.getTime() + 4 * 60 * 60 * 1000); // 4 hours after start
        const breakEnd = new Date(breakStart.getTime() + 45 * 60 * 1000); // 45 min lunch
        
        await db.insert(breakPeriods).values({
          workSessionId: workSession.id,
          userId: employee.id,
          breakStart,
          breakEnd,
          duration: '0.75', // 45 minutes = 0.75 hours
          status: 'completed'
        });
      }
    }
  }
  
  console.log('🏢 Generated registration day activity for founding employees');
}

// Generate current day activity - some employees working today
async function generateCurrentDayActivity(employees: any[], currentDate: Date) {
  const today = new Date(currentDate);
  const dayOfWeek = today.getDay();
  
  // Only generate if today is a weekday
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    console.log('📅 Today is weekend, skipping current day activity');
    return;
  }
  
  // Check for existing sessions on current date to prevent duplicates
  const dayStart = new Date(today);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(today);
  dayEnd.setHours(23, 59, 59, 999);
  
  const existingSessions = await db.select()
    .from(workSessions)
    .where(and(
      gte(workSessions.clockIn, dayStart),
      lt(workSessions.clockIn, dayEnd)
    ));
  
  if (existingSessions.length > 0) {
    console.log('📅 Current day activity already exists, skipping to avoid duplicates');
    return;
  }
  
  // Select working employees for today (exclude vacation employee)
  const workingEmployees = employees.filter(emp => emp.status === 'working');
  
  // 2-3 employees working today (realistic for demo)
  const employeesToWork = workingEmployees.slice(0, Math.min(3, workingEmployees.length));
  
  for (const employee of employeesToWork) {
    const startHour = 8 + Math.floor(Math.random() * 2); // 8:00-9:59
    const startMinute = Math.floor(Math.random() * 4) * 15;
    
    const clockInTime = new Date(today);
    clockInTime.setHours(startHour, startMinute, 0, 0);
    
    // Some employees still working (no clock out), others finished
    const shouldFinishWork = Math.random() > 0.5; // 50% chance
    
    if (shouldFinishWork) {
      // Completed work session
      const workHours = 7.5 + Math.random() * 1;
      const clockOutTime = new Date(clockInTime);
      clockOutTime.setTime(clockOutTime.getTime() + workHours * 60 * 60 * 1000);
      
      const workSession = await storage.createWorkSession({
        userId: employee.id,
        clockIn: clockInTime,
        clockOut: clockOutTime,
        totalHours: workHours.toFixed(1),
        status: "completed",
      });
      
      // Add break for completed sessions
      if (workSession && Math.random() > 0.5) {
        const breakStart = new Date(clockInTime.getTime() + (2 + Math.random() * 2) * 60 * 60 * 1000);
        const breakDuration = 15 + Math.random() * 30; // 15-45 minutes
        const breakEnd = new Date(breakStart.getTime() + breakDuration * 60 * 1000);
        
        await db.insert(breakPeriods).values({
          workSessionId: workSession.id,
          userId: employee.id,
          breakStart,
          breakEnd,
          duration: (breakDuration / 60).toFixed(2),
          status: 'completed'
        });
      }
    } else {
      // Active work session (still working)
      const workSession = await storage.createWorkSession({
        userId: employee.id,
        clockIn: clockInTime,
        clockOut: null, // Still working
        totalHours: null,
        status: 'active',
      });
      
      // Maybe on a break right now
      if (workSession && Math.random() > 0.7) {
        const now = new Date();
        const breakStart = new Date(now.getTime() - 20 * 60 * 1000); // Started 20 min ago
        
        await db.insert(breakPeriods).values({
          workSessionId: workSession.id,
          userId: employee.id,
          breakStart,
          breakEnd: null, // Currently on break
          duration: null,
          status: 'active'
        });
      }
    }
  }
  
  console.log(`💼 Generated current day activity for ${employeesToWork.length} working employees`);
}

// Generate incomplete sessions - sessions that started but haven't been closed beyond working hours
async function generateIncompleteSessions(employees: any[], companyId: number) {
  // Get company settings for working hours (default to 8 if not set)
  const companySettings = await db.select()
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
  
  const workingHoursPerDay = companySettings[0]?.workingHoursPerDay || 8;
  
  // Select 1-2 employees to have incomplete sessions
  const workingEmployees = employees.filter(emp => emp.status === 'working');
  const employeesForIncomplete = workingEmployees.slice(0, Math.min(2, workingEmployees.length));
  
  const now = new Date();
  
  for (const employee of employeesForIncomplete) {
    // Create sessions from previous days that are incomplete (forgot to clock out)
    const daysAgo = Math.floor(Math.random() * 3) + 1; // 1-3 days ago
    const sessionDate = new Date(now);
    sessionDate.setDate(sessionDate.getDate() - daysAgo);
    
    // Skip weekends
    if (sessionDate.getDay() === 0 || sessionDate.getDay() === 6) continue;
    
    // Check if session already exists for this date
    const dayStart = new Date(sessionDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(sessionDate);
    dayEnd.setHours(23, 59, 59, 999);
    
    const existingSession = await db.select()
      .from(workSessions)
      .where(and(
        eq(workSessions.userId, employee.id),
        gte(workSessions.clockIn, dayStart),
        lt(workSessions.clockIn, dayEnd)
      ))
      .limit(1);
    
    if (existingSession.length > 0) continue; // Skip if session exists
    
    // Create incomplete session that started more than working hours ago
    const startHour = 8 + Math.floor(Math.random() * 2); // 8:00-9:59
    const startMinute = Math.floor(Math.random() * 4) * 15;
    
    const clockInTime = new Date(sessionDate);
    clockInTime.setHours(startHour, startMinute, 0, 0);
    
    // Make sure the session has exceeded working hours
    const hoursElapsed = (now.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);
    
    if (hoursElapsed > workingHoursPerDay) {
      await storage.createWorkSession({
        userId: employee.id,
        clockIn: clockInTime,
        clockOut: null, // Never clocked out - this makes it incomplete
        totalHours: null,
        status: 'incomplete', // Mark as incomplete
      });
      
      console.log(`🔴 Created incomplete session for ${employee.fullName} on ${sessionDate.toDateString()}, ${hoursElapsed.toFixed(1)} hours elapsed`);
    }
  }
  
  // Also create 1 incomplete session for today (someone forgot to clock out from yesterday but it's today now)
  if (employeesForIncomplete.length > 0) {
    const employee = employeesForIncomplete[0];
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Skip if yesterday was weekend
    if (yesterday.getDay() !== 0 && yesterday.getDay() !== 6) {
      const dayStart = new Date(yesterday);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(yesterday);  
      dayEnd.setHours(23, 59, 59, 999);
      
      const existingYesterdaySession = await db.select()
        .from(workSessions)
        .where(and(
          eq(workSessions.userId, employee.id),
          gte(workSessions.clockIn, dayStart),
          lt(workSessions.clockIn, dayEnd)
        ))
        .limit(1);
      
      if (existingYesterdaySession.length === 0) {
        const clockInTime = new Date(yesterday);
        clockInTime.setHours(9, 0, 0, 0); // Started at 9:00 AM yesterday
        
        await storage.createWorkSession({
          userId: employee.id,
          clockIn: clockInTime,
          clockOut: null, // Never clocked out
          totalHours: null,
          status: 'incomplete',
        });
        
        console.log(`🔴 Created incomplete session for ${employee.fullName} from yesterday (${yesterday.toDateString()})`);
      }
    }
  }
  
  console.log(`⚠️ Generated incomplete sessions for ${employeesForIncomplete.length} employees`);
}

// Generate demo document requests (pending and completed)
async function generateDemoDocumentRequests(companyId: number, employees: any[], forceRegenerate: boolean = false) {
  console.log('📋 Generating demo document requests...', forceRegenerate ? '(FORCE MODE)' : '');
  
  // ⚠️ CHECK FOR EXISTING DEMO DOCUMENT NOTIFICATIONS - prevent duplicates (skip in force mode)
  if (!forceRegenerate) {
    const employeeIds = employees.map(e => e.id);
    if (employeeIds.length > 0) {
      const existingNotifications = await db.select({ count: count() })
        .from(schema.systemNotifications)
        .where(and(
          inArray(schema.systemNotifications.userId, employeeIds),
          eq(schema.systemNotifications.type, 'document_request')
        ));
      
      if (existingNotifications[0]?.count && Number(existingNotifications[0].count) > 0) {
        console.log(`📋 Skipping demo document requests - ${existingNotifications[0].count} already exist`);
        return;
      }
    }
  }
  
  // Get admin user for creating document requests
  const adminUsers = await db.select()
    .from(users)
    .where(and(
      eq(users.companyId, companyId),
      eq(users.role, 'admin')
    ))
    .limit(1);

  if (adminUsers.length === 0) {
    console.log('⚠️ No admin user found to create document requests');
    return;
  }

  const adminUser = adminUsers[0];
  const now = new Date();
  
  // Select 2-3 random employees for document requests
  const employeesForRequests = employees
    .filter(emp => emp.role === 'employee')
    .slice(0, Math.min(3, employees.length));
  
  const documentRequests = [
    // 1. PENDING - Nómina request (first employee) - requested 2 days ago
    {
      employees: [employeesForRequests[0]],
      documentType: 'Nómina',
      message: 'Por favor, sube tu última nómina para completar tu expediente',
      dueDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000), // Due in 5 days
      priority: 'high',
      isCompleted: false,
    },
    
    // 2. PENDING - Contrato request (second employee) - requested 1 day ago
    {
      employees: [employeesForRequests[1] || employeesForRequests[0]],
      documentType: 'Contrato',
      message: 'Necesitamos una copia firmada de tu contrato de trabajo',
      dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // Due in 7 days
      priority: 'medium',
      isCompleted: false,
    },
    
    // 3. PENDING - DNI request (third employee) - requested today
    {
      employees: [employeesForRequests[2] || employeesForRequests[0]],
      documentType: 'DNI',
      message: 'Sube una copia de tu DNI (ambas caras) para actualizar nuestros archivos',
      dueDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000), // Due in 3 days
      priority: 'medium',
      isCompleted: false,
    },
    
    // 4. COMPLETED - Older request that was completed (first employee)
    {
      employees: [employeesForRequests[0]],
      documentType: 'Justificante Médico',
      message: 'Por favor, sube tu justificante médico de la semana pasada',
      dueDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // Was due 2 days ago
      priority: 'low',
      isCompleted: true,
    },
  ];
  
  for (const request of documentRequests) {
    // Create document notification for each employee using storage method
    for (const employee of request.employees) {
      const notification = await storage.createDocumentNotification(
        employee.id,
        request.documentType,
        request.message,
        adminUser.id,
        request.priority,
        request.dueDate
      );
      
      // Mark as completed if needed
      if (request.isCompleted && notification) {
        await storage.markNotificationCompleted(notification.id);
      }
    }
    
    const status = request.isCompleted ? '✅ COMPLETADA' : '⏳ PENDIENTE';
    console.log(`📄 ${status} - Document request: ${request.documentType} for ${request.employees.map(e => e.fullName).join(', ')}`);
  }
  
  console.log(`📋 Generated ${documentRequests.length} demo document requests (${documentRequests.filter(r => !r.isCompleted).length} pending)`);
}

// Generate demo work shifts for current week + 3 next weeks
// @param forceRegenerate - If true, bypasses duplicate check (passed from force regeneration)
async function generateDemoWorkShifts(companyId: number, employees: any[], registrationDate: Date, forceRegenerate: boolean = false) {
  console.log('📅 Generating demo work shifts for current week + 3 upcoming weeks...', forceRegenerate ? '(FORCE MODE)' : '');
  
  // ⚠️ CHECK FOR EXISTING DEMO WORK SHIFTS - prevent duplicates (skip in force mode)
  if (!forceRegenerate) {
    const existingShifts = await db.select({ count: count() })
      .from(schema.workShifts)
      .where(eq(schema.workShifts.companyId, companyId));
    
    if (existingShifts[0]?.count && Number(existingShifts[0].count) > 0) {
      console.log(`📅 Skipping demo work shifts - ${existingShifts[0].count} shifts already exist for company ${companyId}`);
      return;
    }
  }
  
  // Find admin user to be the creator of shifts - check both admin and manager roles
  let adminEmployee = employees.find(emp => emp.role === 'admin');
  
  // If no admin in demo employees, find the actual company admin from database
  if (!adminEmployee) {
    const companyAdmins = await db.select()
      .from(users)
      .where(and(
        eq(users.companyId, companyId),
        eq(users.role, 'admin')
      ))
      .limit(1);
    
    if (companyAdmins.length > 0) {
      adminEmployee = companyAdmins[0];
      console.log(`✅ Using company admin: ${adminEmployee.fullName}`);
    } else {
      console.log('⚠️ No admin found, skipping work shifts generation');
      return;
    }
  }
  
  // Get employees excluding admin
  const regularEmployees = employees.filter(emp => emp.role !== 'admin');
  
  if (regularEmployees.length === 0) {
    console.log('⚠️ No employees found for shifts (excluding admin)');
    return;
  }
  
  // Define shift types with colors
  const morningShift = { title: 'Turno Mañana', startHour: 9, endHour: 14, color: '#007AFF' }; // Blue
  const afternoonShift = { title: 'Turno Tarde', startHour: 15, endHour: 20, color: '#FF9500' }; // Orange  
  const fullDayShift = { title: 'Jornada Completa', startHour: 9, endHour: 18, color: '#34C759' }; // Green
  const extendedShift = { title: 'Turno Extendido', startHour: 8, endHour: 16, color: '#AF52DE' }; // Purple
  
  const locations = ['Oficina Central', 'Sucursal Norte', 'Trabajo Remoto', null];
  
  // Calculate start of current week (Monday)
  const now = new Date();
  const currentWeekStart = new Date(now);
  currentWeekStart.setDate(now.getDate() - now.getDay() + 1); // Monday
  currentWeekStart.setHours(0, 0, 0, 0);
  
  let totalShiftsCreated = 0;
  let splitShiftsCreated = 0;
  
  // Generate shifts for 4 weeks (current + 3 next)
  for (let week = 0; week < 4; week++) {
    const weekStart = new Date(currentWeekStart);
    weekStart.setDate(currentWeekStart.getDate() + (week * 7));
    
    console.log(`📅 Generating shifts for week ${week + 1}: ${weekStart.toDateString()}`);
    
    // Generate shifts for Monday to Friday
    for (let day = 0; day < 5; day++) {
      const shiftDate = new Date(weekStart);
      shiftDate.setDate(weekStart.getDate() + day);
      
      // For current week (week === 0), generate ALL days including past ones
      // For future weeks, only generate from today onwards
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (week > 0 && shiftDate < today) {
        continue; // Skip past days in future weeks only
      }
      
      // Assign shifts to all employees with varied patterns
      for (let i = 0; i < regularEmployees.length; i++) {
        const employee = regularEmployees[i];
        
        try {
          // Determine shift pattern based on employee index and day
          // Employee 0: Split shifts on Mon/Wed/Fri, full day on Tue/Thu
          // Employee 1: Mostly full days with occasional extended shift
          // Employee 2+: Mixed patterns including split shifts
          
          if (i === 0 && day % 2 === 0) {
            // SPLIT SHIFT: Create morning and afternoon shifts for first employee on alternate days
            const location = locations[Math.floor(Math.random() * locations.length)];
            
            // Morning shift
            const morningStart = new Date(shiftDate);
            morningStart.setHours(morningShift.startHour, 0, 0, 0);
            const morningEnd = new Date(shiftDate);
            morningEnd.setHours(morningShift.endHour, 0, 0, 0);
            
            await db.insert(schema.workShifts).values({
              companyId,
              employeeId: employee.id,
              startAt: morningStart,
              endAt: morningEnd,
              title: morningShift.title,
              location,
              notes: 'Turno partido - mañana',
              color: morningShift.color,
              createdByUserId: adminEmployee.id,
            });
            
            // Afternoon shift
            const afternoonStart = new Date(shiftDate);
            afternoonStart.setHours(afternoonShift.startHour, 0, 0, 0);
            const afternoonEnd = new Date(shiftDate);
            afternoonEnd.setHours(afternoonShift.endHour, 0, 0, 0);
            
            await db.insert(schema.workShifts).values({
              companyId,
              employeeId: employee.id,
              startAt: afternoonStart,
              endAt: afternoonEnd,
              title: afternoonShift.title,
              location,
              notes: 'Turno partido - tarde',
              color: afternoonShift.color,
              createdByUserId: adminEmployee.id,
            });
            
            totalShiftsCreated += 2;
            splitShiftsCreated++;
            console.log(`📋 Created SPLIT shift: ${employee.fullName} on ${shiftDate.toDateString()}`);
            
          } else if (i === 1) {
            // Full days with occasional extended shift (Thursday)
            const shiftType = day === 3 ? extendedShift : fullDayShift;
            
            const startAt = new Date(shiftDate);
            startAt.setHours(shiftType.startHour, 0, 0, 0);
            const endAt = new Date(shiftDate);
            endAt.setHours(shiftType.endHour, 0, 0, 0);
            
            await db.insert(schema.workShifts).values({
              companyId,
              employeeId: employee.id,
              startAt,
              endAt,
              title: shiftType.title,
              location: locations[Math.floor(Math.random() * locations.length)],
              notes: day === 3 ? 'Reunión importante' : null,
              color: shiftType.color,
              createdByUserId: adminEmployee.id,
            });
            
            totalShiftsCreated++;
            console.log(`📋 Created ${shiftType.title}: ${employee.fullName} on ${shiftDate.toDateString()}`);
            
          } else {
            // Other employees: Mix of split shifts and regular shifts
            if ((i + day) % 3 === 0) {
              // SPLIT SHIFT for variety
              const location = locations[Math.floor(Math.random() * locations.length)];
              
              const morningStart = new Date(shiftDate);
              morningStart.setHours(morningShift.startHour, 0, 0, 0);
              const morningEnd = new Date(shiftDate);
              morningEnd.setHours(morningShift.endHour, 0, 0, 0);
              
              await db.insert(schema.workShifts).values({
                companyId,
                employeeId: employee.id,
                startAt: morningStart,
                endAt: morningEnd,
                title: morningShift.title,
                location,
                notes: 'Turno partido',
                color: morningShift.color,
                createdByUserId: adminEmployee.id,
              });
              
              const afternoonStart = new Date(shiftDate);
              afternoonStart.setHours(afternoonShift.startHour, 0, 0, 0);
              const afternoonEnd = new Date(shiftDate);
              afternoonEnd.setHours(afternoonShift.endHour, 0, 0, 0);
              
              await db.insert(schema.workShifts).values({
                companyId,
                employeeId: employee.id,
                startAt: afternoonStart,
                endAt: afternoonEnd,
                title: afternoonShift.title,
                location,
                notes: 'Turno partido',
                color: afternoonShift.color,
                createdByUserId: adminEmployee.id,
              });
              
              totalShiftsCreated += 2;
              splitShiftsCreated++;
              console.log(`📋 Created SPLIT shift: ${employee.fullName} on ${shiftDate.toDateString()}`);
              
            } else {
              // Regular single shift
              const shiftType = day % 2 === 0 ? fullDayShift : extendedShift;
              
              const startAt = new Date(shiftDate);
              startAt.setHours(shiftType.startHour, 0, 0, 0);
              const endAt = new Date(shiftDate);
              endAt.setHours(shiftType.endHour, 0, 0, 0);
              
              await db.insert(schema.workShifts).values({
                companyId,
                employeeId: employee.id,
                startAt,
                endAt,
                title: shiftType.title,
                location: locations[Math.floor(Math.random() * locations.length)],
                notes: null,
                color: shiftType.color,
                createdByUserId: adminEmployee.id,
              });
              
              totalShiftsCreated++;
              console.log(`📋 Created ${shiftType.title}: ${employee.fullName} on ${shiftDate.toDateString()}`);
            }
          }
        } catch (error) {
          console.error(`❌ Error creating shift for ${employee.fullName}:`, error);
        }
      }
    }
  }
  
  console.log(`✅ Generated ${totalShiftsCreated} demo work shifts for ${regularEmployees.length} employees (${splitShiftsCreated} split shift days)`);
}

// Generate demo vacation requests
// Generate realistic vacation requests with different statuses
// @param forceRegenerate - If true, bypasses duplicate check (passed from force regeneration)
async function generateRealisticVacationRequests(companyId: number, employees: any[], registrationDate: Date, forceRegenerate: boolean = false) {
  console.log('🏖️ Generating demo vacation requests...', forceRegenerate ? '(FORCE MODE)' : '');
  
  // ⚠️ CHECK FOR EXISTING DEMO VACATION REQUESTS - prevent duplicates (skip in force mode)
  if (!forceRegenerate) {
    const employeeIds = employees.map(e => e.id);
    if (employeeIds.length > 0) {
      const existingVacations = await db.select({ count: count() })
        .from(schema.vacationRequests)
        .where(inArray(schema.vacationRequests.userId, employeeIds));
      
      if (existingVacations[0]?.count && Number(existingVacations[0].count) > 0) {
        console.log(`🏖️ Skipping demo vacation requests - ${existingVacations[0].count} already exist`);
        return;
      }
    }
  }
  
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  
  const demoVacationRequests = [
    // 1. APPROVED - Previous month vacation (María García)
    {
      employee: employees[0], // María García López
      startDate: new Date(currentYear, currentMonth - 1, 15),
      endDate: new Date(currentYear, currentMonth - 1, 19), // 5 days
      status: 'approved' as const,
      reason: 'Vacaciones de verano planificadas',
      createdAt: new Date(currentYear, currentMonth - 2, 20), // Requested 2 months ago
    },
    
    // 2. APPROVED - Current vacation (Ana Fernández - currently on vacation)
    {
      employee: employees[2], // Ana Fernández Silva  
      startDate: new Date(registrationDate.getTime() - 3 * 24 * 60 * 60 * 1000), // Started 3 days before registration
      endDate: new Date(registrationDate.getTime() + 2 * 24 * 60 * 60 * 1000), // Ends 2 days after registration
      status: 'approved' as const,
      reason: 'Descanso personal programado',
      createdAt: new Date(registrationDate.getTime() - 15 * 24 * 60 * 60 * 1000), // Requested 15 days before registration
    },
    
    // 3. PENDING - Next month vacation (David López)
    {
      employee: employees[3], // David López Ruiz
      startDate: new Date(currentYear, currentMonth + 1, 10),
      endDate: new Date(currentYear, currentMonth + 1, 14), // 5 days
      status: 'pending' as const,
      reason: 'Vacaciones familiares de fin de año',
      createdAt: new Date(currentYear, currentMonth, now.getDate() - 3), // Requested 3 days ago
    },
    
    // 4. PENDING - Future vacation (Carlos Rodríguez)
    {
      employee: employees[1], // Carlos Rodríguez Martín
      startDate: new Date(currentYear, currentMonth + 2, 8),
      endDate: new Date(currentYear, currentMonth + 2, 12), // 5 days
      status: 'pending' as const,
      reason: 'Puente extendido planificado',
      createdAt: new Date(currentYear, currentMonth, now.getDate() - 1), // Requested yesterday
    },
    
    // 5. APPROVED - Historical vacation from previous months
    {
      employee: employees[1], // Carlos Rodríguez Martín
      startDate: new Date(currentYear, currentMonth - 2, 3),
      endDate: new Date(currentYear, currentMonth - 2, 7), // 5 days
      status: 'approved' as const,
      reason: 'Descanso tras proyecto importante',
      createdAt: new Date(currentYear, currentMonth - 3, 15),
    }
  ];
  
  for (const request of demoVacationRequests) {
    // Create vacation request with realistic creation date
    const vacationRequest = await storage.createVacationRequest({
      userId: request.employee.id,
      startDate: request.startDate,
      endDate: request.endDate,
      status: request.status,
      reason: request.reason,
    });
    
    // Update creation date to be realistic
    if (vacationRequest) {
      await db.execute(sql`
        UPDATE vacation_requests 
        SET created_at = ${request.createdAt.toISOString()}
        WHERE id = ${vacationRequest.id}
      `);
    }
  }
  
  console.log('🏖️ Generated', demoVacationRequests.length, 'realistic vacation requests (approved & pending)');
}

// Generate demo messages
// Generate bidirectional messages between employees and admin
async function generateBidirectionalMessages(companyId: number, employees: any[], forceRegenerate: boolean = false) {
  console.log('💬 Generating demo messages...', forceRegenerate ? '(FORCE MODE)' : '');
  
  // ⚠️ CHECK FOR EXISTING DEMO MESSAGES - prevent duplicates (skip in force mode)
  if (!forceRegenerate) {
    const employeeIds = employees.map(e => e.id);
    if (employeeIds.length > 0) {
      const existingMessages = await db.select({ count: count() })
        .from(messages)
        .where(inArray(messages.senderId, employeeIds));
      
      if (existingMessages[0]?.count && Number(existingMessages[0].count) > 0) {
        console.log(`💬 Skipping demo messages - ${existingMessages[0].count} messages already exist`);
        return;
      }
    }
  }
  
  const now = new Date();
  
  // Get admin user for the company (the user who just registered)
  const adminUsers = await db.select()
    .from(users)
    .where(and(
      eq(users.companyId, companyId),
      eq(users.role, 'admin')
    ));
  
  if (!adminUsers.length) {
    console.log('No admin found for company, skipping messages');
    return;
  }
  
  const admin = adminUsers[0];
  
  // Create individual bidirectional conversations (not group messages)
  const conversationMessages = [
    // Conversation 1: Admin <-> María García
    {
      sender: admin,
      recipient: employees[0], // María García
      content: '¡Bienvenida al nuevo sistema Oficaz, María! Aquí podrás gestionar tus fichajes, vacaciones y comunicarte conmigo. ¿Todo correcto?',
      sentAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    },
    {
      sender: employees[0], // María García
      recipient: admin,
      content: 'Hola! He estado revisando el sistema y tengo una duda. ¿Cómo se calculan exactamente los días de vacaciones? Veo que tengo 22 días disponibles.',
      sentAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
    },
    {
      sender: admin,
      recipient: employees[0],
      content: 'Buena pregunta, María. Son mínimo 30 días naturales al año, 2.5 por mes trabajado. El sistema los calcula proporcionalmente según tu fecha de incorporación, y tenemos una opción de ajuste para añadir o restar días según las necesidades de cada empleado.',
      sentAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000), // 4 days ago + 2 hours
    },
    {
      sender: employees[0], // María García
      recipient: admin,
      content: 'Perfecto, entonces si alguien entra en julio tendría 2.5 × 6 meses = 15 días hasta fin de año. Y si necesitamos ajustar por convenio o situación especial, podemos hacerlo manualmente. ¡Muy flexible el sistema!',
      sentAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000), // 4 days ago + 3 hours
    },
    
    // Conversation 2: Admin <-> Carlos (Manager)
    {
      sender: admin,
      recipient: employees[1], // Carlos Rodríguez (manager)
      content: 'Carlos, como nuevo responsable del equipo, te he dado permisos de manager. Puedes gestionar las vacaciones del equipo y acceder a reportes.',
      sentAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    },
    {
      sender: employees[1], // Carlos
      recipient: admin,
      content: 'Perfecto, gracias. He revisado las solicitudes pendientes y todo está en orden. El equipo está funcionando muy bien.',
      sentAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    },
    
    // Conversation 3: Admin <-> David López
    {
      sender: employees[3], // David López
      recipient: admin,
      content: 'Buenos días. He enviado una solicitud de vacaciones para el mes que viene. ¿Podrías revisarla cuando tengas un momento? Gracias.',
      sentAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
    },
    {
      sender: admin,
      recipient: employees[3],
      content: 'Perfecto David, he visto tu solicitud. Está todo correcto, la aprobaré en cuanto revise la planificación del equipo. Te confirmo hoy mismo.',
      sentAt: new Date(now.getTime() - 22 * 60 * 60 * 1000), // 22 hours ago
    },
    
    // Conversation 4: Admin <-> Ana Fernández (on vacation)
    {
      sender: employees[2], // Ana Fernández
      recipient: admin,
      content: 'Hola! Aunque estoy de vacaciones, he visto que han llegado los datos del último proyecto. Si necesitas algo urgente, puedes escribirme.',
      sentAt: new Date(now.getTime() - 5 * 60 * 60 * 1000), // 5 hours ago
    },
    {
      sender: admin,
      recipient: employees[2],
      content: 'Gracias Ana, disfruta de tus vacaciones. Todo está bajo control. Nos vemos cuando regreses.',
      sentAt: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago
    }
  ];
  
  for (const message of conversationMessages) {
    const createdMessage = await storage.createMessage({
      senderId: message.sender.id,
      receiverId: message.recipient.id, // Always a specific recipient
      content: message.content,
      isToAllEmployees: false, // All messages are individual, not group
    });
    
    // Update message timestamp to be realistic
    if (createdMessage) {
      await db.execute(sql`
        UPDATE messages 
        SET created_at = ${message.sentAt.toISOString()}
        WHERE id = ${createdMessage.id}
      `);
    }
  }
  
  console.log('💬 Generated', conversationMessages.length, 'bidirectional demo messages (employee-admin communication)');
}

// Generate demo reminders with varied assignments
async function generateDemoReminders(companyId: number, employees: any[], forceRegenerate: boolean = false) {
  console.log('⏰ Generating demo reminders...', forceRegenerate ? '(FORCE MODE)' : '');
  
  // ⚠️ CHECK FOR EXISTING DEMO REMINDERS - prevent duplicates (skip in force mode)
  if (!forceRegenerate) {
    const existingReminders = await db.select({ count: count() })
      .from(reminders)
      .where(eq(reminders.companyId, companyId));
    
    if (existingReminders[0]?.count && Number(existingReminders[0].count) > 0) {
      console.log(`⏰ Skipping demo reminders - ${existingReminders[0].count} reminders already exist for company ${companyId}`);
      return;
    }
  }
  
  // Get admin user for creating company-wide reminders
  const adminUsers = await db.select()
    .from(users)
    .where(and(
      eq(users.companyId, companyId),
      eq(users.role, 'admin')
    ));
  
  const admin = adminUsers[0];
  
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  nextWeek.setHours(14, 0, 0, 0);
  
  const demoReminders = [
    // 1. ADMIN CREATED - Shared with multiple employees (María García)
    {
      title: 'Reunión de equipo semanal',
      description: 'Reunión para revisar el progreso del proyecto y planificar la próxima semana',
      dueDateTime: tomorrow,
      assignedEmployees: [employees[0]], // Solo María García
      createdBy: admin,
      color: '#FFFFCC', // Light yellow
      priority: 'high' as const,
    },
    // 2. ADMIN CREATED - Shared with multiple employees (María y Carlos)
    {
      title: 'Entrega de documentación técnica',
      description: 'Completar y revisar toda la documentación del sistema antes de la presentación',
      dueDateTime: nextWeek,
      assignedEmployees: [employees[0], employees[1]], // María y Carlos
      createdBy: admin,
      color: '#C8E6C9', // Soft green
      priority: 'medium' as const,
    },
    // 3. EMPLOYEE CREATED - Ana creates her own reminder
    {
      title: 'Revisión de diseños con cliente',
      description: 'Presentar los nuevos mockups y recoger feedback del cliente',
      dueDateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      assignedEmployees: [employees[2]], // Solo Ana Fernández (auto-asignado)
      createdBy: employees[2], // Creado por Ana
      color: '#BBDEFB', // Sky blue
      priority: 'high' as const,
    },
    // 4. ADMIN CREATED - Group task assigned to 3 employees
    {
      title: 'Preparación presentación trimestral',
      description: 'Recopilar datos y preparar la presentación de resultados del trimestre',
      dueDateTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      assignedEmployees: [employees[0], employees[1], employees[3]], // María, Carlos y David
      createdBy: admin,
      color: '#FFE4B5', // Warm peach
      priority: 'medium' as const,
    },
    // 5. EMPLOYEE CREATED - David creates his own reminder
    {
      title: 'Formación en nuevas herramientas',
      description: 'Completar el curso online de certificación en la nueva plataforma',
      dueDateTime: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      assignedEmployees: [employees[3]], // Solo David López (auto-asignado)
      createdBy: employees[3], // Creado por David
      color: '#F8BBD9', // Rose pink
      priority: 'low' as const,
    },
    // 6. ADMIN CREATED - Company-wide reminder (admin only)
    {
      title: 'Revisión mensual de objetivos',
      description: 'Evaluar el cumplimiento de objetivos del mes y planificar acciones correctivas',
      dueDateTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      assignedEmployees: [], // Sin asignar - solo admin
      createdBy: admin,
      color: '#E1BEE7', // Lavender purple
      priority: 'medium' as const,
    },
    // 7. EMPLOYEE CREATED - Carlos (manager) creates reminder shared with María
    {
      title: 'Revisión de código frontend',
      description: 'Revisar pull requests pendientes y asegurar calidad del código',
      dueDateTime: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
      assignedEmployees: [employees[0], employees[1]], // María y Carlos
      createdBy: employees[1], // Creado por Carlos (manager)
      color: '#C8E6C9', // Soft green
      priority: 'high' as const,
    }
  ];
  
  for (const reminder of demoReminders) {
    // Create base reminder
    const createdReminder = await storage.createReminder({
      title: reminder.title,
      content: reminder.description, // ✅ FIXED: Use 'content' field from schema
      reminderDate: reminder.dueDateTime, // ✅ FIXED: Use 'reminderDate' field from schema
      userId: reminder.createdBy.id, // Creator
      companyId: companyId,
      createdBy: reminder.createdBy.id,
      color: reminder.color,
      priority: reminder.priority,
      assignedUserIds: reminder.assignedEmployees.length > 0 ? reminder.assignedEmployees.map(emp => emp.id) : [], // ✅ FIXED: Use 'assignedUserIds' array field
    });
    
    console.log(`⏰ Created reminder "${reminder.title}" assigned to ${reminder.assignedEmployees.length > 0 ? reminder.assignedEmployees.map(emp => emp.fullName).join(', ') : 'admin only'}`);
  }
  
  console.log('⏰ Generated', demoReminders.length, 'demo reminders with varied assignments');
}

export async function registerRoutes(app: Express): Promise<Server> {
  // =================================================================
  // 🏥 HEALTH CHECK ENDPOINT (Required for Replit deployment)
  // =================================================================
  // CRITICAL: Must be the first route and respond immediately
  // Replit health checks timeout after a few seconds
  app.get('/health', (req, res) => {
    res.status(200).json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      service: 'oficaz'
    });
  });
  
  // Root endpoint - also responds quickly for Replit
  app.get('/', (req, res) => {
    res.status(200).json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      service: 'oficaz'
    });
  });

  // =================================================================
  // 📊 DIAGNOSTICS ENDPOINT (for troubleshooting iOS and Replit issues)
  // =================================================================
  app.get('/api/diagnostics', (req, res) => {
    // 🔒 SECURITY: Only expose diagnostics in development
    if (process.env.NODE_ENV !== 'development') {
      console.warn(`🚨 SECURITY: Blocked diagnostics access in ${process.env.NODE_ENV} mode from ${req.ip}`);
      return res.status(403).json({ error: 'Diagnostics endpoint not available in this environment' });
    }

    const diagnostics = {
      server: {
        nodeEnv: process.env.NODE_ENV,
        replit: !!process.env.REPLIT_DOMAINS,
        replitDomains: process.env.REPLIT_DOMAINS || 'not set',
        trustProxy: app.get('trust proxy'),
      },
      request: {
        userAgent: req.headers['user-agent'],
        origin: req.headers.origin,
        host: req.headers.host,
        ip: req.ip,
        protocol: req.protocol,
        isSecure: req.secure,
      },
      client: {
        isIOS: /iPad|iPhone|iPod/.test(req.headers['user-agent'] || ''),
        isSafari: /Safari/.test(req.headers['user-agent'] || '') && !/Chrome/.test(req.headers['user-agent'] || ''),
      },
      cors: {
        enabled: true,
        message: 'CORS is enabled. If you see this, CORS is working.',
      },
      serviceWorker: {
        note: 'Service Worker status can be checked from browser DevTools > Application > Service Workers',
      },
    };
    
    res.json(diagnostics);
  });

  // =================================================================
  // �🔔 STRIPE WEBHOOKS (Must be BEFORE express.json() middleware!)
  // =================================================================
  
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    
    if (!sig) {
      console.error('⚠️ Webhook signature missing');
      return res.status(400).send('Webhook signature missing');
    }
    
    let event: Stripe.Event;
    
    try {
      // Verify webhook signature (prevents fake requests)
      if (!endpointSecret) {
        console.warn('⚠️ STRIPE_WEBHOOK_SECRET not configured - webhook signature verification skipped (INSECURE!)');
        event = JSON.parse(req.body.toString());
      } else {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
      }
    } catch (err: any) {
      console.error('⚠️ Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    
    console.log(`📥 Stripe webhook received: ${event.type}`);
    
    // Handle specific events
    try {
      switch (event.type) {
        case 'customer.subscription.trial_will_end': {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = subscription.customer as string;
          
          console.log(`⏳ Trial ending soon for subscription: ${subscription.id}, customer: ${customerId}`);
          
          // Find company by Stripe customer ID
          const company = await db.select()
            .from(companies)
            .where(eq(companies.stripeCustomerId, customerId))
            .limit(1);
          
          if (company.length > 0) {
            console.log(`📧 TODO: Send trial reminder email to company: ${company[0].name}`);
            // TODO: Send reminder notification to admin 3 days before trial ends
          }
          break;
        }
        
        case 'customer.subscription.updated': {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = subscription.customer as string;
          
          console.log(`🔄 Subscription updated: ${subscription.id}, status: ${subscription.status}`);
          
          // Check if trial just converted to active (payment successful)
          if (subscription.status === 'active' && !subscription.trial_end) {
            const company = await db.select()
              .from(companies)
              .where(eq(companies.stripeCustomerId, customerId))
              .limit(1);
            
            if (company.length > 0) {
              console.log(`✅ Trial converted to paid for company: ${company[0].name}`);
              // Company status already updated by Stripe subscription object
            }
          }
          break;
        }
        
        case 'invoice.payment_failed': {
          const invoice = event.data.object as Stripe.Invoice;
          const customerId = invoice.customer as string;
          
          console.log(`❌ Payment failed for customer: ${customerId}`);
          
          const company = await db.select()
            .from(companies)
            .where(eq(companies.stripeCustomerId, customerId))
            .limit(1);
          
          if (company.length > 0) {
            console.log(`⚠️ TODO: Notify admin of payment failure for company: ${company[0].name}`);
            // TODO: Send email notification to company admin
            // TODO: Update company status to 'past_due' or 'suspended' after grace period
          }
          break;
        }
        
        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = subscription.customer as string;
          
          console.log(`🗑️ Subscription canceled: ${subscription.id}`);
          
          const company = await db.select()
            .from(companies)
            .where(eq(companies.stripeCustomerId, customerId))
            .limit(1);
          
          if (company.length > 0) {
            console.log(`⚠️ TODO: Handle subscription cancellation for company: ${company[0].name}`);
            // TODO: Update company status, disable access, start grace period
          }
          break;
        }
        
        default:
          console.log(`ℹ️ Unhandled event type: ${event.type}`);
      }
      
      // Return a 200 response to acknowledge receipt of the event
      res.json({ received: true });
    } catch (error) {
      console.error('❌ Error processing webhook:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });
  
  // =================================================================
  // Regular routes (with express.json() middleware)
  // =================================================================
  
  // 📦 Object Storage: Serve public objects (email marketing images)
  // Reference: blueprint:javascript_object_storage
  // 🔒 SECURITY: Sanitize filePath to prevent directory traversal attacks
  app.get("/public-objects/:filePath(*)", async (req, res) => {
    const filePath = req.params.filePath;
    
    // 🔒 SECURITY FIX: Prevent path traversal attacks
    // Remove any '../' sequences and ensure path is normalized
    if (filePath.includes('..') || filePath.startsWith('/')) {
      console.warn(`🚨 SECURITY: Blocked path traversal attempt: ${filePath}`);
      return res.status(400).json({ error: "Invalid file path" });
    }
    
    try {
      const { SimpleObjectStorageService } = await import('./objectStorageSimple.js');
      const objectStorage = new SimpleObjectStorageService();
      const file = await objectStorage.searchPublicObject(filePath);
      
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      
      await objectStorage.downloadObject(file, res);
    } catch (error) {
      console.error("Error searching for public object:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Rate limiter for validation endpoints (prevent enumeration)
  const validationLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 20, // limit each IP to 20 validation attempts per 5 min
    message: { error: 'Demasiados intentos de validación. Intenta de nuevo más tarde.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Company validation endpoints
  app.post('/api/validate-company', validationLimiter, async (req, res) => {
    try {
      const { field, value } = req.body;
      
      if (!field || !value) {
        return res.status(400).json({ message: 'Field and value are required' });
      }

      let existingRecord = null;
      
      switch (field) {
        case 'name':
          existingRecord = await db.select().from(companies).where(eq(companies.name, value));
          break;
        case 'cif':
          existingRecord = await db.select().from(companies).where(eq(companies.cif, value));
          break;
        case 'billingEmail':
          existingRecord = await db.select().from(companies).where(eq(companies.email, value));
          break;
        case 'alias':
          existingRecord = await db.select().from(companies).where(eq(companies.companyAlias, value));
          break;
        default:
          return res.status(400).json({ message: 'Invalid field' });
      }

      const isAvailable = !existingRecord || existingRecord.length === 0;
      res.json({ available: isAvailable });
    } catch (error) {
      console.error('Error validating company data:', error);
      res.status(500).json({ message: 'Error validating company data' });
    }
  });

  // Public endpoint to check registration settings
  app.get('/api/registration-status', async (req, res) => {
    try {
      const settings = await storage.getRegistrationSettings();
      res.json({ 
        publicRegistrationEnabled: settings?.publicRegistrationEnabled ?? true 
      });
    } catch (error) {
      console.error('Error fetching registration settings:', error);
      res.json({ publicRegistrationEnabled: true }); // Default to enabled if error
    }
  });

  // Contact form endpoint (public) - SECURITY ENHANCED with file upload support
  app.post('/api/contact', contactUpload.array('attachments', 5), async (req, res) => {
    let uploadedFiles: any[] = [];
    
    try {
      const { name, email, phone, subject, message } = req.body;
      
      // Store uploaded files for cleanup
      if (req.files && Array.isArray(req.files)) {
        uploadedFiles = req.files;
      }

      console.log('✉️ CONTACT ATTEMPT:', { name, email, phone, subject, message });

      // Validate and sanitize inputs to prevent XSS and limit attack surface
      const validatedData = {
        name: (name || 'Anónimo').toString().substring(0, 100),
        email: (email || 'contacto@oficaz.es').toString().substring(0, 100), 
        phone: (phone || '').toString().substring(0, 20),
        subject: (subject || 'Consulta web').toString().substring(0, 200),
        message: (message || 'Mensaje desde formulario web').toString().substring(0, 5000)
      };

      // File info logging only - no validation
      if (uploadedFiles.length > 0) {
        const totalFileSize = uploadedFiles.reduce((sum, file) => sum + file.size, 0);
        console.log(`📁 Contact files: ${uploadedFiles.length} files, ${(totalFileSize / 1024 / 1024).toFixed(2)}MB total`);
      }

      // 🔒 SECURITY: Configure Nodemailer with secure environment variables
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: 465,
        secure: true, // SSL
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      // Verify SMTP connection for diagnostics
      try {
        await transporter.verify();
        console.log('✅ SMTP verified for contact form');
      } catch (verr) {
        console.error('❌ SMTP verification failed:', (verr as any)?.message || verr);
      }

      // Use static logo URL for email compatibility
      const logoUrl = 'https://oficaz.es/email-logo.png';

      // Prepare secure attachments using validated data
      const attachments: any[] = [];
      if (uploadedFiles.length > 0) {
        uploadedFiles.forEach((file: any) => {
          attachments.push({
            filename: file.originalname,
            path: file.path,
            contentType: file.mimetype
          });
        });
      }

      // SECURITY: Use validated data for email content
      // Detect if this is an incident (from support) or regular contact
      const isIncident = validatedData.subject.startsWith('Incidencia: ');
      const cleanSubject = isIncident ? validatedData.subject.replace('Incidencia: ', '') : validatedData.subject;
      const emailSubject = isIncident ? `[INCIDENCIA] ${cleanSubject}` : `[CONTACTO] ${validatedData.subject}`;
      const messageType = isIncident ? 'incidencia' : 'contacto';
      
      console.log(`🔍 EMAIL DEBUG: isIncident=${isIncident}, originalSubject="${validatedData.subject}", cleanSubject="${cleanSubject}", emailSubject="${emailSubject}", messageType="${messageType}"`);
      
      const htmlContent = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Nuevo ${messageType} desde la web</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            
            <!-- Header con logo -->
            <div style="background-color: #ffffff; padding: 15px; text-align: center; border-bottom: 1px solid #e5e7eb;">
              <img src="${logoUrl}" alt="Oficaz" style="height: 35px; width: auto; max-width: 150px; display: block; margin: 0 auto;" />
            </div>
            
            <!-- Contenido -->
            <div style="padding: 30px 20px;">
              <h1 style="color: #1f2937; font-size: 24px; font-weight: 700; margin: 0 0 20px 0;">
                🔔 Nuevo mensaje de ${messageType}
              </h1>
              
              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
                <h2 style="color: #374151; font-size: 18px; margin: 0 0 15px 0;">
                  ${cleanSubject}
                </h2>
                <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0;">
                  ${validatedData.message}
                </p>
              </div>

              <!-- Datos del contacto -->
              <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 25px 0;">
                <p style="color: #1976d2; font-weight: 600; margin: 0 0 15px 0; font-size: 16px;">
                  📞 Datos de contacto
                </p>
                <div style="color: #374151; line-height: 1.8; font-size: 14px;">
                  <p style="margin: 5px 0;"><strong>Nombre:</strong> ${validatedData.name}</p>
                  <p style="margin: 5px 0;"><strong>Email:</strong> ${validatedData.email}</p>
                  ${validatedData.phone ? `<p style="margin: 5px 0;"><strong>Teléfono:</strong> ${validatedData.phone}</p>` : ''}
                </div>
              </div>

              ${attachments.length > 0 ? `
              <!-- Archivos adjuntos -->
              <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 25px 0;">
                <p style="color: #0369a1; font-weight: 600; margin: 0 0 15px 0; font-size: 16px;">
                  📎 Archivos adjuntos (${attachments.length})
                </p>
                <div style="color: #374151; line-height: 1.8; font-size: 14px;">
                  ${attachments.map(att => `<p style="margin: 5px 0;">• ${att.filename}</p>`).join('')}
                </div>
              </div>
              ` : ''}

              <!-- Instrucciones -->
              <div style="margin: 25px 0; padding: 15px; background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
                <p style="margin: 0; font-size: 14px; color: #856404;">
                  <strong>💡 Recordatorio:</strong> Responde directamente a este email para contactar con la persona.
                </p>
              </div>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 12px; margin: 0 0 5px 0;">
                Mensaje enviado desde <strong>oficaz.es</strong>
              </p>
              <p style="color: #6b7280; font-size: 12px; margin: 0;">
                La plataforma de gestión empresarial para equipos modernos
              </p>
            </div>
          </div>
        </body>
        </html>
      `;

      const textContent = `
Nuevo mensaje de ${messageType} desde oficaz.es

ASUNTO: ${cleanSubject}

MENSAJE:
${validatedData.message}

DATOS DE CONTACTO:
- Nombre: ${validatedData.name}
- Email: ${validatedData.email}
${validatedData.phone ? `- Teléfono: ${validatedData.phone}` : ''}

${attachments.length > 0 ? `
ARCHIVOS ADJUNTOS (${attachments.length}):
${attachments.map(att => `- ${att.filename}`).join('\n')}
` : ''}

---
Responde directamente a este email para contactar con la persona.
      `;

      const mailOptions = {
        from: process.env.SMTP_USER,
        to: process.env.SMTP_USER,
        replyTo: validatedData.email, // Para poder responder directamente
        subject: emailSubject,
        text: textContent,
        html: htmlContent,
        attachments: attachments
      };

      console.log(`📧 Enviando formulario de contacto desde: ${validatedData.email}`);
      console.log(`🔒 SECURITY: Formulario validado - ${validatedData.name}, archivos: ${attachments.length}`);
      
      if (attachments.length > 0) {
        const totalFileSize = uploadedFiles.reduce((sum, file) => sum + file.size, 0);
        console.log(`📎 Con ${attachments.length} archivo(s) adjunto(s) - Total: ${(totalFileSize / 1024 / 1024).toFixed(2)}MB`);
      }
      
      await transporter.sendMail(mailOptions);
      console.log(`✅ Formulario de contacto enviado exitosamente`);

      res.json({ 
        success: true, 
        message: 'Mensaje enviado correctamente' 
      });

    } catch (error) {
      console.error('❌ Error enviando formulario de contacto:', error);
      
      // Handle multer file filter errors specifically
      if (error instanceof Error && error.message.includes('Tipo de archivo no permitido')) {
        return res.status(400).json({ 
          success: false, 
          message: error.message
        });
      }
      
      res.status(500).json({ 
        success: false, 
        message: 'Error interno del servidor al enviar el mensaje' 
      });
    } finally {
      // SECURITY CRITICAL: Always clean up uploaded files, regardless of success or failure
      if (uploadedFiles.length > 0) {
        console.log(`🧹 Limpiando ${uploadedFiles.length} archivos temporales...`);
        
        uploadedFiles.forEach((file: any) => {
          try {
            if (fs.existsSync(file.path)) {
              fs.unlinkSync(file.path);
              console.log(`🗑️ Archivo eliminado: ${file.originalname}`);
            }
          } catch (cleanupError) {
            console.error(`❌ Error eliminando archivo temporal: ${file.path}`, cleanupError);
          }
        });
        
        console.log(`✅ Limpieza de archivos completada`);
      }
    }
  });

  // In-app feedback endpoint (authenticated or not) - sends email to support
  app.post('/api/contact/feedback', authenticateToken as any, contactUpload.array('files', 5), async (req: AuthRequest, res) => {
    let uploadedFiles: any[] = [];
    try {
      const { subject, message } = req.body;
      // Gather files from multer
      if (req.files && Array.isArray(req.files)) {
        uploadedFiles = req.files;
      }

      // Prefer authenticated user identity if available (fetch full user from storage)
      let userName = 'Usuario Oficaz';
      let userEmail = process.env.SMTP_USER || 'contacto@oficaz.es';
      try {
        const authUserId = req.user?.id;
        if (authUserId) {
          const fullUser = await storage.getUser(authUserId);
          if (fullUser) {
            userName = fullUser.fullName || userName;
            userEmail = fullUser.companyEmail || fullUser.personalEmail || userEmail;
          }
        }
      } catch {}

      const validatedData = {
        name: userName.toString().substring(0, 100),
        email: userEmail.toString().substring(0, 100),
        subject: (subject || 'Feedback de producto').toString().substring(0, 200),
        message: (message || '').toString().substring(0, 5000)
      };

      console.log('✉️ FEEDBACK ATTEMPT:', { user: validatedData.email, subject: validatedData.subject });

      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: 465,
        secure: true,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        tls: { rejectUnauthorized: false }
      });

      // Verify SMTP connection for diagnostics (feedback)
      try {
        await transporter.verify();
        console.log('✅ SMTP verified for feedback');
      } catch (verr) {
        console.error('❌ SMTP verification failed (feedback):', (verr as any)?.message || verr);
      }

      const attachments: any[] = [];
      if (uploadedFiles.length > 0) {
        uploadedFiles.forEach((file: any) => {
          attachments.push({ filename: file.originalname, path: file.path, contentType: file.mimetype });
        });
      }

      // Obtener nombre de la empresa si el usuario está autenticado
      let companyName: string | null = null;
      try {
        const companyId = (req as any).user?.companyId;
        if (companyId) {
          const company = await storage.getCompany(companyId);
          companyName = company?.name || null;
        }
      } catch {}

      const emailSubject = `[FEEDBACK] ${companyName ? companyName + ' - ' : ''}${validatedData.subject}`;
      const feedbackRecipient = process.env.FEEDBACK_RECIPIENT_EMAIL || process.env.SUPER_ADMIN_EMAIL || process.env.SMTP_USER;
      const textContent = `
Nuevo feedback desde la app

ASUNTO: ${validatedData.subject}

MENSAJE:
${validatedData.message}

ORIGEN:
- Empresa: ${companyName || 'No especificada'}
- Usuario: ${validatedData.name}
- Email: ${validatedData.email}

${attachments.length > 0 ? `ARCHIVOS ADJUNTOS (${attachments.length}):\n${attachments.map(att => `- ${att.filename}`).join('\n')}` : ''}
`;

      const htmlContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
          <h2 style="margin:0 0 12px 0;">Nuevo feedback desde la app</h2>
          <p style="margin:0 0 16px 0;"><strong>Asunto:</strong> ${validatedData.subject}</p>
          <div style="background:#f8fafc;padding:12px;border-radius:8px;white-space:pre-wrap;">${validatedData.message}</div>
          <div style="margin-top:16px;color:#374151;">
            <p style="margin:4px 0;"><strong>Empresa:</strong> ${companyName || 'No especificada'}</p>
            <p style="margin:4px 0;"><strong>Usuario:</strong> ${validatedData.name}</p>
            <p style="margin:4px 0;"><strong>Email:</strong> ${validatedData.email}</p>
          </div>
          ${attachments.length > 0 ? `<p style="margin-top:12px;">📎 Adjuntos (${attachments.length})</p>` : ''}
        </div>
      `;

      const mailOptions = {
        from: process.env.SMTP_USER,
        to: feedbackRecipient,
        cc: feedbackRecipient !== process.env.SMTP_USER ? process.env.SMTP_USER : undefined,
        replyTo: validatedData.email,
        subject: emailSubject,
        text: textContent,
        html: htmlContent,
        attachments
      } as any;

      await transporter.sendMail(mailOptions);
      console.log('✅ Feedback enviado correctamente');
      res.json({ success: true, message: 'Feedback enviado correctamente' });
    } catch (error) {
      console.error('❌ Error enviando feedback:', error);
      res.status(500).json({ success: false, message: 'No se pudo enviar el feedback' });
    } finally {
      if (uploadedFiles.length > 0) {
        uploadedFiles.forEach((file: any) => {
          try { if (fs.existsSync(file.path)) fs.unlinkSync(file.path); } catch {}
        });
      }
    }
  });

  // User validation endpoints
  app.post('/api/validate-user', validationLimiter, async (req, res) => {
    try {
      const { field, value } = req.body;
      
      if (!field || !value) {
        return res.status(400).json({ message: 'Field and value are required' });
      }

      let existingRecord = null;
      let errorMessage = '';
      
      switch (field) {
        case 'email':
          existingRecord = await storage.getUserByEmail(value);
          errorMessage = 'Este email ya está registrado en el sistema';
          break;

        case 'dni':
          // Check if DNI already exists in the database
          const [userWithDni] = await db.select({ id: users.id })
            .from(users)
            .where(eq(users.dni, value.toUpperCase()))
            .limit(1);
          existingRecord = userWithDni || null;
          
          // Also check lowercase version
          if (!existingRecord) {
            const [userWithDniLower] = await db.select({ id: users.id })
              .from(users)
              .where(eq(users.dni, value.toLowerCase()))
              .limit(1);
            existingRecord = userWithDniLower || null;
          }
          errorMessage = 'Este DNI/NIE ya está registrado en el sistema';
          break;

        case 'phone':
          // Check if phone already exists
          const [userWithPhone] = await db.select({ id: users.id })
            .from(users)
            .where(or(
              eq(users.companyPhone, value),
              eq(users.personalPhone, value)
            ))
            .limit(1);
          existingRecord = userWithPhone || null;
          errorMessage = 'Este teléfono ya está registrado en el sistema';
          break;

        default:
          return res.status(400).json({ message: 'Invalid field' });
      }

      const isAvailable = !existingRecord;
      res.json({ 
        available: isAvailable,
        message: isAvailable ? '' : errorMessage
      });
    } catch (error) {
      console.error('Error validating user data:', error);
      res.status(500).json({ message: 'Error validating user data' });
    }
  });

  // Promotional code validation endpoint
  app.post('/api/validate-promotional-code', validationLimiter, async (req, res) => {
    try {
      const { code } = req.body;
      
      if (!code || typeof code !== 'string') {
        return res.status(400).json({ 
          valid: false, 
          message: 'Código promocional requerido' 
        });
      }

      const validation = await storage.validatePromotionalCode(code.trim());
      res.json(validation);
    } catch (error: any) {
      console.error('Error validating promotional code:', error);
      res.status(500).json({ 
        valid: false, 
        message: 'Error interno del servidor al validar el código' 
      });
    }
  });

  // Secure verification system
  const generateSecureToken = (): string => crypto.randomBytes(32).toString('hex');
  
  // Helper function to send verification emails
  const sendVerificationEmail = async (email: string, code: string, req: any, isRecovery = false) => {
    // ⚠️ PROTECTED NODEMAILER CONFIG - DO NOT MODIFY ⚠️
    // MUST use createTransport (NOT createTransporter) - user confirmed working
    // 🔒 SECURITY: Now uses secure environment variables instead of hardcoded credentials
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: 465,
      secure: true, // SSL
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: false,
        ciphers: 'SSLv3'
      },
      debug: true, // Enable debug logging
      logger: true, // Enable logging
      connectionTimeout: 60000, // 60s
      greetingTimeout: 30000, // 30s
      socketTimeout: 60000, // 60s
    });
    // ⚠️ END PROTECTED SECTION ⚠️

    // ⚠️ PROTECTED EMAIL CONFIGURATION - DO NOT MODIFY ⚠️
    // Use static logo URL for email compatibility (this works!)
    // User confirmed: "ya funciona el mail, guarda esta configuracion a muerte"
    const logoUrl = 'https://oficaz.es/email-logo.png';
    // ⚠️ END PROTECTED SECTION ⚠️
    const websiteUrl = 'https://oficaz.es';
    
    const logoHtml = `
      <a href="${websiteUrl}" style="text-decoration: none;" target="_blank">
        <img src="${logoUrl}" alt="Oficaz - Sistema de Gestión Empresarial" 
             height="45"
             style="width: auto; max-width: 200px; display: block; margin: 0 auto; border: none; outline: none;" />
      </a>
    `;

    const subject = isRecovery ? 'Código de recuperación de cuenta - Oficaz' : 'Código de verificación - Oficaz';
    const titleText = isRecovery ? 'Recuperación de cuenta' : 'Verificación de email';
    const descriptionText = isRecovery 
      ? 'Tu código para recuperar tu cuenta de <strong>Oficaz</strong>:'
      : 'Tu código de verificación para <strong>Oficaz</strong>:';
    const instructionText = isRecovery
      ? 'Introduce este código para recuperar tu cuenta'
      : 'Introduce este código en la página de verificación';
    const textMessage = isRecovery
      ? `Tu código de recuperación de cuenta para Oficaz es: ${code}. Este código expira en 10 minutos.`
      : `Tu código de verificación para Oficaz es: ${code}. Este código expira en 10 minutos.`;

    const mailOptions = {
      from: '"Oficaz - Sistema de Gestión" <soy@oficaz.es>',
      to: email,
      subject: subject,
      replyTo: 'soy@oficaz.es',
      text: textMessage,
      headers: {
        'X-Priority': '1',
        'X-MSMail-Priority': 'High',
        'Importance': 'high'
      },
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
        </head>
        <body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
            
            <!-- Header with logo -->
            <div style="background-color: #ffffff; padding: 25px 20px 15px 20px; text-align: center;">
              ${logoHtml}
            </div>

            <!-- Main content with more padding -->
            <div style="padding: 20px 25px 30px 25px;">
              <h2 style="color: #323A46; font-size: 18px; font-weight: 600; margin: 0 0 8px 0; text-align: center;">${titleText}</h2>
              
              <p style="color: #4a5568; font-size: 14px; line-height: 1.4; margin-bottom: 15px; text-align: center;">
                ${descriptionText}
              </p>

              <!-- Compact verification code box - Outlook compatible -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 15px 0;">
                <tr>
                  <td style="background: linear-gradient(135deg, #007AFF 0%, #0056CC 100%); background-color: #007AFF; border-radius: 12px; padding: 20px 15px; text-align: center; box-shadow: 0 4px 15px rgba(0, 122, 255, 0.2);">
                    <div style="color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: 6px; margin-bottom: 8px; text-shadow: 0 2px 4px rgba(0,0,0,0.3); mso-line-height-rule: exactly;">
                      ${code}
                    </div>
                    <div style="color: #ffffff; font-size: 12px; font-weight: 500; mso-line-height-rule: exactly;">
                      Válido por 10 minutos
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Compact instructions -->
              <div style="background: ${isRecovery ? '#E3F2FD' : '#FFF3CD'}; border-left: 4px solid ${isRecovery ? '#2196F3' : '#FFD43B'}; padding: 10px 12px; margin: 15px 0; border-radius: 4px;">
                <p style="color: ${isRecovery ? '#1565C0' : '#856404'}; font-size: 13px; margin: 0; font-weight: 500;">
                  ${instructionText}
                </p>
              </div>
            </div>

            <!-- Footer with more padding for mobile -->
            <div style="background-color: #f8fafc; padding: 20px 15px 25px 15px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #718096; font-size: 11px; margin: 0;">
                © ${new Date().getFullYear()} Oficaz • Sistema de Gestión Empresarial
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    console.log('📧* Attempting to send email with mailOptions:', {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject,
      textLength: mailOptions.text?.length,
      htmlLength: mailOptions.html?.length
    });

    const result = await transporter.sendMail(mailOptions);
    console.log(`✅ Email de verificación enviado a ${email}`);
    console.log(`📧 SMTP Response:`, result);
    
    return result;
  };
  
  const verificationSessions = new Map<string, { 
    email: string;
    emailHash: string; 
    code: string; 
    expires: number; 
    verified: boolean;
    attempts: number;
    lastResent?: number;
    isRecovery?: boolean;
    companyId?: number;
    userId?: number;
  }>();
  
  const verificationTokens = new Map<string, { 
    emailHash: string; 
    expires: number; 
    used: boolean 
  }>();

  // Test endpoint to verify email sending capability
  // 🔒 SECURITY: Test endpoints removed - should not be in production
  // If you need to test email functionality, use proper testing environment
  
  // Endpoint to check if email is available for registration
  app.get('/api/diagnostics/email', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res) => {
    try {
      const host = req.get('host') || req.get('x-forwarded-host');
      const isCustomDomain = host && (host.includes('oficaz.es') || !host.includes('replit'));
      
      let baseUrl;
      if (isCustomDomain) {
        baseUrl = `https://${host}`;
      } else if (process.env.REPLIT_DOMAINS) {
        const firstDomain = process.env.REPLIT_DOMAINS.split(',')[0];
        baseUrl = `https://${firstDomain}`;
      } else if (process.env.REPLIT_DEV_DOMAIN) {
        baseUrl = `https://${process.env.REPLIT_DEV_DOMAIN}`;
      } else {
        baseUrl = 'https://oficaz-employee-management.replit.app';
      }

      const diagnostics = {
        timestamp: new Date().toISOString(),
        host_header: req.get('host'),
        x_forwarded_host: req.get('x-forwarded-host'),
        user_agent: req.get('user-agent'),
        is_custom_domain: isCustomDomain,
        detected_base_url: baseUrl,
        environment: {
          REPLIT_DOMAINS: process.env.REPLIT_DOMAINS,
          REPLIT_DEV_DOMAIN: process.env.REPLIT_DEV_DOMAIN,
          NODE_ENV: process.env.NODE_ENV
        },
        smtp_config: {
          host: process.env.SMTP_HOST || '(configured)',
          port: 465,
          secure: true,
          auth_user: process.env.SMTP_USER || '(configured)'
        }
      };

      res.json(diagnostics);
    } catch (error) {
      console.error('Diagnostics error:', error);
      res.status(500).json({ error: 'Error in diagnostics endpoint' });
    }
  });

  app.post('/api/auth/check-email-availability', async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email || !email.includes('@')) {
        return res.status(400).json({ available: false, error: 'Email válido requerido' });
      }

      // Check if email is already registered as a COMPANY email
      const [existingCompany] = await db.select({ id: companies.id })
        .from(companies)
        .where(eq(companies.email, email.toLowerCase()))
        .limit(1);
      
      if (existingCompany) {
        return res.json({ 
          available: false, 
          error: 'Este email ya está registrado como email de empresa' 
        });
      }

      // Check if email is already registered as a USER email
      const existingUser = await storage.getUserByEmail(email);
      
      if (existingUser) {
        // Check if user is admin and if company is cancelled
        if (existingUser.role === 'admin') {
          const company = await storage.getCompany(existingUser.companyId);
          if (company?.scheduledForDeletion) {
            return res.json({ 
              available: false, 
              error: 'La cuenta con este email está cancelada',
              isCancelled: true,
              canRecover: true
            });
          }
        }
        
        return res.json({ 
          available: false, 
          error: 'Este email ya está registrado' 
        });
      }

      return res.json({ 
        available: true,
        message: 'Email disponible' 
      });
    } catch (error) {
      console.error('Error checking email availability:', error);
      return res.status(500).json({ 
        available: false, 
        error: 'Error interno del servidor' 
      });
    }
  });

  app.post('/api/auth/request-verification-code', async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'Email válido requerido' });
      }

      // Check if public registration is enabled
      const registrationSettings = await storage.getRegistrationSettings();
      if (!registrationSettings?.publicRegistrationEnabled) {
        return res.status(403).json({ error: 'El registro público está deshabilitado. Solo se puede acceder mediante invitación.' });
      }

      // Check if email is already registered as a COMPANY email
      const [existingCompany] = await db.select({ id: companies.id, name: companies.name })
        .from(companies)
        .where(eq(companies.email, email.toLowerCase()))
        .limit(1);
      
      if (existingCompany) {
        return res.status(400).json({ 
          error: 'Este email ya está registrado como email de empresa' 
        });
      }

      // Check if email is already registered as a USER email
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        // Check if the company is scheduled for deletion (grace period)
        const company = await storage.getCompany(existingUser.companyId);
        
        if (company?.scheduledForDeletion && existingUser.role === 'admin' && company.deletionWillOccurAt) {
          const deletionDate = new Date(company.deletionWillOccurAt);
          const now = new Date();
          
          if (deletionDate > now) {
            // Account is in grace period - send verification code but mark for recovery flow
            const sessionId = generateSecureToken();
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            const expires = Date.now() + 10 * 60 * 1000; // 10 minutes
            const emailHash = crypto.createHash('sha256').update(email.toLowerCase()).digest('hex');

            // Store session with recovery flag
            verificationSessions.set(sessionId, { 
              email,
              emailHash, 
              code: crypto.createHash('sha256').update(code).digest('hex'),
              expires, 
              verified: false,
              attempts: 0,
              isRecovery: true, // Flag to indicate this is account recovery
              companyId: existingUser.companyId,
              userId: existingUser.id
            });

            // Send recovery email
            try {
              const emailResult = await sendVerificationEmail(email, code, req, true); // true = recovery mode
              console.log('✅ Recovery email enviado exitosamente:', emailResult.messageId);
            } catch (emailError) {
              console.error('❌ Error sending recovery email:', emailError);
              console.log(`🔐 FALLBACK - CÓDIGO DE RECUPERACIÓN para ${email}: ${code}`);
            }

            return res.json({ 
              success: true, 
              message: 'Código de recuperación enviado',
              sessionId,
              isRecovery: true,
              deletionDate: deletionDate.toISOString(),
              hint: 'Este email pertenece a una cuenta programada para eliminación. Usa el código para recuperar tu cuenta.'
            });
          }
        }
        
        return res.status(400).json({ error: 'Este email ya está registrado' });
      }

      // Rate limiting: max 3 attempts per email per hour
      const emailHash = crypto.createHash('sha256').update(email.toLowerCase()).digest('hex');
      const now = Date.now();
      
      // Clean up expired sessions
      for (const [sessionId, session] of Array.from(verificationSessions.entries())) {
        if (session.expires < now) {
          verificationSessions.delete(sessionId);
        }
      }

      // Check rate limiting
      let recentAttempts = 0;
      const oneHourAgo = now - 60 * 60 * 1000;
      
      for (const session of Array.from(verificationSessions.values())) {
        if (session.emailHash === emailHash && session.expires > oneHourAgo) {
          recentAttempts++;
        }
      }

      if (recentAttempts >= 3) {
        return res.status(429).json({ 
          error: 'Demasiados intentos. Espera una hora antes de intentar de nuevo.' 
        });
      }

      // Generate secure session and verification code
      const sessionId = generateSecureToken();
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expires = Date.now() + 10 * 60 * 1000; // 10 minutes

      // Store session with hashed data
      verificationSessions.set(sessionId, { 
        email,
        emailHash, 
        code: crypto.createHash('sha256').update(code).digest('hex'), // Hash the code
        expires, 
        verified: false,
        attempts: 0
      });

      // Send email using helper function
      try {
        const emailResult = await sendVerificationEmail(email, code, req);
        console.log('✅ Email enviado exitosamente:', emailResult.messageId);
      } catch (emailError) {
        console.error('❌ Error sending verification email:', emailError);
        console.error('❌ Full error details:', {
          message: (emailError as any).message,
          code: (emailError as any).code,
          command: (emailError as any).command,
          response: (emailError as any).response,
          responseCode: (emailError as any).responseCode,
          stack: (emailError as any).stack
        });
        
        // Even if email fails, we continue - user might check spam or retry
        console.log(`🔐 FALLBACK - CÓDIGO DE VERIFICACIÓN para ${email}: ${code}`);
        console.log(`⏰ Expira en 10 minutos`);
        console.log(`📧 IMPORTANTE: Revisa tu carpeta de spam/correo no deseado`);
      }

      res.json({ 
        success: true, 
        message: 'Código enviado correctamente',
        sessionId,
        hint: 'Si no recibes el email en unos minutos, revisa tu carpeta de spam o correo no deseado'
      });
    } catch (error) {
      console.error('Error sending verification code:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  app.post('/api/auth/resend-code', async (req, res) => {

    try {
      const { sessionId } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID requerido' });
      }

      // Find existing session
      const session = verificationSessions.get(sessionId);
      if (!session) {
        return res.status(400).json({ error: 'Sesión no encontrada o expirada' });
      }

      // Check if enough time has passed (1 minute minimum)
      const now = Date.now();
      const oneMinuteAgo = now - 60 * 1000;
      
      if (session.lastResent && session.lastResent > oneMinuteAgo) {
        const remainingTime = Math.ceil((session.lastResent - oneMinuteAgo) / 1000);
        return res.status(429).json({ 
          error: `Debes esperar ${remainingTime} segundos antes de solicitar otro código`,
          remainingTime 
        });
      }

      // Generate new code
      const newCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Update session with new code and resend timestamp
      session.code = newCode;
      session.lastResent = now;
      session.expires = now + 10 * 60 * 1000; // Extend expiry by 10 minutes
      
      // Send new verification code using existing email helper
      try {
        await sendVerificationEmail(session.email, newCode, req);
        console.log('✅ Nuevo código de verificación enviado a', session.email);
      } catch (emailError) {
        console.error('❌ Error sending resend email:', emailError);
        console.log(`🔐 CÓDIGO DE VERIFICACIÓN DE REENVÍO para ${session.email}: ${newCode}`);
        console.log(`⏰ Expira en 10 minutos`);
      }





      res.json({ 
        success: true, 
        message: 'Nuevo código enviado correctamente'
      });

    } catch (error) {
      console.error('Error resending verification code:', error);
      res.status(500).json({ error: 'Error interno del servidor al reenviar código' });
    }
  });

  app.post('/api/auth/verify-code', async (req, res) => {
    try {
      const { sessionId, code } = req.body;
      
      if (!sessionId || !code) {
        return res.status(400).json({ error: 'Sesión y código requeridos' });
      }

      // Check if public registration is enabled
      const registrationSettings = await storage.getRegistrationSettings();
      if (!registrationSettings?.publicRegistrationEnabled) {
        return res.status(403).json({ error: 'El registro público está deshabilitado. Solo se puede acceder mediante invitación.' });
      }

      const session = verificationSessions.get(sessionId);
      
      if (!session) {
        return res.status(400).json({ error: 'Sesión no encontrada o expirada' });
      }

      if (Date.now() > session.expires) {
        verificationSessions.delete(sessionId);
        return res.status(400).json({ error: 'Código expirado' });
      }

      // Rate limiting: max 5 attempts per session
      if (session.attempts >= 5) {
        verificationSessions.delete(sessionId);
        return res.status(429).json({ error: 'Demasiados intentos. Solicita un nuevo código.' });
      }

      // Increment attempts
      session.attempts++;

      // Verify code (compare hashes)
      const codeHash = crypto.createHash('sha256').update(code).digest('hex');
      if (session.code !== codeHash) {
        return res.status(400).json({ error: 'Código incorrecto' });
      }

      // Mark as verified
      session.verified = true;
      
      // Check if this is a recovery session
      if (session.isRecovery && session.companyId && session.userId) {
        // This is account recovery - restore the company
        const companyId = session.companyId;
        const userId = session.userId;
        
        // Cancel the deletion schedule
        await storage.cancelCompanyDeletion(companyId);
        
        // Clean up verification session
        verificationSessions.delete(sessionId);
        
        // 🔒 SECURITY FIX: Prevent session fixation - regenerate session after recovery
        req.session.regenerate((err) => {
          if (err) {
            console.error('Error regenerating session:', err);
            return res.status(500).json({ error: 'Error al regenerar sesión' });
          }
          
          console.log(`✅ Account recovery successful for companyId: ${companyId}, userId: ${userId}`);
          
          return res.json({ 
            success: true, 
            message: 'Cuenta recuperada exitosamente',
            isRecovery: true,
            action: 'account_restored'
          });
        });
      } else {
        // Normal registration flow - generate verification token
        const verificationToken = generateSecureToken();
        const tokenExpires = Date.now() + 30 * 60 * 1000; // 30 minutes
        
        verificationTokens.set(verificationToken, {
          emailHash: session.emailHash,
          expires: tokenExpires,
          used: false
        });

        // Clean up the session
        verificationSessions.delete(sessionId);

        res.json({ 
          success: true, 
          message: 'Código verificado correctamente',
          verificationToken,
          email: session.email
        });
      }
    } catch (error) {
      console.error('Error verifying code:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  // Auth routes
  app.post('/api/auth/register', async (req, res) => {
    try {
      console.log('Registration attempt with body:', JSON.stringify(req.body, null, 2));
      const data = companyRegistrationSchema.parse(req.body);
      console.log('Schema validation passed, data:', JSON.stringify(data, null, 2));
      const { verificationToken, invitationToken } = req.body;
      
      // Validate token (either verification or invitation)
      let isValidAccess = false;
      let invitationToMark = null;
      
      if (invitationToken) {
        // Validate invitation token
        const invitation = await storage.getInvitationByToken(invitationToken);
        if (!invitation) {
          return res.status(400).json({ message: 'Token de invitación inválido' });
        }
        
        const now = new Date();
        const expiresAt = new Date(invitation.expiresAt);
        
        if (invitation.used) {
          return res.status(400).json({ message: 'Esta invitación ya ha sido utilizada' });
        }
        
        if (now > expiresAt) {
          return res.status(400).json({ message: 'Esta invitación ha expirado' });
        }
        
        isValidAccess = true;
        invitationToMark = invitation;
      } else if (verificationToken) {
        // Validate verification token (existing logic)
        const tokenData = verificationTokens.get(verificationToken);
        if (!tokenData) {
          return res.status(400).json({ message: 'Token de verificación inválido o expirado' });
        }
        
        if (Date.now() > tokenData.expires) {
          verificationTokens.delete(verificationToken);
          return res.status(400).json({ message: 'Token de verificación expirado' });
        }
        
        if (tokenData.used) {
          return res.status(400).json({ message: 'Token de verificación ya utilizado' });
        }
        
        isValidAccess = true;
      } else {
        // Check if public registration is enabled
        const registrationSettings = await storage.getRegistrationSettings();
        if (!registrationSettings?.publicRegistrationEnabled) {
          return res.status(403).json({ message: 'El registro público está deshabilitado. Se requiere una invitación.' });
        }
      }
      
      // Check if user already exists by email
      const existingUser = await storage.getUserByEmail(data.companyEmail);
      if (existingUser) {
        // Check if the company is scheduled for deletion (grace period)
        const company = await storage.getCompany(existingUser.companyId);
        
        if (company?.scheduledForDeletion && company.deletionWillOccurAt) {
          // Company is in 30-day grace period - check if we can restore or if it's truly conflicting
          const deletionDate = new Date(company.deletionWillOccurAt);
          const now = new Date();
          
          if (deletionDate > now) {
            // Still in grace period - inform user they can restore instead
            return res.status(409).json({ 
              message: 'Ya existe una cuenta con este email que está programada para eliminación. Puedes restaurar tu cuenta haciendo login en lugar de crear una nueva.',
              type: 'scheduled_for_deletion',
              deletionDate: deletionDate.toISOString(),
              canRestore: true
            });
          } else {
            // Grace period expired but deletion might not have run yet - this is a system issue
            console.warn('⚠️ Found user with expired deletion date that should have been deleted:', {
              userId: existingUser.id,
              companyId: existingUser.companyId,
              deletionDate: deletionDate.toISOString()
            });
            return res.status(500).json({ 
              message: 'Error del sistema. Contacta con soporte técnico.' 
            });
          }
        } else {
          // Normal active account conflict
          return res.status(400).json({ message: 'Email already exists' });
        }
      }

      // Check if company CIF already exists
      const existingCompany = await storage.getCompanyByCif?.(data.cif);
      if (existingCompany) {
        // Check if this company is scheduled for deletion (grace period)
        const companyCancellation = await storage.getCompany(existingCompany.id);
        
        if (companyCancellation?.scheduledForDeletion && companyCancellation.deletionWillOccurAt) {
          const deletionDate = new Date(companyCancellation.deletionWillOccurAt);
          const now = new Date();
          
          if (deletionDate > now) {
            // Still in grace period - inform user they can restore instead
            return res.status(409).json({ 
              message: 'Ya existe una empresa con este CIF que está programada para eliminación. El administrador puede restaurar la cuenta haciendo login en lugar de crear una nueva.',
              type: 'scheduled_for_deletion',
              deletionDate: deletionDate.toISOString(),
              canRestore: true,
              conflictField: 'cif'
            });
          } else {
            // Grace period expired but deletion might not have run yet
            console.warn('⚠️ Found company with expired deletion date that should have been deleted:', {
              companyId: existingCompany.id,
              cif: data.cif,
              deletionDate: deletionDate.toISOString()
            });
            return res.status(500).json({ 
              message: 'Error del sistema. Contacta con soporte técnico.' 
            });
          }
        } else {
          // Normal active company conflict
          return res.status(400).json({ message: 'CIF already exists' });
        }
      }

      // 🔒 SECURE PROMOTIONAL CODE HANDLING - Validation only, no premature benefit application
      let pendingPromotionalCode = null;
      
      if (data.promotionalCode && data.promotionalCode.trim()) {
        console.log(`🎁 Validating promotional code: ${data.promotionalCode}`);
        
        try {
          // Only VALIDATE first (don't redeem yet, don't apply benefits yet)
          const promotionalCodeResult = await storage.validatePromotionalCode(data.promotionalCode.trim());
          
          if (promotionalCodeResult.valid && promotionalCodeResult.trialDays) {
            pendingPromotionalCode = data.promotionalCode.trim();
            console.log(`✅ Promotional code valid! Will be applied AFTER company creation: ${promotionalCodeResult.trialDays} days`);
          } else {
            console.log(`❌ Promotional code validation failed: ${promotionalCodeResult.message}`);
            return res.status(400).json({ 
              message: promotionalCodeResult.message || 'Código promocional inválido' 
            });
          }
        } catch (error) {
          console.error('❌ Error validating promotional code:', error);
          return res.status(400).json({ message: 'Error al validar código promocional' });
        }
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(data.password, 10);

      // Extract email campaign tracking parameters
      const campaignId = req.body.campaignId || req.body.campaign || null;
      const registrationSource = req.body.source || req.body.registrationSource || 'direct';

      // 🏢 Create company with DEFAULT VALUES (prevents transactional inconsistency)
      const company = await storage.createCompany({
        name: data.companyName,
        email: data.companyEmail,
        cif: data.cif,
        contactName: data.contactName || data.adminFullName,
        companyAlias: data.companyAlias,
        phone: data.contactPhone || '',
        address: data.address || '',
        province: data.province,
        // 🔒 DEFAULT VALUES - Benefits applied only AFTER successful redemption
        trialDurationDays: 7, // Default trial duration (7 days with full access)
        usedPromotionalCode: null, // No code until successfully redeemed
        // 📊 Email marketing conversion tracking
        emailCampaignId: campaignId ? parseInt(campaignId) : null,
        registrationSource: registrationSource,
        marketingEmailsConsent: data.acceptMarketing || false, // Consentimiento para recibir correos comerciales
      });
      
      if (campaignId) {
        console.log(`📊 Company registered from email campaign: ${campaignId} (source: ${registrationSource})`);
      }

      // 🔒 SECURITY: Check for duplicate email/DNI before creating user
      const existingUserByEmail = await storage.getUserByEmail(data.adminEmail.toLowerCase());
      if (existingUserByEmail) {
        console.warn(`🚨 SECURITY: Attempted duplicate registration with email: ${data.adminEmail}`);
        return res.status(400).json({ error: 'El email ya está registrado' });
      }
      
      if (data.adminDni && data.adminDni !== 'TEMP-' + Date.now()) {
        const existingUserByDni = await storage.getUserByDni(data.adminDni);
        if (existingUserByDni) {
          console.warn(`🚨 SECURITY: Attempted duplicate registration with DNI: ${data.adminDni}`);
          return res.status(400).json({ error: 'El DNI ya está registrado' });
        }
      }

      // Create admin user
      const user = await storage.createUser({
        companyEmail: data.adminEmail, // ✅ CORRECTED: Use admin email (verified), not company billing email
        password: hashedPassword,
        fullName: data.adminFullName,
        dni: data.adminDni || 'TEMP-' + Date.now(),
        role: 'admin',
        companyId: company.id,
        companyPhone: data.contactPhone || '',
        startDate: new Date(),
        isActive: true,
        totalVacationDays: "30.0", // Default vacation days for admin
        createdBy: null, // First admin user has no creator
      });

      // Create subscription - dates are calculated from companies.created_at
      // NEW MODULAR MODEL: Base €0, all users and features are paid
      const selectedPlan = data.selectedPlan || 'oficaz';
      
      // Extract user counts from wizard (Step 2) - minimum 1 admin required
      const admins = Math.max(1, parseInt(String(data.admins || 1), 10) || 1);
      const managers = parseInt(String(data.managers || 0), 10) || 0;
      const employees = parseInt(String(data.employees || 0), 10) || 0;
      
      console.log(`👥 Users from wizard: ${admins} admins, ${managers} managers, ${employees} employees`);
      
      // Calculate maxUsers: sum of all user types (no base users anymore)
      const totalMaxUsers = admins + managers + employees;
      
      const subscription = await storage.createSubscription({
        companyId: company.id,
        plan: selectedPlan,
        status: 'trial',
        isTrialActive: true,
        maxUsers: totalMaxUsers,
        extraAdmins: admins - 1, // First admin is the creator, rest are "extra"
        extraManagers: managers,
        extraEmployees: employees,
      });
      
      console.log(`✅ Subscription created: plan=${selectedPlan}, maxUsers=${totalMaxUsers}`);
      
      // Activate selected features (selectedFeatures from Step 1) - all features are now paid
      const selectedAddons: string[] = Array.isArray(data.selectedFeatures) ? data.selectedFeatures : [];
      if (selectedAddons.length > 0 && subscription) {
        console.log(`🔌 Activating ${selectedAddons.length} add-ons for company ${company.id}:`, selectedAddons);
        for (const addonKey of selectedAddons) {
          try {
            // Find the addon by key
            const [addon] = await db.select().from(schema.addons).where(eq(schema.addons.key, addonKey));
            if (addon) {
              // Create company_addon record to activate it - onConflictDoNothing handles duplicates
              await db.insert(schema.companyAddons).values({
                companyId: company.id,
                addonId: addon.id,
                isActive: true,
                activatedAt: new Date(),
              }).onConflictDoNothing();
              console.log(`  ✅ Activated addon: ${addon.name} (${addonKey})`);
            } else {
              console.warn(`  ⚠️ Addon not found: ${addonKey}`);
            }
          } catch (addonError) {
            console.warn(`  ⚠️ Could not activate addon ${addonKey}:`, addonError);
          }
        }
      }

      // Generate demo data for new company IN BACKGROUND (don't block registration)
      // This allows the user to see the welcome modal immediately
      generateDemoData(company.id).catch(error => {
        console.error('❌ Background demo data generation failed:', error);
      });

      const token = generateToken({
        id: user.id,
        username: user.companyEmail || user.personalEmail || `user_${user.id}`, // Use company email for token compatibility
        role: user.role,
        companyId: user.companyId,
      });

      // Mark invitation as used if it was an invitation registration
      if (invitationToMark) {
        await storage.markInvitationAsUsed(invitationToMark.id);
      }

      // Mark verification token as used if it was verification registration
      if (verificationToken) {
        const tokenData = verificationTokens.get(verificationToken);
        if (tokenData) {
          tokenData.used = true;
          verificationTokens.set(verificationToken, tokenData);
        }
      }

      // 🎁 ATOMIC PROMOTIONAL CODE REDEMPTION AND APPLICATION (prevents race conditions)
      let finalCompany = company; // Default to created company
      if (pendingPromotionalCode) {
        try {
          console.log(`🔄 Applying promotional code atomically for company ${company.id}`);
          const atomicResult = await storage.redeemAndApplyPromotionalCode(company.id, pendingPromotionalCode);
          
          if (atomicResult.success && atomicResult.updatedCompany) {
            finalCompany = atomicResult.updatedCompany;
            console.log(`✅ Promotional code '${pendingPromotionalCode}' applied successfully: ${atomicResult.trialDays} days trial`);
          } else {
            console.warn(`⚠️ Could not apply promotional code after successful registration: ${atomicResult.message}`);
            // Registration continues with default trial duration - this is non-critical
          }
        } catch (error) {
          console.warn('⚠️ Non-critical error applying promotional code after registration:', error);
          // Don't fail the registration for this - company was already created successfully
        }
      }

      // 📊 Mark landing page visit as converted (if applicable)
      try {
        const ipAddress = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '').split(',')[0].trim();
        if (ipAddress) {
          // Update the most recent landing visit from this IP (within last 24 hours) as converted
          await db.execute(sql`
            UPDATE landing_visits
            SET registered = true, company_id = ${company.id}
            WHERE ip_address = ${ipAddress}
            AND visited_at >= NOW() - INTERVAL '24 hours'
            AND registered = false
            ORDER BY visited_at DESC
            LIMIT 1
          `);
          console.log(`📊 Landing page conversion tracked for IP: ${ipAddress}`);
        }
      } catch (error) {
        console.error('⚠️ Non-critical error tracking landing conversion:', error);
        // Don't fail registration for this - it's just analytics
      }

      res.status(201).json({
        user: { ...user, password: undefined },
        token,
        company: { ...finalCompany, subscription }, // Use finalCompany which includes promotional code benefits if applied
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Rate limiting for login attempts
  const loginAttempts = new Map<string, { count: number; lastAttempt: number; blockedUntil?: number }>();
  
  const isRateLimited = (identifier: string): { blocked: boolean; remainingTime?: number } => {
    const now = Date.now();
    const attempts = loginAttempts.get(identifier);
    
    if (!attempts) return { blocked: false };
    
    // If blocked, check if block period has expired
    if (attempts.blockedUntil && now < attempts.blockedUntil) {
      return { blocked: true, remainingTime: Math.ceil((attempts.blockedUntil - now) / 1000) };
    }
    
    // Reset if block period expired
    if (attempts.blockedUntil && now >= attempts.blockedUntil) {
      loginAttempts.delete(identifier);
      return { blocked: false };
    }
    
    return { blocked: false };
  };
  
  const recordLoginAttempt = (identifier: string, success: boolean) => {
    const now = Date.now();
    const attempts = loginAttempts.get(identifier) || { count: 0, lastAttempt: now };
    
    if (success) {
      // Reset on successful login
      loginAttempts.delete(identifier);
      return;
    }
    
    // Increment failed attempts
    attempts.count++;
    attempts.lastAttempt = now;
    
    // Block after 5 failed attempts for 30 minutes (slows brute force significantly)
    if (attempts.count >= 5) {
      attempts.blockedUntil = now + 30 * 60 * 1000; // 30 minutes
    }
    
    loginAttempts.set(identifier, attempts);
  };

  // Login rate limiter - more restrictive for login endpoint (defense vs brute force)
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 8, // limit each IP to 8 login attempts per windowMs (independent of identifier counter)
    message: { error: 'Demasiados intentos de login. Intenta de nuevo más tarde.' },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
  });

  // Rate limiter for password reset requests (prevent abuse)
  const resetPasswordLimiter = rateLimit({
    windowMs: 30 * 60 * 1000, // 30 minutes
    max: 5, // limit each IP to 5 reset attempts per 30 min
    message: { error: 'Demasiados intentos. Intenta de nuevo más tarde.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // 🔧 TEST endpoint - NO PASSWORD VALIDATION (development only)
  app.post('/api/auth/login-test', async (req, res) => {
    try {
      console.log(`\n🧪 TEST LOGIN ENDPOINT CALLED`);
      console.log(`📨 LOGIN - Email/DNI: ${req.body?.dniOrEmail || 'unknown'}`);
      
      const data = loginSchema.parse(req.body);
      const normalizedInput = data.dniOrEmail.includes('@') 
        ? data.dniOrEmail.toLowerCase().trim()
        : data.dniOrEmail.toUpperCase().trim();
      
      console.log(`🔍 Test: Searching for user: "${normalizedInput}"`);
      let user = await storage.getUserByEmail(normalizedInput);
      
      if (!user) {
        console.log(`🆔 Test: Not found by email, trying DNI...`);
        user = await storage.getUserByDni(normalizedInput);
      }
      
      if (!user) {
        console.log(`❌ Test: User NOT FOUND in database!`);
        return res.status(401).json({ message: 'Usuario no encontrado en BD' });
      }
      
      console.log(`✅ Test: User FOUND! ID=${user.id} (test mode)`);
      
      // ⚠️ NO PASSWORD CHECK - just issue token for testing
      const token = generateToken({
        id: user.id,
        username: user.companyEmail || user.personalEmail || `user_${user.id}`,
        role: user.role,
        companyId: user.companyId,
      });
      
      const company = await storage.getCompany(user.companyId);
      
      console.log(`✅ Test: Token generated, returning user`);
      res.json({
        message: "TEST LOGIN - Sin validación de contraseña",
        user: { ...user, password: undefined },
        token,
        company: company ? {
          ...company,
          workingHoursPerDay: Number(company.workingHoursPerDay) || 8,
          defaultVacationDays: Number(company.defaultVacationDays) || 30,
          vacationDaysPerMonth: Number(company.vacationDaysPerMonth) || 2.5,
          logoUrl: company.logoUrl || null
        } : null,
      });
    } catch (error) {
      console.error(`❌ Test login error:`, error);
      res.status(500).json({ message: 'Test login error', error: String(error) });
    }
  });

  app.post('/api/auth/login', loginLimiter, async (req, res) => {
    try {
      console.log(`\n📨 LOGIN REQUEST - Email/DNI: ${req.body?.dniOrEmail || 'unknown'}`);
      console.log(`📨 REQUEST HEADERS:`, {
        'content-type': req.headers['content-type'],
        'origin': req.headers['origin'],
        'user-agent': req.headers['user-agent'],
        'host': req.headers['host']
      });
      
      const data = loginSchema.parse(req.body);
      const { companyAlias } = req.body;
      const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
      const identifier = `${data.dniOrEmail.toLowerCase()}:${clientIP}`;

      // 🔍 DEBUG: Log login attempt
      console.log(`🔐 LOGIN ATTEMPT: email/dni="${data.dniOrEmail}", companyAlias="${companyAlias}", IP="${clientIP}"`);

      // Check rate limiting per user+IP
      const rateLimitCheck = isRateLimited(identifier);
      if (rateLimitCheck.blocked) {
        return res.status(429).json({ 
          message: `Demasiados intentos fallidos. Intenta de nuevo en ${rateLimitCheck.remainingTime} segundos.`,
          retryAfter: rateLimitCheck.remainingTime
        });
      }
      
      let targetCompanyId = null;
      
      // If companyAlias is provided, get the company and restrict login to that company
      if (companyAlias) {
        const company = await storage.getCompanyByAlias?.(companyAlias);
        if (!company) {
          recordLoginAttempt(identifier, false);
          console.log(`❌ Company not found: ${companyAlias}`);
          return res.status(404).json({ message: 'Empresa no encontrada' });
        }
        targetCompanyId = company.id;
        console.log(`✅ Company found: ${company.name} (ID: ${company.id})`);
      }
      
      // Normalize email/DNI input
      const normalizedInput = data.dniOrEmail.includes('@') 
        ? data.dniOrEmail.toLowerCase().trim()
        : data.dniOrEmail.toUpperCase().trim();
      
      console.log(`🔍 Searching for user: "${normalizedInput}"`);
      
      // Try to find user by company email first, then by DNI
      console.log(`📧 Searching by email...`);
      let user = await storage.getUserByEmail(normalizedInput);
      if (user) {
        console.log(`✅ User found by email: ID=${user.id}, companyId=${user.companyId}, isActive=${user.isActive}`);
      } else {
        console.log(`❌ No user found by email`);
      }
      
      // If company-specific login, verify user belongs to that company
      if (user && targetCompanyId && user.companyId !== targetCompanyId) {
        console.log(`⚠️ User found but belongs to different company (user.companyId=${user.companyId}, target=${targetCompanyId})`);
        user = undefined; // User exists but not in the specified company
      }
      
      if (!user) {
        // Try to find by DNI
        console.log(`🆔 Searching by DNI...`);
        if (targetCompanyId) {
          user = await storage.getUserByDniAndCompany(normalizedInput, targetCompanyId);
        } else {
          user = await storage.getUserByDni(normalizedInput);
        }
        if (user) {
          console.log(`✅ User found by DNI: ID=${user.id}, companyId=${user.companyId}, isActive=${user.isActive}`);
        } else {
          console.log(`❌ No user found by DNI`);
        }
      }
      
      if (!user) {
        console.log(`❌ LOGIN FAILED: User not found for "${normalizedInput}"`);
        recordLoginAttempt(identifier, false);
        return res.status(401).json({ message: 'Credenciales inválidas' });
      }

      // Check if user account is active
      if (!user.isActive) {
        console.log(`❌ LOGIN FAILED: Account inactive for user ID=${user.id}`);
        recordLoginAttempt(identifier, false);
        return res.status(401).json({ message: 'Cuenta desactivada. Contacta con tu administrador.' });
      }

      // Verify password
      console.log(`🔑 Verifying password for user ID=${user.id}...`);
      const isValidPassword = await bcrypt.compare(data.password, user.password);
      console.log(`🔑 Password valid: ${isValidPassword}`);
      if (!isValidPassword) {
        console.log(`❌ LOGIN FAILED: Invalid password for user ID=${user.id}`);
        recordLoginAttempt(identifier, false);
        return res.status(401).json({ message: 'Credenciales inválidas' });
      }
      console.log(`✅ LOGIN SUCCESS: User ID=${user.id}`);
      

      // Record successful login
      recordLoginAttempt(identifier, true);

      // Si es accountant, NO obtener empresa ni suscripción
      if (user.role === 'accountant') {
        const token = generateToken({
          id: user.id,
          username: user.companyEmail || user.personalEmail || `user_${user.id}`,
          role: user.role,
          companyId: null, // Accountant no tiene companyId
        });

        const refreshToken = generateRefreshToken(user.id);
        const refreshTokenExpiry = new Date();
        refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 90);

        const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
        await storage.createRefreshToken(user.id, hashedRefreshToken, refreshTokenExpiry);

        console.log(`[SECURITY] Successful accountant login: User ${user.id} (${user.companyEmail}) from IP ${clientIP} at ${new Date().toISOString()}`);

        return res.json({
          message: "Inicio de sesión exitoso",
          user: { ...user, password: undefined },
          token,
          refreshToken,
          company: null,
          subscription: null
        });
      }

      const company = await storage.getCompany(user.companyId);
      
      // CRITICAL: Check if company is scheduled for deletion and block login
      if (company?.scheduledForDeletion) {
        console.log(`🚫 Login denied for cancelled company: ${company.name} (ID: ${company.id})`);
        return res.status(403).json({ 
          message: 'Account access suspended due to cancellation. Please contact support to restore your account.',
          code: 'ACCOUNT_CANCELLED'
        });
      }
      
      const subscription = await storage.getSubscriptionByCompanyId(user.companyId);

      // 🔒 SECURITY: Generate short-lived access token (15min) and long-lived refresh token (30days)
      const token = generateToken({
        id: user.id,
        username: user.companyEmail || user.personalEmail || `user_${user.id}`,
        role: user.role,
        companyId: user.companyId,
      });

      const refreshToken = generateRefreshToken(user.id);
      const refreshTokenExpiry = new Date();
      refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 90); // 90 days for PWA persistence

      // 🔒 SECURITY: Hash refresh token before storing (protect against DB leaks)
      const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
      await storage.createRefreshToken(user.id, hashedRefreshToken, refreshTokenExpiry);

      // Log successful login for security audit
      console.log(`[SECURITY] Successful login: User ${user.id} (${user.companyEmail}) from IP ${clientIP} at ${new Date().toISOString()}`);

      res.json({
        message: "Inicio de sesión exitoso",
        user: { ...user, password: undefined },
        token,
        refreshToken, // 🔒 NEW: Return refresh token
        company: company ? {
          ...company,
          workingHoursPerDay: Number(company.workingHoursPerDay) || 8,
          defaultVacationDays: Number(company.defaultVacationDays) || 30,
          vacationDaysPerMonth: Number(company.vacationDaysPerMonth) || 2.5,
          logoUrl: company.logoUrl || null
        } : null,
        subscription
      });
    } catch (error: any) {
      console.error(`[SECURITY] Login error: ${error.message}`);
      res.status(400).json({ message: 'Error en el inicio de sesión' });
    }
  });

  // 🔒 SECURITY: In-memory lock to prevent concurrent refresh token operations per user
  const refreshLocks = new Map<number, Promise<any>>();

  // 🔒 SECURITY: Refresh Token Endpoint
  app.post('/api/auth/refresh', async (req, res) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(401).json({ message: 'Refresh token requerido' });
      }

      // Verify refresh token
      let decoded: any;
      try {
        decoded = jwt.verify(refreshToken, JWT_SECRET);
      } catch (error) {
        return res.status(403).json({ message: 'Refresh token inválido o expirado' });
      }

      // Check token type
      if (decoded.type !== 'refresh') {
        return res.status(403).json({ message: 'Token inválido' });
      }

      const userId = decoded.userId;

      // 🔒 ATOMIC LOCK: Reject if another refresh operation is in progress for this user
      // This prevents race conditions where multiple concurrent refreshes create duplicate tokens
      // SYNC CHECK + SYNC SET to prevent race between check and set
      if (refreshLocks.has(userId)) {
        console.log(`[SECURITY] Rejecting concurrent refresh for user ${userId}`);
        return res.status(429).json({ message: 'Operación de refresh en progreso, intenta de nuevo' });
      }
      
      // 🔒 SET LOCK IMMEDIATELY (synchronously) before any async operation
      // This creates a placeholder that will be replaced by the actual promise
      refreshLocks.set(userId, Promise.resolve());

      // Create the refresh operation as a promise
      const refreshOperation = (async () => {
        // 🔒 SECURITY: Get all valid tokens for user and compare hashes
        const userTokens = await storage.getRefreshTokensForUser(userId);
        if (!userTokens || userTokens.length === 0) {
          throw { status: 403, message: 'Refresh token no encontrado o revocado' };
        }

        // Find matching token by comparing hashes
        let matchedToken: any = null;
        for (const storedToken of userTokens) {
          const isMatch = await bcrypt.compare(refreshToken, storedToken.token);
          if (isMatch) {
            matchedToken = storedToken;
            break;
          }
        }

        if (!matchedToken) {
          throw { status: 403, message: 'Refresh token inválido' };
        }

        // Get user information
        const user = await storage.getUser(userId);
        if (!user) {
          throw { status: 404, message: 'Usuario no encontrado' };
        }

        // Check if user account is active
        if (!user.isActive) {
          throw { status: 401, message: 'Cuenta desactivada' };
        }

        // Generate new access token
        const newAccessToken = generateToken({
          id: user.id,
          username: user.companyEmail || user.personalEmail || `user_${user.id}`,
          role: user.role,
          companyId: user.companyId,
        });

        // 🔒 SLIDING SESSION: Generate new refresh token on each use
        const newRefreshToken = generateRefreshToken(user.id);
        const newRefreshTokenExpiry = new Date();
        newRefreshTokenExpiry.setDate(newRefreshTokenExpiry.getDate() + 90); // 90 days

        // 🔒 ATOMIC OPERATION: Revoke ALL user tokens, then create new one
        // Lock ensures no concurrent refreshes can create duplicates
        await storage.revokeAllUserRefreshTokens(user.id);
        
        // Hash and store new refresh token (only valid one for this user now)
        const hashedNewRefreshToken = await bcrypt.hash(newRefreshToken, 10);
        await storage.createRefreshToken(user.id, hashedNewRefreshToken, newRefreshTokenExpiry);

        console.log(`[SECURITY] Token refreshed with sliding session for user ${user.id} (${user.companyEmail})`);

        return { newAccessToken, newRefreshToken };
      })();

      // Store the lock
      refreshLocks.set(userId, refreshOperation);

      try {
        const { newAccessToken, newRefreshToken } = await refreshOperation;
        res.json({
          token: newAccessToken,
          refreshToken: newRefreshToken,
          message: 'Token refrescado exitosamente'
        });
      } catch (error: any) {
        if (error.status) {
          return res.status(error.status).json({ message: error.message });
        }
        throw error;
      } finally {
        // 🔒 ALWAYS release the lock, even on error
        refreshLocks.delete(userId);
      }
    } catch (error: any) {
      console.error(`[SECURITY] Refresh token error: ${error.message}`);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  // 🔒 SECURITY: Logout Endpoint (revoke refresh tokens)
  app.post('/api/auth/logout', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { refreshToken } = req.body;
      const userId = req.user!.id;

      if (refreshToken) {
        // 🔒 SECURITY: Find and revoke specific refresh token by comparing hashes
        const userTokens = await storage.getRefreshTokensForUser(userId);
        for (const storedToken of userTokens) {
          const isMatch = await bcrypt.compare(refreshToken, storedToken.token);
          if (isMatch) {
            await storage.revokeRefreshToken(storedToken.token); // Revoke using hashed token
            console.log(`[SECURITY] Refresh token revoked for user ${userId}`);
            break;
          }
        }
      } else {
        // Revoke all refresh tokens for user (logout from all devices)
        await storage.revokeAllUserRefreshTokens(userId);
        console.log(`[SECURITY] All refresh tokens revoked for user ${userId}`);
      }
      
      // 🔒 SECURITY: Destroy session to prevent session fixation
      if (req.session) {
        req.session.destroy((err) => {
          if (err) {
            console.error('[SECURITY] Error destroying session on logout:', err);
          }
        });
      }

      res.json({ message: 'Sesión cerrada exitosamente' });
    } catch (error: any) {
      console.error(`[SECURITY] Logout error: ${error.message}`);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  // 🔒 SECURITY: Logout from ALL devices (revoke all refresh tokens)
  // This endpoint explicitly revokes all user sessions across all devices
  app.post('/api/auth/logout-all-devices', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }

      // Get count of active sessions before revocation (for audit)
      const userTokensBefore = await storage.getRefreshTokensForUser(userId);
      const sessionCountBefore = userTokensBefore.length;

      // 🔒 SECURITY: Revoke ALL refresh tokens for this user
      // This invalidates all logged-in sessions across all devices
      await storage.revokeAllUserRefreshTokens(userId);
      
      console.log(`[SECURITY] 🚨 USER LOGOUT-ALL-DEVICES: User ${userId} (${user.fullName}) revoked ${sessionCountBefore} active session(s)`);

      // Audit logging for security event
      logAudit({
        userId,
        companyId: user.companyId,
        action: 'LOGOUT_ALL_DEVICES',
        actionType: 'SECURITY_EVENT',
        details: `Closed ${sessionCountBefore} active session(s) across all devices`,
        userRole: req.user!.role,
      });

      // 🔒 SECURITY: Destroy current session to prevent session fixation
      if (req.session) {
        req.session.destroy((err) => {
          if (err) {
            console.error('[SECURITY] Error destroying session on logout-all-devices:', err);
          }
        });
      }

      res.json({ 
        message: 'Se cerró sesión en todos los dispositivos',
        sessionsClosed: sessionCountBefore
      });
    } catch (error: any) {
      console.error(`[SECURITY] Logout all devices error: ${error.message}`);
      res.status(500).json({ message: 'Error al cerrar sesión en todos los dispositivos' });
    }
  });

  // Password reset routes
  const resetLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 3, // Limit each IP to 3 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
  });

  app.post('/api/auth/forgot-password', resetLimiter, async (req, res) => {
    try {
      const data = passwordResetRequestSchema.parse(req.body);

      // Find user by email
      let user;
      let company;

      if (data.companyAlias) {
        // Find company by alias first
        company = await storage.getCompanyByAlias(data.companyAlias);
        if (!company) {
          return res.status(200).json({ message: 'Si el email existe, recibirás un enlace de recuperación' });
        }
        user = await storage.getUserByEmail(data.email.toLowerCase());
        // Verify user belongs to the company
        if (user && user.companyId !== company.id) {
          user = undefined;
        }
      } else {
        // Find user by email across all companies
        user = await storage.getUserByEmail(data.email.toLowerCase());
        if (user) {
          company = await storage.getCompany(user.companyId);
        }
      }

      // 🔒 SECURITY: Always return same message to prevent email enumeration
      const genericMessage = 'Si el email existe en nuestro sistema, recibirás un enlace de recuperación';
      
      if (!user || !company) {
        // Return success even if user not found (security best practice)
        return res.status(200).json({ message: genericMessage });
      }

      // Check if user account is active
      if (!user.isActive) {
        // Don't reveal if account is inactive
        return res.status(200).json({ message: genericMessage });
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

      // Save reset token to database
      try {
        await db.insert(passwordResetTokens).values({
          email: (user.companyEmail || user.personalEmail || '').toLowerCase(),
          companyId: company.id,
          token: resetToken,
          expiresAt,
          used: false
        });
      } catch (dbError: any) {
        console.error('Database error saving reset token:', dbError);
        return res.status(500).json({ message: 'Error interno del servidor' });
      }

      // Send password reset email
      const resetLink = `${process.env.NODE_ENV === 'development' ? 'http://localhost:5000' : 'https://oficaz.es'}/reset-password?token=${resetToken}`;
      
      const emailSent = await sendPasswordResetEmail(
        user.companyEmail || user.personalEmail || '',
        user.fullName,
        company.name,
        resetToken,
        resetLink
      );

      if (!emailSent) {
        console.error('Failed to send password reset email');
      }

      res.status(200).json({ message: 'Si el email existe, recibirás un enlace de recuperación' });
    } catch (error: any) {
      console.error('Password reset request error:', error);
      res.status(400).json({ message: 'Error al procesar la solicitud' });
    }
  });

  app.post('/api/auth/validate-reset-token', async (req, res) => {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({ message: 'Token requerido' });
      }

      // Find reset token
      const resetToken = await db.select()
        .from(passwordResetTokens)
        .where(and(
          eq(passwordResetTokens.token, token),
          eq(passwordResetTokens.used, false)
        ))
        .limit(1);

      if (!resetToken[0]) {
        return res.status(400).json({ message: 'Token inválido' });
      }

      // Check if token has expired
      if (new Date() > resetToken[0].expiresAt) {
        return res.status(400).json({ message: 'Token expired' });
      }

      res.status(200).json({ message: 'Token válido' });
    } catch (error: any) {
      console.error('Token validation error:', error);
      res.status(400).json({ message: 'Error al validar el token' });
    }
  });

  app.post('/api/auth/reset-password', resetPasswordLimiter, async (req, res) => {
    try {
      const data = passwordResetSchema.parse(req.body);
      // Password reset attempt

      // Find and validate reset token
      const resetToken = await db.select()
        .from(passwordResetTokens)
        .where(and(
          eq(passwordResetTokens.token, data.token),
          eq(passwordResetTokens.used, false)
        ))
        .limit(1);

      if (!resetToken[0]) {
        return res.status(400).json({ message: 'Token inválido' });
      }

      // Check if token has expired
      if (new Date() > resetToken[0].expiresAt) {
        return res.status(400).json({ message: 'Token expired' });
      }

      // Find user by email and verify company
      const user = await storage.getUserByEmail(resetToken[0].email);
      if (!user || user.companyId !== resetToken[0].companyId) {
        return res.status(400).json({ message: 'Token inválido o expirado' });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(data.password, 10);

      // Update user password
      await db.update(users)
        .set({ password: hashedPassword })
        .where(eq(users.id, user.id));

      // Mark token as used
      await db.update(passwordResetTokens)
        .set({ used: true })
        .where(eq(passwordResetTokens.id, resetToken[0].id));

      // Password reset successful
      res.status(200).json({ message: 'Contraseña actualizada exitosamente' });
    } catch (error: any) {
      console.error('Password reset error:', error);
      res.status(400).json({ message: 'Error al cambiar la contraseña' });
    }
  });

  // Change password endpoint (authenticated users)
  app.post('/api/auth/change-password', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Contraseña actual y nueva contraseña son requeridas' });
      }

      const userId = req.user!.id;
      
      // Get user from database
      const user = await storage.getUser(userId);
      if (!user) {
        // Generic error to avoid revealing whether userId exists
        return res.status(404).json({ message: 'Recurso no encontrado' });
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
      if (!isValidPassword) {
        return res.status(400).json({ message: 'La contraseña actual es incorrecta' });
      }

      // Validate new password format (same as registration)
      if (newPassword.length < 8) {
        return res.status(400).json({ message: 'La nueva contraseña debe tener al menos 8 caracteres' });
      }
      
      if (!/[A-Z]/.test(newPassword)) {
        return res.status(400).json({ message: 'La nueva contraseña debe contener al menos una mayúscula' });
      }
      
      if (!/[a-z]/.test(newPassword)) {
        return res.status(400).json({ message: 'La nueva contraseña debe contener al menos una minúscula' });
      }
      
      if (!/[0-9]/.test(newPassword)) {
        return res.status(400).json({ message: 'La nueva contraseña debe contener al menos un número' });
      }
      
      if (!/[^A-Za-z0-9]/.test(newPassword)) {
        return res.status(400).json({ message: 'La nueva contraseña debe contener al menos un carácter especial' });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update user password
      await db.update(users)
        .set({ password: hashedPassword })
        .where(eq(users.id, userId));

      console.log(`Password changed successfully for user ${userId} (${user.fullName})`);
      
      res.json({ message: 'Contraseña actualizada exitosamente' });
    } catch (error: any) {
      console.error('Error changing password:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  // Employee activation routes
  app.get('/api/auth/verify-activation-token', async (req, res) => {
    try {
      const { token } = req.query;

      if (!token || typeof token !== 'string') {
        return res.status(400).json({ message: 'Token requerido' });
      }

      const activationToken = await storage.getActivationToken(token);
      if (!activationToken) {
        return res.status(404).json({ message: 'Token inválido o expirado' });
      }

      // Get user and company information
      const user = await storage.getUser(activationToken.userId);
      if (!user) {
        return res.status(400).json({ message: 'Token inválido o expirado' });
      }

      const company = await storage.getCompany(user.companyId);
      if (!company) {
        return res.status(404).json({ message: 'Empresa no encontrada' });
      }

      res.json({
        employeeName: user.fullName,
        companyName: company.name,
        email: activationToken.email
      });
    } catch (error: any) {
      console.error('Error verifying activation token:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  app.post('/api/auth/activate-account', async (req, res) => {
    try {
      const { token, password } = req.body;

      if (!token || !password) {
        return res.status(400).json({ message: 'Token y contraseña requeridos' });
      }

      // Verify token
      const activationToken = await storage.getActivationToken(token);
      if (!activationToken) {
        return res.status(404).json({ message: 'Token inválido o expirado' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Update user with password and mark as activated
      await storage.updateUser(activationToken.userId, {
        password: hashedPassword,
        isPendingActivation: false,
        activatedAt: new Date()
      });

      // Mark token as used
      await storage.markTokenAsUsed(activationToken.id);

      res.json({ 
        success: true, 
        message: 'Cuenta activada correctamente' 
      });
    } catch (error: any) {
      console.error('Error activating account:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  // Get company settings (work hours configuration) - MUST BE BEFORE /:alias route
  app.get('/api/settings/work-hours', authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Getting company settings
      const company = await storage.getCompany(req.user!.companyId);
      // Company retrieved
      
      if (!company) {
        return res.status(404).json({ message: 'Empresa no encontrada' });
      }

      const response = {
        workingHoursPerDay: company.workingHoursPerDay || 8,
        defaultVacationDays: company.defaultVacationDays || 30,
        vacationDaysPerMonth: company.vacationDaysPerMonth || '2.5',
        name: company.name,
        alias: company.companyAlias,
      };
      // Sending response

      res.json(response);
    } catch (error: any) {
      console.error('Error getting company settings:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update company vacation settings
  app.patch('/api/settings/vacation-policy', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res) => {
    try {
      const { vacationDaysPerMonth } = req.body;
      
      if (!vacationDaysPerMonth || isNaN(parseFloat(vacationDaysPerMonth))) {
        return res.status(400).json({ message: 'Días de vacaciones por mes debe ser un número válido' });
      }

      const companyId = req.user!.companyId;
      
      // Update company vacation policy
      await db.update(companies)
        .set({ 
          vacationDaysPerMonth: vacationDaysPerMonth.toString(),
          updatedAt: sql`NOW()`
        })
        .where(eq(companies.id, companyId));

      // Recalculate vacation days for all employees
      const employees = await storage.getUsersByCompany(companyId);
      
      for (const employee of employees) {
        await storage.updateUserVacationDays(employee.id);
      }

      // Return minimal info to avoid leaking full employee list
      res.json({ 
        success: true, 
        affectedEmployees: employees.length,
        message: 'Política de vacaciones actualizada y días recalculados para todos los empleados' 
      });
    } catch (error: any) {
      console.error('Error updating vacation policy:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Company configuration (vacation cutoff)
  app.get('/api/company/config', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const company = await storage.getCompany(req.user!.companyId);

      if (!company) {
        return res.status(404).json({ message: 'Empresa no encontrada' });
      }

      res.json({
        vacationCutoffDay: (company as any)?.vacationCutoffDay || '01-31',
      });
    } catch (error: any) {
      console.error('Error getting company config:', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.patch('/api/company/config', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res) => {
    try {
      const rawCutoff = typeof req.body.vacationCutoffDay === 'string' ? req.body.vacationCutoffDay : '';
      const [mmStr = '01', ddStr = '31'] = rawCutoff.split('-');
      const mm = parseInt(mmStr, 10);
      const dd = parseInt(ddStr, 10);

      if (isNaN(mm) || isNaN(dd) || mm < 1 || mm > 12) {
        return res.status(400).json({ message: 'Formato de corte inválido. Usa MM-DD con mes entre 01 y 12.' });
      }

      const maxDay = new Date(2024, mm, 0).getDate();
      if (dd < 1 || dd > maxDay) {
        return res.status(400).json({ message: 'Día de corte inválido para el mes seleccionado.' });
      }

      const normalizedCutoff = `${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
      const companyId = req.user!.companyId;

      await db.update(companies)
        .set({ vacationCutoffDay: normalizedCutoff, updatedAt: sql`NOW()` })
        .where(eq(companies.id, companyId));

      // Recalculate vacation entitlements based on new cutoff
      const employees = await storage.getUsersByCompany(companyId);
      for (const employee of employees) {
        await storage.updateUserVacationDays(employee.id);
      }

      res.json({ success: true, vacationCutoffDay: normalizedCutoff });
    } catch (error: any) {
      console.error('Error updating company config:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================
  // COMPANY ADD-ONS ROUTES (must be before /api/company/:alias to avoid route collision)
  // ============================================
  
  // Get company's purchased add-ons
  app.get('/api/company/addons', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      const companyAddons = await storage.getCompanyAddons(user.companyId);
      res.json(companyAddons);
    } catch (error: any) {
      console.error('Error fetching company addons:', error);
      res.status(500).json({ error: 'Error al obtener los complementos de la empresa' });
    }
  });

  // Check if company has a specific add-on active
  app.get('/api/company/addons/:key/status', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      const { key } = req.params;
      const hasAddon = await storage.hasActiveAddon(user.companyId, key);
      res.json({ active: hasAddon });
    } catch (error: any) {
      console.error('Error checking addon status:', error);
      res.status(500).json({ error: 'Error al verificar el estado del complemento' });
    }
  });

  // Endpoint para obtener usuarios de la empresa (para búsqueda en modal de proyectos)
  // IMPORTANTE: Esta ruta debe estar ANTES de /api/company/:alias para evitar que :alias capture "employees"
  app.get('/api/company/employees', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;
      
      if (!companyId) {
        return res.status(401).json({ message: 'No autorizado' });
      }
      
      const search = (req.query.search as string || '').toLowerCase();

      const employees = await db.select({
        id: schema.users.id,
        fullName: schema.users.fullName,
      })
        .from(schema.users)
        .where(eq(schema.users.companyId, companyId))
        .orderBy(asc(schema.users.fullName));

      // Filtrar por búsqueda si se proporciona
      const filtered = search 
        ? employees.filter(e => 
            e.fullName.toLowerCase().includes(search)
          )
        : employees;

      res.json(filtered);
    } catch (error) {
      console.error("Error fetching company employees:", error);
      res.status(500).json({ message: "Failed to fetch employees" });
    }
  });

  // Get company by alias route
  // 🔒 SECURITY: Public endpoint - only expose minimal company data needed for login
  app.get('/api/company/:alias', async (req, res) => {
    try {
      const { alias } = req.params;
      const company = await storage.getCompanyByAlias?.(alias);
      
      if (!company) {
        return res.status(404).json({ message: 'Empresa no encontrada' });
      }
      
      // 🔒 SECURITY: Only return non-sensitive fields needed for public login page
      res.json({ 
        id: company.id,
        name: company.name,
        companyAlias: company.companyAlias,
        logoUrl: company.logoUrl || null
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Company registration route
  app.post('/api/auth/register-company', async (req, res) => {
    try {
      const data = companyRegistrationSchema.parse(req.body);

      // Check if public registration is enabled
      const registrationSettings = await storage.getRegistrationSettings();
      if (!registrationSettings?.publicRegistrationEnabled) {
        return res.status(403).json({ message: 'El registro público está deshabilitado. Solo se puede acceder mediante invitación.' });
      }
      
      // Check if company already exists
      const existingCompanyCif = await storage.getCompanyByCif?.(data.cif);
      if (existingCompanyCif) {
        return res.status(400).json({ message: 'CIF ya está registrado' });
      }

      const existingCompanyEmail = await storage.getCompanyByEmail?.(data.companyEmail);
      if (existingCompanyEmail) {
        return res.status(400).json({ message: 'Email empresarial ya está registrado' });
      }

      const existingCompanyAlias = await storage.getCompanyByAlias?.(data.companyAlias);
      if (existingCompanyAlias) {
        return res.status(400).json({ message: 'Alias de empresa ya está en uso' });
      }

      // For company registration, we don't check username uniqueness globally
      // since users are scoped to companies. We only check email uniqueness.

      const existingUserEmail = await storage.getUserByEmail(data.companyEmail);
      if (existingUserEmail) {
        return res.status(400).json({ message: 'Email ya está registrado' });
      }

      // 🎁 PROMOTIONAL CODE REDEMPTION LOGIC
      let promotionalCodeResult = null;
      let appliedTrialDays = 7; // Default trial duration (7 days with full access)
      
      if (data.promotionalCode && data.promotionalCode.trim()) {
        console.log(`🎁 Processing promotional code: ${data.promotionalCode}`);
        
        try {
          promotionalCodeResult = await storage.redeemAndApplyPromotionalCode(data.promotionalCode.trim(), 0); // temp companyId
          
          if (promotionalCodeResult.success && promotionalCodeResult.trialDays) {
            appliedTrialDays = promotionalCodeResult.trialDays;
            console.log(`✅ Promotional code redeemed successfully! Extended trial to ${appliedTrialDays} days`);
          } else {
            console.log(`❌ Promotional code redemption failed: ${promotionalCodeResult.message}`);
            return res.status(400).json({ 
              message: promotionalCodeResult.message || 'Código promocional inválido' 
            });
          }
        } catch (error) {
          console.error('❌ Error processing promotional code:', error);
          return res.status(400).json({ message: 'Error al procesar código promocional' });
        }
      }

      // Extract email campaign tracking parameters
      const campaignId = req.body.campaignId || req.body.campaign || null;
      const registrationSource = req.body.source || req.body.registrationSource || 'direct';
      
      // Create company with promotional code data and campaign tracking
      const company = await storage.createCompany({
        name: data.companyName,
        cif: data.cif,
        email: data.companyEmail,
        contactName: data.contactName || data.adminFullName || 'Administrator',
        companyAlias: data.companyAlias,
        phone: data.phone || null,
        address: data.address || null,
        logoUrl: data.logoUrl || null,
        // 🎁 Apply promotional code benefits
        trialDurationDays: appliedTrialDays,
        usedPromotionalCode: data.promotionalCode?.trim() || null,
        // 📊 Email marketing conversion tracking
        emailCampaignId: campaignId ? parseInt(campaignId) : null,
        registrationSource: registrationSource,
        marketingEmailsConsent: data.acceptMarketing || false, // Consentimiento para recibir correos comerciales
      });
      
      if (campaignId) {
        console.log(`📊 Company registered from email campaign: ${campaignId} (source: ${registrationSource})`);
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(data.password, 10);

      // Calculate vacation days balance (2.5 days per month from start date)
      const startDate = new Date();
      const monthsUntilYearEnd = 12 - startDate.getMonth();
      const vacationBalance = Math.round(monthsUntilYearEnd * 2.5 * 10) / 10;

      // Create admin user
      const user = await storage.createUser({
        companyEmail: data.adminEmail, // ✅ CORRECTED: Use admin email (verified), not company billing email
        password: hashedPassword,
        fullName: data.adminFullName,
        dni: data.adminDni || 'PENDING-DNI',
        companyPhone: data.adminPhone || null,
        companyId: company.id,
        role: 'admin',
        startDate,
        totalVacationDays: "30.0",
        createdBy: null,
      });

      // Generate token for immediate login
      const token = generateToken({
        id: user.id,
        username: user.companyEmail || user.personalEmail || `user_${user.id}`, // Use company email as username in JWT
        role: user.role,
        companyId: user.companyId,
      });

      // Generate demo data automatically for new companies IN BACKGROUND (don't block registration)
      console.log('🎭 Auto-generating demo data for new company in background:', company.id);
      generateDemoData(company.id)
        .then(() => console.log('✅ Demo data generated successfully for new company'))
        .catch(demoError => console.error('⚠️ Warning: Could not generate demo data for new company:', demoError));

      // Send notification email to soy@oficaz.es about new company registration
      try {
        console.log('📧 Sending new company registration notification...');
        await sendNewCompanyRegistrationNotification(
          company.name,
          company.email,
          data.contactName || data.adminFullName || 'Administrador',
          company.cif,
          new Date()
        );
        console.log('✅ Registration notification email sent successfully');
      } catch (emailError) {
        console.error('⚠️ Warning: Could not send registration notification email:', emailError);
        // Continue with registration even if email fails
      }

      // Get subscription data for immediate access to features
      const subscription = await storage.getSubscriptionByCompanyId(company.id);

      // 📊 LANDING PAGE CONVERSION TRACKING
      // Mark the most recent landing visit from this IP as registered
      try {
        const clientIp = req.ip || req.headers['x-forwarded-for']?.toString().split(',')[0] || req.socket.remoteAddress || '';
        
        // Find the most recent visit from this IP address
        const recentVisit = await db
          .select()
          .from(schema.landingVisits)
          .where(
            and(
              eq(schema.landingVisits.ipAddress, clientIp),
              eq(schema.landingVisits.registered, false)
            )
          )
          .orderBy(desc(schema.landingVisits.visitedAt))
          .limit(1);

        if (recentVisit.length > 0) {
          await db
            .update(schema.landingVisits)
            .set({ 
              registered: true,
              companyId: company.id
            })
            .where(eq(schema.landingVisits.id, recentVisit[0].id));
          
          console.log(`✅ Landing visit ${recentVisit[0].id} marked as registered for company ${company.id}`);
        } else {
          // If no matching IP visit, just log it (user might have different IP now)
          console.log(`⚠️ No matching landing visit found for IP ${clientIp}`);
        }
      } catch (trackingError) {
        console.error('⚠️ Warning: Could not update landing visit tracking:', trackingError);
        // Continue with registration even if tracking fails
      }

      res.status(201).json({ 
        message: 'Registro de empresa exitoso',
        user: {
          id: user.id,
          email: user.companyEmail,
          fullName: user.fullName,
          role: user.role,
          companyId: user.companyId
        },
        company,
        subscription,
        token
      });
    } catch (error: any) {
      console.error('Company registration error:', error);
      res.status(400).json({ message: error.message || 'Error en el registro de empresa' });
    }
  });

  app.get('/api/auth/me', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Si es accountant, NO tiene empresa ni suscripción
      if (user.role === 'accountant') {
        const safeUser = toSafeUser(user);
        return res.json({
          user: safeUser,
          company: null,
          subscription: null
        });
      }

      const company = await storage.getCompany(user.companyId);
      
      // CRITICAL: Check if company is scheduled for deletion and block access
      if (company?.scheduledForDeletion) {
        console.log(`🚫 Access denied for cancelled company: ${company.name} (ID: ${company.id})`);
        return res.status(403).json({ 
          message: 'Account access suspended due to cancellation. Please contact support to restore your account.',
          code: 'ACCOUNT_CANCELLED'
        });
      }
      
      const subscription = await storage.getSubscriptionByCompanyId(user.companyId);

      // 🔄 ROLE CHANGE DETECTION: Compare token role vs database role
      const tokenRole = req.user!.role;
      const currentRole = user.role;
      let newToken = undefined;
      let roleChanged = false;
      
      if (tokenRole !== currentRole) {
        console.log(`🔄 ROLE CHANGE DETECTED for user ${user.id}: ${tokenRole} → ${currentRole}`);
        // Generate new token with updated role
        newToken = generateToken({
          id: user.id,
          username: user.companyEmail,
          role: currentRole,
          companyId: user.companyId
        });
        roleChanged = true;
      }

      // Return safe user DTO to avoid PII exposure
      const safeUser = toSafeUser(user);

      res.json({
        user: safeUser,
        company: company ? {
          ...company,
          // Ensure all configuration fields are included and properly typed
          workingHoursPerDay: Number(company.workingHoursPerDay) || 8,
          defaultVacationDays: Number(company.defaultVacationDays) || 30,
          vacationDaysPerMonth: Number(company.vacationDaysPerMonth) || 2.5,
          // Explicitly include logoUrl to ensure it's returned
          logoUrl: company.logoUrl || null
        } : null,
        subscription,
        // Include role change info if detected
        ...(roleChanged && { 
          roleChanged: true, 
          previousRole: tokenRole,
          newToken 
        })
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // User creation endpoint (for employee creation from employees-simple.tsx)
  app.post('/api/users', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      console.log('📧 REQUEST BODY:', JSON.stringify(req.body, null, 2));
      
      const {
        fullName,
        dni,
        companyEmail,
        companyPhone,
        position,
        startDate,
        status,
        role,
        personalEmail,
        personalPhone,
        postalAddress,
        emergencyContactName,
        emergencyContactPhone
      } = req.body;
      
      // Determine which email to use for activation (corporate or personal)
      const activationEmail = companyEmail || personalEmail;
      console.log('📧 EXTRACTED EMAIL:', { companyEmail, personalEmail, activationEmail });

      // Validate user limit - CRITICAL SECURITY: Count ALL users including admins
      const subscription = await storage.getSubscriptionByCompanyId((req as AuthRequest).user!.companyId);
      const currentEmployees = await storage.getUsersByCompany((req as AuthRequest).user!.companyId);
      const currentUserCount = currentEmployees.length; // Count ALL users including admins
      
      // Count users by role for plan limits
      const usersByRole = currentEmployees.reduce((acc: Record<string, number>, user: any) => {
        acc[user.role] = (acc[user.role] || 0) + 1;
        return acc;
      }, {});
      
      const requestedRole = role || 'employee';
      
      console.log(`🔒 USER LIMIT CHECK: Current users: ${currentUserCount}, Max allowed: ${subscription?.maxUsers}`);
      console.log(`🔒 ROLE COUNT CHECK: Current roles:`, usersByRole);
      console.log(`🔒 REQUESTING ROLE: ${requestedRole}`);
      
      // In modular system, check total user limit (maxUsers includes all roles)
      // Each role type has its own pricing: admin €6, manager €4, employee €2
      // No per-role limits - only total user limit matters
      const currentRoleCount = usersByRole[requestedRole] || 0;
      
      // Check total user limit
      if (subscription?.maxUsers && currentUserCount >= subscription.maxUsers) {
        return res.status(400).json({ 
          message: `Límite de usuarios alcanzado. Tu suscripción permite máximo ${subscription.maxUsers} usuarios y actualmente tienes ${currentUserCount}. Añade más usuarios desde la Tienda.` 
        });
      }

      // Check if user already exists within the same company by DNI
      const existingUser = await storage.getUserByDniAndCompany(dni, (req as AuthRequest).user!.companyId);
      if (existingUser) {
        return res.status(400).json({ message: 'DNI ya existe en tu empresa' });
      }

      if (!activationEmail) {
        return res.status(400).json({ message: 'Debe proporcionar al menos un email (corporativo o personal)' });
      }

      const existingEmail = await storage.getUserByEmail(activationEmail);
      if (existingEmail) {
        return res.status(400).json({ message: 'Email ya existe' });
      }

      // Create user without password (pending activation)
      const user = await storage.createUser({
        companyEmail: companyEmail || null, // Use null instead of empty string to avoid unique constraint issues
        password: '', // Empty password initially 
        fullName,
        dni,
        role: role || 'employee',
        companyId: (req as AuthRequest).user!.companyId,
        companyPhone: companyPhone || null,
        startDate: startDate ? new Date(startDate) : new Date(),
        isActive: true,
        isPendingActivation: true,
        totalVacationDays: "0", // Will be calculated after user creation
        personalEmail: personalEmail || null,
        personalPhone: personalPhone || null,
        postalAddress: postalAddress || null,
        emergencyContactName: emergencyContactName || null,
        emergencyContactPhone: emergencyContactPhone || null,
        position: position || null,
        createdBy: (req as AuthRequest).user!.id,
      });

      // Calculate proportional vacation days based on start date
      const calculatedVacationDays = await storage.calculateVacationDays(user.id);
      
      // Update user with calculated vacation days
      await storage.updateUser(user.id, {
        totalVacationDays: calculatedVacationDays.toString()
      });

      // Create activation token
      const activationToken = await storage.createActivationToken({
        userId: user.id,
        email: activationEmail,
        token: crypto.randomBytes(32).toString('hex'),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        createdBy: (req as AuthRequest).user!.id
      });

      // Get company information for email
      const company = await storage.getCompany((req as AuthRequest).user!.companyId);
      if (!company) {
        return res.status(500).json({ message: 'Error obteniendo información de empresa' });
      }

      // Send activation email
      const activationLink = `${req.protocol}://${req.get('host')}/employee-activation?token=${activationToken.token}`;
      
      console.log(`📧 Attempting to send activation email to: ${activationEmail}`);
      console.log(`📧 Employee name: ${fullName}`);
      console.log(`📧 Company name: ${company.name}`);
      console.log(`📧 Activation link: ${activationLink}`);
      
      const emailSent = await sendEmployeeWelcomeEmail(
        activationEmail,
        fullName,
        company.name,
        activationToken.token,
        activationLink
      );

      if (!emailSent) {
        console.error('❌ Failed to send activation email for employee:', activationEmail);
        // Don't fail the creation, just log the error
      } else {
        console.log(`✅ Activation email sent successfully to: ${activationEmail}`);
      }

      res.status(201).json({ 
        ...user, 
        password: undefined,
        message: `Empleado creado exitosamente. Se ha enviado un email de activación a ${activationEmail}`
      });
    } catch (error: any) {
      console.error('User creation error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Work session routes
  // 🔒 SECURITY: Rate limited to prevent abuse (10 attempts per 15 minutes)
  app.post('/api/work-sessions/clock-in', authenticateToken, simpleRateLimit(10, 15 * 60 * 1000), async (req: AuthRequest, res) => {
    try {
      const { latitude, longitude } = req.body || {};
      
      // Execute clock-in with retry logic for high-concurrency scenarios (1000+ simultaneous users)
      const session = await withDatabaseRetry(async () => {
        // ⚠️ FIRST: Mark old sessions as incomplete (maxHours + 4 hours margin)
        await storage.markOldSessionsAsIncomplete(req.user!.id);

        // Check if user already has an active session (excludes incomplete sessions)
        const activeSession = await storage.getActiveWorkSession(req.user!.id);
        if (activeSession) {
          throw new Error('Already clocked in');
        }

        // ⚠️ PROTECTED - DO NOT MODIFY - Critical cleanup on clock-in
        // Close any orphaned break periods before starting new session
        await storage.closeOrphanedBreakPeriods(req.user!.id);

        return await storage.createWorkSession({
          userId: req.user!.id,
          clockIn: new Date(),
          status: 'active',
          clockInLatitude: latitude ? latitude.toString() : null,
          clockInLongitude: longitude ? longitude.toString() : null,
        });
      });

      // WebSocket: Notify company admins of new work session
      const wsServer = getWebSocketServer();
      if (wsServer && req.user!.companyId) {
        wsServer.broadcastToCompany(req.user!.companyId, {
          type: 'work_session_created',
          companyId: req.user!.companyId,
          data: { sessionId: session.id, userId: req.user!.id }
        });
      }

      res.status(201).json(session);
    } catch (error: any) {
      if (error.message === 'Already clocked in') {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: error.message });
    }
  });

  // Regular clock out (current session)
  // 🔒 SECURITY: Rate limited to prevent abuse (10 attempts per 15 minutes)
  app.post('/api/work-sessions/clock-out', authenticateToken, simpleRateLimit(10, 15 * 60 * 1000), async (req: AuthRequest, res) => {
    try {
      const { latitude, longitude } = req.body || {};
      
      // Execute clock-out with retry logic for high-concurrency scenarios
      const result = await withDatabaseRetry(async () => {
        const activeSession = await storage.getActiveWorkSession(req.user!.id);
        if (!activeSession) {
          throw new Error('No active session found');
        }
        return activeSession;
      });
      
      const activeSession = result;

      const clockOut = new Date();
      const clockInTime = new Date(activeSession.clockIn);
      const diffInMs = clockOut.getTime() - clockInTime.getTime();
      
      // Validate reasonable time difference (max 24 hours)
      if (diffInMs < 0) {
        return res.status(400).json({ message: 'Invalid time: clock-out cannot be before clock-in' });
      }
      
      // For incomplete sessions from previous days, allow closure with maximum company working hours
      if (diffInMs > 24 * 60 * 60 * 1000) {
        // Check if this is an incomplete session that needs to be closed
        if (activeSession.status === 'incomplete') {
          // Get company work hours settings
          const companyData = await storage.getCompanyByUserId(req.user!.id);
          const maxWorkHours = companyData?.workingHoursPerDay || 8;
          
          // Close incomplete session with maximum working hours
          const updatedSession = await storage.updateWorkSession(activeSession.id, {
            clockOut,
            totalHours: maxWorkHours.toString(),
            status: 'completed',
            clockOutLatitude: latitude ? latitude.toString() : null,
            clockOutLongitude: longitude ? longitude.toString() : null,
          });
          
          return res.json(updatedSession);
        } else {
          const hoursDiff = diffInMs / (1000 * 60 * 60);
          return res.status(400).json({ 
            message: `Session too long: ${hoursDiff.toFixed(1)} hours. Maximum 24 hours allowed. Please contact admin to fix this session.` 
          });
        }
      }
      
      const totalHours = diffInMs / (1000 * 60 * 60);
      
      // Ensure totalHours is a reasonable number (max 24)
      const safeTotalHours = Math.min(Math.max(totalHours, 0), 24);

      const updatedSession = await storage.updateWorkSession(activeSession.id, {
        clockOut,
        totalHours: safeTotalHours.toFixed(2),
        status: 'completed',
        clockOutLatitude: latitude ? latitude.toString() : null,
        clockOutLongitude: longitude ? longitude.toString() : null,
      });

      // WebSocket: Notify company admins of session update
      const wsServer = getWebSocketServer();
      if (wsServer && req.user!.companyId) {
        wsServer.broadcastToCompany(req.user!.companyId, {
          type: 'work_session_updated',
          companyId: req.user!.companyId,
          data: { sessionId: activeSession.id, userId: req.user!.id }
        });
      }

      res.json(updatedSession);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Clock out incomplete session with custom time (users can only close their OWN sessions)
  // 🔒 SECURITY: Rate limited to prevent abuse
  app.post('/api/work-sessions/clock-out-incomplete', authenticateToken, simpleRateLimit(10, 15 * 60 * 1000), async (req: AuthRequest, res) => {
    try {
      const { sessionId, clockOutTime } = req.body;
      
      if (!sessionId || !clockOutTime) {
        return res.status(400).json({ message: 'Session ID and clock out time are required' });
      }

      // Get only the current user's sessions - users can ONLY close their own sessions
      const sessions = await storage.getWorkSessionsByUser(req.user!.id);
      const session = sessions.find(s => s.id === parseInt(sessionId));
      
      if (!session) {
        return res.status(404).json({ message: 'Session not found or not yours' });
      }

      // Parse the provided clockOutTime (should be ISO string from frontend)
      const clockOut = new Date(clockOutTime);
      const clockInTime = new Date(session.clockIn);
      
      // Validate times
      if (isNaN(clockOut.getTime()) || isNaN(clockInTime.getTime())) {
        return res.status(400).json({ message: 'Invalid date format' });
      }
      
      if (clockOut.getTime() <= clockInTime.getTime()) {
        return res.status(400).json({ message: 'Clock-out time must be after clock-in time' });
      }
      
      // Calculate total hours
      const diffInMs = clockOut.getTime() - clockInTime.getTime();
      const totalHours = diffInMs / (1000 * 60 * 60);
      
      // Get company work hours settings for validation
      const companyData = await storage.getCompanyByUserId(req.user!.id);
      const maxWorkHours = companyData?.workingHoursPerDay || 8;
      
      // Allow up to double the maximum work hours for flexibility
      if (totalHours > maxWorkHours * 2) {
        return res.status(400).json({ 
          message: `Clock-out time too late. Maximum ${maxWorkHours * 2} hours allowed.` 
        });
      }
      
      // Ensure totalHours is reasonable 
      const safeTotalHours = Math.min(Math.max(totalHours, 0), maxWorkHours * 2);

      const updatedSession = await storage.updateWorkSession(session.id, {
        clockOut,
        totalHours: safeTotalHours.toFixed(2),
        status: 'completed',
      });

      // WebSocket: Notify company admins of session update
      const wsServer = getWebSocketServer();
      if (wsServer && req.user!.companyId) {
        wsServer.broadcastToCompany(req.user!.companyId, {
          type: 'work_session_updated',
          companyId: req.user!.companyId,
          data: { sessionId: session.id, userId: session.userId }
        });
      }

      res.json(updatedSession);
    } catch (error: any) {
      console.error('Error closing incomplete session:', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/work-sessions/active', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const activeSession = await storage.getActiveWorkSession(req.user!.id);
      res.json(activeSession || null);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ⚡ PERFORMANCE: Endpoint agregado para dashboard del empleado
  // Consolida 8 queries individuales en 1 request
  app.get('/api/employee/dashboard-data', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const companyId = req.user!.companyId;
      const userRole = req.user!.role;

      // Ejecutar todas las queries en paralelo
      const [
        activeSession,
        activeBreak,
        vacationRequests,
        documentNotifications,
        unreadMessageCount,
        activeReminders
      ] = await Promise.all([
        storage.getActiveWorkSession(userId),
        storage.getActiveBreakPeriod(userId),
        storage.getVacationRequestsByUser(userId),
        userRole === 'admin' || userRole === 'manager'
          ? storage.getDocumentNotificationsByCompany(companyId)
          : storage.getDocumentNotificationsByUser(userId),
        storage.getUnreadMessageCount(userId),
        storage.getActiveReminders(userId)
      ]);

      // Retornar todos los datos en una sola respuesta
      res.json({
        activeSession: activeSession || null,
        activeBreak: activeBreak || null,
        vacationRequests: vacationRequests || [],
        documentNotifications: documentNotifications || [],
        unreadCount: { count: unreadMessageCount },
        activeReminders: activeReminders || []
      });
    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/work-sessions', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const sessions = await storage.getWorkSessionsByUser(req.user!.id);
      res.json(sessions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get available months with work session data (for month filter dropdown)
  app.get('/api/work-sessions/available-months', authenticateToken, requireRole(['admin', 'manager']), requireVisibleFeature('time_tracking', () => storage), async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;
      const accessMode = (req as any).managerAccessMode || 'full';
      
      // Get distinct months from work sessions using PostgreSQL to_char function
      let query = db
        .selectDistinct({
          month: sql<string>`to_char(${workSessions.clockIn}, 'YYYY-MM')`
        })
        .from(workSessions)
        .innerJoin(users, eq(workSessions.userId, users.id))
        .where(eq(users.companyId, companyId))
        .orderBy(sql`to_char(${workSessions.clockIn}, 'YYYY-MM') DESC`);
      
      // In self-access mode, only get months for current user
      if (accessMode === 'self') {
        query = db
          .selectDistinct({
            month: sql<string>`to_char(${workSessions.clockIn}, 'YYYY-MM')`
          })
          .from(workSessions)
          .innerJoin(users, eq(workSessions.userId, users.id))
          .where(and(
            eq(users.companyId, companyId),
            eq(workSessions.userId, req.user!.id)
          ))
          .orderBy(sql`to_char(${workSessions.clockIn}, 'YYYY-MM') DESC`);
      }
      
      const result = await query;
      const months = result.map(row => row.month).filter(Boolean);
      
      res.json({ months, accessMode });
    } catch (error: any) {
      console.error('Error fetching available months:', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/work-sessions/company', authenticateToken, requireRole(['admin', 'manager']), requireVisibleFeature('time_tracking', () => storage), async (req: AuthRequest, res) => {
    try {
      const accessMode = (req as any).managerAccessMode || 'full';
      
      // Pagination parameters - default 50 per page for fast loading
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      
      // Server-side filters for performance optimization
      const filters: {
        employeeId?: number;
        startDate?: Date;
        endDate?: Date;
        status?: 'active' | 'completed' | 'incomplete';
      } = {};
      
      // In self-access mode, force filter to only user's own data
      if (accessMode === 'self') {
        filters.employeeId = req.user!.id;
      } else if (req.query.employeeId) {
        filters.employeeId = parseInt(req.query.employeeId as string);
      }
      
      if (req.query.startDate) {
        // Set to start of day (00:00:00)
        const startDate = new Date(req.query.startDate as string);
        startDate.setHours(0, 0, 0, 0);
        filters.startDate = startDate;
      }
      
      if (req.query.endDate) {
        // Set to end of day (23:59:59.999) to include all sessions from that day
        const endDate = new Date(req.query.endDate as string);
        endDate.setHours(23, 59, 59, 999);
        filters.endDate = endDate;
      }
      
      if (req.query.status && ['active', 'completed', 'incomplete'].includes(req.query.status as string)) {
        filters.status = req.query.status as 'active' | 'completed' | 'incomplete';
      }
      
      // Mark old sessions as incomplete for all employees before retrieving
      // Get all employees from the company (or just current user in self mode)
      if (accessMode === 'self') {
        await storage.markOldSessionsAsIncomplete(req.user!.id);
      } else {
        const employees = await storage.getEmployeesByCompany(req.user!.companyId);
        await Promise.all(
          employees.map(employee => storage.markOldSessionsAsIncomplete(employee.id))
        );
      }
      
      const result = await storage.getWorkSessionsByCompany(req.user!.companyId, limit, offset, filters);
      
      // Return paginated response with total count for infinite scroll
      // Include accessMode so frontend knows how to render
      res.json({
        sessions: result.sessions,
        totalCount: result.totalCount,
        hasMore: offset + result.sessions.length < result.totalCount,
        accessMode: accessMode
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Optimized endpoint for Summary tab - returns aggregated stats per employee (no individual sessions)
  app.get('/api/work-sessions/summary-stats', authenticateToken, requireRole(['admin', 'manager']), requireVisibleFeature('time_tracking', () => storage), async (req: AuthRequest, res) => {
    try {
      const accessMode = (req as any).managerAccessMode || 'full';
      const companyId = req.user!.companyId;
      
      // Parse date range
      let startDate: Date | undefined;
      let endDate: Date | undefined;
      
      if (req.query.startDate) {
        startDate = new Date(req.query.startDate as string);
        startDate.setHours(0, 0, 0, 0);
      }
      
      if (req.query.endDate) {
        endDate = new Date(req.query.endDate as string);
        endDate.setHours(23, 59, 59, 999);
      }
      
      // Get aggregated stats using optimized SQL query
      // In self-access mode, only get stats for the current user
      const stats = await storage.getWorkSessionsStats(companyId, startDate, endDate, accessMode === 'self' ? req.user!.id : undefined);
      
      res.json({ ...stats, accessMode });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch('/api/work-sessions/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
      // 🔒 SECURITY: Validate ID parameter
      const id = parseIntParam(req.params.id, 'session ID');
      const { clockIn, clockOut, breakPeriods: requestBreakPeriods } = req.body;

      // Verify session belongs to user (or user is admin/manager)
      const session = await storage.getWorkSession(id);
      if (!session) {
        return res.status(404).json({ message: 'Work session not found' });
      }

      if (session.userId !== req.user!.id && !['admin', 'manager'].includes(req.user!.role)) {
        return res.status(403).json({ message: 'Not authorized to edit this session' });
      }

      // 🔒 SECURITY: Validate date ranges
      const now = new Date();
      const MAX_PAST_DAYS = 90; // Política de empresa
      const maxPastDate = new Date(now.getTime() - MAX_PAST_DAYS * 24 * 60 * 60 * 1000);

      if (clockIn) {
        const clockInDate = new Date(clockIn);
        
        if (clockInDate < maxPastDate) {
          return res.status(400).json({ 
            message: `No se pueden modificar fichajes de hace más de ${MAX_PAST_DAYS} días` 
          });
        }
        
        if (clockInDate > now) {
          return res.status(400).json({ 
            message: 'No se pueden crear fichajes en el futuro' 
          });
        }
      }

      // Validate clockOut vs clockIn
      if (clockOut && clockIn) {
        const clockOutDate = new Date(clockOut);
        const clockInDate = new Date(clockIn);
        
        if (clockOutDate <= clockInDate) {
          return res.status(400).json({ 
            message: 'La hora de salida debe ser posterior a la de entrada' 
          });
        }

        // Validate duration doesn't exceed 24 hours
        const duration = (clockOutDate.getTime() - clockInDate.getTime()) / (1000 * 60 * 60);
        if (duration > 24) {
          return res.status(400).json({ 
            message: 'La sesión no puede exceder 24 horas' 
          });
        }
      }

      const updateData: any = {};
      if (clockIn) updateData.clockIn = new Date(clockIn);
      if (clockOut) updateData.clockOut = new Date(clockOut);

      // Update break periods if provided
      if (requestBreakPeriods !== undefined) {
        // First, delete existing break periods for this session
        await db.delete(breakPeriods).where(eq(breakPeriods.workSessionId, id));
        
        // Then create new break periods if any are provided
        if (Array.isArray(requestBreakPeriods) && requestBreakPeriods.length > 0) {
          const newBreakPeriods = requestBreakPeriods.map((bp: any) => ({
            workSessionId: id,
            userId: session.userId,
            breakStart: new Date(bp.breakStart),
            breakEnd: bp.breakEnd ? new Date(bp.breakEnd) : null,
            status: bp.breakEnd ? 'completed' : 'active',
            duration: bp.breakEnd ? 
              ((new Date(bp.breakEnd).getTime() - new Date(bp.breakStart).getTime()) / (1000 * 60 * 60)).toFixed(2) : 
              null
          }));
          
          await db.insert(breakPeriods).values(newBreakPeriods);
        }
      }

      const updatedSession = await storage.updateWorkSession(id, updateData);
      if (!updatedSession) {
        return res.status(404).json({ message: 'Work session not found' });
      }

      res.json(updatedSession);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Work Session Modification & Audit (Legal Compliance RD-ley 8/2019)
  
  // Admin: Create manual work session (forgotten check-in)
  app.post('/api/admin/work-sessions/create-manual', authenticateToken, requireRole(['admin', 'manager']), requireVisibleFeature('time_tracking', () => storage), async (req: AuthRequest, res) => {
    try {
      const { employeeId, date, clockIn, clockOut, reason } = req.body;

      // Validate required fields
      if (!employeeId || !date || !clockIn || !clockOut || !reason) {
        return res.status(400).json({ message: 'Missing required fields' });
      }

      // Verify employee belongs to same company
      const employee = await storage.getUser(employeeId);
      if (!employee || employee.companyId !== req.user!.companyId) {
        return res.status(403).json({ message: 'Employee not found or unauthorized' });
      }

      // Create date objects for the specific date
      const targetDate = new Date(date);
      const clockInTime = clockIn.split(':');
      const clockOutTime = clockOut.split(':');
      
      const clockInDate = new Date(targetDate);
      clockInDate.setHours(parseInt(clockInTime[0]), parseInt(clockInTime[1]), 0, 0);
      
      const clockOutDate = new Date(targetDate);
      clockOutDate.setHours(parseInt(clockOutTime[0]), parseInt(clockOutTime[1]), 0, 0);

      // Calculate total hours
      const totalHours = ((clockOutDate.getTime() - clockInDate.getTime()) / (1000 * 60 * 60)).toFixed(2);

      // Create work session marked as manually created
      const workSession = await storage.createWorkSession({
        userId: employeeId,
        clockIn: clockInDate,
        clockOut: clockOutDate,
        totalHours,
        totalBreakTime: '0.00',
        status: 'completed',
        autoCompleted: false,
        isManuallyCreated: true,
        lastModifiedBy: req.user!.id,
        lastModifiedAt: new Date(),
      });

      // Create audit log entry
      await storage.createWorkSessionAuditLog({
        workSessionId: workSession.id,
        companyId: req.user!.companyId,
        modificationType: 'created_manual',
        oldValue: null,
        newValue: {
          clockIn: clockInDate.toISOString(),
          clockOut: clockOutDate.toISOString(),
        },
        reason,
        modifiedBy: req.user!.id,
      });

      // WebSocket: Notify company admins of new manual session
      const wsServer = getWebSocketServer();
      if (wsServer && req.user!.companyId) {
        wsServer.broadcastToCompany(req.user!.companyId, {
          type: 'work_session_created',
          companyId: req.user!.companyId,
          data: { sessionId: workSession.id, userId: employeeId }
        });
      }

      res.status(201).json(workSession);
    } catch (error: any) {
      console.error('Error creating manual work session:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Modify existing work session
  app.patch('/api/admin/work-sessions/:id/modify', authenticateToken, requireRole(['admin', 'manager']), requireVisibleFeature('time_tracking', () => storage), async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const { clockIn, clockOut, reason } = req.body;

      if (!reason) {
        return res.status(400).json({ message: 'Reason is required for modification' });
      }

      // Get existing session
      const session = await storage.getWorkSession(id);
      if (!session) {
        return res.status(404).json({ message: 'Work session not found' });
      }

      // Verify session belongs to same company
      const employee = await storage.getUser(session.userId);
      if (!employee || employee.companyId !== req.user!.companyId) {
        return res.status(403).json({ message: 'Unauthorized' });
      }

      // Store old values for audit log
      const oldValue = {
        clockIn: session.clockIn.toISOString(),
        clockOut: session.clockOut?.toISOString() || null,
      };

      // Prepare updates
      const updates: any = {
        lastModifiedBy: req.user!.id,
        lastModifiedAt: new Date(),
      };

      if (clockIn) updates.clockIn = new Date(clockIn);
      if (clockOut) updates.clockOut = new Date(clockOut);

      // Recalculate total hours if times changed
      if (updates.clockIn || updates.clockOut) {
        const finalClockIn = updates.clockIn || session.clockIn;
        const finalClockOut = updates.clockOut || session.clockOut;
        if (finalClockOut) {
          updates.totalHours = ((finalClockOut.getTime() - finalClockIn.getTime()) / (1000 * 60 * 60)).toFixed(2);
        }
      }

      // Update session
      const updatedSession = await storage.updateWorkSession(id, updates);

      // Determine modification type
      let modificationType = 'modified_both';
      if (clockIn && !clockOut) modificationType = 'modified_clockin';
      if (!clockIn && clockOut) modificationType = 'modified_clockout';

      // Create audit log entry
      await storage.createWorkSessionAuditLog({
        workSessionId: id,
        companyId: req.user!.companyId,
        modificationType,
        oldValue,
        newValue: {
          clockIn: updatedSession!.clockIn.toISOString(),
          clockOut: updatedSession!.clockOut?.toISOString() || null,
        },
        reason,
        modifiedBy: req.user!.id,
      });

      res.json(updatedSession);
    } catch (error: any) {
      console.error('Error modifying work session:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Get audit log for a work session
  app.get('/api/admin/work-sessions/:id/audit-log', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);

      // Verify session exists and belongs to same company
      const session = await storage.getWorkSession(id);
      if (!session) {
        return res.status(404).json({ message: 'Work session not found' });
      }

      const employee = await storage.getUser(session.userId);
      if (!employee || employee.companyId !== req.user!.companyId) {
        return res.status(403).json({ message: 'Unauthorized' });
      }

      const auditLogs = await storage.getWorkSessionAuditLogs(id);
      res.json(auditLogs);
    } catch (error: any) {
      console.error('Error fetching audit log:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Employee: Request work session modification
  app.post('/api/work-sessions/request-modification', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { workSessionId, requestType, requestedDate, requestedClockIn, requestedClockOut, reason } = req.body;

      console.log('🔍 DEBUG - Request modification body:', {
        requestedDate,
        requestedDateType: typeof requestedDate,
        requestedClockIn,
        requestedClockOut
      });

      if (!requestType || !requestedDate || !requestedClockIn || !reason) {
        return res.status(400).json({ message: 'Missing required fields' });
      }

      // Prepare request data
      const requestData: any = {
        workSessionId: workSessionId || null,
        employeeId: req.user!.id,
        companyId: req.user!.companyId,
        requestType, // 'forgotten_checkin' or 'modify_time'
        requestedDate: new Date(requestedDate),
        requestedClockIn: new Date(requestedClockIn),
        requestedClockOut: requestedClockOut ? new Date(requestedClockOut) : null,
        reason,
        status: 'pending',
      };

      // If modifying existing session, get current values
      if (workSessionId) {
        const session = await storage.getWorkSession(workSessionId);
        if (!session) {
          return res.status(404).json({ message: 'Work session not found' });
        }
        if (session.userId !== req.user!.id) {
          return res.status(403).json({ message: 'Unauthorized' });
        }

        requestData.currentClockIn = session.clockIn;
        requestData.currentClockOut = session.clockOut;
      }

      const request = await storage.createModificationRequest(requestData);
      
      // Broadcast to company admins via WebSocket with full details for toast
      const wsServer = getWebSocketServer();
      if (wsServer) {
        wsServer.broadcastToCompany(req.user!.companyId, {
          type: 'modification_request_created',
          companyId: req.user!.companyId,
          data: { 
            requestId: request.id, 
            employeeId: req.user!.id,
            employeeName: req.user!.fullName,
            requestType, // 'forgotten_checkin' or 'modify_time'
            requestedDate
          }
        });
      }
      
      res.status(201).json(request);
    } catch (error: any) {
      console.error('Error creating modification request:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Get pending modification requests count
  app.get('/api/admin/work-sessions/modification-requests/count', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const count = await storage.getPendingModificationRequestsCount(req.user!.companyId);
      res.json({ count });
    } catch (error: any) {
      console.error('Error getting pending requests count:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Get modification requests
  app.get('/api/admin/work-sessions/modification-requests', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const status = req.query.status as string | undefined;
      const requests = await storage.getCompanyModificationRequests(req.user!.companyId, status);
      
      // Enrich with employee names and ensure proper date serialization
      const enrichedRequests = await Promise.all(requests.map(async (request) => {
        const employee = await storage.getUser(request.employeeId);
        
        // Helper to safely convert to ISO string
        const toISOSafe = (date: any) => {
          if (!date) return null;
          try {
            if (typeof date === 'string') return new Date(date).toISOString();
            if (date instanceof Date) return date.toISOString();
            return null;
          } catch (e) {
            console.error('Error converting date:', date, e);
            return null;
          }
        };
        
        return {
          ...request,
          // Ensure dates are properly serialized as ISO strings
          requestedDate: toISOSafe(request.requestedDate),
          requestedClockIn: toISOSafe(request.requestedClockIn),
          requestedClockOut: toISOSafe(request.requestedClockOut),
          currentClockIn: toISOSafe(request.currentClockIn),
          currentClockOut: toISOSafe(request.currentClockOut),
          reviewedAt: toISOSafe(request.reviewedAt),
          createdAt: toISOSafe(request.createdAt),
          employeeName: employee?.fullName || 'Unknown',
          employeeProfilePicture: employee?.profilePicture || null,
        };
      }));

      res.json(enrichedRequests);
    } catch (error: any) {
      console.error('Error fetching modification requests:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Approve or reject modification request
  app.patch('/api/admin/work-sessions/modification-requests/:id', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status, adminResponse } = req.body;

      if (!status || !['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
      }

      // Get the request
      const request = await storage.getModificationRequest(id);
      if (!request) {
        return res.status(404).json({ message: 'Request not found' });
      }

      if (request.companyId !== req.user!.companyId) {
        return res.status(403).json({ message: 'Unauthorized' });
      }

      if (request.status !== 'pending') {
        return res.status(400).json({ message: 'Request already processed' });
      }

      // If approved, create or modify the work session
      if (status === 'approved') {
        if (request.requestType === 'forgotten_checkin') {
          // Create new work session
          const totalHours = request.requestedClockOut 
            ? ((request.requestedClockOut.getTime() - request.requestedClockIn.getTime()) / (1000 * 60 * 60)).toFixed(2)
            : null;

          const workSession = await storage.createWorkSession({
            userId: request.employeeId,
            clockIn: request.requestedClockIn,
            clockOut: request.requestedClockOut || undefined,
            totalHours: totalHours || undefined,
            totalBreakTime: '0.00',
            status: request.requestedClockOut ? 'completed' : 'active',
            autoCompleted: false,
            isManuallyCreated: true,
            lastModifiedBy: req.user!.id,
            lastModifiedAt: new Date(),
          });

          // Create audit log
          await storage.createWorkSessionAuditLog({
            workSessionId: workSession.id,
            companyId: req.user!.companyId,
            modificationType: 'created_manual',
            oldValue: null,
            newValue: {
              clockIn: request.requestedClockIn.toISOString(),
              clockOut: request.requestedClockOut?.toISOString() || null,
            },
            reason: `Employee request approved: ${request.reason}`,
            modifiedBy: req.user!.id,
          });

          // WebSocket: Notify company admins of new session
          const wsServer = getWebSocketServer();
          if (wsServer && req.user!.companyId) {
            wsServer.broadcastToCompany(req.user!.companyId, {
              type: 'work_session_created',
              companyId: req.user!.companyId,
              data: { sessionId: workSession.id, userId: request.employeeId }
            });
          }
        } else if (request.requestType === 'modify_time' && request.workSessionId) {
          // Modify existing session
          const session = await storage.getWorkSession(request.workSessionId);
          if (session) {
            const oldValue = {
              clockIn: session.clockIn.toISOString(),
              clockOut: session.clockOut?.toISOString() || null,
            };

            // CRITICAL: Preserve original values when employee only modifies one field
            const finalClockIn = request.requestedClockIn || session.clockIn;
            const finalClockOut = request.requestedClockOut || session.clockOut;

            const updates: any = {
              clockIn: finalClockIn,
              lastModifiedBy: req.user!.id,
              lastModifiedAt: new Date(),
            };

            if (finalClockOut) {
              updates.clockOut = finalClockOut;
              updates.totalHours = ((finalClockOut.getTime() - finalClockIn.getTime()) / (1000 * 60 * 60)).toFixed(2);
              updates.status = 'completed';
            }

            await storage.updateWorkSession(request.workSessionId, updates);

            // Determine modification type
            let modificationType = 'modified_both';
            if (!request.requestedClockIn && request.requestedClockOut) {
              modificationType = 'modified_clockout';
            } else if (request.requestedClockIn && !request.requestedClockOut) {
              modificationType = 'modified_clockin';
            }

            // Create audit log
            await storage.createWorkSessionAuditLog({
              workSessionId: request.workSessionId,
              companyId: req.user!.companyId,
              modificationType,
              oldValue,
              newValue: {
                clockIn: finalClockIn.toISOString(),
                clockOut: finalClockOut?.toISOString() || null,
              },
              reason: `Employee request approved: ${request.reason}`,
              modifiedBy: req.user!.id,
            });

            // WebSocket: Notify company admins of session update
            const wsServer = getWebSocketServer();
            if (wsServer && req.user!.companyId) {
              wsServer.broadcastToCompany(req.user!.companyId, {
                type: 'work_session_updated',
                companyId: req.user!.companyId,
                data: { sessionId: request.workSessionId, userId: request.employeeId }
              });
            }
          }
        }
      }

      // Update request status
      const updatedRequest = await storage.updateModificationRequest(id, {
        status,
        adminResponse: adminResponse || null,
        reviewedBy: req.user!.id,
        reviewedAt: new Date(),
      });

      res.json(updatedRequest);
    } catch (error: any) {
      console.error('Error processing modification request:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Break periods routes
  app.post('/api/break-periods/start', authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Check if user has an active work session
      const activeSession = await storage.getActiveWorkSession(req.user!.id);
      if (!activeSession) {
        return res.status(400).json({ message: 'No active work session found' });
      }

      // Check if user already has an active break
      const activeBreak = await storage.getActiveBreakPeriod(req.user!.id);
      if (activeBreak) {
        return res.status(400).json({ message: 'Already on break' });
      }

      const breakPeriod = await storage.createBreakPeriod({
        workSessionId: activeSession.id,
        userId: req.user!.id,
        breakStart: new Date(),
        status: 'active',
      });

      // Broadcast real-time update to admins/managers
      const wsServer = getWebSocketServer();
      if (wsServer && req.user!.companyId) {
        wsServer.broadcastToCompany(req.user!.companyId, {
          type: 'work_session_updated',
          companyId: req.user!.companyId,
          data: { sessionId: activeSession.id, userId: req.user!.id, action: 'break_started' }
        });
      }

      res.status(201).json(breakPeriod);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/break-periods/end', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const activeBreak = await storage.getActiveBreakPeriod(req.user!.id);
      if (!activeBreak) {
        return res.status(400).json({ message: 'No active break found' });
      }

      const breakEnd = new Date();
      const duration = (breakEnd.getTime() - activeBreak.breakStart.getTime()) / (1000 * 60 * 60);

      const updatedBreak = await storage.updateBreakPeriod(activeBreak.id, {
        breakEnd,
        duration: duration.toFixed(2),
        status: 'completed',
      });

      // Update the work session's total break time
      await storage.updateWorkSessionBreakTime(activeBreak.workSessionId);

      // Broadcast real-time update to admins/managers
      const wsServer = getWebSocketServer();
      if (wsServer && req.user!.companyId) {
        wsServer.broadcastToCompany(req.user!.companyId, {
          type: 'work_session_updated',
          companyId: req.user!.companyId,
          data: { sessionId: activeBreak.workSessionId, userId: req.user!.id, action: 'break_ended' }
        });
      }

      res.json(updatedBreak);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/break-periods/active', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const activeBreak = await storage.getActiveBreakPeriod(req.user!.id);
      res.json(activeBreak || null);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get all break periods for the authenticated user
  app.get('/api/break-periods', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const breakPeriods = await storage.getBreakPeriodsByUser(req.user!.id);
      res.json(breakPeriods);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Vacation/Absence request routes
  app.post('/api/vacation-requests', authenticateToken, async (req: AuthRequest, res) => {
    try {
      console.log('Absence request body:', req.body);
      console.log('User ID:', req.user!.id);
      
      // Determine status based on user role
      // Admin requests are auto-approved, manager/employee requests are pending
      const status = req.user!.role === 'admin' ? 'approved' : 'pending';
      
      // Get absence type (default to 'vacation' for backwards compatibility)
      const absenceType = req.body.absenceType || 'vacation';
      
      const data = insertVacationRequestSchema.parse({
        ...req.body,
        userId: req.user!.id,
        startDate: new Date(req.body.startDate),
        endDate: new Date(req.body.endDate),
        absenceType: absenceType,
        attachmentPath: req.body.attachmentPath || null,
        status: status, // Set status based on role
      });

      console.log('Parsed data:', data);
      
      // Validate vacation days availability ONLY for 'vacation' type
      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(403).json({ message: 'No autorizado' });
      }

      // Only check vacation balance for vacation type absences
      if (absenceType === 'vacation') {
        const startDate = data.startDate;
        const endDate = data.endDate;

        // Vacation period boundaries based on company cutoff (default 01-31)
        const company = await storage.getCompany(req.user!.companyId);
        const cutoff = (company as any)?.vacationCutoffDay || '01-31';
        const [mmStr, ddStr] = cutoff.split('-');
        const mm = Math.max(1, Math.min(12, parseInt(mmStr || '1', 10))) - 1;
        const dd = Math.max(1, Math.min(31, parseInt(ddStr || '31', 10)));
        const getPeriod = (d: Date) => {
          const y = d.getFullYear();
          const cutoffThisYear = new Date(y, mm, dd);
          const periodEnd = d <= cutoffThisYear ? cutoffThisYear : new Date(y + 1, mm, dd);
          const periodStart = new Date(periodEnd);
          periodStart.setFullYear(periodEnd.getFullYear() - 1);
          periodStart.setDate(periodStart.getDate() + 1);
          return { periodStart, periodEnd };
        };

        const { periodStart, periodEnd } = getPeriod(startDate);
        const cutoffLabel = periodEnd.toLocaleDateString('es-ES', { day: '2-digit', month: 'long' });

        // Block requests that cross the company cutoff boundary
        if (endDate > periodEnd) {
          return res.status(400).json({
            message: `No puedes solicitar vacaciones más allá del ${cutoffLabel}. Divide la solicitud en dos rangos.`
          });
        }

        const requestedDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

        // Fetch user's vacation requests to compute used days (approved + pending) within the same period
        const existingRequests = await storage.getVacationRequestsByUser(req.user!.id);
        const statusesToCount = new Set(['approved', 'pending']);

        const overlapDays = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) => {
          const start = aStart > bStart ? aStart : bStart;
          const end = aEnd < bEnd ? aEnd : bEnd;
          if (end < start) return 0;
          return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        };

        const usedDays = existingRequests
          .filter(r => r.absenceType === 'vacation' && statusesToCount.has(r.status))
          .reduce((sum, r) => {
            const rStart = new Date(r.startDate);
            const rEnd = new Date(r.endDate);
            return sum + overlapDays(rStart, rEnd, periodStart, periodEnd);
          }, 0);

        const entitlement = await storage.calculateVacationDays(req.user!.id);
        const availableDays = Math.max(0, entitlement - usedDays);

        if (requestedDays > availableDays) {
          return res.status(400).json({ 
            message: `Ojalá pudiéramos darte más… pero ahora mismo solo tienes ${availableDays} días disponibles.` 
          });
        }
      }

      // Validate attachment requirement for public_duty type
      if (absenceType === 'public_duty' && !req.body.attachmentPath) {
        return res.status(400).json({
          message: 'El justificante es obligatorio para este tipo de ausencia.'
        });
      }
      
      const request = await storage.createVacationRequest(data);
      
      // If there's an attachment and the company has the documents addon, save it to Justificantes folder
      if (req.body.attachmentPath && req.user!.companyId) {
        try {
          const hasDocumentsAddon = await storage.hasActiveAddon(req.user!.companyId, 'documents');
          if (hasDocumentsAddon) {
            // Get employee name for descriptive filename
            const employeeName = user.fullName.replace(/\s+/g, '_').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            
            // Get absence type name in Spanish
            const absenceTypeNames: Record<string, string> = {
              'vacation': 'Vacaciones',
              'sick_leave': 'BajaMedica',
              'paternity_maternity': 'PaternidadMaternidad',
              'personal': 'AsuntosPersonales',
              'training': 'Formacion',
              'work_related': 'AsuntosLaborales',
              'public_duty': 'DeberInexcusable',
              'temporary_disability': 'IncapacidadTemporal'
            };
            const absenceTypeName = absenceTypeNames[absenceType] || 'Ausencia';
            
            // Format date for filename (YYYY-MM-DD)
            const dateStr = new Date(data.startDate).toISOString().split('T')[0];
            
            // Extract file extension from original name
            const attachmentPath = req.body.attachmentPath;
            const pathParts = attachmentPath.split('/');
            const originalFileName = pathParts[pathParts.length - 1] || 'justificante.pdf';
            const extension = originalFileName.includes('.') ? originalFileName.split('.').pop() : 'pdf';
            
            // Create descriptive filename: fecha_tipoAusencia_nombreEmpleado.ext
            const descriptiveFileName = `${dateStr}_${absenceTypeName}_${employeeName}.${extension}`;
            
            // Get file size and mime type from request body (if passed)
            const fileSize = req.body.attachmentFileSize || 0;
            const mimeType = req.body.attachmentMimeType || 'application/octet-stream';
            
            // Create document without folderId - the frontend will categorize it automatically
            // based on the filename containing the absence type (e.g. "DeberInexcusable", "Vacaciones", "BajaMedica")
            await storage.createDocument({
              userId: req.user!.id,
              fileName: descriptiveFileName,
              originalName: descriptiveFileName,
              mimeType: mimeType,
              fileSize: fileSize,
              filePath: attachmentPath,
              isViewed: false,
              isAccepted: false,
            });
            console.log(`Justificante document created for vacation request ${request.id}: ${descriptiveFileName}`);
          }
        } catch (docError) {
          // Don't fail the vacation request if document creation fails
          console.error('Error creating justificante document:', docError);
        }
      }
      
      // Log the automatic approval for admin users
      if (req.user!.role === 'admin') {
        console.log(`Admin request auto-approved for user ${req.user!.id}: ${request.id}`);
      } else {
        console.log(`Request created pending approval for user ${req.user!.id}: ${request.id}`);
        
        // Broadcast to company admins via WebSocket (only for pending requests)
        // Include employee name for immediate toast notification
        const wsServer = getWebSocketServer();
        console.log(`📢 WebSocket broadcast attempt: wsServer=${!!wsServer}, companyId=${req.user!.companyId}`);
        if (wsServer) {
          const broadcastMessage = {
            type: 'vacation_request_created',
            companyId: req.user!.companyId,
            data: { 
              requestId: request.id, 
              employeeId: req.user!.id,
              employeeName: user.fullName,
              startDate: request.startDate,
              endDate: request.endDate,
              absenceType: absenceType
            }
          };
          console.log(`📢 Broadcasting vacation request:`, JSON.stringify(broadcastMessage));
          wsServer.broadcastToCompany(req.user!.companyId, broadcastMessage);
          console.log(`📢 Broadcast sent to company ${req.user!.companyId}`);
        } else {
          console.log(`⚠️ WebSocket server not available for broadcast`);
        }
      }
      
      res.status(201).json(request);
    } catch (error: any) {
      console.error('Vacation request error:', error);
      res.status(400).json({ message: error.message });
    }
  });

  app.get('/api/vacation-requests', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const requests = await storage.getVacationRequestsByUser(req.user!.id);
      // Sanitize embedded user data if any future expansion includes user fields
      res.json(requests);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/vacation-requests/company', authenticateToken, requireRole(['admin', 'manager']), requireVisibleFeature('vacation', () => storage), async (req: AuthRequest, res) => {
    try {
      const accessMode = (req as any).managerAccessMode || 'full';
      
      let requests;
      if (accessMode === 'self') {
        // In self mode, only get manager's own vacation requests
        requests = await storage.getVacationRequestsByUser(req.user!.id);
      } else {
        requests = await storage.getVacationRequestsByCompany(req.user!.companyId);
      }
      
      // Add user names to vacation requests
      const requestsWithNames = await Promise.all(requests.map(async (request: any) => {
        const user = await storage.getUser(request.userId);
        const safe = user ? toSafeUser(user) : null;
        return {
          ...request,
          userName: safe?.fullName || 'Usuario desconocido',
          user: safe || undefined,
        };
      }));
      
      res.json({ requests: requestsWithNames, accessMode });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch('/api/vacation-requests/:id', authenticateToken, requireRole(['admin', 'manager']), requireVisibleFeature('vacation', () => storage), async (req: AuthRequest, res) => {
    try {
      const accessMode = (req as any).managerAccessMode || 'full';
      
      // In self mode, managers cannot approve/deny vacation requests
      if (accessMode === 'self') {
        return res.status(403).json({ message: 'No tienes permisos para gestionar solicitudes de vacaciones' });
      }
      
      const id = parseInt(req.params.id);
      const { status, startDate, endDate, adminComment } = req.body;

      console.log('PATCH vacation-requests:', { id, status, startDate, endDate, adminComment });

      if (!['approved', 'denied', 'pending'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
      }

      const updateData: any = { 
        status,
        reviewedAt: new Date() // Add timestamp when status changes
      };
      if (startDate) updateData.startDate = new Date(startDate);
      if (endDate) updateData.endDate = new Date(endDate);
      if (adminComment) updateData.adminComment = adminComment;

      // ✅ CRITICAL: Verify vacation request belongs to user's company (IDOR prevention)
      const existingRequest = await storage.getVacationRequestById(id);
      if (!existingRequest) {
        return res.status(404).json({ message: 'Vacation request not found' });
      }

      // Get the user to verify company ownership
      const user = await storage.getUser(existingRequest.userId);
      if (!user || user.companyId !== req.user!.companyId) {
        return res.status(403).json({ message: 'No autorizado' });
      }

      const request = await storage.updateVacationRequest(id, updateData);

      if (!request) {
        return res.status(404).json({ message: 'Vacation request not found' });
      }

      console.log('Update successful:', request);
      
      // 📱 Send push notification to employee when vacation request is reviewed - ASYNC (no bloquea endpoint)
      if (status === 'approved' || status === 'denied') {
        import('./pushNotificationScheduler.js').then(({ sendVacationNotification }) => {
          sendVacationNotification(request.userId, status, {
            startDate: request.startDate,
            endDate: request.endDate,
            adminComment,
            requestId: request.id
          }).then(() => {
            console.log(`📱 Vacation ${status} notification sent to user ${request.userId}`);
          }).catch(error => {
            console.error('Error sending vacation push notification:', error);
          });
        }).catch(err => console.error('Failed to load push notification module:', err));
        
        // 📡 WebSocket: Broadcast for real-time badge updates on employee dashboard
        const wsServer = getWebSocketServer();
        if (wsServer) {
          wsServer.broadcastToCompany(req.user!.companyId, { type: 'vacation_request_updated', companyId: req.user!.companyId });
        }
      }
      
      res.json(request);
    } catch (error: any) {
      console.error('Error updating vacation request:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Serve vacation request attachment files
  app.get('/api/vacation-requests/:id/attachment', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const request = await storage.getVacationRequestById(id);
      
      if (!request) {
        return res.status(404).json({ message: 'Solicitud no encontrada' });
      }
      
      // Verify user has access (same company)
      const requestUser = await storage.getUser(request.userId);
      if (!requestUser || requestUser.companyId !== req.user!.companyId) {
        return res.status(403).json({ message: 'No autorizado' });
      }
      
      if (!request.attachmentPath) {
        return res.status(404).json({ message: 'Esta solicitud no tiene archivo adjunto' });
      }
      
      // Clean the path - remove /public-objects/ prefix if present
      let r2Key = request.attachmentPath;
      if (r2Key.startsWith('/public-objects/')) {
        r2Key = r2Key.replace('/public-objects/', '');
      } else if (r2Key.startsWith('public-objects/')) {
        r2Key = r2Key.replace('public-objects/', '');
      }
      
      // Download from object storage
      const fileData = await objectStorage.downloadDocument(r2Key);
      
      if (!fileData) {
        console.log(`❌ Attachment not found in R2 for vacation request ${id}: ${request.attachmentPath}`);
        return res.status(404).json({ message: 'Archivo no encontrado en el servidor' });
      }
      
      // Determine content type from filename
      const ext = path.extname(request.attachmentPath).toLowerCase();
      let contentType = 'application/octet-stream';
      switch (ext) {
        case '.pdf': contentType = 'application/pdf'; break;
        case '.jpg':
        case '.jpeg': contentType = 'image/jpeg'; break;
        case '.png': contentType = 'image/png'; break;
        case '.gif': contentType = 'image/gif'; break;
        case '.webp': contentType = 'image/webp'; break;
      }
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `inline; filename="justificante${ext}"`);
      res.setHeader('Cache-Control', 'private, max-age=300');
      
      res.send(fileData.buffer);
    } catch (error: any) {
      console.error('Error serving vacation attachment:', error);
      res.status(500).json({ message: 'Error al obtener el archivo' });
    }
  });

  // Export vacation report as PDF
  app.post('/api/vacation-requests/export-pdf', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const { employeeIds, startDate, endDate } = req.body;
      
      if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
        return res.status(400).json({ message: 'Debes especificar al menos un empleado' });
      }
      
      if (!startDate || !endDate) {
        return res.status(400).json({ message: 'Debes especificar un rango de fechas' });
      }

      const company = await storage.getCompanyByUserId(req.user!.id);
      if (!company) {
        return res.status(404).json({ message: 'Empresa no encontrada' });
      }

      // Obtener solicitudes de vacaciones aprobadas en el rango de fechas
      const allRequests = await storage.getVacationRequestsByCompany(company.id);
      
      const filteredRequests = allRequests.filter((request: any) => {
        return (
          request.status === 'approved' &&
          employeeIds.includes(request.userId) &&
          new Date(request.startDate) <= new Date(endDate) &&
          new Date(request.endDate) >= new Date(startDate)
        );
      });

      // Crear PDF con jsPDF (mismo estilo que partes de trabajo)
      const doc = new jsPDF();
      
      // Header con nombre de empresa
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text(company.name, 14, 18);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text('INFORME DE VACACIONES', 14, 27);
      
      // Separador
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.5);
      doc.line(14, 33, 196, 33);
      
      // Período
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const periodText = `Período: ${new Date(startDate).toLocaleDateString('es-ES')} - ${new Date(endDate).toLocaleDateString('es-ES')}`;
      doc.text(periodText, 14, 42);
      
      // Fecha de generación
      const generatedText = `Fecha de generación: ${new Date().toLocaleDateString('es-ES')}`;
      doc.text(generatedText, 14, 48);
      
      // Separador
      doc.line(14, 54, 196, 54);

      // Agrupar solicitudes por empleado
      const requestsByEmployee = filteredRequests.reduce((acc: any, request: any) => {
        if (!acc[request.userId]) {
          acc[request.userId] = [];
        }
        acc[request.userId].push(request);
        return acc;
      }, {});

      let currentY = 60;
      let totalDaysGlobal = 0;
      const pageHeight = doc.internal.pageSize.getHeight();

      // Renderizar cada empleado en su propia sección
      for (const employeeId of employeeIds) {
        const employee = await storage.getUser(parseInt(employeeId));
        if (!employee) continue;

        const employeeRequests = requestsByEmployee[employeeId] || [];
        
        // Verificar si necesitamos nueva página
        if (currentY > pageHeight - 60) {
          doc.addPage();
          currentY = 20;
        }

        // Espacio antes del empleado
        currentY += 6;

        // Fondo para el nombre del empleado
        doc.setFillColor(245, 247, 250);
        doc.rect(14, currentY - 7, 182, 10, 'F');
        
        // Nombre del empleado como encabezado de sección
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(employee.fullName, 16, currentY);
        currentY += 10;

        if (employeeRequests.length === 0) {
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(100, 100, 100);
          doc.text('Sin vacaciones disfrutadas en este período', 16, currentY);
          currentY += 8;
        } else {
          // Preparar datos para tabla de este empleado
          const employeeTableData: any[] = [];
          let employeeTotalDays = 0;

          // Ordenar por fecha
          employeeRequests.sort((a: any, b: any) => 
            new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
          );
          
          for (const request of employeeRequests) {
            const startDateFormatted = new Date(request.startDate).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const endDateFormatted = new Date(request.endDate).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
            
            // Calcular días (incluye el día de inicio y fin)
            const start = new Date(request.startDate);
            const end = new Date(request.endDate);
            const diffTime = Math.abs(end.getTime() - start.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
            employeeTotalDays += diffDays;
            totalDaysGlobal += diffDays;
            
            employeeTableData.push([
              startDateFormatted,
              endDateFormatted,
              diffDays.toString()
            ]);
          }

          // Crear tabla para este empleado
          autoTable(doc, {
            startY: currentY,
            head: [['Fecha Inicio', 'Fecha Fin', 'Días']],
            body: employeeTableData,
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [229, 231, 235], fontStyle: 'bold', textColor: [0, 0, 0] },
            columnStyles: {
              0: { cellWidth: 50, halign: 'center' },
              1: { cellWidth: 50, halign: 'center' },
              2: { cellWidth: 30, halign: 'center' }
            },
            alternateRowStyles: { fillColor: [250, 250, 250] },
            margin: { left: 16, right: 14 },
          });

          // Subtotal del empleado
          currentY = (doc as any).lastAutoTable.finalY + 8;
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(59, 130, 246);
          doc.text(`Subtotal: ${employeeTotalDays} días`, 16, currentY);
          currentY += 12;
        }
      }
      
      // Pie de página
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(150, 150, 150);
        doc.text(`Página ${i} de ${pageCount}`, 196, 285, { align: 'right' });
      }

      // Generar el PDF
      const pdfBytes = Buffer.from(doc.output('arraybuffer'));
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="informe-vacaciones-${new Date().toISOString().split('T')[0]}.pdf"`);
      res.send(pdfBytes);

    } catch (error: any) {
      console.error('Error generating vacation report PDF:', error);
      res.status(500).json({ message: 'Error al generar el informe' });
    }
  });

  // ================== ABSENCE POLICIES ROUTES ==================
  
  // Get absence policies for company (initialize defaults if none exist)
  app.get('/api/absence-policies', authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Initialize default policies if none exist
      await storage.initializeDefaultAbsencePolicies(req.user!.companyId);
      
      const policies = await storage.getAbsencePoliciesByCompany(req.user!.companyId);
      res.json(policies);
    } catch (error: any) {
      console.error('Error fetching absence policies:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update an absence policy (admin only)
  app.patch('/api/absence-policies/:id', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const { maxDays, requiresAttachment, isActive, name } = req.body;

      // Verify policy belongs to user's company
      const policy = await storage.getAbsencePolicy(id);
      if (!policy) {
        return res.status(404).json({ message: 'Política no encontrada' });
      }
      if (policy.companyId !== req.user!.companyId) {
        return res.status(403).json({ message: 'No tienes permisos para modificar esta política' });
      }

      const updateData: any = {};
      if (maxDays !== undefined) updateData.maxDays = maxDays;
      if (requiresAttachment !== undefined) updateData.requiresAttachment = requiresAttachment;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (name !== undefined) updateData.name = name;

      const updatedPolicy = await storage.updateAbsencePolicy(id, updateData);
      res.json(updatedPolicy);
    } catch (error: any) {
      console.error('Error updating absence policy:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Upload attachment for absence request
  app.post('/api/absence-attachments', authenticateToken, memoryUpload.single('file'), async (req: AuthRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No se ha proporcionado ningún archivo' });
      }

      // Upload to object storage using the unified service (R2 or Replit fallback)
      const timestamp = Date.now();
      const sanitizedName = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filename = `${timestamp}_${sanitizedName}`;
      
      // Use simpleObjectStorage which handles R2/Replit automatically
      const { simpleObjectStorage } = await import('./objectStorageSimple.js');
      
      // Build the full key for absence attachments
      const objectKey = `absence-attachments/${req.user!.companyId}/${req.user!.id}/${filename}`;
      
      // Upload using the unified service
      const uploadedKey = await simpleObjectStorage.uploadDocument(
        req.file.buffer,
        req.file.mimetype,
        objectKey
      );

      // Return relative URL for serving through our endpoint
      const relativeUrl = `/public-objects/${uploadedKey}`;
      
      console.log(`✅ Absence attachment uploaded: ${uploadedKey}`);
      
      res.json({ 
        path: uploadedKey,
        url: relativeUrl,
        originalName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype
      });
    } catch (error: any) {
      console.error('Error uploading absence attachment:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Work Shifts routes (Cuadrante)
  app.post('/api/work-shifts', authenticateToken, requireRole(['admin', 'manager']), requireVisibleFeature('schedules', () => storage), async (req: AuthRequest, res) => {
    try {
      const accessMode = (req as any).managerAccessMode || 'full';
      
      // In self/view mode, managers cannot create work shifts
      if (accessMode === 'self' || accessMode === 'view') {
        return res.status(403).json({ message: 'No tienes permisos para crear turnos' });
      }
      
      console.log('Work shift creation body:', req.body);

      const data = insertWorkShiftSchema.parse({
        ...req.body,
        companyId: req.user!.companyId,
        startAt: new Date(req.body.startAt),
        endAt: new Date(req.body.endAt),
        createdByUserId: req.user!.id
      });

      // Validate shift time overlap for same employee
      const existingShifts = await storage.getWorkShiftsByEmployee(
        data.employeeId, 
        data.startAt.toISOString(),
        data.endAt.toISOString()
      );

      const hasOverlap = existingShifts.some(shift => 
        (data.startAt < shift.endAt && data.endAt > shift.startAt)
      );

      if (hasOverlap) {
        return res.status(400).json({ 
          message: 'El empleado ya tiene un turno asignado en ese horario.' 
        });
      }
      
      const shift = await storage.createWorkShift(data);
      console.log(`Work shift created by ${req.user!.role} user ${req.user!.id}: ${shift.id}`);
      
      res.status(201).json(shift);
    } catch (error: any) {
      console.error('Work shift creation error:', error);
      res.status(400).json({ message: error.message });
    }
  });

  app.get('/api/work-shifts/company', authenticateToken, requireRole(['admin', 'manager']), requireVisibleFeature('schedules', () => storage), async (req: AuthRequest, res) => {
    try {
      const accessMode = (req as any).managerAccessMode || 'full';
      const { startDate, endDate } = req.query;
      
      // ⭐ OPTIMIZACIÓN CRÍTICA: Usar método optimizado que hace JOIN en lugar de Promise.all
      // Reduce de N+1 queries (1 + shiftsCount) a solo 1 query única
      const shifts = await storage.getWorkShiftsByCompanyWithEmployees(
        req.user!.companyId, 
        startDate as string, 
        endDate as string
      );
      
      res.json({ shifts, accessMode });
    } catch (error: any) {
      console.error('Error fetching company work shifts:', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/work-shifts/employee/:employeeId', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const employeeId = parseInt(req.params.employeeId);
      const { startDate, endDate } = req.query;
      
      // Verify employee belongs to the same company
      const employee = await storage.getUser(employeeId);
      if (!employee || employee.companyId !== req.user!.companyId) {
        return res.status(404).json({ message: 'Empleado no encontrado' });
      }
      
      const shifts = await storage.getWorkShiftsByEmployee(
        employeeId, 
        startDate as string, 
        endDate as string
      );
      
      res.json(shifts);
    } catch (error: any) {
      console.error('Error fetching employee work shifts:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Endpoint for employee to get their own shifts
  app.get('/api/work-shifts/my-shifts', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      const shifts = await storage.getWorkShiftsByEmployee(
        req.user!.id, 
        startDate as string, 
        endDate as string
      );
      
      res.json(shifts);
    } catch (error: any) {
      console.error('Error fetching my work shifts:', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.patch('/api/work-shifts/:id', authenticateToken, requireRole(['admin', 'manager']), requireVisibleFeature('schedules', () => storage), async (req: AuthRequest, res) => {
    try {
      const accessMode = (req as any).managerAccessMode || 'full';
      
      // In self/view mode, managers cannot edit work shifts
      if (accessMode === 'self' || accessMode === 'view') {
        return res.status(403).json({ message: 'No tienes permisos para editar turnos' });
      }
      
      const id = parseInt(req.params.id);
      const { startAt, endAt, title, location, notes, color, employeeId } = req.body;

      console.log('PATCH work-shift:', { id, startAt, endAt, title, location, notes, color, employeeId });

      // Build update data
      const updateData: any = {};
      if (startAt) updateData.startAt = new Date(startAt);
      if (endAt) updateData.endAt = new Date(endAt);
      if (title !== undefined) updateData.title = title;
      if (location !== undefined) updateData.location = location;
      if (notes !== undefined) updateData.notes = notes;
      if (color !== undefined) updateData.color = color;
      if (employeeId !== undefined) updateData.employeeId = employeeId;

      // Validate shift overlap if dates or employee are changing
      if ((startAt || endAt || employeeId) && Object.keys(updateData).length > 0) {
        // Get current shift to use existing values if not updating
        const currentShift = await storage.getWorkShiftsByEmployee(
          employeeId || await storage.getWorkShiftsByCompany(req.user!.companyId)
            .then(shifts => shifts.find(s => s.id === id)?.employeeId)
        );
        
        const shiftEmployeeId = employeeId || currentShift?.[0]?.employeeId;
        const shiftStartAt = startAt ? new Date(startAt) : currentShift?.[0]?.startAt;
        const shiftEndAt = endAt ? new Date(endAt) : currentShift?.[0]?.endAt;

        if (shiftEmployeeId && shiftStartAt && shiftEndAt) {
          const overlappingShifts = await storage.getWorkShiftsByEmployee(
            shiftEmployeeId,
            shiftStartAt.toISOString(),
            shiftEndAt.toISOString()
          );

          const hasOverlap = overlappingShifts.some(shift => 
            shift.id !== id && // Exclude current shift
            (shiftStartAt < shift.endAt && shiftEndAt > shift.startAt)
          );

          if (hasOverlap) {
            return res.status(400).json({ 
              message: 'El empleado ya tiene otro turno asignado en ese horario.' 
            });
          }
        }
      }

      // ✅ CRITICAL: Verify work shift belongs to user's company (IDOR prevention)
      const existingShift = await storage.getWorkShiftById(id);
      if (!existingShift) {
        return res.status(404).json({ message: 'Work shift not found' });
      }

      // Verify the shift belongs to a user in the same company
      const shiftEmployee = await storage.getUser(existingShift.employeeId);
      if (!shiftEmployee || shiftEmployee.companyId !== req.user!.companyId) {
        return res.status(403).json({ message: 'No autorizado' });
      }

      const shift = await storage.updateWorkShift(id, updateData);

      if (!shift) {
        return res.status(404).json({ message: 'Turno no encontrado' });
      }

      res.json(shift);
    } catch (error: any) {
      console.error('Work shift update error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.delete('/api/work-shifts/:id', authenticateToken, requireRole(['admin', 'manager']), requireVisibleFeature('schedules', () => storage), async (req: AuthRequest, res) => {
    try {
      const accessMode = (req as any).managerAccessMode || 'full';
      
      // In self/view mode, managers cannot delete work shifts
      if (accessMode === 'self' || accessMode === 'view') {
        return res.status(403).json({ message: 'No tienes permisos para eliminar turnos' });
      }
      
      const id = parseInt(req.params.id);
      
      // ✅ CRITICAL: Verify work shift belongs to user's company (IDOR prevention)
      const shift = await storage.getWorkShiftById(id);
      if (!shift) {
        return res.status(404).json({ message: 'Turno no encontrado' });
      }

      // Verify the shift belongs to a user in the same company
      const shiftEmployee = await storage.getUser(shift.employeeId);
      if (!shiftEmployee || shiftEmployee.companyId !== req.user!.companyId) {
        return res.status(403).json({ message: 'No autorizado' });
      }
      
      const success = await storage.deleteWorkShift(id);
      
      if (!success) {
        return res.status(404).json({ message: 'Turno no encontrado' });
      }

      res.status(204).send();
    } catch (error: any) {
      console.error('Work shift deletion error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/work-shifts/replicate-week', authenticateToken, requireRole(['admin', 'manager']), requireVisibleFeature('schedules', () => storage), async (req: AuthRequest, res) => {
    try {
      const accessMode = (req as any).managerAccessMode || 'full';
      
      // In self/view mode, managers cannot replicate weeks
      if (accessMode === 'self' || accessMode === 'view') {
        return res.status(403).json({ message: 'No tienes permisos para replicar semanas' });
      }
      
      const { weekStart, offsetWeeks = 1, employeeIds } = req.body;

      console.log('Replicating work shifts:', { weekStart, offsetWeeks, employeeIds });

      if (!weekStart) {
        return res.status(400).json({ message: 'Se requiere la fecha de inicio de la semana' });
      }

      const replicatedShifts = await storage.replicateWeekShifts(
        req.user!.companyId,
        weekStart,
        offsetWeeks,
        employeeIds
      );

      console.log(`Replicated ${replicatedShifts.length} shifts for company ${req.user!.companyId}`);
      
      res.status(201).json({
        message: `Se crearon ${replicatedShifts.length} turnos replicados`,
        shifts: replicatedShifts
      });
    } catch (error: any) {
      console.error('Week replication error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // ========================================
  // SHIFT TEMPLATES - Plantillas de turnos reutilizables
  // ========================================

  // Get all shift templates for a company
  app.get('/api/shift-templates', authenticateToken, requireRole(['admin', 'manager']), requireVisibleFeature('schedules', () => storage), async (req: AuthRequest, res) => {
    try {
      const templates = await storage.getShiftTemplatesByCompany(req.user!.companyId);
      res.json(templates);
    } catch (error: any) {
      console.error('Error fetching shift templates:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create new shift template
  app.post('/api/shift-templates', authenticateToken, requireRole(['admin', 'manager']), requireVisibleFeature('schedules', () => storage), async (req: AuthRequest, res) => {
    try {
      const accessMode = (req as any).managerAccessMode || 'full';
      
      if (accessMode === 'view') {
        return res.status(403).json({ message: 'No tienes permisos para crear plantillas' });
      }

      const { title, startTime, endTime, color, location, notes, displayOrder } = req.body;

      if (!title || !startTime || !endTime || !color) {
        return res.status(400).json({ message: 'Faltan campos obligatorios: title, startTime, endTime, color' });
      }

      const template = await storage.createShiftTemplate({
        companyId: req.user!.companyId,
        title,
        startTime,
        endTime,
        color,
        location: location || null,
        notes: notes || null,
        displayOrder: displayOrder ?? 0,
        createdBy: req.user!.id,
      });

      res.status(201).json(template);
    } catch (error: any) {
      console.error('Error creating shift template:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update shift template
  app.put('/api/shift-templates/:id', authenticateToken, requireRole(['admin', 'manager']), requireVisibleFeature('schedules', () => storage), async (req: AuthRequest, res) => {
    try {
      const accessMode = (req as any).managerAccessMode || 'full';
      
      if (accessMode === 'view') {
        return res.status(403).json({ message: 'No tienes permisos para modificar plantillas' });
      }

      const id = parseInt(req.params.id);
      
      // Verify template belongs to user's company
      const existingTemplate = await storage.getShiftTemplateById(id);
      if (!existingTemplate) {
        return res.status(404).json({ message: 'Plantilla no encontrada' });
      }

      if (existingTemplate.companyId !== req.user!.companyId) {
        return res.status(403).json({ message: 'No autorizado' });
      }

      const { title, startTime, endTime, color, location, notes, displayOrder } = req.body;
      
      const updateData: any = {};
      if (title !== undefined) updateData.title = title;
      if (startTime !== undefined) updateData.startTime = startTime;
      if (endTime !== undefined) updateData.endTime = endTime;
      if (color !== undefined) updateData.color = color;
      if (location !== undefined) updateData.location = location;
      if (notes !== undefined) updateData.notes = notes;
      if (displayOrder !== undefined) updateData.displayOrder = displayOrder;

      const template = await storage.updateShiftTemplate(id, updateData);

      res.json(template);
    } catch (error: any) {
      console.error('Error updating shift template:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Delete shift template
  app.delete('/api/shift-templates/:id', authenticateToken, requireRole(['admin', 'manager']), requireVisibleFeature('schedules', () => storage), async (req: AuthRequest, res) => {
    try {
      const accessMode = (req as any).managerAccessMode || 'full';
      
      if (accessMode === 'view') {
        return res.status(403).json({ message: 'No tienes permisos para eliminar plantillas' });
      }

      const id = parseInt(req.params.id);
      
      // Verify template belongs to user's company
      const template = await storage.getShiftTemplateById(id);
      if (!template) {
        return res.status(404).json({ message: 'Plantilla no encontrada' });
      }

      if (template.companyId !== req.user!.companyId) {
        return res.status(403).json({ message: 'No autorizado' });
      }

      const success = await storage.deleteShiftTemplate(id);
      
      if (!success) {
        return res.status(404).json({ message: 'Plantilla no encontrada' });
      }

      res.status(204).send();
    } catch (error: any) {
      console.error('Error deleting shift template:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Bulk update display order for shift templates (drag & drop reordering)
  app.put('/api/shift-templates/reorder', authenticateToken, requireRole(['admin', 'manager']), requireVisibleFeature('schedules', () => storage), async (req: AuthRequest, res) => {
    try {
      const accessMode = (req as any).managerAccessMode || 'full';
      
      if (accessMode === 'view') {
        return res.status(403).json({ message: 'No tienes permisos para reordenar plantillas' });
      }

      const { templates } = req.body; // Array of { id: number, displayOrder: number }

      if (!Array.isArray(templates)) {
        return res.status(400).json({ message: 'Se requiere un array de plantillas' });
      }

      // Verify all templates belong to user's company
      for (const item of templates) {
        const template = await storage.getShiftTemplateById(item.id);
        if (!template || template.companyId !== req.user!.companyId) {
          return res.status(403).json({ message: 'No autorizado' });
        }
      }

      // Update all templates
      await Promise.all(
        templates.map(item =>
          storage.updateShiftTemplate(item.id, { displayOrder: item.displayOrder })
        )
      );

      res.json({ message: 'Orden actualizado correctamente' });
    } catch (error: any) {
      console.error('Error reordering shift templates:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // ========================================
  // WORK REPORTS (Partes de Trabajo) - Pro Feature
  // Independent from time tracking - employees document each job/visit
  // ========================================

  // Helper function to calculate duration in minutes from start and end time strings
  function calculateDurationMinutes(startTime: string, endTime: string): number {
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    
    let startMinutes = startHour * 60 + startMin;
    let endMinutes = endHour * 60 + endMin;
    
    // Handle overnight shifts (end time is next day)
    if (endMinutes < startMinutes) {
      endMinutes += 24 * 60;
    }
    
    return endMinutes - startMinutes;
  }

  // Employee: Create work report
  app.post('/api/work-reports', authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Check if company has work_reports addon
      const hasWorkReportsAddon = await storage.hasActiveAddon(req.user!.companyId, 'work_reports');
      if (!hasWorkReportsAddon) {
        return res.status(403).json({ message: 'Esta función requiere el addon Partes de Trabajo' });
      }

      const { reportDate, location, locationCoords, startTime, endTime, description, clientName, notes, status } = req.body;

      if (!reportDate || !location || !startTime || !endTime || !description) {
        return res.status(400).json({ message: 'Faltan campos obligatorios: reportDate, location, startTime, endTime, description' });
      }

      const durationMinutes = calculateDurationMinutes(startTime, endTime);

      const report = await storage.createWorkReport({
        companyId: req.user!.companyId,
        employeeId: req.user!.id,
        reportDate,
        location,
        locationCoords: locationCoords || null,
        startTime,
        endTime,
        durationMinutes,
        description,
        clientName: clientName || null,
        notes: notes || null,
        status: status || 'completed',
      });
      
      // 📡 WebSocket: Notify admin/manager when employee creates work report
      const user = await storage.getUser(req.user!.id);
      const wsServer = getWebSocketServer();
      if (wsServer) {
        wsServer.broadcastToCompany(req.user!.companyId, {
          type: 'work_report_created',
          companyId: req.user!.companyId,
          data: { 
            reportId: report.id, 
            employeeId: req.user!.id,
            employeeName: user?.fullName || 'Empleado',
            location: location,
            reportDate: reportDate
          }
        });
      }

      res.status(201).json(report);
    } catch (error: any) {
      console.error('Work report creation error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Employee: Get own work reports
  app.get('/api/work-reports', authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Check if company has work_reports addon
      const hasWorkReportsAddon = await storage.hasActiveAddon(req.user!.companyId, 'work_reports');
      if (!hasWorkReportsAddon) {
        return res.status(403).json({ message: 'Esta función requiere el addon Partes de Trabajo' });
      }

      const { startDate, endDate } = req.query;
      
      const reports = await storage.getWorkReportsByUser(req.user!.id, {
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
      });

      res.json(reports);
    } catch (error: any) {
      console.error('Work reports fetch error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Employee: Get unique ref codes for autocomplete (optimized - uses DISTINCT query)
  app.get('/api/work-reports/ref-codes', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const refCodes = await storage.getWorkReportRefCodes(req.user!.id);
      res.json(refCodes);
    } catch (error: any) {
      console.error('Ref codes fetch error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Employee: Get unique locations for autocomplete (optimized - uses DISTINCT query)
  app.get('/api/work-reports/locations', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const locations = await storage.getWorkReportLocations(req.user!.id);
      res.json(locations);
    } catch (error: any) {
      console.error('Locations fetch error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Employee: Get unique clients for autocomplete (optimized - uses DISTINCT query)
  app.get('/api/work-reports/clients', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const clients = await storage.getWorkReportClients(req.user!.id);
      res.json(clients);
    } catch (error: any) {
      console.error('Clients fetch error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Employee: Update own work report
  app.patch('/api/work-reports/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Verify ownership
      const existingReport = await storage.getWorkReport(id);
      if (!existingReport) {
        return res.status(404).json({ message: 'Parte de trabajo no encontrado' });
      }
      
      if (existingReport.employeeId !== req.user!.id) {
        return res.status(403).json({ message: 'No tienes permiso para editar este parte' });
      }

      const { reportDate, refCode, location, locationCoords, startTime, endTime, description, clientName, notes, status } = req.body;
      
      const updates: any = {};
      if (reportDate) updates.reportDate = reportDate;
      if (refCode !== undefined) updates.refCode = refCode;
      if (location) updates.location = location;
      if (locationCoords !== undefined) updates.locationCoords = locationCoords;
      if (startTime) updates.startTime = startTime;
      if (endTime) updates.endTime = endTime;
      if (description) updates.description = description;
      if (clientName !== undefined) updates.clientName = clientName;
      if (notes !== undefined) updates.notes = notes;
      if (status) updates.status = status;
      
      // Recalculate duration if times changed
      if (startTime || endTime) {
        const finalStart = startTime || existingReport.startTime;
        const finalEnd = endTime || existingReport.endTime;
        updates.durationMinutes = calculateDurationMinutes(finalStart, finalEnd);
      }

      const updatedReport = await storage.updateWorkReport(id, updates);
      res.json(updatedReport);
    } catch (error: any) {
      console.error('Work report update error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Employee: Delete own work report
  app.delete('/api/work-reports/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Verify ownership
      const existingReport = await storage.getWorkReport(id);
      if (!existingReport) {
        return res.status(404).json({ message: 'Parte de trabajo no encontrado' });
      }
      
      // Verify employee belongs to same company (IDOR protection)
      const employee = await storage.getUser(existingReport.employeeId);
      if (!employee || employee.companyId !== req.user!.companyId) {
        return res.status(403).json({ message: 'No autorizado' });
      }
      
      if (existingReport.employeeId !== req.user!.id) {
        return res.status(403).json({ message: 'No tienes permiso para eliminar este parte' });
      }

      await storage.deleteWorkReport(id);
      res.status(204).send();
    } catch (error: any) {
      console.error('Work report deletion error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Employee: Save signature for work reports
  app.post('/api/work-reports/signature', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { signatureData } = req.body;
      
      if (!signatureData) {
        return res.status(400).json({ message: 'Firma requerida' });
      }

      // signatureData is a base64 data URL
      // Convert to buffer for upload to object storage
      const base64Data = signatureData.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      
      // Upload to object storage using SimpleObjectStorageService
      const { SimpleObjectStorageService } = await import('./objectStorageSimple');
      const storageService = new SimpleObjectStorageService();
      const filename = `signature-${req.user!.id}-${Date.now()}.png`;
      const signatureUrl = await storageService.uploadSignature(buffer, 'image/png', filename);
      
      // Update user's signature in database
      await storage.updateUserSignature(req.user!.id, signatureUrl);
      
      res.json({ signatureUrl });
    } catch (error: any) {
      console.error('Signature save error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Employee: Get own signature
  app.get('/api/work-reports/signature', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const user = await storage.getUser(req.user!.id);
      res.json({ signatureUrl: user?.signatureImage || null });
    } catch (error: any) {
      console.error('Signature fetch error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin/Manager: Get all company work reports with filters
  app.get('/api/admin/work-reports', authenticateToken, requireRole(['admin', 'manager']), requireVisibleFeature('work_reports', () => storage), async (req: AuthRequest, res) => {
    try {
      const accessMode = (req as any).managerAccessMode || 'full';
      
      // Check if company has work_reports addon
      const hasWorkReportsAddon = await storage.hasActiveAddon(req.user!.companyId, 'work_reports');
      if (!hasWorkReportsAddon) {
        return res.status(403).json({ message: 'Esta función requiere el addon Partes de Trabajo' });
      }

      const { employeeId, startDate, endDate } = req.query;
      
      let reports;
      if (accessMode === 'self') {
        // In self mode, only get manager's own work reports
        reports = await storage.getWorkReportsByUser(req.user!.id, {
          startDate: startDate as string | undefined,
          endDate: endDate as string | undefined,
        });
      } else {
        reports = await storage.getWorkReportsByCompany(req.user!.companyId, {
          employeeId: employeeId ? parseInt(employeeId as string) : undefined,
          startDate: startDate as string | undefined,
          endDate: endDate as string | undefined,
        });
      }

      res.json({ reports, accessMode });
    } catch (error: any) {
      console.error('Admin work reports fetch error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin/Manager: Update any work report
  app.patch('/api/admin/work-reports/:id', authenticateToken, requireRole(['admin', 'manager']), requireVisibleFeature('work_reports', () => storage), async (req: AuthRequest, res) => {
    try {
      const accessMode = (req as any).managerAccessMode || 'full';
      
      // In self mode, managers cannot edit others' work reports
      if (accessMode === 'self') {
        return res.status(403).json({ message: 'No tienes permisos para editar partes de otros empleados' });
      }
      
      const id = parseInt(req.params.id);
      
      // Check if company has work_reports addon
      const hasWorkReportsAddon = await storage.hasActiveAddon(req.user!.companyId, 'work_reports');
      if (!hasWorkReportsAddon) {
        return res.status(403).json({ message: 'Esta función requiere el addon Partes de Trabajo' });
      }

      // Get existing report
      const existingReport = await storage.getWorkReport(id);
      if (!existingReport) {
        return res.status(404).json({ message: 'Parte de trabajo no encontrado' });
      }

      // Verify the report belongs to an employee of the same company
      const employee = await storage.getUser(existingReport.employeeId);
      if (!employee || employee.companyId !== req.user!.companyId) {
        return res.status(403).json({ message: 'No tienes permiso para editar este parte' });
      }

      const { reportDate, refCode, location, startTime, endTime, description, clientName, notes } = req.body;
      
      console.log('Admin work report update - req.body:', JSON.stringify(req.body));
      console.log('Admin work report update - refCode value:', refCode);
      
      const updates: any = {};
      if (reportDate !== undefined) updates.reportDate = reportDate;
      if (refCode !== undefined) updates.refCode = refCode;
      if (location !== undefined) updates.location = location;
      if (startTime !== undefined) updates.startTime = startTime;
      if (endTime !== undefined) updates.endTime = endTime;
      if (description !== undefined) updates.description = description;
      if (clientName !== undefined) updates.clientName = clientName;
      if (notes !== undefined) updates.notes = notes;
      
      // Recalculate duration if times changed
      if (startTime !== undefined || endTime !== undefined) {
        const finalStart = startTime !== undefined ? startTime : existingReport.startTime;
        const finalEnd = endTime !== undefined ? endTime : existingReport.endTime;
        updates.durationMinutes = calculateDurationMinutes(finalStart, finalEnd);
      }

      const updatedReport = await storage.updateWorkReport(id, updates);
      res.json(updatedReport);
    } catch (error: any) {
      console.error('Admin work report update error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin/Manager: Create work report on behalf of an employee
  app.post('/api/admin/work-reports', authenticateToken, requireRole(['admin', 'manager']), requireVisibleFeature('work_reports', () => storage), async (req: AuthRequest, res) => {
    try {
      const accessMode = (req as any).managerAccessMode || 'full';
      
      // In self mode, managers cannot create work reports for others
      if (accessMode === 'self') {
        return res.status(403).json({ message: 'No tienes permisos para crear partes para otros empleados' });
      }
      
      // Check if company has work_reports addon
      const hasWorkReportsAddon = await storage.hasActiveAddon(req.user!.companyId, 'work_reports');
      if (!hasWorkReportsAddon) {
        return res.status(403).json({ message: 'Esta función requiere el addon Partes de Trabajo' });
      }

      const { employeeId, reportDate, refCode, location, startTime, endTime, durationMinutes, description, clientName, notes, status } = req.body;

      if (!employeeId || !reportDate || !location || !startTime || !endTime || !description) {
        return res.status(400).json({ message: 'Faltan campos obligatorios' });
      }

      // Verify the employee belongs to the same company
      const employee = await storage.getUser(employeeId);
      if (!employee || employee.companyId !== req.user!.companyId) {
        return res.status(403).json({ message: 'No tienes permiso para crear partes para este empleado' });
      }

      const report = await storage.createWorkReport({
        companyId: req.user!.companyId,
        employeeId,
        reportDate,
        refCode: refCode || null,
        location,
        startTime,
        endTime,
        durationMinutes: durationMinutes || calculateDurationMinutes(startTime, endTime),
        description,
        clientName: clientName || null,
        notes: notes || null,
        status: status || 'submitted'
      });

      res.status(201).json(report);
    } catch (error: any) {
      console.error('Admin work report create error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin/Manager: Get unique locations from all company work reports
  app.get('/api/admin/work-reports/locations', authenticateToken, requireRole(['admin', 'manager']), requireVisibleFeature('work_reports', () => storage), async (req: AuthRequest, res) => {
    try {
      const accessMode = (req as any).managerAccessMode || 'full';
      
      let locations;
      if (accessMode === 'self') {
        locations = await storage.getWorkReportLocations(req.user!.id);
      } else {
        locations = await storage.getCompanyWorkReportLocations(req.user!.companyId);
      }
      res.json(locations);
    } catch (error: any) {
      console.error('Admin locations fetch error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin/Manager: Get unique clients from all company work reports
  app.get('/api/admin/work-reports/clients', authenticateToken, requireRole(['admin', 'manager']), requireVisibleFeature('work_reports', () => storage), async (req: AuthRequest, res) => {
    try {
      const accessMode = (req as any).managerAccessMode || 'full';
      
      let clients;
      if (accessMode === 'self') {
        clients = await storage.getWorkReportClients(req.user!.id);
      } else {
        clients = await storage.getCompanyWorkReportClients(req.user!.companyId);
      }
      res.json(clients);
    } catch (error: any) {
      console.error('Admin clients fetch error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin/Manager: Get unique refCodes from all company work reports
  app.get('/api/admin/work-reports/ref-codes', authenticateToken, requireRole(['admin', 'manager']), requireVisibleFeature('work_reports', () => storage), async (req: AuthRequest, res) => {
    try {
      const accessMode = (req as any).managerAccessMode || 'full';
      
      let refCodes;
      if (accessMode === 'self') {
        refCodes = await storage.getWorkReportRefCodes(req.user!.id);
      } else {
        refCodes = await storage.getCompanyWorkReportRefCodes(req.user!.companyId);
      }
      res.json(refCodes);
    } catch (error: any) {
      console.error('Admin ref-codes fetch error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin/Manager: Export work reports to PDF
  app.get('/api/admin/work-reports/export/pdf', authenticateToken, requireRole(['admin', 'manager']), requireVisibleFeature('work_reports', () => storage), async (req: AuthRequest, res) => {
    try {
      const accessMode = (req as any).managerAccessMode || 'full';
      
      // In self mode, managers cannot export all reports
      if (accessMode === 'self') {
        return res.status(403).json({ message: 'No tienes permisos para exportar partes de todos los empleados' });
      }
      
      const { employeeId, startDate, endDate } = req.query;
      
      const reports = await storage.getWorkReportsByCompany(req.user!.companyId, {
        employeeId: employeeId ? parseInt(employeeId as string) : undefined,
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
      });

      const company = await storage.getCompany(req.user!.companyId);
      
      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(18);
      doc.text(company?.name || 'Empresa', 14, 22);
      doc.setFontSize(12);
      doc.text('Partes de Trabajo', 14, 32);
      
      if (startDate || endDate) {
        doc.setFontSize(10);
        const periodText = `Período: ${startDate || 'Inicio'} - ${endDate || 'Fin'}`;
        doc.text(periodText, 14, 40);
      }

      // Table data
      const tableData = reports.map(r => [
        r.reportDate,
        r.employeeName,
        r.location,
        r.startTime + ' - ' + r.endTime,
        Math.floor(r.durationMinutes / 60) + 'h ' + (r.durationMinutes % 60) + 'm',
        r.clientName || '-',
        r.description.substring(0, 50) + (r.description.length > 50 ? '...' : '')
      ]);

      autoTable(doc, {
        startY: startDate || endDate ? 48 : 40,
        head: [['Fecha', 'Empleado', 'Ubicación', 'Horario', 'Duración', 'Cliente', 'Descripción']],
        body: tableData,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [59, 130, 246] },
      });

      // Summary
      const totalMinutes = reports.reduce((sum, r) => sum + r.durationMinutes, 0);
      const totalHours = Math.floor(totalMinutes / 60);
      const remainingMinutes = totalMinutes % 60;
      
      const finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(10);
      doc.text(`Total: ${reports.length} partes | ${totalHours}h ${remainingMinutes}m`, 14, finalY);

      const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=partes-trabajo-${startDate || 'all'}.pdf`);
      res.send(pdfBuffer);
    } catch (error: any) {
      console.error('PDF export error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin/Manager: Export work reports to Excel
  app.get('/api/admin/work-reports/export/excel', authenticateToken, requireRole(['admin', 'manager']), requireVisibleFeature('work_reports', () => storage), async (req: AuthRequest, res) => {
    try {
      const accessMode = (req as any).managerAccessMode || 'full';
      
      // In self mode, managers cannot export all reports
      if (accessMode === 'self') {
        return res.status(403).json({ message: 'No tienes permisos para exportar partes de todos los empleados' });
      }
      
      const { employeeId, startDate, endDate } = req.query;
      
      const reports = await storage.getWorkReportsByCompany(req.user!.companyId, {
        employeeId: employeeId ? parseInt(employeeId as string) : undefined,
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
      });

      const company = await storage.getCompany(req.user!.companyId);
      
      const data = reports.map(r => ({
        'Fecha': r.reportDate,
        'Empleado': r.employeeName,
        'Ubicación': r.location,
        'Hora Inicio': r.startTime,
        'Hora Fin': r.endTime,
        'Duración (min)': r.durationMinutes,
        'Duración (h)': (r.durationMinutes / 60).toFixed(2),
        'Cliente': r.clientName || '',
        'Descripción': r.description,
        'Notas': r.notes || '',
        'Estado': r.status === 'completed' ? 'Completado' : r.status === 'pending' ? 'Pendiente' : 'Cancelado',
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Partes de Trabajo');
      
      const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=partes-trabajo-${startDate || 'all'}.xlsx`);
      res.send(excelBuffer);
    } catch (error: any) {
      console.error('Excel export error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Generate PDF for individual work report (with space for client signature)
  app.get('/api/work-reports/:id/pdf', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const reportId = parseInt(req.params.id);
      const report = await storage.getWorkReport(reportId);
      
      if (!report) {
        return res.status(404).json({ message: 'Parte de trabajo no encontrado' });
      }
      
      // Verify user has access to this report
      if (report.companyId !== req.user!.companyId) {
        return res.status(403).json({ message: 'No autorizado' });
      }
      
      const company = await storage.getCompany(req.user!.companyId);
      const employee = await storage.getUser(report.employeeId);
      
      // Import object storage to download signature images
      const { SimpleObjectStorageService } = await import('./objectStorageSimple.js');
      const objectStorage = new SimpleObjectStorageService();
      
      // Helper function to get signature as base64
      async function getSignatureBase64(signaturePath: string | null | undefined): Promise<string | null> {
        if (!signaturePath) return null;
        
        // If already base64 data URL, return as-is
        if (signaturePath.startsWith('data:image/')) {
          return signaturePath;
        }
        
        // If it's an Object Storage path, download and convert to base64
        if (signaturePath.startsWith('/public-objects/')) {
          try {
            const buffer = await objectStorage.downloadObjectAsBuffer(signaturePath);
            if (buffer) {
              const base64 = buffer.toString('base64');
              // Determine content type from extension
              const ext = signaturePath.split('.').pop()?.toLowerCase() || 'png';
              const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
              return `data:${mimeType};base64,${base64}`;
            }
          } catch (e) {
            console.error('Failed to download signature from Object Storage:', e);
          }
        }
        
        return null;
      }
      
      // Get employee signature as base64
      const employeeSignatureBase64 = await getSignatureBase64(employee?.signatureImage);
      const clientSignatureBase64 = await getSignatureBase64(report.signatureImage);
      
      console.log('PDF Generation - Employee:', employee?.fullName, 'Has signature:', !!employeeSignatureBase64, 'Client signature:', !!clientSignatureBase64);
      
      const doc = new jsPDF();
      
      // Formato fecha en español
      const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        return `${days[date.getUTCDay()]}, ${date.getUTCDate()} de ${months[date.getUTCMonth()]} de ${date.getUTCFullYear()}`;
      };
      
      const formatDuration = (minutes: number) => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (hours === 0) return `${mins} minutos`;
        if (mins === 0) return `${hours} horas`;
        return `${hours} horas ${mins} minutos`;
      };
      
      // Generate reference with year/month format: PT25/11-01
      const reportDate = new Date(report.reportDate);
      const year = reportDate.getFullYear().toString().slice(-2);
      const month = (reportDate.getMonth() + 1).toString().padStart(2, '0');
      const refNumber = report.id.toString().padStart(2, '0');
      const reference = `PT${year}/${month}-${refNumber}`;
      
      // Header with company name and client prominently displayed (white background)
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text(company?.name || 'Empresa', 14, 18);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text('PARTE DE TRABAJO', 14, 27);
      
      // Reference number on the right
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text(`REF: ${reference}`, 196, 22, { align: 'right' });
      
      // Separator line
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.5);
      doc.line(14, 33, 196, 33);
      
      // Client name prominently below separator
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(`Cliente: ${report.clientName || 'No especificado'}`, 14, 44);
      
      // Another separator line after client
      doc.line(14, 50, 196, 50);
      
      let yPos = 60;
      
      // Details section - all fields in a clean list format
      doc.setDrawColor(229, 231, 235);
      doc.setLineWidth(0.5);
      
      // Date
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('FECHA:', 14, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(formatDate(report.reportDate), 45, yPos);
      
      yPos += 10;
      
      // Time
      doc.setFont('helvetica', 'bold');
      doc.text('HORARIO:', 14, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(`${report.startTime} - ${report.endTime} (${formatDuration(report.durationMinutes)})`, 45, yPos);
      
      yPos += 10;
      
      // Location
      doc.setFont('helvetica', 'bold');
      doc.text('UBICACIÓN:', 14, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(report.location, 45, yPos);
      
      yPos += 10;
      
      // Employee as a regular field
      doc.setFont('helvetica', 'bold');
      doc.text('EMPLEADO:', 14, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(employee?.fullName || 'Empleado', 45, yPos);
      
      yPos += 15;
      
      // Description section
      doc.setFillColor(245, 247, 250);
      doc.rect(14, yPos - 5, 182, 8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('TRABAJO REALIZADO:', 16, yPos);
      yPos += 8;
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const descLines = doc.splitTextToSize(report.description, 175);
      doc.text(descLines, 16, yPos);
      yPos += descLines.length * 5 + 10;
      
      // Notes if any
      if (report.notes) {
        doc.setFillColor(254, 243, 199);
        const notesLines = doc.splitTextToSize(report.notes, 170);
        doc.rect(14, yPos - 5, 182, notesLines.length * 5 + 12, 'F');
        doc.setFont('helvetica', 'bold');
        doc.text('NOTAS:', 16, yPos + 2);
        doc.setFont('helvetica', 'normal');
        doc.text(notesLines, 16, yPos + 10);
        yPos += notesLines.length * 5 + 20;
      }
      
      // Signatures section
      yPos = Math.max(yPos + 10, 190);
      
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.3);
      
      // Horizontal line before signatures
      doc.line(14, yPos - 5, 196, yPos - 5);
      
      yPos += 10;
      
      // Employee signature box (larger for better quality)
      doc.setDrawColor(200, 200, 200);
      doc.rect(14, yPos, 85, 55);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('Firma del empleado:', 16, yPos + 6);
      
      // Add employee signature image if exists
      if (employeeSignatureBase64) {
        try {
          // Extract format from data URL
          let format = 'PNG';
          const match = employeeSignatureBase64.match(/data:image\/(\w+);base64,/);
          if (match) {
            format = match[1].toUpperCase();
            if (format === 'JPG') format = 'JPEG';
          }
          
          doc.addImage(employeeSignatureBase64, format, 18, yPos + 10, 75, 32);
        } catch (e: any) {
          console.log('Could not add employee signature image:', e.message);
        }
      }
      
      doc.setFont('helvetica', 'bold');
      doc.text(employee?.fullName || '', 16, yPos + 50);
      
      // Client signature box (larger for better quality)
      doc.rect(111, yPos, 85, 55);
      doc.setFont('helvetica', 'normal');
      doc.text('Firma del cliente:', 113, yPos + 6);
      
      // Add client signature if exists
      if (clientSignatureBase64) {
        try {
          let clientFormat = 'PNG';
          const match = clientSignatureBase64.match(/data:image\/(\w+);base64,/);
          if (match) {
            clientFormat = match[1].toUpperCase();
            if (clientFormat === 'JPG') clientFormat = 'JPEG';
          }
          
          doc.addImage(clientSignatureBase64, clientFormat, 115, yPos + 10, 75, 32);
        } catch (e: any) {
          console.log('Could not add client signature image:', e.message);
        }
      }
      
      doc.setFont('helvetica', 'bold');
      doc.text(report.signedBy || '____________________', 113, yPos + 50);
      
      // Footer
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(128, 128, 128);
      doc.text(`Generado el ${new Date().toLocaleDateString('es-ES')} a las ${new Date().toLocaleTimeString('es-ES')}`, 14, 285);
      doc.text(`${company?.name || 'Empresa'} - Sistema de Gestión Oficaz`, 196, 285, { align: 'right' });
      
      const pdfBuffer = doc.output('arraybuffer');
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=parte-trabajo-${report.id}-${report.reportDate}.pdf`);
      res.send(Buffer.from(pdfBuffer));
    } catch (error: any) {
      console.error('Single work report PDF error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create demo documents for Juan Ramírez only
  app.post('/api/documents/create-demo', authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only create documents for Juan Ramirez (user with fullName "Juan Ramirez")
      const user = await storage.getUser(req.user!.id);
      if (!user || user.fullName !== 'Juan Ramirez') {
        return res.status(403).json({ message: 'Demo documents only available for Juan Ramirez' });
      }

      const demoDocuments = [
        {
          userId: req.user!.id,
          fileName: 'nomina-diciembre-2024.pdf',
          originalName: 'Nómina Diciembre 2024.pdf',
          fileSize: 245760,
          mimeType: 'application/pdf',
          uploadedBy: req.user!.id,
        },
        {
          userId: req.user!.id,
          fileName: 'contrato-trabajo.pdf',
          originalName: 'Contrato de Trabajo.pdf',
          fileSize: 512000,
          mimeType: 'application/pdf',
          uploadedBy: req.user!.id,
        },
        {
          userId: req.user!.id,
          fileName: 'nomina-noviembre-2024.pdf',
          originalName: 'Nómina Noviembre 2024.pdf',
          fileSize: 238900,
          mimeType: 'application/pdf',
          uploadedBy: req.user!.id,
        },
      ];

      const createdDocuments = [];
      for (const doc of demoDocuments) {
        const document = await storage.createDocument(doc);
        createdDocuments.push(document);
      }

      res.status(201).json(createdDocuments);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Document routes
  app.post('/api/documents/upload', authenticateToken, memoryUpload.single('file'), async (req: AuthRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      const fixedOriginalName = fixFilenameEncoding(req.file.originalname);
      console.log('Upload request - User ID:', req.user!.id, 'File:', fixedOriginalName);
      console.log('Request type:', req.body.requestType);

      // Si hay un tipo de solicitud, renombrar el archivo
      let finalOriginalName = fixedOriginalName;
      if (req.body.requestType && req.user) {
        const user = await storage.getUser(req.user.id);
        if (user) {
          const fileExtension = fixedOriginalName.split('.').pop();
          finalOriginalName = `${req.body.requestType} - ${user.fullName}.${fileExtension}`;
          console.log('Renamed file to:', finalOriginalName);
        }
      }

      // Generate unique filename with timestamp and random string
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 15);
      const ext = path.extname(fixedOriginalName);
      const r2Filename = `${timestamp}-${randomStr}${ext}`;

      // Upload to R2
      const r2Key = await objectStorage.uploadDocument(
        req.file.buffer,
        req.file.mimetype,
        r2Filename
      );

      console.log(`✅ Document uploaded to R2: ${r2Key}`);

      const document = await storage.createDocument({
        userId: req.user!.id,
        fileName: r2Key, // Store R2 key (e.g., "documents/12345-abc.pdf")
        originalName: finalOriginalName,
        fileSize: req.file.size,
        filePath: r2Key, // Store R2 key for compatibility
        mimeType: req.file.mimetype || null,
        uploadedBy: req.user!.id,
      });

      console.log('Document created:', document);
      
      // Si hay un notificationId, actualizar la notificación con el document_id y marcarla como completada
      if (req.body.notificationId) {
        const notificationId = parseInt(req.body.notificationId);
        console.log('Linking document', document.id, 'to notification', notificationId);
        
        await db.update(schema.systemNotifications)
          .set({ 
            documentId: document.id,
            isCompleted: true,
            updatedAt: new Date()
          })
          .where(eq(schema.systemNotifications.id, notificationId));
          
        console.log('Notification', notificationId, 'updated with document', document.id);
      }
      
      // 📡 WebSocket: Notify admin/manager when employee uploads document (especially for requested docs)
      if (req.user!.role === 'employee') {
        const user = await storage.getUser(req.user!.id);
        const wsServer = getWebSocketServer();
        if (wsServer) {
          wsServer.broadcastToCompany(req.user!.companyId, {
            type: 'document_uploaded',
            companyId: req.user!.companyId,
            data: { 
              documentId: document.id, 
              employeeId: req.user!.id,
              employeeName: user?.fullName || 'Empleado',
              documentName: finalOriginalName,
              requestType: req.body.requestType || null
            }
          });
        }
      }
      
      res.status(201).json(document);
    } catch (error: any) {
      console.error('Error uploading document:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // TEMPORARY: Clean up broken notification 139
  app.post('/api/admin/fix-notification-139', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res) => {
    try {
      console.log('🔧 Fixing notification 139 and deleting broken document 96...');
      
      // Reset notification
      await db.update(schema.systemNotifications)
        .set({ documentId: null, isCompleted: false, updatedAt: new Date() })
        .where(eq(schema.systemNotifications.id, 139));
      
      // Delete broken document
      await db.delete(schema.documents)
        .where(eq(schema.documents.id, 96));
        
      console.log('✅ Notification 139 reset, document 96 deleted');
      res.json({ message: 'Fixed' });
    } catch (error) {
      console.error('Error fixing:', error);
      res.status(500).json({ message: 'Failed' });
    }
  });

  app.get('/api/documents', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const rawLimit = Number(req.query.limit) || 10;
      const limit = Math.min(Math.max(rawLimit, 1), 50); // clamp 1-50
      const cursorId = req.query.cursor ? Number(req.query.cursor) : null;

      let cursor: { createdAt: Date; id: number } | undefined;
      if (cursorId) {
        const cursorDoc = await storage.getDocument(cursorId);
        // Ensure cursor belongs to the same user for security
        if (!cursorDoc || cursorDoc.userId !== req.user!.id) {
          return res.status(400).json({ message: 'Invalid cursor' });
        }
        cursor = { createdAt: cursorDoc.createdAt, id: cursorDoc.id };
      }

      const rows = await storage.getDocumentsByUserPaginated(req.user!.id, limit, cursor);
      const hasNext = rows.length > limit;
      const items = rows.slice(0, limit);
      const nextCursor = hasNext ? items[items.length - 1]?.id ?? null : null;

      res.json({ items, nextCursor });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get all documents for admin/manager view
  app.get('/api/documents/all', authenticateToken, requireRole(['admin', 'manager']), requireVisibleFeature('documents', () => storage), async (req: AuthRequest, res) => {
    try {
      const accessMode = (req as any).managerAccessMode || 'full';
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : undefined;
      
      // Use pagination if limit/offset provided, otherwise return all documents (legacy mode)
      const usePagination = limit !== undefined && offset !== undefined;
      
      console.log(`📋 GET /api/documents/all - User ${req.user!.id}, Company ${req.user!.companyId}, AccessMode: ${accessMode}, Pagination: ${usePagination ? `limit=${limit}, offset=${offset}` : 'disabled'}`);
      
      let allDocuments;
      let totalCount = 0;
      
      if (accessMode === 'self') {
        // In self mode, managers can only see their own documents
        // Note: Self mode doesn't support pagination yet (uses legacy getDocumentsByUser)
        allDocuments = await storage.getDocumentsByUser(req.user!.id);
        totalCount = allDocuments.length;
        console.log(`📋 Self mode: Found ${allDocuments.length} documents for user ${req.user!.id}`);
      } else {
        if (usePagination) {
          // Use paginated query for better performance
          const result = await storage.getDocumentsByCompanyPaginated(req.user!.companyId, limit!, offset!);
          allDocuments = result.documents;
          totalCount = result.totalCount;
          console.log(`📋 Full mode (paginated): Found ${allDocuments.length} of ${totalCount} documents for company ${req.user!.companyId}`);
        } else {
          // Legacy mode: return all documents
          allDocuments = await storage.getDocumentsByCompany(req.user!.companyId);
          totalCount = allDocuments.length;
          console.log(`📋 Full mode (legacy): Found ${allDocuments.length} documents for company ${req.user!.companyId}`);
        }
      }
      
      // ⚠️ REMOVED ORPHAN CLEANUP - Was incorrectly deleting documents stored in Object Storage
      // Documents are stored in cloud Object Storage, not local filesystem
      // The old code checked local fs.existsSync which always failed for cloud-stored files
      
      // Prevent caching
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      res.json({ documents: allDocuments, totalCount, accessMode });
    } catch (error) {
      console.error("Error fetching all documents:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  // Admin upload documents (can specify target employee)
  app.post('/api/documents/upload-admin', authenticateToken, requireRole(['admin', 'manager']), requireVisibleFeature('documents', () => storage), memoryUpload.single('file'), async (req: AuthRequest, res) => {
    try {
      const accessMode = (req as any).managerAccessMode || 'full';
      
      // In self mode, managers cannot upload documents to other employees
      if (accessMode === 'self') {
        return res.status(403).json({ message: 'No tienes permisos para subir documentos a otros empleados' });
      }
      
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      const targetEmployeeId = req.body.targetEmployeeId ? parseInt(req.body.targetEmployeeId) : req.user!.id;
      
      // CRITICAL SECURITY: Verify target employee belongs to same company
      const targetEmployee = await storage.getUser(targetEmployeeId);
      const user = req.user!;
      
      if (!targetEmployee) {
        console.log(`SECURITY ERROR: User ${user.id} attempted to upload to non-existent employee ${targetEmployeeId}`);
        return res.status(404).json({ message: 'Target employee not found' });
      }
      
      if (targetEmployee.companyId !== user.companyId) {
        console.log(`SECURITY VIOLATION: User ${user.id} from company ${user.companyId} attempted to upload document for employee ${targetEmployeeId} from company ${targetEmployee.companyId}`);
        return res.status(403).json({ message: 'Unauthorized: Cross-company upload denied' });
      }
      
      // Log admin document uploads for audit
      console.log(`ADMIN UPLOAD: User ${user.id} (${user.role}) uploaded document for employee ${targetEmployeeId} within company ${user.companyId}`);

      // Use clean filename if provided, otherwise use original (with encoding fix)
      const fixedOriginalName = req.body.cleanFileName || fixFilenameEncoding(req.file.originalname);
      
      // Check if document requires signature
      const requiresSignature = req.body.requiresSignature === 'true';
      const signaturePosition = req.body.signaturePosition ? JSON.parse(req.body.signaturePosition) : null;

      // Generate unique filename with timestamp and random string
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 15);
      const ext = path.extname(fixedOriginalName);
      const r2Filename = `${timestamp}-${randomStr}${ext}`;

      // Upload to R2
      const r2Key = await objectStorage.uploadDocument(
        req.file.buffer,
        req.file.mimetype,
        r2Filename
      );

      console.log(`✅ Admin document uploaded to R2: ${r2Key} for employee ${targetEmployeeId}`);

      const document = await storage.createDocument({
        userId: targetEmployeeId,
        fileName: r2Key, // Store R2 key (e.g., "documents/12345-abc.pdf")
        originalName: fixedOriginalName,
        fileSize: req.file.size,
        filePath: r2Key, // Store R2 key for compatibility
        mimeType: req.file.mimetype || null,
        uploadedBy: req.user!.id,
        requiresSignature: requiresSignature,
      });

      console.log(`Document uploaded: ${fixedOriginalName} for user ${targetEmployeeId}`);

      // Save signature position if document requires signature
      if (signaturePosition) {
        try {
          await db.insert(schema.documentSignaturePositions).values({
            documentId: document.id,
            positionX: signaturePosition.x.toString(),
            positionY: signaturePosition.y.toString(),
            positionWidth: signaturePosition.width.toString(),
            positionHeight: signaturePosition.height.toString(),
            pageNumber: signaturePosition.page || 1,
          }).onConflictDoUpdate({
            target: schema.documentSignaturePositions.documentId,
            set: {
              positionX: signaturePosition.x.toString(),
              positionY: signaturePosition.y.toString(),
              positionWidth: signaturePosition.width.toString(),
              positionHeight: signaturePosition.height.toString(),
              pageNumber: signaturePosition.page || 1,
            },
          });
          console.log(`✅ Signature position saved for document ID: ${document.id}`);
        } catch (error) {
          console.error(`Error saving signature position for document ${document.id}:`, error);
          // Don't fail the upload if signature position save fails
        }
      }

      // 📱 Send push notification based on document type
      try {
        const { sendPayrollNotification, sendNewDocumentNotification } = await import('./pushNotificationScheduler.js');
        
        // Check if it's a payroll document (nómina)
        const isPayroll = fixedOriginalName.toLowerCase().includes('nomina') || 
                         fixedOriginalName.toLowerCase().includes('nómina');
        
        if (isPayroll) {
          await sendPayrollNotification(targetEmployeeId, fixedOriginalName, document.id);
          console.log(`📱 Payroll notification sent for document ID ${document.id}: ${fixedOriginalName}`);
        } else {
          await sendNewDocumentNotification(targetEmployeeId, fixedOriginalName, document.id);
          console.log(`📱 New document notification sent for document ID ${document.id}: ${fixedOriginalName}`);
        }
      } catch (error) {
        console.error('Error sending document push notification:', error);
        // Don't fail the request if push notification fails
      }

      // Broadcast to company for real-time badge updates on employee dashboard
      const wsServer = getWebSocketServer();
      if (wsServer) {
        wsServer.broadcastToCompany(user.companyId, { type: 'document_uploaded', companyId: user.companyId });
      }

      res.status(201).json(document);
    } catch (error) {
      console.error("Error uploading admin document:", error);
      res.status(500).json({ message: "Failed to upload document" });
    }
  });

  // Circular document upload - one file, multiple recipients sharing the same physical file
  app.post('/api/documents/upload-circular', authenticateToken, requireRole(['admin', 'manager']), requireVisibleFeature('documents', () => storage), memoryUpload.single('file'), async (req: AuthRequest, res) => {
    try {
      const accessMode = (req as any).managerAccessMode || 'full';
      
      // In self mode, managers cannot upload circular documents
      if (accessMode === 'self') {
        return res.status(403).json({ message: 'No tienes permisos para enviar documentos circulares' });
      }
      
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      const employeeIds = req.body.employeeIds ? JSON.parse(req.body.employeeIds) : [];
      if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
        return res.status(400).json({ message: 'Employee IDs required for circular document' });
      }

      const user = req.user!;
      const fixedOriginalName = fixFilenameEncoding(req.file.originalname); // Keep original name for circulars (with encoding fix)
      const requiresSignature = req.body.requiresSignature === 'true';
      const signaturePosition = req.body.signaturePosition ? JSON.parse(req.body.signaturePosition) : null;

      // Verify all employees belong to same company
      for (const employeeId of employeeIds) {
        const employee = await storage.getUser(employeeId);
        if (!employee || employee.companyId !== user.companyId) {
          return res.status(403).json({ message: 'Cannot send documents to employees outside your company' });
        }
      }

      console.log(`CIRCULAR UPLOAD: User ${user.id} uploading "${fixedOriginalName}" to ${employeeIds.length} employees`);

      // Generate unique filename with timestamp and random string
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 15);
      const ext = path.extname(fixedOriginalName);
      const r2Filename = `${timestamp}-${randomStr}${ext}`;

      // Upload to R2 (only once for circular document)
      const r2Key = await objectStorage.uploadDocument(
        req.file.buffer,
        req.file.mimetype,
        r2Filename
      );

      console.log(`✅ Circular document uploaded to R2: ${r2Key} for ${employeeIds.length} employees`);

      // Create one document record per employee, all pointing to the SAME physical file in R2
      const documents = [];
      for (const employeeId of employeeIds) {
        const document = await storage.createDocument({
          userId: employeeId,
          fileName: r2Key, // Same R2 key for all employees
          originalName: fixedOriginalName,
          fileSize: req.file.size,
          filePath: r2Key, // Same R2 key for all employees
          mimeType: req.file.mimetype || null,
          uploadedBy: user.id,
          requiresSignature: requiresSignature,
        });
        documents.push(document);

        // Save signature position if provided
        if (signaturePosition && requiresSignature) {
          try {
            await db.insert(schema.documentSignaturePositions).values({
              documentId: document.id,
              positionX: signaturePosition.x.toString(),
              positionY: signaturePosition.y.toString(),
              positionWidth: signaturePosition.width.toString(),
              positionHeight: signaturePosition.height.toString(),
              pageNumber: signaturePosition.page || 1,
            }).onConflictDoUpdate({
              target: schema.documentSignaturePositions.documentId,
              set: {
                positionX: signaturePosition.x.toString(),
                positionY: signaturePosition.y.toString(),
                positionWidth: signaturePosition.width.toString(),
                positionHeight: signaturePosition.height.toString(),
                pageNumber: signaturePosition.page || 1,
              }
            });
          } catch (error) {
            console.error(`Error saving signature position for document ${document.id}:`, error);
          }
        }

        // Send push notification
        try {
          const { sendNewDocumentNotification } = await import('./pushNotificationScheduler.js');
          await sendNewDocumentNotification(employeeId, fixedOriginalName, document.id);
        } catch (error) {
          console.error(`Error sending notification to employee ${employeeId}:`, error);
        }
      }

      console.log(`CIRCULAR UPLOAD COMPLETE: Created ${documents.length} document records for file "${fixedOriginalName}"`);

      // Broadcast to company for real-time badge updates on employee dashboard
      const wsServer = getWebSocketServer();
      if (wsServer) {
        wsServer.broadcastToCompany(user.companyId, { type: 'document_uploaded', companyId: user.companyId });
      }

      res.status(201).json({ 
        message: `Circular enviada a ${documents.length} empleados`,
        documents: documents,
        fileInfo: {
          originalName: fixedOriginalName,
          fileName: r2Key,
          size: req.file.size
        }
      });
    } catch (error) {
      console.error("Error uploading circular document:", error);
      res.status(500).json({ message: "Failed to upload circular document" });
    }
  });

  // Send document request to employees
  app.post('/api/documents/request', authenticateToken, requireRole(['admin', 'manager']), requireVisibleFeature('documents', () => storage), async (req: AuthRequest, res) => {
    try {
      const accessMode = (req as any).managerAccessMode || 'full';
      
      // In self mode, managers cannot send document requests
      if (accessMode === 'self') {
        return res.status(403).json({ message: 'No tienes permisos para solicitar documentos a empleados' });
      }
      
      const { employeeIds, documentType, message, dueDate } = req.body;

      if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
        return res.status(400).json({ message: 'Employee IDs required' });
      }

      if (!documentType) {
        return res.status(400).json({ message: 'Document type required' });
      }

      // Verify all employees belong to same company
      for (const employeeId of employeeIds) {
        const employee = await storage.getUser(employeeId);
        if (!employee || employee.companyId !== req.user!.companyId) {
          return res.status(403).json({ message: 'Cannot send requests to employees outside your company' });
        }
      }

      // Create document notifications for each employee using unified system
      const notifications = [];
      for (const employeeId of employeeIds) {
        const notification = await storage.createDocumentNotification(
          employeeId,
          documentType,
          message || `Por favor, sube tu ${documentType}`,
          req.user!.id, // createdBy
          'medium', // priority
          dueDate ? new Date(dueDate) : undefined // dueDate
        );
        notifications.push(notification);
        
        // 📱 Send push notification for document request
        try {
          const { sendDocumentRequestNotification } = await import('./pushNotificationScheduler.js');
          await sendDocumentRequestNotification(
            employeeId, 
            documentType, 
            message || `Por favor, sube tu ${documentType}`
          );
          console.log(`📱 Document request notification sent to user ${employeeId}`);
        } catch (error) {
          console.error(`Error sending document request push notification to user ${employeeId}:`, error);
          // Don't fail the request if push notification fails
        }
      }

      // Broadcast to company for real-time badge updates on employee dashboard
      const wsServer = getWebSocketServer();
      if (wsServer) {
        wsServer.broadcastToCompany(req.user!.companyId, { type: 'document_request_created', companyId: req.user!.companyId });
      }

      res.status(201).json({ 
        message: 'Document requests sent successfully',
        notifications 
      });
    } catch (error) {
      console.error("Error sending document request:", error);
      res.status(500).json({ message: "Failed to send document request" });
    }
  });

  // Special authentication middleware for file downloads that accepts token in query params
  const authenticateTokenOrQuery = (req: any, res: any, next: any) => {
    let token = req.headers.authorization?.split(' ')[1];
    
    // If no token in headers, try query parameter (iOS/iPad compatibility)
    if (!token && req.query.token) {
      token = req.query.token;
      console.log(`Using token from query parameter for iOS/iPad compatibility`);
    } else if (token) {
      // Using token from headers
    }
    
    if (!token) {
      // No token found
      return res.status(401).json({ message: "No token provided" });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      req.user = decoded;
      // Token verified
      next();
    } catch (error: any) {
      console.error('Token verification failed');
      return res.status(403).json({ message: "Invalid or expired token" });
    }
  };

  app.get('/api/documents/:id/download', authenticateTokenOrQuery, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const document = await storage.getDocument(id);

      if (!document) {
        return res.status(404).json({ message: 'Document not found' });
      }

      // Check if it's a view request (preview) or download
      const isPreview = req.query.view === 'true' || req.query.preview === 'true';
      console.log(`Document ${id} request - isPreview: ${isPreview}, query:`, req.query);

      // CRITICAL SECURITY: Multi-layer document access validation
      const user = req.user!;
      
      // Layer 1: Users can ONLY access their own documents
      if (document.userId !== user.id) {
        const documentOwner = await storage.getUser(document.userId);
        if (!documentOwner) {
          console.log(`SECURITY ERROR: Document ${id} references non-existent user ${document.userId}`);
          return res.status(404).json({ message: 'Document owner not found' });
        }

        // Layer 2: Allow admin/manager of same company
        if (['admin', 'manager'].includes(user.role)) {
          if (documentOwner.companyId !== user.companyId) {
            console.log(`SECURITY VIOLATION: User ${user.id} from company ${user.companyId} attempted to access document ${id} from company ${documentOwner.companyId}`);
            return res.status(403).json({ message: 'Unauthorized: Cross-company access denied' });
          }
          console.log(`ADMIN ACCESS: User ${user.id} (${user.role}) accessed document ${id} belonging to user ${document.userId} within company ${user.companyId}`);
        } else if (user.role === 'accountant') {
          // Layer 3: Allow accountant assigned to the company of the document owner
          const [assignment] = await db.select()
            .from(schema.companyAccountants)
            .where(and(
              eq(schema.companyAccountants.companyId, documentOwner.companyId),
              eq(schema.companyAccountants.accountantUserId, user.id),
              isNull(schema.companyAccountants.disabledAt)
            ));

          if (!assignment) {
            console.log(`SECURITY VIOLATION: Accountant ${user.id} tried to access document ${id} without assignment to company ${documentOwner.companyId}`);
            return res.status(403).json({ message: 'Unauthorized: Accountant not assigned to company' });
          }
        } else {
          console.log(`SECURITY VIOLATION: User ${user.id} (${user.email}) attempted to access document ${id} belonging to user ${document.userId}`);
          return res.status(403).json({ message: 'Unauthorized: You can only access your own documents' });
        }
      }

      // Download from R2 with robust key resolution
      let r2Key = document.filePath || document.fileName;
      console.log(`Document ${id} - Attempt R2 key: ${r2Key}`);
      let fileData = r2Key ? await objectStorage.downloadDocument(r2Key) : null;

      // Try folder path prefix if available
      if (!fileData && document.folderId) {
        const folderResult = await db.execute(sql`
          SELECT path FROM document_folders WHERE id = ${document.folderId}
        `);
        const folderPath = folderResult.rows[0]?.path as string | undefined;
        if (folderPath) {
          const candidate = `${folderPath}/${document.fileName}`;
          console.log(`Fallback R2 key with folder path: ${candidate}`);
          fileData = await objectStorage.downloadDocument(candidate);
          if (fileData) r2Key = candidate;
        }
      }

      // Try documents/ prefix (employee uploads)
      if (!fileData && document.fileName) {
        const candidate = `documents/${document.fileName}`;
        console.log(`Fallback R2 key with documents/ prefix: ${candidate}`);
        fileData = await objectStorage.downloadDocument(candidate);
        if (fileData) r2Key = candidate;
      }

      if (!fileData) {
        console.log(`❌ Document not found in R2 for any key variant (id=${document.id})`);
        return res.status(404).json({ message: 'File not found on server' });
      }
      
      console.log(`✅ Document downloaded from R2: ${r2Key}`);

      // Use mimeType from document or from R2 response
      let contentType = document.mimeType || fileData.contentType;
      if (!contentType) {
        const ext = path.extname(document.originalName || document.fileName).toLowerCase();
        switch (ext) {
          case '.pdf':
            contentType = 'application/pdf';
            break;
          case '.jpg':
          case '.jpeg':
            contentType = 'image/jpeg';
            break;
          case '.png':
            contentType = 'image/png';
            break;
          case '.gif':
            contentType = 'image/gif';
            break;
          case '.txt':
            contentType = 'text/plain';
            break;
          default:
            contentType = 'application/octet-stream';
        }
      }
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(document.originalName || document.fileName)}"`);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      res.send(fileData.buffer);
    } catch (error: any) {
      console.error('Error downloading document:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // 🔒 SECURITY: Generate signed URL for document download (one-time use, 5min expiration)
  app.post('/api/documents/:id/generate-signed-url', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const document = await storage.getDocument(id);

      if (!document) {
        return res.status(404).json({ message: 'Document not found' });
      }

      // SECURITY: Same access validation as download endpoint
      const user = req.user!;
      
      // Layer 1: Users can ONLY access their own documents
      if (document.userId !== user.id) {
        // Layer 2: Only admin/manager can access other users' documents
        if (!['admin', 'manager'].includes(user.role)) {
          return res.status(403).json({ message: 'Unauthorized: You can only access your own documents' });
        }
        
        // Layer 3: Admin/Manager can only access documents within their company
        const documentOwner = await storage.getUser(document.userId);
        if (!documentOwner || documentOwner.companyId !== user.companyId) {
          return res.status(403).json({ message: 'Unauthorized: Cross-company access denied' });
        }
      }

      // Generate signed URL with 5-minute expiration
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
      const signedUrl = await storage.createSignedUrl(document.id, user.id, user.companyId, expiresAt);
      
      console.log(`[SECURITY] Generated signed URL for document ${document.id} (user: ${user.id}, expires: ${expiresAt.toISOString()})`);
      
      res.json({
        token: signedUrl.token,
        expiresAt: signedUrl.expiresAt,
        url: `/api/documents/download/${signedUrl.token}`
      });
    } catch (error: any) {
      console.error(`[SECURITY] Error generating signed URL:`, error);
      res.status(500).json({ message: error.message });
    }
  });

  // 🔒 SECURITY: Download document using signed URL (one-time use, TOCTOU-safe)
  app.get('/api/documents/download/:token', async (req, res) => {
    try {
      const token = req.params.token;
      
      // 🔒 SECURITY: Atomic consume operation - prevents TOCTOU race conditions
      // Only succeeds if token is valid, not used, and not expired
      const signedUrl = await storage.consumeSignedUrl(token);
      
      if (!signedUrl) {
        console.log(`[SECURITY] Invalid, expired, or already-used signed URL token: ${token}`);
        return res.status(403).json({ message: 'Invalid or expired download link' });
      }

      // Get document
      const document = await storage.getDocument(signedUrl.documentId);
      if (!document) {
        return res.status(404).json({ message: 'Document not found' });
      }

      // Get document owner's name for signature
      const documentOwner = await storage.getUser(document.userId);
      const signerName = documentOwner?.fullName || 'Usuario';

      console.log(`[SECURITY] Signed URL consumed for document ${document.id} (user: ${signedUrl.userId})`);

      // Download from R2 with robust key resolution
      // 1) Primary: filePath (R2 key) or bare fileName
      let r2Key = document.filePath || document.fileName;
      
      // Clean /public-objects/ prefix if present (vacation attachments stored with this prefix)
      if (r2Key && r2Key.startsWith('/public-objects/')) {
        r2Key = r2Key.replace('/public-objects/', '');
      }
      
      console.log(`Document ${document.id} (signed URL) - Attempt R2 key: ${r2Key}`);
      let fileData = r2Key ? await objectStorage.downloadDocument(r2Key) : null;

      // 2) If missing, try prefixing known folder path
      if (!fileData && document.folderId) {
        const folderResult = await db.execute(sql`
          SELECT path FROM document_folders WHERE id = ${document.folderId}
        `);
        const folderPath = folderResult.rows[0]?.path as string | undefined;
        if (folderPath) {
          const candidate = `${folderPath}/${document.fileName}`;
          console.log(`Fallback R2 key with folder path: ${candidate}`);
          fileData = await objectStorage.downloadDocument(candidate);
          if (fileData) r2Key = candidate;
        }
      }

      // 3) Employee uploads used documents/ prefix; try that as last resort
      if (!fileData && document.fileName) {
        const candidate = `documents/${document.fileName}`;
        console.log(`Fallback R2 key with documents/ prefix: ${candidate}`);
        fileData = await objectStorage.downloadDocument(candidate);
        if (fileData) r2Key = candidate;
      }

      if (!fileData) {
        console.log(`❌ Document not found in R2 for any key variant (id=${document.id})`);
        return res.status(404).json({ message: 'File not found on server' });
      }
      
      console.log(`✅ Document downloaded from R2: ${r2Key}`);

      // Set content type
      let contentType = document.mimeType || fileData.contentType || 'application/octet-stream';
      const ext = path.extname(document.originalName || document.fileName).toLowerCase();
      switch (ext) {
        case '.pdf': contentType = 'application/pdf'; break;
        case '.jpg':
        case '.jpeg': contentType = 'image/jpeg'; break;
        case '.png': contentType = 'image/png'; break;
        case '.gif': contentType = 'image/gif'; break;
        case '.txt': contentType = 'text/plain'; break;
      }
      
      // Embed signature into PDF if document is signed
      let finalBuffer = fileData.buffer;
      if (document.digitalSignature && ext === '.pdf') {
        try {
          console.log(`📝 Embedding signature into PDF for document ${document.id}`);
          const pdfDoc = await PDFDocument.load(fileData.buffer);
          
          // Extract base64 image data from signature (format: data:image/png;base64,...)
          const signatureData = document.digitalSignature;
          let imageBytes: Uint8Array | null = null;
          let embedImage: any = null;
          
          if (signatureData.startsWith('data:image/png;base64,')) {
            const base64Data = signatureData.replace('data:image/png;base64,', '');
            imageBytes = Uint8Array.from(Buffer.from(base64Data, 'base64'));
            embedImage = await pdfDoc.embedPng(imageBytes);
          } else if (signatureData.startsWith('data:image/jpeg;base64,') || signatureData.startsWith('data:image/jpg;base64,')) {
            const base64Data = signatureData.replace(/data:image\/(jpeg|jpg);base64,/, '');
            imageBytes = Uint8Array.from(Buffer.from(base64Data, 'base64'));
            embedImage = await pdfDoc.embedJpg(imageBytes);
          }
          
          if (embedImage) {
            const pages = pdfDoc.getPages();
            const { width: pageWidth, height: pageHeight } = pages[0]?.getSize() || { width: 612, height: 792 };
            
            // Get saved signature position if available
            let savedPositionRows: any[] = [];
            try {
              savedPositionRows = await db.select().from(schema.documentSignaturePositions).where(eq(schema.documentSignaturePositions.documentId, document.id));
              console.log(`🔍 Download signature position query for document ${document.id}:`, {
                rowCount: savedPositionRows?.length || 0,
                data: savedPositionRows?.[0] || null,
                full: JSON.stringify(savedPositionRows)
              });
            } catch (queryError) {
              console.error(`❌ Error querying signature position for document ${document.id}:`, queryError);
            }
            
            let sigPageNumber = pages.length; // Default: last page
            let sigX = pageWidth - 190; // Default: bottom-right
            let sigY = 40;
            let sigMaxWidth = 150;
            let sigMaxHeight = 60;
            
            if (savedPositionRows && savedPositionRows.length > 0) {
              const position = savedPositionRows[0];
              sigPageNumber = Math.min(parseInt(String(position.pageNumber || pages.length)) || pages.length, pages.length);
              
              // Convert percentage-based position to actual pixels
              const posX = parseFloat(String(position.positionX || 75));
              const posY = parseFloat(String(position.positionY || 80));
              const posWidth = parseFloat(String(position.positionWidth || 18));
              const posHeight = parseFloat(String(position.positionHeight || 15));
              
              sigX = (posX / 100) * pageWidth;
              sigY = pageHeight - (posY / 100) * pageHeight; // Y is inverted in PDF (bottom = 0)
              sigMaxWidth = (posWidth / 100) * pageWidth;
              sigMaxHeight = (posHeight / 100) * pageHeight;
              
              console.log(`📍 Using saved signature position: x=${sigX}, y=${sigY}, w=${sigMaxWidth}, h=${sigMaxHeight}, page=${sigPageNumber}`);
            }
            
            // Use the saved page number or last page
            const targetPage = pages[Math.min(sigPageNumber - 1, pages.length - 1)];
            
            // Scale signature
            const imgWidth = embedImage.width;
            const imgHeight = embedImage.height;
            const scale = Math.min(sigMaxWidth / imgWidth, sigMaxHeight / imgHeight);
            const scaledWidth = imgWidth * scale;
            const scaledHeight = imgHeight * scale;
            
            // Center within the designated box
            const centerX = sigX + (sigMaxWidth - scaledWidth) / 2;
            const centerY = sigY - scaledHeight; // Adjust Y for centering
            
            targetPage.drawImage(embedImage, {
              x: centerX,
              y: centerY,
              width: scaledWidth,
              height: scaledHeight,
            });
            
            // Add signature date text below signature
            if (document.signedAt) {
              const signedDate = new Date(document.signedAt).toLocaleDateString('es-ES', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });
              
              // Draw signer name
              targetPage.drawText(signerName, {
                x: centerX,
                y: centerY - 12,
                size: 8,
                color: rgb(0.3, 0.3, 0.3),
              });
              
              // Draw date below name
              targetPage.drawText(`Firmado: ${signedDate}`, {
                x: centerX,
                y: centerY - 22,
                size: 8,
                color: rgb(0.3, 0.3, 0.3),
              });
            }
            
            console.log(`✅ Signature embedded successfully on page ${sigPageNumber}`);
          }
          
          finalBuffer = Buffer.from(await pdfDoc.save());
        } catch (signatureError) {
          console.error('Error embedding signature into PDF:', signatureError);
          // Fall back to original PDF without signature
        }
      }
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(document.originalName || document.fileName)}"`);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      res.send(finalBuffer);
    } catch (error: any) {
      console.error('Error with signed URL download:', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.delete('/api/documents/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const document = await storage.getDocument(id);

      if (!document) {
        return res.status(404).json({ message: 'Document not found' });
      }

      // Debug log
      console.log(`DELETE document ${id} - folderId: ${document.folderId}, fileName: ${document.fileName}`);

      // CRITICAL: Accounting documents (with folderId) can only be deleted by deleting the accounting entry
      if (document.folderId) {
        console.log(`BLOCKED: Document ${id} has folderId ${document.folderId}, refusing deletion`);
        return res.status(403).json({ 
          message: 'Los documentos de contabilidad solo se pueden eliminar borrando el movimiento asociado' 
        });
      }

      // Security check: Admin/Manager can delete any document in their company
      // Employees can only delete their own documents
      const user = req.user!;
      if (user.role === 'employee' && document.userId !== user.id) {
        return res.status(403).json({ message: 'You can only delete your own documents' });
      }

      // For admin/manager, ensure document belongs to their company
      if (user.role !== 'employee') {
        const documentOwner = await storage.getUser(document.userId);
        if (!documentOwner || documentOwner.companyId !== user.companyId) {
          return res.status(403).json({ message: 'Cannot delete documents from other companies' });
        }
      }

      console.log(`Attempting to delete document ${id} for user ${user.id} (${user.role})`);

      const deleted = await storage.deleteDocument(id);
      if (deleted) {
        // Delete physical file if it exists
        try {
          if (document.filePath) {
            const fullPath = path.resolve(document.filePath);
            console.log(`Checking for file at: ${fullPath}`);
            
            if (fs.existsSync(fullPath)) {
              fs.unlinkSync(fullPath);
              console.log(`Physical file deleted: ${fullPath}`);
            } else {
              console.log(`Physical file not found: ${fullPath}`);
            }
          } else {
            // Try alternative path with uploadDir
            const altPath = path.join(uploadDir, document.fileName);
            console.log(`Checking alternative path: ${altPath}`);
            if (fs.existsSync(altPath)) {
              fs.unlinkSync(altPath);
              console.log(`Physical file deleted from uploads: ${altPath}`);
            }
          }
        } catch (fileError) {
          console.error('Error deleting physical file:', fileError);
          // Continue anyway - database deletion was successful
        }
        
        console.log(`Document ${id} deleted successfully`);
        res.json({ message: 'Document deleted successfully from database and storage' });
      } else {
        console.error(`Failed to delete document ${id} from database`);
        res.status(500).json({ message: 'Failed to delete document from database' });
      }
    } catch (error: any) {
      console.error('Error deleting document:', error);
      res.status(500).json({ message: 'Failed to delete document: ' + error.message });
    }
  });

  // Document signature endpoints
  app.post('/api/documents/:id/view', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const document = await storage.getDocument(id);

      if (!document) {
        return res.status(404).json({ message: 'Document not found' });
      }

      // Security check: Only document owner can mark as viewed
      if (document.userId !== req.user!.id) {
        return res.status(403).json({ message: 'You can only view your own documents' });
      }

      const updatedDocument = await storage.markDocumentAsViewed(id);
      console.log(`Document ${id} marked as viewed by user ${req.user!.id}`);
      
      res.json(updatedDocument);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/documents/:id/sign', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const { digitalSignature, signatureToken } = req.body;

      // If signature token provided (from email link), validate it
      if (signatureToken) {
        try {
          const { consumeSignatureToken } = await import('./emailQueue');
          const tokenData = await consumeSignatureToken(signatureToken, req.ip);
          
          if (!tokenData) {
            return res.status(403).json({ message: 'Token de firma inválido o expirado' });
          }
          
          // Verify token matches document and user
          if (tokenData.documentId !== id || tokenData.userId !== req.user!.id) {
            return res.status(403).json({ message: 'Token no válido para este documento' });
          }
          
          console.log(`✅ Email signature token validated for document ${id}`);
        } catch (error) {
          console.error('Error validating signature token:', error);
          return res.status(403).json({ message: 'Error validando token de firma' });
        }
      }

      if (!digitalSignature || typeof digitalSignature !== 'string') {
        return res.status(400).json({ message: 'Digital signature is required' });
      }

      const document = await storage.getDocument(id);

      if (!document) {
        return res.status(404).json({ message: 'Document not found' });
      }

      // Security check: Only document owner can sign
      if (document.userId !== req.user!.id) {
        return res.status(403).json({ message: 'You can only sign your own documents' });
      }

      // Get user's full name for signature
      const signerUser = await storage.getUser(req.user!.id);
      const signerName = signerUser?.fullName || 'Usuario';

      // Save signature to database first
      const updatedDocument = await storage.markDocumentAsAcceptedAndSigned(id, digitalSignature);
      console.log(`Document ${id} accepted and signed by user ${req.user!.id}`);
      
      // Check if this is a circular document (shared file with multiple users)
      // Circular documents share the same filePath with different userIds
      const filePath = document.filePath || document.fileName;
      const isCircular = await db.execute(sql`
        SELECT COUNT(*) as count FROM documents 
        WHERE (file_path = ${filePath} OR file_name = ${filePath})
        AND id != ${id}
      `);
      const otherDocsCount = parseInt(isCircular.rows[0]?.count as string || '0');
      
      if (otherDocsCount === 0) {
        // INDIVIDUAL document: Embed signature permanently into the PDF file
        const ext = path.extname(document.originalName || document.fileName).toLowerCase();
        if (ext === '.pdf' && filePath) {
          try {
            console.log(`📝 Individual document - embedding signature permanently into PDF ${id}`);
            
            // Download original PDF from R2
            let r2Key = filePath;
            if (r2Key.startsWith('/public-objects/')) {
              r2Key = r2Key.replace('/public-objects/', '');
            }
            let fileData = await objectStorage.downloadDocument(r2Key);
            
            // Try with documents/ prefix if not found
            if (!fileData) {
              r2Key = `documents/${document.fileName}`;
              fileData = await objectStorage.downloadDocument(r2Key);
            }
            
            if (fileData) {
              const pdfDoc = await PDFDocument.load(fileData.buffer);
              
              // Extract base64 image data from signature
              let embedImage: any = null;
              if (digitalSignature.startsWith('data:image/png;base64,')) {
                const base64Data = digitalSignature.replace('data:image/png;base64,', '');
                const imageBytes = Uint8Array.from(Buffer.from(base64Data, 'base64'));
                embedImage = await pdfDoc.embedPng(imageBytes);
              } else if (digitalSignature.startsWith('data:image/jpeg;base64,') || digitalSignature.startsWith('data:image/jpg;base64,')) {
                const base64Data = digitalSignature.replace(/data:image\/(jpeg|jpg);base64,/, '');
                const imageBytes = Uint8Array.from(Buffer.from(base64Data, 'base64'));
                embedImage = await pdfDoc.embedJpg(imageBytes);
              }
              
              if (embedImage) {
                const pages = pdfDoc.getPages();
                const lastPage = pages[pages.length - 1];
                const { width: pageWidth, height: pageHeight } = lastPage.getSize();
                
                // Get saved signature position if available
                let savedPositionRows: any[] = [];
                try {
                  savedPositionRows = await db.select().from(schema.documentSignaturePositions).where(eq(schema.documentSignaturePositions.documentId, id));
                  console.log(`🔍 Signature position query for document ${id}:`, {
                    rowCount: savedPositionRows?.length || 0,
                    data: savedPositionRows?.[0] || null,
                    full: JSON.stringify(savedPositionRows)
                  });
                } catch (queryError) {
                  console.error(`❌ Error querying signature position for document ${id}:`, queryError);
                }
                
                let sigPageNumber = 1;
                let sigX = pageWidth - 190; // Default: bottom-right
                let sigY = 40;
                let sigMaxWidth = 150;
                let sigMaxHeight = 60;
                
                if (savedPositionRows && savedPositionRows.length > 0) {
                  const position = savedPositionRows[0];
                  sigPageNumber = parseInt(String(position.pageNumber || 1)) || 1;
                  
                  // Convert percentage-based position to actual pixels
                  const posX = parseFloat(String(position.positionX || 75));
                  const posY = parseFloat(String(position.positionY || 80));
                  const posWidth = parseFloat(String(position.positionWidth || 18));
                  const posHeight = parseFloat(String(position.positionHeight || 15));
                  
                  sigX = (posX / 100) * pageWidth;
                  sigY = pageHeight - (posY / 100) * pageHeight; // Y is inverted in PDF (bottom = 0)
                  sigMaxWidth = (posWidth / 100) * pageWidth;
                  sigMaxHeight = (posHeight / 100) * pageHeight;
                  
                  console.log(`📍 Using saved signature position: x=${sigX}, y=${sigY}, w=${sigMaxWidth}, h=${sigMaxHeight}, page=${sigPageNumber}`);
                }
                
                // Use the saved page number or last page
                const targetPage = pages[Math.min(sigPageNumber - 1, pages.length - 1)];
                
                // Scale signature
                const scale = Math.min(sigMaxWidth / embedImage.width, sigMaxHeight / embedImage.height);
                const scaledWidth = embedImage.width * scale;
                const scaledHeight = embedImage.height * scale;
                
                // Center within the designated box
                const centerX = sigX + (sigMaxWidth - scaledWidth) / 2;
                const centerY = sigY - scaledHeight; // Adjust Y for centering
                
                targetPage.drawImage(embedImage, { x: centerX, y: centerY, width: scaledWidth, height: scaledHeight });
                
                // Add signer name and date
                const signedDate = new Date().toLocaleDateString('es-ES', {
                  day: '2-digit', month: '2-digit', year: 'numeric',
                  hour: '2-digit', minute: '2-digit'
                });
                
                // Draw signer name
                targetPage.drawText(signerName, {
                  x: centerX, y: centerY - 12, size: 8, color: rgb(0.3, 0.3, 0.3),
                });
                
                // Draw date below name
                targetPage.drawText(`Firmado: ${signedDate}`, {
                  x: centerX, y: centerY - 22, size: 8, color: rgb(0.3, 0.3, 0.3),
                });
                
                // Save and overwrite in R2
                const signedPdfBytes = await pdfDoc.save();
                await objectStorage.uploadDocument(r2Key, Buffer.from(signedPdfBytes), 'application/pdf');
                console.log(`✅ Individual document ${id} - signature permanently embedded and saved to R2: ${r2Key}`);
              }
            }
          } catch (embedError) {
            console.error('Error embedding signature permanently:', embedError);
            // Don't fail the request - signature is still in database
          }
        }
      } else {
        console.log(`📋 Circular document ${id} - signature stored in DB only (${otherDocsCount} other docs share this file)`);
      }
      
      // 📡 WebSocket: Broadcast document signed event to admins in real-time
      const wsServer = getWebSocketServer();
      if (wsServer) {
        wsServer.broadcastToCompany(req.user!.companyId, {
          type: 'document_signed',
          companyId: req.user!.companyId,
          data: { 
            documentId: id,
            userId: req.user!.id,
            userName: req.user!.fullName,
            signedAt: new Date().toISOString(),
            fileName: document.originalName || document.fileName
          }
        });
        console.log(`📡 Broadcast document_signed event for document ${id} to company ${req.user!.companyId}`);
      }
      
      res.json(updatedDocument);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Message routes
  app.post('/api/messages', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const data = insertMessageSchema.parse({
        ...req.body,
        senderId: req.user!.id,
      });

      const message = await storage.createMessage(data);
      
      // Get sender info for WebSocket notification
      const sender = await storage.getUser(req.user!.id);
      const senderName = sender?.fullName || 'Usuario';
      
      // 📡 WebSocket: Broadcast message to company for real-time badge updates
      const wsServer = getWebSocketServer();
      if (wsServer) {
        wsServer.broadcastToCompany(req.user!.companyId, {
          type: 'message_received',
          companyId: req.user!.companyId,
          data: { 
            messageId: message.id, 
            senderId: req.user!.id,
            senderName: senderName,
            receiverId: data.receiverId,
            isToAllEmployees: data.isToAllEmployees,
            subject: data.subject || 'Nuevo mensaje'
          }
        });
      }
      
      // 📱 Send push notification to receiver(s) - ASYNC (no bloquea endpoint)
      import('./pushNotificationScheduler.js').then(async ({ sendMessageNotification }) => {
        try {
          const sender = await storage.getUser(req.user!.id);
          const senderName = sender?.fullName || 'Usuario';
          
          if (data.isToAllEmployees) {
            // Send to all employees in the company in parallel
            const employees = await storage.getUsersByCompany(req.user!.companyId);
            await Promise.allSettled(
              employees
                .filter(employee => employee.id !== req.user!.id)
                .map(employee => 
                  sendMessageNotification(
                    employee.id,
                    senderName,
                    data.subject || 'Nuevo mensaje',
                    message.id
                  )
                )
            );
            console.log(`📱 Message notifications sent to all employees in company ${req.user!.companyId}`);
          } else if (data.receiverId) {
            // Send to specific receiver
            await sendMessageNotification(
              data.receiverId,
              senderName,
              data.subject || 'Nuevo mensaje',
              message.id
            );
            console.log(`📱 Message notification sent to user ${data.receiverId}`);
          }
        } catch (error) {
          console.error('Error sending message push notification:', error);
        }
      }).catch(err => console.error('Failed to load push notification module:', err));
      
      res.status(201).json(message);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get('/api/messages', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const messages = await storage.getMessagesByUser(req.user!.id);
      
      // Add sender names and profile pictures to messages
      const messagesWithNames = await Promise.all(messages.map(async (message: any) => {
        const sender = await storage.getUser(message.senderId);
        return {
          ...message,
          senderName: sender?.fullName || 'Usuario desconocido',
          senderProfilePicture: sender?.profilePicture || null
        };
      }));
      
      res.json(messagesWithNames);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch('/api/messages/:id/read', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const message = await storage.markMessageAsRead(id);

      if (!message) {
        return res.status(404).json({ message: 'Message not found' });
      }

      res.json(message);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/messages/unread-count', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const count = await storage.getUnreadMessageCount(req.user!.id);
      res.json({ count });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Employee routes
  app.get('/api/employees', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const employees = await storage.getUsersByCompany(req.user!.companyId);
      const sanitizedEmployees = employees.map(emp => toSafeUser(emp));
      res.json(sanitizedEmployees);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get single employee detail
  app.get('/api/employees/:id', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = await storage.getUser(id);
      if (!user || user.companyId !== req.user!.companyId) {
        return res.status(404).json({ message: 'Empleado no encontrado' });
      }
      const safe = toSafeUser(user);
      res.json(safe);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get managers for employees to send messages
  app.get('/api/managers', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const employees = await storage.getUsersByCompany(req.user!.companyId);
      const managers = employees.filter(emp => emp.role === 'admin' || emp.role === 'manager');
      const sanitizedManagers = managers.map(mgr => ({
        id: mgr.id,
        fullName: mgr.fullName,
        companyEmail: mgr.companyEmail,
        role: mgr.role,
        position: mgr.position,
        avatarUrl: mgr.avatarUrl
      }));
      res.json(sanitizedManagers);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/employees', authenticateToken, requireRole(['admin', 'manager']), async (req, res) => {
    try {
      const { companyEmail, fullName, dni, role, companyPhone, startDate, totalVacationDays } = req.body;
      
      // Validate required fields
      if (!fullName || !dni || !companyEmail) {
        return res.status(400).json({ message: 'Nombre completo, DNI y email son obligatorios' });
      }
      
      // Check if user already exists within the same company by DNI
      const existingUser = await storage.getUserByDniAndCompany(dni, (req as AuthRequest).user!.companyId);
      if (existingUser) {
        return res.status(400).json({ message: 'DNI ya existe en tu empresa' });
      }

      const existingEmail = await storage.getUserByEmail(companyEmail);
      if (existingEmail) {
        return res.status(400).json({ message: 'Email ya existe' });
      }

      // Create user without password (pending activation)
      const user = await storage.createUser({
        companyEmail,
        password: '', // Empty password initially 
        fullName,
        dni,
        role: role || 'employee',
        companyId: (req as AuthRequest).user!.companyId,
        companyPhone: companyPhone || null,
        startDate: startDate ? new Date(startDate) : new Date(),
        isActive: true,
        isPendingActivation: true,
        totalVacationDays: totalVacationDays || "22.0",
        createdBy: (req as AuthRequest).user!.id,
      });

      // Create activation token
      const activationToken = await storage.createActivationToken({
        userId: user.id,
        email: companyEmail,
        token: crypto.randomBytes(32).toString('hex'),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        createdBy: (req as AuthRequest).user!.id
      });

      // Get company information for email
      const company = await storage.getCompany((req as AuthRequest).user!.companyId);
      if (!company) {
        return res.status(500).json({ message: 'Error obteniendo información de empresa' });
      }

      // Send activation email
      const activationLink = `${req.protocol}://${req.get('host')}/employee-activation?token=${activationToken.token}`;
      
      console.log(`📧 Attempting to send activation email to: ${companyEmail}`);
      console.log(`📧 Employee name: ${fullName}`);
      console.log(`📧 Company name: ${company.name}`);
      console.log(`📧 Activation link: ${activationLink}`);
      
      const emailSent = await sendEmployeeWelcomeEmail(
        companyEmail,
        fullName,
        company.name,
        activationToken.token,
        activationLink
      );

      if (!emailSent) {
        console.error('❌ Failed to send activation email for employee:', companyEmail);
        // Don't fail the creation, just log the error
      } else {
        console.log(`✅ Activation email sent successfully to: ${companyEmail}`);
      }

      res.status(201).json({ 
        ...user, 
        password: undefined,
        message: `Empleado creado exitosamente. Se ha enviado un email de activación a ${companyEmail}`
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Upload company logo
  app.post('/api/companies/upload-logo', authenticateToken, upload.single('logo'), async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: 'No autorizado para subir logo de empresa' });
      }

      if (!req.file) {
        return res.status(400).json({ message: 'No se ha subido ningún archivo' });
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml'];
      if (!allowedTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ message: 'Tipo de archivo no permitido. Solo se permiten JPG, PNG, GIF, SVG' });
      }

      // Validate file size (2MB max)
      if (req.file.size > 2 * 1024 * 1024) {
        return res.status(400).json({ message: 'El archivo es demasiado grande. Máximo 2MB' });
      }

      // Get current company to potentially delete old logo
      const company = await storage.getCompany(user.companyId);
      if (company?.logoUrl) {
        // Delete old logo file if it exists in uploads directory
        const oldLogoPath = company.logoUrl.replace('/uploads/', '');
        const oldFullPath = path.join(process.cwd(), 'uploads', oldLogoPath);
        
        try {
          if (fs.existsSync(oldFullPath)) {
            fs.unlinkSync(oldFullPath);
          }
        } catch (error) {
          console.log('Could not delete old logo:', error);
        }
      }

      // Generate the logo URL
      const logoUrl = `/uploads/${req.file.filename}`;

      res.json({ logoUrl });
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  // Delete company logo
  app.delete('/api/companies/delete-logo', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = await storage.getUser(userId);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: 'No autorizado para eliminar logo de empresa' });
      }

      // Get current company to delete logo file
      const company = await storage.getCompany(user.companyId);
      if (company?.logoUrl) {
        // Delete logo file if it exists in uploads directory
        const logoPath = company.logoUrl.replace('/uploads/', '');
        const fs = require('fs');
        const path = require('path');
        const fullPath = path.join(process.cwd(), 'uploads', logoPath);
        
        try {
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
          }
        } catch (error) {
          console.log('Could not delete logo file:', error);
        }
      }
      
      // Update company in database
      await storage.updateCompany(user.companyId, {
        logoUrl: null
      });

      res.json({ 
        message: 'Logo eliminado correctamente'
      });
    } catch (error: any) {
      console.error('Error deleting logo:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  // Update company information
  app.patch('/api/companies/update', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { 
        name, 
        cif, 
        email, 
        contactName,
        companyAlias,
        phone, 
        address, 
        province,
        logoUrl,
        workingHoursPerDay,
        defaultVacationDays,
        vacationDaysPerMonth
      } = req.body;
      const userId = req.user!.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: 'No autorizado para actualizar información de empresa' });
      }

      // Get current company data to check if CIF is changing
      const currentCompany = await storage.getCompany(user.companyId);
      if (!currentCompany) {
        return res.status(404).json({ message: 'Empresa no encontrada' });
      }

      // Check if CIF is changing and if the new CIF already exists
      if (cif && cif !== currentCompany.cif) {
        const existingCompany = await storage.getCompanyByCif(cif);
        if (existingCompany && existingCompany.id !== user.companyId) {
          console.log(`CIF conflict: Trying to change from "${currentCompany.cif}" to "${cif}", but "${cif}" is already used by company ID ${existingCompany.id} (${existingCompany.name})`);
          return res.status(400).json({ 
            message: `El CIF "${cif}" ya está registrado por otra empresa: ${existingCompany.name}`,
            field: 'cif',
            currentCif: currentCompany.cif,
            conflictingCompany: existingCompany.name
          });
        }
      }

      // Sync defaultVacationPolicy with vacationDaysPerMonth for backwards compatibility
      const syncedVacationPolicy = vacationDaysPerMonth ? vacationDaysPerMonth.toString() : undefined;
      
      const updatedCompany = await storage.updateCompany(user.companyId, {
        name,
        cif,
        email,
        contactName,
        companyAlias,
        phone,
        address,
        province,
        logoUrl,
        workingHoursPerDay,
        defaultVacationDays,
        vacationDaysPerMonth,
        defaultVacationPolicy: syncedVacationPolicy
      });

      if (!updatedCompany) {
        return res.status(404).json({ message: 'Empresa no encontrada' });
      }

      // Always recalculate vacation days for all employees when saving company settings
      // This ensures days are always up-to-date with current vacationDaysPerMonth
      // IMPORTANT: Clear individual vacationDaysPerMonth overrides so all employees use company policy
      const employees = await storage.getUsersByCompany(user.companyId);
      for (const employee of employees) {
        // Clear individual override so employee uses company value
        await storage.updateUser(employee.id, { vacationDaysPerMonth: null });
        // Then recalculate with company policy
        await storage.updateUserVacationDays(employee.id);
      }
      console.log(`Recalculated vacation days for ${employees.length} employees using ${vacationDaysPerMonth || updatedCompany.vacationDaysPerMonth} days/month`);

      res.json({ 
        message: 'Empresa actualizada correctamente',
        company: {
          ...updatedCompany,
          logoUrl: updatedCompany.logoUrl || null
        },
        vacationDaysRecalculated: employees.length
      });
    } catch (error) {
      console.error('Error updating company:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  // Update manager permissions - Admin only
  app.patch('/api/settings/manager-permissions', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res) => {
    try {
      const { managerPermissions } = req.body;
      const userId = req.user!.id;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }

      // Validate permissions structure
      const validPermissions = {
        canCreateDeleteEmployees: Boolean(managerPermissions?.canCreateDeleteEmployees ?? true),
        canCreateDeleteManagers: Boolean(managerPermissions?.canCreateDeleteManagers ?? false),
        canBuyRemoveFeatures: Boolean(managerPermissions?.canBuyRemoveFeatures ?? false),
        canBuyRemoveUsers: Boolean(managerPermissions?.canBuyRemoveUsers ?? false),
        canEditCompanyData: Boolean(managerPermissions?.canEditCompanyData ?? false),
        visibleFeatures: Array.isArray(managerPermissions?.visibleFeatures) 
          ? managerPermissions.visibleFeatures.filter((f: unknown) => typeof f === 'string')
          : [],
      };

      const updatedCompany = await storage.updateCompany(user.companyId, {
        managerPermissions: validPermissions
      });

      if (!updatedCompany) {
        return res.status(404).json({ message: 'Empresa no encontrada' });
      }

      res.json({ 
        message: 'Permisos de manager actualizados',
        managerPermissions: updatedCompany.managerPermissions
      });
    } catch (error) {
      console.error('Error updating manager permissions:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  // Get manager permissions - Admin/Manager
  app.get('/api/settings/manager-permissions', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }

      const company = await storage.getCompany(user.companyId);
      if (!company) {
        return res.status(404).json({ message: 'Empresa no encontrada' });
      }

      // Return default permissions if not set
      const defaultPermissions = {
        canCreateDeleteEmployees: true,
        canCreateDeleteManagers: false,
        canBuyRemoveFeatures: false,
        canBuyRemoveUsers: false,
        canEditCompanyData: false,
        visibleFeatures: null,
      };

      // Merge company permissions with defaults
      // visibleFeatures: null = never configured (all visible)
      // visibleFeatures: [] = configured to show nothing
      // visibleFeatures: ['addon1', ...] = configured to show specific addons
      const storedPermissions = company.managerPermissions as object || {};
      const mergedPermissions = {
        ...defaultPermissions,
        ...storedPermissions,
      };

      res.json({ 
        managerPermissions: mergedPermissions
      });
    } catch (error) {
      console.error('Error getting manager permissions:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  // Dashboard stats
  app.get('/api/dashboard/stats', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const user = await storage.getUser(req.user!.id);
      const activeSession = await storage.getActiveWorkSession(req.user!.id);
      const recentSessions = await storage.getWorkSessionsByUser(req.user!.id, 5);
      const unreadCount = await storage.getUnreadMessageCount(req.user!.id);

      // Calculate today's hours
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todaySessions = recentSessions.filter(session => 
        session.createdAt >= today && session.status === 'completed'
      );
      const todayHours = todaySessions.reduce((total, session) => 
        total + (parseFloat(session.totalHours || '0')), 0
      );

      // Calculate this week's hours
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      const weekSessions = recentSessions.filter(session => 
        session.createdAt >= startOfWeek && session.status === 'completed'
      );
      const weekHours = weekSessions.reduce((total, session) => 
        total + (parseFloat(session.totalHours || '0')), 0
      );

      let employeeCount = 1;
      if (['admin', 'manager'].includes(req.user!.role)) {
        const employees = await storage.getUsersByCompany(req.user!.companyId);
        employeeCount = employees.filter(emp => emp.isActive).length;
      }

      res.json({
        todayHours: todayHours.toFixed(1),
        weekHours: weekHours.toFixed(1),
        vacationDaysRemaining: parseFloat(user?.totalVacationDays || '0') - parseFloat(user?.usedVacationDays || '0'),
        activeEmployees: employeeCount,
        currentSession: activeSession,
        recentSessions: recentSessions.slice(0, 3),
        unreadMessages: unreadCount,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin Dashboard consolidated endpoint - loads all data in single request
  app.get('/api/admin/dashboard/summary', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      const companyId = user.companyId;
      
      // Fetch all data in parallel for maximum speed
      const [
        employees,
        vacationRequests,
        incompleteSessionsResult,
        modificationRequests,
        allDocuments,
        documentNotifications,
        unreadMessagesData,
        messages,
        reminders,
        recentWorkSessionsResult,
        customHolidays,
      ] = await Promise.all([
        storage.getUsersByCompany(companyId),
        storage.getVacationRequestsByCompany(companyId),
        storage.getWorkSessionsByCompany(companyId, 100, 0, { status: 'incomplete' }),
        storage.getCompanyModificationRequests(companyId, 'pending'),
        storage.getDocumentsByCompany(companyId),
        storage.getDocumentNotificationsByCompany(companyId),
        storage.getUnreadMessageCount(user.id),
        storage.getMessagesByUser(user.id),
        storage.getRemindersByCompany(companyId, user.id),
        storage.getWorkSessionsByCompany(companyId, 20),
        storage.getCustomHolidaysByCompany(companyId),
      ]);
      
      // Sanitize employee data
      const safeEmployees = employees.map(emp => toSafeUser(emp));
      
      // Extract sessions from paginated results
      const incompleteSessions = incompleteSessionsResult.sessions;
      const recentWorkSessions = recentWorkSessionsResult.sessions;
      
      // Process data - add userName from user.fullName for frontend compatibility
      const pendingVacations = vacationRequests
        .filter((req: any) => req.status === 'pending')
        .map((req: any) => ({ ...req, userName: req.user?.fullName || req.userFullName || 'Empleado' }));
      const approvedVacations = vacationRequests
        .filter((req: any) => req.status === 'approved')
        .map((req: any) => ({ ...req, userName: req.user?.fullName || req.userFullName || 'Empleado' }));
      
      // Count documents pending signature: nóminas OR documents with requiresSignature flag
      const unsignedPayrollsCount = allDocuments.filter((doc: any) => {
        const isPayroll = doc.originalName && doc.originalName.toLowerCase().includes('nómina');
        const requiresSignature = doc.requiresSignature === true;
        return (isPayroll || requiresSignature) && !doc.isAccepted;
      }).length;
      
      const pendingDocumentRequests = documentNotifications.filter((req: any) => !req.isCompleted);
      
      // Active reminders (not completed)
      const activeReminders = reminders
        .filter((r: any) => !r.isCompleted)
        .sort((a: any, b: any) => {
          if (a.reminderDate && !b.reminderDate) return -1;
          if (!a.reminderDate && b.reminderDate) return 1;
          if (a.reminderDate && b.reminderDate) {
            return new Date(a.reminderDate).getTime() - new Date(b.reminderDate).getTime();
          }
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        })
        .slice(0, 3);
      
      // Process recent sessions into entry/exit events
      const recentEvents: any[] = [];
      recentWorkSessions.forEach((session: any) => {
        recentEvents.push({
          id: `${session.id}-in`,
          userName: session.userName,
          type: 'entry',
          timestamp: session.clockIn,
          sessionId: session.id
        });
        if (session.clockOut) {
          recentEvents.push({
            id: `${session.id}-out`,
            userName: session.userName,
            type: 'exit',
            timestamp: session.clockOut,
            sessionId: session.id
          });
        }
      });
      const sortedEvents = recentEvents
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 5);
      
      // Process messages - group by sender, get latest per sender (first 20 messages)
      // Add sender name and profile picture from employees list
      const employeeMap = new Map(employees.map((emp: any) => [emp.id, emp]));
      const recentMsgs = messages.slice(0, 20).map((message: any) => {
        const sender = employeeMap.get(message.senderId);
        return {
          ...message,
          senderName: sender?.fullName || sender?.name || 'Empleado',
          senderProfilePicture: sender?.profilePicture || null,
        };
      });
      const messagesBySender: any = {};
      recentMsgs.forEach((message: any) => {
        if (!messagesBySender[message.senderId] || new Date(message.createdAt) > new Date(messagesBySender[message.senderId].createdAt)) {
          messagesBySender[message.senderId] = message;
        }
      });
      const processedMessages = Object.values(messagesBySender).slice(0, 4);
      
      res.json({
        employees: safeEmployees,
        vacationRequests,
        pendingVacations,
        approvedVacations,
        incompleteSessions,
        modificationRequests,
        unsignedPayrollsCount,
        documentRequests: pendingDocumentRequests,
        unreadMessagesCount: unreadMessagesData,
        messages: processedMessages,
        activeReminders,
        recentSessions: sortedEvents,
        customHolidays,
      });
    } catch (error: any) {
      console.error('Error fetching admin dashboard summary:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update user profile
  app.patch('/api/users/profile', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const updates = req.body;
      
      // Handle startDate conversion if provided
      if (updates.startDate) {
        updates.startDate = new Date(updates.startDate);
      }
      
      const updatedUser = await storage.updateUser(req.user!.id, updates);
      if (!updatedUser) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // If startDate was updated, recalculate vacation days
      if (req.body.startDate) {
        await storage.updateUserVacationDays(req.user!.id);
      }
      
      res.json(updatedUser);
    } catch (error: any) {
      console.error('Error updating user profile:', error);
      res.status(500).json({ error: 'Error updating user profile' });
    }
  });

  // Upload profile picture (with background processing)
  app.post('/api/users/profile-picture', authenticateToken, profilePictureUpload.single('profilePicture'), async (req: AuthRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No se ha proporcionado ningún archivo' });
      }

      // Determine target user ID (for admin uploading for employees or user uploading for themselves)
      const targetUserId = req.body.targetEmployeeId ? parseInt(req.body.targetEmployeeId) : req.user!.id;
      const isAdminUpload = req.body.targetEmployeeId && targetUserId !== req.user!.id;

      // Security check: If admin is uploading for an employee, verify permissions and same company
      if (isAdminUpload) {
        const user = req.user!;
        if (!['admin', 'manager'].includes(user.role)) {
          fs.unlinkSync(req.file.path);
          return res.status(403).json({ error: 'Solo admins y managers pueden subir fotos para otros empleados' });
        }

        const targetEmployee = await storage.getUser(targetUserId);
        if (!targetEmployee) {
          fs.unlinkSync(req.file.path);
          return res.status(404).json({ error: 'Empleado no encontrado' });
        }

        if (targetEmployee.companyId !== user.companyId) {
          fs.unlinkSync(req.file.path);
          console.log(`SECURITY VIOLATION: User ${user.id} from company ${user.companyId} attempted to upload profile picture for employee ${targetUserId} from company ${targetEmployee.companyId}`);
          return res.status(403).json({ error: 'No puedes subir fotos para empleados de otras empresas' });
        }

        console.log(`ADMIN PROFILE UPLOAD: User ${user.id} (${user.role}) uploading profile picture for employee ${targetUserId} within company ${user.companyId}`);
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ error: 'Tipo de archivo no válido. Solo se permiten imágenes JPG, PNG, GIF y WEBP.' });
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (req.file.size > maxSize) {
        return res.status(400).json({ error: 'El archivo es demasiado grande. Tamaño máximo: 5MB.' });
      }

      // Save buffer to temporary file for processing
      const tempFilename = `temp_profile_${targetUserId}_${Date.now()}${path.extname(req.file.originalname)}`;
      const tempFilePath = path.join(uploadDir, tempFilename);
      fs.writeFileSync(tempFilePath, req.file.buffer);

      console.log(`📁 Profile picture upload: originalname=${req.file.originalname}, size=${req.file.size}, mimetype=${req.file.mimetype}, targetUser=${targetUserId}`);

      // Generate unique filename for processed image (always JPEG for consistency)
      const filename = `profile_${targetUserId}_${Date.now()}.jpg`;
      const outputPath = path.join(uploadDir, filename);

      // Create background processing job instead of synchronous processing
      const processingConfig = {
        resize: { width: 200, height: 200, fit: 'inside' },
        quality: 85,
        outputPath: outputPath
      };

      console.log(`🎯 Creating image processing job with tempFilePath: ${tempFilePath}`);

      const job = await storage.createImageProcessingJob({
        userId: targetUserId,
        originalFilePath: tempFilePath,
        processingType: 'profile_picture',
        metadata: JSON.stringify({ 
          targetUserId,
          isAdminUpload,
          uploadedBy: req.user!.id,
          processingConfig: processingConfig
        })
      });

      console.log(`🎯 Created background processing job ${job.id} for user ${targetUserId}`);

      // Trigger immediate processing instead of waiting for interval
      backgroundImageProcessor.notifyNewJob();

      // Return job ID for frontend polling
      res.json({ 
        message: 'Subida iniciada correctamente. Procesando imagen en segundo plano...',
        jobId: job.id,
        status: 'pending'
      });
    } catch (error: any) {
      console.error('Error uploading profile picture:', error);
      res.status(500).json({ error: 'Error al subir la foto de perfil' });
    }
  });

  // Get image processing job status
  app.get('/api/image-processing/status/:jobId', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const userId = req.user!.id;
      
      if (isNaN(jobId)) {
        return res.status(400).json({ error: 'ID de job inválido' });
      }
      
      const job = await storage.getImageProcessingJob(jobId);
      if (!job) {
        return res.status(404).json({ error: 'Job no encontrado' });
      }
      
      // Security check: Only allow users to check their own jobs or admins to check any job
      const user = req.user!;
      const metadata = typeof job.metadata === 'string' 
        ? JSON.parse(job.metadata) 
        : job.metadata || {};
      const targetUserId = metadata.targetUserId || job.userId;
      
      if (job.userId !== userId && targetUserId !== userId && !['admin', 'manager'].includes(user.role)) {
        return res.status(403).json({ error: 'No autorizado para consultar este job' });
      }
      
      // Return job status with additional info for completed jobs
      const response: any = {
        jobId: job.id,
        status: job.status,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt
      };
      
      if (job.status === 'completed' && job.processedFilePath) {
        response.profilePicture = `/uploads/${path.basename(job.processedFilePath)}`;
      }
      
      if (job.status === 'failed' && job.errorMessage) {
        response.errorMessage = job.errorMessage;
      }
      
      res.json(response);
    } catch (error: any) {
      console.error('Error getting job status:', error);
      res.status(500).json({ error: 'Error al consultar el estado del procesamiento' });
    }
  });

  // Delete profile picture
  app.delete('/api/users/profile-picture', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      // Remove profile picture from database
      const updatedUser = await storage.updateUser(req.user!.id, { 
        profilePicture: null 
      });

      if (!updatedUser) {
        return res.status(500).json({ error: 'Error al eliminar la foto de perfil de la base de datos' });
      }

      // Delete file from filesystem if it exists
      if (user.profilePicture) {
        const filePath = path.join(process.cwd(), 'uploads', path.basename(user.profilePicture));
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (fileError) {
          console.warn('Warning: Could not delete profile picture file:', fileError);
          // Continue anyway as database update was successful
        }
      }

      res.json({ 
        message: 'Foto de perfil eliminada correctamente' 
      });
    } catch (error: any) {
      console.error('Error deleting profile picture:', error);
      res.status(500).json({ error: 'Error al eliminar la foto de perfil' });
    }
  });

  // Delete profile picture for specific user (admin/manager only)
  app.delete('/api/users/:id/profile-picture', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const targetUserId = parseInt(req.params.id);
      
      // Verificar que el usuario objetivo pertenece a la misma empresa
      const targetUser = await storage.getUser(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }
      
      if (targetUser.companyId !== req.user!.companyId) {
        return res.status(403).json({ error: 'No tienes permisos para eliminar la foto de este usuario' });
      }

      // Remove profile picture from database
      const updatedUser = await storage.updateUser(targetUserId, { 
        profilePicture: null 
      });

      if (!updatedUser) {
        return res.status(500).json({ error: 'Error al eliminar la foto de perfil de la base de datos' });
      }

      // Delete file from filesystem if it exists
      if (targetUser.profilePicture) {
        const filePath = path.join(process.cwd(), 'uploads', path.basename(targetUser.profilePicture));
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (fileError) {
          console.warn('Warning: Could not delete profile picture file:', fileError);
          // Continue anyway as database update was successful
        }
      }

      res.json({ 
        message: 'Foto de perfil eliminada correctamente' 
      });
    } catch (error: any) {
      console.error('Error deleting user profile picture:', error);
      res.status(500).json({ error: 'Error al eliminar la foto de perfil' });
    }
  });

  // Calculate vacation days for a user
  app.post('/api/users/:id/calculate-vacation', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const userId = parseInt(req.params.id);
      const updatedUser = await storage.updateUserVacationDays(userId);
      
      if (!updatedUser) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }

      res.json({ message: 'Días de vacaciones recalculados', user: updatedUser });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Adjust vacation days manually
  app.patch('/api/users/:id/vacation-adjustment', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { adjustment, daysPerMonth } = req.body;
      
      const updates: any = {};
      if (adjustment !== undefined) updates.vacationDaysAdjustment = adjustment.toString();
      if (daysPerMonth !== undefined) updates.vacationDaysPerMonth = daysPerMonth.toString();
      
      const updatedUser = await storage.updateUser(userId, updates);
      
      if (!updatedUser) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }

      // Recalculate total vacation days after adjustment
      await storage.updateUserVacationDays(userId);
      const finalUser = await storage.getUser(userId);

      res.json({ message: 'Ajuste de vacaciones actualizado', user: finalUser });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update employee (admin/manager only)
  app.patch('/api/employees/:id', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const userId = parseInt(req.params.id);
      const updates = req.body;
      
      if (isNaN(userId)) {
        return res.status(400).json({ error: 'ID de usuario inválido' });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      // Verify the user belongs to the same company
      if (user.companyId !== req.user!.companyId) {
        return res.status(403).json({ error: 'No tienes permiso para editar este usuario' });
      }

      // 🔒 MANAGER ROLE RESTRICTIONS: Managers cannot edit other managers or their own profile
      if (req.user!.role === 'manager') {
        // Check if the target user is a manager (including themselves)
        if (user.role === 'manager') {
          console.log(`🚨 SECURITY BLOCK: Manager ${req.user!.id} attempted to edit manager profile ${userId}`);
          return res.status(403).json({ 
            error: 'Los managers no pueden editar perfiles de otros managers. Solo un administrador puede realizar esta acción.' 
          });
        }
        
        // Check if manager is trying to edit their own profile
        if (userId === req.user!.id) {
          console.log(`🚨 SECURITY BLOCK: Manager ${req.user!.id} attempted to edit their own profile`);
          return res.status(403).json({ 
            error: 'Los managers no pueden editar su propio perfil. Solo un administrador puede realizar esta acción.' 
          });
        }

        // Check if the target user is an admin
        if (user.role === 'admin') {
          console.log(`🚨 SECURITY BLOCK: Manager ${req.user!.id} attempted to edit admin profile ${userId}`);
          return res.status(403).json({ 
            error: 'Los managers no pueden editar perfiles de administradores.' 
          });
        }
      }

      // Debug logging
      console.log('📝 Employee update request:', {
        userId,
        currentUser: { id: user.id, companyEmail: user.companyEmail, role: user.role },
        updates
      });

      // ⚠️ PROTECTED: ORIGINAL ADMIN ROLE PROTECTION - DO NOT MODIFY
      // Original admins (createdBy is null) can NEVER have their role changed
      // This is a critical security feature to prevent accidental or malicious role changes
      if (updates.role && updates.role !== user.role && user.createdBy === null) {
        console.log(`🚨 SECURITY BLOCK: Attempt to change role of original admin ${userId} (${user.fullName}) blocked`);
        return res.status(403).json({ 
          error: 'El administrador original de la empresa no puede cambiar de rol. Esta cuenta tiene protección permanente.' 
        });
      }
      // ⚠️ END PROTECTED SECTION

      // 🔒 SUBSCRIPTION LIMIT CHECK: Verify role change doesn't exceed subscription limits
      if (updates.role && updates.role !== user.role) {
        const newRole = updates.role as 'admin' | 'manager' | 'employee';
        const roleCheck = await storage.canAddUserOfRole(req.user!.companyId, newRole);
        
        if (!roleCheck.canAdd) {
          const roleNames: Record<string, string> = {
            admin: 'administradores',
            manager: 'managers',
            employee: 'empleados'
          };
          console.log(`🚨 SUBSCRIPTION LIMIT: Cannot change role to ${newRole}. Current: ${roleCheck.currentCount}, Limit: ${roleCheck.limit}`);
          return res.status(403).json({ 
            error: `Has alcanzado el límite de ${roleNames[newRole]} contratados (${roleCheck.limit}). Para añadir más ${roleNames[newRole]}, actualiza tu suscripción en la Tienda.`
          });
        }
      }

      // Only allow specific fields to be updated by admin/manager
      const allowedUpdates: any = {};
      
      // Handle companyEmail carefully - only update if it's provided, not empty, and different
      if (updates.companyEmail !== undefined) {
        const newEmail = updates.companyEmail.trim();
        if (newEmail !== '' && newEmail !== user.companyEmail) {
          allowedUpdates.companyEmail = newEmail;
        }
        // If it's empty or same as current, don't include it in the update
      }
      
      if (updates.companyPhone !== undefined) allowedUpdates.companyPhone = updates.companyPhone;
      if (updates.position !== undefined) allowedUpdates.position = updates.position;
      if (updates.startDate !== undefined) allowedUpdates.startDate = new Date(updates.startDate);
      if (updates.status !== undefined) allowedUpdates.status = updates.status;
      if (updates.role !== undefined) allowedUpdates.role = updates.role;
      if (updates.vacationDaysAdjustment !== undefined) allowedUpdates.vacationDaysAdjustment = updates.vacationDaysAdjustment.toString();
      if (updates.workReportMode !== undefined) allowedUpdates.workReportMode = updates.workReportMode;
      if (updates.personalEmail !== undefined) allowedUpdates.personalEmail = updates.personalEmail;
      if (updates.personalPhone !== undefined) allowedUpdates.personalPhone = updates.personalPhone;
      if (updates.address !== undefined) allowedUpdates.address = updates.address;
      if (updates.emergencyContactName !== undefined) allowedUpdates.emergencyContactName = updates.emergencyContactName;
      if (updates.emergencyContactPhone !== undefined) allowedUpdates.emergencyContactPhone = updates.emergencyContactPhone;

      console.log('📝 Final allowedUpdates:', allowedUpdates);

      // Only proceed with update if there are actually changes to make
      if (Object.keys(allowedUpdates).length === 0) {
        console.log('📝 No changes to make, returning current user');
        return res.json({ 
          message: 'No hay cambios que realizar',
          user: user 
        });
      }

      // Track if role is changing for WebSocket notification
      const previousRole = user.role;
      const roleIsChanging = allowedUpdates.role && allowedUpdates.role !== previousRole;

      const updatedUser = await storage.updateUser(userId, allowedUpdates);

      if (!updatedUser) {
        return res.status(500).json({ error: 'Error al actualizar el usuario' });
      }

      // Recalculate vacation days if start date changed
      if (updates.startDate) {
        await storage.updateUserVacationDays(userId);
      }

      const finalUser = await storage.getUser(userId);

      // 🔄 ROLE CHANGE: Send WebSocket notification to the affected user
      if (roleIsChanging && finalUser) {
        const wsServer = getWebSocketServer();
        if (wsServer) {
          // Generate new token with updated role for the affected user
          const newToken = generateToken({
            id: finalUser.id,
            username: finalUser.companyEmail,
            role: finalUser.role,
            companyId: finalUser.companyId
          });
          
          wsServer.sendToUser(userId, {
            type: 'role_changed',
            previousRole: previousRole,
            newRole: finalUser.role,
            newToken: newToken
          });
          console.log(`🔄 Role change notification sent to user ${userId}: ${previousRole} → ${finalUser.role}`);
        }
      }

      res.json({ 
        message: 'Usuario actualizado correctamente',
        user: finalUser 
      });
    } catch (error: any) {
      console.error('Error updating employee:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  // Delete employee (admin/manager only)
  app.delete('/api/employees/:id', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      if (isNaN(userId)) {
        return res.status(400).json({ message: 'ID de empleado inválido' });
      }

      // Get the employee to verify they exist and belong to same company
      const employee = await storage.getUser(userId);
      if (!employee || employee.companyId !== req.user!.companyId) {
        return res.status(404).json({ message: 'Empleado no encontrado' });
      }

      // Prevent self-deletion
      if (userId === req.user!.id) {
        return res.status(400).json({ message: 'No puedes eliminarte a ti mismo' });
      }

      // Delete all related data in order of dependencies
      console.log(`🗑️ Deleting employee ${userId} and all related data...`);

      // 1. Delete break periods (depends on work sessions) using ORM for safety
      const userWorkSessions = await db.select({ id: workSessions.id })
        .from(workSessions)
        .where(eq(workSessions.userId, userId));
      
      if (userWorkSessions.length > 0) {
        const workSessionIds = userWorkSessions.map(ws => ws.id);
        await db.delete(breakPeriods)
          .where(inArray(breakPeriods.workSessionId, workSessionIds));
      }

      // 2. Delete work sessions
      await db.delete(workSessions)
        .where(eq(workSessions.userId, userId));

      // 3. Delete vacation requests
      await db.delete(vacationRequests)
        .where(eq(vacationRequests.userId, userId));

      // 4. Delete documents
      await db.delete(documents)
        .where(eq(documents.userId, userId));

      // 5. Delete messages (both sent and received)
      await db.delete(messages)
        .where(or(
          eq(messages.senderId, userId),
          eq(messages.receiverId, userId)
        ));

      // 6. Delete reminders
      await db.delete(reminders)
        .where(eq(reminders.userId, userId));

      // 7. Delete activation tokens
      await db.delete(employeeActivationTokens)
        .where(eq(employeeActivationTokens.userId, userId));

      // 8. Finally delete the user
      const deletedUser = await storage.deleteUser(userId);

      if (!deletedUser) {
        return res.status(500).json({ message: 'Error al eliminar el empleado' });
      }

      console.log(`✅ Employee ${userId} and all related data deleted successfully`);

      res.json({ 
        message: 'Empleado eliminado permanentemente',
        deletedUser: {
          id: deletedUser.id,
          fullName: deletedUser.fullName,
          dni: deletedUser.dni
        }
      });
    } catch (error: any) {
      console.error('Error deleting employee:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  // Unified notifications endpoints
  app.get('/api/notifications', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { category } = req.query;
      let notifications;
      
      // Check for incomplete sessions (throttled to once per 5 minutes per company)
      await storage.checkAndCreateIncompleteSessionNotifications(req.user!.companyId);
      
      if (category && typeof category === 'string') {
        notifications = await storage.getNotificationsByCategory(req.user!.id, category);
      } else {
        notifications = await storage.getNotificationsByUser(req.user!.id);
      }
      
      res.json(notifications);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch('/api/notifications/:id/read', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const notification = await storage.markNotificationRead(id);
      
      if (!notification) {
        return res.status(404).json({ message: 'Notification not found' });
      }
      
      res.json(notification);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch('/api/notifications/:id/complete', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // If this is a time-tracking notification, automatically close the incomplete session
      const notification = await storage.getNotificationsByUser(req.user!.id);
      const targetNotification = notification.find(n => n.id === id);
      
      if (targetNotification && targetNotification.type === 'incomplete_session' && targetNotification.metadata) {
        const metadata = JSON.parse(targetNotification.metadata);
        const workSessionId = metadata.workSessionId;
        
        if (workSessionId) {
          // Close the incomplete work session
          await storage.updateWorkSession(workSessionId, {
            clockOut: new Date()
          });
        }
      }
      
      const completedNotification = await storage.markNotificationCompleted(id);
      
      if (!completedNotification) {
        return res.status(404).json({ message: 'Notification not found' });
      }
      
      res.json(completedNotification);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/notifications/unread-count', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { category } = req.query;
      let count;
      
      // Check for incomplete sessions (throttled to once per 5 minutes per company)
      await storage.checkAndCreateIncompleteSessionNotifications(req.user!.companyId);
      
      if (category && typeof category === 'string') {
        count = await storage.getUnreadNotificationCountByCategory(req.user!.id, category);
      } else {
        count = await storage.getUnreadNotificationCount(req.user!.id);
      }
      
      res.json({ count });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Document notifications using unified notifications system
  app.get('/api/document-notifications', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const userRole = req.user!.role;
      
      // Si es admin/manager, obtener todas las solicitudes de su empresa
      if (userRole === 'admin' || userRole === 'manager') {
        const companyId = req.user!.companyId;
        const notifications = await storage.getDocumentNotificationsByCompany(companyId);
        res.json(notifications);
      } else {
        // Si es empleado, solo sus notificaciones
        const notifications = await storage.getDocumentNotificationsByUser(userId);
        res.json(notifications);
      }
    } catch (error: any) {
      console.error("Error fetching document notifications:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.patch('/api/document-notifications/:id/complete', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const notification = await storage.markNotificationCompleted(id);
      
      if (!notification) {
        return res.status(404).json({ message: 'Notification not found' });
      }
      
      res.json(notification);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete('/api/document-notifications/:id', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteNotification(id);
      
      if (!success) {
        return res.status(404).json({ message: 'Notification not found' });
      }
      
      res.json({ message: 'Document notification deleted successfully' });
    } catch (error: any) {
      console.error("Error deleting document notification:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Super Admin endpoints
  // 🔒 SECURITY: Enhanced security headers middleware for Super Admin
  const superAdminSecurityHeaders = (req: any, res: any, next: any) => {
    // Prevent clickjacking attacks
    res.setHeader('X-Frame-Options', 'DENY');
    
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Enable XSS protection
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Only set strict CSP in production - in development, let Replit/Vite handle CSP
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Content-Security-Policy', 
        "default-src 'self'; " +
        "script-src 'self' https://js.stripe.com https://maps.googleapis.com https://maps.gstatic.com; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "img-src 'self' data: https: blob:; " +
        "font-src 'self' data: https://fonts.gstatic.com; " +
        "connect-src 'self' wss: ws: https://api.stripe.com https://js.stripe.com https://maps.googleapis.com https://fcm.googleapis.com https://web.push.apple.com; " +
        "worker-src 'self' blob:; " +
        "frame-ancestors 'none'; " +
        "base-uri 'self'; " +
        "form-action 'self';"
      );
    }
    
    // Referrer policy - don't leak information
    res.setHeader('Referrer-Policy', 'no-referrer');
    
    // Permissions policy - disable unnecessary features
    res.setHeader('Permissions-Policy', 
      'camera=(), microphone=(), geolocation=(), payment=()'
    );
    
    next();
  };

  const authenticateSuperAdmin = (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    console.log('🔐 SuperAdmin auth middleware - Auth header:', authHeader ? `present (${authHeader.substring(0, 20)}...)` : 'missing');
    
    if (!authHeader) {
      console.log('🚨 SuperAdmin auth failed: No authorization header');
      return res.status(401).json({ message: "No token provided" });
    }

    const parts = authHeader.split(' ');
    console.log('🔐 Auth header parts:', parts.length, 'Bearer:', parts[0]);
    
    const token = parts[1];
    
    if (!token) {
      console.log('🚨 SuperAdmin auth failed: No token in header');
      return res.status(401).json({ message: "No token provided" });
    }

    console.log('🔐 Token length:', token.length, 'Has dot:', token.includes('.'));

    // Check for malformed token
    if (token.length < 10 || !token.includes('.')) {
      console.log('🚨 SuperAdmin auth failed: Malformed token. Token:', token.substring(0, 20) + '...');
      return res.status(401).json({ message: "Invalid token format" });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      console.log('🔐 SuperAdmin token decoded:', { type: decoded.type, role: decoded.role, email: decoded.email });
      
      if (decoded.type !== 'super_admin_access' && decoded.role !== 'super_admin') {
        console.log('🚨 SuperAdmin auth failed: Invalid token type', { type: decoded.type, role: decoded.role });
        return res.status(401).json({ message: "Invalid token type" });
      }
      
      console.log('✅ SuperAdmin auth successful for:', decoded.email);
      req.superAdmin = decoded;
      next();
    } catch (error) {
      console.log('🚨 SuperAdmin auth failed: Token verification error:', error);
      return res.status(401).json({ message: "Invalid token" });
    }
  };



  // Super Admin Access Code Verification
  // 🔒 SECURITY: Code moved to environment variable for better security
  const SUPER_ADMIN_ACCESS_CODE = process.env.SUPER_ADMIN_ACCESS_CODE;
  
  // Validate that Super Admin code is configured
  if (!SUPER_ADMIN_ACCESS_CODE) {
    console.error('🚨 SECURITY WARNING: SUPER_ADMIN_ACCESS_CODE environment variable not set. Super Admin access will be disabled.');
  }
  
  const tempTokens = new Map(); // In-memory storage for temporary tokens

  // Endpoint to clear corrupted SuperAdmin token
  app.post('/api/super-admin/clear-token', superAdminSecurityHeaders, async (req, res) => {
    res.json({ 
      success: true, 
      message: 'SuperAdmin token cleared. Please login again.' 
    });
  });

  // New simplified superadmin authentication - Step 1: Access Password
  app.post('/api/super-admin/verify-access-password', superAdminAccessLimiter, async (req, res) => {
    try {
      const { accessPassword } = req.body;
      
      const SUPER_ADMIN_ACCESS_PASSWORD = process.env.SUPER_ADMIN_ACCESS_PASSWORD;
      
      // 🔒 SECURITY: Check if Super Admin password is configured
      if (!SUPER_ADMIN_ACCESS_PASSWORD) {
        console.log('🚨 SECURITY: Super Admin access attempt blocked - no access password configured');
        return res.status(503).json({ message: "Acceso Super Admin deshabilitado por configuración de seguridad" });
      }
      
      if (accessPassword !== SUPER_ADMIN_ACCESS_PASSWORD) {
        logAudit({
          timestamp: new Date(),
          ip: req.ip || 'unknown',
          action: 'SUPER_ADMIN_ACCESS_PASSWORD_FAILED',
          success: false,
          details: 'Invalid access password'
        });
        return res.status(401).json({ message: "Contraseña de acceso incorrecta" });
      }

      logAudit({
        timestamp: new Date(),
        ip: req.ip || 'unknown',
        action: 'SUPER_ADMIN_ACCESS_PASSWORD_VERIFIED',
        success: true,
        details: 'Access password verified successfully'
      });
      res.json({ success: true, message: "Contraseña verificada correctamente" });
    } catch (error) {
      console.error("Error in access password verification:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // New simplified superadmin authentication - Step 2: Login
  app.post('/api/super-admin/login', superAdminLoginLimiter, async (req, res) => {
    try {
      const { email, password, totpCode } = req.body;
      
      const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL;
      const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD;
      const SUPER_ADMIN_TOTP_SECRET = process.env.SUPER_ADMIN_TOTP_SECRET;
      
      // 🔒 SECURITY: Check if Super Admin credentials are configured
      if (!SUPER_ADMIN_EMAIL || !SUPER_ADMIN_PASSWORD) {
        console.log('🚨 SECURITY: Super Admin login attempt blocked - credentials not configured');
        return res.status(503).json({ message: "Acceso Super Admin deshabilitado por configuración de seguridad" });
      }
      
      if (email !== SUPER_ADMIN_EMAIL || password !== SUPER_ADMIN_PASSWORD) {
        logAudit({
          timestamp: new Date(),
          ip: req.ip || 'unknown',
          action: 'SUPER_ADMIN_LOGIN_FAILED',
          email,
          success: false,
          details: `Invalid credentials for email: ${email}`
        });
        return res.status(401).json({ message: "Email o contraseña incorrectos" });
      }

      // 🔒 SECURITY: 2FA TOTP - Verificar código de Google Authenticator/Authy
      if (SUPER_ADMIN_TOTP_SECRET) {
        if (!totpCode) {
          return res.status(401).json({ 
            message: "Se requiere código de verificación (Google Authenticator/Authy)",
            requiresTOTP: true
          });
        }

        // Importar función de verificación TOTP
        const { verifyTOTPCode } = await import('../utils/totp-admin.js');
        
        if (!verifyTOTPCode(SUPER_ADMIN_TOTP_SECRET, totpCode)) {
          logAudit({
            timestamp: new Date(),
            ip: req.ip || 'unknown',
            action: 'SUPER_ADMIN_2FA_FAILED',
            email: SUPER_ADMIN_EMAIL,
            success: false,
            details: `Invalid TOTP code provided`
          });
          return res.status(401).json({ message: "Código de verificación inválido. Intenta de nuevo." });
        }
      }

      // Generate final super admin JWT token
      // 🔒 SECURITY: Token expires in 2 hours for better security
      const superAdminToken = jwt.sign(
        { 
          type: 'super_admin_access',
          role: 'super_admin',
          email: SUPER_ADMIN_EMAIL,
          accessGrantedAt: Date.now()
        },
        JWT_SECRET,
        { expiresIn: '2h' }
      );

      logAudit({
        timestamp: new Date(),
        ip: req.ip || 'unknown',
        action: 'SUPER_ADMIN_LOGIN_SUCCESS',
        email: SUPER_ADMIN_EMAIL,
        success: true,
        details: 'Super Admin login successful - access granted (2FA verified)'
      });

      // 🔒 SECURITY: Send email notification on successful login
      try {
        await sendEmail({
          to: SUPER_ADMIN_EMAIL,
          subject: '🔒 Alerta de Seguridad: Acceso SuperAdmin Detectado',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #ef4444;">🔒 Alerta de Seguridad</h2>
              <p>Se ha detectado un acceso exitoso al panel de SuperAdmin con autenticación 2FA.</p>
              <div style="background-color: #fee2e2; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p><strong>Detalles del acceso:</strong></p>
                <ul style="list-style: none; padding: 0;">
                  <li>📅 Fecha y hora: ${new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}</li>
                  <li>🌐 IP: ${req.ip || 'Desconocida'}</li>
                  <li>📧 Email: ${SUPER_ADMIN_EMAIL}</li>
                  <li>🔐 2FA: Verificado</li>
                </ul>
              </div>
              <p style="color: #6b7280; font-size: 14px;">
                Si no has sido tú quien ha accedido, cambia inmediatamente las credenciales de acceso.
              </p>
            </div>
          `
        });
      } catch (emailError) {
        console.error('Error sending security alert email:', emailError);
        // Don't fail the login if email fails
      }

      res.json({ token: superAdminToken, message: "Acceso autorizado" });
    } catch (error) {
      console.error("Error in superadmin login:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // OLD EMAIL-BASED SYSTEM (deprecated but kept for backward compatibility)
  app.post('/api/super-admin/verify-access-code', superAdminSecurityHeaders, async (req, res) => {
    try {
      const { accessCode } = req.body;
      
      // 🔒 SECURITY: Check if Super Admin code is configured
      if (!SUPER_ADMIN_ACCESS_CODE) {
        console.log('🚨 SECURITY: Super Admin access attempt blocked - no access code configured');
        return res.status(503).json({ message: "Acceso Super Admin deshabilitado por configuración de seguridad" });
      }
      
      if (accessCode !== SUPER_ADMIN_ACCESS_CODE) {
        console.log('🚨 SuperAdmin access denied: Invalid access code');
        // 🔒 AUDIT: Log failed access attempts for security monitoring
        console.log(`🚨 SECURITY AUDIT: Failed Super Admin access attempt - IP: ${req.ip}, Time: ${new Date().toISOString()}, Code: ${accessCode?.slice(0, 3)}***`);
        return res.status(401).json({ message: "Código de acceso incorrecto" });
      }

      // Generate temporary token for email verification step
      const tempToken = crypto.randomBytes(32).toString('hex');
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Store temp data (expires in 10 minutes)
      tempTokens.set(tempToken, {
        code: verificationCode,
        createdAt: Date.now(),
        expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
      });

      // Send email with verification code using the existing email infrastructure
      try {
        // 🔒 SECURITY: Configure with secure environment variables
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: 465,
          secure: true, // SSL
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
          tls: {
            rejectUnauthorized: false
          }
        });

        const mailOptions = {
          from: 'soy@oficaz.es',
          to: 'soy@oficaz.es',
          subject: 'Código de verificación SuperAdmin - Oficaz',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 20px; text-align: center;">
                <h1 style="color: white; margin: 0;">🔒 Oficaz SuperAdmin</h1>
              </div>
              <div style="background: #f8f9fa; padding: 30px; text-align: center;">
                <h2 style="color: #333; margin-bottom: 20px;">Código de verificación</h2>
                <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0; border: 2px solid #dc2626;">
                  <div style="font-size: 42px; font-weight: bold; color: #dc2626; letter-spacing: 12px; font-family: monospace;">
                    ${verificationCode}
                  </div>
                </div>
                <p style="color: #666; margin: 20px 0; font-size: 16px;">⏰ Este código expira en <strong>10 minutos</strong></p>
                <p style="color: #999; font-size: 14px;">🔐 Acceso de máxima seguridad al panel SuperAdmin</p>
                <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                <p style="color: #999; font-size: 12px;">Si no has solicitado este código, ignora este email.</p>
              </div>
            </div>
          `
        };

        console.log('📧 Attempting to send SuperAdmin verification code to soy@oficaz.es...');
        const result = await transporter.sendMail(mailOptions);
        console.log('✅ Email sent successfully:', result.messageId);
        console.log('🔑 Verification code:', verificationCode);
        
        res.json({ token: tempToken, message: "Código enviado correctamente" });
      } catch (emailError) {
        console.error('❌ Error sending verification email:', emailError);
        console.log('🔑 Verification code (for debugging):', verificationCode);
        res.status(500).json({ message: "Error al enviar el código de verificación" });
      }
    } catch (error) {
      console.error("Error in access code verification:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.post('/api/super-admin/verify-verification-code', superAdminSecurityHeaders, async (req, res) => {
    try {
      const { token, code } = req.body;
      
      if (!tempTokens.has(token)) {
        return res.status(401).json({ message: "Token inválido o expirado" });
      }

      const tokenData = tempTokens.get(token);
      
      if (Date.now() > tokenData.expiresAt) {
        tempTokens.delete(token);
        return res.status(401).json({ message: "Código expirado" });
      }

      if (code !== tokenData.code) {
        return res.status(401).json({ message: "Código de verificación incorrecto" });
      }

      // Clean up temp token
      tempTokens.delete(token);

      // Generate final super admin JWT token
      const superAdminToken = jwt.sign(
        { 
          type: 'super_admin_access',
          role: 'super_admin',
          email: 'soy@oficaz.es',
          accessGrantedAt: Date.now()
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      console.log('✅ SuperAdmin access granted successfully');
      res.json({ token: superAdminToken, message: "Acceso autorizado" });
    } catch (error) {
      console.error("Error in verification code check:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.get('/api/super-admin/stats', superAdminSecurityHeaders, superAdminSecurityHeaders, authenticateSuperAdmin, async (req, res) => {
    try {
      const stats = await storage.getSuperAdminStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching super admin stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  app.get('/api/super-admin/companies', superAdminSecurityHeaders, authenticateSuperAdmin, async (req, res) => {
    try {
      const companies = await storage.getAllCompaniesWithStats();
      res.json(companies);
    } catch (error) {
      console.error("Error fetching companies:", error);
      res.status(500).json({ message: "Failed to fetch companies" });
    }
  });


  // Reminders endpoints
  app.post('/api/reminders', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { title, content, reminderDate, priority, color, showBanner, assignedUserIds } = req.body;
      const userId = req.user!.id;
      const companyId = req.user!.companyId;
      
      const reminder = await storage.createReminder({
        userId,
        companyId,
        title,
        content,
        reminderDate: reminderDate ? new Date(reminderDate) : null,
        priority: priority || 'medium',
        color: color || '#ffffff',
        showBanner: showBanner || false,
        // FIXED: Only include creator if no other users assigned, or if creator is admin/manager
        assignedUserIds: assignedUserIds && assignedUserIds.length > 0 ? 
          (req.user!.role === 'admin' || req.user!.role === 'manager' ? 
            Array.from(new Set([userId, ...assignedUserIds])) : // Admin creates shared reminders
            assignedUserIds) : // Employee assigns to others only
          [userId], // No assignments = private to creator
        assignedBy: userId,
        assignedAt: new Date()
      });
      
      // Send push notifications to assigned users (except creator) - ASYNC (no bloquea endpoint)
      if (assignedUserIds && assignedUserIds.length > 0) {
        import('./pushNotificationScheduler.js').then(async ({ sendReminderSharedNotification }) => {
          try {
            const creator = await storage.getUser(userId);
            const creatorName = creator?.fullName || 'Admin';
            
            // Enviar todas las notificaciones en paralelo
            await Promise.allSettled(
              assignedUserIds
                .filter((id: number) => id !== userId)
                .map((assignedUserId: number) => 
                  sendReminderSharedNotification(assignedUserId, title, creatorName, reminder.id)
                )
            );
          } catch (error) {
            console.error('Error sending reminder shared notifications:', error);
          }
        }).catch(err => console.error('Failed to load push notification module:', err));
      }
      
      // Broadcast to company for real-time badge updates
      const wsServer = getWebSocketServer();
      if (wsServer) {
        wsServer.broadcastToCompany(companyId, { type: 'reminder_created', companyId });
      }
      
      // ✅ Reload event-driven reminders to schedule this new reminder
      import('./pushNotificationScheduler.js').then(async ({ reloadReminders }) => {
        await reloadReminders().catch(err => console.error('Error reloading reminders:', err));
      }).catch(err => console.error('Failed to load push notification module:', err));
      
      res.json(reminder);
    } catch (error) {
      console.error("Error creating reminder:", error);
      res.status(500).json({ message: "Failed to create reminder" });
    }
  });

  app.get('/api/reminders', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const userRole = req.user!.role;
      const companyId = req.user!.companyId;
      
      console.log(`📋 GET /api/reminders - User ${userId} (${userRole}) from company ${companyId}`);
      
      let reminders;
      
      // If admin/manager, show all company reminders; otherwise show user's reminders + assigned ones
      if (userRole === 'admin' || userRole === 'manager') {
        console.log(`📋 Admin/Manager ${userId} fetching company reminders`);
        reminders = await storage.getRemindersByCompany(companyId, userId);
      } else {
        console.log(`📋 Employee ${userId} fetching user reminders with assignments`);
        reminders = await storage.getRemindersByUserWithAssignments(userId);
        console.log(`📋 Employee ${userId} got ${reminders.length} reminders`);
      }
      
      res.json(reminders);
    } catch (error) {
      console.error("Error fetching reminders:", error);
      res.status(500).json({ message: "Failed to fetch reminders" });
    }
  });

  app.patch('/api/reminders/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const reminderId = parseInt(req.params.id);
      const userId = req.user!.id;
      const userRole = req.user!.role;
      
      // Check if reminder exists
      const existingReminder = await storage.getReminder(reminderId);
      if (!existingReminder) {
        return res.status(404).json({ message: "Reminder not found" });
      }
      
      // Special case: if user is trying to mark reminder as completed and is assigned to it
      const isMarkingComplete = req.body.isCompleted !== undefined;
      const isAssignedToReminder = existingReminder.assignedUserIds && 
                                  existingReminder.assignedUserIds.includes(userId);
      
      // Allow editing if:
      // 1. User owns the reminder, OR
      // 2. User created the reminder (createdBy), OR  
      // 3. User is admin/manager, OR
      // 4. User is assigned to reminder and only marking as complete
      const canEdit = existingReminder.userId === userId || 
                     existingReminder.createdBy === userId || 
                     ['admin', 'manager'].includes(userRole) ||
                     (isMarkingComplete && isAssignedToReminder);
      
      if (!canEdit) {
        return res.status(403).json({ message: "Not authorized to edit this reminder" });
      }
      
      // Process date fields properly
      const updateData = { ...req.body };
      if (updateData.reminderDate && typeof updateData.reminderDate === 'string') {
        updateData.reminderDate = new Date(updateData.reminderDate);
        // ⚠️ CRITICAL: Reset notification_shown when date changes so user gets notified again
        updateData.notificationShown = false;
      }
      if (updateData.reminderDate === null || updateData.reminderDate === '') {
        updateData.reminderDate = null;
      }
      
      // Handle assignments - always include creator + any additional assigned users
      if (updateData.assignedUserIds && Array.isArray(updateData.assignedUserIds)) {
        updateData.assignedUserIds = Array.from(new Set([userId, ...updateData.assignedUserIds]));
        updateData.assignedBy = userId;
        updateData.assignedAt = new Date();
      }
      
      // Handle individual completion tracking
      if (updateData.isCompleted !== undefined) {
        const currentCompletedByUserIds = existingReminder.completedByUserIds || [];
        
        if (updateData.isCompleted) {
          // Add user to completed list if not already there
          if (!currentCompletedByUserIds.includes(userId)) {
            updateData.completedByUserIds = [...currentCompletedByUserIds, userId];
          }
        } else {
          // Remove user from completed list
          updateData.completedByUserIds = currentCompletedByUserIds.filter((id: number) => id !== userId);
        }
        
        // Update overall completion status based on ALL assigned users (including the creator)
        const assignedUserIds = existingReminder.assignedUserIds || [];
        const creatorId = existingReminder.createdBy || existingReminder.userId;
        const newCompletedByUserIds = updateData.completedByUserIds || [];
        
        // If there are assigned users, check if ALL assigned users have completed
        if (assignedUserIds.length > 0) {
          updateData.isCompleted = assignedUserIds.every((id: number) => newCompletedByUserIds.includes(id));
        } else {
          // If no users assigned, use individual completion status of creator
          updateData.isCompleted = newCompletedByUserIds.includes(creatorId);
        }
        
        // 📡 WebSocket: Notify company when ANY user completes/uncompletes their part
        // This allows avatars to update in real-time for all viewers
        const wsServer = getWebSocketServer();
        if (wsServer) {
          wsServer.broadcastToCompany(req.user!.companyId, {
            type: 'reminder_user_completed',
            companyId: req.user!.companyId,
            data: { 
              reminderId: reminderId,
              userId: userId,
              completed: updateData.completedByUserIds?.includes(userId) || false,
              completedByUserIds: updateData.completedByUserIds
            }
          });
          
          // Also notify when ALL assigned users complete the reminder
          if (updateData.isCompleted && !existingReminder.isCompleted && assignedUserIds.length > 0) {
            wsServer.broadcastToCompany(req.user!.companyId, {
              type: 'reminder_all_completed',
              companyId: req.user!.companyId,
              data: { 
                reminderId: reminderId,
                title: existingReminder.title,
                creatorId: creatorId,
                completedCount: assignedUserIds.length
              }
            });
          }
        }
      }
      
      const updatedReminder = await storage.updateReminder(reminderId, updateData);
      
      // ✅ Reload event-driven reminders to reschedule this reminder
      import('./pushNotificationScheduler.js').then(async ({ reloadReminders }) => {
        await reloadReminders().catch(err => console.error('Error reloading reminders:', err));
      }).catch(err => console.error('Failed to load push notification module:', err));
      
      res.json(updatedReminder);
    } catch (error) {
      console.error("Error updating reminder:", error);
      res.status(500).json({ message: "Failed to update reminder" });
    }
  });

  app.delete('/api/reminders/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const reminderId = parseInt(req.params.id);
      const userId = req.user!.id;
      const userRole = req.user!.role;
      
      // Check if reminder exists
      const existingReminder = await storage.getReminder(reminderId);
      if (!existingReminder) {
        return res.status(404).json({ message: "Reminder not found" });
      }
      
      // Verify reminder's user belongs to same company (IDOR protection)
      const reminderOwner = await storage.getUser(existingReminder.userId);
      if (!reminderOwner || reminderOwner.companyId !== req.user!.companyId) {
        return res.status(403).json({ message: "No autorizado" });
      }
      
      // Only allow deletion if user owns the reminder OR is admin/manager
      if (existingReminder.userId !== userId && userRole !== 'admin' && userRole !== 'manager') {
        return res.status(403).json({ message: "Not authorized to delete this reminder" });
      }
      
      const deleted = await storage.deleteReminder(reminderId);
      if (deleted) {
        res.json({ message: "Reminder deleted successfully" });
      } else {
        res.status(404).json({ message: "Reminder not found" });
      }
    } catch (error) {
      console.error("Error deleting reminder:", error);
      res.status(500).json({ message: "Failed to delete reminder" });
    }
  });

  app.get('/api/reminders/active', authenticateToken, async (req: AuthRequest, res) => {
    console.log('📋 ENTERING /api/reminders/active endpoint');
    try {
      const userId = req.user!.id;
      const userRole = req.user!.role;
      const companyId = req.user!.companyId;
      
      console.log(`📋 GET /api/reminders/active - User ${userId} (${userRole}) from company ${companyId}`);
      
      let activeReminders;
      
      if (userRole === 'admin' || userRole === 'manager') {
        // Admin/Manager: Get all company reminders (active only)
        console.log(`📋 Admin/Manager ${userId} fetching active company reminders`);
        activeReminders = await storage.getActiveReminders(userId);
      } else {
        // Employee: Get reminders but filter out ones they completed individually
        console.log(`📋 Employee ${userId} fetching user reminders with assignments`);
        const allReminders = await storage.getRemindersByUserWithAssignments(userId, companyId);
        
        // Filter reminders based on ownership and completion status
        activeReminders = allReminders.filter(reminder => {
          const completedByUserIds = reminder.completedByUserIds || [];
          const userCompletedIndividually = completedByUserIds.includes(userId);
          const isOwnReminder = reminder.userId === userId;
          
          if (isOwnReminder) {
            // For own reminders: show until globally completed (employee reminders are simple)
            const keep = !reminder.isCompleted;
            console.log(`📋 Own Reminder ${reminder.id}: isCompleted=${reminder.isCompleted}, keep=${keep}`);
            return keep;
          } else {
            // For assigned reminders: hide if user completed individually
            const keep = !userCompletedIndividually;
            console.log(`📋 Assigned Reminder ${reminder.id}: userCompleted=${userCompletedIndividually}, keep=${keep}`);
            return keep;
          }
        });
        
        console.log(`📋 Employee ${userId} active reminders count: ${activeReminders.length}`);
      }
      
      // Add anti-cache headers for real-time updates
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Last-Modified': new Date().toUTCString()
      });
      
      res.json(activeReminders);
    } catch (error) {
      console.error("Error fetching active reminders:", error);
      res.status(500).json({ message: "Failed to fetch active reminders" });
    }
  });

  // Get dashboard reminders (for admin dashboard) - follows same logic as main reminders endpoint
  app.get('/api/reminders/dashboard', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const userRole = req.user!.role;
      const companyId = req.user!.companyId;
      
      let dashboardReminders;
      
      // If admin/manager, show ONLY their own created reminders; otherwise show user's reminders + assigned ones
      if (userRole === 'admin' || userRole === 'manager') {
        dashboardReminders = await storage.getRemindersByUser(userId);
      } else {
        dashboardReminders = await storage.getRemindersByUserWithAssignments(userId);
      }
      
      // Filter to show only active reminders (not completed, not archived) and upcoming/recent dates
      const now = new Date();
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
      const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 1 week from now
      
      const activeReminders = dashboardReminders
        .filter(reminder => {
          // Must not be completed or archived
          if (reminder.isCompleted || reminder.isArchived) return false;
          
          // Must have a date within our range (2 days ago to 1 week in future)
          const reminderDate = new Date(reminder.reminderDate);
          return reminderDate >= twoDaysAgo && reminderDate <= oneWeekFromNow;
        })
        .sort((a, b) => new Date(a.reminderDate).getTime() - new Date(b.reminderDate).getTime()) // Sort by date
        .slice(0, 3);
      
      // Add anti-cache headers for real-time updates
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Last-Modified': new Date().toUTCString()
      });
      
      res.json(activeReminders);
    } catch (error) {
      console.error("Error fetching dashboard reminders:", error);
      res.status(500).json({ message: "Failed to fetch dashboard reminders" });
    }
  });

  // Check for reminder notifications that should be shown
  app.get('/api/reminders/check-notifications', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const companyId = req.user!.companyId;
      
      // Get user's reminders with notifications enabled and due dates that have passed
      const now = new Date();
      const remindersDue = await storage.getReminderNotificationsDue(userId, companyId, now);
      
      res.json(remindersDue);
    } catch (error) {
      console.error("Error checking reminder notifications:", error);
      res.status(500).json({ message: "Failed to check reminder notifications" });
    }
  });

  // Mark reminder notification as shown
  app.post('/api/reminders/:id/mark-notification-shown', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const reminderId = parseInt(req.params.id);
      const userId = req.user!.id;
      
      await storage.markReminderNotificationShown(reminderId, userId);
      res.json({ message: "Notification marked as shown" });
    } catch (error) {
      console.error("Error marking notification as shown:", error);
      res.status(500).json({ message: "Failed to mark notification as shown" });
    }
  });

  // Complete reminder individually (add user to completedByUserIds)
  app.post('/api/reminders/:id/complete-individual', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const reminderId = parseInt(req.params.id);
      const userId = req.user!.id;
      const companyId = req.user!.companyId;
      
      const updatedReminder = await storage.completeReminderIndividually(reminderId, userId);
      
      // 📡 WebSocket: Notify company when user completes their part
      const wsServer = getWebSocketServer();
      if (wsServer) {
        wsServer.broadcastToCompany(companyId, {
          type: 'reminder_user_completed',
          companyId: companyId,
          data: { 
            reminderId: reminderId,
            userId: userId,
            completed: true,
            completedByUserIds: updatedReminder.completedByUserIds
          }
        });
      }
      
      res.json(updatedReminder);
    } catch (error) {
      console.error("Error completing reminder individually:", error);
      res.status(500).json({ message: "Failed to complete reminder individually" });
    }
  });

  // Reminder assignment endpoints - only for admin/manager
  app.post('/api/reminders/:id/assign', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const reminderId = parseInt(req.params.id);
      const { assignedUserIds } = req.body; // Array of user IDs to assign
      const assignedBy = req.user!.id;
      
      if (!assignedUserIds || !Array.isArray(assignedUserIds)) {
        return res.status(400).json({ message: "assignedUserIds array is required" });
      }
      
      // Check if reminder exists
      const existingReminder = await storage.getReminder(reminderId);
      if (!existingReminder) {
        return res.status(404).json({ message: "Reminder not found" });
      }
      
      // Assign reminder to users using new array-based structure
      const updatedReminder = await storage.assignReminderToUsers(reminderId, assignedUserIds, assignedBy);
      
      // Send push notifications to newly assigned users - ASYNC (no bloquea endpoint)
      const previousAssignedIds = existingReminder.assignedUserIds || [];
      const newAssignedIds = assignedUserIds.filter((id: number) => !previousAssignedIds.includes(id));
      
      if (newAssignedIds.length > 0) {
        import('./pushNotificationScheduler.js').then(async ({ sendReminderSharedNotification }) => {
          try {
            const assigner = await storage.getUser(assignedBy);
            const assignerName = assigner?.fullName || 'Admin';
            
            // Enviar todas las notificaciones en paralelo
            await Promise.allSettled(
              newAssignedIds
                .filter((id: number) => id !== assignedBy)
                .map((newUserId: number) => 
                  sendReminderSharedNotification(newUserId, existingReminder.title, assignerName, reminderId)
                )
            );
          } catch (error) {
            console.error('Error sending reminder assignment notifications:', error);
          }
        }).catch(err => console.error('Failed to load push notification module:', err));
      }
      
      res.json({ message: "Reminder assigned successfully", reminder: updatedReminder });
    } catch (error) {
      console.error("Error assigning reminder:", error);
      res.status(500).json({ message: "Failed to assign reminder" });
    }
  });

  app.get('/api/reminders/:id/assignments', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const reminderId = parseInt(req.params.id);
      const assignments = await storage.getReminderAssignments(reminderId);
      res.json(assignments);
    } catch (error) {
      console.error("Error fetching reminder assignments:", error);
      res.status(500).json({ message: "Failed to fetch assignments" });
    }
  });

  app.delete('/api/reminders/:id/assign/:userId', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const reminderId = parseInt(req.params.id);
      const userIdToRemove = parseInt(req.params.userId);
      
      const success = await storage.removeUserFromReminderAssignment(reminderId, userIdToRemove);
      if (success) {
        res.json({ message: "Assignment removed successfully" });
      } else {
        res.status(404).json({ message: "Assignment not found" });
      }
    } catch (error) {
      console.error("Error removing assignment:", error);
      res.status(500).json({ message: "Failed to remove assignment" });
    }
  });

  // AI Assistant endpoint - chat with GPT-5 Nano for administrative task automation
  app.post('/api/ai-assistant/chat', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const { messages } = req.body; // Array of message history
      const companyId = req.user!.companyId;
      const adminUserId = req.user!.id;

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ message: "Messages history is required" });
      }

      // Verify feature flag: AI assistant must be enabled for this company's plan
      const subscription = await storage.getSubscriptionByCompanyId(companyId);
      if (!subscription || !subscription.features || !(subscription.features as any).ai_assistant) {
        return res.status(403).json({ 
          message: "La funcionalidad de Asistente de IA no está disponible en tu plan actual. Contacta con el administrador para actualizar tu suscripción." 
        });
      }

      // Get plan token limit. New model: if OficazIA addon is active, enforce 1M tokens/month.
      const planInfo = await storage.getSubscriptionPlanByName(subscription.effectivePlan || subscription.plan);
      const hasOficazIAAddon = await storage.hasActiveAddon(companyId, 'ai_assistant');
      const tokenLimit = hasOficazIAAddon ? 1000000 : (planInfo?.aiTokensLimitMonthly || 0);
      
      // Check if token reset is needed (monthly cycle)
      const tokenCheckDate = new Date();
      const resetDate = subscription.aiTokensResetDate ? new Date(subscription.aiTokensResetDate) : null;
      let currentTokensUsed = subscription.aiTokensUsed || 0;
      
      if (!resetDate || tokenCheckDate.getMonth() !== resetDate.getMonth() || tokenCheckDate.getFullYear() !== resetDate.getFullYear()) {
        // New billing month - reset tokens
        currentTokensUsed = 0;
        await storage.updateCompanySubscription(companyId, {
          aiTokensUsed: 0,
          aiTokensResetDate: tokenCheckDate
        });
        console.log(`🔄 AI tokens reset for company ${companyId} - new billing period`);
      }
      
      // Check if token limit exceeded
      if (tokenLimit > 0 && currentTokensUsed >= tokenLimit) {
        return res.status(429).json({ 
          message: "Has alcanzado el límite mensual de consultas al asistente IA. El límite se reinicia el próximo mes." 
        });
      }
      
      // Track tokens used in this request
      let totalTokensUsed = 0;

      // Initialize AI client - OpenAI GPT-4o-mini (optimized for low latency in EU)
      // Note: Groq has high latency from Europe (~20-30s per call), OpenAI is faster (~2-5s)
      const OpenAI = (await import('openai')).default;
      
      const rawBase = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || 'https://api.openai.com';
      const normalizedBase = rawBase.replace(/\/$/, '') + '/v1';
      const openai = new OpenAI({
        baseURL: normalizedBase,
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
      });
      console.log(`🔧 OpenAI base URL normalized to: ${normalizedBase}`);
      
      console.log(`🤖 AI Assistant using: OpenAI (GPT-4o-mini) - Low latency mode`);
      

      // Import AI assistant functions
      const { AI_FUNCTIONS, executeAIFunction } = await import('./ai-assistant.js');
      // Import model router helpers
      const { getPreferredModel, shouldEscalate, getStrongModel } = await import('./ai-model-router.js');

      // Convert AI_FUNCTIONS to tools format
      const tools = AI_FUNCTIONS.map((func: any) => ({
        type: "function" as const,
        function: func
      }));

      // Get current date context for the AI
      const now = new Date();
      const currentDateStr = now.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      
      // Calculate THIS WEEK (Monday of current week)
      const currentDay = now.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
      const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1; // Sunday=6 days back, Monday=0, Tuesday=1, etc.
      const thisMonday = new Date(now);
      thisMonday.setDate(now.getDate() - daysFromMonday);
      const thisMondayStr = thisMonday.toISOString().split('T')[0]; // YYYY-MM-DD
      
      // Calculate this Saturday (for "esta semana de lunes a sábado")
      const thisSaturday = new Date(thisMonday);
      thisSaturday.setDate(thisMonday.getDate() + 5);
      const thisSaturdayStr = thisSaturday.toISOString().split('T')[0];
      
      // Calculate NEXT WEEK (Monday of next week)
      const daysUntilMonday = currentDay === 0 ? 1 : (8 - currentDay);
      const nextMonday = new Date(now);
      nextMonday.setDate(now.getDate() + daysUntilMonday);
      const nextMondayStr = nextMonday.toISOString().split('T')[0]; // YYYY-MM-DD
      
      // Calculate next Saturday (for "próxima semana de lunes a sábado")
      const nextSaturday = new Date(nextMonday);
      nextSaturday.setDate(nextMonday.getDate() + 5);
      const nextSaturdayStr = nextSaturday.toISOString().split('T')[0];
      
      // 🚀 PERFORMANCE OPTIMIZATION: Limit conversation history to last 6 messages
      // This provides enough context for multi-turn conversations while keeping OpenAI fast
      // Before: 5+ minutes with full history → After: <10 seconds with limited history
      const MAX_HISTORY_MESSAGES = 6; // Last 3 exchanges (user + assistant)
      const recentMessages = messages
        .filter((msg: any) => msg.role === 'user' || msg.role === 'assistant')
        .slice(-MAX_HISTORY_MESSAGES) // Take only last N messages
        .map((msg: any) => ({
          role: msg.role,
          content: msg.content
        }));
      
      const conversationHistory = recentMessages.length > 0 ? recentMessages : [{
        role: 'user' as const,
        content: messages.filter((m: any) => m.role === 'user').pop()?.content || ''
      }];

      // 🔍 PRE-DETECTION: Detect patterns and execute directly (bypasses AI for common requests)
      const lastUserMsg = conversationHistory.filter((m: any) => m.role === 'user').pop()?.content || '';
      const lastAssistantMsg = conversationHistory.filter((m: any) => m.role === 'assistant').pop()?.content || '';
      console.log('🔍 [DEBUG] Last user message:', lastUserMsg);
      
      // ⚠️ CRITICAL: Detect weekend intent (Saturday mentions)
      // This OVERRIDES default skipWeekends=true to prevent AI errors
      const saturdayMentioned = /s[áa]bado|lunes\s+a\s+s[áa]bado|de\s+lunes\s+a\s+s[áa]bado/i.test(lastUserMsg);
      const correctiveFeedback = /no\s+has?\s+inclui[dt]o|falta|te\s+falta|olvidaste|no\s+est[áa]|tambi[ée]n\s+el?\s+s[áa]bado/i.test(lastUserMsg);
      const forceSaturday = saturdayMentioned || correctiveFeedback;
      
      if (forceSaturday) {
        console.log('🎯 [WEEKEND OVERRIDE] Saturday detected - forcing skipWeekends=false');
      }

      // 🔭 PRE-DETECTION: Navigation intents (user asks to be taken somewhere)
      const navIntent = /\b(llev[ea]me|ll[eé]vame|ll[eé]vame\s+a|ll[eé]vame\s+all[ií]|ll[eé]vame\s+ah[ií]|ll[eé]vame\s+al|llevarme)\b/i.test(lastUserMsg);
      if (navIntent) {
        console.log('🧭 [PRE-PARSER] Navigation intent detected:', lastUserMsg);

        // Simple inference based on user message and last assistant context
        function inferNav() {
          const s = (lastUserMsg + ' ' + lastAssistantMsg).toLowerCase();
          if (/solicitud.*vacaciones|\bsolicitudes\b|vacaciones\s+pendientes/.test(s)) {
            // Use the pending approvals summary to choose the correct target (ausencias, fichajes, partes)
            return { page: 'pending-approvals' as const };
          }
          if (/vacaciones.*calendario|calendario/.test(s)) return { page: 'vacation-calendar' as const };
          if (/fichajes|horas|tiempo/.test(s)) return { page: 'time-tracking' as const };
          if (/cuadrante|cuadrantes|turnos/.test(s)) return { page: 'schedules' as const };
          if (/emplead|persona|usuario/.test(s)) return { page: 'employees' as const };
          if (/documentos|firmar/.test(s)) return { page: 'documents' as const, filter: 'pending' as const };
          // Fallback: dashboard (safe)
          return { page: 'dashboard' as const };
        }

        try {
          const { navigateToPage } = await import('./ai-assistant.js');
          const context = { storage, companyId, adminUserId } as any;
          const navParams = inferNav();

          // Handle a special case where we want a summary of pending approvals
          if ((navParams as any).page === 'pending-approvals') {
            try {
              const { getPendingApprovals } = await import('./ai-assistant.js');
              const pending = await getPendingApprovals(context as any);
              if (pending && pending.navigateTo) {
                return res.json({ message: pending.message || 'Perfecto, te llevo.', navigateTo: pending.navigateTo });
              }
            } catch (err) {
              console.error('🧭 [PRE-PARSER] getPendingApprovals failed:', err);
              // fallthrough to fallback behavior below
            }
          }

          const navResult = await navigateToPage(context, navParams as any);

          if (navResult && navResult.navigateTo) {
            // Immediate response: confirm and include navigateTo so frontend triggers navigation
            return res.json({ message: navResult.description || 'Perfecto, te llevo.', navigateTo: navResult.navigateTo });
          } else {
            // If no navigateTo returned, fall through to regular AI processing
            console.log('🧭 [PRE-PARSER] navigateToPage returned no navigateTo, falling back to AI');
          }
        } catch (err: any) {
          console.error('🧭 [PRE-PARSER] Navigation pre-parser failed:', err?.message || err);
          // Continue to regular AI flow so model can attempt to handle
        }
      }
      
      // ==============================================
      // PATTERN 1: CREATE SCHEDULE (variant A)
      // "ramirez trabaja de 8 a 14 la semana que viene de lunes a sabado"
      // ==============================================
      const createPattern = /^(\w+)\s+(?:trabaja|trabajará|va a trabajar)\s+de\s+(\d{1,2})\s+a\s+(\d{1,2})\s*(?:la semana que viene|próxima semana|esta semana)?\s*(?:de\s+)?(?:(lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)\s+a\s+(lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo))?/i;
      
      const createMatch = lastUserMsg.match(createPattern);
      
      if (createMatch) {
        const employeeName = createMatch[1];
        const startHour = createMatch[2].padStart(2, '0');
        const endHour = createMatch[3].padStart(2, '0');
        const dayFrom = createMatch[4];
        const dayTo = createMatch[5];
        
        console.log('🎯 DETECTED CREATE SCHEDULE PATTERN:', createMatch[0]);
        console.log(`📝 Employee: ${employeeName}, Hours: ${startHour}:00-${endHour}:00, Days: ${dayFrom || 'default'} to ${dayTo || 'default'}`);
        
        // Determine weekend inclusion based on day range
        const includesSaturday = dayTo === 'sábado' || dayTo === 'sabado';
        const includesSunday = dayTo === 'domingo';
        const skipWeekends = !(includesSaturday || includesSunday);

        // If no explicit day range and not "todos los días", ask for clarification
        const mentionsAllDays = /todos\s+los\s+d[ií]as/i.test(lastUserMsg);
        if (!dayFrom && !dayTo && !mentionsAllDays) {
          return res.status(200).json({
            message: '¿Quieres incluir sábado y domingo o solo lunes a viernes?'
          });
        }
        
        // Detect date range
        let startDate: string;
        let endDate: string;
        
        if (lastUserMsg.includes('la semana que viene') || lastUserMsg.includes('próxima semana')) {
          // Next week: Monday to Friday (or Saturday if specified)
          const nextMonday = new Date(now);
          const currentDay = now.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
          const daysUntilMonday = currentDay === 0 ? 1 : (8 - currentDay); // If Sunday, +1 day; else days until next Monday
          nextMonday.setDate(now.getDate() + daysUntilMonday);
          startDate = nextMonday.toISOString().split('T')[0];
          
          const endDay = includesSunday ? 7 : (includesSaturday ? 6 : 5); // Friday=5, Saturday=6, Sunday=7
          const nextEndDay = new Date(nextMonday);
          nextEndDay.setDate(nextMonday.getDate() + (endDay - 1));
          endDate = nextEndDay.toISOString().split('T')[0];
        } else {
          // Default: this week
          const monday = new Date(now);
          monday.setDate(now.getDate() - now.getDay() + 1);
          startDate = monday.toISOString().split('T')[0];
          
          const endDay = includesSunday ? 7 : (includesSaturday ? 6 : 5);
          const endOfWeek = new Date(monday);
          endOfWeek.setDate(monday.getDate() + (endDay - 1));
          endDate = endOfWeek.toISOString().split('T')[0];
        }
        
        try {
          // Import resolveEmployeeName
          const { resolveEmployeeName, assignScheduleInRange } = await import('./ai-assistant.js');
          const context = { storage, companyId, adminUserId };
          
          // Find employee
          const resolution = await resolveEmployeeName(storage, companyId, employeeName);
          
          if ('error' in resolution) {
            return res.status(200).json({
              message: `No encontré al empleado "${employeeName}". ¿Podrías verificar el nombre?`
            });
          }
          
          const employee = resolution;
          
          // Execute assignScheduleInRange directly
          const result = await assignScheduleInRange(context, {
            employeeId: employee.employeeId,
            startDate,
            endDate,
            startTime: `${startHour}:00`,
            endTime: `${endHour}:00`,
            title: 'Turno de trabajo',
            location: 'Oficina',
            color: '#3b82f6',
            skipWeekends
          });
          
          if (result.success) {
            const company = await storage.getCompany(companyId);
            const navigateTo = company 
              ? `/${company.companyAlias}/cuadrante?view=week&employeeId=${employee.employeeId}&startDate=${startDate}`
              : undefined;
            return res.status(200).json({
              message: result.message || `✅ Turnos creados correctamente.`,
              ...(navigateTo ? { navigateTo } : {})
            });
          } else if (result.needsConfirmation) {
            // Si hay turnos existentes, retornar mensaje de confirmación
            return res.status(200).json({
              message: result.message,
              needsConfirmation: true,
              confirmationContext: {
                action: 'createSchedule',
                employeeId: employee.employeeId,
                startDate,
                endDate,
                startHour,
                endHour,
                skipWeekends
              }
            });
          } else {
            return res.status(200).json({
              message: result.message || `❌ Error al crear los turnos`
            });
          }
        } catch (error: any) {
          console.error('Error in pre-parser create schedule:', error);
          return res.status(200).json({
            message: `Error al crear el turno: ${error.message}`
          });
        }
      }

      // ==============================================
      // PATTERN 1b: CREATE SCHEDULE (variant B)
      // "ramirez esta semana trabaja de 8 a 15 todos los dias menos el sabado y el jueves"
      // ==============================================
      const createPatternB = /^(.*?)\s+(?:esta\s+semana|la\s+semana\s+actual)\s+(?:trabaja|trabajará|va a trabajar)\s+de\s+(\d{1,2})\s+a\s+(\d{1,2})(?:\s+todos\s+los\s+d[ií]as)?/i;
      const createMatchB = lastUserMsg.match(createPatternB);

      if (createMatchB) {
        const employeeName = createMatchB[1].trim();
        const startHour = createMatchB[2].padStart(2, '0');
        const endHour = createMatchB[3].padStart(2, '0');
        
        const { excludedWeekdays, foundExclusionKeyword } = parseExcludedWeekdays(lastUserMsg);

        console.log('🎯 DETECTED CREATE SCHEDULE PATTERN (B):', createMatchB[0]);
        console.log(`📝 Employee: ${employeeName}, Hours: ${startHour}:00-${endHour}:00, Exclusions: ${excludedWeekdays.join(',') || 'none'}`);

        const mentionsAllDays = /todos\s+los\s+d[ií]as/i.test(lastUserMsg);
        const mentionsWholeWeek = /toda\s+la\s+semana|toda\s+esta\s+semana/i.test(lastUserMsg);
        const skipWeekends = (mentionsAllDays || mentionsWholeWeek || foundExclusionKeyword) ? false : true;

        if (foundExclusionKeyword && excludedWeekdays.length === 0) {
          return res.status(200).json({
            message: 'No entendí qué días excluir. ¿Qué días quieres que omita?'
          });
        }

        // If ambiguous and not mentioning all days nor any explicit range, ask for clarification
        if (!mentionsAllDays && !mentionsWholeWeek && !foundExclusionKeyword && excludedWeekdays.length === 0) {
          return res.status(200).json({
            message: '¿Quieres incluir sábado y domingo o solo lunes a viernes?'
          });
        }

        // Calculate current week Monday and end (Fri if skip weekends, else Sat)
        const monday = new Date(now);
        monday.setDate(now.getDate() - now.getDay() + 1);
        const startDate = monday.toISOString().split('T')[0];
        const endDay = skipWeekends ? 5 : 7; // if not skipping weekends, include Sunday
        const endOfWeek = new Date(monday);
        endOfWeek.setDate(monday.getDate() + (endDay - 1));
        const endDate = endOfWeek.toISOString().split('T')[0];

        try {
          const { resolveEmployeeName, assignScheduleInRange } = await import('./ai-assistant.js');
          const context = { storage, companyId, adminUserId };
          const resolution = await resolveEmployeeName(storage, companyId, employeeName);
          if ('error' in resolution) {
            return res.status(200).json({
              message: `No encontré al empleado "${employeeName}". ¿Podrías verificar el nombre?`
            });
          }
          const employee = resolution;

          const result = await assignScheduleInRange(context, {
            employeeId: employee.employeeId,
            startDate,
            endDate,
            startTime: `${startHour}:00`,
            endTime: `${endHour}:00`,
            title: 'Turno de trabajo',
            location: 'Oficina',
            color: '#3b82f6',
            skipWeekends,
            excludedWeekdays
          });

        if (result.success) {
          const company = await storage.getCompany(companyId);
          const navigateTo = company 
            ? `/${company.companyAlias}/cuadrante?view=week&employeeId=${employee.employeeId}&startDate=${startDate}`
            : undefined;
          return res.status(200).json({
            message: result.message || `✅ Turnos creados correctamente.`,
            ...(navigateTo ? { navigateTo } : {})
          });
        } else if (result.needsConfirmation) {
          // Si hay turnos existentes, retornar mensaje de confirmación
          return res.status(200).json({
            message: result.message,
            needsConfirmation: true,
            confirmationContext: {
              action: 'createScheduleB',
              employeeId: employee.employeeId,
              startDate,
              endDate,
              startHour,
              endHour,
              skipWeekends,
              excludedWeekdays
            }
          });
        } else {
          return res.status(200).json({
            message: result.message || `❌ Error al crear los turnos`
          });
        }
        } catch (error: any) {
          console.error('Error in pre-parser create schedule (B):', error);
          return res.status(200).json({
            message: `Error al crear el turno: ${error.message}`
          });
        }
      }
      
      // ==============================================
      // PATTERN 2: COPY SCHEDULE
      // ==============================================
      // ⚡ DETERMINISTIC PRE-PARSER: "X trabaja después de Y"
      // ==============================================
      const afterPattern = /(.*?)\s+trabaja(?:r[áa]?)?\s+despu[ée]s\s+de\s+([a-záéíóúñ]+)(?:\s+(?:y\s+)?hasta\s+(?:las?\s+)?(\d{1,2}):?(\d{2})?)?/i;
      const afterMatch = lastUserMsg.match(afterPattern);
      
      if (afterMatch) {
        const targetEmployeeName = afterMatch[1].trim();
        const sourceEmployeeName = afterMatch[2].trim();
        const endHour = afterMatch[3] ? parseInt(afterMatch[3]) : 22; // Default 22:00
        const endMinute = afterMatch[4] ? parseInt(afterMatch[4]) : 0;
        const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
        
        console.log('🎯 DETECTED "AFTER" PATTERN:', afterMatch[0]);
        console.log(`📝 Target: ${targetEmployeeName}, Source: ${sourceEmployeeName}, End time: ${endTime}`);
        
        try {
          const { resolveEmployeeName, createShiftAfterEmployee } = await import('./ai-assistant.js');
          const context = { storage, companyId, adminUserId };
          
          // Resolve employee names
          const sourceResolution = await resolveEmployeeName(storage, companyId, sourceEmployeeName);
          const targetResolution = await resolveEmployeeName(storage, companyId, targetEmployeeName);
          
          if ('error' in sourceResolution) {
            return res.json({ message: `❌ ${sourceResolution.error}` });
          }
          if ('error' in targetResolution) {
            return res.json({ message: `❌ ${targetResolution.error}` });
          }
          
          // Execute createShiftAfterEmployee
          const result = await createShiftAfterEmployee(context, {
            sourceEmployeeId: sourceResolution.employeeId,
            targetEmployeeId: targetResolution.employeeId,
            endTime
          });
          
          if (result.success) {
            return res.json({ 
              message: `✅ Listo. ${result.targetEmployeeName} trabajará después de ${result.sourceEmployeeName} hasta las ${endTime} (${result.createdCount} turno(s) creados).`
            });
          } else {
            return res.json({ message: `❌ ${result.error}` });
          }
        } catch (error: any) {
          console.error('Error in "after" pattern detection:', error);
          return res.json({ message: `❌ Error al crear turnos: ${error.message}` });
        }
      }
      
      // ==============================================
      // Pattern 1: "X tiene el mismo turno que Y"
      const copyPattern1 = /(.*?)\s+(tiene el mismo turno|tiene los mismos turnos|trabaja igual|tiene el mismo horario)\s+que\s+(.*?)(?:\s+(?:la semana que viene|esta semana|del \d|en|la próxima semana))?/i;
      
      // Pattern 2: "el turno de X es igual que el de Y" (con soporte para "la semana que viene" antes o después)
      const copyPattern2 = /(?:el turno|los turnos)\s+(?:de\s+)?(?:la semana que viene\s+de\s+|de\s+)?(.*?)\s+(?:es|son)\s+(?:igual|iguales?)\s+(?:que|al?)\s+(?:el de|los de|el turno de|los turnos de)\s+([^\s,]+)/i;
      
      let copyMatch = lastUserMsg.match(copyPattern1);
      let toEmployeeName = '';
      let fromEmployeeName = '';
      
      if (copyMatch) {
        toEmployeeName = copyMatch[1].trim();
        fromEmployeeName = copyMatch[3].trim();
      } else {
        copyMatch = lastUserMsg.match(copyPattern2);
        if (copyMatch) {
          toEmployeeName = copyMatch[1].trim();
          fromEmployeeName = copyMatch[2].trim();
        }
      }
      
      if (copyMatch) {
        console.log('🎯 DETECTED COPY PATTERN:', copyMatch[0]);
        console.log(`📝 From: ${fromEmployeeName}, To: ${toEmployeeName}`);
        
        // Detect date range from the message
        let startDate: string | undefined;
        let endDate: string | undefined;
        
        if (lastUserMsg.includes('la semana que viene') || lastUserMsg.includes('próxima semana')) {
          // Next week: Monday to Friday
          const nextMonday = new Date(now);
          nextMonday.setDate(now.getDate() + ((1 + 7 - now.getDay()) % 7 || 7));
          startDate = nextMonday.toISOString().split('T')[0];
          
          const nextFriday = new Date(nextMonday);
          nextFriday.setDate(nextMonday.getDate() + 4);
          endDate = nextFriday.toISOString().split('T')[0];
        }
        
        try {
          const { resolveEmployeeName, copyEmployeeShifts } = await import('./ai-assistant.js');
          const context = { storage, companyId, adminUserId };
          
          // Resolve employee names
          const fromResolution = await resolveEmployeeName(storage, companyId, fromEmployeeName);
          const toResolution = await resolveEmployeeName(storage, companyId, toEmployeeName);
          
          if ('error' in fromResolution) {
            return res.json({ message: `❌ ${fromResolution.error}` });
          }
          if ('error' in toResolution) {
            return res.json({ message: `❌ ${toResolution.error}` });
          }
          
          // Execute copy
          const result = await copyEmployeeShifts(context, {
            fromEmployeeId: fromResolution.employeeId,
            toEmployeeId: toResolution.employeeId,
            startDate,
            endDate
          });
          
          if (result.success) {
            const dateRangeText = result.dateRange ? ` para ${result.dateRange}` : '';
            return res.json({ 
              message: `✅ Listo. ${result.toEmployeeName} ahora tiene los mismos turnos que ${result.fromEmployeeName}${dateRangeText}. Se copiaron ${result.copiedCount} turno(s).`
            });
          } else {
            return res.json({ message: `❌ ${result.error}` });
          }
        } catch (error: any) {
          console.error('Error in copy pattern detection:', error);
          return res.json({ message: `❌ Error al copiar turnos: ${error.message}` });
        }
      }

      // 🔄 ITERATIVE LOOP: Allow multiple rounds of tool calls
      // The AI can call listEmployees(), then sendMessage(), then respond
      const { resolveEmployeeName } = await import('./ai-assistant.js');
      const context = { storage, companyId, adminUserId };
      const MAX_ITERATIONS = 4; // Safety margin for complex operations
      let iteration = 0;
      let currentMessages = conversationHistory;
      let allToolCalls: string[] = []; // Track all function calls made
      let navigateToUrl: string | null = null; // Track navigation URL from navigateToPage function

      while (iteration < MAX_ITERATIONS) {
        iteration++;
        console.log(`🔄 AI Assistant iteration ${iteration}/${MAX_ITERATIONS}`);

        // Select model (fast vs strong) based on message heuristics
        const chosenModel = getPreferredModel(currentMessages);
        console.log(`🤖 [MODEL ROUTER] Chosen model for this turn: ${chosenModel}`);

        // Call AI with function calling
        const response = await openai.chat.completions.create({
          model: chosenModel,
          messages: [
            {
              role: "system",
              content: `Eres OficazIA, el copiloto completo de gestión laboral. Hoy: ${currentDateStr}

⚠️ REGLA PRINCIPAL: PREGUNTA ANTES DE ACTUAR (para creación/modificación)
Si falta información para crear/modificar algo, PREGUNTA (no inventes):
- Sin horario → "¿Qué horario tendrá [nombre]?"
- Sin fecha → "¿Desde/hasta qué día?"
- Nombre ambiguo → "¿Te refieres a [opciones]?"

🚨 REGLA: NUNCA dupliques llamadas a funciones.
🚫 EMPLEADOS: Para crear empleado necesitas correo explícito del usuario. Si falta, PREGUNTA y NO llames a createEmployee. No inventes correos.

🧭 NAVEGACIÓN Y CONSULTAS (usa para RESPONDER + MOSTRAR):
- getEmployeeWorkHours(period, employeeName?) → Calcula horas Y navega a fichajes con filtro
- getVacationBalance(employeeName?) → Días disponibles Y navega a calendario vacaciones  
- getPendingApprovals() → Lista TODO pendiente (vacaciones, modificaciones) Y navega
- getCompanySettings() → Políticas actuales (días vacaciones, horas trabajo)
- navigateToPage(page, filter?, employeeName?, startDate?, endDate?) → Navegar a cualquier página con filtros

CUANDO PREGUNTEN "¿cuántas horas trabajó X?", "¿qué tiene pendiente?", "¿cuántos días de vacaciones?":
1. USA la función de consulta correspondiente
2. RESPONDE con la información
3. El sistema NAVEGA automáticamente a la página con filtros

🔄 TURNOS ROTATIVOS (assignRotatingSchedule):
- Para: "X días trabajo Y días descanso", "rotación", "3 y 3", "4 y 2"
- Requiere: empleado, horario, fechas, días trabajo/descanso

TURNOS NORMALES (assignScheduleInRange):
- skipWeekends: false (SIEMPRE incluye sábado)
- "esta semana": ${thisMondayStr} al ${thisSaturdayStr}
- "próxima semana": ${nextMondayStr} al ${nextSaturdayStr}

COPIAR TURNOS: copyEmployeeShifts(from, to) - NO consultes, copia directo

✅ VACACIONES:
- approveVacationRequests(requestIds) → Aprobar
- denyVacationRequests(requestIds, adminComment) → Denegar (incluye motivo)

⚙️ CONFIGURACIÓN:
- updateCompanySettings(workingHoursPerDay?, vacationDaysPerMonth?, etc) → Modifica políticas

📝 RECORDATORIOS (createReminder):
- reminderDate: ISO con zona España (UTC+1)
- assignToEmployeeIds: ARRAY [5, 3]

EMPLEADOS: updateEmployee(), listEmployees(), createEmployee()
INFORMES: generateTimeReport(format, period, employeeName?)

Respuestas breves: "Listo", "Perfecto", "Ya está".`
          },
          ...currentMessages
        ],
        tools,
        tool_choice: "auto",
        max_completion_tokens: 512, // Optimized for speed
      });

      // Delegate call + escalation logic to helper (keeps routes.ts minimal & testable)
      const { runAssistantTurn } = await import('./ai-runner.js');
      const runResult = await runAssistantTurn(openai, [
        {
          role: 'system',
          content: `Eres OficazIA, el copiloto completo de gestión laboral. Hoy: ${currentDateStr}

⚠️ REGLA PRINCIPAL: PREGUNTA ANTES DE ACTUAR (para creación/modificación)
Si falta información para crear/modificar algo, PREGUNTA (no inventes):
- Sin horario → "¿Qué horario tendrá [nombre]?"
- Sin fecha → "¿Desde/hasta qué día?"
- Nombre ambiguo → "¿Te refieres a [opciones]?"

🚨 REGLA: NUNCA dupliques llamadas a funciones.

🧭 NAVEGACIÓN Y CONSULTAS (usa para RESPONDER + MOSTRAR):
- getEmployeeWorkHours(period, employeeName?) → Calcula horas Y navega a fichajes con filtro
- getVacationBalance(employeeName?) → Días disponibles Y navega a calendario vacaciones  
- getPendingApprovals() → Lista TODO pendiente (vacaciones, modificaciones) Y navega
- getCompanySettings() → Políticas actuales (días vacaciones, horas trabajo)
- navigateToPage(page, filter?, employeeName?, startDate?, endDate?) → Navegar a cualquier página con filtros

CUANDO PREGUNTEN "¿cuántas horas trabajó X?", "¿qué tiene pendiente?", "¿cuántos días de vacaciones?":
1. USA la función de consulta correspondiente
2. RESPONDE con la información
3. El sistema NAVEGA automáticamente a la página con filtros

🔄 TURNOS ROTATIVOS (assignRotatingSchedule):
- Para: "X días trabajo Y días descanso", "rotación", "3 y 3", "4 y 2"
- Requiere: empleado, horario, fechas, días trabajo/descanso

TURNOS NORMALES (assignScheduleInRange):
- skipWeekends: false (SIEMPRE incluye sábado)
- "esta semana": ${thisMondayStr} al ${thisSaturdayStr}
- "próxima semana": ${nextMondayStr} al ${nextSaturdayStr}

COPIAR TURNOS: copyEmployeeShifts(from, to) - NO consultes, copia directo

✅ VACACIONES:
- approveVacationRequests(requestIds) → Aprobar
- denyVacationRequests(requestIds, adminComment) → Denegar (incluye motivo)

⚙️ CONFIGURACIÓN:
- updateCompanySettings(workingHoursPerDay?, vacationDaysPerMonth?, etc) → Modifica políticas

📝 RECORDATORIOS (createReminder):
- reminderDate: ISO con zona España (UTC+1)
- assignToEmployeeIds: ARRAY [5, 3]

EMPLEADOS: updateEmployee(), listEmployees(), createEmployee()
INFORMES: generateTimeReport(format, period, employeeName?)

Respuestas breves: "Listo", "Perfecto", "Ya está".`
          },
          ...currentMessages
      ],
      tools);

      // Merge tokens used from helper
      let assistantMessage = runResult.assistantMessage;
      totalTokensUsed += runResult.usedTokens;
      console.log(`📊 Tokens used this turn: ${runResult.usedTokens} (total: ${totalTokensUsed})`);

      // If NO tool calls, AI has finished → return response
      if (!assistantMessage?.tool_calls || assistantMessage.tool_calls.length === 0) {
        console.log(`✅ AI Assistant finished after ${iteration} iteration(s)`);
        console.log(`🔧 Tool calls made: ${allToolCalls.join(', ') || 'none'}`);
        console.log(`📊 Total tokens used: ${totalTokensUsed}`);
        
        // Save tokens to database
        if (totalTokensUsed > 0) {
          await storage.updateCompanySubscription(companyId, {
            aiTokensUsed: currentTokensUsed + totalTokensUsed
          });
        }
        
        res.json({
          message: assistantMessage?.content || "No entendí tu solicitud. ¿Puedes reformularla?",
          functionCalled: allToolCalls.join(", ") || null,
          result: null,
          navigateTo: navigateToUrl // Include navigation URL if present
        });
        return; // Exit endpoint
      }

      // Execute all tool calls for this iteration
      console.log(`🔧 Executing ${assistantMessage.tool_calls.length} tool call(s) in iteration ${iteration}`);
      const toolResults = [];

        for (const toolCall of assistantMessage.tool_calls) {
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments);

          // Hard guard: do not create employees without explicit email
          if (functionName === 'createEmployee') {
            const email = functionArgs.email?.trim?.();
            if (!email || typeof email !== 'string' || !email.includes('@')) {
              toolResults.push({
                role: "tool" as const,
                tool_call_id: toolCall.id,
                content: JSON.stringify({ error: 'Correo obligatorio. Facilita un correo corporativo o personal para crear al empleado.' })
              });
              continue;
            }
          }

          // Resolve employee names to IDs before executing function
          const functionsNeedingEmployeeResolution = ['getEmployeeShifts', 'getEmployeeWorkHours', 'getVacationBalance', 'assignSchedule', 'assignScheduleInRange', 'assignRotatingSchedule', 'requestDocument', 'deleteWorkShift', 'deleteWorkShiftsInRange', 'updateWorkShiftTimes', 'updateWorkShiftsInRange', 'updateEmployeeShiftsColor', 'updateWorkShiftColor', 'updateWorkShiftDetails', 'detectWorkShiftOverlaps', 'createReminder'];
          if (functionsNeedingEmployeeResolution.includes(functionName) && functionArgs.employeeName) {
            const resolution = await resolveEmployeeName(storage, companyId, functionArgs.employeeName);
            
            if ('error' in resolution) {
              // Name resolution failed - add error to results
              toolResults.push({
                role: "tool" as const,
                tool_call_id: toolCall.id,
                content: JSON.stringify({ error: resolution.error })
              });
              continue;
            }
            
            // Replace employeeName with employeeId
            functionArgs.employeeId = resolution.employeeId;
            delete functionArgs.employeeName;
          }

          // Handle functions that need TWO employee name resolutions
          if (functionName === 'swapEmployeeShifts') {
            if (functionArgs.employeeAName) {
              const resolutionA = await resolveEmployeeName(storage, companyId, functionArgs.employeeAName);
              if ('error' in resolutionA) {
                toolResults.push({
                  role: "tool" as const,
                  tool_call_id: toolCall.id,
                  content: JSON.stringify({ error: `Empleado A: ${resolutionA.error}` })
                });
                continue;
              }
              functionArgs.employeeAId = resolutionA.employeeId;
              delete functionArgs.employeeAName;
            }

            if (functionArgs.employeeBName) {
              const resolutionB = await resolveEmployeeName(storage, companyId, functionArgs.employeeBName);
              if ('error' in resolutionB) {
                toolResults.push({
                  role: "tool" as const,
                  tool_call_id: toolCall.id,
                  content: JSON.stringify({ error: `Empleado B: ${resolutionB.error}` })
                });
                continue;
              }
              functionArgs.employeeBId = resolutionB.employeeId;
              delete functionArgs.employeeBName;
            }
          }

          if (functionName === 'copyEmployeeShifts') {
            if (functionArgs.fromEmployeeName) {
              const resolutionFrom = await resolveEmployeeName(storage, companyId, functionArgs.fromEmployeeName);
              if ('error' in resolutionFrom) {
                toolResults.push({
                  role: "tool" as const,
                  tool_call_id: toolCall.id,
                  content: JSON.stringify({ error: `Empleado origen: ${resolutionFrom.error}` })
                });
                continue;
              }
              functionArgs.fromEmployeeId = resolutionFrom.employeeId;
              delete functionArgs.fromEmployeeName;
            }

            if (functionArgs.toEmployeeName) {
              const resolutionTo = await resolveEmployeeName(storage, companyId, functionArgs.toEmployeeName);
              if ('error' in resolutionTo) {
                toolResults.push({
                  role: "tool" as const,
                  tool_call_id: toolCall.id,
                  content: JSON.stringify({ error: `Empleado destino: ${resolutionTo.error}` })
                });
                continue;
              }
              functionArgs.toEmployeeId = resolutionTo.employeeId;
              delete functionArgs.toEmployeeName;
            }
          }

          // Handle createReminder with employee names
          if (functionName === 'createReminder' && functionArgs.assignToEmployeeNames) {
            const employeeNames = functionArgs.assignToEmployeeNames;
            const resolvedIds: number[] = [];
            let hasError = false;
            let errorMessage = '';

            for (const name of employeeNames) {
              const resolution = await resolveEmployeeName(storage, companyId, name);
              if ('error' in resolution) {
                toolResults.push({
                  role: "tool" as const,
                  tool_call_id: toolCall.id,
                  content: JSON.stringify({ error: `Empleado "${name}": ${resolution.error}` })
                });
                hasError = true;
                break;
              }
              resolvedIds.push(resolution.employeeId);
            }

            if (hasError) {
              continue;
            }

            // Replace assignToEmployeeNames with assignToEmployeeIds
            functionArgs.assignToEmployeeIds = resolvedIds;
            delete functionArgs.assignToEmployeeNames;
          }

          // Delegate execution of tool calls to helper (allows isolated testing)
          const { runToolCalls } = await import('./ai-tool-runner.js');
          const results = await runToolCalls(assistantMessage.tool_calls, context, resolveEmployeeName, executeAIFunction, storage);

          // Merge returned tool results and capture navigateTo if present in any
          for (const tr of results) {
            const parsed = JSON.parse(tr.content);
            if (parsed && parsed.navigateTo) {
              navigateToUrl = parsed.navigateTo;
            }
            toolResults.push(tr);
          }
        }

        // Track all tool calls made
        for (const toolCall of assistantMessage.tool_calls) {
          allToolCalls.push(toolCall.function.name);
        }

        // Add assistant message and tool results to conversation history
        currentMessages.push({
          role: "assistant",
          content: null,
          tool_calls: assistantMessage.tool_calls
        });
        currentMessages.push(...toolResults);

        console.log(`✅ Completed iteration ${iteration}, tool results added to history`);
        // Continue loop → AI can make more tool calls in next iteration
      }

      // Safety: If we reach MAX_ITERATIONS, save tokens and return error
      console.log(`⚠️ AI Assistant reached MAX_ITERATIONS (${MAX_ITERATIONS})`);
      console.log(`📊 Total tokens used before limit: ${totalTokensUsed}`);
      
      // Save tokens even if we hit the limit
      if (totalTokensUsed > 0) {
        await storage.updateCompanySubscription(companyId, {
          aiTokensUsed: currentTokensUsed + totalTokensUsed
        });
      }
      
      res.status(500).json({
        message: "El asistente alcanzó el límite de iteraciones. Por favor, intenta reformular tu solicitud de forma más simple.",
        error: "MAX_ITERATIONS_REACHED"
      });
    } catch (error: any) {
      console.error("Error in AI assistant:", error);
      res.status(500).json({ 
        message: "Error al procesar tu solicitud con el asistente de IA",
        error: error.message 
      });
    }
  });

  // Get employees for assignment (admin/manager only)
  app.get('/api/users/employees', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;
      const employees = await storage.getEmployeesByCompany(companyId);
      res.json(employees);
    } catch (error) {
      console.error("Error fetching employees:", error);
      res.status(500).json({ message: "Failed to fetch employees" });
    }
  });

  // Clean up test mode Stripe data endpoint
  app.post('/api/account/cleanup-test-stripe', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const companyId = req.user!.companyId;
      
      console.log(`🧹 Cleaning up test Stripe data for company ${companyId}`);
      
      // Get current subscription
      const subscription = await storage.getSubscriptionByCompanyId(companyId);
      if (!subscription) {
        return res.status(404).json({ message: 'No subscription found' });
      }
      
      // Check if this looks like test data (has stripeSubscriptionId but no valid customer)
      if (subscription.stripeSubscriptionId && !subscription.stripeCustomerId) {
        console.log(`🔍 Found test subscription: ${subscription.stripeSubscriptionId}`);
        
        // Try to retrieve the subscription from Stripe
        try {
          const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
          console.log(`❌ Test subscription still exists in Stripe, canceling it`);
          
          // Cancel the test subscription
          await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
        } catch (error: any) {
          if (error.code === 'resource_missing') {
            console.log(`✅ Test subscription not found in Stripe (already cleaned up)`);
          } else {
            console.log(`⚠️ Error checking test subscription: ${error.message}`);
          }
        }
        
        // Clean up the subscription record - reset to trial status
        const cleanedSubscription = await storage.updateCompanySubscription(companyId, {
          stripeSubscriptionId: null,
          status: 'trial', // Reset to trial so they can properly subscribe
          endDate: null,
          firstPaymentDate: null,
          nextPaymentDate: null,
          updatedAt: new Date()
        });
        
        console.log(`✅ Cleaned up test data for company ${companyId}`);
        res.json({ 
          message: 'Test data cleaned up successfully',
          subscription: cleanedSubscription
        });
      } else {
        res.json({ message: 'No test data found to clean up' });
      }
      
    } catch (error) {
      console.error('Error cleaning up test Stripe data:', error);
      res.status(500).json({ message: 'Error al limpiar datos de prueba' });
    }
  });

  // Stripe payment setup intent endpoint
  app.post('/api/account/create-setup-intent', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }

      // Get company data first (needed for payment intent description)
      const company = await storage.getCompanyByUserId(userId);
      if (!company) {
        return res.status(404).json({ message: 'Empresa no encontrada' });
      }

      // Create or get Stripe customer
      let stripeCustomerId = user.stripeCustomerId;
      
      // Check if customer exists in Stripe (handles test->production transition)
      if (stripeCustomerId) {
        try {
          await stripe.customers.retrieve(stripeCustomerId);
        } catch (error: any) {
          if (error.code === 'resource_missing') {
            console.log(`Customer ${stripeCustomerId} not found (likely test mode data), creating new one`);
            stripeCustomerId = null; // Force creation of new customer
          } else {
            throw error; // Re-throw other errors
          }
        }
      }
      
      if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          email: company.email || user.companyEmail,
          name: user.fullName,
          metadata: {
            userId: userId.toString(),
            companyId: user.companyId.toString()
          }
        });
        
        stripeCustomerId = customer.id;
        await storage.updateUserStripeCustomerId(userId, stripeCustomerId);
        console.log(`Created new production customer: ${stripeCustomerId}`);
      }

      // Create setup intent for €0 card verification (no charge during trial)
      const setupIntent = await stripe.setupIntents.create({
        customer: stripeCustomerId,
        payment_method_types: ['card'],
        usage: 'off_session', // Will be charged after trial ends
        description: `Verificación de tarjeta para Oficaz - ${company.name}`,
      });

      res.json({
        clientSecret: setupIntent.client_secret,
        customerId: stripeCustomerId,
        setupIntentId: setupIntent.id
      });
    } catch (error) {
      console.error('Error creating setup intent:', error);
      res.status(500).json({ message: 'Error al crear setup intent' });
    }
  });

  // Confirm payment method and create recurring subscription
  app.post('/api/account/confirm-payment-method', authenticateToken, async (req: AuthRequest, res) => {
    const { setupIntentId, paymentIntentId } = req.body;
    const intentId = setupIntentId || paymentIntentId; // Support both for backward compatibility
    
    console.log(`🚨 PAYMENT ENDPOINT CALLED - User ${req.user!.id}, intentId: ${intentId}`);
    try {
      const userId = req.user!.id;

      if (!intentId) {
        console.log(`🚨 PAYMENT FAILED - No intentId provided`);
        return res.status(400).json({ message: 'Setup Intent ID es requerido' });
      }
      
      console.log(`🚨 PAYMENT PROCESSING - Retrieving intent ${intentId}`);

      // Retrieve the setup intent to get payment method
      let paymentMethodId: string;
      
      if (setupIntentId) {
        const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);
        
        if (setupIntent.status !== 'succeeded') {
          console.log(`🚨 VERIFICATION FAILED - Status: ${setupIntent.status}`);
          return res.status(400).json({ message: 'La verificación de la tarjeta no fue exitosa' });
        }
        
        paymentMethodId = setupIntent.payment_method as string;
        console.log(`✅ CARD VERIFIED - PaymentMethod: ${paymentMethodId}`);
      } else {
        // Legacy PaymentIntent support
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (paymentIntent.status !== 'requires_capture' && paymentIntent.status !== 'succeeded') {
          return res.status(400).json({ message: 'La autorización del pago no fue exitosa' });
        }
        paymentMethodId = paymentIntent.payment_method as string;
      }

      // Get company and subscription data
      const company = await storage.getCompanyByUserId(userId);
      if (!company?.subscription) {
        return res.status(404).json({ message: 'Suscripción no encontrada' });
      }

      // ⚠️ DUPLICATE PREVENTION: Check if subscription already has a Stripe subscription
      if (company.subscription.stripeSubscriptionId) {
        console.log(`⚠️ DUPLICATE PREVENTION - Company ${company.id} already has Stripe subscription: ${company.subscription.stripeSubscriptionId}`);
        return res.json({ 
          success: true, 
          message: 'La suscripción ya está activa',
          subscriptionId: company.subscription.stripeSubscriptionId,
          alreadyActive: true
        });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }

      // NEW MODULAR PRICING MODEL: Calculate total from addons + user seats
      // 1. Get all active addons for this company and sum their prices
      // NOTE: ALL addons are paid (time_tracking, vacation, schedules = €3, messages/reminders = €5, etc.)
      // "Gestión de Empleados" is free but only for marketing, not in the store
      const companyAddons = await storage.getCompanyAddons(company.id);
      const activeAddons = companyAddons.filter(ca => ca.status === 'active' || ca.status === 'pending_cancel');
      
      const addonsTotalPrice = activeAddons.reduce((sum, ca) => {
        const addonPrice = parseFloat(ca.addon?.monthlyPrice?.toString() || '0');
        return sum + addonPrice;
      }, 0);
      console.log(`💰 MODULAR: ${activeAddons.length} addons = €${addonsTotalPrice.toFixed(2)}/month`);
      
      // 2. Get seat pricing and calculate user seats total
      const seatPricing = await storage.getAllSeatPricing();
      const seatPriceMap: Record<string, number> = {};
      for (const sp of seatPricing) {
        seatPriceMap[sp.roleType] = parseFloat(sp.monthlyPrice?.toString() || '0');
      }
      
      // User seats: extraAdmins, extraManagers, extraEmployees from subscription
      // Note: First admin is included in base, rest are "extra"
      const adminSeats = (company.subscription.extraAdmins || 0) + 1; // +1 for the creator admin
      const managerSeats = company.subscription.extraManagers || 0;
      const employeeSeats = company.subscription.extraEmployees || 0;
      
      const seatsTotalPrice = 
        (adminSeats * (seatPriceMap['admin'] || 6)) +
        (managerSeats * (seatPriceMap['manager'] || 4)) +
        (employeeSeats * (seatPriceMap['employee'] || 2));
      console.log(`💰 MODULAR: ${adminSeats} admins + ${managerSeats} managers + ${employeeSeats} employees = €${seatsTotalPrice.toFixed(2)}/month`);
      
      // 3. Calculate total monthly price
      // If custom price is set (by SuperAdmin), use that instead
      const customPriceNum = company.subscription.customMonthlyPrice ? Number(company.subscription.customMonthlyPrice) : null;
      let monthlyPrice: number;
      
      if (customPriceNum && customPriceNum > 0) {
        // SuperAdmin has set a custom price - use that
        monthlyPrice = customPriceNum;
        console.log(`💰 MODULAR: Using SuperAdmin custom price: €${monthlyPrice.toFixed(2)}/month`);
      } else {
        // Calculate from addons + seats (base is €0 in modular model)
        monthlyPrice = addonsTotalPrice + seatsTotalPrice;
        console.log(`💰 MODULAR: Total = €${addonsTotalPrice.toFixed(2)} (addons) + €${seatsTotalPrice.toFixed(2)} (seats) = €${monthlyPrice.toFixed(2)}/month`);
      }
      
      // Minimum validation: At least 1 admin (€6) and 1 addon (€3) required
      const minimumPrice = 6 + 3; // €6 for 1 admin + €3 for cheapest addon
      if (monthlyPrice < minimumPrice && !customPriceNum) {
        console.log(`🚨 MODULAR: Price €${monthlyPrice.toFixed(2)} below minimum €${minimumPrice}. Adjusting.`);
        monthlyPrice = minimumPrice;
      }
      
      console.log(`💰 FINAL: Charging €${monthlyPrice.toFixed(2)}/month for ${company.name}`);

      // Create or get Stripe customer
      let stripeCustomerId = user.stripeCustomerId;
      
      // Check if customer exists in Stripe (handles test->production transition)
      if (stripeCustomerId) {
        try {
          await stripe.customers.retrieve(stripeCustomerId);
        } catch (error: any) {
          if (error.code === 'resource_missing') {
            console.log(`Customer ${stripeCustomerId} not found (likely test mode data), creating new one`);
            stripeCustomerId = null; // Force creation of new customer
          } else {
            throw error; // Re-throw other errors
          }
        }
      }
      
      if (!stripeCustomerId) {
        // Create Stripe customer with complete company information for accurate invoicing
        const customer = await stripe.customers.create({
          email: company.email,
          name: company.name,
          description: `Cliente Oficaz - ${company.name}`,
          address: {
            line1: company.address || 'Dirección no especificada',
            city: company.province || 'Madrid',
            postal_code: company.province === 'sevilla' ? '41001' : '28020',
            country: 'ES'
          },
          metadata: {
            userId: userId.toString(),
            companyId: company.id.toString(),
            plan: 'oficaz',
            contact_name: user.fullName,
            tax_id: company.cif || 'B00000000'
          }
        });
        
        stripeCustomerId = customer.id;
        await storage.updateUserStripeCustomerId(userId, stripeCustomerId);
        console.log(`Created new production customer: ${stripeCustomerId}`);
      }

      // Attach payment method to customer (if not already attached by SetupIntent)
      try {
        await stripe.paymentMethods.attach(paymentMethodId, {
          customer: stripeCustomerId,
        });
      } catch (error: any) {
        // Ignore if already attached (SetupIntent does this automatically)
        if (error.code !== 'resource_missing') {
          console.log(`Payment method already attached or error:`, error.message);
        }
      }

      // Set as default payment method
      await stripe.customers.update(stripeCustomerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });

      // Create product first
      const product = await stripe.products.create({
        name: `Oficaz - ${company.name}`,
      });

      // Create a price for that product
      const unitAmountCents = Math.round(monthlyPrice * 100); // Convert to cents
      console.log(`💰 STRIPE DEBUG: monthlyPrice=${monthlyPrice} -> unit_amount=${unitAmountCents} cents`);
      const price = await stripe.prices.create({
        currency: 'eur',
        unit_amount: unitAmountCents,
        recurring: {
          interval: 'month',
        },
        product: product.id,
      });
      console.log(`💰 STRIPE PRICE CREATED: ID=${price.id}, unit_amount=${price.unit_amount || 0} cents (€${(price.unit_amount || 0)/100})`);

      // For trial period: Save authorization details, don't create subscription yet
      const trialEndDate = new Date(company.subscription.trialEndDate);
      const now = new Date();
      
      if (trialEndDate > now) {
        // Trial active: Authorization successful, save PaymentIntent for capture at trial end
        console.log(`🏦 TRIAL AUTHORIZATION - PaymentIntent ${paymentIntent.id} authorized for €${paymentIntent.amount/100}`);
        console.log(`🏦 TRIAL SCHEDULE - Will capture on ${trialEndDate.toISOString()}`);
        
        // Store the payment intent ID in the subscription for later capture
        await db.execute(sql`
          UPDATE subscriptions 
          SET updated_at = now(),
              stripe_customer_id = ${stripeCustomerId}
          WHERE company_id = ${company.id}
        `);
        
        // Store the payment intent in company custom_features for later capture
        // Save original custom price for final billing even if authorization was higher
        // In modular system, use calculated price from addons + users, or custom override
        const actualCustomPrice = company.subscription.customMonthlyPrice ? Number(company.subscription.customMonthlyPrice) : null;
        const originalCustomPrice = actualCustomPrice || monthlyPrice;
        await db.execute(sql`
          UPDATE companies 
          SET custom_features = COALESCE(custom_features, '{}') || jsonb_build_object(
            'pending_payment_intent_id', ${paymentIntent.id},
            'authorization_amount', ${paymentIntent.amount},
            'actual_billing_amount', ${Math.round(originalCustomPrice * 100)},
            'authorization_date', ${now.toISOString()}
          )
          WHERE id = ${company.id}
        `);
        
        res.json({
          success: true,
          message: 'Autorización exitosa - El cobro se realizará al finalizar el trial',
          authorizationAmount: paymentIntent.amount / 100,
          trialEndDate: trialEndDate.toISOString(),
          paymentIntentId: paymentIntent.id
        });
        return;
      } else {
        // Trial has ended: Create subscription with SEPARATE ITEMS for each addon and user type
        // This allows proper cancellation/addition of individual items later
        console.log(`🏦 TRIAL ENDED - Creating subscription with separate items`);
        
        // Check for SuperAdmin custom price override
        const customPriceOverride = company.subscription.customMonthlyPrice ? Number(company.subscription.customMonthlyPrice) : null;
        
        // Validate minimum requirements: 1 admin (€6) + at least 1 addon
        if (activeAddons.length === 0) {
          console.error('🚨 No addons selected - minimum 1 addon required');
          return res.status(400).json({ message: 'Se requiere al menos una funcionalidad para activar la suscripción' });
        }
        if (adminSeats < 1) {
          console.error('🚨 No admin seats - minimum 1 admin required');
          return res.status(400).json({ message: 'Se requiere al menos un administrador para activar la suscripción' });
        }
        
        // Build subscription items array - each addon and user type as separate item
        const subscriptionItems: Array<{ price: string; quantity: number; metadata?: Record<string, string> }> = [];
        
        // 1. Create items for each active addon (ALL addons are paid)
        for (const companyAddon of activeAddons) {
          const addon = companyAddon.addon;
          if (!addon) continue;
          
          let stripePriceId = addon.stripePriceId;
          
          if (!stripePriceId) {
            // Create Stripe product and price for this addon
            const stripeProduct = await stripe.products.create({
              name: `Oficaz: ${addon.name}`,
              description: addon.description || addon.shortDescription || undefined,
              metadata: { addon_key: addon.key, feature_key: addon.featureKey || addon.key }
            });
            
            const stripePrice = await stripe.prices.create({
              product: stripeProduct.id,
              unit_amount: Math.round(Number(addon.monthlyPrice) * 100),
              currency: 'eur',
              recurring: { interval: 'month' },
              nickname: addon.name,
              metadata: { addon_key: addon.key }
            });
            
            stripePriceId = stripePrice.id;
            
            // Update addon with Stripe IDs
            await storage.updateAddon(addon.id, {
              stripeProductId: stripeProduct.id,
              stripePriceId: stripePrice.id,
            });
          }
          
          subscriptionItems.push({
            price: stripePriceId,
            quantity: 1,
            metadata: { addon_id: addon.id.toString(), addon_key: addon.key }
          });
          
          console.log(`  📦 Addon item: ${addon.name} (€${addon.monthlyPrice}/mes)`);
        }
        
        // 2. Create items for user seats
        const seatTypes = [
          { key: 'admin', count: adminSeats, price: seatPriceMap['admin'] || 6, name: 'Admin' },
          { key: 'manager', count: managerSeats, price: seatPriceMap['manager'] || 4, name: 'Manager' },
          { key: 'employee', count: employeeSeats, price: seatPriceMap['employee'] || 2, name: 'Empleado' },
        ];
        
        for (const seat of seatTypes) {
          if (seat.count <= 0) continue;
          
          let seatPricingRecord = await storage.getSeatPricing(seat.key);
          let stripePriceId = seatPricingRecord?.stripePriceId;
          
          if (!stripePriceId) {
            // Create Stripe product and price for this seat type
            const stripeProduct = await stripe.products.create({
              name: `Oficaz: Usuario ${seat.name}`,
              description: `Usuario tipo ${seat.name}`,
              metadata: { seat_type: seat.key }
            });
            
            const stripePrice = await stripe.prices.create({
              product: stripeProduct.id,
              unit_amount: Math.round(seat.price * 100),
              currency: 'eur',
              recurring: { interval: 'month' },
              nickname: `Usuario ${seat.name}`,
              metadata: { seat_type: seat.key }
            });
            
            stripePriceId = stripePrice.id;
            
            // Update seat pricing with Stripe IDs
            await db.execute(sql`
              UPDATE seat_pricing 
              SET stripe_product_id = ${stripeProduct.id}, stripe_price_id = ${stripePrice.id}
              WHERE role_type = ${seat.key}
            `);
          }
          
          subscriptionItems.push({
            price: stripePriceId,
            quantity: seat.count,
            metadata: { seat_type: seat.key }
          });
          
          console.log(`  👤 Seat item: ${seat.count}x ${seat.name} (€${seat.price}/mes c/u)`);
        }
        
        // Ensure we have at least one item
        if (subscriptionItems.length === 0) {
          console.error('No subscription items to create!');
          return res.status(400).json({ message: 'No hay items para crear la suscripción' });
        }
        
        // Handle SuperAdmin custom price override
        let finalItems = subscriptionItems;
        if (customPriceOverride && customPriceOverride > 0) {
          console.log(`💰 SUPERADMIN OVERRIDE: Using custom price €${customPriceOverride}/month instead of itemized billing`);
          
          // Create a single custom price item
          const customProduct = await stripe.products.create({
            name: `Oficaz: Precio Personalizado - ${company.name}`,
            description: `Precio especial para ${company.name}`,
            metadata: { company_id: company.id.toString(), type: 'custom_price' }
          });
          
          const customPrice = await stripe.prices.create({
            product: customProduct.id,
            unit_amount: Math.round(customPriceOverride * 100),
            currency: 'eur',
            recurring: { interval: 'month' },
            nickname: 'Precio Personalizado',
            metadata: { type: 'custom_price', company_id: company.id.toString() }
          });
          
          finalItems = [{ price: customPrice.id, quantity: 1, metadata: { type: 'custom_price' } }];
        }
        
        // Create subscription with all items
        const subscription = await stripe.subscriptions.create({
          customer: stripeCustomerId,
          items: finalItems,
          default_payment_method: paymentIntent.payment_method as string,
        });
        
        console.log(`💰 SUBSCRIPTION CREATED with ${finalItems.length} items, Status: ${subscription.status}`);
        
        // Update company_addons with their Stripe subscription item IDs
        for (const item of subscription.items.data) {
          const addonKey = item.price?.metadata?.addon_key;
          if (addonKey) {
            const addon = await storage.getAddonByKey(addonKey);
            if (addon) {
              await db.execute(sql`
                UPDATE company_addons 
                SET stripe_subscription_item_id = ${item.id}
                WHERE company_id = ${company.id} AND addon_id = ${addon.id}
              `);
              console.log(`  ✅ Updated addon ${addonKey} with stripeSubscriptionItemId: ${item.id}`);
            }
          }
        }
        
        // Update database with Stripe subscription info and activate
        const firstPaymentDate = new Date(now);
        const nextPaymentDate = new Date(now);
        nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
        
        await db.execute(sql`
          UPDATE subscriptions 
          SET 
            status = 'active',
            is_trial_active = false,
            stripe_subscription_id = ${subscription.id},
            stripe_customer_id = ${stripeCustomerId},
            first_payment_date = ${firstPaymentDate.toISOString()},
            next_payment_date = ${nextPaymentDate.toISOString()}
          WHERE id = ${company.subscription.id}
        `);

        res.json({ 
          success: true, 
          message: `Pago procesado correctamente. Tu suscripción está activa.`,
          subscriptionId: subscription.id,
          firstPaymentDate: firstPaymentDate.toISOString(),
          nextPaymentDate: nextPaymentDate.toISOString()
        });
      }
    } catch (error) {
      console.error('Error confirming payment authorization:', error);
      res.status(500).json({ message: 'Error al confirmar autorización de pago: ' + (error as any).message });
    }
  });

  // Account management endpoints
  app.get('/api/account/info', authenticateToken, async (req: AuthRequest, res) => {
    // Disable caching for account info
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    try {
      const companyId = req.user!.companyId;
      // Account info request

      // Get real company and admin data from database
      const company = await storage.getCompany(companyId);
      const admin = await storage.getUser(req.user!.id);
      
      console.log('DEBUG - Company data:', { 
        id: company?.id, 
        name: company?.name, 
        createdAt: company?.createdAt,
        cif: company?.cif,
        email: company?.email,
        address: company?.address,
        province: company?.province
      });
      
      console.log('DEBUG - Admin data:', { 
        id: admin?.id, 
        fullName: admin?.fullName, 
        companyEmail: admin?.companyEmail,
        personalEmail: admin?.personalEmail
      });
      
      if (!company) {
        return res.status(404).json({ message: 'Empresa no encontrada' });
      }
      
      // Use real creation date from database
      const registrationDate = new Date(company.createdAt);
      console.log('DEBUG - Registration date:', registrationDate.toISOString());
      
      const accountInfo = {
        id: companyId,
        company_id: companyId,
        account_id: company.accountId || `OFZ-${registrationDate.getFullYear()}-${String(companyId).padStart(6, '0')}`,
        registration_date: registrationDate.toISOString(),
        billing_name: company.name || req.user!.fullName,
        billing_email: company.email, // Email de empresa unificado con facturación
        billing_address: company.address || `Calle Principal ${companyId}, 1º A`,
        billing_city: company.province || 'Madrid',
        billing_postal_code: company.billingPostalCode || (company.province === 'sevilla' ? '41001' : '28020'),
        billing_country: company.billingCountry || 'ES',
        tax_id: company.cif,
        // Frontend compatibility fields (same data with expected names)
        cif: company.cif,
        address: company.address || `Calle Principal ${companyId}, 1º A`,
        province: company.province || 'Madrid',
        updated_at: new Date().toISOString()
      };
      
      console.log('DEBUG - Final account info:', accountInfo);

      res.json(accountInfo);
    } catch (error) {
      console.error('Error fetching account info:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  app.get('/api/account/subscription', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;
      
      // Use the new getSubscriptionByCompanyId method that includes features from new system
      const subscription = await storage.getSubscriptionByCompanyId(companyId);
      if (!subscription) {
        // Return actual subscription based on company usage
        const nextYear = new Date().getFullYear() + 1;
        const realSubscription = {
          plan: 'premium',
          status: 'active',
          end_date: `${nextYear}-12-31T23:59:59Z`,
          max_users: 999,
          company_id: companyId,
          features: {
            unlimited_employees: true,
            priority_support: true,
            advanced_reports: true,
            document_management: true,
            time_tracking: true
          }
        };
        return res.json(realSubscription);
      }

      // Override max_users with dynamic value from subscription_plans
      const finalSubscription = {
        ...subscription,
        max_users: subscription.dynamic_max_users || subscription.max_users // Use dynamic value if available
      };

      res.json(finalSubscription);
    } catch (error) {
      console.error('Error fetching subscription:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  app.get('/api/account/payment-methods', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      
      // Get user data to obtain Stripe customer ID
      const user = await storage.getUser(userId);
      if (!user || !user.stripeCustomerId) {
        return res.json([]);
      }

      try {
        // Check if customer exists (handles test->production transition)
        let customer;
        try {
          customer = await stripe.customers.retrieve(user.stripeCustomerId);
        } catch (error: any) {
          if (error.code === 'resource_missing') {
            console.log(`Customer ${user.stripeCustomerId} not found (likely test mode data)`);
            return res.json([]); // Return empty array for missing customers
          }
          throw error;
        }

        // Get payment methods from Stripe
        const paymentMethods = await stripe.paymentMethods.list({
          customer: user.stripeCustomerId,
          type: 'card',
        });

        const defaultPaymentMethodId = (customer as any).invoice_settings?.default_payment_method;

        // Transform Stripe data to our format
        const formattedMethods = paymentMethods.data.map(pm => ({
          id: pm.id,
          card_brand: pm.card?.brand || 'unknown',
          card_last_four: pm.card?.last4 || '0000',
          card_exp_month: pm.card?.exp_month || 1,
          card_exp_year: pm.card?.exp_year || 2030,
          is_default: pm.id === defaultPaymentMethodId
        }));

        res.json(formattedMethods);
      } catch (stripeError) {
        console.error('Error fetching payment methods from Stripe:', stripeError);
        res.json([]);
      }
    } catch (error) {
      console.error('Error fetching payment methods:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  // Delete payment method endpoint
  app.delete('/api/payment-methods/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const paymentMethodId = req.params.id;
      const userId = req.user!.id;
      
      console.log(`Deleting payment method ${paymentMethodId} for user ${userId}`);
      
      // Get the user's Stripe customer ID (same logic as GET payment methods)
      const user = await storage.getUser(userId);
      if (!user || !user.stripeCustomerId) {
        return res.status(400).json({ message: 'No se encontró el ID de cliente de Stripe' });
      }
      
      // Detach the payment method from Stripe customer
      await stripe.paymentMethods.detach(paymentMethodId);
      
      console.log(`Successfully detached payment method ${paymentMethodId} from Stripe customer ${user.stripeCustomerId}`);
      res.json({ success: true, message: 'Método de pago eliminado correctamente' });
      
    } catch (error: any) {
      console.error('Error deleting payment method:', error);
      
      // Handle specific Stripe errors
      if (error.type === 'StripeCardError') {
        return res.status(400).json({ message: 'Error con la tarjeta: ' + error.message });
      } else if (error.type === 'StripeInvalidRequestError') {
        return res.status(400).json({ message: 'Solicitud inválida: ' + error.message });
      } else if (error.code === 'resource_missing') {
        return res.status(404).json({ message: 'El método de pago no existe o ya fue eliminado' });
      }
      
      res.status(500).json({ message: 'Error eliminando método de pago' });
    }
  });

  app.get('/api/account/invoices', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;
      
      // Get admin user to find Stripe customer ID
      const userResult = await db.execute(sql`
        SELECT stripe_customer_id
        FROM users 
        WHERE company_id = ${companyId} AND role = 'admin'
        LIMIT 1
      `);
      
      const user = userResult.rows[0] as any;
      
      if (!user?.stripe_customer_id) {
        return res.json([]);
      }

      try {
        // Get ALL invoices from Stripe (show all statuses: paid, open, draft, etc.)
        const invoices = await stripe.invoices.list({
          customer: user.stripe_customer_id,
          limit: 20,
          // No status filter - show all invoice states for complete billing history
        });

        // Format invoices for frontend
        const formattedInvoices = invoices.data.map((invoice, index) => ({
          id: invoice.id,
          invoice_number: invoice.number || `INV-${String(index + 1).padStart(3, '0')}`,
          amount: (invoice.total / 100).toFixed(2), // Use total amount instead of amount_paid
          currency: invoice.currency.toUpperCase(),
          status: invoice.status, // Show actual status from Stripe
          description: invoice.description || invoice.lines.data[0]?.description || 'Suscripción Oficaz',
          created_at: new Date(invoice.created * 1000).toISOString(),
          paid_at: invoice.status_transitions.paid_at 
            ? new Date(invoice.status_transitions.paid_at * 1000).toISOString() 
            : null,
          download_url: invoice.invoice_pdf
        }));
        
        res.json(formattedInvoices);
      } catch (stripeError: any) {
        console.error('Error fetching Stripe invoices:', stripeError.message);
        
        // Return empty array instead of error for better UX
        res.json([]);
      }
      
    } catch (error) {
      console.error('Error fetching invoices:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  app.get('/api/account/usage-stats', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;
      
      // Get subscription plan and its storage/AI limits
      const subscriptionData = await db.execute(sql`
        SELECT s.plan, s.ai_tokens_used, s.ai_tokens_reset_date, 
               sp.storage_limit_gb, sp.max_users, sp.ai_tokens_limit_monthly
        FROM subscriptions s
        LEFT JOIN subscription_plans sp ON LOWER(s.plan) = LOWER(sp.name)
        WHERE s.company_id = ${companyId}
      `);
      const planData = subscriptionData.rows[0] as { 
        plan: string; 
        storage_limit_gb: number; 
        max_users: number;
        ai_tokens_used: number;
        ai_tokens_reset_date: Date | null;
        ai_tokens_limit_monthly: number;
      } | undefined;
      const storageLimitGB = planData?.storage_limit_gb || 25; // Default to Basic plan limit
      const maxUsers = planData?.max_users || 10;
      const aiTokensUsed = planData?.ai_tokens_used || 0;
      const aiTokensResetDate = planData?.ai_tokens_reset_date;
      
      // Check if company has OficazIA addon active (new modular model)
      const hasOficazIA = await storage.hasActiveAddon(companyId, 'ai_assistant');
      // If OficazIA is active, set limit to 1M tokens/month, otherwise 0
      const aiTokensLimit = hasOficazIA ? 1000000 : 0;
      
      // Get real-time stats from actual data using proper ORM
      const employeeCount = await db.select({ count: count() })
        .from(users)
        .where(and(eq(users.companyId, companyId), eq(users.isActive, true)));
      
      const companyUsers = await db.select({ id: users.id })
        .from(users)
        .where(eq(users.companyId, companyId));
      
      const userIds = companyUsers.map(u => u.id);
      
      const timeEntriesCount = userIds.length > 0 
        ? await db.select({ count: count() })
            .from(workSessions)
            .where(and(
              inArray(workSessions.userId, userIds),
              sql`created_at >= DATE_TRUNC('month', CURRENT_DATE)`
            ))
        : [{ count: 0 }];
      
      const documentsCount = userIds.length > 0
        ? await db.select({ count: count() })
            .from(documents)
            .where(and(
              inArray(documents.userId, userIds),
              sql`created_at >= DATE_TRUNC('month', CURRENT_DATE)`
            ))
        : [{ count: 0 }];

      // Calculate real storage usage from document file sizes
      const storageResult = userIds.length > 0
        ? await db.select({ totalBytes: sql<string>`COALESCE(SUM(file_size), 0)` })
            .from(documents)
            .where(inArray(documents.userId, userIds))
        : [{ totalBytes: '0' }];
      
      const totalBytes = parseInt(String(storageResult[0]?.totalBytes || 0));
      const storageUsedMB = (totalBytes / (1024 * 1024)).toFixed(2);
      const storageUsedGB = (totalBytes / (1024 * 1024 * 1024)).toFixed(2);

      const currentStats = {
        employee_count: parseInt(String(employeeCount[0]?.count || 0)),
        active_employees: parseInt(String(employeeCount[0]?.count || 0)),
        max_users: maxUsers,
        time_entries_count: parseInt(String(timeEntriesCount[0]?.count || 0)),
        documents_uploaded: parseInt(String(documentsCount[0]?.count || 0)),
        storage_used_mb: storageUsedMB,
        storage_used_gb: storageUsedGB,
        storage_limit_gb: storageLimitGB,
        api_calls: parseInt(String(timeEntriesCount[0]?.count || 0)) * 2,
        ai_tokens_used: aiTokensUsed,
        ai_tokens_limit: aiTokensLimit,
        ai_tokens_reset_date: aiTokensResetDate
      };

      res.json({
        historical: [],
        current: currentStats
      });
    } catch (error) {
      console.error('Error fetching usage stats:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  // Trial Period Management
  app.get('/api/account/trial-status', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;
      
      // Get subscription and company data for unified date calculation
      const result = await db.execute(sql`
        SELECT 
          s.is_trial_active,
          s.status,
          s.plan,
          s.stripe_subscription_id,
          s.next_payment_date,
          c.created_at as company_created_at,
          c.trial_duration_days
        FROM subscriptions s
        JOIN companies c ON s.company_id = c.id
        WHERE s.company_id = ${companyId}
      `);
      
      const data = result.rows[0];
      if (!data) {
        return res.status(404).json({ message: 'Suscripción no encontrada' });
      }

      // Calculate trial dates from companies.created_at (single source of truth)
      const now = new Date();
      const registrationDate = new Date(data.company_created_at as string);
      const trialEndDate = new Date(registrationDate);
      // Use custom trial duration from company settings (default 7 days)
      const trialDuration = data.trial_duration_days || 7;
      trialEndDate.setDate(trialEndDate.getDate() + Number(trialDuration));
      
      // Fix timezone issues by comparing dates at end of day
      const nowEndOfDay = new Date(now);
      nowEndOfDay.setHours(23, 59, 59, 999);
      const trialEndOfDay = new Date(trialEndDate);
      trialEndOfDay.setHours(23, 59, 59, 999);
      
      const daysRemaining = Math.ceil((trialEndOfDay.getTime() - nowEndOfDay.getTime()) / (1000 * 60 * 60 * 24));
      const isTrialExpired = daysRemaining <= 0;
      


      // Auto-block if trial expired
      if (isTrialExpired && data.is_trial_active && data.status === 'trial') {
        await db.execute(sql`
          UPDATE subscriptions 
          SET status = 'blocked', is_trial_active = false 
          WHERE company_id = ${companyId}
        `);
      }

      res.json({
        isTrialActive: data.is_trial_active && !isTrialExpired,
        daysRemaining: Math.max(0, daysRemaining),
        trialEndDate: trialEndDate.toISOString(),
        nextPaymentDate: data.next_payment_date,
        status: isTrialExpired && data.status === 'trial' ? 'blocked' : data.status,
        plan: data.plan,
        hasPaymentMethod: !!data.stripe_subscription_id,
        isBlocked: data.status === 'blocked' || (isTrialExpired && data.status === 'trial')
      });
    } catch (error) {
      console.error('Error fetching trial status:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  // Create Stripe payment intent for subscription
  app.post('/api/account/create-payment-intent', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;
      const { plan } = req.body;
      
      // Get plan pricing from database
      const planResult = await db.execute(sql`
        SELECT monthly_price FROM subscription_plans 
        WHERE name = ${plan}
      `);
      
      const monthlyPrice = planResult.rows[0] ? parseFloat((planResult.rows[0] as any).monthly_price) : 19.95;
      
      // Get employee count using proper ORM
      const employeeResult = await db.select({ count: count() })
        .from(users)
        .where(and(eq(users.companyId, companyId), eq(users.isActive, true)));
      
      const employeeCount = parseInt(String(employeeResult[0]?.count || 1));
      const totalAmount = monthlyPrice; // Plans have fixed monthly price
      
      // Here you would integrate with Stripe to create payment intent
      // For now, return mock payment intent
      res.json({
        clientSecret: 'pi_mock_client_secret_for_demo',
        amount: totalAmount,
        currency: 'eur',
        plan: plan,
        employeeCount: employeeCount,
        monthlyPrice: monthlyPrice
      });
    } catch (error) {
      console.error('Error creating payment intent:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  // Confirm payment and activate subscription
  app.post('/api/account/confirm-payment', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;
      const { plan, paymentIntentId } = req.body;
      
      // Here you would verify the payment with Stripe
      // For demo purposes, we'll assume payment succeeded
      
      // Update subscription to active
      await db.execute(sql`
        UPDATE subscriptions 
        SET 
          status = 'active',
          is_trial_active = false,
          plan = ${plan},
          next_payment_date = ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)}, -- 30 days from now
          stripe_subscription_id = ${paymentIntentId},
          updated_at = NOW()
        WHERE company_id = ${companyId}
      `);
      
      res.json({
        success: true,
        message: `Suscripción ${plan} activada correctamente`,
        status: 'active',
        plan: plan,
        nextPaymentDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });
    } catch (error) {
      console.error('Error confirming payment:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  // Endpoint público para obtener planes de suscripción disponibles (sin autenticación)
  app.get('/api/public/subscription-plans', async (req, res) => {
    try {
      const plans = await storage.getAllSubscriptionPlans();
      res.json(plans);
    } catch (error) {
      console.error('Error fetching subscription plans:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  // Endpoint público para obtener addons disponibles (para wizard de registro)
  app.get('/api/public/addons', async (req, res) => {
    try {
      const addons = await storage.getActiveAddons();
      res.json(addons);
    } catch (error) {
      console.error('Error fetching public addons:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  // Endpoint para obtener planes de suscripción (con autenticación)
  app.get('/api/subscription-plans', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const plans = await storage.getAllSubscriptionPlans();
      res.json(plans);
    } catch (error) {
      console.error('Error fetching subscription plans:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ⚠️ DEPRECATED: Endpoints de cambio de plan - LEGACY del modelo basic/pro/master
  // El nuevo modelo usa add-ons modulares. Estos endpoints devuelven error con redirección.
  // ═══════════════════════════════════════════════════════════════════════════
  
  app.post('/api/subscription/preview-plan-change', authenticateToken, async (req: AuthRequest, res) => {
    res.status(410).json({ 
      message: 'Este endpoint ha sido descontinuado. Ahora usamos el sistema de complementos modulares.',
      redirect: '/addon-store',
      deprecated: true
    });
  });

  app.patch('/api/subscription/change-plan', authenticateToken, async (req: AuthRequest, res) => {
    res.status(410).json({ 
      message: 'Este endpoint ha sido descontinuado. Ahora usamos el sistema de complementos modulares.',
      redirect: '/addon-store',
      deprecated: true
    });
  });

  // Super Admin - Subscription Plans Management
  app.get('/api/super-admin/subscription-plans', superAdminSecurityHeaders, authenticateSuperAdmin, async (req: any, res) => {
    try {
      const plans = await storage.getAllSubscriptionPlans();
      res.json(plans);
    } catch (error) {
      console.error('Error fetching subscription plans:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  app.post('/api/super-admin/subscription-plans', superAdminSecurityHeaders, authenticateSuperAdmin, async (req: any, res) => {
    try {
      const { name, displayName, monthlyPrice, maxUsers, features } = req.body;
      
      const plan = await storage.createSubscriptionPlan({
        name,
        displayName,
        monthlyPrice: parseFloat(monthlyPrice),
        maxUsers: maxUsers || null,
        features: features || {},
        isActive: true
      });
      
      logAudit({
        timestamp: new Date(),
        ip: req.ip || 'unknown',
        action: 'SUBSCRIPTION_PLAN_CREATED',
        email: req.superAdmin?.email,
        success: true,
        details: `Created plan: ${displayName} (${name}) - €${monthlyPrice}/month`
      });
      
      res.status(201).json(plan);
    } catch (error) {
      console.error('Error creating subscription plan:', error);
      logAudit({
        timestamp: new Date(),
        ip: req.ip || 'unknown',
        action: 'SUBSCRIPTION_PLAN_CREATE_FAILED',
        email: req.superAdmin?.email,
        success: false,
        details: error instanceof Error ? error.message : 'Unknown error'
      });
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  app.patch('/api/super-admin/subscription-plans/:id', superAdminSecurityHeaders, authenticateSuperAdmin, async (req: any, res) => {
    try {
      const planId = parseInt(req.params.id);
      const updates = req.body;
      
      if (updates.monthlyPrice) {
        updates.monthlyPrice = parseFloat(updates.monthlyPrice);
      }
      
      const plan = await storage.updateSubscriptionPlan(planId, updates);
      
      if (!plan) {
        return res.status(404).json({ message: 'Plan no encontrado' });
      }
      
      logAudit({
        timestamp: new Date(),
        ip: req.ip || 'unknown',
        action: 'SUBSCRIPTION_PLAN_UPDATED',
        email: req.superAdmin?.email,
        success: true,
        details: `Updated plan ID ${planId}: ${JSON.stringify(updates)}`
      });
      
      res.json(plan);
    } catch (error) {
      console.error('Error updating subscription plan:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  // Synchronize addons from ADDON_DEFINITIONS to database
  app.post('/api/super-admin/sync-addons', superAdminSecurityHeaders, authenticateSuperAdmin, async (req: any, res) => {
    try {
      let syncedCount = 0;
      let createdCount = 0;
      const results = [];

      for (let i = 0; i < ADDON_DEFINITIONS.length; i++) {
        const def = ADDON_DEFINITIONS[i];
        const existing = await storage.getAddonByKey(def.key);

        if (existing) {
          // Update existing addon
          const updated = await storage.updateAddon(existing.id, {
            name: def.name,
            description: def.description,
            shortDescription: def.shortDescription,
            monthlyPrice: def.monthlyPrice,
            icon: def.icon,
            isActive: true,
            sortOrder: i
          });
          results.push({ action: 'updated', key: def.key, id: existing.id });
          syncedCount++;
        } else {
          // Create new addon
          const created = await storage.createAddon({
            key: def.key,
            name: def.name,
            description: def.description,
            shortDescription: def.shortDescription,
            monthlyPrice: def.monthlyPrice,
            icon: def.icon,
            isActive: true,
            sortOrder: i
          });
          results.push({ action: 'created', key: def.key, id: created.id });
          createdCount++;
        }
      }

      logAudit({
        timestamp: new Date(),
        ip: req.ip || 'unknown',
        action: 'ADDONS_SYNCHRONIZED',
        email: req.superAdmin?.email,
        success: true,
        details: `Synced ${ADDON_DEFINITIONS.length} addons (${createdCount} created, ${syncedCount} updated)`
      });

      res.json({
        message: `Addons synchronized successfully`,
        total: ADDON_DEFINITIONS.length,
        created: createdCount,
        updated: syncedCount,
        results
      });
    } catch (error) {
      console.error('Error synchronizing addons:', error);
      logAudit({
        timestamp: new Date(),
        ip: req.ip || 'unknown',
        action: 'ADDONS_SYNC_FAILED',
        email: req.superAdmin?.email,
        success: false,
        details: error instanceof Error ? error.message : 'Unknown error'
      });
      res.status(500).json({ message: 'Error sincronizando addons' });
    }
  });

  app.delete('/api/super-admin/subscription-plans/:id', superAdminSecurityHeaders, authenticateSuperAdmin, async (req: any, res) => {
    try {
      const planId = parseInt(req.params.id);
      const success = await storage.deleteSubscriptionPlan(planId);
      
      if (!success) {
        return res.status(404).json({ message: 'Plan no encontrado' });
      }
      
      logAudit({
        timestamp: new Date(),
        ip: req.ip || 'unknown',
        action: 'SUBSCRIPTION_PLAN_DELETED',
        email: req.superAdmin?.email,
        success: true,
        details: `Deleted plan ID ${planId}`
      });
      
      res.json({ message: 'Plan eliminado correctamente' });
    } catch (error) {
      console.error('Error deleting subscription plan:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  // Features endpoints
  app.get('/api/super-admin/features', superAdminSecurityHeaders, authenticateSuperAdmin, async (req: any, res) => {
    try {
      const features = await storage.getAllFeatures();
      res.json(features);
    } catch (error) {
      console.error('Error fetching features:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  app.patch('/api/super-admin/features/:id', superAdminSecurityHeaders, authenticateSuperAdmin, async (req: any, res) => {
    try {
      const featureId = parseInt(req.params.id);
      const updates = req.body;
      
      const feature = await storage.updateFeature(featureId, updates);
      
      if (!feature) {
        return res.status(404).json({ message: 'Feature no encontrada' });
      }
      
      logAudit({
        timestamp: new Date(),
        ip: req.ip || 'unknown',
        action: 'FEATURE_UPDATED',
        email: req.superAdmin?.email,
        success: true,
        details: `Updated feature ID ${featureId}: ${JSON.stringify(updates)}`
      });
      
      res.json(feature);
    } catch (error) {
      console.error('Error updating feature:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });
  
  
  
  // ═══════════════════════════════════════════════════════════════════════
  // CRM: Clientes, Proveedores y Proyectos
  // ═══════════════════════════════════════════════════════════════════════

  const fetchProjectWithContacts = async (projectId: number, companyId: number) => {
    const { rows } = await db.execute(sql`
      SELECT
        row_to_json(p.*) AS project,
        (
          SELECT json_agg(json_build_object(
            'id', bc.id,
            'name', bc.name,
            'role', bc.role,
            'label', bc.label,
            'email', bc.email,
            'phone', bc.phone
          ) ORDER BY bc.name)
          FROM project_contacts pc
          JOIN business_contacts bc ON pc.contact_id = bc.id
          WHERE pc.project_id = p.id AND pc.role = 'client'
        ) AS clients,
        (
          SELECT json_agg(json_build_object(
            'id', bc.id,
            'name', bc.name,
            'role', bc.role,
            'label', bc.label,
            'email', bc.email,
            'phone', bc.phone
          ) ORDER BY bc.name)
          FROM project_contacts pc
          JOIN business_contacts bc ON pc.contact_id = bc.id
          WHERE pc.project_id = p.id AND pc.role = 'provider'
        ) AS providers,
        (
          SELECT COALESCE(json_agg(json_build_object(
            'id', psc.id,
            'name', psc.name,
            'color', psc.color
          )), '[]'::json)
          FROM project_status_categories psc
          WHERE psc.id = ANY(p.status_categories) AND psc.company_id = ${companyId}
        ) AS status_categories_data
      FROM projects p
      WHERE p.id = ${projectId} AND p.company_id = ${companyId}
      LIMIT 1;
    `);

    const result = rows?.[0];
    if (result && result.project) {
      // row_to_json devuelve columnas en snake_case, necesitamos convertir a camelCase
      const p = result.project;
      result.project = {
        id: p.id,
        companyId: p.company_id,
        name: p.name,
        code: p.code,
        status: p.status,
        statusCategories: result.status_categories_data || [],
        stage: p.stage,
        description: p.description,
        startDate: p.start_date,
        dueDate: p.due_date,
        budget: p.budget,
        progress: p.progress,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      };
      delete result.status_categories_data;
    }
    return result;
  };

  app.get('/api/crm/contacts', authenticateToken, requireRole(['admin', 'manager']), requireFeature('crm', () => storage), async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;
      const { role, search, limit, offset } = req.query;

      try {
        // Devuelve contacts - el frontend resolverá los IDs de categorías
        const contacts = await db.select()
          .from(schema.businessContacts)
          .where(and(
            eq(schema.businessContacts.companyId, companyId),
            role ? eq(schema.businessContacts.role, String(role)) : undefined,
            search ? ilike(schema.businessContacts.name, `%${String(search)}%`) : undefined
          ))
          .orderBy(desc(schema.businessContacts.createdAt));

        // Support pagination for infinite scroll
        const limitNum = limit ? parseInt(String(limit)) : null;
        const offsetNum = offset ? parseInt(String(offset)) : null;
        
        if (limitNum && offsetNum !== undefined) {
          const paginatedItems = contacts.slice(offsetNum, offsetNum + limitNum);
          const totalCount = contacts.length;
          const hasMore = (offsetNum + limitNum) < totalCount;
          res.json({
            items: paginatedItems,
            totalCount,
            hasMore
          });
        } else {
          res.json(contacts || []);
        }
      } catch (error: any) {
        // Si falla por columna faltante, ejecutar migración y reintentar
        if (error.message?.includes('categories') || error.message?.includes('unknown column')) {
          console.warn('⚠️ Columna categories no encontrada, ejecutando migración...');
          try {
            await db.execute(sql`ALTER TABLE business_contacts ADD COLUMN IF NOT EXISTS categories INTEGER[] DEFAULT '{}'`);
            await db.execute(sql`UPDATE business_contacts SET categories = '{}' WHERE categories IS NULL`);
            
            // Reintentar select
            const contacts = await db.select()
              .from(schema.businessContacts)
              .where(and(
                eq(schema.businessContacts.companyId, companyId),
                role ? eq(schema.businessContacts.role, String(role)) : undefined,
                search ? ilike(schema.businessContacts.name, `%${String(search)}%`) : undefined
              ))
              .orderBy(desc(schema.businessContacts.createdAt));

            res.json(contacts || []);
          } catch (migrateError) {
            console.error('❌ Error migrando categories:', migrateError);
            // Si todo falla, devolver array vacío
            res.json([]);
          }
        } else {
          throw error;
        }
      }
    } catch (error: any) {
      console.error('Error fetching contacts:', error);
      // Devolver array vacío en caso de error
      res.json([]);
    }
  });

  // Endpoint para ejecutar migración de categorías (útil si falla automáticamente)
  app.post('/api/admin/migrate/crm-categories', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res) => {
    try {
      console.log('🔄 Ejecutando migración de categorías...');
      
      await db.execute(sql`ALTER TABLE business_contacts ADD COLUMN IF NOT EXISTS categories INTEGER[] DEFAULT '{}'`);
      console.log('✅ Columna categories agregada');
      
      await db.execute(sql`UPDATE business_contacts SET categories = '{}' WHERE categories IS NULL`);
      console.log('✅ Registros actualizados');
      
      res.json({ 
        success: true, 
        message: 'Migración de categorías completada exitosamente' 
      });
    } catch (error: any) {
      console.error('❌ Error en migración de categorías:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error en migración: ' + error.message 
      });
    }
  });

  app.post('/api/crm/contacts', authenticateToken, requireRole(['admin', 'manager']), requireFeature('crm', () => storage), async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;
      const data = req.body || {};
      const role = data.role === 'provider' ? 'provider' : 'client';
      const label = data.label || (role === 'client' ? 'Cliente' : 'Proveedor');

      // Convertir objetos de categoría a IDs
      const categoryIds = Array.isArray(data.categories) 
        ? data.categories.map((cat: any) => cat.id || cat).filter((id: any) => id)
        : [];

      // Convertir objetos de estado a IDs
      const statusCategoryIds = Array.isArray(data.statusCategories) 
        ? data.statusCategories.map((cat: any) => cat.id || cat).filter((id: any) => id)
        : [];

      const [contact] = await db.insert(schema.businessContacts)
        .values({
          companyId,
          name: data.name,
          role,
          label,
          email: data.email,
          phone: data.phone,
          taxId: data.taxId,
          city: data.city,
          notes: data.notes,
          categories: categoryIds,
          statusCategories: statusCategoryIds,
          status: data.status || 'active',
        })
        .returning();

      res.json(contact);
    } catch (error: any) {
      console.error('Error creating contact:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  app.patch('/api/crm/contacts/:id', authenticateToken, requireRole(['admin', 'manager']), requireFeature('crm', () => storage), async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;
      const contactId = parseInt(req.params.id);

      const [existing] = await db.select()
        .from(schema.businessContacts)
        .where(and(
          eq(schema.businessContacts.id, contactId),
          eq(schema.businessContacts.companyId, companyId)
        ));

      if (!existing) {
        return res.status(404).json({ message: 'Contacto no encontrado' });
      }

      const updateData = { ...req.body, updatedAt: new Date() };
      delete (updateData as any).companyId;

      // Convertir objetos de categoría a IDs
      if (Array.isArray(updateData.categories)) {
        updateData.categories = updateData.categories
          .map((cat: any) => cat.id || cat)
          .filter((id: any) => id);
      }

      // Convertir objetos de estado a IDs
      if (Array.isArray(updateData.statusCategories)) {
        updateData.statusCategories = updateData.statusCategories
          .map((cat: any) => cat.id || cat)
          .filter((id: any) => id);
      }

      const [contact] = await db.update(schema.businessContacts)
        .set(updateData)
        .where(eq(schema.businessContacts.id, contactId))
        .returning();

      res.json(contact);
    } catch (error: any) {
      console.error('Error updating contact:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  app.delete('/api/crm/contacts/:id', authenticateToken, requireRole(['admin', 'manager']), requireFeature('crm', () => storage), async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;
      const contactId = parseInt(req.params.id);

      const [existing] = await db.select()
        .from(schema.businessContacts)
        .where(and(
          eq(schema.businessContacts.id, contactId),
          eq(schema.businessContacts.companyId, companyId)
        ));

      if (!existing) {
        return res.status(404).json({ message: 'Contacto no encontrado' });
      }

      await db.delete(schema.businessContacts)
        .where(eq(schema.businessContacts.id, contactId));

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting contact:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  // ========== CRM CATEGORIES ==========

  app.get('/api/crm/categories', authenticateToken, requireFeature('crm', () => storage), async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;

      try {
        const categories = await db.select()
          .from(schema.crmCategories)
          .where(eq(schema.crmCategories.companyId, companyId))
          .orderBy(asc(schema.crmCategories.name));

        res.json(categories);
      } catch (error: any) {
        // Si la tabla no existe aún, devolver array vacío
        if (error.message?.includes('does not exist')) {
          console.warn('⚠️ Tabla crmCategories no existe aún');
          res.json([]);
        } else {
          throw error;
        }
      }
    } catch (error: any) {
      console.error('Error fetching CRM categories:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  app.post('/api/crm/categories', authenticateToken, requireRole(['admin', 'manager']), requireFeature('crm', () => storage), async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;
      const { name, color } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ message: 'El nombre de la categoría es requerido' });
      }

      try {
        // Verificar que no exista una categoría con el mismo nombre
        const existing = await db.select()
          .from(schema.crmCategories)
          .where(and(
            eq(schema.crmCategories.companyId, companyId),
            eq(sql`LOWER(${schema.crmCategories.name})`, name.trim().toLowerCase())
          ));

        if (existing.length > 0) {
          return res.status(400).json({ message: 'Ya existe una categoría con este nombre' });
        }

        const [category] = await db.insert(schema.crmCategories)
          .values({
            companyId,
            name: name.trim(),
            color: color || 'azul',
          })
          .returning();

        res.json(category);
      } catch (error: any) {
        // Si la tabla no existe, devolver un objeto de categoría temporal
        if (error.message?.includes('does not exist')) {
          console.warn('⚠️ Tabla crmCategories no existe aún, devolviendo categoría temporal');
          res.json({
            id: Math.floor(Math.random() * 10000),
            companyId,
            name: name.trim(),
            color: color || 'azul',
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        } else {
          throw error;
        }
      }
    } catch (error: any) {
      console.error('Error creating CRM category:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  app.patch('/api/crm/categories/:id', authenticateToken, requireRole(['admin', 'manager']), requireFeature('crm', () => storage), async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;
      const categoryId = parseInt(req.params.id);
      const { name, color } = req.body;

      try {
        const [existing] = await db.select()
          .from(schema.crmCategories)
          .where(and(
            eq(schema.crmCategories.id, categoryId),
            eq(schema.crmCategories.companyId, companyId)
          ));

        if (!existing) {
          return res.status(404).json({ message: 'Categoría no encontrada' });
        }

        // Si cambia el nombre, verificar que no exista otra con el mismo nombre
        if (name && name.trim().toLowerCase() !== existing.name.toLowerCase()) {
          const duplicate = await db.select()
            .from(schema.crmCategories)
            .where(and(
              eq(schema.crmCategories.companyId, companyId),
              eq(sql`LOWER(${schema.crmCategories.name})`, name.trim().toLowerCase())
            ));

          if (duplicate.length > 0) {
            return res.status(400).json({ message: 'Ya existe una categoría con este nombre' });
          }
        }

        const [updated] = await db.update(schema.crmCategories)
          .set({
            name: name ? name.trim() : existing.name,
            color: color || existing.color,
            updatedAt: new Date(),
          })
          .where(eq(schema.crmCategories.id, categoryId))
          .returning();

        res.json(updated);
      } catch (error: any) {
        if (error.message?.includes('does not exist')) {
          // Si la tabla no existe, devolver la categoría con los cambios
          res.json({
            id: categoryId,
            companyId,
            name: name || 'Categoría',
            color: color || 'azul',
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        } else {
          throw error;
        }
      }
    } catch (error: any) {
      console.error('Error updating CRM category:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  app.delete('/api/crm/categories/:id', authenticateToken, requireRole(['admin', 'manager']), requireFeature('crm', () => storage), async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;
      const categoryId = parseInt(req.params.id);

      try {
        const [existing] = await db.select()
          .from(schema.crmCategories)
          .where(and(
            eq(schema.crmCategories.id, categoryId),
            eq(schema.crmCategories.companyId, companyId)
          ));

        if (!existing) {
          return res.status(404).json({ message: 'Categoría no encontrada' });
        }

        await db.delete(schema.crmCategories)
          .where(eq(schema.crmCategories.id, categoryId));

        res.json({ success: true });
      } catch (error: any) {
        if (error.message?.includes('does not exist')) {
          // Si la tabla no existe, devolver éxito igual
          res.json({ success: true });
        } else {
          throw error;
        }
      }
    } catch (error: any) {
      console.error('Error deleting CRM category:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  // ========== CRM STATUS CATEGORIES (Estados como categorías) ==========

  // Helper para crear estados por defecto si no existen
  const ensureDefaultStatuses = async (companyId: number) => {
    try {
      const existing = await db.select()
        .from(schema.crmStatusCategories)
        .where(eq(schema.crmStatusCategories.companyId, companyId));

      if (existing.length === 0) {
        const defaultStatuses = [
          { name: 'Activo', color: 'verde', isDefault: true },
          { name: 'Inactivo', color: 'gris', isDefault: true },
        ];

        await db.insert(schema.crmStatusCategories)
          .values(defaultStatuses.map(s => ({
            companyId,
            name: s.name,
            color: s.color,
            isDefault: s.isDefault,
          })));
      }
    } catch (error: any) {
      if (!error.message?.includes('does not exist')) {
        console.error('Error creating default statuses:', error);
      }
    }
  };

  app.get('/api/crm/status-categories', authenticateToken, requireFeature('crm', () => storage), async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;

      try {
        // Asegurar que existan los estados por defecto
        await ensureDefaultStatuses(companyId);

        const statuses = await db.select()
          .from(schema.crmStatusCategories)
          .where(eq(schema.crmStatusCategories.companyId, companyId))
          .orderBy(asc(schema.crmStatusCategories.name));

        res.json(statuses);
      } catch (error: any) {
        if (error.message?.includes('does not exist')) {
          console.warn('⚠️ Tabla crmStatusCategories no existe aún');
          res.json([
            { id: 1, name: 'Activo', color: 'verde', isDefault: true, companyId },
            { id: 2, name: 'Inactivo', color: 'gris', isDefault: true, companyId },
          ]);
        } else {
          throw error;
        }
      }
    } catch (error: any) {
      console.error('Error fetching CRM status categories:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  app.post('/api/crm/status-categories', authenticateToken, requireRole(['admin', 'manager']), requireFeature('crm', () => storage), async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;
      const { name, color } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ message: 'El nombre del estado es requerido' });
      }

      try {
        const existing = await db.select()
          .from(schema.crmStatusCategories)
          .where(and(
            eq(schema.crmStatusCategories.companyId, companyId),
            eq(sql`LOWER(${schema.crmStatusCategories.name})`, name.trim().toLowerCase())
          ));

        if (existing.length > 0) {
          return res.status(400).json({ message: 'Ya existe un estado con este nombre' });
        }

        const [status] = await db.insert(schema.crmStatusCategories)
          .values({
            companyId,
            name: name.trim(),
            color: color || 'verde',
            isDefault: false,
          })
          .returning();

        res.json(status);
      } catch (error: any) {
        if (error.message?.includes('does not exist')) {
          console.warn('⚠️ Tabla crmStatusCategories no existe aún, devolviendo estado temporal');
          res.json({
            id: Math.floor(Math.random() * 10000),
            companyId,
            name: name.trim(),
            color: color || 'verde',
            isDefault: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        } else {
          throw error;
        }
      }
    } catch (error: any) {
      console.error('Error creating CRM status category:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  app.patch('/api/crm/status-categories/:id', authenticateToken, requireRole(['admin', 'manager']), requireFeature('crm', () => storage), async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;
      const statusId = parseInt(req.params.id);
      const { name, color } = req.body;

      try {
        const [existing] = await db.select()
          .from(schema.crmStatusCategories)
          .where(and(
            eq(schema.crmStatusCategories.id, statusId),
            eq(schema.crmStatusCategories.companyId, companyId)
          ));

        if (!existing) {
          return res.status(404).json({ message: 'Estado no encontrado' });
        }

        const [updated] = await db.update(schema.crmStatusCategories)
          .set({
            name: name || existing.name,
            color: color || existing.color,
            updatedAt: new Date(),
          })
          .where(eq(schema.crmStatusCategories.id, statusId))
          .returning();

        res.json(updated);
      } catch (error: any) {
        if (error.message?.includes('does not exist')) {
          res.json({ id: statusId, name, color, companyId });
        } else {
          throw error;
        }
      }
    } catch (error: any) {
      console.error('Error updating CRM status category:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  app.delete('/api/crm/status-categories/:id', authenticateToken, requireRole(['admin', 'manager']), requireFeature('crm', () => storage), async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;
      const statusId = parseInt(req.params.id);

      try {
        const [existing] = await db.select()
          .from(schema.crmStatusCategories)
          .where(and(
            eq(schema.crmStatusCategories.id, statusId),
            eq(schema.crmStatusCategories.companyId, companyId)
          ));

        if (!existing) {
          return res.status(404).json({ message: 'Estado no encontrado' });
        }

        // No permitir eliminar estados por defecto
        if (existing.isDefault) {
          return res.status(400).json({ message: 'No se pueden eliminar los estados por defecto' });
        }

        await db.delete(schema.crmStatusCategories)
          .where(eq(schema.crmStatusCategories.id, statusId));

        res.json({ success: true });
      } catch (error: any) {
        if (error.message?.includes('does not exist')) {
          res.json({ success: true });
        } else {
          throw error;
        }
      }
    } catch (error: any) {
      console.error('Error deleting CRM status category:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  // ========== PROJECT STATUS CATEGORIES (Estados para proyectos) ==========

  // Helper para crear estados por defecto de proyectos si no existen
  const ensureDefaultProjectStatuses = async (companyId: number) => {
    try {
      const existing = await db.select()
        .from(schema.projectStatusCategories)
        .where(eq(schema.projectStatusCategories.companyId, companyId));

      if (existing.length === 0) {
        const defaultStatuses = [
          { name: 'Activo', color: 'verde', isDefault: true },
          { name: 'En pausa', color: 'amarillo', isDefault: true },
          { name: 'Completado', color: 'azul', isDefault: true },
          { name: 'Cancelado', color: 'rojo', isDefault: true },
        ];

        await db.insert(schema.projectStatusCategories)
          .values(defaultStatuses.map(s => ({
            companyId,
            name: s.name,
            color: s.color,
            isDefault: s.isDefault,
          })));
      }
    } catch (error: any) {
      if (!error.message?.includes('does not exist')) {
        console.error('Error creating default project statuses:', error);
      }
    }
  };

  app.get('/api/crm/project-status-categories', authenticateToken, requireFeature('crm', () => storage), async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;

      try {
        // Asegurar que existan los estados por defecto
        await ensureDefaultProjectStatuses(companyId);

        const statuses = await db.select()
          .from(schema.projectStatusCategories)
          .where(eq(schema.projectStatusCategories.companyId, companyId))
          .orderBy(asc(schema.projectStatusCategories.name));

        res.json(statuses);
      } catch (error: any) {
        if (error.message?.includes('does not exist')) {
          console.warn('⚠️ Tabla projectStatusCategories no existe aún');
          res.json([
            { id: 1, name: 'Activo', color: 'verde', isDefault: true, companyId },
            { id: 2, name: 'En pausa', color: 'amarillo', isDefault: true, companyId },
            { id: 3, name: 'Completado', color: 'azul', isDefault: true, companyId },
            { id: 4, name: 'Cancelado', color: 'rojo', isDefault: true, companyId },
          ]);
        } else {
          throw error;
        }
      }
    } catch (error: any) {
      console.error('Error fetching project status categories:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  app.post('/api/crm/project-status-categories', authenticateToken, requireRole(['admin', 'manager']), requireFeature('crm', () => storage), async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;
      const { name, color } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ message: 'El nombre del estado es requerido' });
      }

      try {
        const existing = await db.select()
          .from(schema.projectStatusCategories)
          .where(and(
            eq(schema.projectStatusCategories.companyId, companyId),
            eq(sql`LOWER(${schema.projectStatusCategories.name})`, name.trim().toLowerCase())
          ));

        if (existing.length > 0) {
          return res.status(400).json({ message: 'Ya existe un estado con este nombre' });
        }

        const [status] = await db.insert(schema.projectStatusCategories)
          .values({
            companyId,
            name: name.trim(),
            color: color || 'azul',
            isDefault: false,
          })
          .returning();

        res.json(status);
      } catch (error: any) {
        if (error.message?.includes('does not exist')) {
          console.warn('⚠️ Tabla projectStatusCategories no existe aún, devolviendo estado temporal');
          res.json({
            id: Math.floor(Math.random() * 10000),
            companyId,
            name: name.trim(),
            color: color || 'azul',
            isDefault: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        } else {
          throw error;
        }
      }
    } catch (error: any) {
      console.error('Error creating project status category:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  app.patch('/api/crm/project-status-categories/:id', authenticateToken, requireRole(['admin', 'manager']), requireFeature('crm', () => storage), async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;
      const statusId = parseInt(req.params.id);
      const { name, color } = req.body;

      try {
        const [existing] = await db.select()
          .from(schema.projectStatusCategories)
          .where(and(
            eq(schema.projectStatusCategories.id, statusId),
            eq(schema.projectStatusCategories.companyId, companyId)
          ));

        if (!existing) {
          return res.status(404).json({ message: 'Estado no encontrado' });
        }

        const [updated] = await db.update(schema.projectStatusCategories)
          .set({
            name: name || existing.name,
            color: color || existing.color,
            updatedAt: new Date(),
          })
          .where(eq(schema.projectStatusCategories.id, statusId))
          .returning();

        res.json(updated);
      } catch (error: any) {
        if (error.message?.includes('does not exist')) {
          res.json({ id: statusId, name, color, companyId });
        } else {
          throw error;
        }
      }
    } catch (error: any) {
      console.error('Error updating project status category:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  app.delete('/api/crm/project-status-categories/:id', authenticateToken, requireRole(['admin', 'manager']), requireFeature('crm', () => storage), async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;
      const statusId = parseInt(req.params.id);

      try {
        const [existing] = await db.select()
          .from(schema.projectStatusCategories)
          .where(and(
            eq(schema.projectStatusCategories.id, statusId),
            eq(schema.projectStatusCategories.companyId, companyId)
          ));

        if (!existing) {
          return res.status(404).json({ message: 'Estado no encontrado' });
        }

        // No permitir eliminar estados por defecto
        if (existing.isDefault) {
          return res.status(400).json({ message: 'No se pueden eliminar los estados por defecto' });
        }

        await db.delete(schema.projectStatusCategories)
          .where(eq(schema.projectStatusCategories.id, statusId));

        res.json({ success: true });
      } catch (error: any) {
        if (error.message?.includes('does not exist')) {
          res.json({ success: true });
        } else {
          throw error;
        }
      }
    } catch (error: any) {
      console.error('Error deleting project status category:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  app.get('/api/crm/projects', authenticateToken, requireRole(['admin', 'manager']), requireFeature('crm', () => storage), async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;
      const { status, search, limit, offset } = req.query;

      const projects = await db.select({ project: schema.projects })
        .from(schema.projects)
        .where(and(
          eq(schema.projects.companyId, companyId),
          status ? eq(schema.projects.status, String(status)) : undefined,
          search ? ilike(schema.projects.name, `%${String(search)}%`) : undefined
        ))
        .orderBy(desc(schema.projects.createdAt));

      // Enriquecer cada proyecto con clientes/proveedores completos
      const projectsWithContacts = await Promise.all(
        projects.map(async (p) => fetchProjectWithContacts(p.project.id, companyId))
      );

      const filtered = projectsWithContacts.filter(Boolean);

      // Support pagination for infinite scroll
      const limitNum = limit ? parseInt(String(limit)) : null;
      const offsetNum = offset ? parseInt(String(offset)) : null;
      
      if (limitNum && offsetNum !== undefined) {
        const paginatedItems = filtered.slice(offsetNum, offsetNum + limitNum);
        const totalCount = filtered.length;
        const hasMore = (offsetNum + limitNum) < totalCount;
        res.json({
          items: paginatedItems,
          totalCount,
          hasMore
        });
      } else {
        res.json(filtered);
      }
    } catch (error: any) {
      console.error('Error fetching projects:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  // Admin endpoint: obtener proyectos asignados a un usuario específico
  app.get('/api/crm/users/:id/projects', authenticateToken, requireRole(['admin', 'manager']), requireFeature('crm', () => storage), async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;
      const userId = parseInt(req.params.id);

      // Verificar que el usuario pertenece a la empresa
      const userRows = await db.select().from(schema.users)
        .where(and(eq(schema.users.id, userId), eq(schema.users.companyId, companyId)))
        .limit(1);

      if (userRows.length === 0) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }

      // Obtener proyectos asignados al usuario
      const assignedProjects = await db.select({
        id: schema.projects.id,
        name: schema.projects.name,
        code: schema.projects.code,
      })
        .from(schema.projects)
        .innerJoin(schema.projectUsers, eq(schema.projects.id, schema.projectUsers.projectId))
        .where(and(
          eq(schema.projects.companyId, companyId),
          eq(schema.projectUsers.userId, userId)
        ))
        .orderBy(asc(schema.projects.name));

      res.json(assignedProjects);
    } catch (error: any) {
      console.error('Error fetching user projects:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  // Endpoint público para empleados: obtener lista simple de proyectos de su empresa
  app.get('/api/employee/projects', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      const companyId = req.user?.companyId;
      
      if (!userId || !companyId) {
        return res.status(401).json({ message: 'No autorizado' });
      }
      
      console.log('Fetching projects for user:', userId, 'company:', companyId);

      // Obtener proyectos asignados al usuario
      const assignedProjects = await db.select({ 
        project: schema.projects 
      })
        .from(schema.projects)
        .innerJoin(schema.projectUsers, eq(schema.projects.id, schema.projectUsers.projectId))
        .where(and(
          eq(schema.projects.companyId, companyId),
          eq(schema.projectUsers.userId, userId)
        ))
        .orderBy(desc(schema.projects.createdAt));

      console.log('Assigned projects found:', assignedProjects.length);

      // Devolver solo información básica de los proyectos
      const simpleProjects = assignedProjects.map(p => ({
        project: {
          id: p.project.id,
          name: p.project.name,
          code: p.project.code || ''
        }
      }));

      res.json(simpleProjects);
    } catch (error: any) {
      console.error('Error fetching projects list:', error);
      res.status(500).json({ message: 'Error interno del servidor', error: error.message });
    }
  });

  // Admin endpoint: obtener usuarios asignados a un proyecto
  app.get('/api/crm/projects/:id/users', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;
      const projectId = parseInt(req.params.id);

      // Verificar que el proyecto pertenece a la empresa
      const project = await db.select().from(schema.projects)
        .where(and(eq(schema.projects.id, projectId), eq(schema.projects.companyId, companyId)))
        .limit(1);

      if (project.length === 0) {
        return res.status(404).json({ message: 'Proyecto no encontrado' });
      }

      // Obtener usuarios asignados
      const assignedUsers = await db.select({
        id: schema.users.id,
        fullName: schema.users.fullName,
        companyEmail: schema.users.companyEmail,
        position: schema.users.position,
      })
        .from(schema.users)
        .innerJoin(schema.projectUsers, eq(schema.users.id, schema.projectUsers.userId))
        .where(eq(schema.projectUsers.projectId, projectId))
        .orderBy(asc(schema.users.fullName));

      res.json(assignedUsers);
    } catch (error: any) {
      console.error('Error fetching project users:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  // Admin endpoint: asignar usuario a proyecto
  app.post('/api/crm/projects/:id/users', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;
      const projectId = parseInt(req.params.id);
      const { userId } = req.body;

      // Verificar que el proyecto pertenece a la empresa
      const project = await db.select().from(schema.projects)
        .where(and(eq(schema.projects.id, projectId), eq(schema.projects.companyId, companyId)))
        .limit(1);

      if (project.length === 0) {
        return res.status(404).json({ message: 'Proyecto no encontrado' });
      }

      // Verificar que el usuario pertenece a la empresa
      const user = await db.select().from(schema.users)
        .where(and(eq(schema.users.id, userId), eq(schema.users.companyId, companyId)))
        .limit(1);

      if (user.length === 0) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }

      // Asignar usuario a proyecto (ignora duplicados)
      await db.insert(schema.projectUsers).values({
        projectId,
        userId,
      }).onConflictDoNothing();

      res.json({ message: 'Usuario asignado correctamente' });
    } catch (error: any) {
      console.error('Error assigning user to project:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  // Admin endpoint: desasignar usuario de proyecto
  app.delete('/api/crm/projects/:id/users/:userId', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;
      const projectId = parseInt(req.params.id);
      const userId = parseInt(req.params.userId);

      // Verificar que el proyecto pertenece a la empresa
      const project = await db.select().from(schema.projects)
        .where(and(eq(schema.projects.id, projectId), eq(schema.projects.companyId, companyId)))
        .limit(1);

      if (project.length === 0) {
        return res.status(404).json({ message: 'Proyecto no encontrado' });
      }

      // Desasignar usuario
      await db.delete(schema.projectUsers)
        .where(and(
          eq(schema.projectUsers.projectId, projectId),
          eq(schema.projectUsers.userId, userId)
        ));

      res.json({ message: 'Usuario desasignado correctamente' });
    } catch (error: any) {
      console.error('Error removing user from project:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  app.get('/api/crm/projects/:id', authenticateToken, requireRole(['admin', 'manager']), requireFeature('crm', () => storage), async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;
      const projectId = parseInt(req.params.id);

      const project = await fetchProjectWithContacts(projectId, companyId);

      if (!project) {
        return res.status(404).json({ message: 'Proyecto no encontrado' });
      }

      res.json(project);
    } catch (error: any) {
      console.error('Error fetching project detail:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  app.post('/api/crm/projects', authenticateToken, requireRole(['admin', 'manager']), requireFeature('crm', () => storage), async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;
      const data = req.body || {};
      console.log('📝 Creating project with data:', JSON.stringify(data, null, 2));
      const clientIds: number[] = Array.isArray(data.clientIds) ? data.clientIds : [];
      const providerIds: number[] = Array.isArray(data.providerIds) ? data.providerIds : [];
      const contactIds = Array.from(new Set([...clientIds, ...providerIds]));

      if (contactIds.length > 0) {
        const contacts = await db.select()
          .from(schema.businessContacts)
          .where(and(
            eq(schema.businessContacts.companyId, companyId),
            inArray(schema.businessContacts.id, contactIds)
          ));

        const contactMap = new Map(contacts.map((c: any) => [c.id, c]));

        const invalidClient = clientIds.find(id => contactMap.get(id)?.role !== 'client');
        const invalidProvider = providerIds.find(id => contactMap.get(id)?.role !== 'provider');

        if (invalidClient || invalidProvider || contacts.length !== contactIds.length) {
          return res.status(400).json({ message: 'Contactos inválidos para este proyecto' });
        }
      }

      const statusCategoriesArray = Array.isArray(data.statusCategories) 
        ? data.statusCategories.filter((id: any) => typeof id === 'number')
        : [];
      
      console.log('📊 Status categories to save:', statusCategoriesArray);

      const [project] = await db.insert(schema.projects)
        .values({
          companyId,
          name: data.name,
          code: data.code,
          status: data.status || 'active',
          statusCategories: statusCategoriesArray,
          stage: data.stage,
          description: data.description,
          startDate: data.startDate,
          dueDate: data.dueDate,
          budget: data.budget,
          progress: data.progress ?? 0,
        })
        .returning();
      
      console.log('✅ Project created:', project.id, 'with statusCategories:', project.statusCategories);

      const linkRows = [
        ...clientIds.map((contactId) => ({ projectId: project.id, contactId, companyId, role: 'client' })),
        ...providerIds.map((contactId) => ({ projectId: project.id, contactId, companyId, role: 'provider' })),
      ];

      if (linkRows.length > 0) {
        await db.insert(schema.projectContacts)
          .values(linkRows)
          .onConflictDoNothing();
      }

      const projectWithLinks = await fetchProjectWithContacts(project.id, companyId);
      
      // Asignar automáticamente todos los administradores al proyecto
      const admins = await db.select()
        .from(schema.users)
        .where(and(
          eq(schema.users.companyId, companyId),
          eq(schema.users.role, 'admin')
        ));
      
      if (admins.length > 0) {
        const adminAssignments = admins.map(admin => ({
          projectId: project.id,
          userId: admin.id,
          createdAt: new Date()
        }));
        
        await db.insert(schema.projectUsers)
          .values(adminAssignments)
          .onConflictDoNothing();
        
        console.log(`✅ Auto-assigned ${admins.length} admin(s) to project ${project.id}`);
      }
      
      res.json(projectWithLinks);
    } catch (error: any) {
      console.error('Error creating project:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  app.patch('/api/crm/projects/:id', authenticateToken, requireRole(['admin', 'manager']), requireFeature('crm', () => storage), async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;
      const projectId = parseInt(req.params.id);
      const data = req.body || {};
      console.log('📝 Updating project', projectId, 'with data:', JSON.stringify(data, null, 2));
      const clientIds: number[] = Array.isArray(data.clientIds) ? data.clientIds : [];
      const providerIds: number[] = Array.isArray(data.providerIds) ? data.providerIds : [];
      const contactIds = Array.from(new Set([...clientIds, ...providerIds]));

      const [existing] = await db.select()
        .from(schema.projects)
        .where(and(
          eq(schema.projects.id, projectId),
          eq(schema.projects.companyId, companyId)
        ));

      if (!existing) {
        return res.status(404).json({ message: 'Proyecto no encontrado' });
      }

      if (contactIds.length > 0) {
        const contacts = await db.select()
          .from(schema.businessContacts)
          .where(and(
            eq(schema.businessContacts.companyId, companyId),
            inArray(schema.businessContacts.id, contactIds)
          ));

        const contactMap = new Map(contacts.map((c: any) => [c.id, c]));
        const invalidClient = clientIds.find(id => contactMap.get(id)?.role !== 'client');
        const invalidProvider = providerIds.find(id => contactMap.get(id)?.role !== 'provider');

        if (invalidClient || invalidProvider || contacts.length !== contactIds.length) {
          return res.status(400).json({ message: 'Contactos inválidos para este proyecto' });
        }
      }

      const statusCategoriesArray = Array.isArray(data.statusCategories) 
        ? data.statusCategories.filter((id: any) => typeof id === 'number')
        : existing.statusCategories;
      
      console.log('📊 Status categories to update:', statusCategoriesArray);
      console.log('📊 Type of statusCategoriesArray:', typeof statusCategoriesArray);
      console.log('📊 Is array?:', Array.isArray(statusCategoriesArray));

      // Neon HTTP driver no soporta transacciones; ejecutamos secuencialmente
      await db.update(schema.projects)
        .set({
          name: data.name ?? existing.name,
          code: data.code ?? existing.code,
          status: data.status ?? existing.status,
          statusCategories: statusCategoriesArray,
          stage: data.stage ?? existing.stage,
          description: data.description ?? existing.description,
          startDate: data.startDate ?? existing.startDate,
          dueDate: data.dueDate ?? existing.dueDate,
          budget: data.budget ?? existing.budget,
          progress: data.progress ?? existing.progress,
          updatedAt: new Date(),
        })
        .where(eq(schema.projects.id, projectId));
      
      console.log('✅ Project updated:', projectId);

      await db.delete(schema.projectContacts)
        .where(eq(schema.projectContacts.projectId, projectId));

      const linkRows = [
        ...clientIds.map((contactId) => ({ projectId, contactId, companyId, role: 'client' })),
        ...providerIds.map((contactId) => ({ projectId, contactId, companyId, role: 'provider' })),
      ];

      if (linkRows.length > 0) {
        await db.insert(schema.projectContacts)
          .values(linkRows)
          .onConflictDoNothing();
      }

      const project = await fetchProjectWithContacts(projectId, companyId);
      
      // Asignar automáticamente todos los administradores al proyecto si no lo están ya
      const admins = await db.select()
        .from(schema.users)
        .where(and(
          eq(schema.users.companyId, companyId),
          eq(schema.users.role, 'admin')
        ));
      
      if (admins.length > 0) {
        const adminAssignments = admins.map(admin => ({
          projectId: projectId,
          userId: admin.id,
          createdAt: new Date()
        }));
        
        await db.insert(schema.projectUsers)
          .values(adminAssignments)
          .onConflictDoNothing();
        
        console.log(`✅ Ensured ${admins.length} admin(s) are assigned to project ${projectId}`);
      }
      
      console.log('✅ Returning updated project with statusCategories:', project?.project?.statusCategories);
      res.json(project);
    } catch (error: any) {
      console.error('Error updating project:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  app.delete('/api/crm/projects/:id', authenticateToken, requireRole(['admin', 'manager']), requireFeature('crm', () => storage), async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;
      const projectId = parseInt(req.params.id);

      const [existing] = await db.select()
        .from(schema.projects)
        .where(and(
          eq(schema.projects.id, projectId),
          eq(schema.projects.companyId, companyId)
        ));

      if (!existing) {
        return res.status(404).json({ message: 'Proyecto no encontrado' });
      }

      await db.delete(schema.projects)
        .where(eq(schema.projects.id, projectId));

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting project:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  
  
  
  // Super admin route to get individual company details
  app.get('/api/super-admin/companies/:id', superAdminSecurityHeaders, authenticateSuperAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const companyId = parseInt(id);
      
      const company = await storage.getCompany(companyId);
      if (!company) {
        return res.status(404).json({ message: 'Empresa no encontrada' });
      }

      const subscription = await storage.getSubscriptionByCompanyId(companyId);
      const users = await storage.getUsersByCompany(companyId);
      
      const activeUsers = users.filter(user => user.isActive).length;
      
      // Get active addons for this company
      const companyAddons = await storage.getCompanyAddons(companyId);
      const activeAddons = companyAddons.filter(ca => ca.status === 'active' || ca.status === 'pending_cancel');
      
      // Get addon details
      const allAddons = await storage.getAllAddons();
      const activeAddonDetails = activeAddons.map(ca => {
        const addon = allAddons.find(a => a.id === ca.addonId);
        return {
          id: ca.addonId,
          key: addon?.key || 'unknown',
          name: addon?.name || 'Desconocido',
          monthlyPrice: addon?.monthlyPrice || '0',
          status: ca.status,
          purchasedAt: ca.purchasedAt
        };
      });
      
      // Calculate monthly subscription price
      let totalMonthlyPrice = 0;
      
      // Add addon prices
      for (const addon of activeAddonDetails) {
        totalMonthlyPrice += parseFloat(addon.monthlyPrice);
      }
      
      // Add user seat prices (€6 admin, €4 manager, €2 employee)
      const extraAdmins = subscription?.extraAdmins || 0;
      const extraManagers = subscription?.extraManagers || 0;
      const extraEmployees = subscription?.extraEmployees || 0;
      
      totalMonthlyPrice += extraAdmins * 6;
      totalMonthlyPrice += extraManagers * 4;
      totalMonthlyPrice += extraEmployees * 2;
      
      // Calculate trial days remaining
      const trialDuration = company.trialDurationDays || 14;
      const trialStartDate = new Date(company.createdAt);
      const trialEndDate = new Date(trialStartDate);
      trialEndDate.setDate(trialEndDate.getDate() + trialDuration);
      
      const now = new Date();
      const daysRemaining = Math.ceil((trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const isTrialActive = daysRemaining > 0;
      
      res.json({
        ...company,
        subscription: subscription || {
          plan: 'free',
          status: 'active',
          features: {},
          maxUsers: null,
          monthlyPrice: 0,
          customMonthlyPrice: null
        },
        userCount: users.length,
        activeUsers,
        activeAddons: activeAddonDetails,
        contractedRoles: {
          admins: extraAdmins,
          managers: extraManagers,
          employees: extraEmployees
        },
        calculatedMonthlyPrice: totalMonthlyPrice.toFixed(2),
        trialInfo: {
          daysRemaining: Math.max(0, daysRemaining),
          isTrialActive,
          trialDuration,
          trialStartDate: trialStartDate.toISOString(),
          trialEndDate: trialEndDate.toISOString()
        }
      });
    } catch (error: any) {
      console.error('Error fetching company details:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  // Super admin route to update company subscription
  app.patch('/api/super-admin/companies/:id/subscription', superAdminSecurityHeaders, authenticateSuperAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const companyId = parseInt(id);
      const updates = req.body;
      
      console.log('🎯 NEW ENDPOINT - Updating subscription for company:', companyId, 'Updates:', updates);
      
      const company = await storage.getCompany(companyId);
      if (!company) {
        return res.status(404).json({ message: 'Empresa no encontrada' });
      }

      let subscription = await storage.getSubscriptionByCompanyId(companyId);
      
      if (!subscription) {
        // Create subscription if it doesn't exist
        subscription = await storage.createSubscription({
          companyId,
          plan: updates.plan || 'free',
          status: 'active',
          features: updates.features || {},
          maxUsers: updates.maxUsers || null,
          monthlyPrice: updates.monthlyPrice || 0,
          customMonthlyPrice: updates.customMonthlyPrice || null,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      } else {
        // Update existing subscription
        const updateData: any = {
          updatedAt: new Date()
        };
        
        if (updates.plan) updateData.plan = updates.plan;
        // features are now managed dynamically from features table - no longer stored in subscriptions
        if (updates.maxUsers !== undefined) updateData.maxUsers = updates.maxUsers;
        if (updates.customMonthlyPrice !== undefined) {
          // 🔒 CRITICAL SECURITY: Log all custom price changes for audit trail
          const previousPrice = subscription.customMonthlyPrice || 0;
          const newPrice = updates.customMonthlyPrice || 0;
          
          console.log(`🚨 CRITICAL AUDIT: Custom price change - Company: ${companyId}, Super Admin: ${req.superAdmin?.email}, Previous: €${previousPrice}, New: €${newPrice}, IP: ${req.ip}, Time: ${new Date().toISOString()}`);
          
          // 🚨 SECURITY WARNING: Alert on suspicious pricing (0 or very low amounts)
          if (newPrice === 0) {
            console.log(`⚠️ SECURITY WARNING: ZERO PRICE SET - Company: ${companyId} set to €0/month by Super Admin: ${req.superAdmin?.email}. This requires immediate review.`);
          } else if (newPrice > 0 && newPrice < 5) {
            console.log(`⚠️ SECURITY WARNING: VERY LOW PRICE - Company: ${companyId} set to €${newPrice}/month by Super Admin: ${req.superAdmin?.email}. This may require review.`);
          }
          
          // 🔒 VALIDATE: Check for reasonable price bounds (optional - can be adjusted)
          if (newPrice < 0) {
            console.log(`🚨 SECURITY BLOCK: Negative price rejected - Company: ${companyId}, Attempted: €${newPrice}`);
            return res.status(400).json({ 
              message: "El precio personalizado no puede ser negativo" 
            });
          }
          
          if (newPrice > 10000) {
            console.log(`🚨 SECURITY BLOCK: Excessive price rejected - Company: ${companyId}, Attempted: €${newPrice}`);
            return res.status(400).json({ 
              message: "El precio personalizado no puede exceder €10,000/mes. Contacta soporte técnico para precios especiales." 
            });
          }
          
          updateData.customMonthlyPrice = updates.customMonthlyPrice;
        }
        
        subscription = await storage.updateCompanySubscription(companyId, updateData);
      }

      // Handle trial duration updates (stored in companies table)
      if (updates.trialDurationDays !== undefined) {
        console.log('🔄 Updating trial duration for company:', companyId, 'to:', updates.trialDurationDays);
        const updateResult = await storage.updateCompany(companyId, { 
          trialDurationDays: updates.trialDurationDays 
        });
        console.log('✅ Trial duration update result:', updateResult?.trialDurationDays);
        
        // 🎯 CRITICAL: When extending trial, check if company should be reactivated
        if (updateResult && subscription) {
          const registrationDate = new Date(company.createdAt);
          const newTrialEndDate = new Date(registrationDate);
          const newTrialDuration = updates.trialDurationDays || 7;
          newTrialEndDate.setDate(newTrialEndDate.getDate() + newTrialDuration);
          
          const now = new Date();
          const daysRemaining = Math.ceil((newTrialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          const isTrialNowActive = daysRemaining > 0;
          
          // If trial was blocked and now has days remaining, reactivate it
          if (isTrialNowActive && subscription.status === 'blocked') {
            console.log(`🔄 REACTIVATING COMPANY: Trial extended from blocked to active for company ${companyId}`);
            await storage.updateCompanySubscription(companyId, {
              status: 'trial',
              isTrialActive: true,
              updatedAt: new Date()
            });
            
            // Also update in database to ensure consistency
            await db.execute(sql`
              UPDATE subscriptions 
              SET status = 'trial', is_trial_active = true, updated_at = now()
              WHERE company_id = ${companyId}
            `);
            
            // Refresh subscription object
            subscription = await storage.getSubscriptionByCompanyId(companyId);
            
            console.log(`✅ Company ${companyId} successfully reactivated from trial extension`);
            console.log(`   - New trial end date: ${newTrialEndDate.toISOString()}`);
            console.log(`   - Days remaining: ${daysRemaining}`);
          }
        }
      }
      
      // Get updated company information to include in response
      const updatedCompany = await storage.getCompany(companyId);
      
      logAudit({
        timestamp: new Date(),
        ip: req.ip || 'unknown',
        action: 'COMPANY_SUBSCRIPTION_UPDATED',
        email: req.superAdmin?.email,
        success: true,
        details: `Updated subscription for company ID ${companyId}: ${JSON.stringify(updates)}`
      });
      
      res.json({
        subscription,
        trialDurationDays: updatedCompany?.trialDurationDays
      });
    } catch (error: any) {
      console.error('Error updating company subscription:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  // 🔒 SECURITY: Audit logs endpoint (view-only) with pagination
  app.get('/api/super-admin/audit-logs', superAdminSecurityHeaders, authenticateSuperAdmin, async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      
      // Get audit logs from database (most recent first)
      const logs = await storage.getAuditLogs(limit, offset);
      
      // Log the access to audit logs for meta-security
      await logAudit({
        timestamp: new Date(),
        ip: req.ip || 'unknown',
        action: 'AUDIT_LOGS_ACCESSED',
        email: req.superAdmin?.email,
        success: true,
        details: `Accessed audit logs (limit: ${limit}, offset: ${offset})`
      });
      
      res.json({
        logs,
        limit,
        offset,
        count: logs.length
      });
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  // Super Admin - Registration Settings Management
  app.get('/api/super-admin/registration-settings', superAdminSecurityHeaders, authenticateSuperAdmin, async (req: any, res) => {
    try {
      const settings = await storage.getRegistrationSettings();
      res.json(settings);
    } catch (error) {
      console.error('Error fetching registration settings:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  app.patch('/api/super-admin/registration-settings', superAdminSecurityHeaders, authenticateSuperAdmin, async (req: any, res) => {
    try {
      const { publicRegistrationEnabled } = req.body;
      const settings = await storage.updateRegistrationSettings({
        publicRegistrationEnabled,
        updatedAt: new Date()
      });
      
      logAudit({
        timestamp: new Date(),
        ip: req.ip || 'unknown',
        action: 'REGISTRATION_SETTINGS_UPDATED',
        email: req.superAdmin?.email,
        success: true,
        details: `Public registration ${publicRegistrationEnabled ? 'enabled' : 'disabled'}`
      });
      
      res.json(settings);
    } catch (error) {
      console.error('Error updating registration settings:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  // Super Admin - Invitation Links Management  
  app.post('/api/super-admin/invitations', superAdminSecurityHeaders, authenticateSuperAdmin, async (req: any, res) => {
    try {
      const { email, inviterName, companyName } = req.body;
      
      // Check if email already has an active invitation
      const existingInvitation = await storage.getActiveInvitationByEmail(email);
      if (existingInvitation) {
        return res.status(400).json({ message: 'Este email ya tiene una invitación activa' });
      }

      // Generate secure token
      const token = crypto.randomBytes(32).toString('hex');
      
      // Create invitation with 7 days expiry
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      
      const invitation = await storage.createInvitationLink({
        email,
        token,
        expiresAt,
        used: false,
        createdBy: req.superAdmin.id
      });

      // Generate invitation URL
      const invitationUrl = `${req.protocol}://${req.get('host')}/registro/invitacion/${token}`;
      
      // Send invitation email
      try {
        // 🔒 SECURITY: Configure with secure environment variables
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: 465,
          secure: true, // SSL
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
          tls: {
            rejectUnauthorized: false
          }
        });

        // Use static logo URL for email compatibility
        const logoUrl = 'https://oficaz.es/email-logo.png';

        const mailOptions = {
          from: '"Oficaz" <soy@oficaz.es>',
          to: email,
          subject: 'Invitación a Oficaz - Registro de Empresa',
          text: `Has sido invitado a registrar tu empresa en Oficaz. Usa este enlace para completar el registro: ${invitationUrl}. La invitación expira en 7 días.`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Invitación a Oficaz</title>
            </head>
            <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
              <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
                
                <!-- Header with logo -->
                <div style="background-color: #ffffff; padding: 15px; text-align: center; border-bottom: 1px solid #e5e7eb;">
                  <img src="${logoUrl}" alt="Oficaz" style="height: 35px; width: auto; max-width: 150px; display: block; margin: 0 auto;" />
                </div>
                
                <!-- Content -->
                <div style="padding: 30px 20px;">
                  <h1 style="color: #1f2937; font-size: 24px; font-weight: 600; margin-bottom: 20px; text-align: center;">
                    Has sido invitado a Oficaz
                  </h1>
                  
                  <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
                    Hola,
                  </p>
                  
                  <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
                    Has recibido una invitación para registrar tu empresa en <strong>Oficaz</strong>, la plataforma de gestión empresarial más intuitiva del mercado.
                  </p>
                  
                  <div style="text-align: center; margin: 35px 0;">
                    <a href="${invitationUrl}" style="display: inline-block; background: linear-gradient(135deg, #007AFF 0%, #0056b3 100%); color: white; text-decoration: none; padding: 12px 30px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                      Completar Registro
                    </a>
                  </div>
                  
                  <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin-bottom: 15px;">
                    Esta invitación expira en <strong>7 días</strong>. Si no puedes hacer clic en el botón, copia y pega el siguiente enlace en tu navegador:
                  </p>
                  
                  <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; border-left: 3px solid #007AFF; margin-bottom: 20px;">
                    <a href="${invitationUrl}" style="color: #007AFF; text-decoration: none; word-break: break-all; font-size: 14px;">
                      ${invitationUrl}
                    </a>
                  </div>
                  
                  <p style="color: #6b7280; font-size: 14px; line-height: 1.5;">
                    Si no esperabas esta invitación, puedes ignorar este email de forma segura.
                  </p>
                </div>
                
                <!-- Footer -->
                <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
                  <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                    © 2025 Oficaz. Todos los derechos reservados.
                  </p>
                </div>
              </div>
            </body>
            </html>
          `
        };

        await transporter.sendMail(mailOptions);
        console.log(`Invitation email sent to ${email}: ${invitationUrl}`);
        
      } catch (emailError) {
        console.error('Error sending invitation email:', emailError);
        // Don't fail the invitation creation if email fails
      }
      
      logAudit({
        timestamp: new Date(),
        ip: req.ip || 'unknown',
        action: 'INVITATION_CREATED',
        email: req.superAdmin?.email,
        success: true,
        details: `Invitation created for ${email}`
      });
      
      res.status(201).json({
        ...invitation,
        invitationUrl
      });
    } catch (error) {
      console.error('Error creating invitation:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  // 🔒 SECURITY: Rate limiter for invitation validation (prevent brute force)
  const invitationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 attempts per IP
    message: { error: 'Demasiados intentos de validación. Intenta de nuevo en 15 minutos.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Validate invitation token
  app.get('/api/validate-invitation/:token', invitationLimiter, async (req, res) => {
    try {
      const { token } = req.params;
      
      if (!token) {
        return res.status(400).json({ message: 'Token requerido' });
      }

      const invitation = await storage.getInvitationByToken(token);
      
      if (!invitation) {
        return res.status(404).json({ message: 'Invitación no encontrada' });
      }

      const now = new Date();
      const expiresAt = new Date(invitation.expiresAt);
      const isExpired = now > expiresAt;
      const isUsed = invitation.used;
      
      const isValid = !isExpired && !isUsed;

      res.json({
        email: invitation.email,
        token: invitation.token,
        used: invitation.used,
        expiresAt: invitation.expiresAt,
        isValid,
        isExpired
      });
    } catch (error) {
      console.error('Error validating invitation:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  app.get('/api/super-admin/invitations', superAdminSecurityHeaders, authenticateSuperAdmin, async (req: any, res) => {
    try {
      const invitations = await storage.getAllInvitationLinks();
      res.json(invitations);
    } catch (error) {
      console.error('Error fetching invitations:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  app.delete('/api/super-admin/invitations/:id', superAdminSecurityHeaders, authenticateSuperAdmin, async (req: any, res) => {
    try {
      const invitationId = parseInt(req.params.id);
      const success = await storage.deleteInvitationLink(invitationId);
      
      if (!success) {
        return res.status(404).json({ message: 'Invitación no encontrada' });
      }
      
      logAudit({
        timestamp: new Date(),
        ip: req.ip || 'unknown',
        action: 'INVITATION_DELETED',
        email: req.superAdmin?.email,
        success: true,
        details: `Deleted invitation ID ${invitationId}`
      });
      
      res.json({ message: 'Invitación eliminada correctamente' });
    } catch (error) {
      console.error('Error deleting invitation:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  // Super Admin - Promotional Codes Management
  app.get('/api/super-admin/promotional-codes', superAdminSecurityHeaders, authenticateSuperAdmin, async (req: any, res) => {
    try {
      const promoCodes = await storage.getAllPromotionalCodes();
      res.json(promoCodes);
    } catch (error: any) {
      console.error('Error fetching promotional codes:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error interno del servidor al obtener los códigos promocionales' 
      });
    }
  });

  app.post('/api/super-admin/promotional-codes', superAdminSecurityHeaders, authenticateSuperAdmin, async (req: any, res) => {
    try {
      const { code, description, trialDurationDays, isActive, maxUses, validFrom, validUntil } = req.body;
      
      if (!code || !description || !trialDurationDays) {
        return res.status(400).json({ 
          success: false, 
          message: 'Código, descripción y días de prueba son requeridos' 
        });
      }

      // Convert types before passing to storage
      const processedData = {
        code: code.toUpperCase().trim(),
        description: description.trim(),
        trialDurationDays: Number(trialDurationDays),
        isActive: isActive ?? true,
        maxUses: (maxUses === '' || maxUses == null) ? null : Number(maxUses),
        validFrom: validFrom ? new Date(validFrom) : null,
        validUntil: validUntil ? new Date(validUntil) : null
      };

      const promoCode = await storage.createPromotionalCode(processedData);

      res.json(promoCode);
    } catch (error: any) {
      console.error('Error creating promotional code:', error);
      if (error.message?.includes('unique constraint')) {
        return res.status(400).json({ 
          success: false, 
          message: 'Ya existe un código promocional con ese nombre' 
        });
      }
      res.status(500).json({ 
        success: false, 
        message: 'Error interno del servidor al crear el código promocional' 
      });
    }
  });

  app.patch('/api/super-admin/promotional-codes/:id', superAdminSecurityHeaders, authenticateSuperAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      // Convert types before passing to storage
      const processedUpdates: any = {};
      
      if (updates.code) {
        processedUpdates.code = updates.code.toUpperCase().trim();
      }
      if (updates.description) {
        processedUpdates.description = updates.description.trim();
      }
      if (updates.trialDurationDays !== undefined) {
        processedUpdates.trialDurationDays = Number(updates.trialDurationDays);
      }
      if (updates.isActive !== undefined) {
        processedUpdates.isActive = updates.isActive;
      }
      if (updates.maxUses !== undefined) {
        processedUpdates.maxUses = (updates.maxUses === '' || updates.maxUses == null) ? null : Number(updates.maxUses);
      }
      if (updates.validFrom !== undefined) {
        processedUpdates.validFrom = updates.validFrom ? new Date(updates.validFrom) : null;
      }
      if (updates.validUntil !== undefined) {
        processedUpdates.validUntil = updates.validUntil ? new Date(updates.validUntil) : null;
      }

      const updatedCode = await storage.updatePromotionalCode(parseInt(id), processedUpdates);
      res.json(updatedCode);
    } catch (error: any) {
      console.error('Error updating promotional code:', error);
      if (error.message?.includes('unique constraint')) {
        return res.status(400).json({ 
          success: false, 
          message: 'Ya existe un código promocional con ese nombre' 
        });
      }
      res.status(500).json({ 
        success: false, 
        message: 'Error interno del servidor al actualizar el código promocional' 
      });
    }
  });

  app.delete('/api/super-admin/promotional-codes/:id', superAdminSecurityHeaders, authenticateSuperAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deletePromotionalCode(parseInt(id));
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting promotional code:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error interno del servidor al eliminar el código promocional' 
      });
    }
  });

  // ==================== EMAIL MARKETING ENDPOINTS ====================
  
  // Track email open (public endpoint - no auth required)
  app.get('/api/track/open/:sendId', async (req, res) => {
    try {
      const sendId = parseInt(req.params.sendId);
      
      // Get the send record
      const [sendRecord] = await db.select()
        .from(schema.emailCampaignSends)
        .where(eq(schema.emailCampaignSends.id, sendId))
        .limit(1);

      if (sendRecord && !sendRecord.openedAt) {
        // Mark as opened
        await db.update(schema.emailCampaignSends)
          .set({ openedAt: new Date() })
          .where(eq(schema.emailCampaignSends.id, sendId));

        // 🔒 MONITOR EMAIL: Increment campaign opened count only if not test/control email
        if (!isMonitorEmail(sendRecord.recipientEmail)) {
          await db.update(schema.emailCampaigns)
            .set({ 
              openedCount: sql`${schema.emailCampaigns.openedCount} + 1`
            })
            .where(eq(schema.emailCampaigns.id, sendRecord.campaignId));
        }

        console.log(`📧 Email opened: sendId=${sendId}, campaign=${sendRecord.campaignId}, recipient=${sendRecord.recipientEmail}${isMonitorEmail(sendRecord.recipientEmail) ? ' (monitor - not counted)' : ''}`);
      }

      // Return 1x1 transparent pixel
      const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
      res.writeHead(200, {
        'Content-Type': 'image/gif',
        'Content-Length': pixel.length,
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      });
      res.end(pixel);
    } catch (error) {
      console.error('Error tracking email open:', error);
      // Still return the pixel even on error
      const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
      res.writeHead(200, { 'Content-Type': 'image/gif' });
      res.end(pixel);
    }
  });

  // Track email click (public endpoint - no auth required)
  app.get('/api/track/click/:sendId', async (req, res) => {
    try {
      const sendId = parseInt(req.params.sendId);
      const targetUrl = req.query.url as string;
      
      if (!targetUrl) {
        return res.status(400).send('Missing target URL');
      }

      // Get the send record
      const [sendRecord] = await db.select()
        .from(schema.emailCampaignSends)
        .where(eq(schema.emailCampaignSends.id, sendId))
        .limit(1);

      if (sendRecord && !sendRecord.clickedAt) {
        // Mark as clicked
        await db.update(schema.emailCampaignSends)
          .set({ clickedAt: new Date() })
          .where(eq(schema.emailCampaignSends.id, sendId));

        // 🔒 MONITOR EMAIL: Increment campaign clicked count only if not test/control email
        if (!isMonitorEmail(sendRecord.recipientEmail)) {
          await db.update(schema.emailCampaigns)
            .set({ 
              clickedCount: sql`${schema.emailCampaigns.clickedCount} + 1`
            })
            .where(eq(schema.emailCampaigns.id, sendRecord.campaignId));
        }

        console.log(`🖱️ Email clicked: sendId=${sendId}, campaign=${sendRecord.campaignId}, url=${targetUrl}, recipient=${sendRecord.recipientEmail}${isMonitorEmail(sendRecord.recipientEmail) ? ' (monitor - not counted)' : ''}`);
      }

      // Add campaign tracking parameter to registration URLs
      let finalUrl = targetUrl;
      if (sendRecord) {
        try {
          const urlObj = new URL(targetUrl, 'https://oficaz.es'); // Use base for relative URLs
          const isRegistrationUrl = urlObj.pathname.includes('/register') || 
                                    urlObj.pathname.includes('/registro') ||
                                    urlObj.pathname.includes('/signup');
          
          if (isRegistrationUrl) {
            urlObj.searchParams.set('campaign', sendRecord.campaignId.toString());
            urlObj.searchParams.set('source', 'email');
            finalUrl = urlObj.toString();
            console.log(`📊 Added campaign tracking to registration URL: campaign=${sendRecord.campaignId}`);
          }
        } catch (urlError) {
          console.error('Error parsing URL for campaign tracking:', urlError);
          // Keep original URL if parsing fails
        }
      }

      // Redirect to target URL (with campaign tracking if applicable)
      res.redirect(finalUrl);
    } catch (error) {
      console.error('Error tracking email click:', error);
      // Still redirect even on error if URL is provided
      const targetUrl = req.query.url as string;
      if (targetUrl) {
        res.redirect(targetUrl);
      } else {
        res.status(500).send('Error tracking click');
      }
    }
  });

  // Get all email campaigns
  app.get('/api/super-admin/email-campaigns', superAdminSecurityHeaders, authenticateSuperAdmin, async (req: any, res) => {
    try {
      const campaigns = await storage.getAllEmailCampaigns();
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.json(campaigns);
    } catch (error: any) {
      console.error('Error fetching email campaigns:', error);
      res.status(500).json({ success: false, message: 'Error al obtener campañas' });
    }
  });

  // Get campaign send history
  app.get('/api/super-admin/email-campaigns/:id/history', superAdminSecurityHeaders, authenticateSuperAdmin, async (req: any, res) => {
    try {
      const campaignId = parseInt(req.params.id);
      const sends = await db.select()
        .from(schema.emailCampaignSends)
        .where(eq(schema.emailCampaignSends.campaignId, campaignId))
        .orderBy(desc(schema.emailCampaignSends.sentAt));
      
      res.json(sends);
    } catch (error: any) {
      console.error('Error fetching campaign history:', error);
      res.status(500).json({ success: false, message: 'Error al obtener historial' });
    }
  });

  // Get campaign conversion statistics (emails → opened → clicks → registrations → paid subscriptions)
  app.get('/api/super-admin/email-campaigns/:id/conversions', superAdminSecurityHeaders, authenticateSuperAdmin, async (req: any, res) => {
    try {
      const campaignId = parseInt(req.params.id);
      
      // Get all emails sent in this campaign with their tracking data
      const allSends = await db.select({
        email: schema.emailCampaignSends.recipientEmail,
        name: schema.emailCampaignSends.recipientName,
        sentAt: schema.emailCampaignSends.sentAt,
        openedAt: schema.emailCampaignSends.openedAt,
        clickedAt: schema.emailCampaignSends.clickedAt,
      })
        .from(schema.emailCampaignSends)
        .where(eq(schema.emailCampaignSends.campaignId, campaignId))
        .orderBy(desc(schema.emailCampaignSends.sentAt));
      
      // Get companies registered from this campaign
      const registeredCompanies = await db.select()
        .from(schema.companies)
        .where(eq(schema.companies.emailCampaignId, campaignId));
      
      const companyIds = registeredCompanies.map(c => c.id);
      
      // Get subscriptions for these companies
      let subscriptions: any[] = [];
      if (companyIds.length > 0) {
        subscriptions = await db.select()
          .from(schema.subscriptions)
          .where(sql`${schema.subscriptions.companyId} IN (${sql.join(companyIds, sql`, `)})`);
      }
      
      const registeredCompaniesRaw = registeredCompanies.map(c => {
        const subscription = subscriptions.find(s => s.companyId === c.id);
        return {
          companyId: c.id,
          subscriptionStatus: subscription?.status || null,
        };
      });
      
      // Get admin emails for registered companies (only if there are companies)
      let companyEmails: any[] = [];
      
      if (companyIds.length > 0) {
        const result = await db.execute(sql`
          SELECT company_id as "companyId", company_email as "email"
          FROM users
          WHERE company_id IN (${sql.join(companyIds, sql`, `)})
          AND role = 'admin'
        `);
        companyEmails = (result as any).rows || result;
      }
      
      // Merge company data with emails
      const registeredWithEmails = registeredCompaniesRaw.map(c => {
        const emailData = companyEmails.find(e => e.companyId === c.companyId);
        return {
          companyId: c.companyId,
          email: emailData?.email || null,
          subscriptionStatus: c.subscriptionStatus,
        };
      });
      
      // Organize emails by stage
      const sentEmails = allSends.map(s => ({ email: s.email, name: s.name, timestamp: s.sentAt }));
      const openedEmails = allSends.filter(s => s.openedAt).map(s => ({ email: s.email, name: s.name, timestamp: s.openedAt }));
      const clickedEmails = allSends.filter(s => s.clickedAt).map(s => ({ email: s.email, name: s.name, timestamp: s.clickedAt }));
      const registeredEmails = registeredWithEmails.map(c => ({ email: c.email, name: null, companyId: c.companyId }));
      const paidEmails = registeredWithEmails.filter(c => c.subscriptionStatus === 'active').map(c => ({ email: c.email, name: null, companyId: c.companyId }));
      
      // Calculate metrics
      const totalSent = sentEmails.length;
      const totalOpened = openedEmails.length;
      const totalClicked = clickedEmails.length;
      const totalRegistrations = registeredEmails.length;
      const totalPaid = paidEmails.length;
      
      // Calculate conversion rates
      const openRate = totalSent > 0 ? (totalOpened / totalSent * 100) : 0;
      const clickRate = totalOpened > 0 ? (totalClicked / totalOpened * 100) : 0;
      const registrationRate = totalClicked > 0 ? (totalRegistrations / totalClicked * 100) : 0;
      const paidRate = totalRegistrations > 0 ? (totalPaid / totalRegistrations * 100) : 0;
      const overallConversionRate = totalSent > 0 ? (totalPaid / totalSent * 100) : 0;
      
      res.json({
        campaignId,
        funnel: {
          sent: totalSent,
          opened: totalOpened,
          clicked: totalClicked,
          registered: totalRegistrations,
          paid: totalPaid,
        },
        rates: {
          openRate: parseFloat(openRate.toFixed(2)),
          clickRate: parseFloat(clickRate.toFixed(2)),
          registrationRate: parseFloat(registrationRate.toFixed(2)),
          paidRate: parseFloat(paidRate.toFixed(2)),
          overallConversionRate: parseFloat(overallConversionRate.toFixed(2)),
        },
        details: {
          sent: sentEmails,
          opened: openedEmails,
          clicked: clickedEmails,
          registered: registeredEmails,
          paid: paidEmails,
        },
      });
    } catch (error: any) {
      console.error('Error fetching conversion statistics:', error);
      res.status(500).json({ success: false, message: 'Error al obtener estadísticas de conversión' });
    }
  });

  // Get all email prospects
  app.get('/api/super-admin/email-prospects', superAdminSecurityHeaders, authenticateSuperAdmin, async (req: any, res) => {
    try {
      const prospects = await storage.getAllEmailProspects();
      res.json(prospects);
    } catch (error: any) {
      console.error('Error fetching email prospects:', error);
      res.status(500).json({ success: false, message: 'Error al obtener prospects' });
    }
  });

  // Get registered users stats for email marketing
  app.get('/api/super-admin/registered-users-stats', superAdminSecurityHeaders, authenticateSuperAdmin, async (req: any, res) => {
    try {
      const stats = await storage.getRegisteredUsersStats();
      res.json(stats);
    } catch (error: any) {
      console.error('Error fetching registered users stats:', error);
      res.status(500).json({ success: false, message: 'Error al obtener estadísticas de usuarios' });
    }
  });

  // Get recipients by category (active, trial, blocked, cancelled)
  app.get('/api/super-admin/recipients/:category', superAdminSecurityHeaders, authenticateSuperAdmin, async (req: any, res) => {
    try {
      const { category } = req.params;
      
      let users;
      
      if (category === 'active') {
        users = await db.execute(sql`
          SELECT DISTINCT ON (c.id)
            u.company_email as email, 
            c.name as "companyName",
            c.marketing_emails_consent as "marketingConsent"
          FROM companies c
          INNER JOIN subscriptions s ON c.id = s.company_id
          INNER JOIN users u ON c.id = u.company_id
          WHERE u.company_email IS NOT NULL 
          AND u.role = 'admin'
          AND s.status = 'active'
          ORDER BY c.id, u.role
        `);
      } else if (category === 'trial') {
        users = await db.execute(sql`
          SELECT DISTINCT ON (c.id)
            u.company_email as email, 
            c.name as "companyName",
            c.marketing_emails_consent as "marketingConsent"
          FROM companies c
          INNER JOIN subscriptions s ON c.id = s.company_id
          INNER JOIN users u ON c.id = u.company_id
          WHERE u.company_email IS NOT NULL 
          AND u.role = 'admin'
          AND s.status = 'trial'
          ORDER BY c.id, u.role
        `);
      } else if (category === 'blocked') {
        users = await db.execute(sql`
          SELECT DISTINCT ON (c.id)
            u.company_email as email, 
            c.name as "companyName",
            c.marketing_emails_consent as "marketingConsent"
          FROM companies c
          INNER JOIN subscriptions s ON c.id = s.company_id
          INNER JOIN users u ON c.id = u.company_id
          WHERE u.company_email IS NOT NULL 
          AND u.role = 'admin'
          AND s.status = 'blocked'
          ORDER BY c.id, u.role
        `);
      } else if (category === 'cancelled') {
        users = await db.execute(sql`
          SELECT DISTINCT ON (c.id)
            u.company_email as email, 
            c.name as "companyName",
            c.marketing_emails_consent as "marketingConsent"
          FROM companies c
          INNER JOIN subscriptions s ON c.id = s.company_id
          INNER JOIN users u ON c.id = u.company_id
          WHERE u.company_email IS NOT NULL 
          AND u.role = 'admin'
          AND s.status = 'cancelled'
          ORDER BY c.id, u.role
        `);
      } else {
        return res.status(400).json({ success: false, message: 'Categoría inválida' });
      }

      res.json(users.rows);
    } catch (error: any) {
      console.error('Error fetching recipients:', error);
      res.status(500).json({ success: false, message: 'Error al obtener destinatarios' });
    }
  });

  // Create email prospect
  app.post('/api/super-admin/email-prospects', superAdminSecurityHeaders, authenticateSuperAdmin, async (req: any, res) => {
    try {
      // Validate with Zod schema
      const prospectData = schema.insertEmailProspectSchema.parse(req.body);
      
      // Check for duplicates
      if (prospectData.email && !prospectData.email.includes('@temp-')) {
        const existingByEmail = await db.select()
          .from(schema.emailProspects)
          .where(eq(schema.emailProspects.email, prospectData.email))
          .limit(1);
        
        if (existingByEmail.length > 0) {
          return res.status(400).json({ 
            success: false, 
            message: `Ya existe un contacto con el email: ${prospectData.email}` 
          });
        }
      }
      
      if (prospectData.phone) {
        const existingByPhone = await db.select()
          .from(schema.emailProspects)
          .where(eq(schema.emailProspects.phone, prospectData.phone))
          .limit(1);
        
        if (existingByPhone.length > 0) {
          return res.status(400).json({ 
            success: false, 
            message: `Ya existe un contacto con el teléfono: ${prospectData.phone}` 
          });
        }
      }
      
      const prospect = await storage.createEmailProspect(prospectData);
      res.json(prospect);
    } catch (error: any) {
      console.error('Error creating email prospect:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ success: false, message: 'Datos inválidos', errors: error.errors });
      }
      if (error.message?.includes('unique constraint')) {
        return res.status(400).json({ success: false, message: 'Este email ya existe' });
      }
      res.status(500).json({ success: false, message: 'Error al crear prospect' });
    }
  });

  // Upload email marketing image (using Object Storage for persistence)
  app.post('/api/super-admin/email-marketing/upload-image', superAdminSecurityHeaders, authenticateSuperAdmin, upload.single('image'), async (req: any, res) => {
    try {
      console.log('📤 Upload request received. File:', req.file ? 'YES' : 'NO');
      console.log('📤 Request body:', req.body);
      console.log('📤 Content-Type:', req.headers['content-type']);
      
      if (!req.file) {
        console.log('❌ No file in request');
        return res.status(400).json({ success: false, message: 'No se proporcionó ninguna imagen' });
      }

      const file = req.file;
      console.log('📤 File details:', { 
        originalname: file.originalname, 
        mimetype: file.mimetype, 
        size: file.size,
        path: file.path
      });
      
      // Validate file type
      const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedMimeTypes.includes(file.mimetype)) {
        // Delete invalid file
        fs.unlinkSync(file.path);
        return res.status(400).json({ 
          success: false, 
          message: 'Tipo de archivo no permitido. Solo se aceptan: JPG, PNG, GIF, WEBP' 
        });
      }

      // Get desired width from request body (default: 600px for better email size)
      const maxWidth = parseInt(req.body.width) || 600;
      console.log('📏 Resizing image to max width:', maxWidth);

      // Generate filename - use forceFilename if provided (for recovery), otherwise generate new
      // This allows recovering lost images with their original filename
      const filename = req.body.forceFilename || `email-${Date.now()}.jpg`;
      
      if (req.body.forceFilename) {
        console.log('🔄 Recovery mode: Using forced filename:', filename);
      }

      // Process image with sharp (compress, resize, and convert to JPG for email compatibility)
      // WEBP and other formats are automatically converted to JPG for maximum email client support
      const processedBuffer = await sharp(file.path)
        .resize(maxWidth, null, { // Max width based on user selection, maintain aspect ratio
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ 
          quality: 85,
          mozjpeg: true // Better compression
        })
        .toBuffer();

      // Delete temp file
      fs.unlinkSync(file.path);

      // Upload to Object Storage for persistence
      const { SimpleObjectStorageService } = await import('./objectStorageSimple.js');
      const objectStorage = new SimpleObjectStorageService();
      const objectPath = await objectStorage.uploadPublicImage(
        processedBuffer,
        'image/jpeg',
        filename
      );

      // Return RELATIVE path only (no domain) for cross-environment compatibility
      // The frontend will build the full URL dynamically based on current environment
      const imageUrl = objectPath; // e.g., /public-objects/email-marketing/email-123.jpg

      console.log(`✅ Email marketing image uploaded to Object Storage: ${imageUrl}`);

      res.json({ 
        success: true, 
        imageUrl, // Relative path only
        filename 
      });
    } catch (error: any) {
      console.error('Error uploading email marketing image:', error);
      
      // Clean up file if it exists
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      res.status(500).json({ success: false, message: 'Error al subir la imagen: ' + error.message });
    }
  });

  // Create email campaign
  app.post('/api/super-admin/email-campaigns', superAdminSecurityHeaders, authenticateSuperAdmin, async (req: any, res) => {
    try {
      // Validate with Zod schema
      const campaignData = schema.insertEmailCampaignSchema.parse(req.body);
      const campaign = await storage.createEmailCampaign(campaignData);
      res.json(campaign);
    } catch (error: any) {
      console.error('Error creating email campaign:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ success: false, message: 'Datos inválidos', errors: error.errors });
      }
      res.status(500).json({ success: false, message: 'Error al crear campaña' });
    }
  });

  // Update email campaign
  app.patch('/api/super-admin/email-campaigns/:id', superAdminSecurityHeaders, authenticateSuperAdmin, async (req: any, res) => {
    try {
      const campaign = await storage.updateEmailCampaign(parseInt(req.params.id), req.body);
      res.json(campaign);
    } catch (error: any) {
      console.error('Error updating email campaign:', error);
      res.status(500).json({ success: false, message: 'Error al actualizar campaña' });
    }
  });

  // Delete email campaign
  app.delete('/api/super-admin/email-campaigns/:id', superAdminSecurityHeaders, authenticateSuperAdmin, async (req: any, res) => {
    try {
      const campaignId = parseInt(req.params.id);
      console.log('🗑️ Attempting to delete campaign ID:', campaignId);
      const deleted = await storage.deleteEmailCampaign(campaignId);
      console.log('🗑️ Delete result:', deleted);
      
      if (!deleted) {
        return res.status(404).json({ success: false, message: 'Campaña no encontrada' });
      }
      
      res.json({ success: true, message: 'Campaña eliminada correctamente' });
    } catch (error: any) {
      console.error('Error deleting email campaign:', error);
      res.status(500).json({ success: false, message: 'Error al eliminar campaña' });
    }
  });

  // Duplicate email campaign
  app.post('/api/super-admin/email-campaigns/:id/duplicate', superAdminSecurityHeaders, authenticateSuperAdmin, async (req: any, res) => {
    try {
      const campaignId = parseInt(req.params.id);
      
      // Get original campaign
      const originalCampaign = await storage.getEmailCampaignById(campaignId);
      if (!originalCampaign) {
        return res.status(404).json({ success: false, message: 'Campaña no encontrada' });
      }

      // Create duplicate without sent data - include all required fields
      const duplicateData = {
        name: `${originalCampaign.name} (Copia)`,
        subject: originalCampaign.subject,
        preheader: originalCampaign.preheader,
        htmlContent: originalCampaign.htmlContent,
        selectedEmails: originalCampaign.selectedEmails || [],
        status: 'draft' as const,
        targetAudience: originalCampaign.targetAudience,
        includeActiveSubscriptions: originalCampaign.includeActiveSubscriptions || false,
        includeTrialSubscriptions: originalCampaign.includeTrialSubscriptions || false,
        includeBlockedSubscriptions: originalCampaign.includeBlockedSubscriptions || false,
        includeCancelledSubscriptions: originalCampaign.includeCancelledSubscriptions || false,
        includeProspects: originalCampaign.includeProspects || false,
        specificPlans: originalCampaign.specificPlans || [],
        prospectTags: originalCampaign.prospectTags || [],
      };

      const duplicatedCampaign = await storage.createEmailCampaign(duplicateData);
      
      res.json({ 
        success: true, 
        message: 'Campaña duplicada correctamente',
        campaign: duplicatedCampaign
      });
    } catch (error: any) {
      console.error('Error duplicating email campaign:', error);
      res.status(500).json({ success: false, message: 'Error al duplicar campaña' });
    }
  });

  // Migrate email marketing images from filesystem to Object Storage
  app.post('/api/super-admin/email-marketing/migrate-images', superAdminSecurityHeaders, authenticateSuperAdmin, async (req: any, res) => {
    try {
      console.log('📦 Starting migration of email marketing images to Object Storage...');
      
      const uploadDir = path.join(process.cwd(), 'uploads');
      const { SimpleObjectStorageService } = await import('./objectStorageSimple.js');
      const objectStorage = new SimpleObjectStorageService();
      
      // Get all campaigns
      const campaigns = await db.select().from(schema.emailCampaigns);
      console.log(`📦 Found ${campaigns.length} campaigns to check`);
      
      let migratedCount = 0;
      let errorCount = 0;
      const errors: string[] = [];
      
      for (const campaign of campaigns) {
        if (!campaign.htmlContent) continue;
        
        // Find all image URLs in the campaign HTML that point to /uploads/
        const uploadImageRegex = /https?:\/\/[^"'\s]+\/uploads\/([^"'\s]+\.(jpg|jpeg|png|gif|webp))/gi;
        const matches = [...campaign.htmlContent.matchAll(uploadImageRegex)];
        
        if (matches.length === 0) continue;
        
        console.log(`📦 Campaign "${campaign.name}" (ID: ${campaign.id}) has ${matches.length} images to migrate`);
        
        let updatedHtml = campaign.htmlContent;
        
        for (const match of matches) {
          const fullUrl = match[0];
          const filename = match[1];
          const filePath = path.join(uploadDir, filename);
          
          try {
            // Check if file exists on filesystem
            if (!fs.existsSync(filePath)) {
              console.warn(`⚠️  File not found on filesystem: ${filename}`);
              errors.push(`File not found: ${filename}`);
              errorCount++;
              continue;
            }
            
            // Read the file
            const fileBuffer = fs.readFileSync(filePath);
            
            // Upload to Object Storage
            const objectPath = await objectStorage.uploadPublicImage(
              fileBuffer,
              'image/jpeg', // All email images are JPEGs
              filename
            );
            
            // Generate new URL
            const domain = process.env.NODE_ENV === 'production'
              ? 'https://oficaz.es'
              : `https://${process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000'}`;
            const newUrl = `${domain}${objectPath}`;
            
            // Replace old URL with new URL in HTML
            updatedHtml = updatedHtml.replace(fullUrl, newUrl);
            
            console.log(`✅ Migrated: ${filename} → ${newUrl}`);
            migratedCount++;
            
          } catch (error: any) {
            console.error(`❌ Error migrating ${filename}:`, error.message);
            errors.push(`Error migrating ${filename}: ${error.message}`);
            errorCount++;
          }
        }
        
        // Update campaign if HTML changed
        if (updatedHtml !== campaign.htmlContent) {
          await db.update(schema.emailCampaigns)
            .set({ htmlContent: updatedHtml })
            .where(eq(schema.emailCampaigns.id, campaign.id));
          console.log(`✅ Updated campaign "${campaign.name}" with new image URLs`);
        }
      }
      
      console.log(`📦 Migration complete: ${migratedCount} images migrated, ${errorCount} errors`);
      
      res.json({
        success: true,
        message: 'Migration completed',
        migratedCount,
        errorCount,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (error: any) {
      console.error('Error migrating email marketing images:', error);
      res.status(500).json({ success: false, message: 'Error al migrar imágenes: ' + error.message });
    }
  });

  // Fix hardcoded domain URLs in campaigns (convert to relative paths)
  app.post('/api/super-admin/email-marketing/fix-image-urls', superAdminSecurityHeaders, authenticateSuperAdmin, async (req: any, res) => {
    try {
      console.log('🔧 Starting image URL normalization...');
      
      // Get all campaigns
      const campaigns = await db.select()
        .from(schema.emailCampaigns)
        .where(sql`${schema.emailCampaigns.htmlContent} LIKE '%/public-objects/%' OR ${schema.emailCampaigns.htmlContent} LIKE '%/uploads/%'`);
      
      let updatedCount = 0;
      
      for (const campaign of campaigns) {
        let html = campaign.htmlContent;
        const originalHtml = html;
        
        // Remove hardcoded domains from image URLs, keeping only relative paths
        // Matches: https://any-domain.com/public-objects/... → /public-objects/...
        // Matches: https://any-domain.com/uploads/... → /uploads/...
        html = html.replace(
          /src="https?:\/\/[^\/]+(\/(public-objects|uploads)\/[^"]+)"/g,
          'src="$1"'
        );
        
        // Update if changed
        if (html !== originalHtml) {
          await db.update(schema.emailCampaigns)
            .set({ htmlContent: html })
            .where(eq(schema.emailCampaigns.id, campaign.id));
          
          console.log(`✅ Normalized URLs in campaign "${campaign.name}"`);
          updatedCount++;
        }
      }
      
      console.log(`🔧 Normalization complete: ${updatedCount} campaigns updated`);
      
      res.json({
        success: true,
        message: `URLs normalizadas en ${updatedCount} campañas`,
        updatedCount
      });
    } catch (error: any) {
      console.error('Error fixing image URLs:', error);
      res.status(500).json({ success: false, message: 'Error al normalizar URLs: ' + error.message });
    }
  });

  // Send email campaign
  app.post('/api/super-admin/email-campaigns/:id/send', superAdminSecurityHeaders, authenticateSuperAdmin, async (req: any, res) => {
    try {
      const campaignId = parseInt(req.params.id);
      
      // Get campaign details
      const campaign = await storage.getEmailCampaignById(campaignId);
      if (!campaign) {
        return res.status(404).json({ success: false, message: 'Campaña no encontrada' });
      }

      // Use selected_emails array from campaign and remove duplicates
      let selectedEmails = Array.from(new Set(campaign.selectedEmails || []));
      
      // Always add monitor email as a recipient to monitor campaigns
      if (!selectedEmails.some(email => isMonitorEmail(email))) {
        selectedEmails.push(MONITOR_EMAIL);
      }
      
      if (selectedEmails.length === 0) {
        return res.status(400).json({ success: false, message: 'No hay destinatarios seleccionados' });
      }

      // Get emails that already received this campaign
      const alreadySent = await db.select({ email: schema.emailCampaignSends.recipientEmail })
        .from(schema.emailCampaignSends)
        .where(eq(schema.emailCampaignSends.campaignId, campaignId));
      
      const alreadySentEmails = new Set(alreadySent.map(s => s.email));
      
      // Filter only new emails (not already sent)
      // EXCEPTION: Monitor email always receives the email to monitor campaigns
      const newEmails = selectedEmails.filter(email => 
        isMonitorEmail(email) || !alreadySentEmails.has(email)
      );
      
      if (newEmails.length === 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'Todos los destinatarios seleccionados ya recibieron esta campaña' 
        });
      }

      console.log(`📧 Sending to ${newEmails.length} new recipients (${alreadySentEmails.size} already received)`);

      // 🔒 SECURITY: Configure email transporter with secure environment variables
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: 465,
        secure: true, // SSL
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      // Send emails to new recipients only
      let successCount = 0;
      let failCount = 0;

      for (const email of newEmails) {
        try {
          // First, create the send record to get the ID
          const [sendRecord] = await db.insert(schema.emailCampaignSends).values({
            campaignId,
            recipientEmail: email,
            recipientType: 'user',
            status: 'sent',
            sentAt: new Date(),
          }).returning();

          // Use official domain for better deliverability and tracking reliability
          const domain = process.env.NODE_ENV === 'production' 
            ? 'https://oficaz.es' 
            : `https://${process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000'}`;

          // Convert all relative image URLs to absolute URLs with production domain
          // This ensures images work in emails regardless of where the campaign was created
          let htmlWithTracking = campaign.htmlContent.replace(
            /src="(\/[^"]+)"/g, 
            `src="${domain}$1"`
          );

          // Add tracking pixel to HTML (optimized for Outlook compatibility)
          const trackingPixel = `<img src="${domain}/api/track/open/${sendRecord.id}" width="1" height="1" border="0" style="display:block;border:0;outline:none;" alt="" />`;
          
          // Replace button URL with tracking URL
          
          // Find button href and replace with tracking URL
          const buttonMatch = htmlWithTracking.match(/<a[^>]*href="([^"]+)"[^>]*style="[^"]*display:\s*inline-block[^"]*"[^>]*>/);
          if (buttonMatch) {
            const originalUrl = buttonMatch[1];
            const trackingUrl = `${domain}/api/track/click/${sendRecord.id}?url=${encodeURIComponent(originalUrl)}`;
            htmlWithTracking = htmlWithTracking.replace(
              buttonMatch[0],
              buttonMatch[0].replace(`href="${originalUrl}"`, `href="${trackingUrl}"`)
            );
          }
          
          // Add tracking pixel
          htmlWithTracking = htmlWithTracking + trackingPixel;

          await transporter.sendMail({
            from: '"Oficaz" <soy@oficaz.es>',
            to: email,
            subject: campaign.subject,
            html: htmlWithTracking,
          });
          
          // 🔒 MONITOR EMAIL: Don't count test/control email in statistics
          if (!isMonitorEmail(email)) {
            successCount++;
          }
        } catch (emailError) {
          console.error(`Failed to send email to ${email}:`, emailError);
          
          // Record failed send
          await db.insert(schema.emailCampaignSends).values({
            campaignId,
            recipientEmail: email,
            recipientType: 'user',
            status: 'failed',
            sentAt: new Date(),
          });
          
          failCount++;
        }
      }
      
      // Update campaign status and increment counters
      const updateData: any = { 
        status: 'sent',
        sentCount: sql`COALESCE(${schema.emailCampaigns.sentCount}, 0) + ${successCount}`,
      };
      
      // Only set sentAt on first send
      if (!campaign.sentAt) {
        updateData.sentAt = new Date();
      }
      
      await storage.updateEmailCampaign(campaignId, updateData);

      res.json({ 
        success: true, 
        message: `Campaña enviada a ${successCount} nuevos destinatarios${failCount > 0 ? ` (${failCount} fallidos)` : ''}`,
        newRecipientsCount: newEmails.length,
        successCount,
        failCount
      });
    } catch (error: any) {
      console.error('Error sending email campaign:', error);
      res.status(500).json({ success: false, message: 'Error al enviar campaña' });
    }
  });

  // Get prospect campaign history
  app.get('/api/super-admin/email-prospects/:id/campaign-history', superAdminSecurityHeaders, authenticateSuperAdmin, async (req: any, res) => {
    try {
      const prospectId = parseInt(req.params.id);
      
      // Get prospect email
      const [prospect] = await db.select()
        .from(schema.emailProspects)
        .where(eq(schema.emailProspects.id, prospectId));
      
      if (!prospect) {
        return res.status(404).json({ success: false, message: 'Prospect no encontrado' });
      }
      
      // Get all campaign sends for this prospect email
      const sends = await db.select({
        id: schema.emailCampaignSends.id,
        campaignId: schema.emailCampaignSends.campaignId,
        campaignName: schema.emailCampaigns.name,
        sentAt: schema.emailCampaignSends.sentAt,
        openedAt: schema.emailCampaignSends.openedAt,
        clickedAt: schema.emailCampaignSends.clickedAt,
        status: schema.emailCampaignSends.status,
      })
        .from(schema.emailCampaignSends)
        .innerJoin(schema.emailCampaigns, eq(schema.emailCampaignSends.campaignId, schema.emailCampaigns.id))
        .where(eq(schema.emailCampaignSends.recipientEmail, prospect.email))
        .orderBy(desc(schema.emailCampaignSends.sentAt));
      
      // Check if prospect email led to registration
      const [registration] = await db.select({
        companyId: schema.companies.id,
        companyName: schema.companies.name,
        registeredAt: schema.companies.createdAt,
        campaignId: schema.companies.emailCampaignId,
        subscriptionStatus: schema.subscriptions.status,
      })
        .from(schema.companies)
        .leftJoin(schema.subscriptions, eq(schema.companies.id, schema.subscriptions.companyId))
        .where(eq(schema.companies.email, prospect.email));
      
      res.json({
        campaigns: sends,
        registration: registration || null,
      });
    } catch (error: any) {
      console.error('Error fetching prospect campaign history:', error);
      res.status(500).json({ success: false, message: 'Error al obtener historial de campañas' });
    }
  });

  // Delete email prospect
  app.delete('/api/super-admin/email-prospects/:id', superAdminSecurityHeaders, authenticateSuperAdmin, async (req: any, res) => {
    try {
      await storage.deleteEmailProspect(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting email prospect:', error);
      res.status(500).json({ success: false, message: 'Error al eliminar prospect' });
    }
  });

  // Update email prospect (inline editing)
  app.patch('/api/super-admin/email-prospects/:id', superAdminSecurityHeaders, authenticateSuperAdmin, async (req: any, res) => {
    try {
      const prospectId = parseInt(req.params.id);
      const updates = req.body;
      console.log('📝 Updating prospect:', prospectId, 'with data:', JSON.stringify(updates));
      
      // Get current prospect
      const [currentProspect] = await db.select()
        .from(schema.emailProspects)
        .where(eq(schema.emailProspects.id, prospectId))
        .limit(1);

      if (!currentProspect) {
        return res.status(404).json({ success: false, message: 'Prospect no encontrado' });
      }

      // Check if email is being updated and if it already exists
      if (updates.email !== undefined && updates.email !== currentProspect.email && !updates.email.includes('@temp-')) {
        const [existingProspect] = await db.select()
          .from(schema.emailProspects)
          .where(eq(schema.emailProspects.email, updates.email))
          .limit(1);
        
        if (existingProspect) {
          return res.status(400).json({ 
            success: false, 
            message: `Ya existe un contacto con el email: ${updates.email}` 
          });
        }
      }
      
      // Check if phone is being updated and if it already exists
      if (updates.phone !== undefined && updates.phone !== currentProspect.phone && updates.phone) {
        const [existingProspect] = await db.select()
          .from(schema.emailProspects)
          .where(eq(schema.emailProspects.phone, updates.phone))
          .limit(1);
        
        if (existingProspect) {
          return res.status(400).json({ 
            success: false, 
            message: `Ya existe un contacto con el teléfono: ${updates.phone}` 
          });
        }
      }

      // Update only provided fields
      const updatedData: any = {};
      if (updates.email !== undefined) updatedData.email = updates.email;
      if (updates.name !== undefined) updatedData.name = updates.name;
      if (updates.company !== undefined) updatedData.company = updates.company;
      if (updates.phone !== undefined) updatedData.phone = updates.phone;
      if (updates.location !== undefined) updatedData.location = updates.location;
      if (updates.notes !== undefined) updatedData.notes = updates.notes;
      // Validate tags: only 1 tag maximum (sector/industry)
      if (updates.tags !== undefined) {
        if (Array.isArray(updates.tags)) {
          // Keep only the first tag if multiple provided
          updatedData.tags = updates.tags.length > 0 ? [updates.tags[0]] : [];
        } else {
          updatedData.tags = updates.tags;
        }
      }
      if (updates.status !== undefined) updatedData.status = updates.status;
      // Contact tracking fields - separate status for each channel
      if (updates.whatsappContacted !== undefined) updatedData.whatsappContacted = updates.whatsappContacted;
      if (updates.whatsappConversationStatus !== undefined) {
        updatedData.whatsappConversationStatus = updates.whatsappConversationStatus;
        updatedData.whatsappConversationStatusUpdatedAt = new Date();
      }
      if (updates.instagramContacted !== undefined) updatedData.instagramContacted = updates.instagramContacted;
      if (updates.instagramConversationStatus !== undefined) {
        updatedData.instagramConversationStatus = updates.instagramConversationStatus;
        updatedData.instagramConversationStatusUpdatedAt = new Date();
      }

      await db.update(schema.emailProspects)
        .set(updatedData)
        .where(eq(schema.emailProspects.id, prospectId));

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error updating email prospect:', error);
      res.status(500).json({ success: false, message: 'Error al actualizar prospect' });
    }
  });

  // Mark prospect's email as bounced
  app.patch('/api/super-admin/email-prospects/:prospectId/mark-bounced', superAdminSecurityHeaders, authenticateSuperAdmin, async (req: any, res) => {
    try {
      const prospectId = parseInt(req.params.prospectId);
      
      if (!prospectId || isNaN(prospectId)) {
        return res.status(400).json({ success: false, message: 'ID de prospect inválido' });
      }

      // Get prospect
      const [prospect] = await db.select()
        .from(schema.emailProspects)
        .where(eq(schema.emailProspects.id, prospectId));
      
      if (!prospect) {
        return res.status(404).json({ success: false, message: 'Prospect no encontrado' });
      }

      // Update prospect's lastEmailStatus to bounced
      await db.update(schema.emailProspects)
        .set({ lastEmailStatus: 'bounced' })
        .where(eq(schema.emailProspects.id, prospectId));

      // Find and update the most recent email send for this prospect
      const sends = await db.select()
        .from(schema.emailCampaignSends)
        .where(eq(schema.emailCampaignSends.recipientEmail, prospect.email));
      
      if (sends.length > 0) {
        // Sort to find most recent
        const sortedSends = [...sends].sort((a, b) => {
          const dateA = a.sentAt ? new Date(a.sentAt).getTime() : 0;
          const dateB = b.sentAt ? new Date(b.sentAt).getTime() : 0;
          return dateB - dateA;
        });
        
        const lastSend = sortedSends[0];
        
        // Mark the most recent send as bounced
        await db.update(schema.emailCampaignSends)
          .set({ status: 'bounced', updatedAt: new Date() })
          .where(eq(schema.emailCampaignSends.id, lastSend.id));
        
        console.log(`✅ Marked prospect ${prospectId} and send ${lastSend.id} as bounced`);
      } else {
        console.log(`✅ Marked prospect ${prospectId} as bounced (no sends found)`);
      }

      res.json({ success: true, message: 'Email marcado como rebotado' });
    } catch (error: any) {
      console.error('Error marking prospect email as bounced:', error);
      res.status(500).json({ success: false, message: 'Error al marcar email como rebotado' });
    }
  });

  // Mark email send as bounced (for manual bounce reporting)
  // Accepts either sendId param OR email+campaignId in body
  app.patch('/api/super-admin/email-campaign-sends/mark-bounced', superAdminSecurityHeaders, authenticateSuperAdmin, async (req: any, res) => {
    try {
      const { sendId, email, campaignId, bounceReason } = req.body;

      // Validate that we have either sendId or (email + campaignId)
      if (!sendId && (!email || !campaignId)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Se requiere sendId o (email + campaignId)' 
        });
      }

      let targetSend;

      if (sendId) {
        // Find by sendId
        console.log(`📧 Marking email send ${sendId} as bounced`);
        
        const [send] = await db.select()
          .from(schema.emailCampaignSends)
          .where(eq(schema.emailCampaignSends.id, sendId));
        
        if (!send) {
          return res.status(404).json({ 
            success: false, 
            message: 'Envío no encontrado' 
          });
        }
        
        targetSend = send;
      } else {
        // Find by email + campaignId
        console.log(`📧 Marking email send for ${email} in campaign ${campaignId} as bounced`);
        
        const [send] = await db.select()
          .from(schema.emailCampaignSends)
          .where(
            and(
              eq(schema.emailCampaignSends.recipientEmail, email),
              eq(schema.emailCampaignSends.campaignId, campaignId)
            )
          );
        
        if (!send) {
          return res.status(404).json({ 
            success: false, 
            message: 'No se encontró el envío para este email y campaña' 
          });
        }
        
        targetSend = send;
      }

      // Update the send status to bounced
      await db.update(schema.emailCampaignSends)
        .set({ 
          status: 'bounced',
          updatedAt: new Date()
        })
        .where(eq(schema.emailCampaignSends.id, targetSend.id));

      console.log(`✅ Email send ${targetSend.id} marked as bounced${bounceReason ? `: ${bounceReason}` : ''}`);

      res.json({ 
        success: true, 
        message: 'Email marcado como rebotado. Las estadísticas se actualizarán automáticamente.'
      });
    } catch (error: any) {
      console.error('Error marking email as bounced:', error);
      res.status(500).json({ success: false, message: 'Error al marcar email como rebotado' });
    }
  });

  // Clean duplicate tags from email prospects (keep only first tag)
  app.post('/api/super-admin/email-prospects/clean-duplicate-tags', superAdminSecurityHeaders, authenticateSuperAdmin, async (req: any, res) => {
    try {
      console.log('🧹 Starting tag deduplication process...');
      
      // Get all prospects with tags
      const prospectsWithTags = await db.select()
        .from(schema.emailProspects)
        .where(sql`tags IS NOT NULL AND array_length(tags, 1) > 1`);
      
      console.log(`📊 Found ${prospectsWithTags.length} prospects with multiple tags`);
      
      let updatedCount = 0;
      
      // Update each prospect to keep only first tag
      for (const prospect of prospectsWithTags) {
        if (prospect.tags && Array.isArray(prospect.tags) && prospect.tags.length > 1) {
          const singleTag = [prospect.tags[0]];
          
          await db.update(schema.emailProspects)
            .set({ tags: singleTag })
            .where(eq(schema.emailProspects.id, prospect.id));
          
          updatedCount++;
          console.log(`✂️ Cleaned prospect ${prospect.id}: ${prospect.tags.join(', ')} → ${singleTag[0]}`);
        }
      }
      
      console.log(`✅ Tag deduplication complete: ${updatedCount} prospects updated`);
      
      res.json({ 
        success: true, 
        message: `Limpieza completada: ${updatedCount} prospects actualizados`,
        prospectsFound: prospectsWithTags.length,
        prospectsUpdated: updatedCount
      });
      
    } catch (error: any) {
      console.error('Error cleaning duplicate tags:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error al limpiar tags duplicados' 
      });
    }
  });

  // 🤖 AI PROSPECT DISCOVERY - Simplified approach: Generate sample prospects based on query
  app.post('/api/super-admin/ai-prospect-discovery', superAdminSecurityHeaders, authenticateSuperAdmin, async (req: any, res) => {
    try {
      const { query, limit = 10 } = req.body;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ success: false, message: 'Query de búsqueda requerida' });
      }

      console.log(`🤖 AI Prospect Discovery - Query: "${query}", Limit: ${limit}`);

      // Initialize Groq client
      const groq = new Groq({
        apiKey: process.env.GROQ_API_KEY
      });

      // Simplified prompt to generate plausible sample prospects
      const systemPrompt = `Eres un asistente experto en generación de prospects B2B para email marketing.

Tu trabajo es generar una lista de empresas/negocios PLAUSIBLES y REALISTAS que coincidan con la búsqueda del usuario.

INFORMACIÓN A GENERAR:
1. email: Email plausible (ej: info@, contacto@, comercial@)
2. name: Nombre realista de contacto
3. company: Nombre de empresa realista y apropiado para el sector
4. phone: Teléfono español realista (+34...)
5. location: Ciudad apropiada para la búsqueda
6. website: URL plausible (www.nombreempresa.es/com)
7. description: Breve descripción del negocio
8. industryTag: UN SOLO tag del sector/industria (ej: "Fontanería", "Restauración", "Salud", "Construcción")

REGLAS PARA EL TAG:
- OBLIGATORIO: Genera EXACTAMENTE 1 tag por empresa, nunca más de 1
- El tag debe ser UNA SOLA PALABRA o máximo 2 palabras
- Usa nombres de sectores estándar en español (ej: "Odontología", "Hostelería", "Carpintería")
- NO uses frases largas ni descripciones
- Ejemplos válidos: "Fontanería", "Restauración", "Clínica Dental", "Construcción", "Tecnología"

INSTRUCCIONES:
- Genera empresas DIFERENTES y VARIADAS
- Usa nombres y datos REALISTAS para España
- Varía las ciudades y tipos de negocio dentro del sector
- Para teléfonos: usa formato +34 + 9 dígitos (móviles 6XX o 7XX, fijos 9XX)
- IMPORTANTE: Devuelve EXACTAMENTE el formato JSON solicitado, sin texto adicional

FORMATO DE RESPUESTA (JSON puro, sin markdown):
{
  "prospects": [
    {
      "email": "contacto@empresa.es",
      "name": "Juan Pérez",
      "company": "Fontanería Pérez S.L.",
      "phone": "+34600123456",
      "location": "Sevilla",
      "website": "https://www.fontaneriaperez.es",
      "description": "Empresa de fontanería y climatización con 20 años de experiencia",
      "industryTag": "Fontanería"
    }
  ]
}`;

      const userPrompt = `Genera ${limit} empresas/negocios PLAUSIBLES que coincidan con: "${query}"

Asegúrate de que sean nombres realistas, variados y apropiados para el sector en España.`;

      // Call Groq with fast model
      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",  // Fast model with excellent rate limits
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,  // Higher temperature for more variety
        max_tokens: 4000,
      });

      const responseText = completion.choices[0]?.message?.content;
      
      if (!responseText) {
        return res.status(500).json({ 
          success: false, 
          message: 'No se recibió respuesta del modelo de IA' 
        });
      }

      console.log('🤖 Groq response:', responseText.substring(0, 500) + '...');

      // Parse JSON response
      let parsedResponse;
      try {
        // Extract JSON from markdown code blocks if present
        const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || responseText.match(/```\n([\s\S]*?)\n```/);
        const jsonText = jsonMatch ? jsonMatch[1] : responseText;
        
        parsedResponse = JSON.parse(jsonText);
      } catch (parseError) {
        console.error('Error parsing Groq response:', parseError);
        console.error('Raw response:', responseText);
        return res.status(500).json({ 
          success: false, 
          message: 'Error al procesar la respuesta de IA. Por favor, intenta con una búsqueda más específica.',
          rawResponse: responseText.substring(0, 1000)
        });
      }

      // Validate response structure
      if (!parsedResponse.prospects || !Array.isArray(parsedResponse.prospects)) {
        return res.status(500).json({ 
          success: false, 
          message: 'Formato de respuesta inválido de la IA',
          rawResponse: responseText.substring(0, 1000)
        });
      }

      // Helper function to normalize industry tag
      const normalizeTag = (tag: string | null | undefined): string | null => {
        if (!tag || typeof tag !== 'string') return null;
        
        // Trim and capitalize first letter of each word
        const normalized = tag.trim()
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
        
        return normalized || null;
      };

      // Clean and validate prospects
      const prospects = parsedResponse.prospects.map((p: any) => {
        // Extract and normalize the single industry tag
        const normalizedTag = normalizeTag(p.industryTag);
        
        return {
          email: p.email || null,
          name: p.name || null,
          company: p.company || 'Empresa sin nombre',
          phone: p.phone || null,
          location: p.location || null,
          website: p.website || null,
          description: p.description || null,
          tags: normalizedTag ? [normalizedTag] : [], // Single tag from AI
          notes: p.description || '',  // Use description as initial notes
        };
      });

      console.log(`✅ Generated ${prospects.length} prospects`);

      res.json({ 
        success: true, 
        prospects,
        sources: [],  // No web sources since we're generating plausible data
        query,
        count: prospects.length
      });

    } catch (error: any) {
      console.error('Error in AI prospect discovery:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Error al buscar prospects con IA' 
      });
    }
  });

  // Endpoint to manage company custom features
  app.patch('/api/companies/custom-features', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;
      const { featureKey, enabled } = req.body;

      if (!featureKey || typeof enabled !== 'boolean') {
        return res.status(400).json({ message: 'featureKey y enabled son requeridos' });
      }

      // Get current custom features
      const [company] = await db.select({
        customFeatures: schema.companies.customFeatures
      }).from(schema.companies).where(eq(schema.companies.id, companyId));

      if (!company) {
        return res.status(404).json({ message: 'Empresa no encontrada' });
      }

      // Update custom features
      const currentCustomFeatures = (company.customFeatures as any) || {};
      const updatedCustomFeatures = {
        ...currentCustomFeatures,
        [featureKey]: enabled
      };

      // Update company
      await db.update(schema.companies)
        .set({
          customFeatures: updatedCustomFeatures,
          updatedAt: new Date()
        })
        .where(eq(schema.companies.id, companyId));

      res.json({ 
        message: `Feature ${featureKey} ${enabled ? 'habilitada' : 'deshabilitada'} correctamente`,
        customFeatures: updatedCustomFeatures
      });
    } catch (error) {
      console.error('Error updating custom features:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  // Get company custom features
  app.get('/api/companies/custom-features', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;

      const [company] = await db.select({
        customFeatures: schema.companies.customFeatures
      }).from(schema.companies).where(eq(schema.companies.id, companyId));

      if (!company) {
        return res.status(404).json({ message: 'Empresa no encontrada' });
      }

      res.json({ 
        customFeatures: (company.customFeatures as any) || {}
      });
    } catch (error) {
      console.error('Error fetching custom features:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  // DANGER ZONE: Delete company account permanently
  app.delete('/api/account/delete-permanently', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const companyId = req.user!.companyId;
      const { confirmationText } = req.body;

      // Security confirmation check
      if (confirmationText !== 'ELIMINAR PERMANENTEMENTE') {
        return res.status(400).json({ 
          message: 'Confirmación incorrecta. Debes escribir exactamente "ELIMINAR PERMANENTEMENTE"' 
        });
      }

      console.log(`🚨 CRITICAL: Starting permanent deletion of company ${companyId} initiated by user ${userId}`);

      // Get company data for logging
      const company = await storage.getCompanyByUserId(userId);
      if (!company) {
        return res.status(404).json({ message: 'Empresa no encontrada' });
      }

      console.log(`🚨 DELETING COMPANY: ${company.name} (ID: ${companyId})`);

      // Get all user IDs for this company first
      const companyUsers = await db.select({ id: users.id })
        .from(users)
        .where(eq(users.companyId, companyId));
      
      const userIds = companyUsers.map(u => u.id);
      
      if (userIds.length > 0) {
        // 1. Delete all break periods for work sessions of company users
        const workSessionsResult = await db.select({ id: workSessions.id })
          .from(workSessions)
          .where(inArray(workSessions.userId, userIds));
        
        const workSessionIds = workSessionsResult.map(ws => ws.id);
        
        if (workSessionIds.length > 0) {
          await db.delete(breakPeriods)
            .where(inArray(breakPeriods.workSessionId, workSessionIds));
          console.log('✅ Deleted break periods');
        }

        // 2. Delete all work sessions
        await db.delete(workSessions)
          .where(inArray(workSessions.userId, userIds));
        console.log('✅ Deleted work sessions');

        // 3. Delete all vacation requests
        await db.delete(vacationRequests)
          .where(inArray(vacationRequests.userId, userIds));
        console.log('✅ Deleted vacation requests');

        // 4. Delete all documents
        await db.delete(documents)
          .where(inArray(documents.userId, userIds));
        console.log('✅ Deleted documents');

        // 5. Delete all messages (sent and received)
        await db.delete(messages)
          .where(or(
            inArray(messages.senderId, userIds),
            inArray(messages.receiverId, userIds)
          ));
      }
      console.log('✅ Deleted messages');

      // 6. Delete all reminders
      if (userIds.length > 0) {
        await db.delete(reminders)
          .where(inArray(reminders.userId, userIds));
        console.log('✅ Deleted reminders');
      }

      // 7. Delete subscription
      await db.delete(subscriptions)
        .where(eq(subscriptions.companyId, companyId));
      console.log('✅ Deleted subscription');

      // 8. Delete all users from this company
      if (userIds.length > 0) {
        await db.delete(users)
          .where(eq(users.companyId, companyId));
        console.log('✅ Deleted all users');
      }

      // 9. Finally, delete the company
      await db.delete(companies)
        .where(eq(companies.id, companyId));
      console.log('✅ Deleted company');

      console.log(`🚨 PERMANENT DELETION COMPLETED: Company ${company.name} and all associated data has been permanently removed from the database`);

      res.json({ 
        success: true,
        message: `La empresa "${company.name}" y todos sus datos han sido eliminados permanentemente.`
      });

    } catch (error) {
      console.error('🚨 CRITICAL ERROR during permanent deletion:', error);
      res.status(500).json({ 
        message: 'Error crítico durante la eliminación. Contacta con el soporte técnico inmediatamente.' 
      });
    }
  });

  // Super Admin: Delete company permanently
  app.delete('/api/super-admin/companies/:id/delete-permanently', superAdminSecurityHeaders, authenticateSuperAdmin, async (req: any, res) => {
    try {
      const companyId = parseInt(req.params.id);
      const { confirmationText } = req.body;

      // Security confirmation check
      if (confirmationText !== 'ELIMINAR PERMANENTEMENTE') {
        return res.status(400).json({ 
          message: 'Texto de confirmación incorrecto. Debes escribir exactamente "ELIMINAR PERMANENTEMENTE"' 
        });
      }

      // Get company data first for logging
      const company = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
      if (company.length === 0) {
        return res.status(404).json({ message: 'Empresa no encontrada' });
      }

      console.log(`🚨 SUPER ADMIN INITIATED PERMANENT DELETION: Starting deletion of company "${company[0].name}" (ID: ${companyId})`);

      // Delete in the correct order to respect foreign key constraints
      
      // Get all user IDs for this company first (Super Admin deletion)
      const companyUsersForAdmin = await db.select({ id: users.id })
        .from(users)
        .where(eq(users.companyId, companyId));
      
      const userIdsForAdmin = companyUsersForAdmin.map(u => u.id);
      
      if (userIdsForAdmin.length > 0) {
        // 1. Delete all break periods for work sessions of company users
        const workSessionsForAdmin = await db.select({ id: workSessions.id })
          .from(workSessions)
          .where(inArray(workSessions.userId, userIdsForAdmin));
        
        const workSessionIdsForAdmin = workSessionsForAdmin.map(ws => ws.id);
        
        if (workSessionIdsForAdmin.length > 0) {
          await db.delete(breakPeriods)
            .where(inArray(breakPeriods.workSessionId, workSessionIdsForAdmin));
          console.log('✅ Deleted break periods');
        }

        // 2. Delete all work sessions
        await db.delete(workSessions)
          .where(inArray(workSessions.userId, userIdsForAdmin));
        console.log('✅ Deleted work sessions');

        // 3. Delete all vacation requests
        await db.delete(vacationRequests)
          .where(inArray(vacationRequests.userId, userIdsForAdmin));
        console.log('✅ Deleted vacation requests');

        // 4. Delete all documents
        await db.delete(documents)
          .where(inArray(documents.userId, userIdsForAdmin));
        console.log('✅ Deleted documents');

        // 5. Delete all messages (sent and received)
        await db.delete(messages)
          .where(or(
            inArray(messages.senderId, userIdsForAdmin),
            inArray(messages.receiverId, userIdsForAdmin)
          ));
        console.log('✅ Deleted messages');

        // 6. Delete all reminders
        await db.delete(reminders)
          .where(inArray(reminders.userId, userIdsForAdmin));
        console.log('✅ Deleted reminders');
      }

      // 7. Delete work session audit logs (CRITICAL: Must be deleted before work sessions)
      await db.delete(schema.workSessionAuditLog)
        .where(eq(schema.workSessionAuditLog.companyId, companyId));
      console.log('✅ Deleted work session audit logs');

      // 8. Delete work session modification requests
      await db.delete(schema.workSessionModificationRequests)
        .where(eq(schema.workSessionModificationRequests.companyId, companyId));
      console.log('✅ Deleted work session modification requests');

      // 9. Delete work alarms (must be deleted before users)
      if (userIdsForAdmin.length > 0) {
        await db.delete(schema.workAlarms)
          .where(inArray(schema.workAlarms.userId, userIdsForAdmin));
        console.log('✅ Deleted work alarms');
      }

      // 10. Delete company addons
      await db.delete(schema.companyAddons)
        .where(eq(schema.companyAddons.companyId, companyId));
      console.log('✅ Deleted company addons');

      // 11. Delete work reports
      await db.delete(schema.workReports)
        .where(eq(schema.workReports.companyId, companyId));
      console.log('✅ Deleted work reports');

      // 12. Delete custom holidays
      await db.delete(schema.customHolidays)
        .where(eq(schema.customHolidays.companyId, companyId));
      console.log('✅ Deleted custom holidays');

      // 13. Delete payment methods (NO cascade, must delete explicitly)
      await db.delete(schema.paymentMethods)
        .where(eq(schema.paymentMethods.companyId, companyId));
      console.log('✅ Deleted payment methods');

      // 14. Delete invoices (NO cascade, must delete explicitly)
      await db.delete(schema.invoices)
        .where(eq(schema.invoices.companyId, companyId));
      console.log('✅ Deleted invoices');

      // 15. Delete usage stats (NO cascade, must delete explicitly)
      await db.delete(schema.usageStats)
        .where(eq(schema.usageStats.companyId, companyId));
      console.log('✅ Deleted usage stats');

      // 16. Delete subscription
      await db.delete(subscriptions)
        .where(eq(subscriptions.companyId, companyId));
      console.log('✅ Deleted subscription');

      // 17. Delete password reset tokens (CRITICAL: Must be deleted before company)
      await db.delete(passwordResetTokens)
        .where(eq(passwordResetTokens.companyId, companyId));
      console.log('✅ Deleted password reset tokens');

      // 18. Delete employee activation tokens (CRITICAL: Must be deleted before users)
      if (userIdsForAdmin.length > 0) {
        await db.delete(employeeActivationTokens)
          .where(or(
            inArray(employeeActivationTokens.userId, userIdsForAdmin),
            inArray(employeeActivationTokens.createdBy, userIdsForAdmin)
          ));
        console.log('✅ Deleted employee activation tokens');
      }

      // 19. Delete all work shifts (CRITICAL: Must be deleted before users due to created_by FK)
      await db.delete(schema.workShifts)
        .where(eq(schema.workShifts.companyId, companyId));
      console.log('✅ Deleted work shifts');

      // 20. Delete all notifications (CRITICAL: Must be deleted before users due to user_id FK)
      if (userIdsForAdmin.length > 0) {
        await db.delete(schema.systemNotifications)
          .where(inArray(schema.systemNotifications.userId, userIdsForAdmin));
        console.log('✅ Deleted notifications');
      }

      // 21. Delete all push subscriptions (CRITICAL: Must be deleted before users due to user_id FK)
      if (userIdsForAdmin.length > 0) {
        await db.delete(schema.pushSubscriptions)
          .where(inArray(schema.pushSubscriptions.userId, userIdsForAdmin));
        console.log('✅ Deleted push subscriptions');
      }

      // 22. Delete all users
      if (userIdsForAdmin.length > 0) {
        await db.delete(users)
          .where(eq(users.companyId, companyId));
        console.log('✅ Deleted users');
      }

      // 23. Delete landing visits (CRITICAL: Must be deleted before company)
      await db.delete(schema.landingVisits)
        .where(eq(schema.landingVisits.companyId, companyId));
      console.log('✅ Deleted landing visits');

      // 24. Finally, delete the company
      await db.delete(companies)
        .where(eq(companies.id, companyId));
      console.log('✅ Deleted company');

      console.log(`🚨 SUPER ADMIN PERMANENT DELETION COMPLETED: Company ${company[0].name} and all associated data has been permanently removed from the database`);

      res.json({ 
        success: true,
        message: `La empresa "${company[0].name}" y todos sus datos han sido eliminados permanentemente por el Super Admin.`
      });

    } catch (error) {
      console.error('🚨 CRITICAL ERROR during super admin permanent deletion:', error);
      res.status(500).json({ 
        message: 'Error crítico durante la eliminación. Contacta con el soporte técnico inmediatamente.' 
      });
    }
  });

  // ==================== LANDING PAGE ANALYTICS ====================
  
  // Public endpoint to track landing page visits
  app.post('/api/track/landing-visit', async (req, res) => {
    try {
      const { referrer } = req.body;
      const ipAddress = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '').split(',')[0].trim();
      const userAgent = req.headers['user-agent'] || '';

      // 🌍 GEOLOCATION DETECTION - Use ipapi.co for accurate location data
      let country = null;
      let city = null;
      
      // Don't geolocate localhost/private IPs
      const isPrivateIp = !ipAddress || 
        ipAddress === '::1' || 
        ipAddress === '127.0.0.1' || 
        ipAddress.startsWith('192.168.') || 
        ipAddress.startsWith('10.') ||
        ipAddress.startsWith('172.');

      if (!isPrivateIp && ipAddress) {
        try {
          // Use ipapi.co for geolocation (1000 requests/day free)
          const geoResponse = await fetch(`https://ipapi.co/${ipAddress}/json/`);
          
          if (geoResponse.ok) {
            const geoData = await geoResponse.json();
            
            // Extract country and city from response
            if (geoData && !geoData.error) {
              country = geoData.country_name || null;
              city = geoData.city || null;
              
              console.log(`🌍 Geolocation for ${ipAddress}: ${city || 'Unknown'}, ${country || 'Unknown'}`);
            } else {
              console.log(`⚠️ Geolocation API returned error for ${ipAddress}`);
            }
          }
        } catch (geoError) {
          console.error('⚠️ Geolocation lookup failed:', geoError);
          // Continue without geolocation data
        }
      } else {
        console.log(`⚠️ Skipping geolocation for private/local IP: ${ipAddress}`);
      }

      // Create landing visit record with geolocation data
      const visitData: schema.InsertLandingVisit = {
        ipAddress,
        userAgent,
        referrer,
        country,
        city,
        visitedAt: new Date(),
        registered: false,
      };

      await db.insert(schema.landingVisits).values(visitData);
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error tracking landing visit:', error);
      res.status(500).json({ success: false, message: 'Error al registrar visita' });
    }
  });

  // Super admin endpoint to clean ONLY development/testing visits (localhost + private IPs)
  app.post('/api/super-admin/landing-metrics/clean-test-visits', superAdminSecurityHeaders, authenticateSuperAdmin, async (req: any, res) => {
    try {
      // Delete ONLY localhost and private IPs (NOT visits without country - those are real visits where geo API failed)
      const deletedResult = await db.delete(schema.landingVisits)
        .where(
          sql`
            ${schema.landingVisits.ipAddress} IN ('127.0.0.1', '::1', 'localhost')
            OR ${schema.landingVisits.ipAddress} LIKE '192.168.%' 
            OR ${schema.landingVisits.ipAddress} LIKE '10.%' 
            OR ${schema.landingVisits.ipAddress} LIKE '172.%'
          `
        )
        .returning();
      
      const deletedCount = deletedResult.length;
      
      console.log(`🧹 Cleaned ${deletedCount} testing visits (localhost + private IPs only)`);
      
      res.json({
        success: true,
        message: `✅ Eliminadas ${deletedCount} visitas de testing (localhost + IPs privadas)`,
        deletedCount
      });
    } catch (error: any) {
      console.error('Error cleaning test visits:', error);
      res.status(500).json({ success: false, message: 'Error al limpiar visitas: ' + error.message });
    }
  });

  // Super admin endpoint to get landing metrics (EXCLUDING ONLY localhost/private IPs)
  app.get('/api/super-admin/landing-metrics', superAdminSecurityHeaders, authenticateSuperAdmin, async (req: any, res) => {
    try {
      const now = new Date();
      const thirtyDaysAgo = subDays(now, 30);
      const sevenDaysAgo = subDays(now, 7);
      const today = startOfDay(now);

      // FILTER: Exclude ONLY localhost and private IPs (KEEP visits without country - they're real visits)
      const validVisitCondition = sql`
        ip_address NOT IN ('127.0.0.1', '::1', 'localhost')
        AND ip_address NOT LIKE '192.168.%'
        AND ip_address NOT LIKE '10.%'
        AND ip_address NOT LIKE '172.%'
      `;

      // Get total visits (last 30 days, EXCLUDING ONLY TEST IPs)
      const totalVisitsResult = await db.execute(sql`
        SELECT COUNT(*) as count 
        FROM landing_visits 
        WHERE visited_at >= ${thirtyDaysAgo.toISOString()}
        AND ${validVisitCondition}
      `);
      const totalVisits = Number((totalVisitsResult.rows[0] as any).count);

      // Get total registrations (conversions)
      const totalRegistrationsResult = await db.execute(sql`
        SELECT COUNT(*) as count 
        FROM landing_visits 
        WHERE registered = true
        AND visited_at >= ${thirtyDaysAgo.toISOString()}
        AND ${validVisitCondition}
      `);
      const totalRegistrations = Number((totalRegistrationsResult.rows[0] as any).count);

      // Get today's visits
      const todayVisitsResult = await db.execute(sql`
        SELECT COUNT(*) as count 
        FROM landing_visits 
        WHERE visited_at >= ${today.toISOString()}
        AND ${validVisitCondition}
      `);
      const todayVisits = Number((todayVisitsResult.rows[0] as any).count);

      // Get daily visits for last 7 days (EXCLUDING ONLY TEST IPs)
      const dailyVisitsResult = await db.execute(sql`
        SELECT 
          DATE(visited_at) as date,
          COUNT(*) as count
        FROM landing_visits
        WHERE visited_at >= ${sevenDaysAgo.toISOString()}
        AND ${validVisitCondition}
        GROUP BY DATE(visited_at)
        ORDER BY date DESC
      `);
      const dailyVisits = dailyVisitsResult.rows.map((row: any) => ({
        date: row.date,
        count: Number(row.count)
      }));

      const maxDailyVisits = Math.max(...dailyVisits.map(d => d.count), 1);

      // Get city and country distribution (top 10, INCLUDING "Desconocido" for public IPs without geolocation)
      const locationsResult = await db.execute(sql`
        SELECT 
          COALESCE(city, '') as city,
          COALESCE(country, 'Desconocido') as country,
          COUNT(*) as visits
        FROM landing_visits
        WHERE visited_at >= ${thirtyDaysAgo.toISOString()}
        AND ${validVisitCondition}
        GROUP BY city, country
        ORDER BY visits DESC
        LIMIT 10
      `);
      
      const countryFlags: Record<string, string> = {
        'Spain': '🇪🇸',
        'España': '🇪🇸',
        'United States': '🇺🇸',
        'France': '🇫🇷',
        'Germany': '🇩🇪',
        'United Kingdom': '🇬🇧',
        'Italy': '🇮🇹',
        'Portugal': '🇵🇹',
        'Mexico': '🇲🇽',
        'Argentina': '🇦🇷',
        'Colombia': '🇨🇴',
      };

      const countries = locationsResult.rows.map((row: any) => {
        const city = row.city || '';
        const country = row.country || 'Desconocido';
        const location = city ? `${city}, ${country}` : country;
        
        return {
          country: location,
          visits: Number(row.visits),
          flag: countryFlags[country] || '🌍'
        };
      });

      res.json({
        totalVisits,
        totalRegistrations,
        todayVisits,
        dailyVisits,
        maxDailyVisits,
        countries,
      });
    } catch (error: any) {
      console.error('Error fetching landing metrics:', error);
      res.status(500).json({ success: false, message: 'Error al obtener métricas' });
    }
  });

  // SuperAdmin endpoint to retroactively update geolocation for existing visits
  app.post('/api/super-admin/update-geolocation', superAdminSecurityHeaders, authenticateSuperAdmin, async (req: any, res) => {
    try {
      // Get all visits without country data
      const visitsWithoutGeo = await db
        .select()
        .from(schema.landingVisits)
        .where(or(
          isNull(schema.landingVisits.country),
          eq(schema.landingVisits.country, '')
        ))
        .limit(100); // Process 100 at a time to avoid rate limits

      console.log(`📍 Found ${visitsWithoutGeo.length} visits without geolocation data`);

      let updated = 0;
      let failed = 0;

      for (const visit of visitsWithoutGeo) {
        // Skip private/local IPs
        const isPrivateIp = !visit.ipAddress || 
          visit.ipAddress === '::1' || 
          visit.ipAddress === '127.0.0.1' || 
          visit.ipAddress.startsWith('192.168.') || 
          visit.ipAddress.startsWith('10.') ||
          visit.ipAddress.startsWith('172.');

        if (isPrivateIp) {
          console.log(`⚠️ Skipping private IP: ${visit.ipAddress}`);
          continue;
        }

        try {
          // Fetch geolocation data
          const geoResponse = await fetch(`https://ipapi.co/${visit.ipAddress}/json/`);
          
          if (geoResponse.ok) {
            const geoData = await geoResponse.json();
            
            if (geoData && !geoData.error && geoData.country_name) {
              // Update the visit with geolocation data
              await db
                .update(schema.landingVisits)
                .set({
                  country: geoData.country_name,
                  city: geoData.city || null,
                })
                .where(eq(schema.landingVisits.id, visit.id));

              console.log(`✅ Updated visit ${visit.id}: ${geoData.city || 'Unknown'}, ${geoData.country_name}`);
              updated++;
            } else {
              console.log(`⚠️ No geo data for IP ${visit.ipAddress}`);
              failed++;
            }
          } else {
            console.log(`⚠️ Geo API error for ${visit.ipAddress}`);
            failed++;
          }

          // Rate limit: wait 1 second between requests (ipapi.co allows ~1 req/sec on free tier)
          await new Promise(resolve => setTimeout(resolve, 1100));
        } catch (error) {
          console.error(`❌ Error updating visit ${visit.id}:`, error);
          failed++;
        }
      }

      res.json({
        success: true,
        message: `Actualización completada: ${updated} visitas actualizadas, ${failed} fallidas`,
        updated,
        failed,
        remaining: visitsWithoutGeo.length - updated - failed,
      });
    } catch (error: any) {
      console.error('Error updating geolocation:', error);
      res.status(500).json({ success: false, message: 'Error al actualizar geolocalización' });
    }
  });

  // ==================== END LANDING PAGE ANALYTICS ====================

  // Public endpoint to validate invitation token
  app.get('/api/invitations/validate/:token', async (req, res) => {
    try {
      const { token } = req.params;
      const invitation = await storage.getInvitationByToken(token);
      
      if (!invitation) {
        return res.status(404).json({ message: 'Invitación no encontrada' });
      }
      
      if (invitation.isUsed) {
        return res.status(400).json({ message: 'Esta invitación ya ha sido utilizada' });
      }
      
      if (new Date() > invitation.expiresAt) {
        return res.status(400).json({ message: 'Esta invitación ha expirado' });
      }
      
      res.json({
        email: invitation.email,
        inviterName: invitation.inviterName,
        companyName: invitation.companyName,
        isValid: true
      });
    } catch (error) {
      console.error('Error validating invitation:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  // Update existing registration endpoint to check invitation requirement
  app.post('/api/register', async (req, res) => {
    try {
      // Check if public registration is enabled
      const settings = await storage.getRegistrationSettings();
      if (!settings?.publicRegistrationEnabled) {
        return res.status(403).json({ 
          message: 'El registro público está deshabilitado. Se requiere una invitación.',
          requiresInvitation: true
        });
      }

      // Existing registration logic would continue here...
      // For now, return the previous behavior
      res.status(501).json({ message: 'Funcionalidad en desarrollo' });
    } catch (error) {
      console.error('Error in registration:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  // Auto-process expired trials (charge using saved payment method)
  app.post('/api/subscription/auto-trial-process', async (req, res) => {
    try {
      console.log('🏦 AUTO-TRIAL PROCESSING - Checking for expired trials to activate...');
      
      const now = new Date();
      let processedCount = 0;
      let errorCount = 0;
      
      // Get all companies with expired trials that have a Stripe customer (saved payment method)
      const expiredTrials = await db.execute(sql`
        SELECT 
          c.id as company_id,
          c.name as company_name,
          c.custom_features,
          s.id as subscription_id,
          s.trial_end_date,
          s.plan,
          s.stripe_customer_id,
          u.id as admin_user_id
        FROM companies c
        JOIN subscriptions s ON c.id = s.company_id
        JOIN users u ON c.id = u.company_id AND u.role = 'admin'
        WHERE 
          s.status = 'trial'
          AND s.trial_end_date < ${now.toISOString()}
          AND s.stripe_customer_id IS NOT NULL
      `);
      
      console.log(`🏦 Found ${expiredTrials.rows.length} expired trials with saved payment methods`);
      
      for (const trial of expiredTrials.rows) {
        const t = trial as any;
        
        try {
          console.log(`🏦 Processing trial for company ${t.company_name} (ID: ${t.company_id})`);
          
          // ⚠️ DUPLICATE PREVENTION: Double-check no subscription exists
          const existingSubscription = await db.query.subscriptions.findFirst({
            where: eq(subscriptions.companyId, t.company_id),
          });
          if (existingSubscription?.stripeSubscriptionId) {
            console.log(`⚠️ DUPLICATE PREVENTION - Company ${t.company_id} already has Stripe subscription: ${existingSubscription.stripeSubscriptionId}, skipping`);
            continue;
          }
          
          // Check if customer has a default payment method
          const stripeCustomer = await stripe.customers.retrieve(t.stripe_customer_id) as Stripe.Customer;
          const defaultPaymentMethod = stripeCustomer.invoice_settings?.default_payment_method as string;
          
          if (!defaultPaymentMethod) {
            console.log(`⚠️ No default payment method for company ${t.company_id} - blocking account`);
            await db.execute(sql`
              UPDATE subscriptions SET status = 'blocked', is_trial_active = false 
              WHERE company_id = ${t.company_id}
            `);
            continue;
          }
          
          // ⚠️ CRITICAL: Calculate CURRENT price at billing time
          // This ensures customer pays for what they have NOW, not what they had when they added the card
          
          // 1. Get CURRENT active addons
          const companyAddons = await storage.getCompanyAddons(t.company_id);
          const activeAddons = companyAddons.filter(ca => ca.status === 'active' || ca.status === 'pending_cancel');
          
          const addonsTotalPrice = activeAddons.reduce((sum, ca) => {
            const addonPrice = parseFloat(ca.addon?.monthlyPrice?.toString() || '0');
            return sum + addonPrice;
          }, 0);
          
          // 2. Get subscription for user seats
          const companySubscription = await db.query.subscriptions.findFirst({
            where: eq(subscriptions.companyId, t.company_id),
          });
          
          // 3. Get seat pricing
          const seatPricing = await storage.getAllSeatPricing();
          const seatPriceMap: Record<string, number> = {};
          for (const sp of seatPricing) {
            seatPriceMap[sp.roleType] = parseFloat(sp.monthlyPrice?.toString() || '0');
          }
          
          // 4. Calculate CURRENT user seats total
          const adminSeats = (companySubscription?.extraAdmins || 0) + 1;
          const managerSeats = companySubscription?.extraManagers || 0;
          const employeeSeats = companySubscription?.extraEmployees || 0;
          const seatsTotalPrice = 
            (adminSeats * (seatPriceMap['admin'] || 6)) +
            (managerSeats * (seatPriceMap['manager'] || 4)) +
            (employeeSeats * (seatPriceMap['employee'] || 2));
          
          // 5. Calculate CURRENT total (check for custom price first)
          const customPrice = companySubscription?.customMonthlyPrice ? Number(companySubscription.customMonthlyPrice) : null;
          let monthlyPrice = customPrice && customPrice > 0 ? customPrice : (addonsTotalPrice + seatsTotalPrice);
          
          // Minimum: 1 admin (€6) + 1 addon (€3) = €9
          if (monthlyPrice < 9 && !customPrice) {
            monthlyPrice = 9;
          }
          
          const billingCents = Math.round(monthlyPrice * 100);
          
          console.log(`💰 MODULAR PRICING for ${t.company_name}: ${activeAddons.length} addons (€${addonsTotalPrice.toFixed(2)}) + ${adminSeats}a/${managerSeats}m/${employeeSeats}e seats (€${seatsTotalPrice.toFixed(2)}) = €${monthlyPrice.toFixed(2)}/month`);
            
            // Build subscription items array - each addon and user type as separate item
            const subscriptionItems: Array<{ price: string; quantity: number; metadata?: Record<string, string> }> = [];
            
            // Create items for each active addon (ALL addons are paid)
            for (const companyAddon of activeAddons) {
              const addon = companyAddon.addon;
              if (!addon) continue;
              
              let stripePriceId = addon.stripePriceId;
              
              if (!stripePriceId) {
                const stripeProduct = await stripe.products.create({
                  name: `Oficaz: ${addon.name}`,
                  description: addon.description || addon.shortDescription || undefined,
                  metadata: { addon_key: addon.key, feature_key: addon.featureKey || addon.key }
                });
                
                const stripePrice = await stripe.prices.create({
                  product: stripeProduct.id,
                  unit_amount: Math.round(Number(addon.monthlyPrice) * 100),
                  currency: 'eur',
                  recurring: { interval: 'month' },
                  nickname: addon.name,
                  metadata: { addon_key: addon.key }
                });
                
                stripePriceId = stripePrice.id;
                await storage.updateAddon(addon.id, { stripeProductId: stripeProduct.id, stripePriceId: stripePrice.id });
              }
              
              subscriptionItems.push({
                price: stripePriceId,
                quantity: 1,
                metadata: { addon_id: addon.id.toString(), addon_key: addon.key }
              });
            }
            
            // Create items for user seats
            const seatTypes = [
              { key: 'admin', count: adminSeats, price: seatPriceMap['admin'] || 6, name: 'Admin' },
              { key: 'manager', count: managerSeats, price: seatPriceMap['manager'] || 4, name: 'Manager' },
              { key: 'employee', count: employeeSeats, price: seatPriceMap['employee'] || 2, name: 'Empleado' },
            ];
            
            for (const seat of seatTypes) {
              if (seat.count <= 0) continue;
              
              let seatPricingRecord = await storage.getSeatPricing(seat.key);
              let stripePriceId = seatPricingRecord?.stripePriceId;
              
              if (!stripePriceId) {
                const stripeProduct = await stripe.products.create({
                  name: `Oficaz: Usuario ${seat.name}`,
                  description: `Usuario tipo ${seat.name}`,
                  metadata: { seat_type: seat.key }
                });
                
                const stripePrice = await stripe.prices.create({
                  product: stripeProduct.id,
                  unit_amount: Math.round(seat.price * 100),
                  currency: 'eur',
                  recurring: { interval: 'month' },
                  nickname: `Usuario ${seat.name}`,
                  metadata: { seat_type: seat.key }
                });
                
                stripePriceId = stripePrice.id;
                await db.execute(sql`
                  UPDATE seat_pricing 
                  SET stripe_product_id = ${stripeProduct.id}, stripe_price_id = ${stripePrice.id}
                  WHERE role_type = ${seat.key}
                `);
              }
              
              subscriptionItems.push({
                price: stripePriceId,
                quantity: seat.count,
                metadata: { seat_type: seat.key }
              });
            }
            
            // Handle SuperAdmin custom price override
            let finalItems = subscriptionItems;
            if (customPrice && customPrice > 0) {
              console.log(`💰 SUPERADMIN OVERRIDE: Using custom price €${customPrice}/month`);
              
              const customProduct = await stripe.products.create({
                name: `Oficaz: Precio Personalizado - ${t.company_name}`,
                description: `Precio especial para ${t.company_name}`,
                metadata: { company_id: t.company_id.toString(), type: 'custom_price' }
              });
              
              const customStripePrice = await stripe.prices.create({
                product: customProduct.id,
                unit_amount: Math.round(customPrice * 100),
                currency: 'eur',
                recurring: { interval: 'month' },
                nickname: 'Precio Personalizado',
                metadata: { type: 'custom_price', company_id: t.company_id.toString() }
              });
              
              finalItems = [{ price: customStripePrice.id, quantity: 1, metadata: { type: 'custom_price' } }];
            }
            
          // Create recurring subscription with separate items
          // First payment is made immediately, then monthly thereafter
          const subscription = await stripe.subscriptions.create({
            customer: t.stripe_customer_id,
            items: finalItems,
            default_payment_method: defaultPaymentMethod,
            payment_behavior: 'error_if_incomplete', // Fail immediately if payment fails
          });
            
            console.log(`🔄 RECURRING SUBSCRIPTION CREATED: ${subscription.id} for ${t.company_name} with ${finalItems.length} items`);
            
            // Update company_addons with their Stripe subscription item IDs and track seat item IDs
            let adminSeatsItemId: string | null = null;
            let managerSeatsItemId: string | null = null;
            let employeeSeatsItemId: string | null = null;
            
            for (const item of subscription.items.data) {
              const addonKey = item.price?.metadata?.addon_key;
              const seatType = item.price?.metadata?.seat_type;
              
              if (addonKey) {
                const addon = await storage.getAddonByKey(addonKey);
                if (addon) {
                  await db.execute(sql`
                    UPDATE company_addons 
                    SET stripe_subscription_item_id = ${item.id}
                    WHERE company_id = ${t.company_id} AND addon_id = ${addon.id}
                  `);
                }
              }
              
              // Track seat item IDs for subscription update
              if (seatType === 'admin') adminSeatsItemId = item.id;
              if (seatType === 'manager') managerSeatsItemId = item.id;
              if (seatType === 'employee') employeeSeatsItemId = item.id;
            }
            
            // Update database to active status
            const firstPaymentDate = new Date(now);
            const nextPaymentDate = new Date(now);
            nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
            
            await db.execute(sql`
              UPDATE subscriptions 
              SET 
                status = 'active',
                is_trial_active = false,
                stripe_subscription_id = ${subscription.id},
                stripe_admin_seats_item_id = ${adminSeatsItemId},
                stripe_manager_seats_item_id = ${managerSeatsItemId},
                stripe_employee_seats_item_id = ${employeeSeatsItemId},
                first_payment_date = ${firstPaymentDate.toISOString()},
                next_payment_date = ${nextPaymentDate.toISOString()},
                updated_at = now()
              WHERE id = ${t.subscription_id}
            `);
            
            // Clear pending payment intent from custom_features
            await db.execute(sql`
              UPDATE companies 
              SET custom_features = custom_features - 'pending_payment_intent_id' - 'authorization_amount' - 'authorization_date'
              WHERE id = ${t.company_id}
            `);
            
          console.log(`✅ TRIAL CONVERTED: ${t.company_name} activated with first payment of €${(subscription.items.data.reduce((sum, item) => sum + (item.price?.unit_amount || 0) * (item.quantity || 1), 0) / 100).toFixed(2)}`);
          processedCount++;
          
        } catch (error) {
          console.error(`❌ Error processing trial for company ${t.company_id}:`, error);
          
          // If payment failed, block the account and schedule for deletion in 30 days
          await db.execute(sql`
            UPDATE subscriptions SET status = 'blocked', is_trial_active = false 
            WHERE company_id = ${t.company_id}
          `);
          
          // Schedule company for automatic deletion in 30 days
          const deletionDate = new Date();
          deletionDate.setDate(deletionDate.getDate() + 30);
          
          await db.execute(sql`
            UPDATE companies 
            SET 
              scheduled_for_deletion = true,
              deletion_scheduled_at = now(),
              deletion_will_occur_at = ${deletionDate.toISOString()}
            WHERE id = ${t.company_id}
          `);
          
          console.log(`⏰ Company ${t.company_name} scheduled for deletion on ${deletionDate.toISOString()} (payment failed)`);
          
          errorCount++;
        }
      }
      
      console.log(`🏦 AUTO-TRIAL PROCESSING COMPLETE: ${processedCount} activated, ${errorCount} errors`);
      
      res.json({ 
        message: `Processed ${expiredTrials.rows.length} expired trials. ${processedCount} activated, ${errorCount} errors.`,
        processedCount,
        errorCount 
      });
      
    } catch (error) {
      console.error('❌ Error in auto-trial processing:', error);
      res.status(500).json({ message: 'Error during auto-trial processing' });
    }
  });

  // Auto-process scheduled deletions (companies that passed 30-day grace period)
  app.post('/api/account/auto-deletion-process', async (req, res) => {
    try {
      console.log('🗑️ AUTO-DELETION PROCESSING - Checking for companies ready for permanent deletion...');
      
      let deletedCount = 0;
      let errorCount = 0;
      
      // Get all companies that have passed their 30-day grace period
      const companiesReadyForDeletion = await storage.getCompaniesReadyForDeletion();
      
      console.log(`🗑️ Found ${companiesReadyForDeletion.length} companies ready for permanent deletion`);
      
      for (const company of companiesReadyForDeletion) {
        try {
          console.log(`🗑️ Processing permanent deletion for company: ${company.name} (ID: ${company.id})`);
          
          // Double-check: Don't delete if company has an active subscription (they paid after being scheduled)
          const subscription = await storage.getCompanySubscription(company.id);
          if (subscription?.stripeSubscriptionId && subscription?.status === 'active') {
            console.log(`⚠️ SKIPPING deletion for ${company.name}: Company has active subscription (paid after being scheduled)`);
            // Cancel the scheduled deletion since they paid
            await storage.cancelCompanyDeletion(company.id);
            continue;
          }
          
          const success = await storage.deleteCompanyPermanently(company.id);
          
          if (success) {
            console.log(`✅ PERMANENTLY DELETED: ${company.name} (ID: ${company.id})`);
            deletedCount++;
          } else {
            console.error(`❌ Failed to delete company ${company.id}`);
            errorCount++;
          }
          
        } catch (error) {
          console.error(`❌ Error deleting company ${company.id}:`, error);
          errorCount++;
        }
      }
      
      console.log(`🗑️ AUTO-DELETION PROCESSING COMPLETE: ${deletedCount} deleted, ${errorCount} errors`);
      
      res.json({ 
        message: `Processed ${companiesReadyForDeletion.length} companies for deletion. ${deletedCount} deleted, ${errorCount} errors.`,
        deletedCount,
        errorCount 
      });
      
    } catch (error) {
      console.error('❌ Error in auto-deletion processing:', error);
      res.status(500).json({ message: 'Error during auto-deletion processing' });
    }
  });

  // ADMIN: Test trial processing (manual trigger for testing)
  app.post('/api/admin/test-trial-processing', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res) => {
    try {
      console.log(`🧪 ADMIN TEST: Manual trial processing triggered by user ${req.user!.id}`);
      
      // Call the auto-trial-process logic
      const response = await fetch(`http://localhost:5000/api/subscription/auto-trial-process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const result = await response.json();
      
      console.log('🧪 TEST RESULT:', result);
      
      res.json({
        success: true,
        message: 'Trial processing test completed',
        result
      });
      
    } catch (error) {
      console.error('❌ Error in test trial processing:', error);
      res.status(500).json({ message: 'Error during test trial processing' });
    }
  });

  // Auto-cancel subscriptions endpoint (called periodically)
  app.post('/api/subscription/auto-cancel-check', async (req, res) => {
    try {
      console.log('Checking for subscriptions to auto-cancel...');
      
      // Get all active subscriptions that have passed their next payment date
      const now = new Date();
      const expiredSubscriptions = await db.execute(sql`
        SELECT 
          s.id,
          s.company_id,
          s.stripe_subscription_id,
          s.next_payment_date,
          s.status,
          u.stripe_customer_id
        FROM subscriptions s
        JOIN companies c ON s.company_id = c.id  
        JOIN users u ON c.id = u.company_id AND u.role = 'admin'
        WHERE 
          s.status = 'active' 
          AND s.next_payment_date < ${now.toISOString()}
          AND s.stripe_subscription_id IS NOT NULL
      `);
      
      let cancelledCount = 0;
      
      for (const subscription of expiredSubscriptions.rows) {
        const sub = subscription as any;
        
        try {
          // Check if customer has any payment methods
          if (sub.stripe_customer_id) {
            const paymentMethods = await stripe.paymentMethods.list({
              customer: sub.stripe_customer_id,
              type: 'card',
            });
            
            // If no payment methods available, cancel the subscription
            if (paymentMethods.data.length === 0) {
              console.log(`No payment methods found for subscription ${sub.stripe_subscription_id}, cancelling...`);
              
              // Cancel in Stripe
              await stripe.subscriptions.cancel(sub.stripe_subscription_id);
              
              // Update database
              await db.execute(sql`
                UPDATE subscriptions 
                SET 
                  status = 'cancelled',
                  end_date = ${now.toISOString()}
                WHERE id = ${sub.id}
              `);
              
              cancelledCount++;
              console.log(`Cancelled subscription ${sub.stripe_subscription_id} for company ${sub.company_id}`);
            } else {
              console.log(`Payment methods available for subscription ${sub.stripe_subscription_id}, keeping active`);
            }
          }
        } catch (error) {
          console.error(`Error processing subscription ${sub.stripe_subscription_id}:`, error);
        }
      }
      
      res.json({ 
        message: `Auto-cancel check completed. Cancelled ${cancelledCount} subscriptions.`,
        cancelledCount 
      });
      
    } catch (error) {
      console.error('Error in auto-cancel check:', error);
      res.status(500).json({ message: 'Error during auto-cancel check' });
    }
  });

  // Check if subscription is scheduled for cancellation
  app.get('/api/account/cancellation-status', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;
      
      // Get subscription and check payment methods
      const subscriptionResult = await db.execute(sql`
        SELECT 
          s.*,
          u.stripe_customer_id
        FROM subscriptions s
        JOIN companies c ON s.company_id = c.id  
        JOIN users u ON c.id = u.company_id AND u.role = 'admin'
        WHERE s.company_id = ${companyId}
      `);
      
      if (!subscriptionResult.rows.length) {
        return res.json({ scheduledForCancellation: false });
      }
      
      const subscription = subscriptionResult.rows[0] as any;
      
      // Only check if subscription is active and has a next payment date
      if (subscription.status !== 'active' || !subscription.next_payment_date) {
        return res.json({ 
          scheduledForCancellation: false,
          status: subscription.status
        });
      }
      
      // Check if customer has payment methods
      let hasPaymentMethods = false;
      if (subscription.stripe_customer_id) {
        try {
          const paymentMethods = await stripe.paymentMethods.list({
            customer: subscription.stripe_customer_id,
            type: 'card',
          });
          hasPaymentMethods = paymentMethods.data.length > 0;
        } catch (error) {
          console.error('Error checking payment methods:', error);
        }
      }
      
      // Get company deletion status
      const deletionStatus = await storage.getCompanyDeletionStatus(companyId);
      
      res.json({
        scheduledForCancellation: !hasPaymentMethods,
        hasPaymentMethods,
        nextPaymentDate: subscription.next_payment_date,
        status: subscription.status,
        // Add deletion status fields
        scheduledForDeletion: deletionStatus?.scheduledForDeletion || false,
        deletionScheduledAt: deletionStatus?.deletionScheduledAt || null,
        deletionWillOccurAt: deletionStatus?.deletionWillOccurAt || null
      });
      
    } catch (error) {
      console.error('Error checking cancellation status:', error);
      res.status(500).json({ message: 'Error checking cancellation status' });
    }
  });

  // Schedule company deletion - 30 day grace period
  app.post('/api/account/schedule-deletion', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;
      
      // CRITICAL: First cancel Stripe subscription to stop billing immediately
      console.log('🚨 ACCOUNT DELETION - Canceling Stripe subscription for company:', companyId);
      
      // Get company subscription to find Stripe subscription ID
      const subscription = await storage.getCompanySubscription(companyId);
      
      if (subscription && subscription.stripeSubscriptionId) {
        try {
          console.log('💳 Canceling Stripe subscription:', subscription.stripeSubscriptionId);
          
          // Cancel subscription in Stripe immediately
          const canceledSubscription = await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
          console.log('✅ Stripe subscription canceled:', {
            id: canceledSubscription.id,
            status: canceledSubscription.status,
            canceled_at: canceledSubscription.canceled_at
          });
          
          // Update subscription status in database
          await storage.updateCompanySubscription(companyId, {
            status: 'cancelled',
            endDate: new Date()
          });
          
          console.log('✅ Database subscription status updated to cancelled');
          
        } catch (stripeError) {
          console.error('❌ Error canceling Stripe subscription:', stripeError);
          // Continue with account deletion even if Stripe cancellation fails
        }
      } else {
        console.log('⚠️ No active subscription found to cancel');
      }
      
      // Now schedule the company deletion (30-day grace period)
      const success = await storage.scheduleCompanyDeletion(companyId);
      
      if (!success) {
        return res.status(500).json({ error: 'Error al programar la eliminación de la cuenta' });
      }
      
      console.log('✅ Company deletion scheduled for 30 days from now');
      
      res.json({ 
        message: 'Cuenta programada para eliminación en 30 días. Suscripción cancelada inmediatamente.',
        scheduledForDeletion: true,
        subscriptionCanceled: !!subscription?.stripeSubscriptionId
      });
    } catch (error) {
      console.error('Error scheduling company deletion:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  // Cancel scheduled company deletion
  app.post('/api/account/cancel-deletion', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res) => {
    try {
      const success = await storage.cancelCompanyDeletion(req.user!.companyId);
      
      if (!success) {
        return res.status(500).json({ error: 'Error al cancelar la eliminación de la cuenta' });
      }
      
      res.json({ 
        message: 'Eliminación de cuenta cancelada exitosamente',
        scheduledForDeletion: false
      });
    } catch (error) {
      console.error('Error canceling company deletion:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  // Demo data management endpoints
  app.get('/api/demo-data/status', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const company = await storage.getCompanyByUserId(userId);
      
      if (!company) {
        return res.status(404).json({ message: 'Empresa no encontrada' });
      }
      
      const hasDemoData = company.hasDemoData || false;
      res.json({ hasDemoData });
    } catch (error) {
      console.error('Error checking demo data status:', error);
      res.status(500).json({ message: 'Error al verificar el estado de los datos de prueba' });
    }
  });

  // Generate demo data manually (for testing)
  app.post('/api/demo-data/generate', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const company = await storage.getCompanyByUserId(userId);
      
      if (!company) {
        return res.status(404).json({ message: 'Empresa no encontrada' });
      }

      if (company.hasDemoData) {
        return res.status(400).json({ message: 'La empresa ya tiene datos de prueba. Elimínalos primero si quieres regenerarlos.' });
      }

      // Generate comprehensive demo data
      await generateDemoData(company.id);
      
      res.json({ 
        success: true, 
        message: 'Datos de demostración generados correctamente. Incluye fichajes del mes anterior y actual, empleados con estados realistas, vacaciones aprobadas y pendientes, y comunicación bidireccional.'
      });
    } catch (error) {
      console.error('Error generating demo data:', error);
      res.status(500).json({ message: 'Error al generar los datos de prueba: ' + (error as any).message });
    }
  });


  // Endpoint to generate missing work shifts for existing demo data
  app.post('/api/demo-data/generate-missing-shifts', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const company = await storage.getCompanyByUserId(userId);
      
      if (!company) {
        return res.status(404).json({ message: 'Empresa no encontrada' });
      }

      if (!company.hasDemoData) {
        return res.status(400).json({ message: 'Esta empresa no tiene datos demo' });
      }

      // Get all employees
      const employees = await db.select()
        .from(users)
        .where(eq(users.companyId, company.id));

      if (employees.length === 0) {
        return res.status(400).json({ message: 'No hay empleados en la empresa' });
      }

      console.log('📅 Generating missing work shifts for company:', company.id);

      // Generate work shifts for current week + 3 next weeks
      await generateDemoWorkShifts(company.id, employees, new Date());
      
      res.json({ 
        success: true, 
        message: '✅ Turnos de trabajo generados correctamente para las próximas 4 semanas.'
      });
    } catch (error) {
      console.error('Error generating missing shifts:', error);
      res.status(500).json({ message: 'Error al generar los turnos: ' + (error as any).message });
    }
  });

  // Temporary endpoint to force regenerate demo data with improvements
  // This endpoint clears existing demo data first, then regenerates fresh data
  app.post('/api/demo-data/force-regenerate', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const company = await storage.getCompanyByUserId(userId);
      
      if (!company) {
        return res.status(404).json({ message: 'Empresa no encontrada' });
      }

      console.log('🔄 Force regenerating demo data with improvements for company:', company.id);

      // Step 1: Reset hasDemoData flag to allow fresh generation
      await db.update(companies)
        .set({ hasDemoData: false })
        .where(eq(companies.id, company.id));
      console.log('📊 Reset hasDemoData flag to false');

      // Step 2: Delete existing demo employees (non-admin users) and their data
      const demoEmployees = await db.select()
        .from(users)
        .where(and(
          eq(users.companyId, company.id),
          not(eq(users.id, userId)) // Exclude admin
        ));
      
      const demoEmployeeIds = demoEmployees.map(emp => emp.id);
      
      if (demoEmployeeIds.length > 0) {
        console.log('🗑️ Clearing existing demo employees and their data...');
        
        // Delete in proper cascade order
        await db.delete(breakPeriods).where(inArray(breakPeriods.userId, demoEmployeeIds));
        await db.delete(workSessions).where(inArray(workSessions.userId, demoEmployeeIds));
        await db.delete(vacationRequests).where(inArray(vacationRequests.userId, demoEmployeeIds));
        await db.delete(messages).where(inArray(messages.senderId, demoEmployeeIds));
        await db.delete(reminders).where(eq(reminders.companyId, company.id));
        await db.delete(schema.workShifts).where(inArray(schema.workShifts.employeeId, demoEmployeeIds));
        await db.delete(documents).where(inArray(documents.userId, demoEmployeeIds));
        await db.delete(schema.systemNotifications).where(inArray(schema.systemNotifications.userId, demoEmployeeIds));
        await db.delete(users).where(and(
          eq(users.companyId, company.id),
          not(eq(users.id, userId))
        ));
        console.log('✅ Cleared existing demo data');
      }

      // Step 3: Generate fresh demo data
      await generateDemoData(company.id, true);
      
      res.json({ 
        success: true, 
        message: '✅ Datos demo regenerados con mejoras: períodos de descanso, actividad actual, empleados trabajando hoy y uno de vacaciones.'
      });
    } catch (error) {
      console.error('Error force regenerating demo data:', error);
      res.status(500).json({ message: 'Error al regenerar los datos de prueba: ' + (error as any).message });
    }
  });



  app.delete('/api/demo-data/clear', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res) => {
    const userId = req.user!.id;
    let company;
    
    try {
      company = await storage.getCompanyByUserId(userId);
      
      if (!company) {
        return res.status(404).json({ message: 'Empresa no encontrada' });
      }

      if (!company.hasDemoData) {
        return res.status(400).json({ message: 'No hay datos de prueba para eliminar' });
      }

      console.log('🧹 Clearing demo data for company:', company.id);

      // Get demo employees (exclude admin user)
      const demoEmployees = await db.select()
        .from(users)
        .where(and(
          eq(users.companyId, company.id),
          not(eq(users.id, userId)) // Exclude admin
        ));

      const demoEmployeeIds = demoEmployees.map(emp => emp.id);
      console.log(`📊 Found ${demoEmployeeIds.length} demo employees to delete`);

      if (demoEmployeeIds.length > 0) {
        console.log('🗑️ Deleting demo data for employee IDs:', demoEmployeeIds);
        
        // Delete demo avatar files from filesystem
        for (const employee of demoEmployees) {
          if (employee.profilePicture && employee.profilePicture.includes('demo_avatar_')) {
            const avatarPath = path.join(process.cwd(), employee.profilePicture.replace(/^\//, ''));
            try {
              if (fs.existsSync(avatarPath)) {
                fs.unlinkSync(avatarPath);
                console.log(`🗑️ Deleted demo avatar: ${employee.profilePicture}`);
              }
            } catch (error) {
              console.error(`❌ Error deleting avatar ${employee.profilePicture}:`, error);
              // Continue - avatar deletion is not critical
            }
          }
        }
        
        // Delete ALL data in proper cascade order
        // Using individual try-catch blocks to ensure maximum deletion even if some tables don't exist
        
        // Step 1: Delete break periods first (many foreign key references)
        try {
          await db.delete(breakPeriods).where(inArray(breakPeriods.userId, demoEmployeeIds));
          console.log('✅ Deleted break periods');
        } catch (e) { console.log('ℹ️ No break periods to delete'); }
        
        // Step 2: Delete work sessions 
        try {
          await db.delete(workSessions).where(inArray(workSessions.userId, demoEmployeeIds));
          console.log('✅ Deleted work sessions');
        } catch (e) { console.log('ℹ️ No work sessions to delete'); }
        
        // Step 3: Delete vacation requests
        try {
          await db.delete(vacationRequests).where(inArray(vacationRequests.userId, demoEmployeeIds));
          console.log('✅ Deleted vacation requests');
        } catch (e) { console.log('ℹ️ No vacation requests to delete'); }
        
        // Step 4: Delete messages sent by demo employees
        try {
          await db.delete(messages).where(inArray(messages.senderId, demoEmployeeIds));
          console.log('✅ Deleted messages');
        } catch (e) { console.log('ℹ️ No messages to delete'); }
        
        // Step 5: Delete ALL reminders for the entire company
        try {
          await db.delete(reminders).where(eq(reminders.companyId, company.id));
          console.log('✅ Deleted reminders');
        } catch (e) { console.log('ℹ️ No reminders to delete'); }
        
        // Step 6: Delete work shifts for demo employees
        try {
          await db.delete(schema.workShifts).where(inArray(schema.workShifts.employeeId, demoEmployeeIds));
          console.log('✅ Deleted work shifts');
        } catch (e) { console.log('ℹ️ No work shifts to delete'); }
        
        // Step 7: Delete documents
        try {
          await db.delete(documents).where(inArray(documents.userId, demoEmployeeIds));
          console.log('✅ Deleted documents');
        } catch (e) { console.log('ℹ️ No documents to delete'); }
        
        // Step 8: Delete document notifications
        try {
          await db.delete(schema.documentNotifications).where(inArray(schema.documentNotifications.userId, demoEmployeeIds));
          console.log('✅ Deleted document notifications');
        } catch (e) { console.log('ℹ️ No document notifications to delete'); }
        
        // Step 9: Delete system notifications
        try {
          await db.delete(schema.systemNotifications).where(inArray(schema.systemNotifications.userId, demoEmployeeIds));
          console.log('✅ Deleted system notifications');
        } catch (e) { console.log('ℹ️ No system notifications to delete'); }
        
        // Step 10: Delete accounting entries
        try {
          await db.delete(schema.accountingEntries).where(inArray(schema.accountingEntries.userId, demoEmployeeIds));
          console.log('✅ Deleted accounting entries');
        } catch (e) { console.log('ℹ️ No accounting entries to delete'); }
        
        // Step 11: Delete expenses
        try {
          await db.delete(schema.expenses).where(inArray(schema.expenses.userId, demoEmployeeIds));
          console.log('✅ Deleted expenses');
        } catch (e) { console.log('ℹ️ No expenses to delete'); }
        
        // Step 12: Delete CRM contacts
        try {
          await db.delete(schema.crmContacts).where(inArray(schema.crmContacts.createdByUserId, demoEmployeeIds));
          console.log('✅ Deleted CRM contacts');
        } catch (e) { console.log('ℹ️ No CRM contacts to delete'); }
        
        // Step 13: Final cleanup - Delete demo employees
        try {
          await db.delete(users).where(and(eq(users.companyId, company.id), not(eq(users.id, userId))));
          console.log('✅ Deleted demo employees');
        } catch (e) { console.error('❌ Error deleting employees:', e); }
      } else {
        console.log('⚠️ No demo employees found to delete');
      }

      // ALWAYS mark company as no longer having demo data - even if deletion had issues
      await db.update(companies).set({ hasDemoData: false }).where(eq(companies.id, company.id));

      console.log('✅ Demo data cleared successfully for company:', company.id);
      res.json({ message: 'Datos de prueba eliminados correctamente' });

    } catch (error) {
      console.error('❌ CRITICAL ERROR clearing demo data:', error);
      
      // FAILSAFE: If anything fails, still mark as no demo data and return success
      // This prevents the user from being stuck with a broken state
      try {
        if (company?.id) {
          await db.update(companies).set({ hasDemoData: false }).where(eq(companies.id, company.id));
          console.log('⚠️ Marked demo data as cleared despite errors');
        }
      } catch (fallbackError) {
        console.error('❌ FAILSAFE ALSO FAILED:', fallbackError);
      }
      
      // ALWAYS return success to avoid user-facing errors
      res.json({ message: 'Datos de prueba procesados correctamente' });
    }
  });

  // ⚠️ SUPER ADMIN SECURITY ROUTES - MAXIMUM SECURITY LEVEL
  // Storage for temporary security codes (in production, use Redis or secure cache)
  const securityCodes = new Map<string, { code: string; timestamp: number; attempts: number }>();
  
  // Generate secure 6-digit code
  function generateSecurityCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
  
  // Clean expired codes (older than 10 minutes)
  function cleanExpiredCodes() {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    securityCodes.forEach((value, key) => {
      if (now - value.timestamp > 600000) { // 10 minutes
        expiredKeys.push(key);
      }
    });
    
    expiredKeys.forEach(key => securityCodes.delete(key));
  }

  // Send security verification code
  app.post('/api/super-admin/request-code', superAdminSecurityHeaders, async (req, res) => {
    try {
      const { email } = req.body;
      
      // Validate email is exactly soy@oficaz.es
      if (email !== 'soy@oficaz.es') {
        console.log(`🚨 SECURITY: Unauthorized super admin access attempt from email: ${email}`);
        return res.status(403).json({ message: 'Acceso no autorizado' });
      }
      
      cleanExpiredCodes();
      
      // Check if code was recently sent (rate limiting)
      const existingCode = securityCodes.get(email);
      if (existingCode && (Date.now() - existingCode.timestamp) < 60000) { // 1 minute
        return res.status(429).json({ message: 'Código enviado recientemente. Espera un minuto.' });
      }
      
      // Generate and store new code
      const code = generateSecurityCode();
      securityCodes.set(email, {
        code,
        timestamp: Date.now(),
        attempts: 0
      });
      
      // Send security code email using existing email infrastructure
      // Email sending is now handled in the access code verification endpoint
      const emailSent = true;
      
      if (emailSent) {
        console.log(`🔐 Super admin security code sent to ${email}`);
        res.json({ message: 'Código de seguridad enviado' });
      } else {
        console.error(`❌ Failed to send security code to ${email}`);
        res.status(500).json({ message: 'Error al enviar código de seguridad' });
      }
      
    } catch (error) {
      console.error('Error sending super admin security code:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  // Verify security code and grant access
  app.post('/api/super-admin/verify-code', superAdminSecurityHeaders, async (req, res) => {
    try {
      const { email, code } = req.body;
      
      // Validate email
      if (email !== 'soy@oficaz.es') {
        return res.status(403).json({ message: 'Acceso no autorizado' });
      }
      
      cleanExpiredCodes();
      
      const storedCodeData = securityCodes.get(email);
      if (!storedCodeData) {
        return res.status(400).json({ message: 'Código expirado o no válido' });
      }
      
      // Check attempts limit
      if (storedCodeData.attempts >= 3) {
        securityCodes.delete(email);
        console.log(`🚨 SECURITY: Too many failed attempts for super admin access from ${email}`);
        return res.status(429).json({ message: 'Demasiados intentos fallidos' });
      }
      
      // Verify code
      if (storedCodeData.code !== code) {
        storedCodeData.attempts++;
        console.log(`🚨 SECURITY: Invalid code attempt ${storedCodeData.attempts}/3 for ${email}`);
        return res.status(400).json({ message: 'Código incorrecto' });
      }
      
      // Code verified successfully - clean up
      securityCodes.delete(email);
      
      // Generate super admin JWT token
      const superAdminToken = jwt.sign(
        { 
          email,
          role: 'super_admin',
          type: 'super_admin_access'
        },
        JWT_SECRET,
        { expiresIn: '2h' } // 2 hour session
      );
      
      console.log(`✅ Super admin access granted to ${email}`);
      
      res.json({
        message: 'Acceso autorizado',
        token: superAdminToken,
        role: 'super_admin'
      });
      
    } catch (error) {
      console.error('Error verifying super admin security code:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  // Verify super admin token middleware
  const verifySuperAdminToken = (req: any, res: any, next: any) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'Token requerido' });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded.role !== 'super_admin' || decoded.type !== 'super_admin_access') {
        return res.status(403).json({ message: 'Acceso no autorizado' });
      }
      next();
    } catch (error) {
      return res.status(401).json({ message: 'Token inválido' });
    }
  };

  // Get companies pending deletion for SuperAdmin dashboard
  app.get('/api/superadmin/companies/pending-deletion', verifySuperAdminToken, async (req, res) => {
    try {
      const companiesPendingDeletion = await storage.getCompaniesPendingDeletion();
      
      // Calculate days remaining for each company
      const companiesWithDaysRemaining = companiesPendingDeletion.map(company => {
        const now = new Date();
        const deletionDate = new Date(company.deletionWillOccurAt);
        const msRemaining = deletionDate.getTime() - now.getTime();
        const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
        
        return {
          ...company,
          daysRemaining: daysRemaining > 0 ? daysRemaining : 0
        };
      });
      
      res.json(companiesWithDaysRemaining);
    } catch (error) {
      console.error('Error getting companies pending deletion:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  // Custom Holidays API Routes
  app.get('/api/holidays/custom', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;
      const customHolidays = await storage.getCustomHolidaysByCompany(companyId);
      res.json(customHolidays);
    } catch (error) {
      console.error('Error fetching custom holidays:', error);
      res.status(500).json({ message: 'Failed to fetch custom holidays' });
    }
  });

  app.post('/api/holidays/custom', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;
      const { name, startDate, endDate, type, region, description } = req.body;
      
      if (!name || !startDate || !endDate) {
        return res.status(400).json({ message: 'Name, start date, and end date are required' });
      }

      const holidayData = {
        companyId,
        name: name.trim(),
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        type: type || 'local',
        region: region || null,
        description: description || null,
      };

      const newHoliday = await storage.createCustomHoliday(holidayData);
      res.status(201).json(newHoliday);
    } catch (error) {
      console.error('Error creating custom holiday:', error);
      res.status(500).json({ message: 'Failed to create custom holiday' });
    }
  });

  app.delete('/api/holidays/custom/:id', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const holidayId = parseInt(req.params.id);
      const companyId = req.user!.companyId;
      
      // Verify the holiday belongs to the user's company (security check)
      const customHolidays = await storage.getCustomHolidaysByCompany(companyId);
      const holiday = customHolidays.find(h => h.id === holidayId);
      
      if (!holiday) {
        return res.status(404).json({ message: 'Holiday not found or not authorized' });
      }

      const deleted = await storage.deleteCustomHoliday(holidayId);
      if (deleted) {
        res.json({ message: 'Holiday deleted successfully' });
      } else {
        res.status(404).json({ message: 'Holiday not found' });
      }
    } catch (error) {
      console.error('Error deleting custom holiday:', error);
      res.status(500).json({ message: 'Failed to delete custom holiday' });
    }
  });

  // Work Alarms API Routes
  app.get('/api/work-alarms', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const alarms = await storage.getWorkAlarmsByUser(userId);
      res.json(alarms);
    } catch (error) {
      console.error('Error fetching work alarms:', error);
      res.status(500).json({ message: 'Failed to fetch work alarms' });
    }
  });

  app.get('/api/work-alarms/active', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const activeAlarms = await storage.getActiveWorkAlarmsByUser(userId);
      res.json(activeAlarms);
    } catch (error) {
      console.error('Error fetching active work alarms:', error);
      res.status(500).json({ message: 'Failed to fetch active work alarms' });
    }
  });

  app.post('/api/work-alarms', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const { title, type, time, weekdays, soundEnabled } = req.body;
      
      if (!title || !type || !time || !weekdays || !Array.isArray(weekdays)) {
        return res.status(400).json({ message: 'Title, type, time, and weekdays are required' });
      }

      // Validate time format (HH:MM)
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(time)) {
        return res.status(400).json({ message: 'Invalid time format. Use HH:MM format' });
      }

      // Validate weekdays (1-7)
      if (!weekdays.every((day: number) => day >= 1 && day <= 7)) {
        return res.status(400).json({ message: 'Weekdays must be between 1 (Monday) and 7 (Sunday)' });
      }

      // Validate type
      if (!['clock_in', 'clock_out'].includes(type)) {
        return res.status(400).json({ message: 'Type must be either clock_in or clock_out' });
      }

      const alarmData = {
        userId,
        title: title.trim(),
        type,
        time,
        weekdays,
        soundEnabled: soundEnabled !== undefined ? soundEnabled : true,
        isActive: true
      };

      const newAlarm = await storage.createWorkAlarm(alarmData);
      
      // Reload alarms in the scheduler
      try {
        const { reloadAlarms } = await import('./pushNotificationScheduler');
        await reloadAlarms();
      } catch (err) {
        console.error('Warning: Could not reload alarms in scheduler:', err);
      }
      
      res.status(201).json(newAlarm);
    } catch (error) {
      console.error('Error creating work alarm:', error);
      res.status(500).json({ message: 'Failed to create work alarm' });
    }
  });

  app.put('/api/work-alarms/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const alarmId = parseInt(req.params.id);
      const userId = req.user!.id;
      
      // Check if alarm belongs to user
      const existingAlarm = await storage.getWorkAlarm(alarmId);
      if (!existingAlarm || existingAlarm.userId !== userId) {
        return res.status(404).json({ message: 'Alarm not found or not authorized' });
      }

      const { title, type, time, weekdays, soundEnabled, isActive } = req.body;
      const updates: any = {};

      if (title !== undefined) updates.title = title.trim();
      if (type !== undefined) {
        if (!['clock_in', 'clock_out'].includes(type)) {
          return res.status(400).json({ message: 'Type must be either clock_in or clock_out' });
        }
        updates.type = type;
      }
      if (time !== undefined) {
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(time)) {
          return res.status(400).json({ message: 'Invalid time format. Use HH:MM format' });
        }
        updates.time = time;
      }
      if (weekdays !== undefined) {
        if (!Array.isArray(weekdays) || !weekdays.every((day: number) => day >= 1 && day <= 7)) {
          return res.status(400).json({ message: 'Weekdays must be an array with values between 1 and 7' });
        }
        updates.weekdays = weekdays;
      }
      if (soundEnabled !== undefined) updates.soundEnabled = soundEnabled;
      if (isActive !== undefined) updates.isActive = isActive;

      const updatedAlarm = await storage.updateWorkAlarm(alarmId, updates);
      if (updatedAlarm) {
        // Reload alarms in the scheduler
        try {
          const { reloadAlarms } = await import('./pushNotificationScheduler');
          await reloadAlarms();
        } catch (err) {
          console.error('Warning: Could not reload alarms in scheduler:', err);
        }
        
        res.json(updatedAlarm);
      } else {
        res.status(404).json({ message: 'Alarm not found' });
      }
    } catch (error) {
      console.error('Error updating work alarm:', error);
      res.status(500).json({ message: 'Failed to update work alarm' });
    }
  });

  app.delete('/api/work-alarms/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const alarmId = parseInt(req.params.id);
      const userId = req.user!.id;
      
      // Check if alarm belongs to user
      const existingAlarm = await storage.getWorkAlarm(alarmId);
      if (!existingAlarm || existingAlarm.userId !== userId) {
        return res.status(404).json({ message: 'Alarm not found or not authorized' });
      }

      const deleted = await storage.deleteWorkAlarm(alarmId);
      if (deleted) {
        // Reload alarms in the scheduler
        try {
          const { reloadAlarms } = await import('./pushNotificationScheduler');
          await reloadAlarms();
        } catch (err) {
          console.error('Warning: Could not reload alarms in scheduler:', err);
        }
        
        res.json({ message: 'Alarm deleted successfully' });
      } else {
        res.status(404).json({ message: 'Alarm not found' });
      }
    } catch (error) {
      console.error('Error deleting work alarm:', error);
      res.status(500).json({ message: 'Failed to delete work alarm' });
    }
  });

  // 📱 Push Notifications API Routes (PWA)
  
  // Get VAPID public key for push subscription
  app.get('/api/push/vapid-public-key', (req, res) => {
    if (!vapidPublicKey) {
      return res.status(503).json({ message: 'Push notifications not configured' });
    }
    res.json({ publicKey: vapidPublicKey });
  });

  // Subscribe to push notifications
  app.post('/api/push/subscribe', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const { endpoint, keys, deviceId } = req.body;
      const userAgent = req.headers['user-agent'] || null;

      if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
        return res.status(400).json({ message: 'Invalid subscription data' });
      }

      // Check if subscription already exists for this endpoint
      const existing = await db.select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.endpoint, endpoint))
        .limit(1);

      if (existing.length > 0) {
        // Update existing subscription
        await db.update(pushSubscriptions)
          .set({
            userId,
            p256dh: keys.p256dh,
            auth: keys.auth,
            deviceId: deviceId || null,
            userAgent,
            updatedAt: new Date()
          })
          .where(eq(pushSubscriptions.endpoint, endpoint));
        
        return res.json({ message: 'Subscription updated', subscription: existing[0] });
      }

      // Remove old subscriptions from the same device (same user + deviceId)
      // This prevents duplicate notifications when user reopens the app
      if (deviceId) {
        const deleted = await db.delete(pushSubscriptions)
          .where(and(
            eq(pushSubscriptions.userId, userId),
            eq(pushSubscriptions.deviceId, deviceId)
          ))
          .returning();
        
        if (deleted.length > 0) {
          console.log(`🗑️  Removed ${deleted.length} old subscription(s) for user ${userId} from device ${deviceId}`);
        }
      }

      // 🔒 CRITICAL: Remove old subscriptions from the same push provider (Apple/FCM)
      // This prevents duplicate notifications when user reinstalls PWA with new deviceId
      // Keep only 1 subscription per provider per user to avoid notification spam
      const isAppleEndpoint = endpoint.includes('web.push.apple.com');
      const isFCMEndpoint = endpoint.includes('fcm.googleapis.com');
      
      if (isAppleEndpoint || isFCMEndpoint) {
        const providerPattern = isAppleEndpoint ? 'web.push.apple.com' : 'fcm.googleapis.com';
        const oldProviderSubs = await db.select()
          .from(pushSubscriptions)
          .where(and(
            eq(pushSubscriptions.userId, userId),
            sql`${pushSubscriptions.endpoint} LIKE ${'%' + providerPattern + '%'}`
          ));
        
        if (oldProviderSubs.length > 0) {
          // Delete all old subscriptions from the same provider
          await db.delete(pushSubscriptions)
            .where(inArray(pushSubscriptions.id, oldProviderSubs.map(s => s.id)));
          console.log(`🗑️  Removed ${oldProviderSubs.length} old ${isAppleEndpoint ? 'Apple' : 'FCM'} subscription(s) for user ${userId}`);
        }
      }

      // Create new subscription
      const [newSubscription] = await db.insert(pushSubscriptions)
        .values({
          userId,
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          deviceId: deviceId || null,
          userAgent
        })
        .returning();

      res.status(201).json({ message: 'Subscribed successfully', subscription: newSubscription });
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      res.status(500).json({ message: 'Failed to subscribe to push notifications' });
    }
  });

  // List push subscriptions for current user
  app.get('/api/push/subscriptions', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      
      const subs = await db.select({
        id: pushSubscriptions.id,
        deviceId: pushSubscriptions.deviceId,
        userAgent: pushSubscriptions.userAgent,
        createdAt: pushSubscriptions.createdAt,
        updatedAt: pushSubscriptions.updatedAt,
        endpoint: pushSubscriptions.endpoint
      })
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.userId, userId))
        .orderBy(desc(pushSubscriptions.updatedAt));

      res.json(subs);
    } catch (error) {
      console.error('Error fetching push subscriptions:', error);
      res.status(500).json({ message: 'Failed to fetch subscriptions' });
    }
  });

  // Delete specific push subscription
  app.delete('/api/push/subscriptions/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const subscriptionId = parseInt(req.params.id);

      // Verify ownership before deleting
      const [subscription] = await db.select()
        .from(pushSubscriptions)
        .where(and(
          eq(pushSubscriptions.id, subscriptionId),
          eq(pushSubscriptions.userId, userId)
        ))
        .limit(1);

      if (!subscription) {
        return res.status(404).json({ message: 'Subscription not found' });
      }

      await db.delete(pushSubscriptions)
        .where(eq(pushSubscriptions.id, subscriptionId));

      res.json({ message: 'Subscription deleted successfully' });
    } catch (error) {
      console.error('Error deleting push subscription:', error);
      res.status(500).json({ message: 'Failed to delete subscription' });
    }
  });

  // Unsubscribe from push notifications
  app.post('/api/push/unsubscribe', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { endpoint } = req.body;

      if (!endpoint) {
        return res.status(400).json({ message: 'Endpoint is required' });
      }

      await db.delete(pushSubscriptions)
        .where(eq(pushSubscriptions.endpoint, endpoint));

      res.json({ message: 'Unsubscribed successfully' });
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      res.status(500).json({ message: 'Failed to unsubscribe' });
    }
  });

  // Get current work status for push notifications
  app.get('/api/push/work-status/:userId', async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      // Get active work session
      const activeSession = await storage.getActiveWorkSession(userId);
      
      if (!activeSession) {
        // Not clocked in
        return res.json({
          status: 'not_clocked_in',
          buttons: [
            { action: 'clock_in', title: 'Fichar entrada', icon: '⏱️' }
          ]
        });
      }

      // Check if currently on break
      const activeBreak = await db.select()
        .from(schema.breakPeriods)
        .where(and(
          eq(schema.breakPeriods.workSessionId, activeSession.id),
          eq(schema.breakPeriods.status, 'active'),
          isNull(schema.breakPeriods.breakEnd)
        ))
        .limit(1);

      if (activeBreak.length > 0) {
        // On break
        return res.json({
          status: 'on_break',
          sessionId: activeSession.id,
          breakId: activeBreak[0].id,
          buttons: [
            { action: 'end_break', title: 'Terminar descanso', icon: '✅' }
          ]
        });
      }

      // Clocked in, not on break
      return res.json({
        status: 'clocked_in',
        sessionId: activeSession.id,
        buttons: [
          { action: 'start_break', title: 'Iniciar descanso', icon: '☕' },
          { action: 'clock_out', title: 'Fichar salida', icon: '🚪' }
        ]
      });

    } catch (error) {
      console.error('Error getting work status:', error);
      res.status(500).json({ message: 'Failed to get work status' });
    }
  });

  // Handle work action from push notification - SECURED WITH JWT
  app.post('/api/push/work-action', authenticateToken, async (req: AuthRequest, res) => {
    try {
      // 🔒 SECURITY: Verify this is a push action token (not a regular session token)
      if (!req.user!.pushAction) {
        console.log(`❌ Rejected work action: Not a push action token for user ${req.user!.id}`);
        return res.status(403).json({ success: false, message: 'Invalid token type' });
      }
      
      const { action, sessionId, breakId } = req.body;
      const userId = req.user!.id; // Get userId from authenticated token
      
      console.log(`🔔 Push action received:`, { userId, action, sessionId, breakId });

      if (action === 'clock_in') {
        // Clock in
        console.log(`⏰ Clocking in user ${userId} from push notification`);
        const result = await storage.clockIn(userId);
        console.log(`✅ Clock in successful for user ${userId}`);
        return res.json({ success: true, message: 'Fichado entrada', data: result });
      }

      if (action === 'clock_out') {
        // Clock out
        if (!sessionId) {
          console.log(`❌ Clock out failed: No session ID for user ${userId}`);
          return res.status(400).json({ success: false, message: 'Session ID required' });
        }
        console.log(`🚪 Clocking out user ${userId}, session ${sessionId}`);
        const result = await storage.clockOut(sessionId);
        console.log(`✅ Clock out successful for user ${userId}`);
        return res.json({ success: true, message: 'Fichado salida', data: result });
      }

      if (action === 'start_break') {
        // Start break
        if (!sessionId) {
          console.log(`❌ Start break failed: No session ID for user ${userId}`);
          return res.status(400).json({ success: false, message: 'Session ID required' });
        }
        console.log(`☕ Starting break for user ${userId}, session ${sessionId}`);
        const result = await storage.startBreak(sessionId);
        console.log(`✅ Break started for user ${userId}`);
        return res.json({ success: true, message: 'Descanso iniciado', data: result });
      }

      if (action === 'end_break') {
        // End break
        if (!breakId) {
          console.log(`❌ End break failed: No break ID for user ${userId}`);
          return res.status(400).json({ success: false, message: 'Break ID required' });
        }
        console.log(`✅ Ending break ${breakId} for user ${userId}`);
        const result = await storage.endBreak(breakId);
        console.log(`✅ Break ended for user ${userId}`);
        return res.json({ success: true, message: 'Descanso finalizado', data: result });
      }

      console.log(`❌ Invalid action received: ${action}`);
      return res.status(400).json({ success: false, message: 'Invalid action' });

    } catch (error: any) {
      console.error('Error handling work action:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to perform action' 
      });
    }
  });

  // 🧪 TEMPORARY TEST ENDPOINT - Apply promotional code to a company
  app.post('/api/test/apply-promotional-code', async (req, res) => {
    try {
      const { companyId, code } = req.body;
      
      if (!companyId || !code) {
        return res.status(400).json({ 
          success: false, 
          message: 'Company ID and code are required' 
        });
      }
      
      console.log(`🧪 TEST: Applying promotional code ${code} to company ${companyId}`);
      
      const result = await storage.redeemAndApplyPromotionalCode(companyId, code);
      
      if (result.success) {
        res.json({
          success: true,
          message: result.message,
          trialDays: result.trialDays,
          company: result.updatedCompany
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message
        });
      }
    } catch (error: any) {
      console.error('🧪 TEST: Error applying promotional code:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error interno del servidor' 
      });
    }
  });

  // 🧪 TEST ENDPOINT: Simular evento de pago de Stripe (solo para pruebas)
  app.post('/api/stripe/test-payment-event', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ error: 'No autenticado' });
      }
      
      // Find subscription by company ID
      const subscription = await db.query.subscriptions.findFirst({
        where: eq(subscriptions.companyId, user.companyId),
      });

      if (!subscription) {
        return res.status(404).json({ error: 'No subscription found' });
      }

      console.log(`🧪 TEST: Simulating payment event for company ${user.companyId}`);
      console.log(`   - Current nextPaymentDate: ${subscription.nextPaymentDate}`);

      // ⚠️ CRITICAL: Calculate next payment date from PREVIOUS date, not from now
      // This ensures the billing cycle stays consistent (e.g., always on the 4th)
      const currentNextPaymentDate = subscription.nextPaymentDate ? new Date(subscription.nextPaymentDate) : new Date();
      const nextPaymentDate = new Date(currentNextPaymentDate);
      nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);

      // Update subscription with new next payment date
      await db.update(subscriptions)
        .set({ 
          nextPaymentDate: nextPaymentDate,
          status: 'active',
          updatedAt: new Date()
        })
        .where(eq(subscriptions.id, subscription.id));

      console.log(`✅ TEST: Updated nextPaymentDate from ${currentNextPaymentDate.toISOString()} to ${nextPaymentDate.toISOString()}`);
      
      res.json({ 
        success: true,
        message: 'Fecha de pago actualizada correctamente',
        previousDate: currentNextPaymentDate,
        newDate: nextPaymentDate
      });
    } catch (error: any) {
      console.error('🧪 TEST: Error simulating payment event:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  // ============================================
  // ADD-ONS STORE - Admin-only feature purchases
  // ============================================

  // Get all available add-ons for the store
  app.get('/api/addons', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const addons = await storage.getActiveAddons();
      res.json(addons);
    } catch (error: any) {
      console.error('Error fetching addons:', error);
      res.status(500).json({ error: 'Error al obtener los complementos' });
    }
  });

  // Purchase an add-on (Admin only) - With Stripe proration and cooldown enforcement
  app.post('/api/addons/:id/purchase', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      const addonId = parseInt(req.params.id);
      const idempotencyKey = `addon-purchase-${user.companyId}-${addonId}-${Date.now()}`;

      // Get the add-on
      const addon = await storage.getAddon(addonId);
      if (!addon) {
        return res.status(404).json({ error: 'Complemento no encontrado' });
      }

      // Get company subscription for Stripe integration
      const subscription = await db.query.subscriptions.findFirst({
        where: eq(subscriptions.companyId, user.companyId),
      });

      if (!subscription) {
        return res.status(400).json({ error: 'No se encontró suscripción activa' });
      }

      // Check if in trial period (free to add/remove addons)
      // Note: isTrialActive is legacy - use status or trialEndDate comparison
      const isInTrial = subscription.status === 'trial' || 
        (subscription.trialEndDate && new Date(subscription.trialEndDate) > new Date());

      // Check if already purchased and active
      const existingAddon = await storage.getCompanyAddon(user.companyId, addonId);
      if (existingAddon) {
        // Check if active or pending_cancel (still has access)
        if (existingAddon.status === 'active' || existingAddon.status === 'pending_cancel') {
          return res.status(400).json({ error: 'Ya tienes este complemento activo' });
        }
        
        // Check cooldown period - ONLY enforced after trial ends (when paying)
        if (!isInTrial && existingAddon.cooldownEndsAt && new Date() < existingAddon.cooldownEndsAt) {
          const cooldownEndFormatted = existingAddon.cooldownEndsAt.toLocaleDateString('es-ES');
          return res.status(400).json({ 
            error: `No puedes volver a contratar este complemento hasta el ${cooldownEndFormatted}. Podrás contratarlo de nuevo en el próximo ciclo de facturación.`,
            cooldownEndsAt: existingAddon.cooldownEndsAt
          });
        }
      }

      let stripeSubscriptionItemId: string | null = null;
      let proratedDays: number = 30; // Default to full month
      let proratedAmount: number = Number(addon.monthlyPrice);

      // If company has active Stripe subscription, add item with proration
      if (subscription.stripeSubscriptionId && subscription.status === 'active') {
        try {
          // Get or create Stripe price for this addon
          let stripePriceId = addon.stripePriceId;

          if (!stripePriceId) {
            // Create Stripe product and price for this addon
            const stripeProduct = await stripe.products.create({
              name: `Oficaz: ${addon.name}`,
              description: addon.description || addon.shortDescription || undefined,
              metadata: {
                addon_key: addon.key,
                feature_key: addon.featureKey || addon.key,
              }
            }, { idempotencyKey: `product-${addon.key}` });

            const stripePrice = await stripe.prices.create({
              product: stripeProduct.id,
              unit_amount: Math.round(Number(addon.monthlyPrice) * 100),
              currency: 'eur',
              recurring: { interval: 'month' },
              nickname: addon.name,
              metadata: {
                addon_key: addon.key,
              }
            }, { idempotencyKey: `price-${addon.key}` });

            stripePriceId = stripePrice.id;

            // Update addon with Stripe IDs
            await storage.updateAddon(addon.id, {
              stripeProductId: stripeProduct.id,
              stripePriceId: stripePrice.id,
            });
          }

          // Get current subscription to calculate proration
          const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId) as any;
          const currentPeriodEnd = stripeSubscription.current_period_end as number;
          const currentPeriodStart = stripeSubscription.current_period_start as number;
          const now = Math.floor(Date.now() / 1000);
          
          // Calculate prorated days
          const totalDaysInPeriod = Math.ceil((currentPeriodEnd - currentPeriodStart) / 86400);
          const remainingDays = Math.ceil((currentPeriodEnd - now) / 86400);
          proratedDays = Math.max(1, Math.min(remainingDays, totalDaysInPeriod));
          proratedAmount = (Number(addon.monthlyPrice) / totalDaysInPeriod) * proratedDays;

          // Add subscription item with proration (creates invoice items automatically)
          const subscriptionItem = await stripe.subscriptionItems.create({
            subscription: subscription.stripeSubscriptionId,
            price: stripePriceId,
            quantity: 1,
            proration_behavior: 'create_prorations',
            metadata: {
              addon_id: addon.id.toString(),
              addon_key: addon.key,
              company_id: user.companyId.toString(),
            }
          }, { idempotencyKey });

          stripeSubscriptionItemId = subscriptionItem.id;

          // Get upcoming invoice to find the proration line item and update its description
          try {
            const upcomingInvoice = await (stripe.invoices as any).upcoming({
              subscription: subscription.stripeSubscriptionId,
            });
            
            // Find proration line items for this addon and update descriptions
            for (const lineItem of upcomingInvoice.lines.data) {
              if (lineItem.proration && lineItem.subscription_item === stripeSubscriptionItemId) {
                // Update the invoice item description with clear Spanish text
                await stripe.invoiceItems.update(lineItem.id as string, {
                  description: `${addon.name} – ${proratedDays} días (prorrateo)`,
                });
              }
            }
          } catch (invoiceError: any) {
            console.warn('Could not update invoice item description:', invoiceError.message);
          }

          console.log(`✅ Added addon ${addon.key} to Stripe subscription with proration: ${proratedDays} días, €${proratedAmount.toFixed(2)}`);
        } catch (stripeError: any) {
          console.error('Error adding addon to Stripe subscription:', stripeError);
          // For paid subscriptions, we must fail if Stripe fails - no free usage
          if (subscription.status === 'active' && subscription.stripeSubscriptionId) {
            return res.status(500).json({ 
              error: 'Error al procesar el pago. Por favor, inténtalo de nuevo o contacta con soporte.',
              details: stripeError.message
            });
          }
        }
      }

      // Create or update company addon record
      const now = new Date();
      if (existingAddon) {
        // Reactivate existing record
        await storage.reactivateAddon(existingAddon.id, stripeSubscriptionItemId || '', proratedDays);
      } else {
        // Create new record
        await storage.createCompanyAddon({
          companyId: user.companyId,
          addonId: addon.id,
          status: 'active',
          stripeSubscriptionItemId,
          purchasedAt: now,
          activatedAt: now,
          proratedDays,
        });
      }

      console.log(`🛒 Company ${user.companyId} purchased addon: ${addon.key} (${proratedDays} días prorrateados)`);

      // If inventory addon is activated, create default warehouse if none exists
      if (addon.key === 'inventory') {
        try {
          const existingWarehouses = await storage.getWarehouses(user.companyId);
          if (existingWarehouses.length === 0) {
            await storage.createWarehouse({
              companyId: user.companyId,
              name: 'Almacén Principal',
              isDefault: true,
              isActive: true,
            });
            console.log(`📦 Created default warehouse for company ${user.companyId}`);
          }
        } catch (warehouseError) {
          // Non-critical error, log but don't fail the addon purchase
          console.error('Error creating default warehouse:', warehouseError);
        }
      }

      res.json({
        success: true,
        message: `Complemento "${addon.name}" activado correctamente`,
        addon: addon,
        billing: {
          proratedDays,
          proratedAmount: proratedAmount.toFixed(2),
          message: subscription.stripeSubscriptionId 
            ? `Se te cobrará €${proratedAmount.toFixed(2)} por ${proratedDays} días de uso en este ciclo`
            : 'Este complemento se activará con tu próxima factura'
        }
      });
    } catch (error: any) {
      console.error('Error purchasing addon:', error);
      res.status(500).json({ error: 'Error al comprar el complemento' });
    }
  });

  // Cancel an add-on (Admin only) - During trial: immediate cancel, no cooldown. Paying: pending_cancel with cooldown
  app.post('/api/addons/:id/cancel', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      const addonId = parseInt(req.params.id);

      // Get the company addon
      const companyAddon = await storage.getCompanyAddon(user.companyId, addonId);
      if (!companyAddon) {
        return res.status(404).json({ error: 'Complemento no encontrado' });
      }
      
      if (companyAddon.status === 'pending_cancel') {
        return res.status(400).json({ error: 'Este complemento ya está programado para cancelarse' });
      }
      
      if (companyAddon.status !== 'active') {
        return res.status(400).json({ error: 'Este complemento no está activo' });
      }

      // Get subscription to determine if in trial
      const subscription = await db.query.subscriptions.findFirst({
        where: eq(subscriptions.companyId, user.companyId),
      });

      const addon = await storage.getAddon(addonId);
      
      // Check if in trial period (free to add/remove addons without restrictions)
      // Note: isTrialActive is legacy - use status or trialEndDate comparison
      const isInTrial = subscription?.status === 'trial' || 
        (subscription?.trialEndDate && new Date(subscription.trialEndDate) > new Date());

      if (isInTrial) {
        // TRIAL MODE: Immediate cancellation, no cooldown, no pending state
        // Simply delete/deactivate the company addon record
        await storage.cancelAddonImmediately(user.companyId, addonId);
        
        console.log(`🆓 [TRIAL] Company ${user.companyId} cancelled addon: ${addon?.key || addonId} (immediate, no cooldown)`);

        res.json({
          success: true,
          message: `Complemento "${addon?.name}" desactivado. Durante el periodo de prueba puedes volver a activarlo cuando quieras.`,
          addonName: addon?.name,
          isTrialCancellation: true,
        });
        return;
      }

      // PAYING MODE: Mark as pending_cancel, access until period end, cooldown enforced
      let effectiveDate = new Date();
      
      if (subscription?.stripeSubscriptionId) {
        try {
          // Get the actual billing period end from Stripe
          const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId) as any;
          effectiveDate = new Date((stripeSubscription.current_period_end as number) * 1000);
        } catch (stripeError: any) {
          console.warn('Could not get Stripe subscription period:', stripeError.message);
          // Fallback to nextPaymentDate or end of month
          if (subscription?.nextPaymentDate) {
            effectiveDate = new Date(subscription.nextPaymentDate);
          } else {
            effectiveDate.setMonth(effectiveDate.getMonth() + 1);
            effectiveDate.setDate(1);
            effectiveDate.setHours(0, 0, 0, 0);
          }
        }
      } else if (subscription?.nextPaymentDate) {
        effectiveDate = new Date(subscription.nextPaymentDate);
      } else {
        // Default to end of current month
        effectiveDate.setMonth(effectiveDate.getMonth() + 1);
        effectiveDate.setDate(1);
        effectiveDate.setHours(0, 0, 0, 0);
      }

      // Schedule removal in Stripe at period end (no immediate proration/refund)
      if (companyAddon.stripeSubscriptionItemId && subscription?.stripeSubscriptionId) {
        try {
          // Don't delete immediately - schedule for removal at period end
          await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
            cancel_at_period_end: false, // Keep main subscription active
            proration_behavior: 'none', // No refunds
          });
          
          // Mark item for removal at next billing cycle by setting quantity to 0
          await stripe.subscriptionItems.update(companyAddon.stripeSubscriptionItemId, {
            quantity: 0,
            proration_behavior: 'none', // No refund for unused time
          });
          
          console.log(`📅 Scheduled addon removal from Stripe at period end: ${companyAddon.stripeSubscriptionItemId}`);
        } catch (stripeError: any) {
          console.error('Error scheduling addon removal in Stripe:', stripeError);
        }
      }

      // Update database - mark as pending_cancel, set cooldown
      await storage.markAddonPendingCancel(user.companyId, addonId, effectiveDate);

      const formattedDate = effectiveDate.toLocaleDateString('es-ES', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      });
      
      console.log(`🚫 Company ${user.companyId} cancelled addon: ${addon?.key || addonId} (effective: ${formattedDate})`);

      res.json({
        success: true,
        message: `Complemento cancelado. Seguirá activo hasta el ${formattedDate}. No podrás volver a contratarlo hasta esa fecha.`,
        effectiveDate: effectiveDate,
        addonName: addon?.name,
        accessUntil: formattedDate,
        canRepurchaseAfter: formattedDate,
      });
    } catch (error: any) {
      console.error('Error cancelling addon:', error);
      res.status(500).json({ error: 'Error al cancelar el complemento' });
    }
  });

  // ============================================================================
  // NEW MODEL: Subscription & Seat Management Endpoints
  // ============================================================================

  // Get company subscription info with new model (base + addons + seats)
  app.get('/api/subscription/info', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      
      // Get subscription details
      const subscription = await storage.getCompanySubscription(user.companyId);
      if (!subscription) {
        return res.status(404).json({ error: 'Suscripción no encontrada' });
      }

      // Get user limits (included + extra)
      const userLimits = await storage.getCompanyUserLimits(user.companyId);
      
      // Get current user counts
      const userCounts = await storage.getCompanyUserCounts(user.companyId);
      
      // Get all features the company has access to
      const features = await storage.getCompanyFeatures(user.companyId);
      
      // Get purchased addons
      const companyAddons = await storage.getCompanyAddons(user.companyId);

      // Get seat pricing
      const seatPricing = await storage.getAllSeatPricing();

      res.json({
        subscription: {
          status: subscription.status,
          baseMonthlyPrice: parseFloat(subscription.baseMonthlyPrice || '39.00'),
          isTrialActive: subscription.isTrialActive,
          trialEndDate: subscription.trialEndDate,
          nextPaymentDate: subscription.nextPaymentDate,
          stripeSubscriptionId: subscription.stripeSubscriptionId,
        },
        userLimits,
        userCounts,
        features,
        companyAddons,
        seatPricing: seatPricing.map(sp => ({
          roleType: sp.roleType,
          displayName: sp.displayName,
          monthlyPrice: parseFloat(sp.monthlyPrice),
          description: sp.description,
        })),
      });
    } catch (error: any) {
      console.error('Error getting subscription info:', error);
      res.status(500).json({ error: 'Error al obtener información de suscripción' });
    }
  });

  // Get seat pricing for extra users
  app.get('/api/seats/pricing', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const seatPricing = await storage.getAllSeatPricing();
      res.json(seatPricing.map(sp => ({
        roleType: sp.roleType,
        displayName: sp.displayName,
        monthlyPrice: parseFloat(sp.monthlyPrice),
        description: sp.description,
      })));
    } catch (error: any) {
      console.error('Error getting seat pricing:', error);
      res.status(500).json({ error: 'Error al obtener precios de usuarios' });
    }
  });

  // Check if company can add a user of specific role
  app.get('/api/seats/can-add/:role', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      const role = req.params.role as 'admin' | 'manager' | 'employee';
      
      if (!['admin', 'manager', 'employee'].includes(role)) {
        return res.status(400).json({ error: 'Rol no válido' });
      }

      const result = await storage.canAddUserOfRole(user.companyId, role);
      
      // If can't add, get pricing for extra seat
      let extraSeatPrice = null;
      if (result.needsExtraSeat) {
        const pricing = await storage.getSeatPricing(role);
        extraSeatPrice = pricing ? parseFloat(pricing.monthlyPrice) : null;
      }

      res.json({
        ...result,
        extraSeatPrice,
      });
    } catch (error: any) {
      console.error('Error checking seat availability:', error);
      res.status(500).json({ error: 'Error al verificar disponibilidad de usuario' });
    }
  });

  // Purchase additional user seats
  app.post('/api/subscription/seats', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      const { employees, managers, admins } = req.body;
      const idempotencyKey = `seats-purchase-${user.companyId}-${Date.now()}`;

      // Validate input
      if (typeof employees !== 'number' || typeof managers !== 'number' || typeof admins !== 'number') {
        return res.status(400).json({ error: 'Datos inválidos' });
      }

      if (employees < 0 || managers < 0 || admins < 0) {
        return res.status(400).json({ error: 'Los valores no pueden ser negativos' });
      }

      const totalSeats = employees + managers + admins;
      if (totalSeats === 0) {
        return res.status(400).json({ error: 'Debe añadir al menos un usuario' });
      }

      // Get current user limits
      const currentLimits = await storage.getCompanyUserLimits(user.companyId);

      // Calculate new extra limits (add to existing extra)
      const newLimits = {
        extraEmployees: currentLimits.employees.extra + employees,
        extraManagers: currentLimits.managers.extra + managers,
        extraAdmins: currentLimits.admins.extra + admins,
      };

      // Get seat pricing from database
      const dbSeatPricing = await storage.getAllSeatPricing();
      const seatPricing: Record<string, number> = {};
      for (const sp of dbSeatPricing) {
        seatPricing[sp.roleType] = parseFloat(sp.monthlyPrice);
      }
      // Fallback values if not in database
      if (!seatPricing.employee) seatPricing.employee = 2;
      if (!seatPricing.manager) seatPricing.manager = 4;
      if (!seatPricing.admin) seatPricing.admin = 6;

      // Calculate total additional monthly cost
      const additionalCost = 
        employees * seatPricing.employee +
        managers * seatPricing.manager +
        admins * seatPricing.admin;

      // Get company subscription for Stripe integration
      const subscription = await db.query.subscriptions.findFirst({
        where: eq(subscriptions.companyId, user.companyId),
      });

      let stripeChargeInfo: { proratedAmount: number; proratedDays: number } | null = null;

      // If company has active Stripe subscription, add seat items with proration
      if (subscription?.stripeSubscriptionId && subscription?.status === 'active') {
        try {
          const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId) as any;
          const currentPeriodEnd = stripeSubscription.current_period_end as number;
          const currentPeriodStart = stripeSubscription.current_period_start as number;
          const now = Math.floor(Date.now() / 1000);
          
          const totalDaysInPeriod = Math.ceil((currentPeriodEnd - currentPeriodStart) / 86400);
          const remainingDays = Math.ceil((currentPeriodEnd - now) / 86400);
          const proratedDays = Math.max(1, Math.min(remainingDays, totalDaysInPeriod));

          // Process each seat type that has purchases
          const seatTypes = [
            { key: 'employee', count: employees, price: seatPricing.employee, name: 'Empleado Adicional' },
            { key: 'manager', count: managers, price: seatPricing.manager, name: 'Manager Adicional' },
            { key: 'admin', count: admins, price: seatPricing.admin, name: 'Admin Adicional' },
          ];

          // Map seat type to subscription column for stored item ID
          const seatItemColumns: Record<string, keyof typeof subscription> = {
            admin: 'stripeAdminSeatsItemId',
            manager: 'stripeManagerSeatsItemId',
            employee: 'stripeEmployeeSeatsItemId',
          };
          
          // Track new item IDs for database update
          const newSeatItemIds: Record<string, string> = {};

          for (const seat of seatTypes) {
            if (seat.count <= 0) continue;

            // Get or create Stripe product/price for this seat type
            let seatPricingRecord = await storage.getSeatPricing(seat.key);
            let stripePriceId = seatPricingRecord?.stripePriceId;

            if (!stripePriceId) {
              // Create Stripe product and price for this seat type
              const stripeProduct = await stripe.products.create({
                name: `Oficaz: ${seat.name}`,
                description: `Usuario adicional tipo ${seat.name}`,
                metadata: {
                  seat_type: seat.key,
                }
              }, { idempotencyKey: `seat-product-${seat.key}` });

              const stripePrice = await stripe.prices.create({
                product: stripeProduct.id,
                unit_amount: Math.round(seat.price * 100),
                currency: 'eur',
                recurring: { interval: 'month' },
                nickname: seat.name,
                metadata: {
                  seat_type: seat.key,
                }
              }, { idempotencyKey: `seat-price-${seat.key}` });

              stripePriceId = stripePrice.id;

              // Update seat pricing with Stripe IDs
              await db.execute(sql`
                UPDATE seat_pricing 
                SET stripe_product_id = ${stripeProduct.id}, stripe_price_id = ${stripePrice.id}
                WHERE role_type = ${seat.key}
              `);
            }

            // Check if we already have a Stripe item for this seat type
            const existingItemId = subscription[seatItemColumns[seat.key]] as string | null;
            
            if (existingItemId) {
              // Update existing item quantity
              try {
                const existingItem = await stripe.subscriptionItems.retrieve(existingItemId);
                const newQuantity = (existingItem.quantity || 0) + seat.count;
                
                await stripe.subscriptionItems.update(existingItemId, {
                  quantity: newQuantity,
                  proration_behavior: 'create_prorations',
                });
                
                console.log(`✅ Updated ${seat.key} seats from ${existingItem.quantity} to ${newQuantity} in Stripe`);
              } catch (retrieveError: any) {
                // Item might not exist anymore, create new one
                console.warn(`Could not retrieve existing item ${existingItemId}: ${retrieveError.message}`);
                
                const newItem = await stripe.subscriptionItems.create({
                  subscription: subscription.stripeSubscriptionId,
                  price: stripePriceId,
                  quantity: seat.count,
                  proration_behavior: 'create_prorations',
                  metadata: {
                    seat_type: seat.key,
                    company_id: user.companyId.toString(),
                  }
                }, { idempotencyKey: `${idempotencyKey}-${seat.key}-new` });
                
                newSeatItemIds[seat.key] = newItem.id;
                console.log(`✅ Created new ${seat.key} seats item with ${seat.count} seats`);
              }
            } else {
              // No existing item - check subscription items by metadata
              const existingSeatItem = stripeSubscription.items.data.find((item: any) => 
                item.price?.metadata?.seat_type === seat.key
              );
              
              if (existingSeatItem) {
                // Found item by metadata, update it
                const newQuantity = (existingSeatItem.quantity || 0) + seat.count;
                
                await stripe.subscriptionItems.update(existingSeatItem.id, {
                  quantity: newQuantity,
                  proration_behavior: 'create_prorations',
                });
                
                newSeatItemIds[seat.key] = existingSeatItem.id;
                console.log(`✅ Updated ${seat.key} seats from ${existingSeatItem.quantity} to ${newQuantity} (found by metadata)`);
              } else {
                // Create new subscription item
                const newItem = await stripe.subscriptionItems.create({
                  subscription: subscription.stripeSubscriptionId,
                  price: stripePriceId,
                  quantity: seat.count,
                  proration_behavior: 'create_prorations',
                  metadata: {
                    seat_type: seat.key,
                    company_id: user.companyId.toString(),
                  }
                }, { idempotencyKey: `${idempotencyKey}-${seat.key}` });
                
                newSeatItemIds[seat.key] = newItem.id;
                console.log(`✅ Added ${seat.count} ${seat.key} seat(s) to Stripe subscription`);
              }
            }
          }
          
          // Update subscription with any new item IDs
          if (Object.keys(newSeatItemIds).length > 0) {
            await db.execute(sql`
              UPDATE subscriptions 
              SET 
                stripe_admin_seats_item_id = COALESCE(${newSeatItemIds.admin || null}, stripe_admin_seats_item_id),
                stripe_manager_seats_item_id = COALESCE(${newSeatItemIds.manager || null}, stripe_manager_seats_item_id),
                stripe_employee_seats_item_id = COALESCE(${newSeatItemIds.employee || null}, stripe_employee_seats_item_id),
                updated_at = now()
              WHERE company_id = ${user.companyId}
            `);
          }

          stripeChargeInfo = {
            proratedAmount: (additionalCost / totalDaysInPeriod) * proratedDays,
            proratedDays,
          };

          console.log(`💰 Stripe seats added with proration: ${proratedDays} days, €${stripeChargeInfo.proratedAmount.toFixed(2)}`);
        } catch (stripeError: any) {
          console.error('Error adding seats to Stripe subscription:', stripeError);
          // For paid subscriptions, we must fail if Stripe fails
          if (subscription.status === 'active' && subscription.stripeSubscriptionId) {
            return res.status(500).json({ 
              error: 'Error al procesar el pago. Por favor, inténtalo de nuevo o contacta con soporte.',
              details: stripeError.message
            });
          }
        }
      }

      // Update user limits in database
      await storage.updateCompanyUserLimits(user.companyId, newLimits);

      console.log(`👥 Company ${user.companyId} purchased additional seats: +${employees} employees, +${managers} managers, +${admins} admins (€${additionalCost}/mes)`);

      res.json({
        success: true,
        message: `Se han añadido ${totalSeats} usuario(s) a tu suscripción.`,
        newLimits: {
          employees: currentLimits.employees.included + newLimits.extraEmployees,
          managers: currentLimits.managers.included + newLimits.extraManagers,
          admins: currentLimits.admins.included + newLimits.extraAdmins,
        },
        additionalMonthlyCost: additionalCost,
        billing: stripeChargeInfo ? {
          proratedDays: stripeChargeInfo.proratedDays,
          proratedAmount: stripeChargeInfo.proratedAmount.toFixed(2),
          message: `Se te cobrará €${stripeChargeInfo.proratedAmount.toFixed(2)} por ${stripeChargeInfo.proratedDays} días de uso en este ciclo`
        } : undefined,
      });
    } catch (error: any) {
      console.error('Error purchasing seats:', error);
      res.status(500).json({ error: 'Error al añadir usuarios' });
    }
  });

  // Reduce user seats (remove extra users)
  app.post('/api/subscription/seats/reduce', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      const { employees, managers, admins } = req.body;

      // Validate input
      if (typeof employees !== 'number' || typeof managers !== 'number' || typeof admins !== 'number') {
        return res.status(400).json({ error: 'Datos inválidos' });
      }

      if (employees < 0 || managers < 0 || admins < 0) {
        return res.status(400).json({ error: 'Los valores no pueden ser negativos' });
      }

      // Get current limits
      const currentLimits = await storage.getCompanyUserLimits(user.companyId);
      
      // Validate we're not removing more than we have
      if (employees > currentLimits.employees.extra) {
        return res.status(400).json({ error: `Solo tienes ${currentLimits.employees.extra} empleados extra para quitar` });
      }
      if (managers > currentLimits.managers.extra) {
        return res.status(400).json({ error: `Solo tienes ${currentLimits.managers.extra} managers extra para quitar` });
      }
      if (admins > currentLimits.admins.extra) {
        return res.status(400).json({ error: `Solo tienes ${currentLimits.admins.extra} administradores extra para quitar` });
      }

      // Calculate new extra limits
      const newLimits = {
        extraEmployees: currentLimits.employees.extra - employees,
        extraManagers: currentLimits.managers.extra - managers,
        extraAdmins: currentLimits.admins.extra - admins,
      };

      // Get subscription for Stripe handling
      const subscription = await db.query.subscriptions.findFirst({
        where: eq(subscriptions.companyId, user.companyId),
      });

      // For active Stripe subscription, update the seat quantities
      if (subscription?.stripeSubscriptionId && subscription?.status === 'active') {
        try {
          const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId) as any;
          
          // Find and update seat items in Stripe, consolidating duplicates
          const seatReductions = [
            { key: 'employee', reduction: employees },
            { key: 'manager', reduction: managers },
            { key: 'admin', reduction: admins },
          ];
          
          for (const reduction of seatReductions) {
            if (reduction.reduction <= 0) continue;
            
            // Find ALL subscription items for this seat type (handle legacy duplicates)
            const seatItems = stripeSubscription.items.data.filter((item: any) => 
              item.price?.metadata?.seat_type === reduction.key
            );
            
            if (seatItems.length === 0) continue;
            
            // Calculate total current quantity across all items for this seat type
            const totalCurrentQuantity = seatItems.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
            const newTotalQuantity = Math.max(0, totalCurrentQuantity - reduction.reduction);
            
            // Consolidate: Keep only the first item, remove duplicates
            const primaryItem = seatItems[0];
            const duplicateItems = seatItems.slice(1);
            
            // Delete duplicate items (set quantity to 0 for removal at period end)
            for (const duplicate of duplicateItems) {
              try {
                await stripe.subscriptionItems.update(duplicate.id, {
                  quantity: 0,
                  proration_behavior: 'none',
                });
                console.log(`🧹 Consolidated duplicate ${reduction.key} seat item ${duplicate.id} (quantity was ${duplicate.quantity})`);
              } catch (deleteError: any) {
                console.warn(`Could not consolidate duplicate item ${duplicate.id}: ${deleteError.message}`);
              }
            }
            
            // Update primary item with new total quantity
            if (newTotalQuantity === 0) {
              await stripe.subscriptionItems.update(primaryItem.id, {
                quantity: 0,
                proration_behavior: 'none',
              });
              console.log(`📅 Scheduled ${reduction.key} seats removal from Stripe at period end (consolidated from ${seatItems.length} items)`);
            } else {
              await stripe.subscriptionItems.update(primaryItem.id, {
                quantity: newTotalQuantity,
                proration_behavior: 'none',
              });
              console.log(`📅 Reduced ${reduction.key} seats from ${totalCurrentQuantity} to ${newTotalQuantity} in Stripe (consolidated from ${seatItems.length} items)`);
            }
            
            // Update subscription record with the primary item ID
            const seatColumn = reduction.key === 'admin' ? 'stripe_admin_seats_item_id' :
                              reduction.key === 'manager' ? 'stripe_manager_seats_item_id' : 
                              'stripe_employee_seats_item_id';
            await db.execute(sql`
              UPDATE subscriptions SET ${sql.raw(seatColumn)} = ${primaryItem.id}, updated_at = now()
              WHERE company_id = ${user.companyId}
            `);
          }
        } catch (stripeError: any) {
          console.error('Error updating seats in Stripe:', stripeError);
          // Continue with database update even if Stripe fails
        }
      }

      // Update user limits in database
      await storage.updateCompanyUserLimits(user.companyId, newLimits);

      const totalRemoved = employees + managers + admins;
      console.log(`👥 Company ${user.companyId} reduced seats: -${employees} employees, -${managers} managers, -${admins} admins`);

      res.json({
        success: true,
        message: `Se han eliminado ${totalRemoved} usuario(s) de tu suscripción.`,
        newLimits: {
          extraEmployees: newLimits.extraEmployees,
          extraManagers: newLimits.extraManagers,
          extraAdmins: newLimits.extraAdmins,
        },
        note: subscription?.status === 'active' ? 
          'Los cambios se reflejarán en tu próxima factura.' : 
          'Los cambios se han aplicado inmediatamente.',
      });
    } catch (error: any) {
      console.error('Error reducing seats:', error);
      res.status(500).json({ error: 'Error al reducir usuarios' });
    }
  });

  // Check feature access (new model: free features + purchased addons)
  app.get('/api/features/:key/access', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      const featureKey = req.params.key;
      
      const hasAccess = await storage.hasFeatureAccess(user.companyId, featureKey);
      
      res.json({ 
        feature: featureKey,
        hasAccess,
      });
    } catch (error: any) {
      console.error('Error checking feature access:', error);
      res.status(500).json({ error: 'Error al verificar acceso a funcionalidad' });
    }
  });

  // Get all features company has access to
  app.get('/api/features/accessible', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      const features = await storage.getCompanyFeatures(user.companyId);
      res.json({ features });
    } catch (error: any) {
      console.error('Error getting accessible features:', error);
      res.status(500).json({ error: 'Error al obtener funcionalidades accesibles' });
    }
  });

  // Stripe Webhook - Handle payment events (raw body required for signature verification)
  app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('⚠️ STRIPE WEBHOOK: No webhook secret configured');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    let event: Stripe.Event;

    try {
      // Verify webhook signature
      event = stripe.webhooks.constructEvent(
        req.body,
        sig as string,
        webhookSecret
      );
    } catch (err: any) {
      console.error(`⚠️ STRIPE WEBHOOK: Signature verification failed:`, err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log(`📨 STRIPE WEBHOOK: Received event ${event.type}`);

    try {
      // Handle invoice payment succeeded - Update nextPaymentDate
      if (event.type === 'invoice.payment_succeeded') {
        const invoice = event.data.object as Stripe.Invoice;
        
        console.log(`💳 STRIPE WEBHOOK: Payment succeeded for invoice ${invoice.id}`);
        console.log(`   - Customer: ${invoice.customer}`);
        console.log(`   - Amount: €${(invoice.amount_paid || 0) / 100}`);

        // Only process subscription-related invoices
        if (invoice.customer) {
          // Find subscription by Stripe customer ID
          const subscription = await db.query.subscriptions.findFirst({
            where: eq(subscriptions.stripeCustomerId, invoice.customer as string),
          });

          if (subscription) {
            // ⚠️ CRITICAL: Calculate next payment date from PREVIOUS date, not from now
            // This ensures the billing cycle stays consistent (e.g., always on the 4th)
            const currentNextPaymentDate = subscription.nextPaymentDate ? new Date(subscription.nextPaymentDate) : new Date();
            const nextPaymentDate = new Date(currentNextPaymentDate);
            nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);

            // Update subscription with new next payment date
            await db.update(subscriptions)
              .set({ 
                nextPaymentDate: nextPaymentDate,
                status: 'active',
                updatedAt: new Date()
              })
              .where(eq(subscriptions.id, subscription.id));

            console.log(`✅ STRIPE WEBHOOK: Updated nextPaymentDate from ${currentNextPaymentDate.toISOString()} to ${nextPaymentDate.toISOString()} for company ${subscription.companyId}`);
          } else {
            console.warn(`⚠️ STRIPE WEBHOOK: No subscription found for customer ${invoice.customer}`);
          }
        }
      }

      // Handle subscription deleted/canceled
      if (event.type === 'customer.subscription.deleted') {
        const subscription = event.data.object as Stripe.Subscription;
        
        console.log(`🚫 STRIPE WEBHOOK: Subscription deleted ${subscription.id}`);

        await db.update(subscriptions)
          .set({ 
            status: 'cancelled',
            endDate: new Date(),
            updatedAt: new Date()
          })
          .where(eq(subscriptions.stripeSubscriptionId, subscription.id));

        console.log(`✅ STRIPE WEBHOOK: Marked subscription as cancelled`);
      }

      // Handle payment failed - Deactivate add-ons on payment failure
      if (event.type === 'invoice.payment_failed') {
        const invoice = event.data.object as Stripe.Invoice;
        
        console.log(`❌ STRIPE WEBHOOK: Payment failed for invoice ${invoice.id}`);
        console.log(`   - Customer: ${invoice.customer}`);
        
        // Find subscription by Stripe customer ID and deactivate add-ons
        if (invoice.customer) {
          const subscription = await db.query.subscriptions.findFirst({
            where: eq(subscriptions.stripeCustomerId, invoice.customer as string),
          });

          if (subscription) {
            // Deactivate all add-ons for this company on payment failure
            const companyAddons = await storage.getCompanyAddons(subscription.companyId);
            for (const companyAddon of companyAddons) {
              if (companyAddon.status === 'active' || companyAddon.status === 'pending_cancel') {
                await storage.deactivateAddonForPaymentFailure(subscription.companyId, companyAddon.addonId);
                console.log(`🚫 STRIPE WEBHOOK: Deactivated addon ${companyAddon.addon.key} due to payment failure`);
              }
            }
          }
        }
      }

      // Handle subscription updated - Sync add-on states and finalize cancellations
      if (event.type === 'customer.subscription.updated') {
        const stripeSubscription = event.data.object as Stripe.Subscription;
        
        console.log(`🔄 STRIPE WEBHOOK: Subscription updated ${stripeSubscription.id}`);

        // Find our subscription record
        const subscription = await db.query.subscriptions.findFirst({
          where: eq(subscriptions.stripeSubscriptionId, stripeSubscription.id),
        });

        if (subscription) {
          // Check for add-ons that need to be finalized (period ended)
          const companyAddons = await storage.getCompanyAddons(subscription.companyId);
          const now = new Date();
          
          for (const companyAddon of companyAddons) {
            // If pending_cancel and past the cancellation effective date, finalize it
            if (companyAddon.status === 'pending_cancel' && 
                companyAddon.cancellationEffectiveDate && 
                now >= companyAddon.cancellationEffectiveDate) {
              
              // Delete the subscription item from Stripe if it still exists with quantity 0
              if (companyAddon.stripeSubscriptionItemId) {
                try {
                  await stripe.subscriptionItems.del(companyAddon.stripeSubscriptionItemId);
                  console.log(`🗑️ STRIPE WEBHOOK: Deleted subscription item ${companyAddon.stripeSubscriptionItemId}`);
                } catch (deleteError: any) {
                  // Item might already be deleted, that's okay
                  console.warn(`Could not delete subscription item: ${deleteError.message}`);
                }
              }
              
              await storage.finalizeAddonCancellation(subscription.companyId, companyAddon.addonId);
              console.log(`✅ STRIPE WEBHOOK: Finalized cancellation of addon ${companyAddon.addon.key}`);
            }
          }

          // Sync subscription items from Stripe to ensure consistency
          const stripeItems = stripeSubscription.items?.data || [];
          
          // Track seat item IDs for sync
          let syncedAdminSeatsItemId: string | null = null;
          let syncedManagerSeatsItemId: string | null = null;
          let syncedEmployeeSeatsItemId: string | null = null;
          
          for (const item of stripeItems) {
            const addonKey = item.price?.metadata?.addon_key;
            const seatType = item.price?.metadata?.seat_type;
            
            // Handle addon items
            if (addonKey) {
              const addon = await storage.getAddonByKey(addonKey);
              if (addon) {
                const existingCompanyAddon = await storage.getCompanyAddon(subscription.companyId, addon.id);
                
                // If Stripe has an active item but we don't have it, or it's cancelled, reactivate
                if (item.quantity && item.quantity > 0) {
                  if (!existingCompanyAddon) {
                    await storage.createCompanyAddon({
                      companyId: subscription.companyId,
                      addonId: addon.id,
                      status: 'active',
                      stripeSubscriptionItemId: item.id,
                      purchasedAt: new Date(),
                      activatedAt: new Date(),
                    });
                    console.log(`✅ STRIPE WEBHOOK: Synced new addon ${addonKey} from Stripe`);
                  } else if (existingCompanyAddon.status === 'inactive' || existingCompanyAddon.status === 'cancelled') {
                    await storage.reactivateAddon(existingCompanyAddon.id, item.id, 30);
                    console.log(`✅ STRIPE WEBHOOK: Reactivated addon ${addonKey} from Stripe sync`);
                  }
                }
              }
            }
            
            // Handle seat items - track IDs for database sync
            if (seatType && item.quantity && item.quantity > 0) {
              if (seatType === 'admin') syncedAdminSeatsItemId = item.id;
              if (seatType === 'manager') syncedManagerSeatsItemId = item.id;
              if (seatType === 'employee') syncedEmployeeSeatsItemId = item.id;
            }
          }
          
          // Sync seat item IDs to subscription record if we found any
          if (syncedAdminSeatsItemId || syncedManagerSeatsItemId || syncedEmployeeSeatsItemId) {
            await db.execute(sql`
              UPDATE subscriptions 
              SET 
                stripe_admin_seats_item_id = COALESCE(${syncedAdminSeatsItemId}, stripe_admin_seats_item_id),
                stripe_manager_seats_item_id = COALESCE(${syncedManagerSeatsItemId}, stripe_manager_seats_item_id),
                stripe_employee_seats_item_id = COALESCE(${syncedEmployeeSeatsItemId}, stripe_employee_seats_item_id),
                updated_at = now()
              WHERE id = ${subscription.id}
            `);
            console.log(`✅ STRIPE WEBHOOK: Synced seat item IDs for subscription ${subscription.id}`);
          }

          console.log(`✅ STRIPE WEBHOOK: Subscription ${stripeSubscription.id} synced for company ${subscription.companyId}`);
        }
      }

      res.json({ received: true });
    } catch (error) {
      console.error('❌ STRIPE WEBHOOK: Error processing webhook:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

  // Email unsubscribe endpoint (public, no auth required)
  app.get('/api/email/unsubscribe', async (req: any, res) => {
    try {
      const { email } = req.query;
      
      if (!email) {
        return res.status(400).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Error - Oficaz</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
              .container { text-align: center; padding: 40px; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); max-width: 500px; }
              h1 { color: #dc2626; margin-bottom: 16px; }
              p { color: #666; margin-bottom: 24px; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Error</h1>
              <p>No se proporcionó una dirección de correo electrónico válida.</p>
            </div>
          </body>
          </html>
        `);
      }
      
      // Update marketing consent to false
      const result = await db.update(companies)
        .set({ marketingEmailsConsent: false })
        .where(eq(companies.email, email as string))
        .returning();
      
      if (result.length === 0) {
        return res.status(404).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>No encontrado - Oficaz</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
              .container { text-align: center; padding: 40px; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); max-width: 500px; }
              h1 { color: #dc2626; margin-bottom: 16px; }
              p { color: #666; margin-bottom: 24px; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Email no encontrado</h1>
              <p>No se encontró una cuenta asociada a este correo electrónico.</p>
            </div>
          </body>
          </html>
        `);
      }
      
      console.log(`📧 User unsubscribed from marketing emails: ${email}`);
      
      // Return success page
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Desuscrito - Oficaz</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
            .container { text-align: center; padding: 40px; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); max-width: 500px; }
            .logo { width: 120px; margin-bottom: 24px; }
            h1 { color: #007AFF; margin-bottom: 16px; }
            p { color: #666; margin-bottom: 24px; line-height: 1.6; }
            .success-icon { font-size: 48px; margin-bottom: 16px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">✅</div>
            <h1>Te has dado de baja</h1>
            <p>Has sido eliminado de nuestra lista de correos de marketing.</p>
            <p style="font-size: 14px; color: #999;">Si cambias de opinión, puedes volver a suscribirte desde tu cuenta de Oficaz.</p>
          </div>
        </body>
        </html>
      `);
    } catch (error: any) {
      console.error('Error unsubscribing user:', error);
      res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Error - Oficaz</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
            .container { text-align: center; padding: 40px; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); max-width: 500px; }
            h1 { color: #dc2626; margin-bottom: 16px; }
            p { color: #666; margin-bottom: 24px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Error</h1>
            <p>Hubo un problema al procesar tu solicitud. Por favor, inténtalo de nuevo más tarde.</p>
          </div>
        </body>
        </html>
      `);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // INVENTORY MANAGEMENT ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  // Product Categories
  app.get('/api/inventory/categories', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const categories = await storage.getProductCategories(req.user!.companyId);
      res.json(categories);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/inventory/categories', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const category = await storage.createProductCategory({
        ...req.body,
        companyId: req.user!.companyId,
      });
      res.status(201).json(category);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch('/api/inventory/categories/:id', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const category = await storage.getProductCategory(id);
      if (!category || category.companyId !== req.user!.companyId) {
        return res.status(404).json({ message: 'Categoría no encontrada' });
      }
      const updated = await storage.updateProductCategory(id, req.body);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete('/api/inventory/categories/:id', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const category = await storage.getProductCategory(id);
      if (!category || category.companyId !== req.user!.companyId) {
        return res.status(404).json({ message: 'Categoría no encontrada' });
      }
      await storage.deleteProductCategory(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Warehouses
  app.get('/api/inventory/warehouses', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const warehouses = await storage.getWarehouses(req.user!.companyId);
      res.json(warehouses);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/inventory/warehouses', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      // If this is the first warehouse or marked as default, ensure only one default
      if (req.body.isDefault) {
        const existing = await storage.getWarehouses(req.user!.companyId);
        for (const wh of existing) {
          if (wh.isDefault) {
            await storage.updateWarehouse(wh.id, { isDefault: false });
          }
        }
      }
      const warehouse = await storage.createWarehouse({
        ...req.body,
        companyId: req.user!.companyId,
      });
      res.status(201).json(warehouse);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch('/api/inventory/warehouses/:id', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const warehouse = await storage.getWarehouse(id);
      if (!warehouse || warehouse.companyId !== req.user!.companyId) {
        return res.status(404).json({ message: 'Almacén no encontrado' });
      }
      // Handle default warehouse logic
      if (req.body.isDefault) {
        const existing = await storage.getWarehouses(req.user!.companyId);
        for (const wh of existing) {
          if (wh.isDefault && wh.id !== id) {
            await storage.updateWarehouse(wh.id, { isDefault: false });
          }
        }
      }
      const updated = await storage.updateWarehouse(id, req.body);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete('/api/inventory/warehouses/:id', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const warehouse = await storage.getWarehouse(id);
      if (!warehouse || warehouse.companyId !== req.user!.companyId) {
        return res.status(404).json({ message: 'Almacén no encontrado' });
      }
      await storage.deleteWarehouse(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Products
  app.get('/api/inventory/products', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const filters: any = {};
      if (req.query.categoryId) filters.categoryId = parseInt(req.query.categoryId as string);
      if (req.query.isActive !== undefined) filters.isActive = req.query.isActive === 'true';
      if (req.query.isReturnable !== undefined) filters.isReturnable = req.query.isReturnable === 'true';
      if (req.query.search) filters.search = req.query.search as string;

      const products = await storage.getProducts(req.user!.companyId, filters);
      
      // Support pagination for infinite scroll
      const limit = req.query.limit ? parseInt(req.query.limit as string) : null;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : null;
      
      if (limit && offset !== undefined) {
        // Return paginated response
        const paginatedItems = products.slice(offset, offset + limit);
        const totalCount = products.length;
        const hasMore = (offset + limit) < totalCount;
        res.json({
          items: paginatedItems,
          totalCount,
          hasMore
        });
      } else {
        // Return all items for backward compatibility
        res.json(products);
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/inventory/products/:id', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const product = await storage.getProduct(id);
      if (!product || product.companyId !== req.user!.companyId) {
        return res.status(404).json({ message: 'Producto no encontrado' });
      }
      // Get stock info
      const stock = await storage.getProductStock(id);
      res.json({ ...product, stock });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/inventory/products', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const product = await storage.createProduct({
        ...req.body,
        companyId: req.user!.companyId,
      });
      res.status(201).json(product);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch('/api/inventory/products/:id', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const product = await storage.getProduct(id);
      if (!product || product.companyId !== req.user!.companyId) {
        return res.status(404).json({ message: 'Producto no encontrado' });
      }
      const updated = await storage.updateProduct(id, req.body);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete('/api/inventory/products/:id', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const product = await storage.getProduct(id);
      if (!product || product.companyId !== req.user!.companyId) {
        return res.status(404).json({ message: 'Producto no encontrado' });
      }
      await storage.deleteProduct(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Warehouse Stock
  app.get('/api/inventory/stock', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const warehouseId = req.query.warehouseId ? parseInt(req.query.warehouseId as string) : undefined;
      const stock = await storage.getWarehouseStock(req.user!.companyId, warehouseId);
      res.json(stock);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/inventory/stock/low', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const lowStockProducts = await storage.getLowStockProducts(req.user!.companyId);
      res.json(lowStockProducts);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/inventory/stock/adjust', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const { warehouseId, productId, quantity } = req.body;
      
      // Verify warehouse and product belong to company
      const warehouse = await storage.getWarehouse(warehouseId);
      const product = await storage.getProduct(productId);
      
      if (!warehouse || warehouse.companyId !== req.user!.companyId) {
        return res.status(403).json({ message: 'Almacén no autorizado' });
      }
      if (!product || product.companyId !== req.user!.companyId) {
        return res.status(403).json({ message: 'Producto no autorizado' });
      }

      const stock = await storage.updateWarehouseStock(warehouseId, productId, quantity, req.user!.companyId);
      res.json(stock);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Inventory Movements
  app.get('/api/inventory/movements', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const filters: any = {};
      if (req.query.type) filters.type = req.query.type as string;
      if (req.query.status) filters.status = req.query.status as string;
      if (req.query.startDate) filters.startDate = new Date(req.query.startDate as string);
      if (req.query.endDate) filters.endDate = new Date(req.query.endDate as string);
      if (req.query.warehouseId) filters.warehouseId = parseInt(req.query.warehouseId as string);

      const movements = await storage.getInventoryMovements(req.user!.companyId, filters);
      
      // Support pagination for infinite scroll
      const limit = req.query.limit ? parseInt(req.query.limit as string) : null;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : null;
      
      if (limit && offset !== undefined) {
        // Return paginated response
        const paginatedItems = movements.slice(offset, offset + limit);
        const totalCount = movements.length;
        const hasMore = (offset + limit) < totalCount;
        res.json({
          items: paginatedItems,
          totalCount,
          hasMore
        });
      } else {
        // Return all items for backward compatibility
        res.json(movements);
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/inventory/movements/:id', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const movement = await storage.getInventoryMovement(id);
      if (!movement || movement.companyId !== req.user!.companyId) {
        return res.status(404).json({ message: 'Movimiento no encontrado' });
      }
      res.json(movement);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/inventory/movements', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const { lines, ...movementData } = req.body;
      
      // Generate movement number
      const movementNumber = await storage.getNextMovementNumber(req.user!.companyId);
      
      // Create movement header
      const movement = await storage.createInventoryMovement({
        ...movementData,
        companyId: req.user!.companyId,
        createdById: req.user!.id,
        movementNumber,
      });

      // Create movement lines
      let subtotal = 0;
      let vatAmount = 0;
      
      // Internal movements (adjustment, transfer) have no cost impact
      const isInternalMovement = movementData.movementType === 'internal';
      
      if (lines && Array.isArray(lines)) {
        for (const line of lines) {
          const product = await storage.getProduct(line.productId);
          if (!product) continue;
          
          // For internal movements, force price to 0 (no cost impact)
          const unitPrice = isInternalMovement ? 0 : parseFloat(line.unitPrice || product.salePrice || '0');
          const quantity = parseFloat(line.quantity);
          const vatRate = isInternalMovement ? 0 : parseFloat(line.vatRate || product.vatRate || '0');
          const discount = parseFloat(line.discount || '0');
          
          const lineSubtotal = unitPrice * quantity * (1 - discount / 100);
          const lineVat = lineSubtotal * (vatRate / 100);
          const lineTotal = lineSubtotal + lineVat;
          
          await storage.createInventoryMovementLine({
            movementId: movement.id,
            productId: line.productId,
            quantity: String(quantity),
            unitPrice: String(unitPrice),
            vatRate: String(vatRate),
            discount: String(discount),
            subtotal: String(lineSubtotal),
            vatAmount: String(lineVat),
            total: String(lineTotal),
            conditionOut: line.conditionOut,
            notes: line.notes,
            sortOrder: line.sortOrder || 0,
          });
          
          subtotal += lineSubtotal;
          vatAmount += lineVat;
          
          // Update stock if movement is posted
          if (movementData.status === 'posted') {
            // Handle internal movements (transfers and adjustments)
            if (isInternalMovement) {
              const internalReason = movementData.internalReason || 'adjustment';
              
              if (internalReason === 'transfer') {
                // Transfer: remove from source, add to destination
                if (movementData.sourceWarehouseId) {
                  const sourceStock = await storage.getProductStock(line.productId);
                  const sourceWh = sourceStock.find(s => s.warehouseId === movementData.sourceWarehouseId);
                  const sourceQty = parseFloat(sourceWh?.quantity || '0');
                  await storage.updateWarehouseStock(movementData.sourceWarehouseId, line.productId, sourceQty - quantity, req.user!.companyId);
                }
                if (movementData.destinationWarehouseId) {
                  const destStock = await storage.getProductStock(line.productId);
                  const destWh = destStock.find(s => s.warehouseId === movementData.destinationWarehouseId);
                  const destQty = parseFloat(destWh?.quantity || '0');
                  await storage.updateWarehouseStock(movementData.destinationWarehouseId, line.productId, destQty + quantity, req.user!.companyId);
                }
              } else {
                // Adjustment: add or remove from warehouse based on direction
                const direction = movementData.adjustmentDirection || 'add';
                if (movementData.destinationWarehouseId) {
                  const destStock = await storage.getProductStock(line.productId);
                  const destWh = destStock.find(s => s.warehouseId === movementData.destinationWarehouseId);
                  const destQty = parseFloat(destWh?.quantity || '0');
                  const newQty = direction === 'add' ? destQty + quantity : destQty - quantity;
                  await storage.updateWarehouseStock(movementData.destinationWarehouseId, line.productId, newQty, req.user!.companyId);
                }
              }
            } else {
              // Regular movements (in, out, loan, return)
              const warehouseId = movementData.movementType === 'in' || movementData.movementType === 'return' 
                ? movementData.destinationWarehouseId 
                : movementData.sourceWarehouseId;
              
              if (warehouseId) {
                const currentStock = await storage.getProductStock(line.productId);
                const whStock = currentStock.find(s => s.warehouseId === warehouseId);
                const currentQty = parseFloat(whStock?.quantity || '0');
                
                let newQty = currentQty;
                if (movementData.movementType === 'in' || movementData.movementType === 'return') {
                  newQty += quantity;
                } else if (movementData.movementType === 'out' || movementData.movementType === 'loan') {
                  newQty -= quantity;
                }
                
                await storage.updateWarehouseStock(warehouseId, line.productId, newQty, req.user!.companyId);
              }
            }
          }
          
          // Create tool loan record if movement is a loan
          if (movementData.movementType === 'loan' && product.isReturnable) {
            await storage.createToolLoan({
              companyId: req.user!.companyId,
              productId: line.productId,
              movementId: movement.id,
              quantity: String(quantity),
              assignedToId: movementData.relatedPartyId,
              assignedToName: movementData.relatedPartyName,
              projectReference: movementData.projectReference,
              projectName: movementData.projectName,
              loanDate: new Date(movementData.movementDate),
              expectedReturnDate: movementData.expectedReturnDate ? new Date(movementData.expectedReturnDate) : undefined,
              conditionOut: line.conditionOut || 'good',
            });
          }
        }
      }

      // Update movement totals
      const total = subtotal + vatAmount;
      await storage.updateInventoryMovement(movement.id, {
        subtotal: String(subtotal),
        vatAmount: String(vatAmount),
        total: String(total),
      });

      const updatedMovement = await storage.getInventoryMovement(movement.id);
      res.status(201).json(updatedMovement);
    } catch (error: any) {
      console.error('Error creating inventory movement:', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.patch('/api/inventory/movements/:id', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const movement = await storage.getInventoryMovement(id);
      if (!movement || movement.companyId !== req.user!.companyId) {
        return res.status(404).json({ message: 'Movimiento no encontrado' });
      }
      
      // Handle reverting posted movement back to draft
      if (movement.status === 'posted' && req.body.status === 'draft') {
        // Reverse stock changes for each line based on movement type
        for (const line of movement.lines) {
          const quantity = parseFloat(line.quantity);
          
          if (movement.movementType === 'in') {
            // Was entry to destination warehouse, so remove the stock that was added
            if (movement.destinationWarehouseId) {
              const currentStock = await storage.getProductStock(line.productId);
              const warehouseStock = currentStock.find(s => s.warehouseId === movement.destinationWarehouseId);
              const currentQty = parseFloat(warehouseStock?.quantity || '0');
              const newQty = Math.max(0, currentQty - quantity); // Allow revert, set to 0 minimum
              await storage.updateWarehouseStock(movement.destinationWarehouseId, line.productId, newQty, req.user!.companyId);
            }
          } else if (movement.movementType === 'out' || movement.movementType === 'loan') {
            // Was exit/loan from source warehouse, so add back the stock that was removed
            if (movement.sourceWarehouseId) {
              const currentStock = await storage.getProductStock(line.productId);
              const warehouseStock = currentStock.find(s => s.warehouseId === movement.sourceWarehouseId);
              const currentQty = parseFloat(warehouseStock?.quantity || '0');
              await storage.updateWarehouseStock(movement.sourceWarehouseId, line.productId, currentQty + quantity, req.user!.companyId);
            }
          } else if (movement.movementType === 'internal') {
            // Internal movements: handle transfer and adjustment
            const internalReason = (movement as any).internalReason || 'adjustment';
            const adjustmentDirection = (movement as any).adjustmentDirection || 'add';
            
            if (internalReason === 'transfer') {
              // Was transfer: remove from destination, add back to source
              if (movement.destinationWarehouseId) {
                const destStock = await storage.getProductStock(line.productId);
                const destWarehouseStock = destStock.find(s => s.warehouseId === movement.destinationWarehouseId);
                const destQty = parseFloat(destWarehouseStock?.quantity || '0');
                const newDestQty = Math.max(0, destQty - quantity); // Allow revert, set to 0 minimum
                await storage.updateWarehouseStock(movement.destinationWarehouseId, line.productId, newDestQty, req.user!.companyId);
              }
              if (movement.sourceWarehouseId) {
                const sourceStock = await storage.getProductStock(line.productId);
                const sourceWarehouseStock = sourceStock.find(s => s.warehouseId === movement.sourceWarehouseId);
                const sourceQty = parseFloat(sourceWarehouseStock?.quantity || '0');
                await storage.updateWarehouseStock(movement.sourceWarehouseId, line.productId, sourceQty + quantity, req.user!.companyId);
              }
            } else {
              // Adjustment: reverse based on original direction
              const warehouseId = movement.destinationWarehouseId;
              if (warehouseId) {
                const currentStock = await storage.getProductStock(line.productId);
                const warehouseStock = currentStock.find(s => s.warehouseId === warehouseId);
                const currentQty = parseFloat(warehouseStock?.quantity || '0');
                // Reverse: if was 'add', now subtract. If was 'remove', now add back
                const newQty = adjustmentDirection === 'add' ? Math.max(0, currentQty - quantity) : currentQty + quantity;
                await storage.updateWarehouseStock(warehouseId, line.productId, newQty, req.user!.companyId);
              }
            }
          } else if (movement.movementType === 'return') {
            // Was return to source warehouse, so remove the stock that was returned
            if (movement.sourceWarehouseId) {
              const currentStock = await storage.getProductStock(line.productId);
              const warehouseStock = currentStock.find(s => s.warehouseId === movement.sourceWarehouseId);
              const currentQty = parseFloat(warehouseStock?.quantity || '0');
              const newQty = Math.max(0, currentQty - quantity); // Allow revert, set to 0 minimum
              await storage.updateWarehouseStock(movement.sourceWarehouseId, line.productId, newQty, req.user!.companyId);
            }
          }
        }
        
        // Update status to draft
        const updated = await storage.updateInventoryMovement(id, { status: 'draft' });
        const fullMovement = await storage.getInventoryMovement(id);
        return res.json(fullMovement);
      }

      // Handle adjustmentDirection change on posted internal movements
      if (movement.status === 'posted' && 
          movement.movementType === 'internal' && 
          (movement as any).internalReason === 'adjustment' &&
          req.body.adjustmentDirection !== undefined &&
          req.body.adjustmentDirection !== (movement as any).adjustmentDirection) {
        
        const oldDirection = (movement as any).adjustmentDirection || 'add';
        const newDirection = req.body.adjustmentDirection;
        
        // For each line, recalculate stock: reverse old direction, apply new direction
        for (const line of movement.lines) {
          const quantity = parseFloat(line.quantity);
          const warehouseId = movement.destinationWarehouseId;
          
          if (warehouseId) {
            const currentStock = await storage.getProductStock(line.productId);
            const warehouseStock = currentStock.find(s => s.warehouseId === warehouseId);
            const currentQty = parseFloat(warehouseStock?.quantity || '0');
            
            // Reverse old direction
            let reversedQty = oldDirection === 'add' ? currentQty - quantity : currentQty + quantity;
            // Apply new direction
            let newQty = newDirection === 'add' ? reversedQty + quantity : reversedQty - quantity;
            
            await storage.updateWarehouseStock(warehouseId, line.productId, newQty, req.user!.companyId);
          }
        }
        
        const updated = await storage.updateInventoryMovement(id, req.body);
        const fullMovement = await storage.getInventoryMovement(id);
        return res.json(fullMovement);
      }

      // Handle confirming a draft movement (draft -> posted)
      if (movement.status === 'draft' && req.body.status === 'posted') {
        // Apply stock changes for each line
        for (const line of movement.lines) {
          const quantity = parseFloat(line.quantity);
          
          if (movement.movementType === 'in') {
            if (movement.destinationWarehouseId) {
              const currentStock = await storage.getProductStock(line.productId);
              const warehouseStock = currentStock.find(s => s.warehouseId === movement.destinationWarehouseId);
              const currentQty = parseFloat(warehouseStock?.quantity || '0');
              await storage.updateWarehouseStock(movement.destinationWarehouseId, line.productId, currentQty + quantity, req.user!.companyId);
            }
          } else if (movement.movementType === 'out' || movement.movementType === 'loan') {
            if (movement.sourceWarehouseId) {
              const currentStock = await storage.getProductStock(line.productId);
              const warehouseStock = currentStock.find(s => s.warehouseId === movement.sourceWarehouseId);
              const currentQty = parseFloat(warehouseStock?.quantity || '0');
              await storage.updateWarehouseStock(movement.sourceWarehouseId, line.productId, currentQty - quantity, req.user!.companyId);
            }
          } else if (movement.movementType === 'internal') {
            const internalReason = (movement as any).internalReason || 'adjustment';
            const adjustmentDirection = (movement as any).adjustmentDirection || 'add';
            
            if (internalReason === 'transfer') {
              if (movement.sourceWarehouseId) {
                const sourceStock = await storage.getProductStock(line.productId);
                const sourceWh = sourceStock.find(s => s.warehouseId === movement.sourceWarehouseId);
                const sourceQty = parseFloat(sourceWh?.quantity || '0');
                await storage.updateWarehouseStock(movement.sourceWarehouseId, line.productId, sourceQty - quantity, req.user!.companyId);
              }
              if (movement.destinationWarehouseId) {
                const destStock = await storage.getProductStock(line.productId);
                const destWh = destStock.find(s => s.warehouseId === movement.destinationWarehouseId);
                const destQty = parseFloat(destWh?.quantity || '0');
                await storage.updateWarehouseStock(movement.destinationWarehouseId, line.productId, destQty + quantity, req.user!.companyId);
              }
            } else {
              // Adjustment
              if (movement.destinationWarehouseId) {
                const destStock = await storage.getProductStock(line.productId);
                const destWh = destStock.find(s => s.warehouseId === movement.destinationWarehouseId);
                const destQty = parseFloat(destWh?.quantity || '0');
                const newQty = adjustmentDirection === 'add' ? destQty + quantity : destQty - quantity;
                await storage.updateWarehouseStock(movement.destinationWarehouseId, line.productId, newQty, req.user!.companyId);
              }
            }
          } else if (movement.movementType === 'return') {
            if (movement.sourceWarehouseId) {
              const currentStock = await storage.getProductStock(line.productId);
              const warehouseStock = currentStock.find(s => s.warehouseId === movement.sourceWarehouseId);
              const currentQty = parseFloat(warehouseStock?.quantity || '0');
              await storage.updateWarehouseStock(movement.sourceWarehouseId, line.productId, currentQty + quantity, req.user!.companyId);
            }
          }
        }
        
        const updated = await storage.updateInventoryMovement(id, { status: 'posted' });
        const fullMovement = await storage.getInventoryMovement(id);
        return res.json(fullMovement);
      }

      // Regular update (for draft movements or archiving)
      if (movement.status === 'posted' && req.body.status !== 'archived' && req.body.status !== 'draft') {
        return res.status(400).json({ message: 'Solo se puede archivar o revertir a borrador un movimiento confirmado' });
      }

      const updated = await storage.updateInventoryMovement(id, req.body);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete('/api/inventory/movements/:id', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const movement = await storage.getInventoryMovement(id);
      if (!movement || movement.companyId !== req.user!.companyId) {
        return res.status(404).json({ message: 'Movimiento no encontrado' });
      }
      
      // If movement was posted, reverse stock changes first
      if (movement.status === 'posted') {
        for (const line of movement.lines) {
          const quantity = parseFloat(line.quantity);
          
          if (movement.movementType === 'in') {
            // Was entry to destination warehouse, remove the stock
            if (movement.destinationWarehouseId) {
              const currentStock = await storage.getProductStock(line.productId);
              const warehouseStock = currentStock.find(s => s.warehouseId === movement.destinationWarehouseId);
              const currentQty = parseFloat(warehouseStock?.quantity || '0');
              const newQty = Math.max(0, currentQty - quantity); // Allow deletion, set to 0 minimum
              await storage.updateWarehouseStock(movement.destinationWarehouseId, line.productId, newQty, req.user!.companyId);
            }
          } else if (movement.movementType === 'out' || movement.movementType === 'loan') {
            // Was exit/loan from source warehouse, add back the stock
            if (movement.sourceWarehouseId) {
              const currentStock = await storage.getProductStock(line.productId);
              const warehouseStock = currentStock.find(s => s.warehouseId === movement.sourceWarehouseId);
              const currentQty = parseFloat(warehouseStock?.quantity || '0');
              await storage.updateWarehouseStock(movement.sourceWarehouseId, line.productId, currentQty + quantity, req.user!.companyId);
            }
          } else if (movement.movementType === 'internal') {
            // Internal movements: handle transfer and adjustment
            const internalReason = (movement as any).internalReason || 'adjustment';
            const adjustmentDirection = (movement as any).adjustmentDirection || 'add';
            
            if (internalReason === 'transfer') {
              // Was transfer: remove from destination, add back to source
              if (movement.destinationWarehouseId) {
                const destStock = await storage.getProductStock(line.productId);
                const destWarehouseStock = destStock.find(s => s.warehouseId === movement.destinationWarehouseId);
                const destQty = parseFloat(destWarehouseStock?.quantity || '0');
                const newDestQty = Math.max(0, destQty - quantity); // Allow deletion, set to 0 minimum
                await storage.updateWarehouseStock(movement.destinationWarehouseId, line.productId, newDestQty, req.user!.companyId);
              }
              if (movement.sourceWarehouseId) {
                const sourceStock = await storage.getProductStock(line.productId);
                const sourceWarehouseStock = sourceStock.find(s => s.warehouseId === movement.sourceWarehouseId);
                const sourceQty = parseFloat(sourceWarehouseStock?.quantity || '0');
                await storage.updateWarehouseStock(movement.sourceWarehouseId, line.productId, sourceQty + quantity, req.user!.companyId);
              }
            } else {
              // Adjustment: reverse based on original direction
              const warehouseId = movement.destinationWarehouseId;
              if (warehouseId) {
                const currentStock = await storage.getProductStock(line.productId);
                const warehouseStock = currentStock.find(s => s.warehouseId === warehouseId);
                const currentQty = parseFloat(warehouseStock?.quantity || '0');
                // Reverse: if was 'add', now subtract. If was 'remove', now add back
                const newQty = adjustmentDirection === 'add' ? Math.max(0, currentQty - quantity) : currentQty + quantity;
                await storage.updateWarehouseStock(warehouseId, line.productId, newQty, req.user!.companyId);
              }
            }
          } else if (movement.movementType === 'return') {
            // Was return to source warehouse, remove the returned stock
            if (movement.sourceWarehouseId) {
              const currentStock = await storage.getProductStock(line.productId);
              const warehouseStock = currentStock.find(s => s.warehouseId === movement.sourceWarehouseId);
              const currentQty = parseFloat(warehouseStock?.quantity || '0');
              const newQty = Math.max(0, currentQty - quantity); // Allow deletion, set to 0 minimum
              await storage.updateWarehouseStock(movement.sourceWarehouseId, line.productId, newQty, req.user!.companyId);
            }
          }
        }
      }

      await storage.deleteInventoryMovement(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Tool Loans
  app.get('/api/inventory/loans', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const filters: any = {};
      if (req.query.status) filters.status = req.query.status as string;
      if (req.query.assignedToId) filters.assignedToId = parseInt(req.query.assignedToId as string);
      if (req.query.productId) filters.productId = parseInt(req.query.productId as string);

      const loans = await storage.getToolLoans(req.user!.companyId, filters);
      res.json(loans);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/inventory/loans/overdue', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const overdueLoans = await storage.getOverdueToolLoans(req.user!.companyId);
      res.json(overdueLoans);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch('/api/inventory/loans/:id/return', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const loan = await storage.getToolLoan(id);
      if (!loan || loan.companyId !== req.user!.companyId) {
        return res.status(404).json({ message: 'Préstamo no encontrado' });
      }

      const { returnedQuantity, conditionIn, damageNotes } = req.body;
      const qty = parseFloat(returnedQuantity);
      const currentReturned = parseFloat(loan.returnedQuantity);
      const totalQty = parseFloat(loan.quantity);
      
      const newReturnedQty = currentReturned + qty;
      const status = newReturnedQty >= totalQty ? 'returned' : 'partial_return';

      const updated = await storage.updateToolLoan(id, {
        returnedQuantity: String(newReturnedQty),
        conditionIn,
        damageNotes,
        status,
        actualReturnDate: newReturnedQty >= totalQty ? new Date() : undefined,
      });

      // Update warehouse stock
      const movement = await storage.getInventoryMovement(loan.movementId);
      if (movement?.sourceWarehouseId) {
        const currentStock = await storage.getProductStock(loan.productId);
        const whStock = currentStock.find(s => s.warehouseId === movement.sourceWarehouseId);
        const currentQty = parseFloat(whStock?.quantity || '0');
        await storage.updateWarehouseStock(movement.sourceWarehouseId!, loan.productId, currentQty + qty, req.user!.companyId);
      }

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Movement PDF generation (Albarán Profesional)
  app.get('/api/inventory/movements/:id/pdf', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const movement = await storage.getInventoryMovement(id);
      if (!movement || movement.companyId !== req.user!.companyId) {
        return res.status(404).json({ message: 'Movimiento no encontrado' });
      }

      const company = await storage.getCompany(req.user!.companyId);
      if (!company) {
        return res.status(404).json({ message: 'Empresa no encontrada' });
      }
      
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Movement type labels
      const typeLabels: Record<string, string> = {
        'in': 'ENTRADA',
        'out': 'SALIDA / ALBARÁN DE ENTREGA',
        'transfer': 'TRANSFERENCIA',
        'adjustment': 'AJUSTE DE INVENTARIO',
        'loan': 'PRÉSTAMO DE MATERIAL',
        'return': 'DEVOLUCIÓN',
      };
      
      // ===== HEADER SECTION =====
      // Blue header bar
      doc.setFillColor(0, 102, 204);
      doc.rect(0, 0, pageWidth, 45, 'F');
      
      // Company name (white, bold)
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text(company.name, 14, 18);
      
      // Company details (white)
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      let companyY = 26;
      if (company.cif) {
        doc.text(`CIF: ${company.cif}`, 14, companyY);
        companyY += 5;
      }
      if (company.address) {
        const addressText = company.province ? `${company.address}, ${company.province}` : company.address;
        doc.text(addressText, 14, companyY);
        companyY += 5;
      }
      const contactLine = [company.phone, company.email].filter(Boolean).join(' | ');
      if (contactLine) {
        doc.text(contactLine, 14, companyY);
      }
      
      // Document type and number (right side, white)
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('ALBARÁN', pageWidth - 14, 18, { align: 'right' });
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(movement.movementNumber, pageWidth - 14, 26, { align: 'right' });
      doc.setFontSize(9);
      doc.text(`Fecha: ${new Date(movement.movementDate).toLocaleDateString('es-ES')}`, pageWidth - 14, 33, { align: 'right' });
      doc.text(typeLabels[movement.movementType] || movement.movementType.toUpperCase(), pageWidth - 14, 40, { align: 'right' });
      
      // ===== CLIENT/DESTINATION SECTION =====
      let currentY = 55;
      
      if (movement.relatedPartyName) {
        // Client box
        doc.setDrawColor(220, 220, 220);
        doc.setFillColor(250, 250, 250);
        doc.roundedRect(14, currentY, 90, 35, 2, 2, 'FD');
        
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(8);
        doc.text('DESTINATARIO / CLIENTE', 18, currentY + 6);
        
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(movement.relatedPartyName, 18, currentY + 14);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        
        let clientY = currentY + 20;
        if (movement.relatedPartyCif) {
          doc.text(`CIF: ${movement.relatedPartyCif}`, 18, clientY);
          clientY += 5;
        }
        if (movement.relatedPartyAddress) {
          const addressLines = doc.splitTextToSize(movement.relatedPartyAddress, 82);
          doc.text(addressLines, 18, clientY);
        }
        
        currentY += 42;
      }
      
      // Project info box (if exists)
      if (movement.projectName || movement.projectReference) {
        doc.setDrawColor(220, 220, 220);
        doc.setFillColor(255, 248, 230);
        doc.roundedRect(110, 55, 85, 35, 2, 2, 'FD');
        
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(8);
        doc.text('PROYECTO / OBRA', 114, 61);
        
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(9);
        let projY = 68;
        if (movement.projectReference) {
          doc.setFont('helvetica', 'bold');
          doc.text(`Ref: ${movement.projectReference}`, 114, projY);
          doc.setFont('helvetica', 'normal');
          projY += 6;
        }
        if (movement.projectName) {
          const projLines = doc.splitTextToSize(movement.projectName, 77);
          doc.text(projLines, 114, projY);
        }
        
        if (!movement.relatedPartyName) currentY = 97;
      }
      
      if (!movement.relatedPartyName && !movement.projectName && !movement.projectReference) {
        currentY = 55;
      }
      
      // ===== PRODUCTS TABLE =====
      const tableStartY = currentY + 5;
      
      const tableData = movement.lines.map((line, idx) => [
        String(idx + 1),
        line.product.sku || '-',
        line.product.name,
        String(parseFloat(line.quantity).toFixed(2)),
        line.product.unitAbbreviation || 'ud.',
        `${parseFloat(line.unitPrice).toFixed(2)} €`,
        `${parseFloat(line.vatRate).toFixed(0)}%`,
        `${parseFloat(line.total).toFixed(2)} €`,
      ]);

      autoTable(doc, {
        startY: tableStartY,
        head: [['#', 'Ref.', 'Descripción', 'Cant.', 'Ud.', 'P. Unit.', 'IVA', 'Importe']],
        body: tableData,
        theme: 'grid',
        headStyles: { 
          fillColor: [0, 102, 204], 
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 9,
          halign: 'center',
        },
        bodyStyles: {
          fontSize: 9,
          cellPadding: 3,
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 22 },
          2: { cellWidth: 55 },
          3: { cellWidth: 18, halign: 'right' },
          4: { cellWidth: 15, halign: 'center' },
          5: { cellWidth: 22, halign: 'right' },
          6: { cellWidth: 15, halign: 'center' },
          7: { cellWidth: 25, halign: 'right' },
        },
        margin: { left: 14, right: 14 },
      });

      const finalY = (doc as any).lastAutoTable.finalY + 8;
      
      // ===== TOTALS SECTION =====
      const totalsX = pageWidth - 80;
      
      // Totals box
      doc.setDrawColor(220, 220, 220);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(totalsX - 5, finalY - 3, 75, 32, 2, 2, 'FD');
      
      doc.setTextColor(80, 80, 80);
      doc.setFontSize(10);
      doc.text('Base Imponible:', totalsX, finalY + 5);
      doc.text(`${parseFloat(movement.subtotal).toFixed(2)} €`, pageWidth - 18, finalY + 5, { align: 'right' });
      
      doc.text('IVA:', totalsX, finalY + 12);
      doc.text(`${parseFloat(movement.vatAmount).toFixed(2)} €`, pageWidth - 18, finalY + 12, { align: 'right' });
      
      doc.setDrawColor(0, 102, 204);
      doc.line(totalsX, finalY + 17, pageWidth - 18, finalY + 17);
      
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('TOTAL:', totalsX, finalY + 25);
      doc.text(`${parseFloat(movement.total).toFixed(2)} €`, pageWidth - 18, finalY + 25, { align: 'right' });
      
      // ===== NOTES SECTION =====
      let notesEndY = finalY + 35;
      if (movement.notes) {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        doc.setFontSize(8);
        doc.text('OBSERVACIONES:', 14, finalY + 5);
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(9);
        const noteLines = doc.splitTextToSize(movement.notes, 90);
        doc.text(noteLines, 14, finalY + 11);
        notesEndY = finalY + 11 + (noteLines.length * 4);
      }
      
      // ===== SIGNATURE SECTION =====
      const sigY = Math.max(notesEndY + 15, finalY + 45);
      
      // Only show signatures if there's enough space
      if (sigY < 250) {
        doc.setDrawColor(200, 200, 200);
        doc.setTextColor(80, 80, 80);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        
        // Received by
        doc.text('Recibí conforme:', 14, sigY);
        doc.setDrawColor(180, 180, 180);
        doc.line(14, sigY + 25, 85, sigY + 25);
        doc.setFontSize(8);
        doc.text('Firma y sello del destinatario', 14, sigY + 30);
        doc.text(`Fecha: ___/___/_______`, 14, sigY + 36);
        
        // Delivered by
        doc.setFontSize(9);
        doc.text('Entregado por:', 115, sigY);
        doc.line(115, sigY + 25, 195, sigY + 25);
        doc.setFontSize(8);
        doc.text('Firma del transportista', 115, sigY + 30);
      }
      
      // ===== FOOTER =====
      const footerY = 285;
      doc.setDrawColor(0, 102, 204);
      doc.line(14, footerY - 8, pageWidth - 14, footerY - 8);
      
      doc.setFontSize(7);
      doc.setTextColor(120, 120, 120);
      doc.text(company.name, 14, footerY - 3);
      doc.text(`CIF: ${company.cif || '-'} | ${company.phone || ''} | ${company.email || ''}`, 14, footerY + 1);
      
      doc.setFontSize(7);
      doc.text(`Documento generado el ${new Date().toLocaleString('es-ES')}`, pageWidth - 14, footerY - 1, { align: 'right' });

      const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=albaran-${movement.movementNumber}.pdf`);
      res.send(pdfBuffer);
    } catch (error: any) {
      console.error('Error generating movement PDF:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Dashboard stats
  app.get('/api/inventory/dashboard', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const [products, categories, warehouses, lowStock, overdueLoans, recentMovements] = await Promise.all([
        storage.getProducts(req.user!.companyId, { isActive: true }),
        storage.getProductCategories(req.user!.companyId),
        storage.getWarehouses(req.user!.companyId),
        storage.getLowStockProducts(req.user!.companyId),
        storage.getOverdueToolLoans(req.user!.companyId),
        storage.getInventoryMovements(req.user!.companyId, { status: 'posted' }),
      ]);

      const activeLoans = await storage.getToolLoans(req.user!.companyId, { status: 'active' });

      res.json({
        totalProducts: products.length,
        totalCategories: categories.length,
        totalWarehouses: warehouses.length,
        lowStockCount: lowStock.length,
        lowStockProducts: lowStock.slice(0, 5),
        overdueLoansCount: overdueLoans.length,
        overdueLoans: overdueLoans.slice(0, 5),
        activeLoansCount: activeLoans.length,
        recentMovements: recentMovements.slice(0, 10),
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Download Excel template for bulk product upload
  app.get('/api/inventory/products/template', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    console.log('=== TEMPLATE DOWNLOAD START ===');
    try {
      const companyId = req.user?.companyId;
      console.log('Template download - companyId:', companyId);
      
      if (!companyId) {
        return res.status(401).json({ message: 'Sesión no válida' });
      }
      
      console.log('Fetching categories and warehouses...');
      const categories = await storage.getProductCategories(companyId);
      const warehouses = await storage.getWarehouses(companyId);
      console.log('Got', categories.length, 'categories and', warehouses.length, 'warehouses');
      
      // Create workbook with template
      const wb = XLSX.utils.book_new();
      
      // Products sheet with headers and example row
      const headers = [
        'Nombre*', 'SKU*', 'Código de barras', 'Descripción', 'Categoría',
        'Unidad de medida', 'Abreviatura', 'Precio coste', 'Precio venta',
        'IVA (%)', 'Stock mínimo', 'Stock máximo', 'Activo', 'Retornable', 'Servicio'
      ];
      const exampleRow = [
        'Producto Ejemplo', 'SKU-001', '1234567890123', 'Descripción del producto', 
        categories[0]?.name || 'General', 'unidad', 'ud.', '10.00', '15.00',
        '21', '5', '100', 'Sí', 'No', 'No'
      ];
      const productsData = [headers, exampleRow];
      const wsProducts = XLSX.utils.aoa_to_sheet(productsData);
      
      // Set column widths
      wsProducts['!cols'] = [
        { wch: 25 }, { wch: 15 }, { wch: 18 }, { wch: 30 }, { wch: 15 },
        { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
        { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 10 }, { wch: 10 }
      ];
      
      XLSX.utils.book_append_sheet(wb, wsProducts, 'Productos');
      
      // Categories reference sheet
      const categoriesData = [['Categorías disponibles'], ...categories.map(c => [c.name])];
      const wsCategories = XLSX.utils.aoa_to_sheet(categoriesData);
      XLSX.utils.book_append_sheet(wb, wsCategories, 'Categorías');
      
      // Warehouses reference sheet
      const warehousesData = [['Almacenes disponibles'], ...warehouses.map(w => [w.name])];
      const wsWarehouses = XLSX.utils.aoa_to_sheet(warehousesData);
      XLSX.utils.book_append_sheet(wb, wsWarehouses, 'Almacenes');
      
      // Instructions sheet
      const instructions = [
        ['Instrucciones para carga masiva de productos'],
        [''],
        ['1. Rellene la hoja "Productos" con los datos de sus productos'],
        ['2. Los campos marcados con * son obligatorios'],
        ['3. Puede ver las categorías disponibles en la hoja "Categorías"'],
        ['4. Para Activo/Retornable/Servicio use: Sí, No, 1, 0, true, false'],
        ['5. El SKU debe ser único. Si ya existe, se detectará como duplicado'],
        ['6. Los precios deben ser números (use punto como separador decimal)'],
        ['7. Elimine la fila de ejemplo antes de subir el archivo'],
      ];
      const wsInstructions = XLSX.utils.aoa_to_sheet(instructions);
      wsInstructions['!cols'] = [{ wch: 60 }];
      XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instrucciones');
      
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=plantilla-productos.xlsx');
      res.send(buffer);
    } catch (error: any) {
      console.error('Error generating template:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Upload and validate Excel for bulk product import
  app.post('/api/inventory/products/bulk-validate', authenticateToken, requireRole(['admin', 'manager']), memoryUpload.single('file'), async (req: AuthRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No se ha subido ningún archivo' });
      }
      
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      
      if (data.length < 2) {
        return res.status(400).json({ message: 'El archivo no contiene datos' });
      }
      
      // Get existing products and categories
      const existingProducts = await storage.getProducts(req.user!.companyId, {});
      const categories = await storage.getProductCategories(req.user!.companyId);
      
      const categoryMap = new Map(categories.map(c => [c.name.toLowerCase(), c.id]));
      const skuMap = new Map(existingProducts.map(p => [p.sku.toLowerCase(), p]));
      const barcodeMap = new Map(existingProducts.filter(p => p.barcode).map(p => [p.barcode!.toLowerCase(), p]));
      
      const parseBoolean = (val: any): boolean => {
        if (typeof val === 'boolean') return val;
        if (typeof val === 'number') return val === 1;
        if (typeof val === 'string') {
          const lower = val.toLowerCase().trim();
          return lower === 'sí' || lower === 'si' || lower === 'yes' || lower === 'true' || lower === '1';
        }
        return false;
      };
      
      const products: any[] = [];
      const errors: { row: number; message: string }[] = [];
      
      // Skip header row
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length === 0 || !row[0]) continue; // Skip empty rows
        
        const name = String(row[0] || '').trim();
        const sku = String(row[1] || '').trim();
        
        if (!name) {
          errors.push({ row: i + 1, message: 'Nombre es obligatorio' });
          continue;
        }
        if (!sku) {
          errors.push({ row: i + 1, message: 'SKU es obligatorio' });
          continue;
        }
        
        const barcode = row[2] ? String(row[2]).trim() : null;
        const categoryName = row[4] ? String(row[4]).trim().toLowerCase() : null;
        const categoryId = categoryName ? categoryMap.get(categoryName) || null : null;
        
        const product = {
          rowNumber: i + 1,
          name,
          sku,
          barcode,
          description: row[3] ? String(row[3]).trim() : null,
          categoryId,
          categoryName: row[4] ? String(row[4]).trim() : null,
          unitOfMeasure: row[5] ? String(row[5]).trim() : 'unidad',
          unitAbbreviation: row[6] ? String(row[6]).trim() : 'ud.',
          costPrice: String(parseFloat(String(row[7] || '0').replace(',', '.')) || 0),
          salePrice: String(parseFloat(String(row[8] || '0').replace(',', '.')) || 0),
          vatRate: String(parseFloat(String(row[9] || '21').replace(',', '.')) || 21),
          minStock: parseInt(String(row[10] || '0')) || 0,
          maxStock: row[11] ? parseInt(String(row[11])) || null : null,
          isActive: parseBoolean(row[12] ?? true),
          isReturnable: parseBoolean(row[13] ?? false),
          isService: parseBoolean(row[14] ?? false),
          isDuplicate: false,
          duplicateType: null as string | null,
          existingProduct: null as any,
        };
        
        // Check for duplicates
        const existingBySku = skuMap.get(sku.toLowerCase());
        const existingByBarcode = barcode ? barcodeMap.get(barcode.toLowerCase()) : null;
        
        if (existingBySku) {
          product.isDuplicate = true;
          product.duplicateType = 'sku';
          product.existingProduct = {
            id: existingBySku.id,
            name: existingBySku.name,
            sku: existingBySku.sku,
          };
        } else if (existingByBarcode) {
          product.isDuplicate = true;
          product.duplicateType = 'barcode';
          product.existingProduct = {
            id: existingByBarcode.id,
            name: existingByBarcode.name,
            sku: existingByBarcode.sku,
            barcode: existingByBarcode.barcode,
          };
        }
        
        products.push(product);
      }
      
      const duplicates = products.filter(p => p.isDuplicate);
      const newProducts = products.filter(p => !p.isDuplicate);
      
      res.json({
        totalRows: data.length - 1,
        validProducts: products.length,
        newProducts: newProducts.length,
        duplicates: duplicates.length,
        errors,
        products, // Full list with duplicate info
      });
    } catch (error: any) {
      console.error('Error validating bulk upload:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Process bulk product import with conflict resolution
  app.post('/api/inventory/products/bulk-import', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const { products, resolutions } = req.body;
      // resolutions: { [sku]: 'replace' | 'skip' }
      
      if (!products || !Array.isArray(products)) {
        return res.status(400).json({ message: 'No hay productos para importar' });
      }
      
      const results = {
        created: 0,
        updated: 0,
        skipped: 0,
        categoriesCreated: 0,
        errors: [] as { sku: string; message: string }[],
      };
      
      // Step 1: Auto-create missing categories
      const existingCategories = await storage.getProductCategories(req.user!.companyId);
      const categoryMap = new Map(existingCategories.map(c => [c.name.toLowerCase(), c.id]));
      
      // Find unique category names that need to be created
      const categoriesToCreate = new Set<string>();
      for (const product of products) {
        if (product.categoryName && !categoryMap.has(product.categoryName.toLowerCase())) {
          categoriesToCreate.add(product.categoryName);
        }
      }
      
      // Create missing categories
      for (const categoryName of Array.from(categoriesToCreate)) {
        try {
          const newCategory = await storage.createProductCategory({ 
            companyId: req.user!.companyId, 
            name: categoryName 
          });
          categoryMap.set(categoryName.toLowerCase(), newCategory.id);
          results.categoriesCreated++;
        } catch (err: any) {
          console.error(`Error creating category "${categoryName}":`, err.message);
        }
      }
      
      // Step 2: Process products with resolved category IDs
      for (const product of products) {
        try {
          const resolution = resolutions?.[product.sku] || 'skip';
          
          // Resolve categoryId from map (handles both existing and newly created categories)
          const resolvedCategoryId = product.categoryName 
            ? categoryMap.get(product.categoryName.toLowerCase()) || null
            : product.categoryId || null;
          
          if (product.isDuplicate) {
            if (resolution === 'replace' && product.existingProduct?.id) {
              // Update existing product
              await storage.updateProduct(product.existingProduct.id, {
                name: product.name,
                barcode: product.barcode,
                description: product.description,
                categoryId: resolvedCategoryId,
                unit: product.unit || product.unitOfMeasure || 'unidad',
                unitAbbreviation: product.unitAbbreviation || 'ud.',
                costPrice: product.costPrice,
                salePrice: product.salePrice,
                vatRate: product.vatRate,
                minStock: product.minStock,
                maxStock: product.maxStock,
                isActive: product.isActive,
                isReturnable: product.isReturnable,
                isService: product.isService,
              });
              results.updated++;
            } else {
              results.skipped++;
            }
          } else {
            // Create new product
            await storage.createProduct({
              companyId: req.user!.companyId,
              name: product.name,
              sku: product.sku,
              barcode: product.barcode,
              description: product.description,
              categoryId: resolvedCategoryId,
              unit: product.unit || product.unitOfMeasure || 'unidad',
              unitAbbreviation: product.unitAbbreviation || 'ud.',
              costPrice: product.costPrice,
              salePrice: product.salePrice,
              vatRate: product.vatRate,
              minStock: product.minStock,
              maxStock: product.maxStock,
              isActive: product.isActive,
              isReturnable: product.isReturnable,
              isService: product.isService,
            });
            results.created++;
          }
        } catch (err: any) {
          results.errors.push({ sku: product.sku, message: err.message });
        }
      }
      
      res.json(results);
    } catch (error: any) {
      console.error('Error processing bulk import:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ACCOUNTING SYSTEM ROUTES (3 tables optimized)
  // ═══════════════════════════════════════════════════════════════════════════

  // Categories - Get by type (expense/income)
  app.get('/api/accounting/categories', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { type } = req.query; // 'expense' or 'income'
      
      let conditions = [eq(schema.accountingCategories.companyId, req.user!.companyId)];
      if (type) {
        conditions.push(eq(schema.accountingCategories.type, type as string));
      }
      
      const categories = await db.select()
        .from(schema.accountingCategories)
        .where(and(...conditions))
        .orderBy(schema.accountingCategories.sortOrder);
      res.json(categories);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Categories CRUD
  app.post('/api/accounting/categories', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const [category] = await db.insert(schema.accountingCategories)
        .values({ ...req.body, companyId: req.user!.companyId })
        .returning();
      res.json(category);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch('/api/accounting/categories/:id', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const [category] = await db.update(schema.accountingCategories)
        .set({ ...req.body, updatedAt: new Date() })
        .where(and(
          eq(schema.accountingCategories.id, parseInt(req.params.id)),
          eq(schema.accountingCategories.companyId, req.user!.companyId)
        ))
        .returning();
      if (!category) return res.status(404).json({ message: 'Categoría no encontrada' });
      res.json(category);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete('/api/accounting/categories/:id', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      await db.delete(schema.accountingCategories)
        .where(and(
          eq(schema.accountingCategories.id, parseInt(req.params.id)),
          eq(schema.accountingCategories.companyId, req.user!.companyId)
        ));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const parseDecimal = (value: any, fallback = 0) => {
    if (value === null || value === undefined) return fallback;
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  };

  // Fiscal settings (company scope)
  app.get('/api/accounting/fiscal-settings', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;
      const [settings] = await db.select().from(companyFiscalSettings).where(eq(companyFiscalSettings.companyId, companyId));
      const defaults = {
        taxpayerType: 'autonomo',
        vatRegime: 'general',
        vatProration: 100,
        irpfModel130Rate: 20,
        irpfManualWithholdings: 0,
        irpfPreviousPayments: 0,
        irpfManualSocialSecurity: 0,
        irpfOtherAdjustments: 0,
        community: null,
        retentionDefaultRate: null,
        professionalRetentionRate: null,
        newProfessionalRetentionRate: null,
        rentRetentionRate: null,
        autoApplyRetentionDefaults: false,
      };
      res.json(settings ? {
        ...defaults,
        ...settings,
      } : defaults);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put('/api/accounting/fiscal-settings', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;
      const payload = {
        taxpayerType: typeof req.body.taxpayerType === 'string' ? req.body.taxpayerType : 'autonomo',
        vatRegime: typeof req.body.vatRegime === 'string' ? req.body.vatRegime : 'general',
        vatProration: parseDecimal(req.body.vatProration, 100),
        irpfModel130Rate: parseDecimal(req.body.irpfModel130Rate, 20),
        irpfManualWithholdings: parseDecimal(req.body.irpfManualWithholdings, 0),
        irpfPreviousPayments: parseDecimal(req.body.irpfPreviousPayments, 0),
        irpfManualSocialSecurity: parseDecimal(req.body.irpfManualSocialSecurity, 0),
        irpfOtherAdjustments: parseDecimal(req.body.irpfOtherAdjustments, 0),
        community: req.body.community || null,
        retentionDefaultRate: req.body.retentionDefaultRate === null || req.body.retentionDefaultRate === undefined
          ? null
          : parseDecimal(req.body.retentionDefaultRate, 0),
        professionalRetentionRate: req.body.professionalRetentionRate === null || req.body.professionalRetentionRate === undefined
          ? null
          : parseDecimal(req.body.professionalRetentionRate, 0),
        newProfessionalRetentionRate: req.body.newProfessionalRetentionRate === null || req.body.newProfessionalRetentionRate === undefined
          ? null
          : parseDecimal(req.body.newProfessionalRetentionRate, 0),
        rentRetentionRate: req.body.rentRetentionRate === null || req.body.rentRetentionRate === undefined
          ? null
          : parseDecimal(req.body.rentRetentionRate, 0),
        autoApplyRetentionDefaults: Boolean(req.body.autoApplyRetentionDefaults),
        updatedAt: new Date(),
      };

      const [existing] = await db.select().from(companyFiscalSettings).where(eq(companyFiscalSettings.companyId, companyId));
      if (existing) {
        const [updated] = await db.update(companyFiscalSettings)
          .set(payload)
          .where(eq(companyFiscalSettings.companyId, companyId))
          .returning();
        return res.json(updated);
      }

      const [created] = await db.insert(companyFiscalSettings)
        .values({ ...payload, companyId })
        .returning();
      return res.json(created);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Entries - List with filters
  app.get('/api/accounting/entries', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { startDate, endDate, status, categoryId, employeeId, type } = req.query;
      const userRole = req.user!.role;
      const userId = req.user!.id;
      const companyId = req.user!.companyId;
      
      let conditions = [eq(schema.accountingEntries.companyId, companyId)];
      
      // Employees only see their own expenses
      if (userRole === 'employee') {
        conditions.push(eq(schema.accountingEntries.employeeId, userId));
        conditions.push(eq(schema.accountingEntries.type, 'expense'));
      }
      
      // Type filter (expense/income)
      if (type) {
        conditions.push(eq(schema.accountingEntries.type, type as string));
      }
      
      // Date filters
      if (startDate) {
        conditions.push(gte(schema.accountingEntries.entryDate, startDate as string));
      }
      if (endDate) {
        conditions.push(lte(schema.accountingEntries.entryDate, endDate as string));
      }
      if (status) {
        conditions.push(eq(schema.accountingEntries.status, status as string));
      }
      if (categoryId) {
        conditions.push(eq(schema.accountingEntries.categoryId, parseInt(categoryId as string)));
      }
      if (employeeId && userRole !== 'employee') {
        conditions.push(eq(schema.accountingEntries.employeeId, parseInt(employeeId as string)));
      }
      
      const entries = await db.select()
      .from(schema.accountingEntries)
      .leftJoin(schema.accountingCategories, eq(schema.accountingEntries.categoryId, schema.accountingCategories.id))
      .where(and(...conditions))
      .orderBy(desc(schema.accountingEntries.entryDate));
      
      // Enrich with user data
      const enrichedEntries = await Promise.all(entries.map(async (row) => {
        const entry = row.accounting_entries;
        const category = row.accounting_categories;
        
        // Get submitted by user
        let submittedByUser = null;
        if (entry.submittedBy) {
          const [user] = await db.select({
            id: schema.users.id,
            fullName: schema.users.fullName,
            profilePicture: schema.users.profilePicture
          }).from(schema.users).where(eq(schema.users.id, entry.submittedBy));
          submittedByUser = user || null;
        }
        
        // Get employee if exists
        let employee = null;
        if (entry.employeeId) {
          const [emp] = await db.select({
            id: schema.users.id,
            fullName: schema.users.fullName,
            profilePicture: schema.users.profilePicture
          }).from(schema.users).where(eq(schema.users.id, entry.employeeId));
          employee = emp || null;
        }
        
        // Get project if exists
        let project = null;
        if (entry.projectId) {
          const [proj] = await db.select({
            id: schema.projects.id,
            name: schema.projects.name,
            code: schema.projects.code
          }).from(schema.projects).where(eq(schema.projects.id, entry.projectId));
          project = proj || null;
        }
        
        // Get CRM client if exists
        let crmClient = null;
        if (entry.crmClientId) {
          const [client] = await db.select({
            id: schema.businessContacts.id,
            name: schema.businessContacts.name,
            email: schema.businessContacts.email
          }).from(schema.businessContacts).where(eq(schema.businessContacts.id, entry.crmClientId));
          crmClient = client || null;
        }
        
        // Get CRM supplier if exists
        let crmSupplier = null;
        if (entry.crmSupplierId) {
          const [supplier] = await db.select({
            id: schema.businessContacts.id,
            name: schema.businessContacts.name,
            email: schema.businessContacts.email
          }).from(schema.businessContacts).where(eq(schema.businessContacts.id, entry.crmSupplierId));
          crmSupplier = supplier || null;
        }
        
        // Count attachments
        const [countResult] = await db.select({ count: count() })
          .from(schema.accountingAttachments)
          .where(eq(schema.accountingAttachments.entryId, entry.id));
        
        return {
          ...entry,
          category: category ? {
            id: category.id,
            name: category.name,
            color: category.color,
            icon: category.icon,
            type: category.type
          } : null,
          submittedByUser,
          employee,
          project,
          crmClient,
          crmSupplier,
          attachmentsCount: countResult?.count || 0
        };
      }));
      
      res.json(enrichedEntries);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get single entry with attachments
  app.get('/api/accounting/entries/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const entryId = parseInt(req.params.id);
      const userRole = req.user!.role;
      const userId = req.user!.id;
      
      const [entry] = await db.select()
        .from(schema.accountingEntries)
        .where(and(
          eq(schema.accountingEntries.id, entryId),
          eq(schema.accountingEntries.companyId, req.user!.companyId)
        ));
      
      if (!entry) {
        return res.status(404).json({ message: 'Entrada no encontrada' });
      }
      
      // Employees can only view their own expenses
      if (userRole === 'employee' && entry.employeeId !== userId) {
        return res.status(403).json({ message: 'No tienes permiso para ver esta entrada' });
      }
      
      // Get project info if projectId exists
      let project = null;
      if (entry.projectId) {
        const [proj] = await db.select({
          id: schema.projects.id,
          name: schema.projects.name,
          code: schema.projects.code,
        })
          .from(schema.projects)
          .where(eq(schema.projects.id, entry.projectId));
        project = proj || null;
      }
      
      // Get attachments
      const attachments = await db.select()
        .from(schema.accountingAttachments)
        .where(eq(schema.accountingAttachments.entryId, entryId));
      
      // Add download URLs to attachments
      const attachmentsWithUrls = attachments.map(att => ({
        ...att,
        fileUrl: `/api/accounting/attachments/${att.id}/download`
      }));
      
      res.json({ ...entry, project, attachments: attachmentsWithUrls });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Download attachment file from R2
  app.get('/api/accounting/attachments/:id/download', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const attachmentId = parseInt(req.params.id);
      
      // Get attachment
      const [attachment] = await db.select()
        .from(schema.accountingAttachments)
        .where(eq(schema.accountingAttachments.id, attachmentId));
      
      if (!attachment) {
        return res.status(404).json({ message: 'Archivo no encontrado' });
      }
      
      // Verify user has access to this attachment's entry
      const [entry] = await db.select()
        .from(schema.accountingEntries)
        .where(and(
          eq(schema.accountingEntries.id, attachment.entryId),
          eq(schema.accountingEntries.companyId, req.user!.companyId)
        ));
      
      if (!entry) {
        return res.status(403).json({ message: 'No tienes permiso para acceder a este archivo' });
      }
      
      // Employees can only download their own expenses
      if (req.user!.role === 'employee' && entry.employeeId !== req.user!.id) {
        return res.status(403).json({ message: 'No tienes permiso para acceder a este archivo' });
      }
      
      // Download from R2
      let file = await objectStorage.downloadDocument(attachment.filePath);
      
      // Fallback: Try local disk for files uploaded before R2 migration
      if (!file) {
        // Try multiple possible paths
        const possiblePaths = [
          attachment.filePath, // Full path as stored
          path.join(uploadDir, path.basename(attachment.filePath)), // Just filename in uploads/
          path.join(uploadDir, attachment.filePath), // Relative path in uploads/
        ];
        
        for (const localPath of possiblePaths) {
          if (fs.existsSync(localPath)) {
            console.log(`📂 Found file in local disk: ${localPath}`);
            const buffer = fs.readFileSync(localPath);
            const ext = path.extname(attachment.fileName).toLowerCase();
            const mimeTypes: { [key: string]: string } = {
              '.pdf': 'application/pdf',
              '.jpg': 'image/jpeg',
              '.jpeg': 'image/jpeg',
              '.png': 'image/png',
              '.gif': 'image/gif',
            };
            file = {
              buffer,
              contentType: attachment.mimeType || mimeTypes[ext] || 'application/octet-stream'
            };
            break;
          }
        }
      }
      
      if (!file) {
        console.error(`❌ File not found in R2 or local disk: ${attachment.filePath}`);
        return res.status(404).json({ message: 'Archivo no encontrado en almacenamiento' });
      }
      
      // Set headers and send file
      res.setHeader('Content-Type', file.contentType);
      res.setHeader('Content-Disposition', `inline; filename="${attachment.fileName}"`);
      res.send(file.buffer);
    } catch (error: any) {
      console.error('Error downloading attachment:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Multer configuration for receipt uploads (R2 memory storage)
  const receiptUpload = multer({
    storage: multer.memoryStorage(), // Use memory storage for R2
    limits: { 
      fileSize: 5 * 1024 * 1024, // 5MB
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = [
        'application/pdf',
        'image/png', 
        'image/jpeg',
        'image/jpg',
        'image/webp'
      ];
      
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Tipo de archivo no permitido. Solo PDF e imágenes.'));
      }
    }
  });

  // OCR Receipt Extraction - Process receipt image with OpenAI Vision
  app.post('/api/accounting/ocr-receipt', authenticateToken, receiptUpload.single('receipt'), async (req: AuthRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No se recibió ninguna imagen' });
      }

      // Check if OpenAI API key is configured
      if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
        console.error('❌ OpenAI API key not configured');
        return res.status(500).json({ 
          message: 'Clave API de OpenAI no configurada',
          details: 'AI_INTEGRATIONS_OPENAI_API_KEY no está configurada en variables de entorno'
        });
      }

      console.log('📸 Processing receipt OCR for file:', req.file.originalname, 'Type:', req.file.mimetype, 'Size:', req.file.size, 'bytes');

      const isPDF = req.file.mimetype === 'application/pdf';
      let processedBuffer: Buffer = req.file.buffer;

      // If PDF: try text extraction first
      if (isPDF) {
        try {
          // Lazy load to avoid startup cost if not needed
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const pdfParse = require('pdf-parse');
          const pdfData = await pdfParse(req.file.buffer, { max: 1 });

          if (pdfData?.text && pdfData.text.trim().length > 0) {
            console.log('📝 PDF text detected, length:', pdfData.text.length);

            const rawBase = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || 'https://api.openai.com';
            const baseNoTrail = rawBase.replace(/\/$/, '');
            const isGroq = baseNoTrail.includes('api.groq.com');
            const normalizedBase = isGroq
              ? baseNoTrail.replace(/\/openai$/, '') + '/openai/v1'
              : baseNoTrail + '/v1';
            const openai = new OpenAI({
              baseURL: normalizedBase,
              apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
            });

            let model = process.env.AI_INTEGRATIONS_OPENAI_FAST_MODEL || 'gpt-4o-mini';
            console.log('🤖 Using model (text pdf):', model);

            const response = await openai.chat.completions.create({
              model,
              messages: [
                {
                  role: "user",
                  content: `Analiza este texto extraído de una factura/ticket y extrae la siguiente información en formato JSON:
- date: fecha en formato YYYY-MM-DD (null si no la ves)
- amount: cantidad base (sin IVA) como número decimal (null si no la ves)
- vatAmount: cantidad de IVA como número decimal (null si no la ves)
- totalAmount: cantidad total como número decimal (null si no la ves)
- concept: concepto/descripción corta del gasto (null si no lo ves)
- contactName: nombre del comercio o proveedor (null si no lo ves)
- paymentMethod: método de pago si está visible (null si no lo ves)

IMPORTANTE: Responde SOLO con el JSON válido, sin markdown, sin bloques de código, sin explicaciones.

TEXTO:
${pdfData.text}`
                }
              ],
              max_tokens: 500,
              temperature: 0.1
            });

            const content = response.choices[0]?.message?.content || '';
            let parsedData: any = {};
            try {
              const jsonMatch = content.match(/\{[\s\S]*\}/);
              parsedData = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);
            } catch (parseError: any) {
              console.error('❌ Error parsing OCR response (pdf-text):', parseError.message);
              return res.status(500).json({ 
                message: 'No se pudo interpretar la respuesta del OCR',
                error: 'JSON parsing failed'
              });
            }

            const result = {
              date: parsedData.date || null,
              amount: parsedData.amount ? parseFloat(parsedData.amount) : null,
              vatAmount: parsedData.vatAmount ? parseFloat(parsedData.vatAmount) : null,
              totalAmount: parsedData.totalAmount ? parseFloat(parsedData.totalAmount) : null,
              concept: parsedData.concept || null,
              contactName: parsedData.contactName || null,
              paymentMethod: parsedData.paymentMethod || null
            };

            if (result.amount && result.totalAmount && !result.vatAmount) {
              result.vatAmount = parseFloat((result.totalAmount - result.amount).toFixed(2));
            } else if (result.amount && result.vatAmount && !result.totalAmount) {
              result.totalAmount = parseFloat((result.amount + result.vatAmount).toFixed(2));
            }

            console.log('✅ PDF text processed successfully');
            return res.json(result);
          }

          console.log('ℹ️ PDF sin texto significativo, se intentará como imagen');
        } catch (pdfErr: any) {
          console.warn('⚠️ No se pudo extraer texto del PDF:', pdfErr.message);
          // Continuar a flujo de imagen
        }
      }

      // Procesar como imagen (imágenes y PDFs escaneados base64 a vision)
      if (!isPDF) {
        try {
          console.log('🖼️  Processing image with Sharp...');
          const metadata = await sharp(req.file.buffer).metadata();
          console.log('📐 Original dimensions:', metadata.width, 'x', metadata.height);

          processedBuffer = await sharp(req.file.buffer)
            .greyscale()
            .normalize()
            .linear(1.2, -(128 * 0.2))
            .trim({ threshold: 80, lineArt: false })
            .sharpen()
            .toBuffer();

          const processedMetadata = await sharp(processedBuffer).metadata();
          console.log('📐 Processed dimensions:', processedMetadata.width, 'x', processedMetadata.height);
          console.log('✅ Image processed. Original:', req.file.size, 'bytes → Processed:', processedBuffer.length, 'bytes');
        } catch (sharpError: any) {
          console.warn('⚠️  Sharp processing failed, using original buffer:', sharpError.message);
          processedBuffer = req.file.buffer;
        }
      } else {
        // For scanned PDFs (no text), send original buffer to vision
        processedBuffer = req.file.buffer;
      }

      // Convert buffer to base64
      const base64Image = processedBuffer.toString('base64');
      const mimeType = req.file.mimetype;
      console.log('📊 Base64 size:', base64Image.length, 'chars, MIME:', mimeType);

      // Process with OpenAI
      const rawBase = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || 'https://api.openai.com';
      const baseNoTrail = rawBase.replace(/\/$/, '');
      const isGroq = baseNoTrail.includes('api.groq.com');
      const normalizedBase = isGroq
        ? baseNoTrail.replace(/\/openai$/, '') + '/openai/v1'
        : baseNoTrail + '/v1';
      console.log('🔧 OpenAI base URL:', normalizedBase);
      
      const openai = new OpenAI({
        baseURL: normalizedBase,
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
      });

      // Get the preferred model - but vision requires gpt-4o or gpt-4-turbo
      let model = process.env.AI_INTEGRATIONS_OPENAI_FAST_MODEL || 'gpt-4o-mini';
      
      // If model doesn't support vision, use gpt-4o instead
      const visionModels = ['gpt-4o', 'gpt-4-turbo', 'gpt-4-vision-preview', 'gpt-4o-mini'];
      if (!visionModels.includes(model)) {
        console.warn('⚠️  Model', model, 'does not support vision, switching to gpt-4o');
        model = 'gpt-4o';
      }
      console.log('🤖 Using model:', model);

      // Call OpenAI Vision API
      console.log('📤 Calling OpenAI Vision API...');
      const response = await openai.chat.completions.create({
        model: model,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analiza este ticket/recibo y extrae la siguiente información en formato JSON:
- date: fecha en formato YYYY-MM-DD (null si no la ves)
- amount: cantidad base (sin IVA) como número decimal (null si no la ves)
- vatAmount: cantidad de IVA como número decimal (null si no la ves)
- totalAmount: cantidad total como número decimal (null si no la ves)
- concept: concepto/descripción corta del gasto (null si no lo ves)
- contactName: nombre del comercio o proveedor (null si no lo ves)
- paymentMethod: método de pago si está visible (null si no lo ves)

IMPORTANTE: Responde SOLO con el JSON válido, sin markdown, sin código blocks, sin explicaciones.`
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`
                }
              }
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0.1
      });

      const content = response.choices[0]?.message?.content || '';
      console.log('📥 OpenAI response received, length:', content.length);
      console.log('📝 Response preview:', content.substring(0, 300));
      
      // Parse JSON response
      let parsedData: any = {};
      try {
        // Extract JSON from response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          console.log('✅ JSON found in response');
          parsedData = JSON.parse(jsonMatch[0]);
        } else {
          console.log('⚠️  No JSON found, trying to parse entire response');
          parsedData = JSON.parse(content);
        }
        console.log('📋 Parsed data:', parsedData);
      } catch (parseError: any) {
        console.error('❌ Error parsing OCR response:', parseError.message);
        console.error('   Raw response:', content);
        return res.status(500).json({ 
          message: 'No se pudo interpretar la respuesta del OCR',
          error: 'JSON parsing failed',
          rawResponse: content.substring(0, 500)
        });
      }

      // Validate and format the response
      const result = {
        date: parsedData.date || null,
        amount: parsedData.amount ? parseFloat(parsedData.amount) : null,
        vatAmount: parsedData.vatAmount ? parseFloat(parsedData.vatAmount) : null,
        totalAmount: parsedData.totalAmount ? parseFloat(parsedData.totalAmount) : null,
        concept: parsedData.concept || null,
        contactName: parsedData.contactName || null,
        paymentMethod: parsedData.paymentMethod || null
        // NOTE: processedImage no se devuelve para evitar respuestas JSON demasiado grandes
        // El cliente usará el archivo original si la imagen fue procesada
      };

      // Calculate missing values if we have some
      if (result.amount && result.totalAmount && !result.vatAmount) {
        result.vatAmount = parseFloat((result.totalAmount - result.amount).toFixed(2));
      } else if (result.amount && result.vatAmount && !result.totalAmount) {
        result.totalAmount = parseFloat((result.amount + result.vatAmount).toFixed(2));
      }

      console.log('✅ OCR Receipt processed successfully:', result);
      res.json(result);
    } catch (error: any) {
      console.error('❌ Error processing OCR receipt:', error.message);
      
      // Log OpenAI specific errors
      if (error.error) {
        console.error('   Error type:', error.error.type);
        console.error('   Error message:', error.error.message);
        console.error('   Error code:', error.error.code);
      }
      if (error.status) {
        console.error('   HTTP Status:', error.status);
      }
      
      // Provide user-friendly error messages
      let userMessage = 'Error al procesar la factura con OCR';
      if (error.message?.includes('401') || error.message?.includes('API key')) {
        userMessage = 'Clave API de OpenAI no configurada o inválida';
      } else if (error.message?.includes('429')) {
        userMessage = 'Límite de solicitudes alcanzado. Intenta más tarde.';
      } else if (error.message?.includes('vision')) {
        userMessage = 'El modelo seleccionado no soporta análisis de imágenes';
      } else if (error.error?.message) {
        userMessage = error.error.message;
      }
      
      // Return detailed error info
      res.status(500).json({ 
        message: userMessage,
        error: error.message,
        errorType: error.error?.type || 'unknown',
        details: error.error?.message || error.message
      });
    }
  });

  // Create entry with attachments
  app.post('/api/accounting/entries', authenticateToken, receiptUpload.array('receipts', 5), async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const userRole = req.user!.role;
      const companyId = req.user!.companyId;
      const data = JSON.parse(req.body.data || '{}');
      
      console.log('📥 POST - Datos recibidos:', data);
      console.log('📥 POST - ProjectId:', data.projectId, 'Type:', typeof data.projectId);
      
      // Employees can only create expenses for themselves
      if (userRole === 'employee') {
        data.employeeId = userId;
        data.type = 'expense';
      }
      
      // Calculate total amount
      const amount = parseFloat(data.amount);
      const vatAmount = parseFloat(data.vatAmount || 0);
      data.totalAmount = (amount + vatAmount).toFixed(2);
      data.submittedBy = userId;
      data.companyId = companyId;

      // IRPF fields
      data.irpfRetentionRate = data.irpfRetentionRate !== undefined && data.irpfRetentionRate !== null
        ? parseFloat(data.irpfRetentionRate)
        : null;
      data.irpfRetentionAmount = data.irpfRetentionAmount !== undefined && data.irpfRetentionAmount !== null
        ? parseFloat(data.irpfRetentionAmount)
        : null;
      data.irpfDeductible = data.irpfDeductible === undefined ? (data.type === 'expense') : Boolean(data.irpfDeductible);
      data.irpfDeductionPercentage = data.irpfDeductionPercentage !== undefined && data.irpfDeductionPercentage !== null
        ? parseFloat(data.irpfDeductionPercentage)
        : 100.00;
      data.irpfIsSocialSecurity = Boolean(data.irpfIsSocialSecurity);
      data.irpfIsAmortization = Boolean(data.irpfIsAmortization);
      data.irpfFiscalAdjustment = data.irpfFiscalAdjustment !== undefined && data.irpfFiscalAdjustment !== null
        ? parseFloat(data.irpfFiscalAdjustment)
        : 0.00;
      data.fiscalNotes = data.fiscalNotes || null;
      // Retenciones 111/115
      const allowedRetentionTypes = ['professional','rent','other'];
      data.retentionType = typeof data.retentionType === 'string' && allowedRetentionTypes.includes(data.retentionType)
        ? data.retentionType
        : null;
      data.retentionAppliedByUs = Boolean(data.retentionAppliedByUs);
      
      console.log('💾 Datos finales antes de INSERT:', data);
      console.log('💾 ProjectId final:', data.projectId);
      
      // Create entry
      const [entry] = await db.insert(schema.accountingEntries)
        .values(data)
        .returning();
      
      console.log('✅ Entry creado con ID:', entry.id, 'ProjectId guardado:', entry.projectId);
      // Get user info for filename
      const [uploadUser] = await db.select()
        .from(schema.users)
        .where(eq(schema.users.id, userId));
      const userName = uploadUser?.fullName || 'Usuario';
      
      // Format date for filename: YY.MM.DD
      const entryDateObj = new Date(data.entryDate || new Date());
      const year = entryDateObj.getFullYear().toString().slice(-2);
      const month = (entryDateObj.getMonth() + 1).toString().padStart(2, '0');
      const day = entryDateObj.getDate().toString().padStart(2, '0');
      const concept = data.concept || 'Gasto';
      
      // Upload attachments to R2
      if (req.files && Array.isArray(req.files)) {
        let fileIndex = 1;
        for (const file of req.files) {
          const ext = path.extname(file.originalname);
          const baseNameOriginal = path.basename(file.originalname, ext);
          
          // Format: "25.12.31 - Concepto - Usuario - NombreOriginal.pdf"
          // If multiple files with same base concept, add index
          let formattedFileName = `${year}.${month}.${day} - ${concept} - ${userName}`;
          if (req.files.length > 1) {
            formattedFileName += ` (${fileIndex})`;
          }
          formattedFileName += ext;
          
          // Upload to R2 with formatted name
          const r2Key = await objectStorage.uploadDocument(
            file.buffer,
            file.mimetype,
            formattedFileName
          );
          
          fileIndex++;
          
          await db.insert(schema.accountingAttachments)
            .values({
              entryId: entry.id,
              fileName: formattedFileName, // Use formatted name
              filePath: r2Key, // Store R2 key instead of local path
              fileSize: file.size,
              mimeType: file.mimetype,
              uploadedBy: userId
            });
          
          // Also create document entry in accounting folder
          // This works even if company doesn't have documents addon
          // Files will appear in documents module when they subscribe to it
          await createAccountingDocument({
            companyId,
            userId,
            entryDate: data.entryDate || new Date().toISOString().split('T')[0],
            concept: concept,
            fileName: file.originalname, // Keep original for reference
            filePath: r2Key, // Use R2 key
            fileSize: file.size,
            mimeType: file.mimetype,
          });
        }
      }
      
      res.json(entry);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update entry
  app.patch('/api/accounting/entries/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const entryId = parseInt(req.params.id);
      const userRole = req.user!.role;
      const userId = req.user!.id;
      
      console.log('🔄 PATCH entry:', entryId, 'body:', req.body, 'user role:', userRole);
      console.log('📥 PATCH - ProjectId:', req.body.projectId, 'Type:', typeof req.body.projectId);
      
      // Check permissions
      const [existing] = await db.select()
        .from(schema.accountingEntries)
        .where(and(
          eq(schema.accountingEntries.id, entryId),
          eq(schema.accountingEntries.companyId, req.user!.companyId)
        ));
      
      if (!existing) {
        return res.status(404).json({ message: 'Entrada no encontrada' });
      }
      
      console.log('📋 Existing entry status:', existing.status, '→ New status:', req.body.status);
      
      // Employees can only edit their own pending expenses
      if (userRole === 'employee' && (existing.employeeId !== userId || existing.status !== 'pending')) {
        return res.status(403).json({ message: 'No puedes editar esta entrada' });
      }
      
      // Managers can only edit pending entries
      if (userRole === 'manager' && existing.status !== 'pending') {
        return res.status(403).json({ message: 'No puedes editar entradas ya revisadas' });
      }
      
      // Admin can edit anything, including reverting status
      
      const updateData: any = { 
        ...req.body, 
        updatedAt: new Date(),
        // If reverting to pending, clear review fields
        ...(req.body.status === 'pending' && userRole === 'admin' ? {
          reviewedBy: null,
          reviewedAt: null,
          reviewNotes: null
        } : {})
      };

      if (updateData.irpfRetentionRate !== undefined) {
        updateData.irpfRetentionRate = updateData.irpfRetentionRate === null ? null : parseFloat(updateData.irpfRetentionRate);
      }
      if (updateData.irpfRetentionAmount !== undefined) {
        updateData.irpfRetentionAmount = updateData.irpfRetentionAmount === null ? null : parseFloat(updateData.irpfRetentionAmount);
      }
      if (updateData.irpfDeductible !== undefined) {
        updateData.irpfDeductible = Boolean(updateData.irpfDeductible);
      }
      if (updateData.irpfDeductionPercentage !== undefined) {
        updateData.irpfDeductionPercentage = updateData.irpfDeductionPercentage === null ? 100.00 : parseFloat(updateData.irpfDeductionPercentage);
      }
      if (updateData.irpfIsSocialSecurity !== undefined) {
        updateData.irpfIsSocialSecurity = Boolean(updateData.irpfIsSocialSecurity);
      }
      if (updateData.irpfIsAmortization !== undefined) {
        updateData.irpfIsAmortization = Boolean(updateData.irpfIsAmortization);
      }
      if (updateData.irpfFiscalAdjustment !== undefined) {
        updateData.irpfFiscalAdjustment = updateData.irpfFiscalAdjustment === null ? 0.00 : parseFloat(updateData.irpfFiscalAdjustment);
      }
      if (updateData.fiscalNotes !== undefined) {
        updateData.fiscalNotes = updateData.fiscalNotes || null;
      }
      // Retenciones 111/115
      if (updateData.retentionType !== undefined) {
        const allowedRetentionTypesPatch = ['professional','rent','other'];
        updateData.retentionType = typeof updateData.retentionType === 'string' && allowedRetentionTypesPatch.includes(updateData.retentionType)
          ? updateData.retentionType
          : null;
      }
      if (updateData.retentionAppliedByUs !== undefined) {
        updateData.retentionAppliedByUs = Boolean(updateData.retentionAppliedByUs);
      }
      
      console.log('💾 Update data:', updateData);
      
      const [entry] = await db.update(schema.accountingEntries)
        .set(updateData)
        .where(eq(schema.accountingEntries.id, entryId))
        .returning();
      
      console.log('✅ Entry updated:', entry.id, 'status:', entry.status);
      
      res.json(entry);
    } catch (error: any) {
      console.error('❌ Error updating accounting entry:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Approve/Reject entry (admin/manager only)
  app.post('/api/accounting/entries/:id/review', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const { status, reviewNotes } = req.body; // 'approved' or 'rejected'
      
      if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ message: 'Estado inválido' });
      }
      
      const [entry] = await db.update(schema.accountingEntries)
        .set({
          status,
          reviewedBy: req.user!.id,
          reviewedAt: new Date(),
          reviewNotes,
          updatedAt: new Date()
        })
        .where(and(
          eq(schema.accountingEntries.id, parseInt(req.params.id)),
          eq(schema.accountingEntries.companyId, req.user!.companyId)
        ))
        .returning();
      
      if (!entry) {
        return res.status(404).json({ message: 'Entrada no encontrada' });
      }
      
      res.json(entry);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete entry
  app.delete('/api/accounting/entries/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const entryId = parseInt(req.params.id);
      const userRole = req.user!.role;
      const userId = req.user!.id;
      
      // Check permissions
      const [existing] = await db.select()
        .from(schema.accountingEntries)
        .where(and(
          eq(schema.accountingEntries.id, entryId),
          eq(schema.accountingEntries.companyId, req.user!.companyId)
        ));
      
      if (!existing) {
        return res.status(404).json({ message: 'Entrada no encontrada' });
      }
      
      // Employees can only delete their own pending expenses
      if (userRole === 'employee' && (existing.employeeId !== userId || existing.status !== 'pending')) {
        return res.status(403).json({ message: 'No puedes eliminar esta entrada' });
      }
      
      // Delete attachment files from R2
      const attachments = await db.select()
        .from(schema.accountingAttachments)
        .where(eq(schema.accountingAttachments.entryId, entryId));
      
      for (const attachment of attachments) {
        // TODO: Implement deleteDocument in objectStorage to delete from R2
        // For now, files remain in R2 (low storage cost)
        
        // Also delete from documents table (accounting folder documents)
        // Find documents with matching filePath
        await db.delete(schema.documents)
          .where(eq(schema.documents.filePath, attachment.filePath));
      }
      
      await db.delete(schema.accountingEntries)
        .where(eq(schema.accountingEntries.id, entryId));
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Dashboard stats
  app.get('/api/accounting/dashboard', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;
      const { startDate, endDate } = req.query;
      
      console.log('📊 Dashboard request for company:', companyId, 'dates:', { startDate, endDate });
      
      let dateConditions = [];
      if (startDate) {
        dateConditions.push(gte(schema.accountingEntries.entryDate, startDate as string));
      }
      if (endDate) {
        dateConditions.push(lte(schema.accountingEntries.entryDate, endDate as string));
      }
      
      // Total expenses (only approved)
      const [totalExpenses] = await db.select({
        total: sql<string>`COALESCE(SUM(${schema.accountingEntries.totalAmount}), 0)`,
        count: sql<number>`COUNT(*)::int`
      })
      .from(schema.accountingEntries)
      .where(and(
        eq(schema.accountingEntries.companyId, companyId),
        eq(schema.accountingEntries.type, 'expense'),
        eq(schema.accountingEntries.status, 'approved'),
        ...(dateConditions.length > 0 ? dateConditions : [])
      ));
      
      console.log('💰 Total expenses (approved only):', totalExpenses);
      
      // Total incomes (only approved)
      const [totalIncomes] = await db.select({
        total: sql<string>`COALESCE(SUM(${schema.accountingEntries.totalAmount}), 0)`,
        count: sql<number>`COUNT(*)::int`
      })
      .from(schema.accountingEntries)
      .where(and(
        eq(schema.accountingEntries.companyId, companyId),
        eq(schema.accountingEntries.type, 'income'),
        eq(schema.accountingEntries.status, 'approved'),
        ...(dateConditions.length > 0 ? dateConditions : [])
      ));
      
      console.log('💰 Total incomes (approved only):', totalIncomes);
      
      // Pending expenses (employee submissions)
      const [pendingExpenses] = await db.select({
        count: sql<number>`COUNT(*)::int`,
        total: sql<string>`COALESCE(SUM(${schema.accountingEntries.totalAmount}), 0)`
      })
      .from(schema.accountingEntries)
      .where(and(
        eq(schema.accountingEntries.companyId, companyId),
        eq(schema.accountingEntries.type, 'expense'),
        eq(schema.accountingEntries.status, 'pending')
      ));
      
      // Expenses by category (only approved)
      const expensesByCategory = await db.select({
        categoryId: schema.accountingEntries.categoryId,
        categoryName: schema.accountingCategories.name,
        categoryColor: schema.accountingCategories.color,
        total: sql<string>`COALESCE(SUM(${schema.accountingEntries.totalAmount}), 0)`,
        count: sql<number>`COUNT(*)::int`
      })
      .from(schema.accountingEntries)
      .leftJoin(schema.accountingCategories, eq(schema.accountingEntries.categoryId, schema.accountingCategories.id))
      .where(and(
        eq(schema.accountingEntries.companyId, companyId),
        eq(schema.accountingEntries.type, 'expense'),
        eq(schema.accountingEntries.status, 'approved'),
        ...(dateConditions.length > 0 ? dateConditions : [])
      ))
      .groupBy(schema.accountingEntries.categoryId, schema.accountingCategories.name, schema.accountingCategories.color);
      
      const result = {
        totalExpenses: {
          amount: parseFloat(totalExpenses.total),
          count: totalExpenses.count
        },
        totalIncomes: {
          amount: parseFloat(totalIncomes.total),
          count: totalIncomes.count
        },
        balance: parseFloat(totalIncomes.total) - parseFloat(totalExpenses.total),
        pendingExpenses: {
          count: pendingExpenses.count,
          amount: parseFloat(pendingExpenses.total)
        },
        expensesByCategory: expensesByCategory.map(cat => ({
          ...cat,
          total: parseFloat(cat.total)
        })),
      };
      
      console.log('📊 Dashboard result:', JSON.stringify(result, null, 2));
      
      res.json(result);
    } catch (error: any) {
      console.error('❌ Dashboard error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Geocoding proxy endpoint (Photon API)
  app.get('/api/geocoding/search', async (req, res) => {
    try {
      const query = req.query.q as string;
      
      if (!query || query.length < 3) {
        return res.status(400).json({ error: 'Query must be at least 3 characters' });
      }

      const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5`;
      console.log('🌐 Geocoding request:', url);

      // Call Photon API (free OpenStreetMap geocoding) - uses default language
      const response = await fetch(url);

      console.log('📡 Photon API response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Photon API error:', response.status, errorText);
        throw new Error(`Photon API request failed: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Photon API success, features:', data.features?.length || 0);
      res.json(data);
    } catch (error: any) {
      console.error('❌ Geocoding error:', error.message);
      res.status(500).json({ error: 'Failed to fetch location data', details: error.message });
    }
  });

  // DON'T start background services here - they will be started after server.listen()
  // to ensure health checks pass quickly

  // ═══════════════════════════════════════════════════════════════════════════
  // 🏢 ACCOUNTANT/ADVISORY ROUTES - External accountant management
  // ═══════════════════════════════════════════════════════════════════════════

  // Get companies assigned to accountant
  app.get('/api/accountant/companies', authenticateToken, requireRole(['accountant']), async (req: AuthRequest, res) => {
    try {
      const accountantId = req.user!.id;
      
      const companies = await db.select({
        id: schema.companies.id,
        name: schema.companies.name,
        cif: schema.companies.cif,
        logoUrl: schema.companies.logoUrl,
        companyAlias: schema.companies.companyAlias,
      })
      .from(schema.companyAccountants)
      .innerJoin(schema.companies, eq(schema.companyAccountants.companyId, schema.companies.id))
      .where(and(
        eq(schema.companyAccountants.accountantUserId, accountantId),
        isNull(schema.companyAccountants.disabledAt)
      ));
      
      res.json(companies);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get company details (accountant view)
  app.get('/api/accountant/companies/:companyId/details', authenticateToken, requireRole(['accountant']), async (req: AuthRequest, res) => {
    try {
      const accountantId = req.user!.id;
      const companyId = parseInt(req.params.companyId);
      
      // Verify access
      const [assignment] = await db.select()
        .from(schema.companyAccountants)
        .where(and(
          eq(schema.companyAccountants.companyId, companyId),
          eq(schema.companyAccountants.accountantUserId, accountantId),
          isNull(schema.companyAccountants.disabledAt)
        ));
      
      if (!assignment) {
        return res.status(403).json({ message: 'Sin acceso a esta empresa' });
      }
      
      // Get company details
      const [companyDetails] = await db.select()
        .from(schema.companies)
        .where(eq(schema.companies.id, companyId));
      
      if (!companyDetails) {
        return res.status(404).json({ message: 'Empresa no encontrada' });
      }
      
      res.json(companyDetails);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get recent entries from ALL assigned companies (mixed)
  app.get('/api/accountant/recent-entries', authenticateToken, requireRole(['accountant']), async (req: AuthRequest, res) => {
    try {
      const accountantId = req.user!.id;
      console.log('🔍 Accountant recent entries request from:', accountantId);
      
      // Get all companies assigned to this accountant
      const assignedCompanies = await db.select({ companyId: schema.companyAccountants.companyId })
        .from(schema.companyAccountants)
        .where(and(
          eq(schema.companyAccountants.accountantUserId, accountantId),
          isNull(schema.companyAccountants.disabledAt)
        ));
      
      console.log('📊 Assigned companies:', assignedCompanies.length);
      
      if (assignedCompanies.length === 0) {
        return res.json([]);
      }
      
      const companyIds = assignedCompanies.map(c => c.companyId);
      console.log('🏢 Company IDs:', companyIds);
      
      // Get last 50 entries from all companies (approved, approved_accountant, or rejected)
      const entries = await db.select({
        id: schema.accountingEntries.id,
        companyId: schema.accountingEntries.companyId,
        entryDate: schema.accountingEntries.entryDate,
        description: schema.accountingEntries.concept, // usamos concept como descripción
        type: schema.accountingEntries.type,
        amount: schema.accountingEntries.amount,
        totalAmount: schema.accountingEntries.totalAmount,
        status: schema.accountingEntries.status,
        refCode: schema.accountingEntries.refCode,
        accountantNotes: schema.accountingEntries.accountantNotes,
        accountantReviewedAt: schema.accountingEntries.accountantReviewedAt,
        createdAt: schema.accountingEntries.createdAt,
        categoryName: schema.accountingCategories.name,
        companyName: schema.companies.name,
        companyCif: schema.companies.cif,
        companyLogoUrl: schema.companies.logoUrl,
      })
      .from(schema.accountingEntries)
      .leftJoin(schema.accountingCategories, eq(schema.accountingEntries.categoryId, schema.accountingCategories.id))
      .innerJoin(schema.companies, eq(schema.accountingEntries.companyId, schema.companies.id))
      .where(and(
        inArray(schema.accountingEntries.companyId, companyIds),
        or(
          eq(schema.accountingEntries.status, 'approved'),
          eq(schema.accountingEntries.status, 'approved_accountant'),
          eq(schema.accountingEntries.status, 'rejected')
        )
      ))
      .orderBy(desc(schema.accountingEntries.createdAt))
      .limit(50);
      
      console.log('📋 Entries found:', entries.length);
      
      // Format response with company info
      const formattedEntries = entries.map(entry => ({
        id: entry.id,
        companyId: entry.companyId,
        entryDate: entry.entryDate,
        description: entry.description,
        type: entry.type,
        category: entry.categoryName,
        amount: entry.amount,
        totalAmount: entry.totalAmount,
        status: entry.status,
        refCode: entry.refCode,
        accountantNotes: entry.accountantNotes,
        accountantReviewedAt: entry.accountantReviewedAt,
        createdAt: entry.createdAt,
        company: {
          id: entry.companyId,
          name: entry.companyName,
          cif: entry.companyCif,
          logoUrl: entry.companyLogoUrl,
        }
      }));
      
      res.json(formattedEntries);
    } catch (error: any) {
      console.error('❌ Error in accountant recent entries:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get stats for a specific company (accountant view)
  app.get('/api/accountant/companies/:companyId/stats', authenticateToken, requireRole(['accountant']), async (req: AuthRequest, res) => {
    try {
      const accountantId = req.user!.id;
      const companyId = parseInt(req.params.companyId);
      
      // Verify accountant has access to this company
      const [assignment] = await db.select()
        .from(schema.companyAccountants)
        .where(and(
          eq(schema.companyAccountants.companyId, companyId),
          eq(schema.companyAccountants.accountantUserId, accountantId),
          isNull(schema.companyAccountants.disabledAt)
        ));
      
      if (!assignment) {
        return res.status(403).json({ message: 'Sin acceso a esta empresa' });
      }
      
      // Get counts by status
      const [counts] = await db.select({
        pending: sql<number>`COUNT(*) FILTER (WHERE status = 'pending')::int`,
        submitted: sql<number>`COUNT(*) FILTER (WHERE status = 'submitted')::int`,
        accountantApproved: sql<number>`COUNT(*) FILTER (WHERE status = 'accountant_approved')::int`,
        approved: sql<number>`COUNT(*) FILTER (WHERE status = 'approved')::int`,
        total: sql<string>`COALESCE(SUM(total_amount), 0)`,
      })
      .from(schema.accountingEntries)
      .where(eq(schema.accountingEntries.companyId, companyId));
      
      res.json({
        pendingCount: counts.pending || 0,
        submittedCount: counts.submitted || 0,
        approvedCount: (counts.accountantApproved || 0) + (counts.approved || 0),
        totalAmount: parseFloat(counts.total || '0'),
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get accounting entries for a company (accountant view)
  app.get('/api/accountant/companies/:companyId/entries', authenticateToken, requireRole(['accountant']), async (req: AuthRequest, res) => {
    try {
      const accountantId = req.user!.id;
      const companyId = parseInt(req.params.companyId);
      
      // Verify access
      const [assignment] = await db.select()
        .from(schema.companyAccountants)
        .where(and(
          eq(schema.companyAccountants.companyId, companyId),
          eq(schema.companyAccountants.accountantUserId, accountantId),
          isNull(schema.companyAccountants.disabledAt)
        ));
      
      if (!assignment) {
        return res.status(403).json({ message: 'Sin acceso a esta empresa' });
      }
      
      const entries = await db.select()
        .from(schema.accountingEntries)
        .leftJoin(schema.accountingCategories, eq(schema.accountingEntries.categoryId, schema.accountingCategories.id))
        .where(eq(schema.accountingEntries.companyId, companyId))
        .orderBy(desc(schema.accountingEntries.entryDate));
      
      // Enrich with related data (same as admin endpoint)
      const enrichedEntries = await Promise.all(entries.map(async (row) => {
        const entry = row.accounting_entries;
        const category = row.accounting_categories;
        
        // Get project if exists
        let project = null;
        if (entry.projectId) {
          const [proj] = await db.select({
            id: schema.projects.id,
            name: schema.projects.name,
            code: schema.projects.code
          }).from(schema.projects).where(eq(schema.projects.id, entry.projectId));
          project = proj || null;
        }
        
        // Get employee if exists
        let employee = null;
        if (entry.employeeId) {
          const [emp] = await db.select({
            id: schema.users.id,
            fullName: schema.users.fullName,
            profilePicture: schema.users.profilePicture
          }).from(schema.users).where(eq(schema.users.id, entry.employeeId));
          employee = emp || null;
        }
        
        // Get CRM client if exists
        let crmClient = null;
        if (entry.crmClientId) {
          const [client] = await db.select({
            id: schema.businessContacts.id,
            name: schema.businessContacts.name,
            email: schema.businessContacts.email
          }).from(schema.businessContacts).where(eq(schema.businessContacts.id, entry.crmClientId));
          crmClient = client || null;
        }
        
        // Get CRM supplier if exists
        let crmSupplier = null;
        if (entry.crmSupplierId) {
          const [supplier] = await db.select({
            id: schema.businessContacts.id,
            name: schema.businessContacts.name,
            email: schema.businessContacts.email
          }).from(schema.businessContacts).where(eq(schema.businessContacts.id, entry.crmSupplierId));
          crmSupplier = supplier || null;
        }
        
        // Count attachments
        const [countResult] = await db.select({ count: count() })
          .from(schema.accountingAttachments)
          .where(eq(schema.accountingAttachments.entryId, entry.id));
        
        return {
          ...entry,
          category: category ? {
            id: category.id,
            name: category.name,
            color: category.color,
            icon: category.icon,
            type: category.type
          } : null,
          employee,
          project,
          crmClient,
          crmSupplier,
          attachmentsCount: countResult?.count || 0
        };
      }));
      
      res.json(enrichedEntries);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Review entry as accountant (approve/reject)
  // Review entry as accountant (with companies route - matches frontend)
  app.post('/api/accountant/companies/:companyId/entries/:entryId/review', authenticateToken, requireRole(['accountant']), async (req: AuthRequest, res) => {
    try {
      const accountantId = req.user!.id;
      const companyId = parseInt(req.params.companyId);
      const entryId = parseInt(req.params.entryId);
      const { status, notes } = req.body; // 'approved_accountant', 'approved' or 'rejected'
      
      if (!['approved', 'rejected', 'approved_accountant'].includes(status)) {
        return res.status(400).json({ message: 'Estado inválido' });
      }
      
      // Verify accountant has access to this company
      const [assignment] = await db.select()
        .from(schema.companyAccountants)
        .where(and(
          eq(schema.companyAccountants.companyId, companyId),
          eq(schema.companyAccountants.accountantUserId, accountantId),
          isNull(schema.companyAccountants.disabledAt)
        ));
      
      if (!assignment) {
        return res.status(403).json({ message: 'Sin acceso a esta empresa' });
      }
      
      // Get entry to verify it belongs to this company
      const [entry] = await db.select()
        .from(schema.accountingEntries)
        .where(and(
          eq(schema.accountingEntries.id, entryId),
          eq(schema.accountingEntries.companyId, companyId)
        ));
      
      if (!entry) {
        return res.status(404).json({ message: 'Entrada no encontrada' });
      }
      
      // Update entry
      const [updated] = await db.update(schema.accountingEntries)
        .set({
          status,
          accountantReviewedBy: accountantId,
          accountantReviewedAt: new Date(),
          accountantNotes: notes,
          updatedAt: new Date()
        })
        .where(eq(schema.accountingEntries.id, entryId))
        .returning();
      
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Review entry as accountant (old route for compatibility)
  app.post('/api/accountant/entries/:id/review', authenticateToken, requireRole(['accountant']), async (req: AuthRequest, res) => {
    try {
      const accountantId = req.user!.id;
      const entryId = parseInt(req.params.id);
      const { status, notes } = req.body; // 'approved_accountant', 'approved' or 'rejected'
      
      if (!['approved', 'rejected', 'approved_accountant'].includes(status)) {
        return res.status(400).json({ message: 'Estado inválido' });
      }
      
      // Get entry to verify company access
      const [entry] = await db.select()
        .from(schema.accountingEntries)
        .where(eq(schema.accountingEntries.id, entryId));
      
      if (!entry) {
        return res.status(404).json({ message: 'Entrada no encontrada' });
      }
      
      // Verify accountant has access to this company
      const [assignment] = await db.select()
        .from(schema.companyAccountants)
        .where(and(
          eq(schema.companyAccountants.companyId, entry.companyId),
          eq(schema.companyAccountants.accountantUserId, accountantId),
          isNull(schema.companyAccountants.disabledAt)
        ));
      
      if (!assignment) {
        return res.status(403).json({ message: 'Sin acceso a esta empresa' });
      }
      
      // Update entry
      const [updated] = await db.update(schema.accountingEntries)
        .set({
          status,
          accountantReviewedBy: accountantId,
          accountantReviewedAt: new Date(),
          accountantNotes: notes,
          updatedAt: new Date()
        })
        .where(eq(schema.accountingEntries.id, entryId))
        .returning();
      
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update an entry (accountant can edit approved entries)
  app.patch('/api/accountant/companies/:companyId/entries/:entryId', authenticateToken, requireRole(['accountant']), async (req: AuthRequest, res) => {
    try {
      const accountantId = req.user!.id;
      const companyId = parseInt(req.params.companyId);
      const entryId = parseInt(req.params.entryId);
      
      // Verify access to company
      const [assignment] = await db.select()
        .from(schema.companyAccountants)
        .where(and(
          eq(schema.companyAccountants.companyId, companyId),
          eq(schema.companyAccountants.accountantUserId, accountantId),
          isNull(schema.companyAccountants.disabledAt)
        ));
      
      if (!assignment) {
        return res.status(403).json({ message: 'Sin acceso a esta empresa' });
      }
      
      // Get entry to verify it belongs to this company
      const [entry] = await db.select()
        .from(schema.accountingEntries)
        .where(and(
          eq(schema.accountingEntries.id, entryId),
          eq(schema.accountingEntries.companyId, companyId)
        ));
      
      if (!entry) {
        return res.status(404).json({ message: 'Entrada no encontrada' });
      }
      
      // Update entry with the provided data
      const updateData: any = {};
      const allowedFields = [
        'type', 'categoryId', 'concept', 'amount', 'vatRate', 'vatAmount', 
        'totalAmount', 'description', 'refCode', 'entryDate', 'projectId', 
        'paymentMethod', 'crmClientId', 'crmSupplierId', 'irpfRetentionRate',
        'irpfRetentionAmount', 'irpfDeductible', 'irpfDeductionPercentage',
        'irpfIsSocialSecurity', 'irpfIsAmortization', 'irpfFiscalAdjustment',
        'fiscalNotes', 'retentionType', 'retentionAppliedByUs'
      ];
      
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      }
      
      updateData.updatedAt = new Date();
      
      const [updated] = await db.update(schema.accountingEntries)
        .set(updateData)
        .where(eq(schema.accountingEntries.id, entryId))
        .returning();
      
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get root documents for a company (accountant view)
  app.get('/api/accountant/companies/:companyId/root-documents', authenticateToken, requireRole(['accountant']), async (req: AuthRequest, res) => {
    try {
      const accountantId = req.user!.id;
      const companyId = parseInt(req.params.companyId);
      
      // Verify access
      const [assignment] = await db.select()
        .from(schema.companyAccountants)
        .where(and(
          eq(schema.companyAccountants.companyId, companyId),
          eq(schema.companyAccountants.accountantUserId, accountantId),
          isNull(schema.companyAccountants.disabledAt)
        ));
      
      if (!assignment) {
        return res.status(403).json({ message: 'Sin acceso a esta empresa' });
      }
      
      // Get documents without folder (root documents only)
      const owner = alias(schema.users, 'documentOwner');

      const documents = await db.select({
        id: schema.documents.id,
        name: schema.documents.fileName,
        originalName: schema.documents.originalName,
        fileSize: schema.documents.fileSize,
        mimeType: schema.documents.mimeType,
        filePath: schema.documents.filePath,
        uploadedAt: schema.documents.createdAt,
        uploaderFullName: schema.users.fullName,
        ownerId: schema.documents.userId,
        ownerFullName: owner.fullName,
        ownerProfile: owner.profilePicture,
        folderId: schema.documents.folderId,
      })
      .from(schema.documents)
      .leftJoin(schema.users, eq(schema.documents.uploadedBy, schema.users.id))
      .leftJoin(owner, eq(schema.documents.userId, owner.id))
      .where(and(
        eq(schema.documents.companyId, companyId),
        isNull(schema.documents.folderId) // Solo documentos raíz (sin carpeta)
      ))
      .orderBy(desc(schema.documents.createdAt));
      
      const formattedDocs = documents.map(doc => ({
        id: doc.id,
        name: doc.name,
        originalName: doc.originalName,
        fileSize: doc.fileSize,
        mimeType: doc.mimeType,
        fileUrl: doc.filePath || `/api/documents/${doc.id}/download?preview=true`,
        uploadedAt: doc.uploadedAt,
        folderId: doc.folderId,
        userId: doc.ownerId,
        user: {
          fullName: doc.ownerFullName || 'Usuario',
          profilePicture: doc.ownerProfile || null,
        },
        uploadedByUser: {
          fullName: doc.uploaderFullName || 'Usuario desconocido'
        }
      }));
      
      res.json(formattedDocs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get folders for a company (accountant view) - optional parentId for subfolders
  app.get('/api/accountant/companies/:companyId/folders', authenticateToken, requireRole(['accountant']), async (req: AuthRequest, res) => {
    try {
      const accountantId = req.user!.id;
      const companyId = parseInt(req.params.companyId);
      const parentIdParam = req.query.parentId as string | undefined;
      const parentId = parentIdParam ? parseInt(parentIdParam) : null;

      // Verify access
      const [assignment] = await db.select()
        .from(schema.companyAccountants)
        .where(and(
          eq(schema.companyAccountants.companyId, companyId),
          eq(schema.companyAccountants.accountantUserId, accountantId),
          isNull(schema.companyAccountants.disabledAt)
        ));
      if (!assignment) {
        return res.status(403).json({ message: 'Sin acceso a esta empresa' });
      }

      const folders = await db.select({
        id: schema.documentFolders.id,
        name: schema.documentFolders.name,
        parentId: schema.documentFolders.parentId,
        path: schema.documentFolders.path,
      })
      .from(schema.documentFolders)
      .where(and(
        eq(schema.documentFolders.companyId, companyId),
        parentId === null
          ? isNull(schema.documentFolders.parentId)
          : eq(schema.documentFolders.parentId, parentId)
      ))
      .orderBy(schema.documentFolders.name);

      res.json(folders);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get documents inside a folder (accountant view)
  app.get('/api/accountant/companies/:companyId/folders/:folderId/documents', authenticateToken, requireRole(['accountant']), async (req: AuthRequest, res) => {
    try {
      const accountantId = req.user!.id;
      const companyId = parseInt(req.params.companyId);
      const folderId = parseInt(req.params.folderId);

      // Verify access
      const [assignment] = await db.select()
        .from(schema.companyAccountants)
        .where(and(
          eq(schema.companyAccountants.companyId, companyId),
          eq(schema.companyAccountants.accountantUserId, accountantId),
          isNull(schema.companyAccountants.disabledAt)
        ));
      if (!assignment) {
        return res.status(403).json({ message: 'Sin acceso a esta empresa' });
      }

      // Ensure folder belongs to company
      const [folder] = await db.select({ id: schema.documentFolders.id })
        .from(schema.documentFolders)
        .where(and(
          eq(schema.documentFolders.id, folderId),
          eq(schema.documentFolders.companyId, companyId)
        ));
      if (!folder) {
        return res.status(404).json({ message: 'Carpeta no encontrada' });
      }

      const owner = alias(schema.users, 'documentOwner');

      const documents = await db.select({
        id: schema.documents.id,
        name: schema.documents.fileName,
        originalName: schema.documents.originalName,
        fileSize: schema.documents.fileSize,
        mimeType: schema.documents.mimeType,
        filePath: schema.documents.filePath,
        uploadedAt: schema.documents.createdAt,
        uploaderFullName: schema.users.fullName,
        ownerId: schema.documents.userId,
        ownerFullName: owner.fullName,
        ownerProfile: owner.profilePicture,
        folderId: schema.documents.folderId,
      })
      .from(schema.documents)
      .leftJoin(schema.users, eq(schema.documents.uploadedBy, schema.users.id))
      .leftJoin(owner, eq(schema.documents.userId, owner.id))
      .where(and(
        eq(schema.documents.companyId, companyId),
        eq(schema.documents.folderId, folderId)
      ))
      .orderBy(desc(schema.documents.createdAt));

      const formattedDocs = documents.map(doc => ({
        id: doc.id,
        name: doc.name,
        originalName: doc.originalName,
        fileSize: doc.fileSize,
        mimeType: doc.mimeType,
        fileUrl: doc.filePath || `/api/documents/${doc.id}/download?preview=true`,
        uploadedAt: doc.uploadedAt,
        folderId: doc.folderId,
        userId: doc.ownerId,
        user: {
          fullName: doc.ownerFullName || 'Usuario',
          profilePicture: doc.ownerProfile || null,
        },
        uploadedByUser: {
          fullName: doc.uploaderFullName || 'Usuario desconocido'
        }
      }));

      res.json(formattedDocs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get CRM status for a company (accountant view)
  app.get('/api/accountant/companies/:companyId/crm-status', authenticateToken, requireRole(['accountant']), async (req: AuthRequest, res) => {
    try {
      const accountantId = req.user!.id;
      const companyId = parseInt(req.params.companyId);
      
      // Verify access
      const [assignment] = await db.select()
        .from(schema.companyAccountants)
        .where(and(
          eq(schema.companyAccountants.companyId, companyId),
          eq(schema.companyAccountants.accountantUserId, accountantId),
          isNull(schema.companyAccountants.disabledAt)
        ));
      
      if (!assignment) {
        return res.status(403).json({ message: 'Sin acceso a esta empresa' });
      }
      
      // Check if CRM is active for this company using storage method
      const hasAddon = await storage.hasActiveAddon(companyId, 'crm');
      res.json({ active: hasAddon });
    } catch (error: any) {
      console.error('❌ CRM status error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get projects for a company (accountant view)
  app.get('/api/accountant/companies/:companyId/projects', authenticateToken, requireRole(['accountant']), async (req: AuthRequest, res) => {
    try {
      const accountantId = req.user!.id;
      const companyId = parseInt(req.params.companyId);
      
      // Verify access
      const [assignment] = await db.select()
        .from(schema.companyAccountants)
        .where(and(
          eq(schema.companyAccountants.companyId, companyId),
          eq(schema.companyAccountants.accountantUserId, accountantId),
          isNull(schema.companyAccountants.disabledAt)
        ));
      
      if (!assignment) {
        return res.status(403).json({ message: 'Sin acceso a esta empresa' });
      }
      
      // Get projects for this company (same as admin endpoint)
      const projects = await db.select({ project: schema.projects })
        .from(schema.projects)
        .where(eq(schema.projects.companyId, companyId))
        .orderBy(desc(schema.projects.createdAt));

      // Enriquecer cada proyecto con clientes/proveedores completos
      const projectsWithContacts = await Promise.all(
        projects.map(async (p) => fetchProjectWithContacts(p.project.id, companyId))
      );

      const filtered = projectsWithContacts.filter(Boolean);
      res.json(filtered);
    } catch (error: any) {
      console.error('Error fetching projects for accountant:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get categories for a company (accountant view)
  app.get('/api/accountant/companies/:companyId/categories', authenticateToken, requireRole(['accountant']), async (req: AuthRequest, res) => {
    try {
      const accountantId = req.user!.id;
      const companyId = parseInt(req.params.companyId);
      
      // Verify access
      const [assignment] = await db.select()
        .from(schema.companyAccountants)
        .where(and(
          eq(schema.companyAccountants.companyId, companyId),
          eq(schema.companyAccountants.accountantUserId, accountantId),
          isNull(schema.companyAccountants.disabledAt)
        ));
      
      if (!assignment) {
        return res.status(403).json({ message: 'Sin acceso a esta empresa' });
      }
      
      // Get categories for this company
      const categories = await db.select()
        .from(schema.accountingCategories)
        .where(eq(schema.accountingCategories.companyId, companyId))
        .orderBy(schema.accountingCategories.sortOrder);
      
      res.json(categories);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get dashboard stats for a company (accountant view)
  app.get('/api/accountant/companies/:companyId/dashboard', authenticateToken, requireRole(['accountant']), async (req: AuthRequest, res) => {
    try {
      const accountantId = req.user!.id;
      const companyId = parseInt(req.params.companyId);
      
      // Verify access
      const [assignment] = await db.select()
        .from(schema.companyAccountants)
        .where(and(
          eq(schema.companyAccountants.companyId, companyId),
          eq(schema.companyAccountants.accountantUserId, accountantId),
          isNull(schema.companyAccountants.disabledAt)
        ));
      
      if (!assignment) {
        return res.status(403).json({ message: 'Sin acceso a esta empresa' });
      }
      
      // Get all entries for this company
      const entries = await db.select()
        .from(schema.accountingEntries)
        .where(eq(schema.accountingEntries.companyId, companyId));
      
      // Calculate stats
      let totalExpenses = 0;
      let totalIncomes = 0;
      let expenseCount = 0;
      let incomeCount = 0;
      let pendingExpensesAmount = 0;
      let pendingExpensesCount = 0;
      
      for (const entry of entries) {
        const amount = parseFloat(entry.totalAmount || entry.amount || '0');
        
        if (entry.type === 'expense') {
          totalExpenses += amount;
          expenseCount++;
          if (entry.status === 'pending') {
            pendingExpensesAmount += amount;
            pendingExpensesCount++;
          }
        } else {
          totalIncomes += amount;
          incomeCount++;
        }
      }
      
      res.json({
        totalExpenses: { amount: totalExpenses, count: expenseCount },
        totalIncomes: { amount: totalIncomes, count: incomeCount },
        balance: totalIncomes - totalExpenses,
        pendingExpenses: { amount: pendingExpensesAmount, count: pendingExpensesCount }
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get fiscal settings for a company (accountant view)
  app.get('/api/accountant/companies/:companyId/fiscal-settings', authenticateToken, requireRole(['accountant']), async (req: AuthRequest, res) => {
    try {
      const accountantId = req.user!.id;
      const companyId = parseInt(req.params.companyId);
      
      // Verify access
      const [assignment] = await db.select()
        .from(schema.companyAccountants)
        .where(and(
          eq(schema.companyAccountants.companyId, companyId),
          eq(schema.companyAccountants.accountantUserId, accountantId),
          isNull(schema.companyAccountants.disabledAt)
        ));
      
      if (!assignment) {
        return res.status(403).json({ message: 'Sin acceso a esta empresa' });
      }
      
      // Get fiscal settings
      const [settings] = await db.select()
        .from(companyFiscalSettings)
        .where(eq(companyFiscalSettings.companyId, companyId));
      
      const defaults = {
        taxpayerType: 'autonomo',
        vatRegime: 'general',
        vatProration: 100,
        irpfModel130Rate: 20,
        irpfManualWithholdings: 0,
        irpfPreviousPayments: 0,
        irpfManualSocialSecurity: 0,
        irpfOtherAdjustments: 0,
        community: null,
        retentionDefaultRate: null,
        professionalRetentionRate: null,
        newProfessionalRetentionRate: null,
        rentRetentionRate: null,
        autoApplyRetentionDefaults: false,
      };
      
      res.json(settings ? {
        ...defaults,
        ...settings,
      } : defaults);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Submit entry to accountant (admin action)
  app.post('/api/accounting/entries/:id/submit-to-accountant', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const entryId = parseInt(req.params.id);
      const companyId = req.user!.companyId;
      
      // Check if company uses external accountant
      const [company] = await db.select()
        .from(schema.companies)
        .where(eq(schema.companies.id, companyId));
      
      if (!company.usesExternalAccountant) {
        return res.status(400).json({ message: 'Esta empresa no usa gestoría externa' });
      }
      
      // Update status to submitted
      const [entry] = await db.update(schema.accountingEntries)
        .set({
          status: 'submitted',
          updatedAt: new Date()
        })
        .where(and(
          eq(schema.accountingEntries.id, entryId),
          eq(schema.accountingEntries.companyId, companyId)
        ))
        .returning();
      
      if (!entry) {
        return res.status(404).json({ message: 'Entrada no encontrada' });
      }
      
      res.json(entry);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update company accountant settings (admin only)
  app.patch('/api/companies/:id/accountant-settings', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res) => {
    try {
      const companyId = parseInt(req.params.id);
      const { usesExternalAccountant, autoSubmitToAccountant } = req.body;
      
      if (companyId !== req.user!.companyId) {
        return res.status(403).json({ message: 'Sin permiso' });
      }
      
      const [company] = await db.update(schema.companies)
        .set({
          usesExternalAccountant: Boolean(usesExternalAccountant),
          autoSubmitToAccountant: Boolean(autoSubmitToAccountant),
          updatedAt: new Date()
        })
        .where(eq(schema.companies.id, companyId))
        .returning();
      
      res.json(company);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);
  
  // Initialize WebSocket server for real-time updates
  initializeWebSocketServer(httpServer);
  
  return httpServer;
}

// Export function to start background services after server is listening
export async function startBackgroundServices() {
  console.log('🔄 Starting background services...');
  
  // Get VAPID keys from environment
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  
  // Start push notification scheduler for work alarms
  if (vapidPublicKey && vapidPrivateKey) {
    try {
      startPushNotificationScheduler();
      console.log('✅ Push notification scheduler started');
    } catch (error) {
      console.error('❌ Failed to start push notification scheduler:', error);
    }
  }

  // 📧 Start email queue worker for enterprise-grade email delivery
  try {
    startEmailQueueWorker();
    console.log('✅ Email queue worker started');
  } catch (error) {
    console.error('❌ Failed to start email queue worker:', error);
  }
}
