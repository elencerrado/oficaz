import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { eq, and, or, desc, sql, lte, isNotNull, isNull, inArray, asc } from 'drizzle-orm';
import * as schema from '@shared/schema';
import type {
  Company, User, WorkSession, BreakPeriod, VacationRequest, Document, Message, SystemNotification,
  InsertCompany, InsertUser, InsertWorkSession, InsertBreakPeriod, InsertVacationRequest, InsertDocument, InsertMessage, InsertSystemNotification,
  Reminder, InsertReminder, SuperAdmin, InsertSuperAdmin, 
  Subscription, InsertSubscription, SubscriptionPlan, InsertSubscriptionPlan,
  EmployeeActivationToken, InsertEmployeeActivationToken
} from '@shared/schema';

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const connection = neon(process.env.DATABASE_URL);
const db = drizzle(connection, { schema });

export interface IStorage {
  // Companies
  createCompany(company: InsertCompany): Promise<Company>;
  getCompany(id: number): Promise<Company | undefined>;
  getCompanyByCif?(cif: string): Promise<Company | undefined>;
  getCompanyByEmail?(email: string): Promise<Company | undefined>;
  getCompanyByAlias?(alias: string): Promise<Company | undefined>;
  getCompanyByUserId(userId: number): Promise<any | undefined>;
  getAllCompanies(): Promise<Company[]>;
  updateCompany(id: number, updates: Partial<InsertCompany>): Promise<Company | undefined>;

  // Company configuration is now part of companies table - no separate methods needed

  // Users
  createUser(user: InsertUser): Promise<User>;
  getUser(id: number): Promise<User | undefined>;
  getUserByDni(dni: string): Promise<User | undefined>;
  getUserByDniAndCompany(dni: string, companyId: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsersByCompany(companyId: number): Promise<User[]>;
  updateUser(id: number, updates: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: number): Promise<User | undefined>;

  // Work Sessions
  createWorkSession(session: InsertWorkSession): Promise<WorkSession>;
  getActiveWorkSession(userId: number): Promise<WorkSession | undefined>;
  getWorkSession(id: number): Promise<WorkSession | undefined>;
  updateWorkSession(id: number, updates: Partial<InsertWorkSession>): Promise<WorkSession | undefined>;
  getWorkSessionsByUser(userId: number, limit?: number): Promise<WorkSession[]>;
  getWorkSessionsByCompany(companyId: number): Promise<WorkSession[]>;

  // Break periods
  createBreakPeriod(breakPeriod: InsertBreakPeriod): Promise<BreakPeriod>;
  getActiveBreakPeriod(userId: number): Promise<BreakPeriod | undefined>;
  getBreakPeriodsByUser(userId: number): Promise<BreakPeriod[]>;
  updateBreakPeriod(id: number, updates: Partial<InsertBreakPeriod>): Promise<BreakPeriod | undefined>;
  updateWorkSessionBreakTime(workSessionId: number): Promise<void>;

  // Vacation Requests
  createVacationRequest(request: InsertVacationRequest): Promise<VacationRequest>;
  getVacationRequestsByUser(userId: number): Promise<VacationRequest[]>;
  getVacationRequestsByCompany(companyId: number): Promise<VacationRequest[]>;
  updateVacationRequest(id: number, updates: Partial<InsertVacationRequest>): Promise<VacationRequest | undefined>;

  // Documents
  createDocument(document: InsertDocument): Promise<Document>;
  getDocumentsByUser(userId: number): Promise<Document[]>;
  getDocumentsByCompany(companyId: number): Promise<any[]>;
  getDocument(id: number): Promise<Document | undefined>;
  deleteDocument(id: number): Promise<boolean>;

  // Messages
  createMessage(message: InsertMessage): Promise<Message>;
  getMessagesByUser(userId: number): Promise<Message[]>;
  markMessageAsRead(id: number): Promise<Message | undefined>;
  getUnreadMessageCount(userId: number): Promise<number>;

  // Unified Notifications
  getNotificationsByUser(userId: number): Promise<SystemNotification[]>;
  getNotificationsByCategory(userId: number, category: string): Promise<SystemNotification[]>;
  createNotification(notification: InsertSystemNotification): Promise<SystemNotification>;
  markNotificationRead(id: number): Promise<SystemNotification | undefined>;
  markNotificationCompleted(id: number): Promise<SystemNotification | undefined>;
  getUnreadNotificationCount(userId: number): Promise<number>;
  getUnreadNotificationCountByCategory(userId: number, category: string): Promise<number>;

  // Document Notifications using unified notifications system
  getDocumentNotificationsByUser(userId: number): Promise<SystemNotification[]>;
  getDocumentNotificationsByCompany(companyId: number): Promise<SystemNotification[]>;
  createDocumentNotification(userId: number, documentType: string, message: string, createdBy: number, priority?: string, dueDate?: Date): Promise<SystemNotification>;
  deleteNotification(id: number): Promise<boolean>;

  // Custom Holidays - using any type for now since schema is not fully defined
  getCustomHolidaysByCompany(companyId: number): Promise<any[]>;
  createCustomHoliday(holiday: any): Promise<any>;
  deleteCustomHoliday(id: number): Promise<boolean>;

  // Reminders
  createReminder(reminder: InsertReminder): Promise<Reminder>;
  getRemindersByUser(userId: number): Promise<Reminder[]>;
  getRemindersByCompany(companyId: number): Promise<Reminder[]>;
  getReminder(id: number): Promise<Reminder | undefined>;
  updateReminder(id: number, updates: Partial<InsertReminder>): Promise<Reminder | undefined>;
  deleteReminder(id: number): Promise<boolean>;
  getActiveReminders(userId: number): Promise<Reminder[]>;
  getDashboardReminders(userId: number): Promise<Reminder[]>;
  
  // Reminder Assignments (using array-based approach)
  assignReminderToUsers(reminderId: number, userIds: number[], assignedBy: number): Promise<any>;
  removeUserFromReminderAssignment(reminderId: number, userId: number): Promise<boolean>;
  clearReminderAssignments(reminderId: number): Promise<boolean>;
  getReminderAssignments(reminderId: number): Promise<any[]>;
  getRemindersByUserWithAssignments(userId: number): Promise<any[]>;

  // Employee Activation Tokens
  createActivationToken(token: InsertEmployeeActivationToken): Promise<EmployeeActivationToken>;
  
  // Incomplete Work Sessions Notifications
  createIncompleteSessionNotification(userId: number, workSessionId: number, createdBy: number): Promise<SystemNotification>;
  checkAndCreateIncompleteSessionNotifications(companyId: number): Promise<void>;
  getActivationToken(token: string): Promise<EmployeeActivationToken | undefined>;
  getActivationTokenByUserId(userId: number): Promise<EmployeeActivationToken | undefined>;
  markTokenAsUsed(id: number): Promise<EmployeeActivationToken | undefined>;
  deleteActivationToken(id: number): Promise<boolean>;
  cleanupExpiredTokens(): Promise<number>;

  // Super Admin operations
  getSuperAdminByEmail(email: string): Promise<SuperAdmin | undefined>;
  createSuperAdmin(admin: InsertSuperAdmin): Promise<SuperAdmin>;
  getAllCompaniesWithStats(): Promise<any[]>;
  getSuperAdminStats(): Promise<any>;
  createSubscription(subscription: InsertSubscription): Promise<Subscription>;
  getSubscriptionByCompanyId(companyId: number): Promise<Subscription | undefined>;
  updateCompanySubscription(companyId: number, updates: any): Promise<any | undefined>;

  // Subscription Plans operations
  getAllSubscriptionPlans(): Promise<SubscriptionPlan[]>;
  getSubscriptionPlan(id: number): Promise<SubscriptionPlan | undefined>;
  createSubscriptionPlan(plan: InsertSubscriptionPlan): Promise<SubscriptionPlan>;
  updateSubscriptionPlan(id: number, updates: Partial<InsertSubscriptionPlan>): Promise<SubscriptionPlan | undefined>;
  deleteSubscriptionPlan(id: number): Promise<boolean>;

  // Registration Settings operations
  getRegistrationSettings(): Promise<any>;
  updateRegistrationSettings(updates: any): Promise<any>;
  
  // Invitation Links operations  
  createInvitationLink(invitation: any): Promise<any>;
  getInvitationByToken(token: string): Promise<any>;
  getActiveInvitationByEmail(email: string): Promise<any>;
  getAllInvitationLinks(): Promise<any[]>;
  deleteInvitationLink(id: number): Promise<boolean>;
  markInvitationAsUsed(id: number): Promise<boolean>;
  
  // Features operations
  getCompanyFeatures(companyId: number, planName: string): Promise<any>;
}

export class DrizzleStorage implements IStorage {
  // Companies
  async createCompany(company: InsertCompany): Promise<Company> {
    const [result] = await db.insert(schema.companies).values(company).returning();
    return result;
  }

