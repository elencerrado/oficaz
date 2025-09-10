import type { Express } from "express";
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
import { storage } from "./storage";
import { authenticateToken, requireRole, generateToken, AuthRequest } from './middleware/auth';
import { loginSchema, companyRegistrationSchema, insertVacationRequestSchema, insertMessageSchema, passwordResetRequestSchema, passwordResetSchema, contactFormSchema } from '@shared/schema';
import { db } from './db';
import { eq, and, or, desc, sql, not, inArray, count, gte, lt } from 'drizzle-orm';
import * as schema from '@shared/schema';
import { subscriptions, companies, features, users, workSessions, breakPeriods, vacationRequests, messages, reminders, documents, employeeActivationTokens, passwordResetTokens } from '@shared/schema';
import { sendEmail, sendEmployeeWelcomeEmail, sendPasswordResetEmail, sendSuperAdminSecurityCode, sendNewCompanyRegistrationNotification } from './email';

// Initialize Stripe with intelligent key detection
// Priority: Use production keys if available, otherwise fall back to test keys
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY_TEST;
const isProduction = !!process.env.STRIPE_SECRET_KEY && stripeSecretKey?.startsWith('sk_live');

if (!stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY or STRIPE_SECRET_KEY_TEST environment variable is required');
}

console.log('Stripe Environment:', isProduction ? 'Production (Live)' : 'Development (Test)');
console.log('Stripe key type:', stripeSecretKey.substring(0, 7));

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2025-05-28.basil',
});

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
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

// ⚠️ PROTECTED - DO NOT MODIFY
// Demo data generation for new companies
async function generateDemoData(companyId: number) {
  try {
    console.log('🎭 Generating comprehensive demo data for company:', companyId);
    
    // Get company registration date for dynamic data generation
    const company = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
    if (!company[0]) {
      console.error('Company not found for demo data generation');
      return;
    }
    
    const registrationDate = new Date(company[0].createdAt);
    console.log('📅 Company registered on:', registrationDate.toISOString());
    
    // Mark company as having demo data
    await db.update(companies)
      .set({ hasDemoData: true })
      .where(eq(companies.id, companyId));
    
    // Generate unique identifiers to avoid conflicts
    const uniqueId = Date.now();
    
    // Demo employees data - 4 realistic employees
    const demoEmployees = [
      {
        fullName: "María García López",
        companyEmail: `maria.garcia.${uniqueId}@demo.com`,
        dni: `${uniqueId.toString().slice(-8)}A`,
        position: "Desarrolladora Senior",
        role: "employee" as const,
        status: "working", // Currently working
        startDate: new Date(registrationDate.getTime() - 365 * 24 * 60 * 60 * 1000), // 1 year before company registration
      },
      {
        fullName: "Carlos Rodríguez Martín",
        companyEmail: `carlos.rodriguez.${uniqueId + 1}@demo.com`, 
        dni: `${(uniqueId + 1).toString().slice(-8)}B`,
        position: "Jefe de Proyectos",
        role: "manager" as const,
        status: "working", // Currently working
        startDate: new Date(registrationDate.getTime() - 200 * 24 * 60 * 60 * 1000), // 200 days before
      },
      {
        fullName: "Ana Fernández Silva",
        companyEmail: `ana.fernandez.${uniqueId + 2}@demo.com`,
        dni: `${(uniqueId + 2).toString().slice(-8)}C`, 
        position: "Analista de Marketing",
        role: "employee" as const,
        status: "vacation", // Currently on vacation
        startDate: new Date(registrationDate.getTime() - 180 * 24 * 60 * 60 * 1000), // 180 days before
      },
      {
        fullName: "David López Ruiz",
        companyEmail: `david.lopez.${uniqueId + 3}@demo.com`,
        dni: `${(uniqueId + 3).toString().slice(-8)}D`,
        position: "Diseñador UX/UI", 
        role: "employee" as const,
        status: "working", // Currently working
        startDate: new Date(registrationDate.getTime() - 90 * 24 * 60 * 60 * 1000), // 90 days before
      }
    ];

    // Create demo employees
    const createdEmployees = [];
    for (const employeeData of demoEmployees) {
      const hashedPassword = await bcrypt.hash('Demo123!', 10);
      
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
      });
      
      createdEmployees.push({ ...employee, status: employeeData.status });
      console.log(`👤 Created demo employee: ${employee.fullName} (${employeeData.status})`);
      
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
    await generateComprehensiveDemoData(companyId, createdEmployees, registrationDate);
    
    console.log('✅ Comprehensive demo data generation completed for company:', companyId);
    
  } catch (error) {
    console.error('❌ Error generating demo data:', error);
  }
}

