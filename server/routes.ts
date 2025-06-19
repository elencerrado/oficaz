import type { Express } from "express";
import { createServer, type Server } from "http";
import bcrypt from 'bcrypt';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { storage } from "./storage";
import { authenticateToken, requireRole, generateToken, AuthRequest } from './middleware/auth';
import { loginSchema, registerSchema, insertVacationRequestSchema, insertMessageSchema } from '@shared/schema';

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth routes
  app.post('/api/auth/register', async (req, res) => {
    try {
      const data = registerSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByUsername(data.username);
      if (existingUser) {
        return res.status(400).json({ message: 'Username already exists' });
      }

      const existingEmail = await storage.getUserByEmail(data.email);
      if (existingEmail) {
        return res.status(400).json({ message: 'Email already exists' });
      }

      // Create company first
      const company = await storage.createCompany({
        name: data.companyName,
      });

      // Hash password
      const hashedPassword = await bcrypt.hash(data.password, 10);

      // Create user
      const user = await storage.createUser({
        username: data.username,
        email: data.email,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        role: 'admin', // First user is admin
        companyId: company.id,
        vacationDaysTotal: data.vacationDaysTotal,
        vacationDaysUsed: data.vacationDaysUsed,
        isActive: data.isActive,
      });

      const token = generateToken({
        id: user.id,
        username: user.username,
        role: user.role,
        companyId: user.companyId,
      });

      res.status(201).json({
        user: { ...user, password: undefined },
        token,
        company,
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const data = loginSchema.parse(req.body);
      
      const user = await storage.getUserByUsername(data.username);
      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const validPassword = await bcrypt.compare(data.password, user.password);
      if (!validPassword) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      if (!user.isActive) {
        return res.status(401).json({ message: 'Account is inactive' });
      }

      const company = await storage.getCompany(user.companyId);

      const token = generateToken({
        id: user.id,
        username: user.username,
        role: user.role,
        companyId: user.companyId,
      });

      res.json({
        user: { ...user, password: undefined },
        token,
        company,
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get('/api/auth/me', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const company = await storage.getCompany(user.companyId);
      
      res.json({
        user: { ...user, password: undefined },
        company,
      });
    } catch (error: any) {
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

  app.post('/api/work-sessions/clock-out', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const activeSession = await storage.getActiveWorkSession(req.user!.id);
      if (!activeSession) {
        return res.status(400).json({ message: 'No active session found' });
      }

      const clockOut = new Date();
      const totalHours = (clockOut.getTime() - activeSession.clockIn.getTime()) / (1000 * 60 * 60);

      const updatedSession = await storage.updateWorkSession(activeSession.id, {
        clockOut,
        totalHours: totalHours.toFixed(2),
        status: 'completed',
      });

      res.json(updatedSession);
    } catch (error: any) {
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
      const sessions = await storage.getWorkSessionsByCompany(req.user!.companyId);
      res.json(sessions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Vacation request routes
  app.post('/api/vacation-requests', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const data = insertVacationRequestSchema.parse({
        ...req.body,
        userId: req.user!.id,
      });

      const request = await storage.createVacationRequest(data);
      res.status(201).json(request);
    } catch (error: any) {
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
      res.json(requests);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch('/api/vacation-requests/:id', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;

      if (!['approved', 'denied'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
      }

      const request = await storage.updateVacationRequest(id, {
        status,
        reviewedBy: req.user!.id,
        reviewedAt: new Date(),
      });

      if (!request) {
        return res.status(404).json({ message: 'Vacation request not found' });
      }

      res.json(request);
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

      const document = await storage.createDocument({
        userId: req.user!.id,
        fileName: req.file.filename,
        originalName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        uploadedBy: req.user!.id,
      });

      res.status(201).json(document);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/documents', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const documents = await storage.getDocumentsByUser(req.user!.id);
      res.json(documents);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/documents/:id/download', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const document = await storage.getDocument(id);

      if (!document) {
        return res.status(404).json({ message: 'Document not found' });
      }

      // Check if user has access to this document
      if (document.userId !== req.user!.id && !['admin', 'manager'].includes(req.user!.role)) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const filePath = path.join(uploadDir, document.fileName);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: 'File not found on server' });
      }

      res.download(filePath, document.originalName);
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

      // Check if user has access to delete this document
      if (document.userId !== req.user!.id && !['admin', 'manager'].includes(req.user!.role)) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const deleted = await storage.deleteDocument(id);
      if (deleted) {
        // Delete physical file
        const filePath = path.join(uploadDir, document.fileName);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        res.json({ message: 'Document deleted successfully' });
      } else {
        res.status(404).json({ message: 'Document not found' });
      }
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
      res.json(messages);
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

  app.post('/api/employees', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
      const { username, email, firstName, lastName, role, password } = req.body;
      
      // Check if user already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: 'Username already exists' });
      }

      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) {
        return res.status(400).json({ message: 'Email already exists' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      const user = await storage.createUser({
        username,
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role: role || 'employee',
        companyId: (req as AuthRequest).user!.companyId,
        vacationDaysTotal: 20,
        vacationDaysUsed: 0,
        isActive: true,
      });

      res.status(201).json({ ...user, password: undefined });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
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
        vacationDaysRemaining: (user?.vacationDaysTotal || 0) - (user?.vacationDaysUsed || 0),
        activeEmployees: employeeCount,
        currentSession: activeSession,
        recentSessions: recentSessions.slice(0, 3),
        unreadMessages: unreadCount,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
