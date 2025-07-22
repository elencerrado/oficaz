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
import { loginSchema, companyRegistrationSchema, insertVacationRequestSchema, insertMessageSchema } from '@shared/schema';
import { db } from './db';
import { eq, and, desc, sql, not, inArray } from 'drizzle-orm';
import { subscriptions, companies, features, users, workSessions, breakPeriods, vacationRequests, messages, reminders, documents, subscriptionPlans, features as featuresTable } from '@shared/schema';
import { sendEmployeeWelcomeEmail } from './email';

// Initialize Stripe with environment-specific keys
const isDevelopment = process.env.NODE_ENV === 'development';
const stripeSecretKey = isDevelopment 
  ? process.env.STRIPE_SECRET_KEY_TEST 
  : process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  throw new Error(`STRIPE_SECRET_KEY${isDevelopment ? '_TEST' : ''} environment variable is required`);
}

console.log('Stripe Environment:', isDevelopment ? 'Development (Test)' : 'Production (Live)');
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

// ⚠️ PROTECTED - DO NOT MODIFY
// Dynamic demo data generation based on company creation date
async function generateDynamicDemoData(companyId: number) {
  try {
    console.log('🎭 Generating dynamic demo data for company:', companyId);
    
    // Get company creation date as reference point
    const [company] = await db.select({ createdAt: companies.createdAt })
      .from(companies)
      .where(eq(companies.id, companyId));
      
    if (!company) {
      throw new Error('Company not found');
    }
    
    const accountCreationDate = new Date(company.createdAt);
    console.log('📅 Account created:', accountCreationDate);
    
    // Mark company as having demo data
    await db.update(companies)
      .set({ hasDemoData: true })
      .where(eq(companies.id, companyId));
    
    // Demo employees data - 4 employees (2 men, 2 women)
    const demoEmployees = [
      {
        fullName: "Carlos Martínez López",
        companyEmail: "carlos.martinez@demo.com",
        dni: "12345678A",
        position: "Desarrollador Senior",
        role: "employee" as const,
        startDate: new Date(accountCreationDate.getFullYear() - 2, 3, 15),
      },
      {
        fullName: "Miguel Fernández García",
        companyEmail: "miguel.fernandez@demo.com", 
        dni: "87654321B",
        position: "Diseñador UX/UI",
        role: "manager" as const,
        startDate: new Date(accountCreationDate.getFullYear() - 1, 8, 10),
      },
      {
        fullName: "Ana Rodríguez Sánchez",
        companyEmail: "ana.rodriguez@demo.com",
        dni: "11111111C", 
        position: "Analista de Datos",
        role: "employee" as const,
        startDate: new Date(accountCreationDate.getFullYear() - 1, 1, 20),
      },
      {
        fullName: "Laura González Martín",
        companyEmail: "laura.gonzalez@demo.com",
        dni: "22222222D",
        position: "Coordinadora de Proyectos", 
        role: "employee" as const,
        startDate: new Date(accountCreationDate.getFullYear(), 0, 8),
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
      
      createdEmployees.push(employee);
      console.log(`👤 Created demo employee: ${employee.fullName}`);
    }

    // Generate demo data
    await generateCurrentMonthDemoData(createdEmployees, accountCreationDate);
    
    console.log('✅ Demo data generation completed for company:', companyId);
    
  } catch (error) {
    console.error('❌ Error generating demo data:', error);
    throw error;
  }
}

// Generate all current month demo data
async function generateCurrentMonthDemoData(employees: any[], creationDate: Date) {
  await generateDemoWorkSessions(employees, creationDate);
  await generateDemoVacationRequests(employees, creationDate);
  await generateDemoMessages(employees);
  await generateDemoReminders(employees);
}

// Generate demo work sessions
async function generateDemoWorkSessions(employees: any[], creationDate: Date) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const workDays = [1, 2, 3, 4, 5]; // Monday to Friday
  
  for (const employee of employees) {
    for (let day = 1; day <= Math.min(daysInMonth, now.getDate()); day++) {
      const date = new Date(year, month, day);
      const dayOfWeek = date.getDay();
      
      // Skip weekends
      if (!workDays.includes(dayOfWeek)) continue;
      
      // 90% chance of working on weekdays
      if (Math.random() > 0.9) continue;
      
      // Generate realistic work hours
      const startHour = 8 + Math.floor(Math.random() * 2);
      const startMinute = Math.floor(Math.random() * 4) * 15;
      const workHours = 7.5 + Math.random() * 1.5;
      
      const clockInTime = new Date(date);
      clockInTime.setHours(startHour, startMinute, 0, 0);
      
      const clockOutTime = new Date(clockInTime);
      clockOutTime.setTime(clockOutTime.getTime() + workHours * 60 * 60 * 1000);
      
      // Create work session
      const session = await storage.createWorkSession({
        userId: employee.id,
        clockIn: clockInTime,
        clockOut: clockOutTime,
        totalHours: workHours.toFixed(1),
      });
      
      // Generate break periods
      if (Math.random() < 0.6) {
        const breakStart = new Date(clockInTime.getTime() + (3 + Math.random() * 2) * 60 * 60 * 1000);
        const breakDuration = 30 + Math.random() * 60;
        const breakEnd = new Date(breakStart.getTime() + breakDuration * 60 * 1000);
        
        await storage.createBreakPeriod({
          userId: employee.id,
          workSessionId: session.id,
          breakStart: breakStart,
          breakEnd: breakEnd,
        });
      }
    }
  }
  
  console.log(`⏰ Generated work sessions for employees`);
}