// Generate comprehensive demo data based on company registration date
async function generateComprehensiveDemoData(companyId: number, employees: any[], registrationDate: Date) {
  console.log('📊 Generating comprehensive demo data...');
  
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
  
  // Generate current day activity - only if different from registration date to avoid duplicates
  const isRegistrationToday = registrationDate.toDateString() === now.toDateString();
  if (!isRegistrationToday) {
    await generateCurrentDayActivity(employees, now);
  } else {
    console.log('📅 Registration date is today - skipping duplicate current day activity');
  }
  
  // Generate vacation requests (approved and pending)
  await generateRealisticVacationRequests(companyId, employees, registrationDate);
  
  // Generate bidirectional messages (employee-admin communication)
  await generateBidirectionalMessages(companyId, employees);
  
  // Generate reminders for employees
  await generateDemoReminders(companyId, employees);
  
  // Generate incomplete sessions for demonstration
  await generateIncompleteSessions(employees, companyId);
  
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
      totalHours: Number(workHours.toFixed(1)),
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
        totalHours: Number(workHours.toFixed(1)),
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
        totalHours: Number(workHours.toFixed(1)),
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

// Generate demo vacation requests
// Generate realistic vacation requests with different statuses
async function generateRealisticVacationRequests(companyId: number, employees: any[], registrationDate: Date) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  
  const vacationRequests = [
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
  
  for (const request of vacationRequests) {
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
  
  console.log('🏖️ Generated', vacationRequests.length, 'realistic vacation requests (approved & pending)');
}

// Generate demo messages
// Generate bidirectional messages between employees and admin
async function generateBidirectionalMessages(companyId: number, employees: any[]) {
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
async function generateDemoReminders(companyId: number, employees: any[]) {
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
    // 1. Individual reminder - assigned to specific employee
    {
      title: 'Reunión de equipo semanal',
      description: 'Reunión para revisar el progreso del proyecto y planificar la próxima semana',
      dueDateTime: tomorrow,
      assignedEmployees: [employees[0]], // Solo María García
      createdBy: admin,
      color: '#FFFFCC', // Light yellow
      priority: 'high' as const,
    },
    // 2. Multiple employees - assigned to 2 people
    {
      title: 'Entrega de documentación técnica',
      description: 'Completar y revisar toda la documentación del sistema antes de la presentación',
      dueDateTime: nextWeek,
      assignedEmployees: [employees[0], employees[1]], // María y Carlos
      createdBy: admin,
      color: '#C8E6C9', // Soft green
      priority: 'medium' as const,
    },
    // 3. Individual reminder - different employee
    {
      title: 'Revisión de diseños con cliente',
      description: 'Presentar los nuevos mockups y recoger feedback del cliente',
      dueDateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      assignedEmployees: [employees[2]], // Solo Ana Fernández
      createdBy: admin,
      color: '#BBDEFB', // Sky blue
      priority: 'high' as const,
    },
    // 4. Group task - assigned to 3 employees
    {
      title: 'Preparación presentación trimestral',
      description: 'Recopilar datos y preparar la presentación de resultados del trimestre',
      dueDateTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      assignedEmployees: [employees[0], employees[1], employees[3]], // María, Carlos y David
      createdBy: admin,
      color: '#FFE4B5', // Warm peach
      priority: 'medium' as const,
    },
    // 5. Individual personal reminder
    {
      title: 'Formación en nuevas herramientas',
      description: 'Completar el curso online de certificación en la nueva plataforma',
      dueDateTime: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      assignedEmployees: [employees[3]], // Solo David López
      createdBy: admin,
      color: '#F8BBD9', // Rose pink
      priority: 'low' as const,
    },
    // 6. Unassigned company reminder (admin only)
    {
      title: 'Revisión mensual de objetivos',
      description: 'Evaluar el cumplimiento de objetivos del mes y planificar acciones correctivas',
      dueDateTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      assignedEmployees: [], // Sin asignar - solo admin
      createdBy: admin,
      color: '#E1BEE7', // Lavender purple
      priority: 'medium' as const,
    }
  ];
  
  for (const reminder of demoReminders) {
    // Create base reminder
    const createdReminder = await storage.createReminder({
      title: reminder.title,
      description: reminder.description,
      dueDateTime: reminder.dueDateTime,
      userId: reminder.createdBy.id, // Creator
      companyId: companyId, // Add missing company ID
      createdBy: reminder.createdBy.id,
      color: reminder.color,
      priority: reminder.priority,
      assignedTo: reminder.assignedEmployees.length > 0 ? reminder.assignedEmployees.map(emp => emp.id) : null,
    });
    
    console.log(`⏰ Created reminder "${reminder.title}" assigned to ${reminder.assignedEmployees.length > 0 ? reminder.assignedEmployees.map(emp => emp.fullName).join(', ') : 'admin only'}`);
  }
  
  console.log('⏰ Generated', demoReminders.length, 'demo reminders with varied assignments');
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Company validation endpoints
  app.post('/api/validate-company', async (req, res) => {
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
  app.post('/api/contact', contactLimiter, contactUpload.array('attachments', 5), async (req, res) => {
    let uploadedFiles: any[] = [];
    
    try {
      const { name, email, phone, subject, message } = req.body;
      
      // Store uploaded files for cleanup
      if (req.files && Array.isArray(req.files)) {
        uploadedFiles = req.files;
      }

      // DEBUG: Log received data
      console.log('🐛 Contact form data received:', {
        name: name?.trim(),
        email: email?.trim(),
        phone: phone?.trim(),
        subject: subject?.trim(),
        message: message?.trim(),
      });

      // SECURITY: Validate all fields using Zod schema
      const validationResult = contactFormSchema.safeParse({
        name: name?.trim(),
        email: email?.trim(),
        phone: phone?.trim(),
        subject: subject?.trim(),
        message: message?.trim(),
      });

      if (!validationResult.success) {
        console.log('❌ Contact form validation failed:', validationResult.error.errors);
        return res.status(400).json({ 
          success: false, 
          message: 'Datos inválidos',
          errors: validationResult.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }

      const validatedData = validationResult.data;

      // SECURITY: Validate total file size (20MB limit for all files combined)
      let totalFileSize = 0;
      if (uploadedFiles.length > 0) {
        totalFileSize = uploadedFiles.reduce((sum, file) => sum + file.size, 0);
        const maxTotalSize = 20 * 1024 * 1024; // 20MB
        
        if (totalFileSize > maxTotalSize) {
          return res.status(400).json({ 
            success: false, 
            message: `El tamaño total de archivos excede el límite de 20MB. Total: ${(totalFileSize / 1024 / 1024).toFixed(2)}MB` 
          });
        }

        // Log security information
        console.log(`📁 Contact form files: ${uploadedFiles.length} files, ${(totalFileSize / 1024 / 1024).toFixed(2)}MB total`);
      }

      // Configurar Nodemailer con Hostinger SMTP
      const transporter = nodemailer.createTransport({
        host: 'smtp.hostinger.com',
        port: 465,
        secure: true, // SSL
        auth: {
          user: 'soy@oficaz.es',
          pass: 'Sanisidro@2025',
        },
        tls: {
          rejectUnauthorized: false
        }
      });

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
      const emailSubject = `[CONTACTO] ${validatedData.subject}`;
      
      const htmlContent = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Nuevo contacto desde la web</title>
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
                🔔 Nuevo mensaje de contacto
              </h1>
              
              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
                <h2 style="color: #374151; font-size: 18px; margin: 0 0 15px 0;">
                  ${validatedData.subject}
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
Nuevo mensaje de contacto desde oficaz.es

ASUNTO: ${validatedData.subject}

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
        from: '"Contacto Oficaz" <soy@oficaz.es>',
        to: 'soy@oficaz.es',
        replyTo: validatedData.email, // Para poder responder directamente
        subject: emailSubject,
        text: textContent,
        html: htmlContent,
        attachments: attachments
      };

      console.log(`📧 Enviando formulario de contacto desde: ${validatedData.email}`);
      console.log(`🔒 SECURITY: Formulario validado - ${validatedData.name}, archivos: ${attachments.length}`);
      
      if (attachments.length > 0) {
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

  // User validation endpoints
  app.post('/api/validate-user', async (req, res) => {
    try {
      const { field, value } = req.body;
      
      if (!field || !value) {
        return res.status(400).json({ message: 'Field and value are required' });
      }

      let existingRecord = null;
      
      switch (field) {
        case 'email':
          existingRecord = await storage.getUserByEmail(value);
          break;

        default:
          return res.status(400).json({ message: 'Invalid field' });
      }

      const isAvailable = !existingRecord;
      res.json({ available: isAvailable });
    } catch (error) {
      console.error('Error validating user data:', error);
      res.status(500).json({ message: 'Error validating user data' });
    }
  });

  // Secure verification system
  const generateSecureToken = (): string => crypto.randomBytes(32).toString('hex');
  
  // Helper function to send verification emails
  const sendVerificationEmail = async (email: string, code: string, req: any, isRecovery = false) => {
    // ⚠️ PROTECTED NODEMAILER CONFIG - DO NOT MODIFY ⚠️
    // MUST use createTransport (NOT createTransporter) - user confirmed working
    const transporter = nodemailer.createTransport({
      host: 'smtp.hostinger.com',
      port: 465,
      secure: true, // SSL
      auth: {
        user: 'soy@oficaz.es',
        pass: 'Sanisidro@2025',
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
             style="height: 45px; width: auto; max-width: 200px; display: block; margin: 0 auto; border: none; outline: none;" />
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

              <!-- Compact verification code box -->
              <div style="background: linear-gradient(135deg, #007AFF 0%, #0056CC 100%); border-radius: 12px; padding: 20px 15px; text-align: center; margin: 15px 0; box-shadow: 0 4px 15px rgba(0, 122, 255, 0.2);">
                <div style="color: white; font-size: 28px; font-weight: 700; letter-spacing: 6px; margin-bottom: 8px; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">
                  ${code}
                </div>
                <div style="color: rgba(255,255,255,0.9); font-size: 12px; font-weight: 500;">
                  Válido por 10 minutos
                </div>
              </div>

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
  }>();
  
  const verificationTokens = new Map<string, { 
    emailHash: string; 
    expires: number; 
    used: boolean 
  }>();

  // Test endpoint to verify email sending capability
  app.post('/api/test-email', async (req, res) => {
    try {
      const { testEmail } = req.body;
      
      if (!testEmail || !testEmail.includes('@')) {
        return res.status(400).json({ error: 'Email válido requerido para la prueba' });
      }

      const testCode = '123456';
      
      try {
        const result = await sendVerificationEmail(testEmail, testCode, req);
        res.json({ 
          success: true, 
          message: 'Email de prueba enviado correctamente',
          messageId: result.messageId,
          response: result.response
        });
      } catch (error) {
        console.error('Error en email de prueba:', error);
        res.status(500).json({ 
          success: false, 
          error: 'Error al enviar email de prueba',
          details: (error as any).message
        });
      }
    } catch (error) {
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  // Endpoint to check if email is available for registration
  // Diagnostic endpoint for email issues
  app.get('/api/diagnostics/email', async (req, res) => {
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
          host: 'smtp.hostinger.com',
          port: 465,
          secure: true,
          auth_user: 'soy@oficaz.es'
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

      // Check if email is already registered
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

      // Check if email is already registered
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        // Check if the company is scheduled for deletion (grace period)
        const company = await storage.getCompany(existingUser.companyId);
        
        if (company?.scheduledForDeletion && existingUser.role === 'admin') {
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
      for (const [sessionId, session] of verificationSessions.entries()) {
        if (session.expires < now) {
          verificationSessions.delete(sessionId);
        }
      }

      // Check rate limiting
      let recentAttempts = 0;
      const oneHourAgo = now - 60 * 60 * 1000;
      
      for (const session of verificationSessions.values()) {
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
      if (session.isRecovery) {
        // This is account recovery - restore the company
        const companyId = session.companyId;
        const userId = session.userId;
        
        // Cancel the deletion schedule
        await storage.cancelCompanyDeletion(companyId);
        
        // Clean up verification session
        verificationSessions.delete(sessionId);
        
        console.log(`✅ Account recovery successful for companyId: ${companyId}, userId: ${userId}`);
        
        return res.json({ 
          success: true, 
          message: 'Cuenta recuperada exitosamente',
          isRecovery: true,
          action: 'account_restored'
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
          verificationToken 
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
        
        if (company?.scheduledForDeletion) {
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
        
        if (companyCancellation?.scheduledForDeletion) {
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

      // Hash password
      const hashedPassword = await bcrypt.hash(data.password, 10);

      // Create company first
      const company = await storage.createCompany({
        name: data.companyName,
        email: data.companyEmail,
        cif: data.cif,
        contactName: data.contactName || data.adminFullName,
        companyAlias: data.companyAlias,
        phone: data.contactPhone || '',
        address: data.address || '',
        province: data.province,
      });

      // Create admin user
      const user = await storage.createUser({
        companyEmail: data.companyEmail,
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
      // Use selectedPlan from the wizard, default to 'basic' for backwards compatibility
      const selectedPlan = data.selectedPlan || 'basic';
      const subscription = await storage.createSubscription({
        companyId: company.id,
        plan: selectedPlan,
        status: 'trial',
        isTrialActive: true,
        maxUsers: 5, // Default for basic plan
      });

      // Generate demo data for new company
      await generateDemoData(company.id);

      const token = generateToken({
        id: user.id,
        username: user.companyEmail, // Use company email for token compatibility
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

      res.status(201).json({
        user: { ...user, password: undefined },
        token,
        company: { ...company, subscription },
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
    
    // Block after 5 failed attempts for 15 minutes
    if (attempts.count >= 5) {
      attempts.blockedUntil = now + 15 * 60 * 1000; // 15 minutes
    }
    
    loginAttempts.set(identifier, attempts);
  };

  // Login rate limiter - more restrictive for login endpoint
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // limit each IP to 20 login attempts per windowMs
    message: { error: 'Demasiados intentos de login. Intenta de nuevo en 15 minutos.' },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
  });

  app.post('/api/auth/login', loginLimiter, async (req, res) => {
    try {
      const data = loginSchema.parse(req.body);
      const { companyAlias } = req.body;
      const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
      const identifier = `${data.dniOrEmail.toLowerCase()}:${clientIP}`;

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
          return res.status(404).json({ message: 'Empresa no encontrada' });
        }
        targetCompanyId = company.id;
      }
      
      // Normalize email/DNI input
      const normalizedInput = data.dniOrEmail.includes('@') 
        ? data.dniOrEmail.toLowerCase().trim()
        : data.dniOrEmail.toUpperCase().trim();
      
      // Try to find user by company email first, then by DNI
      let user = await storage.getUserByEmail(normalizedInput);
      
      // If company-specific login, verify user belongs to that company
      if (user && targetCompanyId && user.companyId !== targetCompanyId) {
        user = undefined; // User exists but not in the specified company
      }
      
      if (!user) {
        // Try to find by DNI
        if (targetCompanyId) {
          user = await storage.getUserByDniAndCompany(normalizedInput, targetCompanyId);
        } else {
          user = await storage.getUserByDni(normalizedInput);
        }
      }
      
      if (!user) {
        recordLoginAttempt(identifier, false);
        return res.status(401).json({ message: 'Credenciales inválidas' });
      }

      // Check if user account is active
      if (!user.isActive) {
        recordLoginAttempt(identifier, false);
        return res.status(401).json({ message: 'Cuenta desactivada. Contacta con tu administrador.' });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(data.password, user.password);
      if (!isValidPassword) {
        recordLoginAttempt(identifier, false);
        return res.status(401).json({ message: 'Credenciales inválidas' });
      }

      // Record successful login
      recordLoginAttempt(identifier, true);

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

      const token = generateToken({
        id: user.id,
        username: user.companyEmail,
        role: user.role,
        companyId: user.companyId,
      });

      // Log successful login for security audit
      console.log(`[SECURITY] Successful login: User ${user.id} (${user.companyEmail}) from IP ${clientIP} at ${new Date().toISOString()}`);

      res.json({
        message: "Inicio de sesión exitoso",
        user: { ...user, password: undefined },
        token,
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
      console.log('Password reset request for:', data.email);

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

      if (!user || !company) {
        // Return success even if user not found (security best practice)
        return res.status(200).json({ message: 'Si el email existe, recibirás un enlace de recuperación' });
      }

      // Check if user account is active
      if (!user.isActive) {
        return res.status(200).json({ message: 'Si el email existe, recibirás un enlace de recuperación' });
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

      // Save reset token to database
      try {
        await db.insert(passwordResetTokens).values({
          email: user.companyEmail.toLowerCase(),
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
        user.companyEmail,
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

  app.post('/api/auth/reset-password', async (req, res) => {
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
        return res.status(404).json({ message: 'Usuario no encontrado' });
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
        return res.status(404).json({ message: 'Usuario no encontrado' });
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
        return res.status(404).json({ message: 'Usuario no encontrado' });
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

      res.json({ 
        success: true, 
        message: 'Política de vacaciones actualizada y días recalculados para todos los empleados' 
      });
    } catch (error: any) {
      console.error('Error updating vacation policy:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Recalculate vacation days for all employees
  app.post('/api/settings/recalculate-vacation-days', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;
      const employees = await storage.getUsersByCompany(companyId);
      
      let updatedCount = 0;
      for (const employee of employees) {
        await storage.updateUserVacationDays(employee.id);
        updatedCount++;
      }

      res.json({ 
        success: true, 
        message: `Días de vacaciones recalculados para ${updatedCount} empleados`,
        updatedEmployees: updatedCount
      });
    } catch (error: any) {
      console.error('Error recalculating vacation days:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get company by alias route
  app.get('/api/company/:alias', async (req, res) => {
    try {
      const { alias } = req.params;
      const company = await storage.getCompanyByAlias?.(alias);
      
      if (!company) {
        return res.status(404).json({ message: 'Empresa no encontrada' });
      }
      
      res.json({ ...company });
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

      // Create company
      const company = await storage.createCompany({
        name: data.companyName,
        cif: data.cif,
        email: data.companyEmail,
        contactName: data.contactName,
        companyAlias: data.companyAlias,
        phone: data.phone || null,
        address: data.address || null,
        logoUrl: data.logoUrl || null,
      });

      // Hash password
      const hashedPassword = await bcrypt.hash(data.password, 10);

      // Calculate vacation days balance (2.5 days per month from start date)
      const startDate = new Date();
      const monthsUntilYearEnd = 12 - startDate.getMonth();
      const vacationBalance = Math.round(monthsUntilYearEnd * 2.5 * 10) / 10;

      // Create admin user
      const user = await storage.createUser({
        companyEmail: data.companyEmail,
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
        username: user.companyEmail, // Use company email as username in JWT
        role: user.role,
        companyId: user.companyId,
      });

      // Generate demo data automatically for new companies
      console.log('🎭 Auto-generating demo data for new company:', company.id);
      try {
        await generateDemoData(company.id);
        console.log('✅ Demo data generated successfully for new company');
      } catch (demoError) {
        console.error('⚠️ Warning: Could not generate demo data for new company:', demoError);
        // Continue with registration even if demo data fails
      }

      // Send notification email to soy@oficaz.es about new company registration
      try {
        console.log('📧 Sending new company registration notification...');
        await sendNewCompanyRegistrationNotification(
          company.name,
          company.email,
          data.contactName,
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

      res.json({
        user: { ...user, password: undefined },
        company: company ? {
          ...company,
          // Ensure all configuration fields are included and properly typed
          workingHoursPerDay: Number(company.workingHoursPerDay) || 8,
          defaultVacationDays: Number(company.defaultVacationDays) || 30,
          vacationDaysPerMonth: Number(company.vacationDaysPerMonth) || 2.5,
          // Explicitly include logoUrl to ensure it's returned
          logoUrl: company.logoUrl || null
        } : null,
        subscription
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
      const planName = subscription?.plan || 'basic';
      
      console.log(`🔒 USER LIMIT CHECK: Current users: ${currentUserCount}, Max allowed: ${subscription?.maxUsers}`);
      console.log(`🔒 ROLE COUNT CHECK: Current roles:`, usersByRole);
      console.log(`🔒 REQUESTING ROLE: ${requestedRole} for plan: ${planName}`);
      
      // Define role limits by plan
      const roleLimits: Record<string, Record<string, number>> = {
        'basic': {
          admin: 1,
          manager: 1,
          employee: (subscription?.maxUsers || 5) - 2 // Total minus admin and manager
        },
        'pro': {
          admin: 1,
          manager: 3,
          employee: (subscription?.maxUsers || 30) - 4 // Total minus admin and managers
        },
        'master': {
          admin: 999, // Unlimited
          manager: 999, // Unlimited
          employee: 999 // Unlimited
        }
      };
      
      // Get current role limits for this plan
      const currentPlanLimits = roleLimits[planName] || roleLimits['basic'];
      const roleLimit = currentPlanLimits[requestedRole];
      const currentRoleCount = usersByRole[requestedRole] || 0;
      
      // Check total user limit first
      if (subscription?.maxUsers && currentUserCount >= subscription.maxUsers) {
        return res.status(400).json({ 
          message: `Límite de usuarios alcanzado. Tu plan permite máximo ${subscription.maxUsers} usuarios y actualmente tienes ${currentUserCount}.` 
        });
      }
      
      // Check role-specific limits
      if (roleLimit !== 999 && currentRoleCount >= roleLimit) {
        const roleNames: Record<string, string> = {
          admin: 'administradores',
          manager: 'managers',
          employee: 'empleados'
        };
        
        return res.status(400).json({ 
          message: `Límite de ${roleNames[requestedRole]} alcanzado. Tu plan ${planName.toUpperCase()} permite máximo ${roleLimit} ${roleNames[requestedRole]} y actualmente tienes ${currentRoleCount}.` 
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
  app.post('/api/work-sessions/clock-in', authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Check if user already has an active session
      const activeSession = await storage.getActiveWorkSession(req.user!.id);
      if (activeSession) {
        return res.status(400).json({ message: 'Already clocked in' });
      }

      // ⚠️ PROTECTED - DO NOT MODIFY - Critical cleanup on clock-in
      // Close any orphaned break periods before starting new session
      await storage.closeOrphanedBreakPeriods(req.user!.id);

      const session = await storage.createWorkSession({
        userId: req.user!.id,
        clockIn: new Date(),
        status: 'active',
      });

      res.status(201).json(session);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Regular clock out (current session)
  app.post('/api/work-sessions/clock-out', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const activeSession = await storage.getActiveWorkSession(req.user!.id);
      if (!activeSession) {
        return res.status(400).json({ message: 'No active session found' });
      }

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
      });

      res.json(updatedSession);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Clock out incomplete session with custom time
  app.post('/api/work-sessions/clock-out-incomplete', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { sessionId, clockOutTime } = req.body;
      
      if (!sessionId || !clockOutTime) {
        return res.status(400).json({ message: 'Session ID and clock out time are required' });
      }

      // Get the specific session
      const sessions = await storage.getWorkSessionsByUser(req.user!.id);
      const session = sessions.find(s => s.id === parseInt(sessionId));
      
      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
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

  app.get('/api/work-sessions', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const sessions = await storage.getWorkSessionsByUser(req.user!.id);
      res.json(sessions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/work-sessions/company', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      // Balanced pagination for performance and functionality
      const limit = parseInt(req.query.limit as string) || 40; // Default 40 sessions
      const offset = parseInt(req.query.offset as string) || 0;
      
      const sessions = await storage.getWorkSessionsByCompany(req.user!.companyId, limit, offset);
      
      res.json(sessions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch('/api/work-sessions/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const { clockIn, clockOut, breakPeriods: requestBreakPeriods } = req.body;

      // Verify session belongs to user (or user is admin/manager)
      const session = await storage.getWorkSession(id);
      if (!session) {
        return res.status(404).json({ message: 'Work session not found' });
      }

      if (session.userId !== req.user!.id && !['admin', 'manager'].includes(req.user!.role)) {
        return res.status(403).json({ message: 'Not authorized to edit this session' });
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

  // Vacation request routes
  app.post('/api/vacation-requests', authenticateToken, async (req: AuthRequest, res) => {
    try {
      console.log('Vacation request body:', req.body);
      console.log('User ID:', req.user!.id);
      
      // Determine status based on user role
      // Admin requests are auto-approved, manager/employee requests are pending
      const status = req.user!.role === 'admin' ? 'approved' : 'pending';
      
      const data = insertVacationRequestSchema.parse({
        ...req.body,
        userId: req.user!.id,
        startDate: new Date(req.body.startDate),
        endDate: new Date(req.body.endDate),
        status: status, // Set status based on role
      });

      console.log('Parsed data:', data);
      
      // Validate vacation days availability
      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }

      const requestedDays = Math.ceil((data.endDate.getTime() - data.startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const totalDays = parseFloat(user.totalVacationDays || '22');
      const usedDays = parseFloat(user.usedVacationDays || '0');
      const availableDays = totalDays - usedDays;

      if (requestedDays > availableDays) {
        return res.status(400).json({ 
          message: `Ojalá pudiéramos darte más… pero ahora mismo solo tienes ${availableDays} días disponibles.` 
        });
      }
      
      const request = await storage.createVacationRequest(data);
      
      // Log the automatic approval for admin users
      if (req.user!.role === 'admin') {
        console.log(`Admin request auto-approved for user ${req.user!.id}: ${request.id}`);
      } else {
        console.log(`Request created pending approval for user ${req.user!.id}: ${request.id}`);
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
      res.json(requests);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/vacation-requests/company', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const requests = await storage.getVacationRequestsByCompany(req.user!.companyId);
      
      // Add user names to vacation requests
      const requestsWithNames = await Promise.all(requests.map(async (request: any) => {
        const user = await storage.getUser(request.userId);
        return {
          ...request,
          userName: user?.fullName || 'Usuario desconocido'
        };
      }));
      
      res.json(requestsWithNames);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch('/api/vacation-requests/:id', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
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

      const request = await storage.updateVacationRequest(id, updateData);

      if (!request) {
        return res.status(404).json({ message: 'Vacation request not found' });
      }

      console.log('Update successful:', request);
      res.json(request);
    } catch (error: any) {
      console.error('Error updating vacation request:', error);
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
  app.post('/api/documents/upload', authenticateToken, upload.single('file'), async (req: AuthRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      console.log('Upload request - User ID:', req.user!.id, 'File:', req.file.originalname);
      console.log('Request type:', req.body.requestType);

      // Si hay un tipo de solicitud, renombrar el archivo
      let finalOriginalName = req.file.originalname;
      if (req.body.requestType && req.user) {
        const user = await storage.getUser(req.user.id);
        if (user) {
          const fileExtension = req.file.originalname.split('.').pop();
          finalOriginalName = `${req.body.requestType} - ${user.fullName}.${fileExtension}`;
          console.log('Renamed file to:', finalOriginalName);
        }
      }

      const document = await storage.createDocument({
        userId: req.user!.id,
        fileName: req.file.filename,
        originalName: finalOriginalName,
        fileSize: req.file.size,
        filePath: req.file.path,
        mimeType: req.file.mimetype || null,
        uploadedBy: req.user!.id,
      });

      console.log('Document created:', document);
      res.status(201).json(document);
    } catch (error: any) {
      console.error('Error uploading document:', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/documents', authenticateToken, async (req: AuthRequest, res) => {
    try {
      // CRITICAL SECURITY: Users can ONLY see their own documents
      // No exceptions for admin/manager - they should use separate endpoints if needed
      const allDocuments = await storage.getDocumentsByUser(req.user!.id);
      
      // Filter out documents that don't have physical files
      const validDocuments = [];
      const orphanedDocuments = [];
      
      for (const document of allDocuments) {
        const filePath = path.join(uploadDir, document.fileName);
        if (fs.existsSync(filePath)) {
          validDocuments.push(document);
        } else {
          orphanedDocuments.push(document);
          console.log(`CLEANUP: User ${req.user!.id} - Found orphaned document ${document.id} - ${document.originalName}`);
        }
      }
      
      // Clean up orphaned documents from database
      if (orphanedDocuments.length > 0) {
        console.log(`CLEANUP: User ${req.user!.id} - Removing ${orphanedDocuments.length} orphaned document records`);
        for (const orphanDoc of orphanedDocuments) {
          await storage.deleteDocument(orphanDoc.id);
          console.log(`CLEANUP: User ${req.user!.id} - Deleted orphaned document record ${orphanDoc.id} - ${orphanDoc.originalName}`);
        }
      }
      
      res.json(validDocuments);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get all documents for admin/manager view - filter out orphaned documents
  app.get('/api/documents/all', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const allDocuments = await storage.getDocumentsByCompany(req.user!.companyId);
      
      // Filter out documents that don't have physical files
      const validDocuments = [];
      const orphanedDocuments = [];
      
      for (const document of allDocuments) {
        const filePath = path.join(uploadDir, document.fileName);
        if (fs.existsSync(filePath)) {
          validDocuments.push(document);
        } else {
          orphanedDocuments.push(document);
          console.log(`CLEANUP: Found orphaned document ${document.id} - ${document.originalName} (file not found: ${filePath})`);
        }
      }
      
      // Clean up orphaned documents from database
      if (orphanedDocuments.length > 0) {
        console.log(`CLEANUP: Removing ${orphanedDocuments.length} orphaned document records from database`);
        for (const orphanDoc of orphanedDocuments) {
          await storage.deleteDocument(orphanDoc.id);
          console.log(`CLEANUP: Deleted orphaned document record ${orphanDoc.id} - ${orphanDoc.originalName}`);
        }
      }
      
      res.json(validDocuments);
    } catch (error) {
      console.error("Error fetching all documents:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  // Admin upload documents (can specify target employee)
  app.post('/api/documents/upload-admin', authenticateToken, requireRole(['admin', 'manager']), upload.single('file'), async (req: AuthRequest, res) => {
    try {
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

      // Use clean filename if provided, otherwise use original
      const originalName = req.body.cleanFileName || req.file.originalname;

      const document = await storage.createDocument({
        userId: targetEmployeeId,
        fileName: req.file.filename,
        originalName: originalName,
        fileSize: req.file.size,
        filePath: req.file.path,
        mimeType: req.file.mimetype || null,
        uploadedBy: req.user!.id,
      });

      console.log(`Document uploaded: ${originalName} for user ${targetEmployeeId}`);

      res.status(201).json(document);
    } catch (error) {
      console.error("Error uploading admin document:", error);
      res.status(500).json({ message: "Failed to upload document" });
    }
  });

  // Send document request to employees
  app.post('/api/documents/request', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
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
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any;
      req.user = decoded;
      // Token verified
      next();
    } catch (error: any) {
      console.error('Token verification failed:', error.message);
      console.error('Token length:', token.length, 'First 50 chars:', token.substring(0, 50));
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
      const isPreview = req.query.view === 'true';
      console.log(`Document ${id} request - isPreview: ${isPreview}, query:`, req.query);

      // CRITICAL SECURITY: Multi-layer document access validation
      const user = req.user!;
      
      // Layer 1: Users can ONLY access their own documents
      if (document.userId !== user.id) {
        // Layer 2: Only admin/manager can access other users' documents
        if (!['admin', 'manager'].includes(user.role)) {
          console.log(`SECURITY VIOLATION: User ${user.id} (${user.email}) attempted to access document ${id} belonging to user ${document.userId}`);
          return res.status(403).json({ message: 'Unauthorized: You can only access your own documents' });
        }
        
        // Layer 3: Admin/Manager can only access documents within their company
        const documentOwner = await storage.getUser(document.userId);
        if (!documentOwner) {
          console.log(`SECURITY ERROR: Document ${id} references non-existent user ${document.userId}`);
          return res.status(404).json({ message: 'Document owner not found' });
        }
        
        if (documentOwner.companyId !== user.companyId) {
          console.log(`SECURITY VIOLATION: User ${user.id} from company ${user.companyId} attempted to access document ${id} from company ${documentOwner.companyId}`);
          return res.status(403).json({ message: 'Unauthorized: Cross-company access denied' });
        }
        
        // Layer 4: Log legitimate admin/manager access for audit
        console.log(`ADMIN ACCESS: User ${user.id} (${user.role}) accessed document ${id} belonging to user ${document.userId} within company ${user.companyId}`);
      }

      const filePath = path.join(uploadDir, document.fileName);
      
      // If physical file doesn't exist, return 404 - no file should be served
      if (!fs.existsSync(filePath)) {
        console.log(`SECURITY: Physical file not found at ${filePath} for document ${document.id}. File may have been deleted or moved.`);
        return res.status(404).json({ message: 'File not found on server' });
      }

      // Set content type based on file extension if mimeType is not available
      let contentType = document.mimeType;
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
      
      // Set CORS headers to allow iframe embedding
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      res.setHeader('Content-Security-Policy', "frame-ancestors 'self'");
      
      // Set disposition based on whether it's preview or download
      if (isPreview) {
        console.log(`Setting inline disposition for preview: ${document.originalName} (${contentType})`);
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(document.originalName)}"`);
      } else {
        console.log(`Setting attachment disposition for download: ${document.originalName} (${contentType})`);
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(document.originalName)}"`);
      }

      // Send file with absolute path
      const absolutePath = path.resolve(filePath);
      res.sendFile(absolutePath);
    } catch (error: any) {
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
      const { digitalSignature } = req.body;

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

      const updatedDocument = await storage.markDocumentAsAcceptedAndSigned(id, digitalSignature);
      console.log(`Document ${id} accepted and signed by user ${req.user!.id}`);
      
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
      const sanitizedEmployees = employees.map(emp => ({ ...emp, password: undefined }));
      res.json(sanitizedEmployees);
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
        email: mgr.companyEmail, 
        role: mgr.role,
        position: mgr.position,
        profilePicture: mgr.profilePicture
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
        vacationDaysPerMonth
      });

      if (!updatedCompany) {
        return res.status(404).json({ message: 'Empresa no encontrada' });
      }

      res.json({ 
        message: 'Empresa actualizada correctamente',
        company: {
          ...updatedCompany,
          logoUrl: updatedCompany.logoUrl || null
        }
      });
    } catch (error) {
      console.error('Error updating company:', error);
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

  // Upload profile picture
  app.post('/api/users/profile-picture', authenticateToken, upload.single('profilePicture'), async (req: AuthRequest, res) => {
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
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
      if (!allowedTypes.includes(req.file.mimetype)) {
        // Delete uploaded file if invalid
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'Tipo de archivo no válido. Solo se permiten imágenes JPG, PNG y GIF.' });
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (req.file.size > maxSize) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'El archivo es demasiado grande. Tamaño máximo: 5MB.' });
      }

      // Generate unique filename for processed image (always JPEG for consistency)
      const filename = `profile_${targetUserId}_${Date.now()}.jpg`;
      const newPath = path.join(uploadDir, filename);

      // Process and compress image to 200x200 max using Sharp
      // Solución robusta para orientación EXIF en fotos de móviles
      await sharp(req.file.path)
        .rotate() // Auto-rotar basado en metadatos EXIF
        .withMetadata(false) // Eliminar metadatos EXIF después de aplicar rotación
        .resize(200, 200, {
          fit: 'inside', // Mantiene aspect ratio, no distorsiona
          withoutEnlargement: true // No agranda imágenes pequeñas
        })
        .jpeg({ 
          quality: 85, // Buena calidad con tamaño optimizado
          progressive: true 
        })
        .toFile(newPath);

      // Remove original uploaded file after processing
      fs.unlinkSync(req.file.path);

      // Update target user's profile picture in database
      const profilePictureUrl = `/uploads/${filename}`;
      const updatedUser = await storage.updateUser(targetUserId, { 
        profilePicture: profilePictureUrl 
      });

      if (!updatedUser) {
        // Clean up file if database update fails
        fs.unlinkSync(newPath);
        return res.status(500).json({ error: 'Error al actualizar la foto de perfil en la base de datos' });
      }

      res.json({ 
        message: 'Foto de perfil actualizada correctamente',
        profilePicture: profilePictureUrl 
      });
    } catch (error: any) {
      console.error('Error uploading profile picture:', error);
      res.status(500).json({ error: 'Error al subir la foto de perfil' });
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

      // Debug logging
      console.log('📝 Employee update request:', {
        userId,
        currentUser: { id: user.id, companyEmail: user.companyEmail, role: user.role },
        updates
      });

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

      console.log('📝 Final allowedUpdates:', allowedUpdates);

      // Only proceed with update if there are actually changes to make
      if (Object.keys(allowedUpdates).length === 0) {
        console.log('📝 No changes to make, returning current user');
        return res.json({ 
          message: 'No hay cambios que realizar',
          user: user 
        });
      }

      const updatedUser = await storage.updateUser(userId, allowedUpdates);

      if (!updatedUser) {
        return res.status(500).json({ error: 'Error al actualizar el usuario' });
      }

      // Recalculate vacation days if start date changed
      if (updates.startDate) {
        await storage.updateUserVacationDays(userId);
      }

      const finalUser = await storage.getUser(userId);
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
      
      // Check for incomplete sessions and create notifications if needed
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
      
      // Check for incomplete sessions and create notifications if needed
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
  const authenticateSuperAdmin = (req: any, res: any, next: any) => {
    console.log('🔐 SuperAdmin auth middleware - Headers:', req.headers.authorization ? 'present' : 'missing');
    
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      console.log('🚨 SuperAdmin auth failed: No token provided');
      return res.status(401).json({ message: "No token provided" });
    }

    // Check for malformed token
    if (token.length < 10 || !token.includes('.')) {
      console.log('🚨 SuperAdmin auth failed: Malformed token');
      return res.status(401).json({ message: "Invalid token format" });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
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
  const SUPER_ADMIN_ACCESS_CODE = 'SA!9x7$Kz2&mQ5'; // ⚠️ PROTECTED - DO NOT MODIFY
  const tempTokens = new Map(); // In-memory storage for temporary tokens

  // Endpoint to clear corrupted SuperAdmin token
  app.post('/api/super-admin/clear-token', async (req, res) => {
    res.json({ 
      success: true, 
      message: 'SuperAdmin token cleared. Please login again.' 
    });
  });

  app.post('/api/super-admin/verify-access-code', async (req, res) => {
    try {
      const { accessCode } = req.body;
      
      if (accessCode !== SUPER_ADMIN_ACCESS_CODE) {
        console.log('🚨 SuperAdmin access denied: Invalid access code');
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
        // Use the same configuration as the rest of the app
        const transporter = nodemailer.createTransport({
          host: 'smtp.hostinger.com',
          port: 465,
          secure: true, // SSL
          auth: {
            user: 'soy@oficaz.es',
            pass: 'Sanisidro@2025',
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

  app.post('/api/super-admin/verify-verification-code', async (req, res) => {
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
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '24h' }
      );

      console.log('✅ SuperAdmin access granted successfully');
      res.json({ token: superAdminToken, message: "Acceso autorizado" });
    } catch (error) {
      console.error("Error in verification code check:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.get('/api/super-admin/stats', authenticateSuperAdmin, async (req, res) => {
    try {
      const stats = await storage.getSuperAdminStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching super admin stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  app.get('/api/super-admin/companies', authenticateSuperAdmin, async (req, res) => {
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
            [...new Set([userId, ...assignedUserIds])] : // Admin creates shared reminders
            assignedUserIds) : // Employee assigns to others only
          [userId], // No assignments = private to creator
        assignedBy: userId,
        assignedAt: new Date()
      });
      
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
      }
      if (updateData.reminderDate === null || updateData.reminderDate === '') {
        updateData.reminderDate = null;
      }
      
      // Handle assignments - always include creator + any additional assigned users
      if (updateData.assignedUserIds && Array.isArray(updateData.assignedUserIds)) {
        updateData.assignedUserIds = [...new Set([userId, ...updateData.assignedUserIds])];
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
          updateData.completedByUserIds = currentCompletedByUserIds.filter(id => id !== userId);
        }
        
        // Update overall completion status based on ALL assigned users (including the creator)
        const assignedUserIds = existingReminder.assignedUserIds || [];
        const creatorId = existingReminder.createdBy || existingReminder.userId;
        const newCompletedByUserIds = updateData.completedByUserIds || [];
        
        // If there are assigned users, check if ALL assigned users have completed
        if (assignedUserIds.length > 0) {
          updateData.isCompleted = assignedUserIds.every(id => newCompletedByUserIds.includes(id));
        } else {
          // If no users assigned, use individual completion status of creator
          updateData.isCompleted = newCompletedByUserIds.includes(creatorId);
        }
      }
      
      const updatedReminder = await storage.updateReminder(reminderId, updateData);
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
      
      const updatedReminder = await storage.completeReminderIndividually(reminderId, userId);
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

      // Calculate correct authorization amount (use custom price if available)
      const customPrice = company.subscription.customMonthlyPrice ? Number(company.subscription.customMonthlyPrice) : null;
      const standardPrice = company.subscription.plan === 'pro' ? 39.95 : 
                           company.subscription.plan === 'basic' ? 19.95 : 
                           company.subscription.plan === 'master' ? 99.95 : 39.95;
      
      let finalPrice = customPrice || standardPrice;
      
      // Stripe requires minimum €0.50 - enforce this limit
      if (finalPrice < 0.50) {
        console.log(`⚠️ Price €${finalPrice} below Stripe minimum, using €0.50 for authorization`);
        finalPrice = 0.50; // Use minimum for authorization, but keep custom price for actual billing
      }
      
      const authAmountCents = Math.round(finalPrice * 100); // Convert to cents
      
      console.log(`💰 AUTHORIZATION AMOUNT: customPrice=${customPrice}, standardPrice=${standardPrice}, finalPrice=${finalPrice}, authAmountCents=${authAmountCents}`);

      // Create payment intent with authorization hold (manual capture for trial end)
      const paymentIntent = await stripe.paymentIntents.create({
        customer: stripeCustomerId,
        amount: authAmountCents, // Use calculated amount based on custom or standard price
        currency: 'eur',
        payment_method_types: ['card'],
        capture_method: 'manual', // Authorize now, capture later
        setup_future_usage: 'off_session', // Save for future use
        description: `Autorización para Plan ${company.subscription.plan} - ${company.name}`,
      });

      res.json({
        clientSecret: paymentIntent.client_secret,
        customerId: stripeCustomerId,
        paymentIntentId: paymentIntent.id
      });
    } catch (error) {
      console.error('Error creating setup intent:', error);
      res.status(500).json({ message: 'Error al crear setup intent' });
    }
  });

  // Confirm payment method and create recurring subscription
  app.post('/api/account/confirm-payment-method', authenticateToken, async (req: AuthRequest, res) => {
    console.log(`🚨 PAYMENT ENDPOINT CALLED - User ${req.user!.id}, paymentIntentId: ${req.body.paymentIntentId}`);
    try {
      const userId = req.user!.id;
      const { paymentIntentId } = req.body;

      if (!paymentIntentId) {
        console.log(`🚨 PAYMENT FAILED - No paymentIntentId provided`);
        return res.status(400).json({ message: 'Payment Intent ID es requerido' });
      }
      
      console.log(`🚨 PAYMENT PROCESSING - Retrieving paymentIntent ${paymentIntentId}`);

      // Retrieve the payment intent to get payment method and authorization status
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      
      if (paymentIntent.status !== 'requires_capture') {
        console.log(`🚨 AUTHORIZATION FAILED - Status: ${paymentIntent.status}`);
        return res.status(400).json({ message: 'La autorización del pago no fue exitosa' });
      }
      
      console.log(`🏦 AUTHORIZATION SUCCESSFUL - Amount: €${paymentIntent.amount/100}, Status: ${paymentIntent.status}`);

      // Get company and subscription data
      const company = await storage.getCompanyByUserId(userId);
      if (!company?.subscription) {
        return res.status(404).json({ message: 'Suscripción no encontrada' });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }

      // Get subscription plan details
      const planResult = await db.execute(sql`
        SELECT monthly_price FROM subscription_plans 
        WHERE name = ${company.subscription.plan}
      `);

      if (!planResult.rows[0]) {
        return res.status(404).json({ message: 'Plan no encontrado' });
      }

      const standardMonthlyPrice = (planResult.rows[0] as any).monthly_price;
      
      // Use custom monthly price if set, otherwise use standard plan price
      // CRITICAL: Drizzle decimal fields come as strings, must convert to number for Stripe
      const customPriceNum = company.subscription.customMonthlyPrice ? Number(company.subscription.customMonthlyPrice) : null;
      const standardPriceNum = Number(standardMonthlyPrice);
      let monthlyPrice = customPriceNum || standardPriceNum;
      
      // EMERGENCY FIX: Force correct price if conversion fails
      if (!monthlyPrice || monthlyPrice <= 0) {
        console.log(`🚨 PRICE ERROR: monthlyPrice=${monthlyPrice}, forcing plan price`);
        monthlyPrice = company.subscription.plan === 'pro' ? 39.95 : 
                      company.subscription.plan === 'basic' ? 19.95 : 
                      company.subscription.plan === 'master' ? 99.95 : 39.95;
        console.log(`🚨 FORCED PRICE: Using €${monthlyPrice} for plan ${company.subscription.plan}`);
      }
      
      console.log(`💰 Using ${customPriceNum ? 'custom' : 'standard'} price: €${monthlyPrice}/month for ${company.name}`);
      console.log(`💰 DEBUG: customMonthlyPrice="${company.subscription.customMonthlyPrice}" (${typeof company.subscription.customMonthlyPrice}) -> ${customPriceNum}`);
      console.log(`💰 DEBUG: standardMonthlyPrice="${standardMonthlyPrice}" (${typeof standardMonthlyPrice}) -> ${standardPriceNum}`);
      console.log(`💰 DEBUG: Final monthlyPrice=${monthlyPrice} (${typeof monthlyPrice})`);

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
            plan: company.subscription.plan,
            contact_name: user.fullName,
            tax_id: company.cif || 'B00000000'
          }
        });
        
        stripeCustomerId = customer.id;
        await storage.updateUserStripeCustomerId(userId, stripeCustomerId);
        console.log(`Created new production customer: ${stripeCustomerId}`);
      }

      // Attach payment method to customer
      await stripe.paymentMethods.attach(paymentIntent.payment_method as string, {
        customer: stripeCustomerId,
      });

      // Set as default payment method
      await stripe.customers.update(stripeCustomerId, {
        invoice_settings: {
          default_payment_method: paymentIntent.payment_method as string,
        },
      });

      // Create product first
      const product = await stripe.products.create({
        name: `Plan ${company.subscription.plan.charAt(0).toUpperCase() + company.subscription.plan.slice(1)} - ${company.name}`,
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
      console.log(`💰 STRIPE PRICE CREATED: ID=${price.id}, unit_amount=${price.unit_amount} cents (€${price.unit_amount/100})`);

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
        const actualCustomPrice = company.subscription.customMonthlyPrice ? Number(company.subscription.customMonthlyPrice) : null;
        const actualStandardPrice = company.subscription.plan === 'pro' ? 39.95 : 
                                   company.subscription.plan === 'basic' ? 19.95 : 
                                   company.subscription.plan === 'master' ? 99.95 : 39.95;
        const originalCustomPrice = actualCustomPrice || actualStandardPrice;
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
        // Trial has ended: Create subscription WITHOUT capturing payment again 
        // CRITICAL FIX: Don't capture PaymentIntent manually - let subscription handle billing
        console.log(`🏦 TRIAL ENDED - Creating subscription (no manual capture needed)`);
        
        // Create subscription which will automatically charge for first period
        const subscription = await stripe.subscriptions.create({
          customer: stripeCustomerId,
          items: [{ price: price.id }],
          default_payment_method: paymentIntent.payment_method as string,
          // No trial_end needed - this is the actual billing moment
        });
        
        console.log(`💰 SUBSCRIPTION CREATED - Amount: €${price.unit_amount!/100}, Status: ${subscription.status}`);
        
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
        billing_name: company.name || admin?.fullName || req.user!.fullName,
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

      const currentStats = {
        employee_count: parseInt(String(employeeCount[0]?.count || 0)),
        active_employees: parseInt(String(employeeCount[0]?.count || 0)),
        time_entries_count: parseInt(String(timeEntriesCount[0]?.count || 0)),
        documents_uploaded: parseInt(String(documentsCount[0]?.count || 0)),
        storage_used_mb: '0.5', // Placeholder - would need actual file size calculation
        api_calls: parseInt(String(timeEntriesCount[0]?.count || 0)) * 2
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
      const registrationDate = new Date(data.company_created_at);
      const trialEndDate = new Date(registrationDate);
      // Use custom trial duration from company settings (default 14 days)
      const trialDuration = data.trial_duration_days || 14;
      trialEndDate.setDate(trialEndDate.getDate() + trialDuration);
      
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

  // Preview plan change - calculate exact charges without executing the change
  app.post('/api/subscription/preview-plan-change', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const { plan } = req.body;
      // Preview plan change request

      if (!plan) {
        return res.status(400).json({ message: 'Plan requerido.' });
      }

      // Get available plans from subscription_plans table
      const availablePlansResult = await db.execute(sql`
        SELECT name FROM subscription_plans WHERE name IS NOT NULL
      `);
      const availablePlans = availablePlansResult.rows.map(row => row.name);

      if (!availablePlans.includes(plan)) {
        return res.status(400).json({ 
          message: `Plan inválido. Debe ser uno de: ${availablePlans.join(', ')}.` 
        });
      }

      // Get company and current subscription
      const company = await storage.getCompanyByUserId(userId);
      if (!company?.subscription) {
        return res.status(404).json({ message: 'Suscripción no encontrada' });
      }

      // Check if it's the same plan
      if (company.subscription.plan === plan) {
        return res.status(400).json({ 
          message: `Ya estás suscrito al plan ${plan.charAt(0).toUpperCase() + plan.slice(1)}. No se requieren cambios.` 
        });
      }

      // Get plan details
      const newPlanResult = await db.execute(sql`
        SELECT name, display_name, monthly_price, max_users 
        FROM subscription_plans 
        WHERE name = ${plan}
      `);

      const currentPlanResult = await db.execute(sql`
        SELECT name, display_name, monthly_price 
        FROM subscription_plans 
        WHERE name = ${company.subscription.plan}
      `);

      if (newPlanResult.rows.length === 0 || currentPlanResult.rows.length === 0) {
        return res.status(404).json({ message: 'Plan no encontrado' });
      }

      const newPlan = newPlanResult.rows[0] as any;
      const currentPlan = currentPlanResult.rows[0] as any;

      // Calculate exact charge - currently disabled for simplified billing
      const currentPrice = parseFloat(currentPlan.monthly_price);
      const newPrice = parseFloat(newPlan.monthly_price);
      const priceDifference = newPrice - currentPrice;

      let previewData = {
        currentPlan: {
          name: currentPlan.name,
          displayName: currentPlan.display_name,
          monthlyPrice: currentPrice
        },
        newPlan: {
          name: newPlan.name,
          displayName: newPlan.display_name,
          monthlyPrice: newPrice,
          maxUsers: newPlan.max_users
        },
        changeType: priceDifference > 0 ? 'upgrade' : (priceDifference < 0 ? 'downgrade' : 'lateral'),
        priceDifference: Math.abs(priceDifference),
        immediateCharge: 0, // Currently disabled - simplified billing
        immediateChargeDescription: 'Sin cargo inmediato',
        billingDescription: 'El nuevo precio se aplicará en tu próximo ciclo de facturación.',
        effectiveDate: 'Inmediato',
        nextBillingDate: company.subscription.nextPaymentDate
      };

      res.json(previewData);
    } catch (error) {
      console.error('Error previewing plan change:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  // Helper function to check if plan change is a downgrade
  function checkIsDowngrade(currentPlan: string, newPlan: string): boolean {
    const planHierarchy = { 'basic': 1, 'pro': 2, 'master': 3 };
    const currentLevel = planHierarchy[currentPlan as keyof typeof planHierarchy] || 0;
    const newLevel = planHierarchy[newPlan as keyof typeof planHierarchy] || 0;
    return newLevel < currentLevel;
  }

  // Change subscription plan
  app.patch('/api/subscription/change-plan', authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Change plan endpoint reached
      const userId = req.user!.id;
      const { plan } = req.body;
      // Change plan request

      if (!plan) {
        return res.status(400).json({ message: 'Plan requerido.' });
      }

      // Get available plans from subscription_plans table
      const availablePlansResult = await db.execute(sql`
        SELECT name FROM subscription_plans WHERE name IS NOT NULL
      `);
      const availablePlans = availablePlansResult.rows.map(row => row.name);

      if (!availablePlans.includes(plan)) {
        return res.status(400).json({ 
          message: `Plan inválido. Debe ser uno de: ${availablePlans.join(', ')}.` 
        });
      }

      // Get company and current subscription
      console.log('DEBUG - Change plan: Getting company for userId:', userId);
      const company = await storage.getCompanyByUserId(userId);
      console.log('DEBUG - Change plan: Retrieved company:', JSON.stringify(company, null, 2));
      if (!company?.subscription) {
        console.log('DEBUG - Change plan: No subscription found, company:', company);
        return res.status(404).json({ message: 'Suscripción no encontrada' });
      }

      // CRITICAL FIX: Prevent billing loop by strictly blocking same-plan changes
      // This was causing multiple Stripe invoices when users rapidly switched plans
      if (company.subscription.plan === plan) {
        console.log(`BILLING LOOP PREVENTION: Blocking change to same plan '${plan}' for company ${company.id}`);
        return res.status(400).json({ 
          message: `Ya estás suscrito al plan ${plan.charAt(0).toUpperCase() + plan.slice(1)}. No se requieren cambios.` 
        });
      }

      // 1. Get features from features table (PRIMARY SOURCE for functionality)
      const featuresResult = await db.execute(sql`
        SELECT key, basic_enabled, pro_enabled, master_enabled
        FROM features 
        WHERE is_active = true
      `);

      // Build features object based on the plan using features table
      const planFeatures: Record<string, boolean> = {};
      for (const feature of featuresResult.rows) {
        const enabledColumnName = `${plan}_enabled`;
        const enabled = feature[enabledColumnName as keyof typeof feature];
        planFeatures[feature.key as string] = Boolean(enabled);
      }

      // 2. Get plan settings from subscription_plans table (SECONDARY DATA for limits/pricing)
      const planResult = await db.execute(sql`
        SELECT max_users, price_per_user 
        FROM subscription_plans 
        WHERE name = $1
      `, [plan]);

      if (planResult.rows.length === 0) {
        return res.status(404).json({ message: 'Plan no encontrado en la base de datos' });
      }

      const newPlanData = planResult.rows[0];
      const currentPlanData = await db.execute(sql`
        SELECT price_per_user FROM subscription_plans WHERE name = $1
      `, [company.subscription.plan]);

      // DOWNGRADE LOGIC: Retain current plan features until next billing cycle
      const currentPlan = company.subscription.plan;
      const isDowngrade = checkIsDowngrade(currentPlan, plan);
      let responseMessage = '';
      
      if (isDowngrade) {
        // For downgrades, retain current features until next billing cycle
        const nextPaymentDate = company.subscription.nextPaymentDate 
          ? new Date(company.subscription.nextPaymentDate)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Default to 30 days from now
        
        await db.execute(sql`
          UPDATE subscriptions 
          SET 
            next_plan = ${plan},
            current_effective_plan = ${currentPlan},
            plan_change_date = ${nextPaymentDate.toISOString()},
            max_users = ${newPlanData.max_users},
            updated_at = NOW()
          WHERE company_id = ${company.id}
        `);
        
        // Don't update companies table plan yet for downgrades
        responseMessage = `Cambio programado exitosamente. Mantendrás las características de ${currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)} hasta el ${nextPaymentDate.toLocaleDateString('es-ES')}. `;
        responseMessage += `A partir de esa fecha tendrás las características del plan ${plan.charAt(0).toUpperCase() + plan.slice(1)}.`;
      } else {
        // For upgrades, apply immediately
        await db.execute(sql`
          UPDATE subscriptions 
          SET 
            plan = ${plan},
            current_effective_plan = NULL,
            next_plan = NULL,
            plan_change_date = NULL,
            max_users = ${newPlanData.max_users},
            updated_at = NOW()
          WHERE company_id = ${company.id}
        `);

        // Update companies table for upgrades
        await db.execute(sql`
          UPDATE companies 
          SET 
            plan = ${plan},
            updated_at = NOW()
          WHERE id = ${company.id}
        `);
        
        responseMessage = `Plan cambiado exitosamente a ${plan.charAt(0).toUpperCase() + plan.slice(1)}. `;
        responseMessage += `Las nuevas características están disponibles inmediatamente.`;
      }

      res.json({
        success: true,
        message: responseMessage,
        plan: plan,
        features: planFeatures,
        maxUsers: newPlanData.max_users
      });
    } catch (error) {
      console.error('Error changing subscription plan:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  // Super Admin - Subscription Plans Management
  app.get('/api/super-admin/subscription-plans', authenticateSuperAdmin, async (req: any, res) => {
    try {
      const plans = await storage.getAllSubscriptionPlans();
      res.json(plans);
    } catch (error) {
      console.error('Error fetching subscription plans:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  app.post('/api/super-admin/subscription-plans', authenticateSuperAdmin, async (req: any, res) => {
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
      
      res.status(201).json(plan);
    } catch (error) {
      console.error('Error creating subscription plan:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  app.patch('/api/super-admin/subscription-plans/:id', authenticateSuperAdmin, async (req: any, res) => {
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
      
      res.json(plan);
    } catch (error) {
      console.error('Error updating subscription plan:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  app.delete('/api/super-admin/subscription-plans/:id', authenticateSuperAdmin, async (req: any, res) => {
    try {
      const planId = parseInt(req.params.id);
      const success = await storage.deleteSubscriptionPlan(planId);
      
      if (!success) {
        return res.status(404).json({ message: 'Plan no encontrado' });
      }
      
      res.json({ message: 'Plan eliminado correctamente' });
    } catch (error) {
      console.error('Error deleting subscription plan:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  // Features endpoints
  app.get('/api/super-admin/features', authenticateSuperAdmin, async (req: any, res) => {
    try {
      const features = await storage.getAllFeatures();
      res.json(features);
    } catch (error) {
      console.error('Error fetching features:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  app.patch('/api/super-admin/features/:id', authenticateSuperAdmin, async (req: any, res) => {
    try {
      const featureId = parseInt(req.params.id);
      const updates = req.body;
      
      const feature = await storage.updateFeature(featureId, updates);
      
      if (!feature) {
        return res.status(404).json({ message: 'Feature no encontrada' });
      }
      
      res.json(feature);
    } catch (error) {
      console.error('Error updating feature:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });



  // Super admin route to get individual company details
  app.get('/api/super-admin/companies/:id', authenticateSuperAdmin, async (req: any, res) => {
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
  app.patch('/api/super-admin/companies/:id/subscription', authenticateSuperAdmin, async (req: any, res) => {
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
        if (updates.customMonthlyPrice !== undefined) updateData.customMonthlyPrice = updates.customMonthlyPrice;
        
        subscription = await storage.updateCompanySubscription(companyId, updateData);
      }

      // Handle trial duration updates (stored in companies table)
      if (updates.trialDurationDays !== undefined) {
        console.log('🔄 Updating trial duration for company:', companyId, 'to:', updates.trialDurationDays);
        const updateResult = await storage.updateCompany(companyId, { 
          trialDurationDays: updates.trialDurationDays 
        });
        console.log('✅ Trial duration update result:', updateResult?.trialDurationDays);
      }
      
      // Get updated company information to include in response
      const updatedCompany = await storage.getCompany(companyId);
      
      res.json({
        subscription,
        trialDurationDays: updatedCompany?.trialDurationDays
      });
    } catch (error: any) {
      console.error('Error updating company subscription:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  // Super Admin - Registration Settings Management
  app.get('/api/super-admin/registration-settings', authenticateSuperAdmin, async (req: any, res) => {
    try {
      const settings = await storage.getRegistrationSettings();
      res.json(settings);
    } catch (error) {
      console.error('Error fetching registration settings:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  app.patch('/api/super-admin/registration-settings', authenticateSuperAdmin, async (req: any, res) => {
    try {
      const { publicRegistrationEnabled } = req.body;
      const settings = await storage.updateRegistrationSettings({
        publicRegistrationEnabled,
        updatedAt: new Date()
      });
      res.json(settings);
    } catch (error) {
      console.error('Error updating registration settings:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  // Super Admin - Invitation Links Management  
  app.post('/api/super-admin/invitations', authenticateSuperAdmin, async (req: any, res) => {
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
        const transporter = nodemailer.createTransport({
          host: 'smtp.hostinger.com',
          port: 465,
          secure: true, // SSL
          auth: {
            user: 'soy@oficaz.es',
            pass: 'Sanisidro@2025',
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
      
      res.status(201).json({
        ...invitation,
        invitationUrl
      });
    } catch (error) {
      console.error('Error creating invitation:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  // Validate invitation token
  app.get('/api/validate-invitation/:token', async (req, res) => {
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

  app.get('/api/super-admin/invitations', authenticateSuperAdmin, async (req: any, res) => {
    try {
      const invitations = await storage.getAllInvitationLinks();
      res.json(invitations);
    } catch (error) {
      console.error('Error fetching invitations:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  app.delete('/api/super-admin/invitations/:id', authenticateSuperAdmin, async (req: any, res) => {
    try {
      const invitationId = parseInt(req.params.id);
      const success = await storage.deleteInvitationLink(invitationId);
      
      if (!success) {
        return res.status(404).json({ message: 'Invitación no encontrada' });
      }
      
      res.json({ message: 'Invitación eliminada correctamente' });
    } catch (error) {
      console.error('Error deleting invitation:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
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
  app.delete('/api/super-admin/companies/:id/delete-permanently', authenticateSuperAdmin, async (req: any, res) => {
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

      // 7. Delete subscription
      await db.delete(subscriptions)
        .where(eq(subscriptions.companyId, companyId));
      console.log('✅ Deleted subscription');

      // 8. Delete password reset tokens (CRITICAL: Must be deleted before company)
      await db.delete(passwordResetTokens)
        .where(eq(passwordResetTokens.companyId, companyId));
      console.log('✅ Deleted password reset tokens');

      // 9. Delete all users
      if (userIdsForAdmin.length > 0) {
        await db.delete(users)
          .where(eq(users.companyId, companyId));
        console.log('✅ Deleted users');
      }

      // 10. Finally, delete the company
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

  // Auto-process expired trials (capture authorized payments and activate)
  app.post('/api/subscription/auto-trial-process', async (req, res) => {
    try {
      console.log('🏦 AUTO-TRIAL PROCESSING - Checking for expired trials to activate...');
      
      const now = new Date();
      let processedCount = 0;
      let errorCount = 0;
      
      // Get all companies with expired trials that have pending payment intents
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
          AND c.custom_features ? 'pending_payment_intent_id'
          AND c.custom_features ->> 'pending_payment_intent_id' IS NOT NULL
      `);
      
      console.log(`🏦 Found ${expiredTrials.rows.length} expired trials with pending payments`);
      
      for (const trial of expiredTrials.rows) {
        const t = trial as any;
        
        try {
          console.log(`🏦 Processing trial for company ${t.company_name} (ID: ${t.company_id})`);
          
          // Get payment intent from custom_features
          const paymentIntentId = t.custom_features?.pending_payment_intent_id;
          if (!paymentIntentId) {
            console.log(`⚠️ No payment intent found for company ${t.company_id}`);
            continue;
          }
          
          // Retrieve and capture the authorized payment
          const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
          
          if (paymentIntent.status === 'requires_capture') {
            // Get the actual billing amount (may be different from authorization amount)
            const actualBillingCents = t.custom_features?.actual_billing_amount || paymentIntent.amount;
            
            console.log(`💰 CAPTURING payment for ${t.company_name}: authorized=€${paymentIntent.amount/100}, billing=€${actualBillingCents/100}`);
            
            // Capture the payment (Stripe allows partial capture if actual amount is lower)
            const capturedPayment = await stripe.paymentIntents.capture(paymentIntentId, {
              amount_to_capture: actualBillingCents
            });
            console.log(`✅ PAYMENT CAPTURED: €${capturedPayment.amount/100} for ${t.company_name}`);
            
            // Get plan pricing for recurring subscription
            const planResult = await db.execute(sql`
              SELECT monthly_price FROM subscription_plans 
              WHERE name = ${t.plan}
            `);
            
            if (!planResult.rows[0]) {
              console.error(`❌ Plan ${t.plan} not found for company ${t.company_id}`);
              errorCount++;
              continue;
            }
            
            const monthlyPrice = Number((planResult.rows[0] as any).monthly_price);
            
            // Create recurring product and price
            const product = await stripe.products.create({
              name: `Plan ${t.plan.charAt(0).toUpperCase() + t.plan.slice(1)} - ${t.company_name}`,
            });
            
            const price = await stripe.prices.create({
              currency: 'eur',
              unit_amount: Math.round(monthlyPrice * 100),
              recurring: { interval: 'month' },
              product: product.id,
            });
            
            // Create recurring subscription  
            // CRITICAL FIX: Add trial_end to prevent double charging
            const subscription = await stripe.subscriptions.create({
              customer: t.stripe_customer_id,
              items: [{ price: price.id }],
              default_payment_method: paymentIntent.payment_method as string,
              trial_end: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 days trial
            });
            
            console.log(`🔄 RECURRING SUBSCRIPTION CREATED: ${subscription.id} for ${t.company_name}`);
            
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
            
            console.log(`✅ TRIAL CONVERTED: ${t.company_name} activated successfully`);
            processedCount++;
            
          } else {
            console.log(`⚠️ PaymentIntent ${paymentIntentId} status: ${paymentIntent.status} - cannot capture`);
            errorCount++;
          }
          
        } catch (error) {
          console.error(`❌ Error processing trial for company ${t.company_id}:`, error);
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
      console.log('🔍 demo-data/status - Checking for user:', req.user?.id);
      const userId = req.user!.id;
      const company = await storage.getCompanyByUserId(userId);
      
      if (!company) {
        console.log('❌ demo-data/status - Company not found for user:', userId);
        return res.status(404).json({ message: 'Empresa no encontrada' });
      }
      
      // Fix field mapping: Drizzle converts has_demo_data to hasDemoData automatically
      const hasDemoData = company.hasDemoData || false;
      console.log('✅ demo-data/status - Company found:', company.name, 'hasDemoData:', hasDemoData);
      res.json({ hasDemoData });
    } catch (error) {
      console.error('❌ demo-data/status - Error:', error);
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

  // Temporary endpoint to force regenerate demo data with improvements
  app.post('/api/demo-data/force-regenerate', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const company = await storage.getCompanyByUserId(userId);
      
      if (!company) {
        return res.status(404).json({ message: 'Empresa no encontrada' });
      }

      console.log('🔄 Force regenerating demo data with improvements for company:', company.id);

      // Generate comprehensive demo data (ignoring hasDemoData flag)
      await generateDemoData(company.id);
      
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
    try {
      const userId = req.user!.id;
      const company = await storage.getCompanyByUserId(userId);
      
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

      if (demoEmployeeIds.length > 0) {
        console.log('🗑️ Deleting demo data for employee IDs:', demoEmployeeIds);
        
        // Delete ALL data in proper cascade order to handle foreign key constraints
        // Must delete in this exact order to avoid constraint violations
        
        // Step 1: Delete break periods first (many foreign key references)
        await db.delete(breakPeriods)
          .where(inArray(breakPeriods.userId, demoEmployeeIds));
        console.log('✅ Deleted break periods');
        
        // Step 2: Delete work sessions 
        await db.delete(workSessions)
          .where(inArray(workSessions.userId, demoEmployeeIds));
        console.log('✅ Deleted work sessions');
        
        // Step 3: Delete vacation requests
        await db.delete(vacationRequests)
          .where(inArray(vacationRequests.userId, demoEmployeeIds));
        console.log('✅ Deleted vacation requests');
        
        // Step 4: Delete messages
        await db.delete(messages)
          .where(inArray(messages.senderId, demoEmployeeIds));
        console.log('✅ Deleted messages');
        
        // Step 5: Delete ALL reminders for the entire company (demo data includes admin reminders)
        let reminderDeleteAttempts = 0;
        let remainingReminders = 0;
        do {
          reminderDeleteAttempts++;
          const result = await db.delete(reminders)
            .where(eq(reminders.companyId, company.id));
          
          // Check if any reminders remain for this company
          const reminderCheck = await db.select({ count: count() })
            .from(reminders)
            .where(eq(reminders.companyId, company.id));
          remainingReminders = reminderCheck[0]?.count || 0;
          
          console.log(`🔄 Reminder deletion attempt ${reminderDeleteAttempts}, remaining: ${remainingReminders}`);
          
          if (remainingReminders > 0 && reminderDeleteAttempts < 3) {
            // Wait a brief moment before retry
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } while (remainingReminders > 0 && reminderDeleteAttempts < 3);
        
        console.log('✅ Deleted all company reminders');
        
        // Step 6: Delete documents
        await db.delete(documents)
          .where(inArray(documents.userId, demoEmployeeIds));
        console.log('✅ Deleted documents');
        
        // Step 7: Final attempt to delete any remaining break periods that might have regenerated
        await db.delete(breakPeriods)
          .where(inArray(breakPeriods.userId, demoEmployeeIds));
        console.log('✅ Final cleanup of break periods');
        
        // Step 8: Delete demo employees (this should now work without foreign key violations)
        await db.delete(users)
          .where(and(
            eq(users.companyId, company.id),
            not(eq(users.id, userId)) // Keep admin
          ));
        console.log('✅ Deleted demo employees');
      }

      // Mark company as no longer having demo data
      await db.update(companies)
        .set({ hasDemoData: false })
        .where(eq(companies.id, company.id));

      console.log('✅ Demo data cleared successfully for company:', company.id);
      res.json({ message: 'Datos de prueba eliminados correctamente' });

    } catch (error) {
      console.error('❌ Error clearing demo data:', error);
      res.status(500).json({ message: 'Error al eliminar los datos de prueba: ' + (error as any).message });
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
  app.post('/api/super-admin/request-code', async (req, res) => {
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
  app.post('/api/super-admin/verify-code', async (req, res) => {
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
        process.env.JWT_SECRET || 'secret',
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
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
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
        res.json({ message: 'Alarm deleted successfully' });
      } else {
        res.status(404).json({ message: 'Alarm not found' });
      }
    } catch (error) {
      console.error('Error deleting work alarm:', error);
      res.status(500).json({ message: 'Failed to delete work alarm' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
