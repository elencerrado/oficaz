import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { eq, and, or, desc, sql } from 'drizzle-orm';
import * as schema from '@shared/schema';
import type {
  Company, CompanyConfig, User, WorkSession, VacationRequest, Document, Message, DocumentNotification, SystemNotification,
  InsertCompany, InsertCompanyConfig, InsertUser, InsertWorkSession, InsertVacationRequest, InsertDocument, InsertMessage, InsertDocumentNotification, InsertSystemNotification
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
  getAllCompanies(): Promise<Company[]>;
  updateCompany(id: number, updates: Partial<InsertCompany>): Promise<Company | undefined>;

  // Company Configurations
  createCompanyConfig?(config: InsertCompanyConfig): Promise<CompanyConfig>;
  getCompanyConfig?(companyId: number): Promise<CompanyConfig | undefined>;

  // Users
  createUser(user: InsertUser): Promise<User>;
  getUser(id: number): Promise<User | undefined>;
  getUserByDni(dni: string): Promise<User | undefined>;
  getUserByDniAndCompany(dni: string, companyId: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsersByCompany(companyId: number): Promise<User[]>;
  updateUser(id: number, updates: Partial<InsertUser>): Promise<User | undefined>;

  // Work Sessions
  createWorkSession(session: InsertWorkSession): Promise<WorkSession>;
  getActiveWorkSession(userId: number): Promise<WorkSession | undefined>;
  getWorkSession(id: number): Promise<WorkSession | undefined>;
  updateWorkSession(id: number, updates: Partial<InsertWorkSession>): Promise<WorkSession | undefined>;
  getWorkSessionsByUser(userId: number, limit?: number): Promise<WorkSession[]>;
  getWorkSessionsByCompany(companyId: number): Promise<WorkSession[]>;

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

  // Document Notifications (legacy - backward compatibility) 
  getDocumentNotificationsByUser(userId: number): Promise<DocumentNotification[]>;
  getDocumentNotificationsByCompany(companyId: number): Promise<DocumentNotification[]>;
  createDocumentNotification(notification: InsertDocumentNotification): Promise<DocumentNotification>;
  markDocumentNotificationCompleted(id: number): Promise<DocumentNotification | undefined>;

  // Custom Holidays
  getCustomHolidaysByCompany(companyId: number): Promise<CustomHoliday[]>;
  createCustomHoliday(holiday: InsertCustomHoliday): Promise<CustomHoliday>;
  deleteCustomHoliday(id: number): Promise<boolean>;

  // Super Admin operations
  getSuperAdminByEmail(email: string): Promise<SuperAdmin | undefined>;
  createSuperAdmin(admin: InsertSuperAdmin): Promise<SuperAdmin>;
  getAllCompaniesWithStats(): Promise<CompanyWithStats[]>;
  getSuperAdminStats(): Promise<SuperAdminStats>;
  createSubscription(subscription: InsertSubscription): Promise<Subscription>;
  getSubscriptionByCompanyId(companyId: number): Promise<Subscription | undefined>;
  updateCompanySubscription(companyId: number, updates: any): Promise<any | undefined>;
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

  async createCompanyConfig(config: InsertCompanyConfig): Promise<CompanyConfig> {
    const [result] = await db.insert(schema.companyConfigs).values(config).returning();
    return result;
  }

  async getCompanyConfig(companyId: number): Promise<CompanyConfig | undefined> {
    const [config] = await db.select().from(schema.companyConfigs).where(eq(schema.companyConfigs.companyId, companyId));
    return config;
  }

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
    return db.select().from(schema.users).where(eq(schema.users.companyId, companyId));
  }

  async updateUser(id: number, updates: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db.update(schema.users).set(updates).where(eq(schema.users.id, id)).returning();
    return user;
  }

  // Calculate vacation days based on start date and company policy
  async calculateVacationDays(userId: number): Promise<number> {
    const user = await this.getUser(userId);
    if (!user) return 0;

    const companyConfig = await this.getCompanyConfig?.(user.companyId);
    const defaultDaysPerMonth = parseFloat(companyConfig?.defaultVacationPolicy || '2.5');
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
    const [session] = await db.select().from(schema.workSessions)
      .where(and(eq(schema.workSessions.userId, userId), eq(schema.workSessions.status, 'active')));
    return session;
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
      .orderBy(desc(schema.workSessions.createdAt))
      .limit(limit);
  }

  async getWorkSessionsByCompany(companyId: number): Promise<WorkSession[]> {
    return db.select({
      id: schema.workSessions.id,
      userId: schema.workSessions.userId,
      clockIn: schema.workSessions.clockIn,
      clockOut: schema.workSessions.clockOut,
      totalHours: schema.workSessions.totalHours,
      status: schema.workSessions.status,
      createdAt: schema.workSessions.createdAt,
      userName: schema.users.fullName,
    }).from(schema.workSessions)
      .innerJoin(schema.users, eq(schema.workSessions.userId, schema.users.id))
      .where(eq(schema.users.companyId, companyId))
      .orderBy(desc(schema.workSessions.createdAt));
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

  // Document Notifications methods
  async getDocumentNotificationsByUser(userId: number): Promise<DocumentNotification[]> {
    return await db
      .select({
        id: schema.documentNotifications.id,
        userId: schema.documentNotifications.userId,
        documentType: schema.documentNotifications.documentType,
        message: schema.documentNotifications.message,
        isCompleted: schema.documentNotifications.isCompleted,
        dueDate: schema.documentNotifications.dueDate,
        createdAt: schema.documentNotifications.createdAt,
        user: {
          id: schema.users.id,
          fullName: schema.users.fullName,
          email: schema.users.email
        }
      })
      .from(schema.documentNotifications)
      .leftJoin(schema.users, eq(schema.documentNotifications.userId, schema.users.id))
      .where(eq(schema.documentNotifications.userId, userId))
      .orderBy(desc(schema.documentNotifications.createdAt));
  }

  async getDocumentNotificationsByCompany(companyId: number): Promise<DocumentNotification[]> {
    return await db
      .select({
        id: schema.documentNotifications.id,
        userId: schema.documentNotifications.userId,
        documentType: schema.documentNotifications.documentType,
        message: schema.documentNotifications.message,
        isCompleted: schema.documentNotifications.isCompleted,
        dueDate: schema.documentNotifications.dueDate,
        createdAt: schema.documentNotifications.createdAt,
        user: {
          id: schema.users.id,
          fullName: schema.users.fullName,
          email: schema.users.email
        }
      })
      .from(schema.documentNotifications)
      .leftJoin(schema.users, eq(schema.documentNotifications.userId, schema.users.id))
      .where(eq(schema.users.companyId, companyId))
      .orderBy(desc(schema.documentNotifications.createdAt));
  }

  async createDocumentNotification(notification: InsertDocumentNotification): Promise<DocumentNotification> {
    const [result] = await db
      .insert(schema.documentNotifications)
      .values(notification)
      .returning();
    return result;
  }

  async markNotificationCompleted(id: number): Promise<SystemNotification | undefined> {
    // This method is for the unified notification system
    const [result] = await db.update(schema.systemNotifications)
      .set({ isCompleted: true, updatedAt: new Date() })
      .where(eq(schema.systemNotifications.id, id))
      .returning();
    return result;
  }

  // Legacy document notification method (backward compatibility)
  async markDocumentNotificationCompleted(id: number): Promise<DocumentNotification | undefined> {
    const [result] = await db
      .update(schema.documentNotifications)
      .set({ isCompleted: true })
      .where(eq(schema.documentNotifications.id, id))
      .returning();
    return result;
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
        subscriptionStartDate: schema.subscriptions.startDate,
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
        plan: row.subscriptionPlan || 'free',
        status: row.subscriptionStatus || 'active',
        maxUsers: row.subscriptionMaxUsers || 5,
        startDate: row.subscriptionStartDate?.toISOString() || new Date().toISOString(),
        endDate: row.subscriptionEndDate?.toISOString(),
      },
      createdAt: row.createdAt?.toISOString() || new Date().toISOString(),
    }));
  }

  async getSuperAdminStats(): Promise<any> {
    const companiesCount = await db.select({ count: sql<number>`count(*)` }).from(schema.companies);
    const usersCount = await db.select({ count: sql<number>`count(*)` }).from(schema.users);
    
    // Get subscription stats
    const subscriptionStats = await db
      .select({
        plan: schema.subscriptions.plan,
        count: sql<number>`count(*)`,
      })
      .from(schema.subscriptions)
      .groupBy(schema.subscriptions.plan);

    const planCounts = subscriptionStats.reduce((acc, row) => {
      acc[row.plan as keyof typeof acc] = row.count;
      return acc;
    }, { free: 0, basic: 0, pro: 0, master: 0 });

    // Calculate active paid subscriptions
    const activeSubscriptions = subscriptionStats.reduce((acc, row) => {
      if (row.plan !== 'free') {
        acc += row.count;
      }
      return acc;
    }, 0);

    // Calculate revenue
    const pricing = { basic: 29, pro: 59, master: 149 };
    const revenue = subscriptionStats.reduce((acc, row) => {
      if (row.plan !== 'free') {
        acc += (pricing[row.plan as keyof typeof pricing] || 0) * row.count;
      }
      return acc;
    }, 0);

    return {
      totalCompanies: companiesCount[0]?.count || 0,
      totalUsers: usersCount[0]?.count || 0,
      activeSubscriptions,
      revenue,
      planDistribution: planCounts,
    };
  }

  async createSubscription(subscription: any): Promise<any> {
    const [newSubscription] = await db.insert(schema.subscriptions).values(subscription).returning();
    return newSubscription;
  }

  async getSubscriptionByCompanyId(companyId: number): Promise<any | undefined> {
    const [subscription] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.companyId, companyId));
    return subscription;
  }

  async updateCompanySubscription(companyId: number, updates: any): Promise<any | undefined> {
    const [subscription] = await db
      .update(schema.subscriptions)
      .set({
        plan: updates.plan,
        maxUsers: updates.maxUsers,
        status: updates.status,
        updatedAt: new Date()
      })
      .where(eq(schema.subscriptions.companyId, companyId))
      .returning();
    
    return subscription;
  }
}

export const storage = new DrizzleStorage();
