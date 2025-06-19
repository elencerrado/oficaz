import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { eq, and, desc, sql } from 'drizzle-orm';
import * as schema from '@shared/schema';
import type {
  Company, CompanyConfig, User, WorkSession, VacationRequest, Document, Message,
  InsertCompany, InsertCompanyConfig, InsertUser, InsertWorkSession, InsertVacationRequest, InsertDocument, InsertMessage
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
  getDocument(id: number): Promise<Document | undefined>;
  deleteDocument(id: number): Promise<boolean>;

  // Messages
  createMessage(message: InsertMessage): Promise<Message>;
  getMessagesByUser(userId: number): Promise<Message[]>;
  markMessageAsRead(id: number): Promise<Message | undefined>;
  getUnreadMessageCount(userId: number): Promise<number>;
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
    const [user] = await db.select().from(schema.users).where(eq(schema.users.dni, dni));
    return user;
  }

  async getUserByDniAndCompany(dni: string, companyId: number): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users)
      .where(and(eq(schema.users.dni, dni), eq(schema.users.companyId, companyId)));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email));
    return user;
  }

  async getUsersByCompany(companyId: number): Promise<User[]> {
    return db.select().from(schema.users).where(eq(schema.users.companyId, companyId));
  }

  async updateUser(id: number, updates: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db.update(schema.users).set(updates).where(eq(schema.users.id, id)).returning();
    return user;
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

  async updateWorkSession(id: number, updates: Partial<InsertWorkSession>): Promise<WorkSession | undefined> {
    const [session] = await db.update(schema.workSessions).set(updates).where(eq(schema.workSessions.id, id)).returning();
    return session;
  }

  async getWorkSessionsByUser(userId: number, limit = 10): Promise<WorkSession[]> {
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
    }).from(schema.workSessions)
      .innerJoin(schema.users, eq(schema.workSessions.userId, schema.users.id))
      .where(eq(schema.users.companyId, companyId));
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
    return db.select({
      id: schema.vacationRequests.id,
      userId: schema.vacationRequests.userId,
      startDate: schema.vacationRequests.startDate,
      endDate: schema.vacationRequests.endDate,
      reason: schema.vacationRequests.reason,
      status: schema.vacationRequests.status,
      reviewedBy: schema.vacationRequests.reviewedBy,
      reviewedAt: schema.vacationRequests.reviewedAt,
      createdAt: schema.vacationRequests.createdAt,
    }).from(schema.vacationRequests)
      .innerJoin(schema.users, eq(schema.vacationRequests.userId, schema.users.id))
      .where(eq(schema.users.companyId, companyId))
      .orderBy(desc(schema.vacationRequests.createdAt));
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
      .where(eq(schema.messages.receiverId, userId))
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
}

export const storage = new DrizzleStorage();