  async getCompany(id: number): Promise<Company | undefined> {
    const [company] = await db.select().from(schema.companies).where(eq(schema.companies.id, id));
    return company;
  }

  async getAllCompanies(): Promise<Company[]> {
    return await db.select().from(schema.companies);
  }

  async updateCompany(id: number, updates: Partial<InsertCompany>): Promise<Company | undefined> {
    const [updatedCompany] = await db
      .update(schema.companies)
      .set(updates)
      .where(eq(schema.companies.id, id))
      .returning();
    return updatedCompany || undefined;
  }

  async getCompanyByCif(cif: string): Promise<Company | undefined> {
    const [company] = await db.select().from(schema.companies).where(eq(schema.companies.cif, cif));
    return company;
  }

  async getCompanyByEmail(email: string): Promise<Company | undefined> {
    const [company] = await db.select().from(schema.companies).where(eq(schema.companies.email, email));
    return company;
  }

  async getCompanyByAlias(alias: string): Promise<Company | undefined> {
    const [company] = await db.select().from(schema.companies).where(eq(schema.companies.companyAlias, alias));
    return company;
  }

  // Company configuration methods are no longer needed - configuration is now part of companies table

  // Users
  async createUser(user: InsertUser): Promise<User> {
    const [result] = await db.insert(schema.users).values(user).returning();
    return result;
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id));
    return user;
  }

  async getUserByDni(dni: string): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users).where(sql`UPPER(${schema.users.dni}) = UPPER(${dni})`);
    return user;
  }

  async getUserByDniAndCompany(dni: string, companyId: number): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users)
      .where(and(sql`UPPER(${schema.users.dni}) = UPPER(${dni})`, eq(schema.users.companyId, companyId)));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    // First try company email
    let [user] = await db.select().from(schema.users).where(sql`LOWER(${schema.users.companyEmail}) = LOWER(${email})`);
    
    // If not found, try personal email
    if (!user) {
      [user] = await db.select().from(schema.users).where(sql`LOWER(${schema.users.personalEmail}) = LOWER(${email})`);
    }
    
    return user;
  }

  async getUsersByCompany(companyId: number): Promise<User[]> {
    console.log(`🔍 DEBUG getUsersByCompany: Looking for users with companyId=${companyId}`);
    const result = await db.select().from(schema.users).where(eq(schema.users.companyId, companyId));
    console.log(`🔍 DEBUG getUsersByCompany: Found ${result.length} users:`, result.map(u => ({ id: u.id, name: u.fullName, role: u.role })));
    return result;
  }

  async updateUser(id: number, updates: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db.update(schema.users).set(updates).where(eq(schema.users.id, id)).returning();
    return user;
  }

  async deleteUser(id: number): Promise<User | undefined> {
    const [user] = await db.delete(schema.users).where(eq(schema.users.id, id)).returning();
    return user;
  }

  // Calculate vacation days based on start date and company policy
  async calculateVacationDays(userId: number): Promise<number> {
    const user = await this.getUser(userId);
    if (!user) return 0;

    const company = await this.getCompany(user.companyId);
    const defaultDaysPerMonth = parseFloat(company?.defaultVacationPolicy || '2.5');
    const userDaysPerMonth = user.vacationDaysPerMonth ? parseFloat(user.vacationDaysPerMonth) : defaultDaysPerMonth;
    
    const startDate = new Date(user.startDate);
    const currentDate = new Date();
    
    // Calculate months worked (including partial months)
    const monthsWorked = (currentDate.getFullYear() - startDate.getFullYear()) * 12 + 
                         (currentDate.getMonth() - startDate.getMonth()) + 
                         (currentDate.getDate() >= startDate.getDate() ? 1 : 0);
    
    const calculatedDays = Math.round((monthsWorked * userDaysPerMonth) * 10) / 10;
    const adjustment = parseFloat(user.vacationDaysAdjustment || '0');
    
    return Math.max(0, calculatedDays + adjustment);
  }

  // Update user's vacation days automatically
  async updateUserVacationDays(userId: number): Promise<User | undefined> {
    const calculatedDays = await this.calculateVacationDays(userId);
    return this.updateUser(userId, { totalVacationDays: calculatedDays.toString() });
  }

  // Work Sessions
  async createWorkSession(session: InsertWorkSession): Promise<WorkSession> {
    const [result] = await db.insert(schema.workSessions).values(session).returning();
    return result;
  }

  async getActiveWorkSession(userId: number): Promise<WorkSession | undefined> {
    // First check for active sessions from today
    const [activeSession] = await db.select().from(schema.workSessions)
      .where(and(eq(schema.workSessions.userId, userId), eq(schema.workSessions.status, 'active')));
    
    if (activeSession) {
      return activeSession;
    }
    
    // If no active session, check for incomplete sessions (sessions that need to be closed)
    const [incompleteSession] = await db.select().from(schema.workSessions)
      .where(and(
        eq(schema.workSessions.userId, userId), 
        eq(schema.workSessions.status, 'incomplete'),
        isNull(schema.workSessions.clockOut)
      ))
      .orderBy(asc(schema.workSessions.clockIn));
    
    return incompleteSession;
  }

  async getWorkSession(id: number): Promise<WorkSession | undefined> {
    const [session] = await db.select().from(schema.workSessions)
      .where(eq(schema.workSessions.id, id))
      .limit(1);
    return session;
  }

  async updateWorkSession(id: number, updates: Partial<InsertWorkSession>): Promise<WorkSession | undefined> {
    const [session] = await db.update(schema.workSessions).set(updates).where(eq(schema.workSessions.id, id)).returning();
    return session;
  }

  async getWorkSessionsByUser(userId: number, limit = 1000): Promise<WorkSession[]> {
    return db.select().from(schema.workSessions)
      .where(eq(schema.workSessions.userId, userId))
      .orderBy(desc(schema.workSessions.clockIn))
      .limit(limit);
  }

  async getWorkSessionsByCompany(companyId: number, limit: number = 100, offset: number = 0): Promise<WorkSession[]> {
    // Optimized single query to get sessions with user info
    const sessions = await db.select({
      id: schema.workSessions.id,
      userId: schema.workSessions.userId,
      clockIn: schema.workSessions.clockIn,
      clockOut: schema.workSessions.clockOut,
      totalHours: schema.workSessions.totalHours,
      totalBreakTime: schema.workSessions.totalBreakTime,
      status: schema.workSessions.status,
      autoCompleted: schema.workSessions.autoCompleted,
      createdAt: schema.workSessions.createdAt,
      userName: schema.users.fullName,
      profilePicture: schema.users.profilePicture,
    }).from(schema.workSessions)
      .innerJoin(schema.users, eq(schema.workSessions.userId, schema.users.id))
      .where(eq(schema.users.companyId, companyId))
      .orderBy(desc(schema.workSessions.createdAt))
      .limit(limit)
      .offset(offset);

    // If no sessions, return empty array immediately
    if (sessions.length === 0) {
      return [];
    }

    // Get all session IDs for batch break periods query
    const sessionIds = sessions.map(s => s.id);
    
    // Single optimized query for all break periods
    const allBreakPeriods = await db.select().from(schema.breakPeriods)
      .where(inArray(schema.breakPeriods.workSessionId, sessionIds))
      .orderBy(schema.breakPeriods.workSessionId, schema.breakPeriods.breakStart);

    // Group break periods by session ID for O(1) lookup
    const breakPeriodsMap = new Map<number, any[]>();
    allBreakPeriods.forEach(bp => {
      if (!breakPeriodsMap.has(bp.workSessionId)) {
        breakPeriodsMap.set(bp.workSessionId, []);
      }
      breakPeriodsMap.get(bp.workSessionId)!.push(bp);
    });

    // Combine sessions with their break periods efficiently
    return sessions.map(session => ({
      ...session,
      breakPeriods: breakPeriodsMap.get(session.id) || []
    }));
  }

  // Break Periods
  async createBreakPeriod(breakPeriod: InsertBreakPeriod): Promise<BreakPeriod> {
    const [result] = await db.insert(schema.breakPeriods).values(breakPeriod).returning();
    return result;
  }

  async getActiveBreakPeriod(userId: number): Promise<BreakPeriod | undefined> {
    const [breakPeriod] = await db.select().from(schema.breakPeriods)
      .where(and(eq(schema.breakPeriods.userId, userId), eq(schema.breakPeriods.status, 'active')));
    return breakPeriod;
  }

  async updateBreakPeriod(id: number, updates: Partial<InsertBreakPeriod>): Promise<BreakPeriod | undefined> {
    const [breakPeriod] = await db.update(schema.breakPeriods).set(updates).where(eq(schema.breakPeriods.id, id)).returning();
    return breakPeriod;
  }

  async updateWorkSessionBreakTime(workSessionId: number): Promise<void> {
    // Calculate total break time for this work session
    const breakPeriods = await db.select().from(schema.breakPeriods)
      .where(and(
        eq(schema.breakPeriods.workSessionId, workSessionId),
        eq(schema.breakPeriods.status, 'completed')
      ));

    // Sum up all break durations
    const totalBreakTime = breakPeriods.reduce((total, period) => {
      return total + (parseFloat(period.duration || '0'));
    }, 0);

    // Update the work session with total break time
    await db.update(schema.workSessions)
      .set({ totalBreakTime: totalBreakTime.toFixed(2) })
      .where(eq(schema.workSessions.id, workSessionId));
  }

  async getBreakPeriodsByUser(userId: number): Promise<BreakPeriod[]> {
    const breakPeriods = await db.select().from(schema.breakPeriods)
      .where(eq(schema.breakPeriods.userId, userId))
      .orderBy(desc(schema.breakPeriods.breakStart));
    return breakPeriods;
  }

  // Vacation Requests
  async createVacationRequest(request: InsertVacationRequest): Promise<VacationRequest> {
    const [result] = await db.insert(schema.vacationRequests).values(request).returning();
    return result;
  }

  async getVacationRequestsByUser(userId: number): Promise<VacationRequest[]> {
    return db.select().from(schema.vacationRequests)
      .where(eq(schema.vacationRequests.userId, userId))
      .orderBy(desc(schema.vacationRequests.createdAt));
  }

  async getVacationRequestsByCompany(companyId: number): Promise<VacationRequest[]> {
    const result = await db.select({
      id: schema.vacationRequests.id,
      userId: schema.vacationRequests.userId,
      startDate: schema.vacationRequests.startDate,
      endDate: schema.vacationRequests.endDate,
      reason: schema.vacationRequests.reason,
      status: schema.vacationRequests.status,
      reviewedBy: schema.vacationRequests.reviewedBy,
      reviewedAt: schema.vacationRequests.reviewedAt,
      createdAt: schema.vacationRequests.createdAt,
      // User information
      userFullName: schema.users.fullName,
      userEmail: schema.users.companyEmail
    }).from(schema.vacationRequests)
      .innerJoin(schema.users, eq(schema.vacationRequests.userId, schema.users.id))
      .where(eq(schema.users.companyId, companyId))
      .orderBy(desc(schema.vacationRequests.createdAt));
    
    // Transform the result to include user object and handle missing fields
    return result.map(request => ({
      id: request.id,
      userId: request.userId,
      startDate: request.startDate,
      endDate: request.endDate,
      days: 0, // Calculate or default
      reason: request.reason,
      status: request.status,
      requestDate: request.createdAt || new Date().toISOString(), // Use createdAt as requestDate
      approvedBy: request.reviewedBy,
      approvedDate: request.reviewedAt,
      createdAt: request.createdAt,
      updatedAt: request.createdAt,
      user: {
        fullName: request.userFullName,
        email: request.userEmail
      }
    })) as any;
  }

  async updateVacationRequest(id: number, updates: Partial<InsertVacationRequest>): Promise<VacationRequest | undefined> {
    const [request] = await db.update(schema.vacationRequests).set(updates).where(eq(schema.vacationRequests.id, id)).returning();
    return request;
  }

  // Documents
  async createDocument(document: InsertDocument): Promise<Document> {
    const [result] = await db.insert(schema.documents).values(document).returning();
    return result;
  }

  async getDocumentsByUser(userId: number): Promise<Document[]> {
    return db.select().from(schema.documents)
      .where(eq(schema.documents.userId, userId))
      .orderBy(desc(schema.documents.createdAt));
  }

  async getDocumentsByCompany(companyId: number): Promise<any[]> {
    // Simple query using SQL to avoid Drizzle issues
    const result = await db.execute(sql`
      SELECT 
        d.id,
        d.user_id as "userId",
        d.file_name as "fileName", 
        d.original_name as "originalName",
        d.file_size as "fileSize",
        d.created_at as "createdAt",
        u.full_name as "userFullName"
      FROM documents d 
      LEFT JOIN users u ON d.user_id = u.id 
      WHERE u.company_id = ${companyId}
      ORDER BY d.created_at DESC
    `);
    
    // Transform to expected format
    return result.rows.map((row: any) => ({
      id: row.id,
      userId: row.userId,
      fileName: row.fileName,
      originalName: row.originalName,
      fileSize: row.fileSize,
      createdAt: row.createdAt,
      user: {
        fullName: row.userFullName || 'Usuario desconocido'
      }
    }));
  }

  async getDocument(id: number): Promise<Document | undefined> {
    const [document] = await db.select().from(schema.documents).where(eq(schema.documents.id, id));
    return document;
  }

  async deleteDocument(id: number): Promise<boolean> {
    const result = await db.delete(schema.documents).where(eq(schema.documents.id, id));
    return result.rowCount > 0;
  }

  // Messages
  async createMessage(message: InsertMessage): Promise<Message> {
    const [result] = await db.insert(schema.messages).values(message).returning();
    return result;
  }

  async getMessagesByUser(userId: number): Promise<Message[]> {
    return db.select().from(schema.messages)
      .where(or(eq(schema.messages.receiverId, userId), eq(schema.messages.senderId, userId)))
      .orderBy(desc(schema.messages.createdAt));
  }

  async markMessageAsRead(id: number): Promise<Message | undefined> {
    const [message] = await db.update(schema.messages)
      .set({ isRead: true })
      .where(eq(schema.messages.id, id))
      .returning();
    return message;
  }

  async getUnreadMessageCount(userId: number): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)` })
      .from(schema.messages)
      .where(and(eq(schema.messages.receiverId, userId), eq(schema.messages.isRead, false)));
    return result.count;
  }

  // Document Notifications methods using unified notifications
  async getDocumentNotificationsByUser(userId: number): Promise<SystemNotification[]> {
    return await db.select().from(schema.systemNotifications)
      .where(and(
        eq(schema.systemNotifications.userId, userId),
        eq(schema.systemNotifications.type, 'document')
      ))
      .orderBy(desc(schema.systemNotifications.createdAt));
  }

  async getDocumentNotificationsByCompany(companyId: number): Promise<SystemNotification[]> {
    const results = await db.execute(sql`
      SELECT 
        n.*,
        u.full_name as "userFullName",
        d.id as "documentId",
        d.original_name as "documentOriginalName",
        d.file_size as "documentFileSize",
        d.created_at as "documentCreatedAt"
      FROM notifications n
      LEFT JOIN users u ON n.user_id = u.id  
      LEFT JOIN documents d ON (
        d.user_id = n.user_id AND 
        d.created_at > n.created_at AND
        n.is_completed = true
      )
      WHERE u.company_id = ${companyId} AND n.type = 'document'
      ORDER BY n.created_at DESC
    `);

    return results.rows.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      type: row.type,
      category: row.category,
      title: row.title,
      message: row.message,
      actionUrl: row.action_url,
      dueDate: row.due_date,
      priority: row.priority,
      isRead: row.is_read,
      isCompleted: row.is_completed,
      metadata: row.metadata,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      // Add user information for frontend
      user: row.userFullName ? { fullName: row.userFullName } : undefined,
      // Add document information when available
      document: row.documentId ? {
        id: row.documentId,
        originalName: row.documentOriginalName,
        fileSize: row.documentFileSize,
        createdAt: row.documentCreatedAt
      } : undefined,
      // Add documentType from metadata for frontend compatibility
      documentType: (() => {
        try {
          const metadata = row.metadata ? JSON.parse(row.metadata) : {};
          return metadata.documentType || row.title?.replace('Documento solicitado: ', '') || 'Documento';
        } catch {
          return row.title?.replace('Documento solicitado: ', '') || 'Documento';
        }
      })()
    })) as SystemNotification[];
  }

  async createDocumentNotification(userId: number, documentType: string, message: string, createdBy: number, priority: string = 'medium', dueDate?: Date): Promise<SystemNotification> {
    const notification: InsertSystemNotification = {
      userId,
      type: 'document',
      category: 'documents',
      title: `Documento solicitado: ${documentType}`,
      message,
      priority,
      dueDate,
      isRead: false,
      isCompleted: false,
      metadata: JSON.stringify({ documentType }),
      createdBy
    };
    
    const [result] = await db
      .insert(schema.systemNotifications)
      .values(notification)
      .returning();
    return result;
  }

  async markNotificationCompleted(id: number): Promise<SystemNotification | undefined> {
    const [result] = await db.update(schema.systemNotifications)
      .set({ isCompleted: true, updatedAt: new Date() })
      .where(eq(schema.systemNotifications.id, id))
      .returning();
    return result;
  }

  async deleteNotification(id: number): Promise<boolean> {
    const result = await db.delete(schema.systemNotifications)
      .where(eq(schema.systemNotifications.id, id));
    return result.rowCount > 0;
  }

  // Unified Notifications implementation
  async getNotificationsByUser(userId: number): Promise<SystemNotification[]> {
    return await db.select().from(schema.systemNotifications)
      .where(eq(schema.systemNotifications.userId, userId))
      .orderBy(desc(schema.systemNotifications.createdAt));
  }

  async getNotificationsByCategory(userId: number, category: string): Promise<SystemNotification[]> {
    return await db.select().from(schema.systemNotifications)
      .where(and(
        eq(schema.systemNotifications.userId, userId),
        eq(schema.systemNotifications.category, category)
      ))
      .orderBy(desc(schema.systemNotifications.createdAt));
  }

  async createNotification(notification: InsertSystemNotification): Promise<SystemNotification> {
    const [result] = await db.insert(schema.systemNotifications).values(notification).returning();
    return result;
  }

  async markNotificationRead(id: number): Promise<SystemNotification | undefined> {
    const [result] = await db.update(schema.systemNotifications)
      .set({ isRead: true, updatedAt: new Date() })
      .where(eq(schema.systemNotifications.id, id))
      .returning();
    return result;
  }

  async markNotificationCompletedUnified(id: number): Promise<SystemNotification | undefined> {
    const [result] = await db.update(schema.systemNotifications)
      .set({ isCompleted: true, updatedAt: new Date() })
      .where(eq(schema.systemNotifications.id, id))
      .returning();
    return result;
  }

  async getUnreadNotificationCount(userId: number): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)` })
      .from(schema.systemNotifications)
      .where(and(
        eq(schema.systemNotifications.userId, userId),
        eq(schema.systemNotifications.isRead, false)
      ));
    return result.count;
  }

  async getUnreadNotificationCountByCategory(userId: number, category: string): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)` })
      .from(schema.systemNotifications)
      .where(and(
        eq(schema.systemNotifications.userId, userId),
        eq(schema.systemNotifications.category, category),
        eq(schema.systemNotifications.isRead, false)
      ));
    return result.count;
  }

  // Super Admin operations
  async getSuperAdminByEmail(email: string): Promise<any | undefined> {
    const [admin] = await db.select().from(schema.superAdmins).where(eq(schema.superAdmins.email, email));
    return admin;
  }

  async createSuperAdmin(admin: any): Promise<any> {
    const [newAdmin] = await db.insert(schema.superAdmins).values(admin).returning();
    return newAdmin;
  }

  async getAllCompaniesWithStats(): Promise<any[]> {
    const result = await db
      .select({
        id: schema.companies.id,
        name: schema.companies.name,
        cif: schema.companies.cif,
        email: schema.companies.email,
        alias: schema.companies.companyAlias,
        createdAt: schema.companies.createdAt,
        userCount: sql<number>`count(${schema.users.id})`.as('userCount'),
        subscriptionPlan: schema.subscriptions.plan,
        subscriptionStatus: schema.subscriptions.status,
        subscriptionMaxUsers: schema.subscriptions.maxUsers,
        subscriptionEndDate: schema.subscriptions.endDate,
      })
      .from(schema.companies)
      .leftJoin(schema.users, eq(schema.companies.id, schema.users.companyId))
      .leftJoin(schema.subscriptions, eq(schema.companies.id, schema.subscriptions.companyId))
      .groupBy(schema.companies.id, schema.subscriptions.id);

    return result.map(row => ({
      id: row.id,
      name: row.name,
      cif: row.cif,
      email: row.email,
      alias: row.alias,
      userCount: row.userCount || 0,
      subscription: {
        plan: row.subscriptionPlan || 'basic',
        status: row.subscriptionStatus || 'active',
        maxUsers: row.subscriptionMaxUsers || 5,
        endDate: row.subscriptionEndDate?.toISOString(),
      },
      createdAt: row.createdAt?.toISOString() || new Date().toISOString(),
    }));
  }

  async getSuperAdminStats(): Promise<any> {
    // Total companies registered
    const companiesCount = await db.select({ count: sql<number>`count(*)` }).from(schema.companies);
    
    // Total active users across all companies
    const usersCount = await db.select({ count: sql<number>`count(*)` }).from(schema.users);
    
    // Get subscription stats with active status filter
    const subscriptionStats = await db
      .select({
        plan: schema.subscriptions.plan,
        status: schema.subscriptions.status,
        count: sql<number>`count(*)`,
      })
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.status, 'active'))
      .groupBy(schema.subscriptions.plan, schema.subscriptions.status);

    const planCounts = subscriptionStats.reduce((acc, row) => {
      acc[row.plan as keyof typeof acc] = row.count;
      return acc;
    }, { free: 0, basic: 0, pro: 0, master: 0 });

    // Calculate active paid subscriptions (excluding free)
    const activePaidSubscriptions = subscriptionStats.reduce((acc, row) => {
      if (row.plan !== 'free' && row.status === 'active') {
        acc += row.count;
      }
      return acc;
    }, 0);

    // Get real pricing from subscription_plans table
    const planPricing = await db.select({
      name: schema.subscriptionPlans.name,
      monthlyPrice: schema.subscriptionPlans.monthlyPrice
    }).from(schema.subscriptionPlans);

    const pricing = planPricing.reduce((acc, plan) => {
      acc[plan.name] = Number(plan.monthlyPrice);
      return acc;
    }, {} as Record<string, number>);

    // Calculate monthly revenue using plan prices (not per user)
    const monthlyRevenue = subscriptionStats.reduce((acc, row) => {
      if (row.plan !== 'free' && row.status === 'active') {
        const planPrice = pricing[row.plan] || 0;
        acc += planPrice * row.count; // Each subscription pays the full plan price
      }
      return acc;
    }, 0);

    const yearlyRevenue = monthlyRevenue * 12;

    return {
      totalCompanies: companiesCount[0]?.count || 0,
      totalUsers: usersCount[0]?.count || 0,
      activePaidSubscriptions,
      monthlyRevenue,
      yearlyRevenue,
      planDistribution: planCounts,
      // Legacy field for backward compatibility
      activeSubscriptions: activePaidSubscriptions,
      revenue: monthlyRevenue,
    };
  }

  async createSubscription(subscription: any): Promise<any> {
    const [newSubscription] = await db.insert(schema.subscriptions).values(subscription).returning();
    return newSubscription;
  }

  async getSubscriptionByCompanyId(companyId: number): Promise<any | undefined> {
    const [subscription] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.companyId, companyId));
    
    if (!subscription) {
      return undefined;
    }

    // Get the plan from subscription_plans table
    const [plan] = await db.select().from(schema.subscriptionPlans).where(eq(schema.subscriptionPlans.name, subscription.plan));
    
    if (!plan) {
      console.warn(`Plan ${subscription.plan} not found in subscription_plans table`);
      return subscription;
    }

    // Get company created_at date and custom_features to override plan features
    const [company] = await db.select({
      createdAt: schema.companies.createdAt,
      customFeatures: schema.companies.customFeatures
    }).from(schema.companies).where(eq(schema.companies.id, companyId));

    if (!company?.createdAt) {
      console.warn(`Company ${companyId} has no createdAt date`);
      return subscription;
    }

    // Calculate trial dates from companies.created_at (single source of truth)
    const registrationDate = new Date(company.createdAt);
    const trialEndDate = new Date(registrationDate);
    // Use default trial duration of 14 days
    const trialDuration = 14;
    trialEndDate.setDate(trialEndDate.getDate() + trialDuration);

    // Determine effective plan for features
    // If there's a planned downgrade, use currentEffectivePlan until the change date
    // Otherwise use the regular plan
    let effectivePlan = subscription.currentEffectivePlan || subscription.plan;
    
    // Check if we should apply plan change (if plan_change_date has passed)
    if (subscription.planChangeDate && subscription.nextPlan) {
      const changeDate = new Date(subscription.planChangeDate);
      const now = new Date();
      if (now >= changeDate) {
        // The change date has passed, apply the next plan
        effectivePlan = subscription.nextPlan;
      }
    }
    
    // Get features from features table based on effective plan
    const allFeatures = await db.select().from(schema.features);
    let finalFeatures: any = {};
    
    // Build features object based on effective plan - use column names like basicEnabled, proEnabled, masterEnabled
    for (const feature of allFeatures) {
      const planColumnName = `${effectivePlan}Enabled` as keyof typeof feature;
      const isEnabled = feature[planColumnName] as boolean;
      
      // Map display names to internal names
      let featureName = '';
      switch (feature.name) {
        case 'Control horario':
          featureName = 'time';
          break;
        case 'Gestión de vacaciones':
          featureName = 'vacation';
          break;
        case 'Notificaciones':
          featureName = 'notifications';
          break;
        case 'Mensajería interna':
          featureName = 'messages';
          break;
        case 'Gestión de documentos':
          featureName = 'documents';
          break;
        case 'Recordatorios':
          featureName = 'reminders';
          break;
        case 'Subida de logo empresarial':
          featureName = 'logoUpload';
          break;
        case 'Informes y estadísticas':
          featureName = 'reports';
          break;
        case 'Permisos de edición de tiempo empleados':
          featureName = 'employee_time_edit_permission';
          break;
        case 'employee_time_edit':
          featureName = 'employee_time_edit';
          break;
        default:
          continue; // Skip unknown features
      }
      
      if (featureName) {
        finalFeatures[featureName] = isEnabled;
      }
    }

    // Apply company custom_features overrides if they exist
    if (company?.customFeatures && typeof company.customFeatures === 'object') {
      // Custom features should override plan features
      // Format: { "employee_time_edit": true, "reports": false, etc }
      finalFeatures = {
        ...finalFeatures,
        ...company.customFeatures
      };
    }

    return {
      ...subscription,
      maxUsers: plan.maxUsers,
      features: finalFeatures,
      // Add calculated dates from companies.created_at
      startDate: registrationDate.toISOString(),
      trialStartDate: registrationDate.toISOString(),
      trialEndDate: trialEndDate.toISOString(),
    };
  }

  async getCompanyFeatures(companyId: number, planName: string): Promise<any> {
    // Get the plan ID
    const [plan] = await db.select().from(schema.subscriptionPlans).where(eq(schema.subscriptionPlans.name, planName));
    
    if (!plan) {
      return {};
    }

    // Get the company to check for custom features
    const [company] = await db.select().from(schema.companies).where(eq(schema.companies.id, companyId));
    
    if (!company) {
      return {};
    }

    // Check if company has custom features configured
    if (company.customFeatures && Object.keys(company.customFeatures).length > 0) {
      // Return custom features configured for this company
      return company.customFeatures;
    }

    // For companies without custom features, get default plan features from columns
    const planColumn = planName === 'basic' ? 'basicEnabled' : 
                      planName === 'pro' ? 'proEnabled' : 
                      planName === 'master' ? 'masterEnabled' : 'basicEnabled';
    
    const featuresData = await db
      .select({
        key: schema.features.key,
        isEnabled: planName === 'basic' ? schema.features.basicEnabled :
                  planName === 'pro' ? schema.features.proEnabled :
                  planName === 'master' ? schema.features.masterEnabled :
                  schema.features.basicEnabled,
      })
      .from(schema.features)
      .where(eq(schema.features.isActive, true));

    const features: any = {};
    featuresData.forEach(feature => {
      if (feature.isEnabled) {
        features[feature.key] = true;
      }
    });

    return features;
  }

  async updateCompanySubscription(companyId: number, updates: any): Promise<any | undefined> {
    const [subscription] = await db
      .update(schema.subscriptions)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(schema.subscriptions.companyId, companyId))
      .returning();
    
    return subscription;
  }

  // Subscription Plans operations
  async getAllSubscriptionPlans(): Promise<any[]> {
    const plans = await db.select().from(schema.subscriptionPlans).orderBy(schema.subscriptionPlans.monthlyPrice);
    
    // Add features to each plan from direct columns in features table
    const plansWithFeatures = await Promise.all(plans.map(async (plan) => {
      const planName = plan.name.toLowerCase();
      
      const featuresData = await db
        .select({
          key: schema.features.key,
          isEnabled: planName === 'basic' ? schema.features.basicEnabled :
                    planName === 'pro' ? schema.features.proEnabled :
                    planName === 'master' ? schema.features.masterEnabled :
                    schema.features.basicEnabled,
        })
        .from(schema.features)
        .where(eq(schema.features.isActive, true));

      const features: any = {};
      featuresData.forEach(feature => {
        features[feature.key] = feature.isEnabled;
      });

      return {
        ...plan,
        monthlyPrice: parseFloat(plan.monthlyPrice) || 0, // Convert string to number
        features
      };
    }));
    
    return plansWithFeatures;
  }

  async getSubscriptionPlan(id: number): Promise<any | undefined> {
    const [plan] = await db.select().from(schema.subscriptionPlans).where(eq(schema.subscriptionPlans.id, id));
    return plan;
  }

  async createSubscriptionPlan(plan: any): Promise<any> {
    const [newPlan] = await db.insert(schema.subscriptionPlans).values(plan).returning();
    return newPlan;
  }

  async updateSubscriptionPlan(id: number, updates: any): Promise<any | undefined> {
    const [plan] = await db
      .update(schema.subscriptionPlans)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.subscriptionPlans.id, id))
      .returning();
    
    // Features are now managed dynamically from features table
    
    return plan;
  }

  async deleteSubscriptionPlan(id: number): Promise<boolean> {
    const result = await db.delete(schema.subscriptionPlans).where(eq(schema.subscriptionPlans.id, id));
    return result.rowCount > 0;
  }

  // Features operations
  async getAllFeatures(): Promise<any[]> {
    try {
      const features = await db.select().from(schema.features)
        .where(eq(schema.features.isActive, true))
        .orderBy(schema.features.category, schema.features.name);
      return features || [];
    } catch (error) {
      console.error('Storage: error in getAllFeatures:', error);
      return [];
    }
  }

  async updateFeature(id: number, updates: any): Promise<any | undefined> {
    const [feature] = await db
      .update(schema.features)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.features.id, id))
      .returning();
    return feature;
  }

  // Reminders operations
  async createReminder(reminder: any): Promise<any> {
    const [newReminder] = await db.insert(schema.reminders).values({
      ...reminder,
      createdBy: reminder.userId,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    return newReminder;
  }

  async getRemindersByUser(userId: number): Promise<any[]> {
    // Use the new function that includes assignments
    return await this.getRemindersByUserWithAssignments(userId);
  }

  async getRemindersByCompany(companyId: number): Promise<any[]> {
    return await db.select({
      id: schema.reminders.id,
      userId: schema.reminders.userId,
      companyId: schema.reminders.companyId,
      title: schema.reminders.title,
      content: schema.reminders.content,
      reminderDate: schema.reminders.reminderDate,
      priority: schema.reminders.priority,
      color: schema.reminders.color,
      isCompleted: schema.reminders.isCompleted,
      isArchived: schema.reminders.isArchived,
      isPinned: schema.reminders.isPinned,
      notificationShown: schema.reminders.notificationShown,
      showBanner: schema.reminders.showBanner,
      assignedUserIds: schema.reminders.assignedUserIds,
      assignedBy: schema.reminders.assignedBy,
      assignedAt: schema.reminders.assignedAt,
      createdBy: schema.reminders.createdBy,
      createdAt: schema.reminders.createdAt,
      updatedAt: schema.reminders.updatedAt,
      userFullName: schema.users.fullName
    })
    .from(schema.reminders)
    .leftJoin(schema.users, eq(schema.reminders.userId, schema.users.id))
    .where(eq(schema.reminders.companyId, companyId))
    .orderBy(schema.reminders.isPinned, schema.reminders.reminderDate, schema.reminders.createdAt);
  }

  async getReminder(id: number): Promise<any | undefined> {
    const [reminder] = await db.select().from(schema.reminders).where(eq(schema.reminders.id, id));
    return reminder;
  }

  async updateReminder(id: number, updates: any): Promise<any | undefined> {
    // Process the updates to ensure proper date handling
    const processedUpdates = { ...updates };
    
    // Handle reminder date conversion and null values
    if (processedUpdates.reminderDate !== undefined) {
      if (processedUpdates.reminderDate === null || processedUpdates.reminderDate === '') {
        processedUpdates.reminderDate = null;
      } else if (typeof processedUpdates.reminderDate === 'string') {
        processedUpdates.reminderDate = new Date(processedUpdates.reminderDate);
      }
    }
    
    // Ensure updatedAt is always a Date object
    processedUpdates.updatedAt = new Date();
    
    const [reminder] = await db
      .update(schema.reminders)
      .set(processedUpdates)
      .where(eq(schema.reminders.id, id))
      .returning();
    return reminder;
  }

  async deleteReminder(id: number): Promise<boolean> {
    try {
      // Delete the reminder (assignments are now stored in array columns, no separate table)
      const result = await db.delete(schema.reminders).where(eq(schema.reminders.id, id));
      return result.rowCount > 0;
    } catch (error) {
      console.error('Storage: error in deleteReminder:', error);
      return false;
    }
  }

  async getActiveReminders(userId: number): Promise<any[]> {
    const now = new Date();
    const nextWeek = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000)); // 7 days from now
    
    // ⚠️ PROTECTED - CRITICAL BANNER LOGIC - DO NOT MODIFY
    // Query reminders for BANNER display: includes OWN reminders + ASSIGNED reminders with showBanner=true
    const activeReminders = await db.select({
      id: schema.reminders.id,
      userId: schema.reminders.userId,
      companyId: schema.reminders.companyId,
      title: schema.reminders.title,
      content: schema.reminders.content,
      reminderDate: schema.reminders.reminderDate,
      priority: schema.reminders.priority,
      color: schema.reminders.color,
      isCompleted: schema.reminders.isCompleted,
      isArchived: schema.reminders.isArchived,
      isPinned: schema.reminders.isPinned,
      notificationShown: schema.reminders.notificationShown,
      showBanner: schema.reminders.showBanner,
      assignedUserIds: schema.reminders.assignedUserIds,
      assignedBy: schema.reminders.assignedBy,
      assignedAt: schema.reminders.assignedAt,
      createdBy: schema.reminders.createdBy,
      createdAt: schema.reminders.createdAt,
      updatedAt: schema.reminders.updatedAt,
      creatorName: schema.users.fullName
    })
    .from(schema.reminders)
    .leftJoin(schema.users, eq(schema.reminders.createdBy, schema.users.id))
    .where(
      and(
        // Include reminders that are:
        // 1. Owned by the user OR 2. Assigned to the user (in assignedUserIds array)
        or(
          eq(schema.reminders.userId, userId), // User's own reminders
          sql`${userId} = ANY(${schema.reminders.assignedUserIds})` // Assigned to user
        ),
        eq(schema.reminders.isCompleted, false),
        eq(schema.reminders.isArchived, false),
        eq(schema.reminders.showBanner, true), // ONLY show reminders with banner enabled
        sql`${schema.reminders.reminderDate} IS NOT NULL`, // Must have a date configured
        lte(schema.reminders.reminderDate, nextWeek) // Date is within next 7 days
      )
    )
    .orderBy(schema.reminders.reminderDate);
    
    // Mark reminders as assigned or not
    return activeReminders.map(reminder => ({
      ...reminder,
      isAssigned: reminder.userId !== userId
    }));
  }

  async getDashboardReminders(userId: number): Promise<any[]> {
    const now = new Date();
    const nextWeek = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000)); // 7 days from now
    
    // Get user to check role and company
    const user = await this.getUser(userId);
    if (!user) return [];
    
    let dashboardReminders;
    
    // If admin/manager, show all company reminders; otherwise show only user's reminders
    if (user.role === 'admin' || user.role === 'manager') {
      dashboardReminders = await db.select({
        id: schema.reminders.id,
        userId: schema.reminders.userId,
        companyId: schema.reminders.companyId,
        title: schema.reminders.title,
        content: schema.reminders.content,
        reminderDate: schema.reminders.reminderDate,
        priority: schema.reminders.priority,
        color: schema.reminders.color,
        isCompleted: schema.reminders.isCompleted,
        isArchived: schema.reminders.isArchived,
        isPinned: schema.reminders.isPinned,
        notificationShown: schema.reminders.notificationShown,
        showBanner: schema.reminders.showBanner,
        createdBy: schema.reminders.createdBy,
        createdAt: schema.reminders.createdAt,
        updatedAt: schema.reminders.updatedAt,
        userFullName: schema.users.fullName
      })
      .from(schema.reminders)
      .leftJoin(schema.users, eq(schema.reminders.userId, schema.users.id))
      .where(
        and(
          eq(schema.reminders.companyId, user.companyId),
          eq(schema.reminders.isCompleted, false),
          eq(schema.reminders.isArchived, false),
          or(
            sql`${schema.reminders.reminderDate} IS NULL`, // No date - show always
            lte(schema.reminders.reminderDate, nextWeek) // Has date within 7 days
          )
        )
      )
      .orderBy(schema.reminders.reminderDate);
    } else {
      // Regular employee - only their reminders
      dashboardReminders = await db.select().from(schema.reminders)
        .where(
          and(
            eq(schema.reminders.userId, userId),
            eq(schema.reminders.isCompleted, false),
            eq(schema.reminders.isArchived, false),
            or(
              sql`${schema.reminders.reminderDate} IS NULL`, // No date - show always
              lte(schema.reminders.reminderDate, nextWeek) // Has date within 7 days
            )
          )
        )
        .orderBy(schema.reminders.reminderDate);
    }
    
    return dashboardReminders;
  }

  // Registration Settings operations
  async getRegistrationSettings(): Promise<any> {
    const [settings] = await db.select().from(schema.registrationSettings).limit(1);
    
    // Return default settings if none exist
    if (!settings) {
      return {
        id: 1,
        publicRegistrationEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }
    
    return settings;
  }

  async updateRegistrationSettings(updates: any): Promise<any> {
    // Try to update existing settings first
    const [existing] = await db.select().from(schema.registrationSettings).limit(1);
    
    if (existing) {
      const [updated] = await db
        .update(schema.registrationSettings)
        .set(updates)
        .where(eq(schema.registrationSettings.id, existing.id))
        .returning();
      return updated;
    } else {
      // Create new settings if none exist
      const [created] = await db
        .insert(schema.registrationSettings)
        .values({
          publicRegistrationEnabled: updates.publicRegistrationEnabled ?? true,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();
      return created;
    }
  }

  // Invitation Links operations
  async createInvitationLink(invitation: any): Promise<any> {
    const [result] = await db.insert(schema.invitationLinks).values(invitation).returning();
    return result;
  }

  async getInvitationByToken(token: string): Promise<any> {
    const [invitation] = await db.select().from(schema.invitationLinks)
      .where(eq(schema.invitationLinks.token, token));
    return invitation;
  }

  async getActiveInvitationByEmail(email: string): Promise<any> {
    const [invitation] = await db.select().from(schema.invitationLinks)
      .where(
        and(
          eq(schema.invitationLinks.email, email),
          eq(schema.invitationLinks.used, false),
          sql`${schema.invitationLinks.expiresAt} > NOW()`
        )
      );
    return invitation;
  }

  async getAllInvitationLinks(): Promise<any[]> {
    return db.select().from(schema.invitationLinks)
      .orderBy(desc(schema.invitationLinks.createdAt));
  }

  async deleteInvitationLink(id: number): Promise<boolean> {
    const result = await db.delete(schema.invitationLinks)
      .where(eq(schema.invitationLinks.id, id));
    return result.rowCount > 0;
  }

  async markInvitationAsUsed(id: number): Promise<boolean> {
    const result = await db
      .update(schema.invitationLinks)
      .set({ used: true, usedAt: new Date() })
      .where(eq(schema.invitationLinks.id, id));
    return result.rowCount > 0;
  }

  // Stripe payment methods
  async updateUserStripeCustomerId(userId: number, stripeCustomerId: string): Promise<User | undefined> {
    const [user] = await db
      .update(schema.users)
      .set({ stripeCustomerId })
      .where(eq(schema.users.id, userId))
      .returning();
    return user;
  }

  async updateSubscriptionStatus(subscriptionId: number, status: string): Promise<any | undefined> {
    const [subscription] = await db
      .update(schema.subscriptions)
      .set({ 
        status,
        updatedAt: new Date()
      })
      .where(eq(schema.subscriptions.id, subscriptionId))
      .returning();
    return subscription;
  }

  async getCompanyByUserId(userId: number): Promise<any | undefined> {
    // First get the user to find their company
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
    console.log('DEBUG - getCompanyByUserId user:', user);
    if (!user) {
      console.log('DEBUG - No user found for userId:', userId);
      return undefined;
    }

    // Get the company
    const [company] = await db.select().from(schema.companies).where(eq(schema.companies.id, user.companyId));
    console.log('DEBUG - getCompanyByUserId company:', company);
    if (!company) {
      console.log('DEBUG - No company found for companyId:', user.companyId);
      return undefined;
    }

    // Get the subscription
    const [subscription] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.companyId, company.id));
    console.log('DEBUG - getCompanyByUserId subscription:', subscription);
    
    const result = {
      ...company,
      subscription: subscription || null
    };
    console.log('DEBUG - getCompanyByUserId result:', result);
    
    return result;
  }

  // Custom Holidays operations - stub implementations since holidays schema not fully defined
  async getCustomHolidaysByCompany(companyId: number): Promise<any[]> {
    // Return empty array since custom holidays table doesn't exist yet
    return [];
  }

  async createCustomHoliday(holiday: any): Promise<any> {
    // Stub implementation - would create custom holiday in a holidays table
    return { id: Date.now(), ...holiday };
  }

  async deleteCustomHoliday(id: number): Promise<boolean> {
    // Stub implementation - would delete from holidays table
    return true;
  }

  // Employee Activation Tokens operations
  async createActivationToken(token: InsertEmployeeActivationToken): Promise<EmployeeActivationToken> {
    const [result] = await db.insert(schema.employeeActivationTokens).values(token).returning();
    return result;
  }

  async getActivationToken(token: string): Promise<EmployeeActivationToken | undefined> {
    const [result] = await db.select().from(schema.employeeActivationTokens)
      .where(
        and(
          eq(schema.employeeActivationTokens.token, token),
          eq(schema.employeeActivationTokens.used, false),
          sql`${schema.employeeActivationTokens.expiresAt} > NOW()`
        )
      );
    return result;
  }

  async getActivationTokenByUserId(userId: number): Promise<EmployeeActivationToken | undefined> {
    const [result] = await db.select().from(schema.employeeActivationTokens)
      .where(
        and(
          eq(schema.employeeActivationTokens.userId, userId),
          eq(schema.employeeActivationTokens.used, false),
          sql`${schema.employeeActivationTokens.expiresAt} > NOW()`
        )
      )
      .orderBy(desc(schema.employeeActivationTokens.createdAt));
    return result;
  }

  async markTokenAsUsed(id: number): Promise<EmployeeActivationToken | undefined> {
    const [result] = await db
      .update(schema.employeeActivationTokens)
      .set({ used: true })
      .where(eq(schema.employeeActivationTokens.id, id))
      .returning();
    return result;
  }

  async deleteActivationToken(id: number): Promise<boolean> {
    const result = await db.delete(schema.employeeActivationTokens)
      .where(eq(schema.employeeActivationTokens.id, id));
    return result.rowCount > 0;
  }

  async cleanupExpiredTokens(): Promise<number> {
    const result = await db.delete(schema.employeeActivationTokens)
      .where(sql`${schema.employeeActivationTokens.expiresAt} <= NOW()`);
    return result.rowCount;
  }

  // Reminder Assignments operations - now using arrays in reminders table
  async assignReminderToUsers(reminderId: number, userIds: number[], assignedBy: number): Promise<any> {
    const [updatedReminder] = await db.update(schema.reminders)
      .set({
        assignedUserIds: userIds,
        assignedBy,
        assignedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(schema.reminders.id, reminderId))
      .returning();
    return updatedReminder;
  }

  async getReminderAssignments(reminderId: number): Promise<any[]> {
    const [reminder] = await db.select({
      assignedUserIds: schema.reminders.assignedUserIds,
      assignedBy: schema.reminders.assignedBy,
      assignedAt: schema.reminders.assignedAt
    })
    .from(schema.reminders)
    .where(eq(schema.reminders.id, reminderId));

    if (!reminder?.assignedUserIds?.length) {
      return [];
    }

    // Get user details for assigned users
    const users = await db.select({
      id: schema.users.id,
      fullName: schema.users.fullName,
      email: schema.users.companyEmail
    })
    .from(schema.users)
    .where(inArray(schema.users.id, reminder.assignedUserIds));

    return users.map(user => ({
      assignedUserId: user.id,
      userName: user.fullName,
      userEmail: user.email,
      assignedBy: reminder.assignedBy,
      assignedAt: reminder.assignedAt
    }));
  }

  async removeUserFromReminderAssignment(reminderId: number, userIdToRemove: number): Promise<boolean> {
    try {
      const [reminder] = await db.select({ assignedUserIds: schema.reminders.assignedUserIds })
        .from(schema.reminders)
        .where(eq(schema.reminders.id, reminderId));

      if (!reminder?.assignedUserIds?.length) {
        return false;
      }

      const updatedUserIds = reminder.assignedUserIds.filter(id => id !== userIdToRemove);
      
      await db.update(schema.reminders)
        .set({ 
          assignedUserIds: updatedUserIds.length > 0 ? updatedUserIds : null,
          updatedAt: new Date()
        })
        .where(eq(schema.reminders.id, reminderId));

      return true;
    } catch (error) {
      console.error('Storage: error in removeUserFromReminderAssignment:', error);
      return false;
    }
  }

  async clearReminderAssignments(reminderId: number): Promise<boolean> {
    try {
      await db.update(schema.reminders)
        .set({ 
          assignedUserIds: null,
          assignedBy: null,
          assignedAt: null,
          updatedAt: new Date()
        })
        .where(eq(schema.reminders.id, reminderId));
      return true;
    } catch (error) {
      console.error('Storage: error in clearReminderAssignments:', error);
      return false;
    }
  }

  async clearAllReminderAssignments(reminderId: number): Promise<boolean> {
    try {
      await db.update(schema.reminders)
        .set({ 
          assignedUserIds: null,
          assignedBy: null,
          assignedAt: null,
          updatedAt: new Date()
        })
        .where(eq(schema.reminders.id, reminderId));
      return true;
    } catch (error) {
      console.error('Storage: error in clearAllReminderAssignments:', error);
      return false;
    }
  }

  async getRemindersByUserWithAssignments(userId: number): Promise<any[]> {
    // Get user's own reminders
    const ownReminders = await db.select().from(schema.reminders)
      .where(eq(schema.reminders.userId, userId))
      .orderBy(schema.reminders.isPinned, schema.reminders.reminderDate, schema.reminders.createdAt);

    // Get reminders assigned to the user using the new array structure
    const assignedReminders = await db.select({
      id: schema.reminders.id,
      userId: schema.reminders.userId,
      companyId: schema.reminders.companyId,
      title: schema.reminders.title,
      content: schema.reminders.content,
      reminderDate: schema.reminders.reminderDate,
      priority: schema.reminders.priority,
      color: schema.reminders.color,
      isCompleted: schema.reminders.isCompleted,
      isArchived: schema.reminders.isArchived,
      isPinned: schema.reminders.isPinned,
      notificationShown: schema.reminders.notificationShown,
      showBanner: schema.reminders.showBanner,
      assignedUserIds: schema.reminders.assignedUserIds,
      assignedBy: schema.reminders.assignedBy,
      assignedAt: schema.reminders.assignedAt,
      createdBy: schema.reminders.createdBy,
      createdAt: schema.reminders.createdAt,
      updatedAt: schema.reminders.updatedAt,
      creatorName: schema.users.fullName
    })
    .from(schema.reminders)
    .leftJoin(schema.users, eq(schema.reminders.createdBy, schema.users.id))
    .where(sql`${userId} = ANY(${schema.reminders.assignedUserIds})`)
    .orderBy(schema.reminders.isPinned, schema.reminders.reminderDate, schema.reminders.createdAt);

    // Mark own reminders as not assigned and assigned reminders as assigned
    const ownRemindersWithFlag = ownReminders.map(reminder => ({
      ...reminder,
      isAssigned: false,
      creatorName: null // Own reminders don't need creator name
    }));

    const assignedRemindersWithFlag = assignedReminders
      .filter(reminder => reminder.userId !== userId) // Only include reminders not owned by user
      .map(reminder => ({
        ...reminder,
        isAssigned: true
      }));

    return [...ownRemindersWithFlag, ...assignedRemindersWithFlag];
  }

  async getEmployeesByCompany(companyId: number): Promise<any[]> {
    return await db.select({
      id: schema.users.id,
      fullName: schema.users.fullName,
      email: schema.users.companyEmail,
      role: schema.users.role,
      position: schema.users.position,
      profilePicture: schema.users.profilePicture
    })
    .from(schema.users)
    .where(eq(schema.users.companyId, companyId))
    .orderBy(schema.users.fullName);
  }

  // ⚠️ PROTECTED - DO NOT MODIFY - Incomplete Work Sessions Notifications
  async createIncompleteSessionNotification(userId: number, workSessionId: number, createdBy: number): Promise<SystemNotification> {
    const notification = {
      userId,
      type: 'incomplete_session',
      category: 'time-tracking',
      title: 'Fichaje Incompleto',
      message: 'Tienes una sesión de trabajo abierta que necesita ser cerrada.',
      actionUrl: '/employee/time-tracking',
      priority: 'high' as const,
      isRead: false,
      isCompleted: false,
      metadata: JSON.stringify({ workSessionId }),
      createdBy
    };
    
    return await this.createNotification(notification);
  }

  // ⚠️ PROTECTED - DO NOT MODIFY - Check and create notifications for incomplete sessions
  async checkAndCreateIncompleteSessionNotifications(companyId: number): Promise<void> {
    try {
      // Get company settings for working hours
      const [company] = await db.select({
        workingHoursPerDay: schema.companies.workingHoursPerDay
      })
      .from(schema.companies)
      .where(eq(schema.companies.id, companyId));

      if (!company) return;

      const maxHours = company.workingHoursPerDay || 8;
      const maxMilliseconds = maxHours * 60 * 60 * 1000;
      const now = new Date();

      // Find all incomplete sessions that exceed max working hours
      const incompleteSessions = await db.select({
        id: schema.workSessions.id,
        userId: schema.workSessions.userId,
        clockIn: schema.workSessions.clockIn,
        userFullName: schema.users.fullName
      })
      .from(schema.workSessions)
      .leftJoin(schema.users, eq(schema.workSessions.userId, schema.users.id))
      .where(and(
        eq(schema.users.companyId, companyId),
        isNull(schema.workSessions.clockOut)
      ));

      for (const session of incompleteSessions) {
        const clockInTime = new Date(session.clockIn!);
        const elapsed = now.getTime() - clockInTime.getTime();

        if (elapsed > maxMilliseconds) {
          // Check if notification already exists for this session
          const existingNotification = await db.select()
            .from(schema.systemNotifications)
            .where(and(
              eq(schema.systemNotifications.userId, session.userId!),
              eq(schema.systemNotifications.type, 'incomplete_session'),
              eq(schema.systemNotifications.category, 'time-tracking'),
              eq(schema.systemNotifications.isCompleted, false),
              sql`${schema.systemNotifications.metadata}::json->>'workSessionId' = ${session.id.toString()}`
            ))
            .limit(1);

          if (existingNotification.length === 0) {
            // Create notification for this incomplete session
            await this.createIncompleteSessionNotification(
              session.userId!,
              session.id,
              1 // System-generated notification
            );
          }
        }
      }
    } catch (error) {
      console.error('Error checking incomplete session notifications:', error);
    }
  }
}

export const storage = new DrizzleStorage();