// Generate demo vacation requests
async function generateDemoVacationRequests(employees: any[], creationDate: Date) {
  const now = new Date();
  const vacationRequests = [
    {
      employee: employees[0],
      startDate: new Date(now.getFullYear(), now.getMonth(), 5),
      endDate: new Date(now.getFullYear(), now.getMonth(), 7),
      status: 'approved' as const,
      reason: 'Vacaciones familiares',
    },
    {
      employee: employees[1], 
      startDate: new Date(now.getFullYear(), now.getMonth() + 1, 15),
      endDate: new Date(now.getFullYear(), now.getMonth() + 1, 19),
      status: 'pending' as const,
      reason: 'Descanso personal',
    },
  ];
  
  for (const request of vacationRequests) {
    await storage.createVacationRequest({
      userId: request.employee.id,
      startDate: request.startDate,
      endDate: request.endDate,
      status: request.status,
      reason: request.reason,
    });
  }
  
  console.log(`📋 Generated vacation requests for employees`);
}

// Generate demo messages
async function generateDemoMessages(employees: any[]) {
  const messageTemplates = [
    {
      subject: 'Reunión de equipo mañana',
      content: 'Recordatorio de la reunión de equipo programada para mañana a las 10:00 AM.'
    },
    {
      subject: 'Actualización del proyecto',
      content: 'Les informo que hemos completado la primera fase del proyecto.'
    },
  ];
  
  // Generate bidirectional messages
  for (let i = 0; i < employees.length; i++) {
    for (let j = i + 1; j < employees.length; j++) {
      const template = messageTemplates[Math.floor(Math.random() * messageTemplates.length)];
      const sender = Math.random() < 0.5 ? employees[i] : employees[j];
      const receiver = sender === employees[i] ? employees[j] : employees[i];
      
      await storage.createMessage({
        senderId: sender.id,
        receiverId: receiver.id,
        subject: template.subject,
        content: template.content,
        isRead: Math.random() < 0.7
      });
    }
  }
  
  console.log(`💬 Generated messages for employees`);
}

