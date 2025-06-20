import type { Express } from "express";
import { createServer, type Server } from "http";
import bcrypt from 'bcrypt';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { storage } from "./storage";
import { authenticateToken, requireRole, generateToken, AuthRequest } from './middleware/auth';
import { loginSchema, companyRegistrationSchema, insertVacationRequestSchema, insertMessageSchema } from '@shared/schema';

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
      const data = companyRegistrationSchema.parse(req.body);
      
      // Check if user already exists by email
      const existingUser = await storage.getUserByEmail(data.companyEmail);
      if (existingUser) {
        return res.status(400).json({ message: 'Email already exists' });
      }

      // Check if company CIF already exists
      const existingCompany = await storage.getCompanyByCif?.(data.cif);
      if (existingCompany) {
        return res.status(400).json({ message: 'CIF already exists' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(data.password, 10);

      // Create company first
      const company = await storage.createCompany({
        name: data.companyName,
        email: data.companyEmail,
        cif: data.cif,
        contactName: data.contactName,
        companyAlias: data.companyAlias,
        phone: data.phone,
        address: data.address,
      });

      // Create admin user
      const user = await storage.createUser({
        companyEmail: data.companyEmail,
        password: hashedPassword,
        fullName: data.adminFullName,
        dni: data.adminDni || 'TEMP-' + Date.now(),
        role: 'admin',
        companyId: company.id,
        companyPhone: data.adminPhoneNumber,
        startDate: new Date(),
        isActive: true,
        totalVacationDays: "30.0", // Default vacation days for admin
        createdBy: null, // First admin user has no creator
      });

      const token = generateToken({
        id: user.id,
        username: user.companyEmail, // Use company email for token compatibility
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
      const { companyAlias } = req.body;
      
      let targetCompanyId = null;
      
      // If companyAlias is provided, get the company and restrict login to that company
      if (companyAlias) {
        const company = await storage.getCompanyByAlias?.(companyAlias);
        if (!company) {
          return res.status(404).json({ message: 'Empresa no encontrada' });
        }
        targetCompanyId = company.id;
      }
      
      // Try to find user by company email first, then by DNI
      let user = await storage.getUserByEmail(data.dniOrEmail);
      
      // If company-specific login, verify user belongs to that company
      if (user && targetCompanyId && user.companyId !== targetCompanyId) {
        user = undefined; // User exists but not in the specified company
      }
      
      if (!user) {
        // Try to find by DNI
        if (targetCompanyId) {
          user = await storage.getUserByDniAndCompany(data.dniOrEmail, targetCompanyId);
        } else {
          user = await storage.getUserByDni(data.dniOrEmail);
        }
      }
      
      if (!user) {
        return res.status(401).json({ message: 'Credenciales inválidas' });
      }

      // Only validate password if we haven't already validated it during multi-user check
      let validPassword = true;
      if (!user.password) {
        // If password validation was done during multi-user check, user object might not have password
        // In this case, we already validated the password
        validPassword = true;
      } else {
        validPassword = await bcrypt.compare(data.password, user.password);
      }
      
      if (!validPassword) {
        return res.status(401).json({ message: 'Credenciales inválidas' });
      }

      if (!user.isActive) {
        return res.status(401).json({ message: 'Cuenta inactiva' });
      }

      const company = await storage.getCompany(user.companyId);

      const token = generateToken({
        id: user.id,
        username: user.companyEmail, // Use company email as username in JWT
        role: user.role,
        companyId: user.companyId,
      });

      res.json({
        message: "Inicio de sesión exitoso",
        user: { ...user, password: undefined },
        token,
        company,
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
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

      // Create default company configuration
      await storage.createCompanyConfig?.({
        companyId: company.id,
        workingHoursStart: '08:00',
        workingHoursEnd: '17:00',
        workingDays: [1, 2, 3, 4, 5],
        payrollSendDays: '1',
        defaultVacationPolicy: '2.5',
        language: 'es',
        timezone: 'Europe/Madrid',
        customAiRules: '',
        allowManagersToGrantRoles: false,
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
        companyPhone: data.adminPhoneNumber || null,
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

  app.patch('/api/work-sessions/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const { clockIn, clockOut } = req.body;

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

      const updatedSession = await storage.updateWorkSession(id, updateData);
      if (!updatedSession) {
        return res.status(404).json({ message: 'Work session not found' });
      }

      res.json(updatedSession);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Vacation request routes
  app.post('/api/vacation-requests', authenticateToken, async (req: AuthRequest, res) => {
    try {
      console.log('Vacation request body:', req.body);
      console.log('User ID:', req.user!.id);
      
      const data = insertVacationRequestSchema.parse({
        ...req.body,
        userId: req.user!.id,
        startDate: new Date(req.body.startDate),
        endDate: new Date(req.body.endDate),
      });

      console.log('Parsed data:', data);
      
      const request = await storage.createVacationRequest(data);
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
      });

      if (!request) {
        return res.status(404).json({ message: 'Vacation request not found' });
      }

      res.json(request);
    } catch (error: any) {
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
      
      // If physical file doesn't exist but it's a demo document, serve a placeholder PDF
      if (!fs.existsSync(filePath) && (document.fileName.includes('nomina') || document.fileName.includes('contrato'))) {
        // Create a simple PDF response for demo purposes
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${document.originalName}"`);
        
        // Send a minimal PDF header - browsers will handle this as a PDF
        const pdfContent = Buffer.from(`%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
/Font <<
/F1 5 0 R
>>
>>
>>
endobj
4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
100 700 Td
(${document.originalName}) Tj
ET
endstream
endobj
5 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000120 00000 n 
0000000290 00000 n 
0000000390 00000 n 
trailer
<<
/Size 6
/Root 1 0 R
>>
startxref
470
%%EOF`);
        
        return res.send(pdfContent);
      }
      
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

  // Get managers for employees to send messages
  app.get('/api/managers', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const employees = await storage.getUsersByCompany(req.user!.companyId);
      const managers = employees.filter(emp => emp.role === 'admin' || emp.role === 'manager');
      const sanitizedManagers = managers.map(mgr => ({ 
        id: mgr.id, 
        fullName: mgr.fullName, 
        email: mgr.companyEmail, 
        role: mgr.role 
      }));
      res.json(sanitizedManagers);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/employees', authenticateToken, requireRole(['admin', 'manager']), async (req, res) => {
    try {
      const { companyEmail, fullName, dni, role, password, companyPhone, startDate, totalVacationDays } = req.body;
      
      // Check if user already exists within the same company by DNI
      const existingUser = await storage.getUserByDniAndCompany(dni, (req as AuthRequest).user!.companyId);
      if (existingUser) {
        return res.status(400).json({ message: 'DNI ya existe en tu empresa' });
      }

      const existingEmail = await storage.getUserByEmail(companyEmail);
      if (existingEmail) {
        return res.status(400).json({ message: 'Email ya existe' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      const user = await storage.createUser({
        companyEmail,
        password: hashedPassword,
        fullName,
        dni,
        role: role || 'employee',
        companyId: (req as AuthRequest).user!.companyId,
        companyPhone: companyPhone || null,
        startDate: startDate ? new Date(startDate) : new Date(),
        isActive: true,
        totalVacationDays: totalVacationDays || "22.0",
        createdBy: (req as AuthRequest).user!.id,
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
      const updatedUser = await storage.updateUser(req.user!.id, updates);
      if (!updatedUser) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json(updatedUser);
    } catch (error: any) {
      console.error('Error updating user profile:', error);
      res.status(500).json({ error: 'Error updating user profile' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