// Generate demo reminders
async function generateDemoReminders(employees: any[]) {
  const demoReminders = [
    {
      title: 'Reunión de equipo',
      description: 'Reunión semanal para revisar el progreso del proyecto',
      employee: employees[0],
    },
    {
      title: 'Entrega de informe mensual',
      description: 'Completar y enviar el informe de análisis de datos',
      employee: employees[1],
    },
  ];
  
  for (const reminder of demoReminders) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + Math.floor(Math.random() * 7) + 1);
    
    await storage.createReminder({
      title: reminder.title,
      description: reminder.description,
      dueDateTime: dueDate,
      userId: reminder.employee.id,
      createdBy: reminder.employee.id,
    });
  }
  
  console.log('⏰ Generated demo reminders');
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication endpoint for testing
  app.get('/api/auth/me', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const company = await storage.getCompany(user.companyId);
      const subscription = await storage.getSubscriptionByCompanyId(user.companyId);

      res.json({
        user: { ...user, password: undefined },
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
      res.status(500).json({ message: error.message });
    }
  });

  // Demo data status endpoint
  app.get('/api/demo-data/status', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;
      
      const [company] = await db.select({ hasDemoData: companies.hasDemoData })
        .from(companies)
        .where(eq(companies.id, companyId));
      
      res.json({ hasDemoData: company?.hasDemoData || false });
    } catch (error) {
      console.error('Error checking demo data status:', error);
      res.status(500).json({ message: 'Error checking demo data status' });
    }
  });

  // Demo data generation endpoint
  app.post('/api/demo-data/generate', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;
      
      // Check if company already has demo data
      const [company] = await db.select({ hasDemoData: companies.hasDemoData })
        .from(companies)
        .where(eq(companies.id, companyId));
      
      if (company?.hasDemoData) {
        return res.status(400).json({ message: 'Demo data already exists for this company' });
      }
      
      await generateDynamicDemoData(companyId);
      
      res.json({ success: true, message: 'Demo data generated successfully' });
    } catch (error) {
      console.error('Error generating demo data:', error);
      res.status(500).json({ message: 'Error generating demo data' });
    }
  });

  // Demo data clear endpoint
  app.delete('/api/demo-data/clear', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;
      
      // Get demo employees
      const demoEmployees = await db.select({ id: users.id })
        .from(users)
        .where(and(
          eq(users.companyId, companyId),
          eq(users.role, 'employee')
        ));
      
      if (demoEmployees.length > 0) {
        const demoIds = demoEmployees.map(e => e.id);
        
        // Clear demo data
        await db.delete(workSessions).where(inArray(workSessions.userId, demoIds));
        await db.delete(breakPeriods).where(inArray(breakPeriods.userId, demoIds));
        await db.delete(vacationRequests).where(inArray(vacationRequests.userId, demoIds));
        await db.delete(messages).where(inArray(messages.senderId, demoIds));
        await db.delete(reminders).where(inArray(reminders.userId, demoIds));
        await db.delete(users).where(inArray(users.id, demoIds));
      }
      
      // Mark company as not having demo data
      await db.update(companies)
        .set({ hasDemoData: false })
        .where(eq(companies.id, companyId));
      
      res.json({ success: true, message: 'Demo data cleared successfully' });
    } catch (error) {
      console.error('Error clearing demo data:', error);
      res.status(500).json({ message: 'Error clearing demo data' });
    }
  });

  // Basic login endpoint for testing
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 requests per windowMs
    message: { message: 'Demasiados intentos de login, inténtalo más tarde.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.post('/api/auth/login', loginLimiter, async (req, res) => {
    try {
      const { username, password, companyAlias, rememberMe } = req.body;
      
      // Validate required fields
      if (!username || !password || !companyAlias) {
        return res.status(400).json({ message: 'Todos los campos son requeridos' });
      }
      
      // Find company by alias
      const [company] = await db.select().from(companies).where(eq(companies.companyAlias, companyAlias));
      if (!company) {
        return res.status(400).json({ message: 'Empresa no encontrada' });
      }

      // Find user by different possible username formats
      let user;
      if (username.includes('@')) {
        // Email login
        user = await db.select().from(users)
          .where(and(
            eq(users.companyId, company.id),
            eq(users.companyEmail, username.toLowerCase())
          ));
      } else {
        // DNI login
        user = await db.select().from(users)
          .where(and(
            eq(users.companyId, company.id),
            eq(users.dni, username.toUpperCase())
          ));
      }

      if (!user || user.length === 0) {
        return res.status(400).json({ message: 'Credenciales inválidas' });
      }

      const foundUser = user[0];
      
      // Check password
      const validPassword = await bcrypt.compare(password, foundUser.password);
      if (!validPassword) {
        return res.status(400).json({ message: 'Credenciales inválidas' });
      }

      // Generate token
      const token = generateToken({
        id: foundUser.id,
        username: foundUser.companyEmail,
        role: foundUser.role,
        companyId: foundUser.companyId
      });

      res.json({ token, user: { ...foundUser, password: undefined } });
    } catch (error: any) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  // Super admin login endpoint
  app.post('/api/super-admin/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: 'Username y password son requeridos' });
      }
      
      // Check super admin credentials (hardcoded for security)
      if (username === 'superadmin' && password === 'SuperAdmin2025!') {
        const token = generateToken({
          id: 0,
          username: 'superadmin@oficaz.com',
          role: 'superadmin',
          companyId: 0
        });
        
        res.json({ 
          token, 
          user: { 
            id: 0, 
            email: 'superadmin@oficaz.com', 
            role: 'superadmin' 
          } 
        });
      } else {
        res.status(401).json({ message: 'Credenciales de super admin incorrectas' });
      }
    } catch (error: any) {
      console.error('Super admin login error:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  // Get all subscription plans (super admin)
  app.get('/api/super-admin/subscription-plans', authenticateToken, requireRole(['superadmin']), async (req, res) => {
    try {
      const plans = await db.select().from(subscriptionPlans).orderBy(subscriptionPlans.id);
      const features = await db.select().from(featuresTable).orderBy(featuresTable.id);
      
      res.json({ plans, features });
    } catch (error: any) {
      console.error('Error fetching subscription plans:', error);
      res.status(500).json({ message: 'Error fetching subscription plans' });
    }
  });

  // Update subscription plan (super admin)
  app.patch('/api/super-admin/subscription-plans/:id', authenticateToken, requireRole(['superadmin']), async (req, res) => {
    try {
      const planId = parseInt(req.params.id);
      const { pricePerUser, maxUsers } = req.body;
      
      await db.update(subscriptionPlans)
        .set({ 
          pricePerUser: pricePerUser.toString(), 
          maxUsers: maxUsers || null 
        })
        .where(eq(subscriptionPlans.id, planId));
      
      res.json({ success: true, message: 'Plan actualizado exitosamente' });
    } catch (error: any) {
      console.error('Error updating subscription plan:', error);
      res.status(500).json({ message: 'Error updating subscription plan' });
    }
  });

  // Create server and return it
  const httpServer = createServer(app);
  return httpServer;
}